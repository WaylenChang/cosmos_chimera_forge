"""Tests for staged Colab pipeline execution and GPU auto-shutdown guard."""
from argparse import Namespace
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import anime3d_agent as agent
import anime3d_colab_guard as guard
import anime3d_universal as runner


def write_glb(path: Path, skinned: bool = False) -> None:
    doc = {"asset": {"version": "2.0"}, "nodes": [{"mesh": 0}], "meshes": [{"primitives": []}]}
    if skinned:
        doc["nodes"].append({"skin": 0})
        doc["skins"] = [{"joints": [0]}]
    data = json.dumps(doc).encode()
    data += b" " * (-len(data) % 4)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(
        struct.pack("<4sII", b"glTF", 2, 20 + len(data))
        + struct.pack("<I4s", len(data), b"JSON")
        + data
    )


class ColabStageAndGuardTests(unittest.TestCase):
    def _setup_job(self, root: Path):
        image = root / "front.png"
        image.write_bytes(b"source portrait")
        spec = root / "spec.json"
        agent.save(spec, {"asset_class": "humanoid", "source_pack": "approved", "license_status": "internal_only"})
        cfg = root / "backends.json"
        cfg.write_text("{}")
        blender = root / "blender"
        blender.write_bytes(b"fake blender")
        return image, spec, cfg, blender

    def test_staged_execution_preserves_strict_order(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image, spec, cfg, blender = self._setup_job(root)
            base_args = dict(
                root=str(root),
                asset_id="mdl-staged",
                spec=str(spec),
                execute=True,
                allow_paid_tripo=False,
                backend="pixal3d",
                rig_backend="skintokens",
                pipeline="colab",
                generator_executable=None,
                input_model=None,
                backend_config=str(cfg),
                blender=str(blender),
            )

            def fake_gen(backend, c, img, s, out):
                write_glb(out, skinned=False)
                return {"backend": backend}

            def fake_rig(c, src, dst):
                write_glb(dst, skinned=True)
                import hashlib

                return {"backend": "skintokens", "sha256": hashlib.sha256(dst.read_bytes()).hexdigest()}

            def fake_blender(argv, timeout):
                out_dir = Path(argv[argv.index("--") + 2])
                agent.save(out_dir / "qa/typed_metrics.json", {"automated_pass": True})
                return subprocess.CompletedProcess(argv, 0, stdout="ok", stderr="")

            with (
                patch.object(agent, "validate", return_value=image),
                patch.object(runner, "run_official_backend", side_effect=fake_gen) as gen_mock,
                patch.object(runner, "run_skintokens", side_effect=fake_rig) as rig_mock,
                patch.object(runner, "validate_skin", return_value={"skinned_mesh_count": 1}),
                patch.object(runner, "run_checked", side_effect=fake_blender) as bl_mock,
            ):
                # Cannot jump to post_gpu before gpu stage completes
                with self.assertRaisesRegex(ValueError, "requires completed N02"):
                    runner.run(Namespace(stage="post_gpu", **base_args))

                # 1. pre_gpu (N00-N01)
                self.assertEqual(runner.run(Namespace(stage="pre_gpu", **base_args)), 0)
                gen_mock.assert_not_called()
                rig_mock.assert_not_called()
                bl_mock.assert_not_called()

                # 2. gpu (N02-N04, never invokes Blender)
                self.assertEqual(runner.run(Namespace(stage="gpu", **base_args)), 0)
                self.assertEqual(gen_mock.call_count, 1)
                self.assertEqual(rig_mock.call_count, 1)
                bl_mock.assert_not_called()
                state = agent.load(root / "02_3d/colab/mdl-staged/typed_state.json")
                self.assertEqual(state["stage_completed"], "gpu")
                self.assertEqual(state["status"], "GPU_COMPLETED")

                # 3. post_gpu (N05-N08, never invokes GPU backends)
                self.assertEqual(runner.run(Namespace(stage="post_gpu", **base_args)), 0)
                self.assertEqual(gen_mock.call_count, 1)
                self.assertEqual(rig_mock.call_count, 1)
                self.assertEqual(bl_mock.call_count, 1)
                state = agent.load(root / "02_3d/colab/mdl-staged/typed_state.json")
                self.assertEqual(state["stage_completed"], "post_gpu")
                self.assertEqual(state["status"], "REVIEW_REQUIRED")

    def test_empty_gpu_queue_shuts_down_immediately(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            queue = root / "batch_queue.json"
            queue.write_text("[]", encoding="utf8")
            reasons = []
            rc = guard.run_batch(
                root=root,
                queue_path=queue,
                stage="gpu",
                auto_shutdown=True,
                shutdown_fn=reasons.append,
            )
            self.assertEqual(rc, 0)
            self.assertEqual(reasons, ["empty_gpu_queue"])

    def test_gpu_batch_shuts_down_even_on_job_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            queue = root / "batch_queue.json"
            queue.write_text(
                json.dumps([{"asset_id": "mdl-1", "spec": "s1.json"}, {"asset_id": "mdl-2", "spec": "s2.json"}]),
                encoding="utf8",
            )
            reasons = []
            cmds = []

            def fake_run(argv):
                cmds.append(argv)
                return 2 if "mdl-1" in argv else 0

            rc = guard.run_batch(
                root=root,
                queue_path=queue,
                stage="gpu",
                auto_shutdown=True,
                shutdown_fn=reasons.append,
                runner_fn=fake_run,
            )
            self.assertEqual(rc, 2)
            self.assertEqual(len(cmds), 2)
            self.assertIn("--stage", cmds[0])
            self.assertEqual(reasons, ["gpu_stage_finished"])
            ok, data = guard.verify_colab_shutdown(root)
            self.assertTrue(ok)
            self.assertFalse(data["gpu_runtime_active"])
            self.assertTrue(data["unassign_invoked"])

    def test_verify_shutdown_rejects_active_or_missing_runtime(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ok_missing, _ = guard.verify_colab_shutdown(root)
            self.assertFalse(ok_missing)

            guard.write_runtime_status(root, active=True, reason="still_running", unassign_invoked=False)
            ok_active, data = guard.verify_colab_shutdown(root)
            self.assertFalse(ok_active)
            self.assertTrue(data["gpu_runtime_active"])

            cli = subprocess.run(
                [sys.executable, str(ROOT / "scripts/anime3d_colab_guard.py"), "--root", str(root), "--verify-shutdown"],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(cli.returncode, 2)

    def test_idle_watchdog_triggers_shutdown_when_inactive(self):
        reasons = []
        wd = guard.GpuIdleWatchdog(
            idle_timeout_sec=0.15,
            poll_interval_sec=0.05,
            shutdown_fn=reasons.append,
            util_fn=lambda: 0,
        )
        wd.start()
        try:
            deadline = time.monotonic() + 2.0
            while not reasons and time.monotonic() < deadline:
                time.sleep(0.05)
        finally:
            wd.stop()
        self.assertEqual(reasons, ["idle_timeout"])


if __name__ == "__main__":
    unittest.main()
