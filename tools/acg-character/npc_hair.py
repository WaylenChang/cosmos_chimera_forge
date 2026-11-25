"""Builds the NPC hair slots on one baked race base and exports them for Unity (ADR-0015, cosmos_chimera
docs/design/npc-uma-looks.md row 10).

Usage: blender -b Logs/npc/<id>.blend --python tools/acg-character/npc_hair.py -- --fbx <game>/_UMA/Npc/Hair/<id>.fbx
           [--preview <out.png>]

Every style of npc/hair_styles.json is grown by acg_hair on this base's own head (its fitted cranium, sizes scaled by
its head height against the human male's), so one slot set per base sits on that race's skull without a runtime fit.
The resident's skull still varies: each hair mesh carries a shape key of the same name as every base key that moves
the head, so the race DNA that drives "face.skullWidth+" on the body drives it on the hair too. A hair vertex moves
as the head skin beneath it does (inverse-distance mean of its nearest head vertices). A further key, "npc_hat", presses
the hair over the hat line onto the scalp for residents who wear a hat. Hair is weighted to the head bone, except the
groups that swing (hair_styles.json "swing"), which hang from their own bone chains (acg_swing.hair). Strand u (root 0, tip 1) rides in UV0.x; colour is a shader parameter in Unity, so the material here is a
placeholder.

Pre: the .blend was saved by race.py (base with its shape keys). Post: the FBX holds the rig and one mesh per style,
"hair_<style>"; --preview renders all styles on the head. Side effects: edits the open scene in memory only (never
saved); overwrites the outputs.
"""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import acg_hair  # noqa: E402
import acg_render  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
# Head-skin vertices a hair vertex follows, and the smallest move a key must make on the head to be carried.
NEAREST = 6
KEY_FLOOR_M = 1e-4
SKIN_MARGIN_M = 0.003
GREY = {"hair_root": "#9c9c9c", "hair": "#d6d6d6", "hair_tip": "#ffffff"}
# Shape key that presses the hair under a hat onto the scalp (cosmos_chimera npc-uma-looks.md#髮型): full above HAT_FULL
# and none below HAT_FROM, in heights over the eye line as fractions of the crown's (acg_hair.Head); the lowest procedural
# hat band sits just over the brows, so hair from there up is pressed. Pressed hair ends HAT_GAP_M off the skin, inside
# it: a hat fitted over the bare head lies closer to the skin than a strand's thickness in places, and hair left on top
# showed through it in specks; under the skin, the skin hides it.
HAT_KEY = "npc_hat"
HAT_FROM, HAT_FULL = 0.05, 0.2
HAT_GAP_M = -0.003


def _args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--fbx", required=True)
    p.add_argument("--preview")
    return p.parse_args(argv)


def _body():
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in rig.children if o.type == "MESH" and "acg_head" in o.vertex_groups)
    return rig, body


def _head_follow(body):
    """Basis positions and per-key deltas of the head skin, for keys that move it."""
    gi = body.vertex_groups["head"].index
    # MakeHuman helpers (the hair helper shell ~15 mm off the scalp, eyes, teeth, joint cubes) ride the head bone too but
    # are masked out of the exported skin; hair fitted to them floated, and hair pressed onto them stood out of a hat.
    helpers = {body.vertex_groups[n].index for n in ("HelperGeometry", "JointCubes") if n in body.vertex_groups}
    idx = [v.index for v in body.data.vertices if any(g.group == gi and g.weight > 0.3 for g in v.groups)
           and not any(g.group in helpers and g.weight > 0 for g in v.groups)]
    keys = body.data.shape_keys.key_blocks
    basis = keys[0]
    pts = [basis.data[i].co.copy() for i in idx]
    normals = [body.data.vertices[i].normal.copy() for i in idx]
    moving = {}
    for k in keys[1:]:
        d = [k.data[i].co - basis.data[i].co for i in idx]
        if max(x.length for x in d) >= KEY_FLOOR_M:
            moving[k.name] = d
    return pts, normals, moving


def _tree(pts):
    tree = KDTree(len(pts))
    for i, p in enumerate(pts):
        tree.insert(p, i)
    tree.balance()
    return tree


def _clear_skin(ob, tree, pts, normals):
    """The cap follows a fitted ellipsoid, and a skull bulges past it in places (brow, occiput): lift any hair
    vertex that sits under the skin there out past it, or the scalp shows through in patches."""
    moved = 0
    for v in ob.data.vertices:
        _, i, _ = tree.find(v.co)
        depth = (v.co - pts[i]).dot(normals[i])
        if depth < SKIN_MARGIN_M:
            v.co = v.co + normals[i] * (SKIN_MARGIN_M - depth)
            moved += 1
    return moved


def _bake_keys(ob, tree, moving):
    near = []
    for v in ob.data.vertices:
        found = tree.find_n(v.co, NEAREST)
        w = [1.0 / max(dist, 1e-4) ** 2 for _, _, dist in found]
        s = sum(w)
        near.append([(i, wi / s) for (_, i, _), wi in zip(found, w)])
    ob.shape_key_add(name="Basis", from_mix=False)
    for name, d in moving.items():
        sk = ob.shape_key_add(name=name, from_mix=False)
        for v, nb in zip(ob.data.vertices, near):
            sk.data[v.index].co = v.co + sum((d[i] * w for i, w in nb), Vector())
        sk.value = 0.0


