import importlib.util
from pathlib import Path
import tempfile
import unittest

path=Path(__file__).resolve().parents[1]/"scripts"/"anime3d_agent.py"
spec=importlib.util.spec_from_file_location("anime3d_agent",path)
agent=importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)

class Anime3DTests(unittest.TestCase):
    def test_route(self):
        self.assertEqual(agent.route({"asset_class":"humanoid","anatomy":"biped","requested_clips":["idle","walk","run"]})["clips"],["idle","walk","run"])
        self.assertEqual(agent.route({"asset_class":"animal","anatomy":"quadruped","requested_clips":["walk","fly"]})["unsupported"],["fly"])
        self.assertEqual(agent.route({"asset_class":"mechanical"})["mode"],"manual_parts")
        self.assertEqual(agent.route({"asset_class":"fantasy_creature","anatomy":"quadruped_with_wings"})["rig_type"],"others")

    def test_approval_gate(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            (root/"01_portraits"/"approved"/"images").mkdir(parents=True)
            (root/"01_portraits"/"approved"/"images"/"front.png").write_bytes(b"fixture")
            spec={"source_pack":"approved","license_status":"verified"}
            with self.assertRaises(ValueError):agent.validate(root,spec,"mdl-123")
            agent.save(root/"reviews"/"approved.json",{"status":"pending"})
            with self.assertRaises(ValueError):agent.validate(root,spec,"mdl-123")
            agent.save(root/"reviews"/"approved.json",{"status":"ok"})
            self.assertEqual(agent.validate(root,spec,"mdl-123").name,"front.png")
            with self.assertRaises(ValueError):agent.validate(root,spec,"../mdl")

    def test_plan_no_api(self):
        from argparse import Namespace
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            (root/"01_portraits"/"approved"/"images").mkdir(parents=True)
            (root/"01_portraits"/"approved"/"images"/"front.png").write_bytes(b"fixture")
            agent.save(root/"reviews"/"approved.json",{"status":"ok"})
            asset=root/"asset_spec.json"
            agent.save(asset,{"source_pack":"approved","license_status":"internal_only","asset_class":"humanoid","anatomy":"biped"})
            rc=agent.run(Namespace(root=str(root),asset_id="mdl-123",spec=str(asset),execute=False,blender=None))
            self.assertEqual(rc,0)
            self.assertEqual(agent.load(root/"02_3d"/"colab"/"mdl-123"/"agent_state.json")["steps"],{})

if __name__=="__main__":unittest.main()
