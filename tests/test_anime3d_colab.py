"""Colab executable cells, real-source binding and resumable execution contracts."""
import ast
from argparse import Namespace
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import anime3d_agent as agent
import anime3d_universal as runner
from anime3d_profiles import classify
from anime3d_preflight import inspect


def container(path):
    # Structural fixture only, never presented as a reconstructed character.
    data = json.dumps({"asset": {"version": "2.0"}, "nodes": [{"mesh": 0}],
                       "meshes": [{"primitives": []}]}).encode()
    data += b" " * (-len(data) % 4)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(struct.pack("<4sII", b"glTF", 2, 20 + len(data)) +
                     struct.pack("<I4s", len(data), b"JSON") + data)


class ColabContracts(unittest.TestCase):
    def test_every_notebook_code_cell_compiles(self):
        notebook = json.loads((ROOT / "notebooks/07_batch_runner.ipynb").read_text(encoding="utf8"))
        cells = ["".join(c["source"]) for c in notebook["cells"] if c["cell_type"] == "code"]
        for index, code in enumerate(cells):
            ast.parse(code, filename=f"colab-cell-{index}")
        invocation = next(c for c in cells if c.startswith("cmd ="))
        calls = Mock()
        env = {"sys": Namespace(executable="python"), "REPO": Path("/runtime"),
               "DRIVE_PROJECT": "/drive", "ASSET_ID": "mdl-test", "SPEC": "/spec.json",
               "EXECUTE": True, "BACKEND": "pixal3d", "RIG_BACKEND": "skintokens", "PIPELINE": "colab",
               "EXECUTE_PAID_API": False, "BACKEND_CONFIG": "/isolated/backends.json",
               "GENERATOR_EXECUTABLE": "", "BLENDER": "/bin/blender", "subprocess": calls}
        exec(invocation, env)
        argv = calls.run.call_args.args[0]
        self.assertEqual(argv[argv.index("--backend-config") + 1], "/isolated/backends.json")
        self.assertNotIn("--allow-paid-tripo", argv)
        self.assertEqual(argv[argv.index("--rig-backend") + 1], "skintokens")
        self.assertTrue(calls.run.call_args.kwargs["check"])

    def test_completed_portrait_explicit_webp_and_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / "03_completed/portraits/source"
            (folder / "images").mkdir(parents=True)
            (folder / "images/z_front.webp").write_bytes(b"source fixture")
            agent.save(folder / "manifest.json", {"subject_id": "chr_test"})
            agent.save(root / "reviews/source.json", {"status": "ok"})
            spec = {"source_pack": "source", "subject_id": "chr_test", "license_status": "internal_only",
                    "source_image": "images/z_front.webp"}
            self.assertEqual(agent.validate(root, spec, "mdl-test").name, "z_front.webp")
            with self.assertRaisesRegex(ValueError, "subject mismatch"):
                agent.validate(root, dict(spec, subject_id="other"), "mdl-test")
            with self.assertRaisesRegex(ValueError, "escapes"):
                agent.validate(root, dict(spec, source_image="../../outside.png"), "mdl-test")

    def test_tripo_supports_each_published_nonhuman_rig(self):
        for anatomy in agent.NONBIPED:
            self.assertEqual(agent.route({"asset_class": "animal", "anatomy": anatomy})["rig_type"], anatomy)

    def test_open_backend_does_not_promise_tripo_animations(self):
        original = classify({"anatomy": "biped", "requested_clips": ["idle", "walk", "jump"]})
        local = runner.execution_profile(original, "pixal3d")
        self.assertEqual(local["tripo_clips"], [])
        self.assertEqual(local["procedural_clips"], ["idle", "walk"])
        self.assertEqual(local["unsupported"], ["jump"])
        self.assertEqual(runner.execution_profile(original, "tripo"), original)

    def test_successful_api_task_needs_no_poll_or_resubmit(self):
        state = {"steps": {"generate": {"task_id": "existing", "status": "success", "data": {"output": {}}}}}
        with patch.object(agent, "api") as api, patch.object(agent, "poll") as poll:
            self.assertEqual(agent.task("secret", state, "generate", "/generation", {}, "unused"), {"output": {}})
            api.assert_not_called()
            poll.assert_not_called()

    def test_ambiguous_billable_submit_cannot_be_retried(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = {"steps": {}}
            receipt = Path(tmp) / "state.json"
            with patch.object(agent, "api", side_effect=TimeoutError("response lost")) as api:
                with self.assertRaises(TimeoutError):
                    agent.task("secret", state, "generate", "/generation", {}, receipt)
                with self.assertRaisesRegex(ValueError, "outcome unknown"):
                    agent.task("secret", state, "generate", "/generation", {}, receipt)
                self.assertEqual(api.call_count, 1)
            self.assertEqual(agent.load(receipt)["steps"]["generate"]["status"], "SUBMISSION_UNKNOWN")

    def test_post_503_is_not_automatically_reissued(self):
        from urllib.error import HTTPError
        error = HTTPError("https://example.invalid", 503, "test", {}, None)
        with patch.object(agent.urllib.request, "urlopen", side_effect=error) as call:
            with self.assertRaisesRegex(RuntimeError, "503"):
                agent.api("not-a-real-key", "POST", "/generation", {})
            self.assertEqual(call.call_count, 1)

    def test_successful_source_resumes_without_gpu_generation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = root / "front.png"
            image.write_bytes(b"test input")
            spec = root / "spec.json"
            agent.save(spec, {"asset_class": "humanoid", "source_pack": "approved", "license_status": "internal_only"})
            config = root / "backends.json"
            config.write_text("{}")
            args = Namespace(root=str(root), asset_id="mdl-resume", spec=str(spec), execute=True,
                             allow_paid_tripo=False, backend="pixal3d", pipeline="colab",
                             generator_executable=None, input_model=None, backend_config=str(config), blender=None)
            def generate(backend, cfg, img, spec, output):
                container(output)
                return {"backend": backend}
            with patch.object(agent, "validate", return_value=image), patch.object(runner, "run_official_backend", side_effect=generate) as gen:
                self.assertEqual(runner.run(args), 2)  # generated, Blender unavailable
                self.assertEqual(runner.run(args), 2)
                self.assertEqual(gen.call_count, 1)
                job = root / "02_3d/colab/mdl-resume"
                self.assertEqual(agent.load(job / "typed_state.json")["status"], "QA_PENDING")
                self.assertTrue((job / "manifest.json").is_file())
                image.write_bytes(b"different input")
                with self.assertRaisesRegex(ValueError, "Input or backend changed"):
                    runner.run(args)
                image.write_bytes(b"test input")
                (job / "source/mdl-resume.glb").write_bytes(b"corrupted cached result")
                with self.assertRaisesRegex(ValueError, "Cached source changed"):
                    runner.run(args)
                self.assertEqual(gen.call_count, 1)

    def test_blender_failure_cannot_reuse_stale_passing_metrics(self):
        import subprocess
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source.glb"
            container(source)
            spec = root / "spec.json"
            agent.save(spec, {"input_mode": "text", "asset_class": "humanoid", "appearance": "Test fixture"})
            out = root / "02_3d/ai_blender/mdl-failed"
            agent.save(out / "qa/typed_metrics.json", {"automated_pass": True})
            binary = root / "blender"
            binary.write_bytes(b"test executable path")
            args = Namespace(root=str(root), asset_id="mdl-failed", spec=str(spec), execute=True,
                             allow_paid_tripo=False, backend="existing", pipeline="ai_blender",
                             generator_executable=None, input_model=str(source), backend_config=None, blender=str(binary))
            with patch.object(runner, "run_checked", return_value=subprocess.CompletedProcess([], 127, "", "launch failed")):
                self.assertEqual(runner.run(args), 2)
            self.assertFalse((out / "qa/typed_metrics.json").exists())
            state = agent.load(out / "typed_state.json")
            self.assertFalse(state["automated_pass"])
            self.assertEqual(state["status"], "QA_PENDING")
            self.assertEqual(agent.load(out / "manifest.json")["qa_status"], "QA_PENDING")

    def test_process_timeout_becomes_a_persistable_failure(self):
        import subprocess
        with patch.object(runner.subprocess, "run", side_effect=subprocess.TimeoutExpired(["adapter"], 1)):
            result = runner.run_checked(["adapter"], 1)
            self.assertEqual(result.returncode, 124)
            self.assertIn("timed out", result.stderr)

    def test_canonical_wiki_keeps_creature_stage_and_character_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wiki = root / "wiki/creatures/cr_test_juvenile_wiki.md"
            wiki.parent.mkdir(parents=True)
            wiki.write_text("Original juvenile entry")
            spec = {"subject_id": "cr_test", "stage": "juvenile", "category": "creature"}
            self.assertEqual(runner.encyclopedia_path(root, spec, classify(spec)), "wiki/creatures/cr_test_juvenile_wiki.md")
            self.assertEqual(runner.encyclopedia_path(root, dict(spec, stage="adult"), classify(spec)), "")

    def test_real_chengxi_spec_preflight_never_fabricates_approval(self):
        spec = json.loads((ROOT / "docs/examples/yeh_chengxi.asset_spec.json").read_text(encoding="utf8"))
        with tempfile.TemporaryDirectory() as tmp, patch("anime3d_preflight.shutil.which", return_value=None):
            report = inspect(tmp, spec, spec["asset_id"])
            self.assertEqual(report["status"], "BLOCKED")
            self.assertIn("source: source portrait not approved", report["blockers"])
            self.assertFalse(report["inference_executed"])
            self.assertFalse((Path(tmp) / "reviews").exists())


if __name__ == "__main__":
    unittest.main()