def _hat_key(ob, head, tree, pts, normals):
    """Adds HAT_KEY: every hair vertex over the hat line moves onto the scalp toward the head centre. Returns how many move."""
    basis = ob.data.shape_keys.key_blocks[0]
    sk = ob.shape_key_add(name=HAT_KEY, from_mix=False)
    moved = 0
    for i, d in enumerate(basis.data):
        z = (d.co.z - head.c.z) / head.r.z
        t = max(0.0, min(1.0, (z - HAT_FROM) / (HAT_FULL - HAT_FROM)))
        w = t * t * (3 - 2 * t)
        q = d.co - head.c
        e = math.sqrt((q.x / head.r.x) ** 2 + (q.y / head.r.y) ** 2 + (q.z / head.r.z) ** 2)
        if w <= 0 or e <= 1.0:
            sk.data[i].co = d.co
            continue
        # Pressed toward the head centre onto the fitted cranium: the nearest skin vertex's normal points sideways under
        # a crest or a bun and would leave it standing. Then onto the skin itself, which lies off the fit by millimetres
        # both ways (the brow and occiput bulge past it, the temples fall inside), enough to show through a close hat.
        target = head.c + q / e
        _, j, _ = tree.find(target)
        depth = (target - pts[j]).dot(normals[j])
        target = target + normals[j] * (HAT_GAP_M - depth)
        sk.data[i].co = d.co.lerp(target, w)
        moved += 1
    sk.value = 0.0
    return moved


def _grow(body, rig, styles, cap):
    head = acg_hair.Head(body)
    scale = head.r.z / styles["ref_head_z"]
    out = []
    for name, style in sorted(styles["styles"].items()):
        hs = dict(style, scale=scale * style.get("scale", 1.0), cap=cap)
        obs = acg_hair.build(body, rig, {"id": name, "look": dict(GREY), "hair": hs})
        ob = obs[0]
        for extra in obs[1:]:
            bpy.data.objects.remove(extra, do_unlink=True)
        ob.name = ob.data.name = "hair_" + name
        # One placeholder material: Unity draws every hair slot with the same toon material and tints it per resident.
        mat = ob.data.materials[0]
        mat.name = "npc_hair"
        ob.data.materials.clear()
        ob.data.materials.append(mat)
        ob.data.polygons.foreach_set("material_index", [0] * len(ob.data.polygons))
        out.append(ob)
    return out, scale


def _export(rig, hair, path):
    coll = bpy.data.collections.new("hair_export")
    coll.objects.link(rig)
    for ob in hair:
        coll.objects.link(ob)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    # Same axes and units as race._export, so the slots land on the race's bones.
    bpy.ops.export_scene.fbx(filepath=os.path.abspath(path), collection=coll.name, object_types={"ARMATURE", "MESH"},
                             mesh_smooth_type="FACE", use_mesh_modifiers=False, bake_anim=False, add_leaf_bones=False,
                             path_mode="RELATIVE", embed_textures=False,
                             apply_unit_scale=True, apply_scale_options="FBX_SCALE_UNITS", axis_forward="-Z", axis_up="Y")
    bpy.data.collections.remove(coll)


def _preview(body, hair, path):
    """Workbench contact sheet: every style on the head, front and side."""
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "OBJECT"
    sc.render.resolution_x, sc.render.resolution_y = 512, 512
    sc.render.film_transparent = False
    head = acg_hair.Head(body)
    target = body.matrix_world @ head.c
    cam = bpy.data.objects.new("hair_cam", bpy.data.cameras.new("hair_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = head.r.z * 3.6
    body.color = (0.85, 0.7, 0.6, 1)
    for o in bpy.data.objects:
        if o.type == "MESH" and o not in hair and o != body:
            o.hide_render = True
    shots = []
    base = os.path.splitext(path)[0]
    for ob in hair:
        ob.color = (0.35, 0.25, 0.2, 1)
        for o in hair:
            o.hide_render = o != ob
        for yaw in (0, 90, 180):
            a = math.radians(yaw)
            d = Vector((-math.sin(a), -math.cos(a), 0))
            cam.location = target + d * 3 + Vector((0, 0, -head.r.z * 0.4))
            cam.rotation_euler = (math.radians(90), 0, math.atan2(d.x, -d.y))
            f = "%s_%s_%d.png" % (base, ob.name, yaw)
            sc.render.filepath = f
            bpy.ops.render.render(write_still=True)
            shots.append(f)
    return shots


def main():
    a = _args()
    with open(os.path.join(HERE, "npc", "hair_styles.json"), encoding="utf-8") as f:
        styles = json.load(f)
    rig, body = _body()
    pts, normals, moving = _head_follow(body)
    tree = _tree(pts)
    hair, scale = _grow(body, rig, styles, tuple(styles["cap"]))
    cleared = {}
    pressed = {}
    head = acg_hair.Head(body)
    for ob in hair:
        cleared[ob.name] = _clear_skin(ob, tree, pts, normals)
        _bake_keys(ob, tree, moving)
        pressed[ob.name] = _hat_key(ob, head, tree, pts, normals)
        acg_render._limit_weights(ob, set(rig.data.bones.keys()), 4)
    if a.preview:
        _preview(body, hair, a.preview)
    _export(rig, hair, a.fbx)
    print("NPC_HAIR_OK", os.path.basename(a.fbx), "scale=%.3f" % scale, "keys=%d" % len(moving),
          " ".join("%s:%d/%d/%d" % (o.name, len(o.data.vertices), cleared[o.name], pressed[o.name]) for o in hair))


if __name__ == "__main__":
    main()
