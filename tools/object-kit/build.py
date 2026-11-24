"""Builds the everyday-object part kits and delivers them to the game repo (cosmos_chimera ADR-0016).

blender -b --factory-startup --python tools/object-kit/build.py -- [--functions Hoe,Barrel] [--eras Primal,Future]
        [--no-export] [--render <dir>]

Per (function, era) writes Assets/_Project/Art/Objects/<Family>/<Function>/<Function>_<Era>.fbx holding every slot
variant as an object named <slot>_v<k> (k < 6), all in the function frame, and updates
Assets/_Project/Art/Objects/object-kit.json (slots, triangle counts, budget). Fails loudly when any assembled
combination can exceed the budget. --render writes one lineup sheet per function: 8 era columns x 3 combos.
"""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit_forms  # noqa: E402
from kit_lib import ERAS, VARIANTS, Part, finish, morph, rng_for  # noqa: E402

GENERATOR_VERSION = 1
BUDGET = {"carried": 600, "scene": 1500, "machine": 4000}
_FORGE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GAME = os.environ.get("COSMIMERA_GAME") or os.path.join(os.path.dirname(_FORGE), "cosmos_chimera")
OUT = os.path.join(GAME, "Assets", "_Project", "Art", "Objects")


def build_one(name, era):
    """Builds all slot variants of one (function, era) into a fresh collection; returns (collection, tris table)."""
    spec = kit_forms.FUNCTIONS[name]
    coll = bpy.data.collections.new("%s_%s" % (name, era))
    bpy.context.scene.collection.children.link(coll)
    tris = {}
    distinct = {}
    for slot in spec["slots"]:
        tris[slot] = []
        seen = set()
        for k in range(VARIANTS):
            part = Part(era, rng_for(name, era, slot, k), rng_for(name, era, "frame"))
            spec["form"](part, slot)
            morph(part, k)
            if not part.bm.faces:
                raise SystemExit("empty slot %s/%s/%s v%d" % (name, era, slot, k))
            ob, t = finish(part, "%s_v%d" % (slot, k), coll)
            tris[slot].append(t)
            seen.add(tuple(round(c, 4) for v in ob.data.vertices for c in v.co))
        distinct[slot] = len(seen)
    return coll, tris, distinct


