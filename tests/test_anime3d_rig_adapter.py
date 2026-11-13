"""Rig-stage contracts, using labeled structural fixtures, not GPU inference."""
from argparse import Namespace
import hashlib
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import anime3d_agent as agent
import anime3d_rig_adapter as rig
import anime3d_universal as runner


def fixture(path, skinned=False):
    doc = {"asset": {"version": "2.0"}, "nodes": [{"mesh": 0}, {}],
           "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}]}
    if skinned:
        doc["nodes"][0]["skin"] = 0
        doc["skins"] = [{"joints": [1]}]
        doc["meshes"][0]["primitives"][0]["attributes"].update(JOINTS_0=1, WEIGHTS_0=2)
    body = json.dumps(doc).encode()
    body += b" " * (-len(body) % 4)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(struct.pack("<4sII", b"glTF", 2, 20 + len(body)) +
                     struct.pack("<I4s", len(body), b"JSON") + body)


class RigContracts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / "original.glb"
        fixture(self.source)
        self.output = self.root / "rig/asset.glb"
        self.runtime = {"repo": self.root, "python": Path(sys.executable),
                        "checkpoint": self.root / "learned.ckpt"}

    def test_mesh_only_result_is_not_a_rig(self):
        with self.assertRaisesRegex(rig.BackendError, "no skinned mesh"):
            rig.validate_skin(self.source)
        fixture(self.output, skinned=True)
        self.assertEqual(rig.validate_skin(self.output)["skinned_mesh_count"], 1)

    def test_rejects_invalid_joint_hierarchy(self):
        fixture(self.output, skinned=True)
        raw = self.output.read_bytes()
        # Same byte length but a joint index outside the two-node scene.
        self.output.write_bytes(raw.replace(b'"joints": [1]', b'"joints": [9]'))
        with self.assertRaisesRegex(rig.BackendError, "joint hierarchy"):
            rig.validate_skin(self.output)

    def test_requires_checkpoint_before_inference(self):
        for name in ("demo.py", "bpy_server.py"):
            (self.root / name).write_text("# fixture")
        config = self.root / "backends.json"
        config.write_text(json.dumps({"skintokens": {"repo": str(self.root), "python": sys.executable}}))
        with self.assertRaisesRegex(rig.BackendError, "checkpoint missing"):
            rig.runtime_config(config)

    def test_virtualenv_python_path_is_not_resolved_to_base_interpreter(self):
        from anime3d_backend_adapter import runtime_config as image_runtime
        for name in ("demo.py", "bpy_server.py", "inference.py", "learned.ckpt"):
            (self.root / name).write_text("# fixture")
        launcher = self.root / "venv/bin/python"
        launcher.parent.mkdir(parents=True)
        launcher.write_text("virtualenv launcher fixture")
        launcher.chmod(0o755)
        config = self.root / "backends.json"
        entry = {"repo": str(self.root), "python": str(launcher), "checkpoint": "learned.ckpt"}
        config.write_text(json.dumps({"skintokens": entry, "pixal3d": entry}))
        original_resolve = Path.resolve
        def simulated_symlink_resolve(path, *args, **kwargs):
            return Path(sys.executable) if path == launcher else original_resolve(path, *args, **kwargs)
        with patch.object(Path, "resolve", simulated_symlink_resolve):
            self.assertEqual(rig.runtime_config(config)["python"], launcher)
            self.assertEqual(image_runtime("pixal3d", config)["python"], launcher)

    def test_failure_cannot_publish_stale_output_or_change_source(self):
        before = self.source.read_bytes()
        fixture(self.output, skinned=True)
        old_output = self.output.read_bytes()
        process = Mock()
        process.wait.return_value = 1
        with patch.object(rig, "runtime_config", return_value=self.runtime), \
             patch.object(rig.subprocess, "Popen", return_value=process):
            with self.assertRaisesRegex(rig.BackendError, "exited 1"):
                rig.run(self.root / "config", self.source, self.output)
        self.assertEqual(self.source.read_bytes(), before)
        self.assertEqual(self.output.read_bytes(), old_output)

    def test_uses_transfer_and_publishes_only_new_skin(self):
        before = self.source.read_bytes()
        def launch(argv, **kwargs):
            self.assertIn("--use_transfer", argv)
            self.assertNotIn("--use_skeleton", argv)
            fixture(Path(argv[argv.index("--output") + 1]), skinned=True)
            process = Mock()
            process.wait.return_value = 0
            return process
        with patch.object(rig, "runtime_config", return_value=self.runtime), \
             patch.object(rig.subprocess, "Popen", side_effect=launch):
            result = rig.run(self.root / "config", self.source, self.output)
        self.assertEqual(result["source_sha256"], hashlib.sha256(before).hexdigest())
        self.assertEqual(self.source.read_bytes(), before)
        self.assertTrue(result["use_transfer"])

    def test_zero_exit_with_no_output_is_rejected(self):
        process = Mock()
        process.wait.return_value = 0
        with patch.object(rig, "runtime_config", return_value=self.runtime), \
             patch.object(rig.subprocess, "Popen", return_value=process):
            with self.assertRaisesRegex(rig.BackendError, "not produced"):
                rig.run(self.root / "config", self.source, self.output)
        self.assertFalse(self.output.exists())

    def test_timeout_signals_child_before_returning_failure(self):
        process = Mock()
        process.wait.side_effect = [rig.subprocess.TimeoutExpired(["fixture"], 1), 0]
        with patch.object(rig, "runtime_config", return_value=self.runtime), \
             patch.object(rig.subprocess, "Popen", return_value=process):
            with self.assertRaises(rig.subprocess.TimeoutExpired):
                rig.run(self.root / "config", self.source, self.output, timeout=1)
        self.assertEqual(process.wait.call_count, 2)
        self.assertEqual(process.send_signal.call_count + process.terminate.call_count, 1)
        process.kill.assert_not_called()
        self.assertFalse(self.output.exists())

    def test_runner_resumes_mesh_and_rig_separately_and_detects_tampering(self):
        image = self.root / "front.png"
        image.write_bytes(b"labeled source fixture, not a portrait")
        spec = self.root / "spec.json"
        agent.save(spec, {"asset_class": "humanoid", "source_pack": "approved",
                          "license_status": "internal_only"})
        config = self.root / "backends.json"
        config.write_text("{}")
        args = Namespace(root=str(self.root), asset_id="mdl-rig", spec=str(spec), execute=True,
                         allow_paid_tripo=False, backend="pixal3d", pipeline="colab",
                         generator_executable=None, input_model=None, backend_config=str(config),
                         blender=None, rig_backend="skintokens")
        def generate(backend, cfg, img, spec, output):
            fixture(output)
            return {"backend": backend}
        def skin(cfg, source, output):
            fixture(output, skinned=True)
            return {"sha256": hashlib.sha256(output.read_bytes()).hexdigest()}
        with patch.object(agent, "validate", return_value=image), \
             patch.object(runner, "run_official_backend", side_effect=generate) as gen, \
             patch.object(runner, "run_skintokens", side_effect=[rig.BackendError("GPU fixture failure"), None]) as skin_call:
            self.assertEqual(runner.run(args), 2)
            skin_call.side_effect = skin
            self.assertEqual(runner.run(args), 2)  # real Blender was not invoked
            self.assertEqual(runner.run(args), 2)
            self.assertEqual(gen.call_count, 1)
            self.assertEqual(skin_call.call_count, 2)
            out = self.root / "02_3d/colab/mdl-rig"
            (out / "rig/mdl-rig.glb").write_bytes(b"tampered fixture")
            self.assertEqual(runner.run(args), 2)
            self.assertEqual(skin_call.call_count, 2)
            state = agent.load(out / "typed_state.json")
            self.assertEqual(state["status"], "QA_PENDING")
            self.assertTrue(any("Cached rig changed" in w for w in state["warnings"]))


if __name__ == "__main__":
    unittest.main()
