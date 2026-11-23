"""Re-exports baked NPC bases to Unity without re-baking (ADR-0015).

Usage: blender -b Logs/npc/<id>.blend --python tools/acg-character/race_export.py -- --fbx <game>/_UMA/Npc/Bases/<id>.fbx

Pre: the .blend was saved by race.py (base with its shape keys). Post: the FBX, its images and <id>_materials.json
are rewritten by race._export. Side effects: edits the open scene in memory only (never saved).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import race  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument("--fbx", required=True)
race._export(p.parse_args(argv).fbx)
print("RACE_EXPORT_OK", os.path.basename(p.parse_args(argv).fbx))