def export(coll, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.fbx(filepath=path, collection=coll.name, object_types={"MESH"}, mesh_smooth_type="FACE",
                             use_mesh_modifiers=False, bake_anim=False, add_leaf_bones=False, path_mode="RELATIVE",
                             embed_textures=False, colors_type="LINEAR", apply_unit_scale=True,
                             apply_scale_options="FBX_SCALE_UNITS", axis_forward="-Z", axis_up="Y")


def render_sheet(name, colls, out_dir):
    """8 era columns x 3 variant combos, 3/4 ortho view, preview toon materials."""
    sc = bpy.context.scene
    sheet = bpy.data.collections.new("sheet_" + name)
    sc.collection.children.link(sheet)
    spec = kit_forms.FUNCTIONS[name]
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for coll in colls.values():
        for o in coll.objects:
            for c in o.bound_box:
                lo = Vector(map(min, lo, Vector(c)))
                hi = Vector(map(max, hi, Vector(c)))
    size = hi - lo
    cell = max(size.x, size.y, size.z * 0.6) * 1.5
    rowh = size.z * 1.25 + cell * 0.2
    for ci, era in enumerate(ERAS):
        coll = colls[era]
        for row in range(3):
            pick = rng_for("sheet", name, row)
            for slot in spec["slots"]:
                k = pick.randrange(VARIANTS)
                src = coll.objects["%s:%s_v%d" % (era, slot, k)]
                o = bpy.data.objects.new("%s_%s_%d_%s" % (name, era, row, slot), src.data)
                o.matrix_world = Matrix.Translation((ci * cell, 0, -row * rowh))
                sheet.objects.link(o)
        txt = bpy.data.curves.new("lbl_" + era, "FONT")
        txt.body = era
        txt.size = cell * 0.13
        txt.align_x = "CENTER"
        t = bpy.data.objects.new("lbl_" + era, txt)
        t.location = (ci * cell, 0, hi.z + cell * 0.12)
        t.rotation_euler = (math.radians(90), 0, math.radians(25))
        sheet.objects.link(t)
    for coll in colls.values():
        coll.hide_render = True
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = 2400
    sc.render.resolution_y = 1100
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("kit")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.32, 0.36, 0.4, 1)
    sc.world = w
    if "kit_sun" not in bpy.data.objects:
        sun = bpy.data.objects.new("kit_sun", bpy.data.lights.new("kit_sun", "SUN"))
        sun.data.energy = 3.0
        sun.rotation_euler = (math.radians(45), 0, math.radians(-35))
        sc.collection.objects.link(sun)
    cam = bpy.data.objects.get("kit_cam") or bpy.data.objects.new("kit_cam", bpy.data.cameras.new("kit_cam"))
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    width = 8 * cell
    height = 3 * rowh + cell * 0.3
    cam.data.ortho_scale = max(width * 1.05, height * 1.05 * 2400 / 1100)
    centre = Vector((3.5 * cell, 0, (hi.z + cell * 0.2 - 2 * rowh + lo.z) / 2))
    yaw, pitch = math.radians(-25), math.radians(14)
    d = Vector((math.sin(-yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
    cam.location = centre + d * 50
    cam.rotation_euler = (math.radians(90) - pitch, 0, -yaw)
    sc.camera = cam
    os.makedirs(out_dir, exist_ok=True)
    sc.render.filepath = os.path.join(out_dir, "objects-%s.png" % name)
    bpy.ops.render.render(write_still=True)
    bpy.data.collections.remove(sheet)
    for coll in colls.values():
        coll.hide_render = False
    return sc.render.filepath


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--functions", default=",".join(kit_forms.FUNCTIONS))
    ap.add_argument("--eras", default=",".join(ERAS))
    ap.add_argument("--no-export", action="store_true")
    ap.add_argument("--render")
    a = ap.parse_args(argv)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    manifest_path = os.path.join(OUT, "object-kit.json")
    manifest = {"generator_version": GENERATOR_VERSION, "variants": VARIANTS, "budget": BUDGET, "functions": {}}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8") as f:
            old = json.load(f)
        if old.get("generator_version") == GENERATOR_VERSION:
            manifest["functions"] = old.get("functions", {})
    over = []
    for name in a.functions.split(","):
        spec = kit_forms.FUNCTIONS[name]
        entry = manifest["functions"].setdefault(name, {"family": spec["family"], "size": spec["size"],
                                                         "slots": list(spec["slots"]), "eras": {}})
        colls = {}
        for era in a.eras.split(","):
            coll, tris, distinct = build_one(name, era)
            same = [k for k, n in distinct.items() if n < 2]
            if same:
                print("SAME %s %s %s" % (name, era, same))
            colls[era] = coll
            worst = sum(max(v) for v in tris.values())
            rel = "%s/%s/%s_%s.fbx" % (spec["family"], name, name, era)
            entry["eras"][era] = {"file": rel, "tris": tris, "max_assembled": worst, "distinct": distinct}
            if worst > BUDGET[spec["size"]]:
                over.append("%s/%s: %d > %d %s" % (name, era, worst, BUDGET[spec["size"]], {k: max(v) for k, v in tris.items()}))
            if not a.no_export:
                export(coll, os.path.join(OUT, rel))
            # Object names are global in a .blend: free "<slot>_v<k>" for the next era's export.
            for o in coll.objects:
                o.data.name = "%s:%s" % (era, o.data.name)
                o.name = "%s:%s" % (era, o.name)
            print("KIT %s %s max_assembled=%d" % (name, era, worst))
        if a.render and len(colls) == len(ERAS):
            print("SHEET", render_sheet(name, colls, a.render))
        for coll in colls.values():
            for o in list(coll.objects):
                bpy.data.objects.remove(o)
            bpy.data.collections.remove(coll)
    if not a.no_export:
        os.makedirs(OUT, exist_ok=True)
        with open(manifest_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write("\n")
    if over:
        raise SystemExit("triangle budget exceeded:\n  " + "\n  ".join(over))


if __name__ == "__main__":
    main()
