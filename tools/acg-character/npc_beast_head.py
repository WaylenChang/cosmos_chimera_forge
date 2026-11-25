"""Builds the beast head slot on one baked race base and exports it for Unity (ADR-0015, cosmos_chimera
docs/design/npc-uma-looks.md#獸頭).

Usage: blender -b Logs/npc/<id>.blend --python tools/acg-character/npc_beast_head.py -- --fbx <game>/_UMA/Npc/Head/<id>.fbx
           [--preview <out.png>]

The head the procedural NPC draws for the birdfolk, werewolves, lizardfolk, dragonkin and merfolk (NpcMeshes.Head:
skull, snout, jaw, nose, ruff) is grown here as one smooth skinned mesh on this base, sized by the base's own head
(crown to chin = 1.98 head radii) and centred on it, from npc/beast_heads.json. In Unity the slot hides the base's human
head, so it carries everything that head carried:
- the base's own eyeballs (sclera and iris with their eye.* keys), moved and turned onto the beast skull;
- a key of the same name as every base key that moves the skin it covers (the skin's inverse-distance mean, faded with
  distance off the skin), so the face and body DNA still reshape it;
- "npc_snout" (shortest to longest snout) and "npc_ruff" (smallest to largest ruff), the per-resident draws as weights;
- a neck stump that runs down inside the body's neck, so the cut where the human head is hidden never shows.
Below the chin it takes the bone weights of the body skin under it (the stump bends with the neck, the ruff with the
shoulders); above, the head bone. Skin, muzzle, jaw, ruff and nose are separate materials, tinted per resident.

Pre: the .blend was saved by race.py (base with its shape keys); its race has an entry in beast_heads.json.
Post: the FBX holds the rig and one mesh "head_<race>"; --preview renders it front and side on the body.
Side effects: edits the open scene in memory only (never saved); overwrites the outputs.
"""
import argparse
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import acg_hair  # noqa: E402
import acg_render  # noqa: E402
import npc_hair  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SNOUT_KEY, RUFF_KEY = "npc_snout", "npc_ruff"
# Blender's metaball surface (threshold 0.6, stiffness 2) lies at this fraction of an element's radius.
ISO = math.sqrt(1.0 - math.sqrt(0.6 / 2.0))
VOXEL_M = 0.004
NEAREST = 6
# A slot vertex this far off the body skin follows it fully, and not at all past FOLLOW_TO: a snout tip should not
# take the human nose's keys at full strength, but the skull over the scalp must take the skull's.
FOLLOW_FROM, FOLLOW_TO = 0.015, 0.05
KEY_FLOOR_M = 1e-4
EYE_PARTS = ("sclera_l", "sclera_r", "iris_l", "iris_r")
# Unity hides every body triangle with a vertex weighted past this to the head bone (NpcUmaRaces.HeadHideWeight).
HIDE_WEIGHT = 0.5
# The eye's white stands this far off the skull, in head radii: clear of the skull's facets (voxel remesh).
EYE_CLEAR = 0.02
# Width of an eye's white, in procedural eye sizes (NpcMeshes eyeSize, head radii): the werewolf base's own width.
EYE_SPAN = 2.7
# The muzzle colour starts this far (head radii) ahead of the snout root, where the procedural tube leaves the skull.
TONE_FROM = 0.15
# The procedural skull's front, head radii ahead of its centre (0.97 x SkullD).
PROCEDURAL_FRONT = 0.97


def _args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--fbx", required=True)
    p.add_argument("--preview")
    return p.parse_args(argv)


class Frame:
    """The base's head as the procedural head measures it: centre, head radius, and the body skin around it."""

    def __init__(self, rig, body):
        helpers = {body.vertex_groups[n].index for n in ("HelperGeometry", "JointCubes") if n in body.vertex_groups}
        self.skin = [v.index for v in body.data.vertices if not any(g.group in helpers and g.weight > 0 for g in v.groups)]
        gi = body.vertex_groups["head"].index
        head = [i for i in self.skin if any(g.group == gi and g.weight > 0.3 for g in body.data.vertices[i].groups)]
        pts = [body.data.vertices[i].co for i in head]
        fit = acg_hair.Head(body)
        front = [p for p in pts if p.y < fit.c.y and abs(p.x) < 0.02]
        self.chin = min(p.z for p in front)
        crown = max(p.z for p in pts)
        self.hr = (crown - self.chin) / 1.98
        self.c = Vector((0.0, fit.c.y, crown - self.hr))
        self.rx, self.ry = fit.r.x, fit.r.y
        self.height = max(v.co.z for v in body.data.vertices)
        bones = rig.data.bones
        self.neck = bones["neck_01"].head_local.copy()
        self.shoulder = abs(bones["upperarm_l"].head_local.x)

    def p(self, x, up, fwd):
        return self.c + Vector((x * self.hr, -fwd * self.hr, up * self.hr))

    def face(self, x, up, fwd):
        """A point the procedural head places off its face: the bases' skulls run deeper than the procedural one (front
        0.97 head radii ahead of the centre), so face features keep their distance from the front, not the centre."""
        return self.p(x, up, fwd + self.ry / self.hr - PROCEDURAL_FRONT)


def _ball(mb, at, radii):
    """A metaball element whose surface (alone) passes through at ± radii."""
    el = mb.elements.new(type="ELLIPSOID")
    el.co = at
    r = max(radii) / ISO
    el.radius = r
    el.size_x, el.size_y, el.size_z = (radii[0] / ISO / r, radii[1] / ISO / r, radii[2] / ISO / r)
    return el


def _tube(mb, a, b, r0, r1, n=10):
    for k in range(n + 1):
        t = k / n
        r = r0 + (r1 - r0) * t
        _ball(mb, a.lerp(b, t), (r, r, r))


def _neck_radius(body, skin, z):
    xs = [abs(body.data.vertices[i].co.x) for i in skin if abs(body.data.vertices[i].co.z - z) < 0.006]
    return max(xs) if xs else 0.05


def _trunk(body, skin, fr):
    band = [body.data.vertices[i].co for i in skin
            if fr.neck.z - 0.09 < body.data.vertices[i].co.z < fr.neck.z - 0.04 and abs(body.data.vertices[i].co.x) < fr.shoulder]
    tx = max(abs(p.x) for p in band)
    mid = [p for p in band if abs(p.x) < 0.04]
    tz = (max(p.y for p in mid) - min(p.y for p in mid)) / 2
    return tx, tz


def _family(name, build):
    """Meshes one metaball family (elements of one name blend into each other, not into other families)."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = mb.render_resolution = VOXEL_M
    mb.threshold = 0.6
    build(mb)
    ob = bpy.data.objects.new(name, mb)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.metaballs.remove(mb)
    out = bpy.data.objects.new(name + "_mesh", me)
    bpy.context.scene.collection.objects.link(out)
    return out


def _snout_ends(fr, s, length):
    a = fr.face(*s["from"])
    b = fr.face(s["from"][0], s["from"][1] - s["drop"] * length, s["from"][2] + length)
    return a, b


def _skull(body, fr):
    neck_r = _neck_radius(body, fr.skin, (fr.chin + fr.neck.z) / 2)

    def build(mb):
        _ball(mb, fr.c, (fr.rx, fr.ry, fr.hr))
        # Cheeks and jaw: the procedural head narrows below the eyes (HeadShape); a beast keeps the jaw under its snout.
        _ball(mb, fr.p(0, -0.45, 0.1), (0.78 * fr.rx, 0.78 * fr.ry, 0.55 * fr.hr))
        # The stump runs from inside the skull down inside the body's neck, so the hidden human head leaves no hole.
        _tube(mb, fr.p(0, -0.5, -0.1), Vector((0.0, fr.neck.y, fr.neck.z + 0.01)), 0.9 * neck_r, 0.85 * neck_r, 6)

    return _family("beast_skull", build)


def _snout(fr, s, length):
    """The snout apart from the skull, as the procedural tube (NpcMeshes Tube): a frustum from the root inside the skull to
    the tip, closed by a low dome. Blended metaballs swelled the root over the eyes."""
    a, b = _snout_ends(fr, s, length)
    axis = (b - a).normalized()
    t1, t2 = _frame(axis)
    r0, r1 = s["r0"] * fr.hr, s["r1"] * fr.hr
    bm = bmesh.new()
    rings, sides = 16, 32
    loops = []
    ring = [(a.lerp(b, i / rings), r0 + (r1 - r0) * i / rings) for i in range(rings + 1)]
    # The dome rises 0.4 of the tip radius: blunt like the procedural tube's end, without its hard rim.
    ring += [(b + axis * (0.4 * r1 * math.sin(math.pi / 2 * i / 6)), r1 * math.cos(math.pi / 2 * i / 6)) for i in range(1, 6)]
    for c, r in ring:
        loops.append([bm.verts.new(c + (t1 * math.cos(2 * math.pi * j / sides) + t2 * math.sin(2 * math.pi * j / sides)) * r)
                      for j in range(sides)])
    rings = len(ring) - 1
    for i in range(rings):
        for j in range(sides):
            bm.faces.new((loops[i][j], loops[i][(j + 1) % sides], loops[i + 1][(j + 1) % sides], loops[i + 1][j]))
    bm.faces.new(list(reversed(loops[0])))
    bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("beast_snout")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("beast_snout_mesh", me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _jaw(fr, j):
    return _family("beast_jaw", lambda mb: _ball(mb, fr.face(*j["at"]) + Vector((0, -0.6 * fr.hr, -0.2 * fr.hr)),
                                                  tuple(r * fr.hr for r in j["r"])))


def _ruff(body, fr, size):
    tx, tz = _trunk(body, fr.skin, fr)
    at = fr.neck + Vector((0.0, 0.01 * fr.height, -0.01 * fr.height))
    return _family("beast_ruff", lambda mb: _ball(mb, at, (tx * 1.02 * size, tz * 1.5, 0.07 * fr.height * size))), at


def _remesh(ob, faces):
    m = ob.modifiers.new("remesh", "REMESH")
    m.mode = "VOXEL"
    m.voxel_size = VOXEL_M
    d = ob.modifiers.new("decimate", "DECIMATE")
    d.ratio = min(1.0, faces / max(1, len(ob.data.polygons)))
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    old = ob.data
    ob.data = me
    bpy.data.meshes.remove(old)


def _stretch(basis, key, fr, s, lo, hi):
    """Key positions of the snout at length hi from the basis drawn at lo: everything ahead of the root is stretched
    along the snout's own axis, so the topology is the basis's."""
    a, b0 = _snout_ends(fr, s, lo)
    _, b1 = _snout_ends(fr, s, hi)
    axis = (b0 - a).normalized()
    span = (b0 - a).length
    for i, co in enumerate(basis):
        t = (co - a).dot(axis)
        if t <= 0:
            key[i] = co.copy()
            continue
        # Smoothly from nothing at the root: the brow over the root stays where it is.
        w = min(1.0, t / (0.25 * span))
        w = w * w * (3 - 2 * w)
        key[i] = co + (b1 - b0) * (t / span) * w


def _scale_about(basis, key, centre, k):
    for i, co in enumerate(basis):
        key[i] = centre + (co - centre) * k


def _frame(n):
    t1 = n.cross(Vector((0, 0, 1)))
    if t1.length < 1e-6:
        t1 = n.cross(Vector((1, 0, 0)))
    t1.normalize()
    return t1, n.cross(t1).normalized()


def _quadric(pts):
    """Least-squares h = a u² + b v² + c uv + d u + e v + f through (u, v, h)."""
    import numpy as np
    A = np.array([[u * u, v * v, u * v, u, v, 1.0] for u, v, _ in pts])
    h = np.array([h for _, _, h in pts])
    coef = np.linalg.lstsq(A, h, rcond=None)[0]
    return lambda u, v: float(coef @ np.array([u * u, v * v, u * v, u, v, 1.0]))


def _eyes(body, fr, spec, skull):
    """Copies the base's eyes onto the skull. The whites and irises are shells curved to the base's face: moved whole, the
    skull's other curve buried their edges. So each eye is flattened against a smooth fit of its own white (the iris
    keeps its height over the white), scaled and turned to the beast's eye place, and laid onto the skull."""
    e = spec["eye"]
    bvh = BVHTree.FromObject(skull, bpy.context.evaluated_depsgraph_get())
    out = []
    for side_name in ("l", "r"):
        side = 1 if side_name == "l" else -1
        sclera = bpy.data.objects["sclera_" + side_name]
        centre = sum((v.co for v in sclera.data.vertices), Vector()) / len(sclera.data.vertices)
        n0 = sum((p.normal for p in sclera.data.polygons), Vector()).normalized()
        t1, t2 = _frame(n0)

        def local(co):
            d = co - centre
            return d.dot(t1), d.dot(t2), d.dot(n0)

        fit = _quadric([local(v.co) for v in sclera.data.vertices])
        us = [local(v.co)[0] for v in sclera.data.vertices]
        # Sized to the head, not to the base's eye: some bases draw eyes half again as wide, and scaled by the
        # procedural size ratio alone they ran off the skull's front and smeared down its sides.
        k = EYE_SPAN * e["size"] * fr.hr / (max(us) - min(us))
        # Blender +x is the base's own left (MakeHuman), the _l eye; the procedural eye at +eyeX is on the same side.
        origin = fr.p(side * e["x"], e["up"], 3.0)
        hit, _, _, _ = bvh.ray_cast(origin, Vector((0, 1, 0)))
        if hit is None:
            raise SystemExit("beast head: no skull in front of the %s eye" % side_name)
        # Facing from the skull's fitted ellipsoid: the decimated mesh's face normal at the hit pointed down a crease on
        # one base and turned its eyes sideways.
        q = hit - fr.c
        n = Vector((q.x / fr.rx ** 2, q.y / fr.ry ** 2, q.z / fr.hr ** 2)).normalized()
        turn = n0.rotation_difference(n).to_matrix()
        s1, s2 = turn @ t1, turn @ t2
        for part in ("sclera_", "iris_"):
            src = bpy.data.objects[part + side_name]
            ob = src.copy()
            ob.data = src.data.copy()
            bpy.context.scene.collection.objects.link(ob)
            keys = ob.data.shape_keys.key_blocks
            rest = [v.co.copy() for v in keys[0].data]
            laid = []
            for co in rest:
                u, v, h = local(co)
                at = hit + s1 * (u * k) + s2 * (v * k)
                q, _, _, _ = bvh.ray_cast(at + n * fr.hr, -n)
                if q is None:
                    q = at
                laid.append(q + n * ((h - fit(u, v)) * k + EYE_CLEAR * fr.hr))
            for kb in keys:
                for i, d in enumerate(kb.data):
                    d.co = laid[i] + turn @ ((d.co - rest[i]) * k)
            for i, vtx in enumerate(ob.data.vertices):
                vtx.co = laid[i]
            out.append(ob)
    return out


def _follow(ob, body, skin, body_keys, extra):
    """Keys of the same name as every body key that moves the skin under ob, faded off the skin."""
    basis = body.data.shape_keys.key_blocks[0]
    pts = [basis.data[i].co for i in skin]
    tree = KDTree(len(pts))
    for j, p in enumerate(pts):
        tree.insert(p, j)
    tree.balance()
    near = []
    for v in ob.data.vertices:
        found = tree.find_n(v.co, NEAREST)
        d0 = found[0][2]
        fade = max(0.0, min(1.0, 1.0 - (d0 - FOLLOW_FROM) / (FOLLOW_TO - FOLLOW_FROM)))
        w = [1.0 / max(dist, 1e-4) ** 2 for _, _, dist in found]
        s = sum(w)
        near.append([(skin[j], wi / s * fade) for (_, j, _), wi in zip(found, w)])
    co = [v.co.copy() for v in ob.data.vertices]
    if ob.data.shape_keys is None:
        ob.shape_key_add(name="Basis", from_mix=False)
    kept = 0
    for kb in body_keys:
        moved = [sum(((kb.data[i].co - basis.data[i].co) * w for i, w in nb), Vector()) for nb in near]
        if max(m.length for m in moved) < KEY_FLOOR_M:
            continue
        sk = ob.shape_key_add(name=kb.name, from_mix=False)
        for i, m in enumerate(moved):
            sk.data[i].co = co[i] + m
        kept += 1
    for name, positions in extra.items():
        sk = ob.shape_key_add(name=name, from_mix=False)
        for i, p in enumerate(positions):
            sk.data[i].co = p
    return kept


def _weights(ob, rig, body, skin, fr):
    """Head bone above the chin; below it, the bone weights of the body skin nearest, blended over 2 cm."""
    bones = set(rig.data.bones.keys())
    tree = KDTree(len(skin))
    for j, i in enumerate(skin):
        tree.insert(body.data.vertices[i].co, j)
    tree.balance()
    names = {g.index: g.name for g in body.vertex_groups if g.name in bones}
    groups = {}

    def group(n):
        if n not in groups:
            groups[n] = ob.vertex_groups.get(n) or ob.vertex_groups.new(name=n)
        return groups[n]

    for v in ob.data.vertices:
        t = max(0.0, min(1.0, (fr.chin - v.co.z) / 0.02))
        if t < 1.0:
            group("head").add([v.index], 1.0 - t, "ADD")
        if t > 0.0:
            _, j, _ = tree.find(v.co)
            src = body.data.vertices[skin[j]]
            for g in src.groups:
                if g.group in names and g.weight > 0:
                    group(names[g.group]).add([v.index], g.weight * t, "ADD")
    acg_render._limit_weights(ob, bones, 4)


def _material(name):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    return mat


def _assign(ob, name):
    ob.data.materials.clear()
    ob.data.materials.append(_material(name))
    for poly in ob.data.polygons:
        poly.use_smooth = True


def _uv(ob):
    """One unwrap for all the skin-side parts, so their islands never overlap (the beast mark maps are baked on it).
    The layer is named before the unwrap: Blender names a new layer in the UI language, and the eyes' "UVMap" then
    landed on a second layer, leaving the irises at UV (0, 0)."""
    for layer in list(ob.data.uv_layers):
        ob.data.uv_layers.remove(layer)
    ob.data.uv_layers.new(name="UVMap")
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
    bpy.ops.object.mode_set(mode="OBJECT")


def _join(obs, name):
    if len(obs) == 1:
        obs[0].name = obs[0].data.name = name
        return obs[0]
    bpy.context.view_layer.objects.active = obs[0]
    for o in bpy.context.view_layer.objects:
        o.select_set(o in obs)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    return ob


def _tone(ob, fr, s, lo, rid):
    """The muzzle ahead of the snout root takes its own material, cut along a plane: voxel faces picked one by one left a
    stair-stepped colour edge."""
    a, b = _snout_ends(fr, s, lo)
    axis = (b - a).normalized()
    at = a + axis * TONE_FROM * fr.hr
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=at, plane_no=axis)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.materials.append(_material(s["tone"] + "_" + rid))
    for poly in ob.data.polygons:
        if (poly.center - at).dot(axis) > 0:
            poly.material_index = 1


def build(rig, body, race, spec, rid):
    fr = Frame(rig, body)
    s = spec.get("snout")
    lo, hi = (s["min"], s["max"]) if s else (0.0, 0.0)
    skull = _skull(body, fr)
    _remesh(skull, 5000)
    _assign(skull, "skin_" + rid)
    parts = [skull]
    keys = body.data.shape_keys.key_blocks[1:]
    kept = _follow(skull, body, fr.skin, keys, {})
    if s:
        snout = _snout(fr, s, lo)
        _remesh(snout, 2500)
        _assign(snout, "skin_" + rid)
        if s.get("tone"):
            _tone(snout, fr, s, lo, rid)
        co = [v.co.copy() for v in snout.data.vertices]
        stretched = [None] * len(co)
        _stretch(co, stretched, fr, s, lo, hi)
        _follow(snout, body, fr.skin, keys, {SNOUT_KEY: stretched})
        parts.append(snout)
    j = spec.get("jaw")
    if j:
        jaw = _jaw(fr, j)
        _remesh(jaw, 1200)
        _assign(jaw, "jaw_" + rid)
        jco = [v.co.copy() for v in jaw.data.vertices]
        jx = {}
        if s:
            # The jaw rides under the snout: it moves forward by the snout's growth at its own depth.
            stretched = [None] * len(jco)
            _stretch(jco, stretched, fr, s, lo, hi)
            jx[SNOUT_KEY] = stretched
        _follow(jaw, body, fr.skin, keys, jx)
        parts.append(jaw)
    n = spec.get("nose")
    if n and s:
        a, b = _snout_ends(fr, s, lo)
        _, b1 = _snout_ends(fr, s, hi)
        at = b + Vector((0, -n["ahead"] * fr.hr, n["up"] * fr.hr))
        nose = _family("beast_nose", lambda mb: _ball(mb, at, (n["r"] * fr.hr,) * 3))
        _remesh(nose, 300)
        _assign(nose, "muzzletip_" + rid)
        nco = [v.co.copy() for v in nose.data.vertices]
        _follow(nose, body, fr.skin, keys, {SNOUT_KEY: [p + (b1 - b) for p in nco]})
        parts.append(nose)
    r = spec.get("ruff")
    if r:
        ruff, centre = _ruff(body, fr, r["min"])
        _remesh(ruff, 2500)
        _assign(ruff, "ruff_" + rid)
        rco = [v.co.copy() for v in ruff.data.vertices]
        grown = [None] * len(rco)
        # The procedural ruff grows in width and height, not depth.
        for i, p in enumerate(rco):
            d = p - centre
            k = r["max"] / r["min"]
            grown[i] = centre + Vector((d.x * k, d.y, d.z * k))
        _follow(ruff, body, fr.skin, keys, {RUFF_KEY: grown})
        parts.append(ruff)
    eyes = _eyes(body, fr, spec, skull)
    for eye in eyes:
        # The eyes keep their own eye.* keys; every other key moves them as it moves the skull around them. With the
        # human eyes' deltas the skull's cheek and brow outran them and buried the lower lid.
        for kb in list(eye.data.shape_keys.key_blocks[1:]):
            if not kb.name.startswith("eye."):
                eye.shape_key_remove(kb)
        _follow(eye, body, fr.skin, keys, {})
    ob = _join(parts, "head_" + race)
    _uv(ob)
    ob = _join([ob] + eyes, "head_" + race)
    ob.parent = rig
    _weights(ob, rig, body, fr.skin, fr)
    ob.modifiers.new("Armature", "ARMATURE").object = rig
    for kb in ob.data.shape_keys.key_blocks:
        kb.value = 0.0
    return ob, fr, kept


def _preview(body, ob, fr, path):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.render.resolution_x, sc.render.resolution_y = 512, 512
    for name, col in (("skin", (0.55, 0.5, 0.45, 1)), ("muzzle", (0.75, 0.7, 0.65, 1)), ("jaw", (0.7, 0.75, 0.5, 1)),
                      ("ruff", (0.7, 0.65, 0.6, 1)), ("muzzletip", (0.1, 0.08, 0.08, 1)), ("sclera", (0.95, 0.95, 0.9, 1)),
                      ("eye", (0.8, 0.7, 0.1, 1))):
        for m in ob.data.materials:
            if m.name.startswith(name + "_"):
                m.diffuse_color = col
    # The base's own head is what the slot hides in Unity: hide its head faces here too.
    gi = body.vertex_groups["head"].index
    bm = bmesh.new()
    bm.from_mesh(body.data)
    dl = bm.verts.layers.deform.active
    kill = [f for f in bm.faces if any(v[dl].get(gi, 0.0) > HIDE_WEIGHT for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    shown = bpy.data.meshes.new("body_cut")
    bm.to_mesh(shown)
    cut = bpy.data.objects.new("body_cut", shown)
    sc.collection.objects.link(cut)
    cut.matrix_world = body.matrix_world
    cut.color = (0.6, 0.45, 0.4, 1)
    for o in bpy.data.objects:
        if o.type == "MESH" and o not in (ob, cut):
            o.hide_render = True
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = fr.hr * 4.5
    target = fr.c + Vector((0, -0.3 * fr.hr, -0.4 * fr.hr))
    base = os.path.splitext(path)[0]
    for yaw in (0, 60, 90):
        a = math.radians(yaw)
        d = Vector((-math.sin(a), -math.cos(a), 0))
        cam.location = target + d * 3
        cam.rotation_euler = (math.radians(90), 0, math.atan2(d.x, -d.y))
        sc.render.filepath = "%s_%d.png" % (base, yaw)
        bpy.ops.render.render(write_still=True)


def main():
    a = _args()
    with open(os.path.join(HERE, "npc", "beast_heads.json"), encoding="utf-8") as f:
        table = json.load(f)
    rig, body = npc_hair._body()
    rid = body.name
    race = rid.split("_")[1]
    spec = table["races"][race]
    ob, fr, kept = build(rig, body, race, spec, rid)
    if a.preview:
        _preview(body, ob, fr, a.preview)
    npc_hair._export(rig, [ob], a.fbx)
    print("NPC_BEAST_HEAD_OK", os.path.basename(a.fbx), "hr=%.3f" % fr.hr, "keys=%d" % len(ob.data.shape_keys.key_blocks),
          "follow=%d" % kept, "verts=%d" % len(ob.data.vertices), "mats=%s" % ",".join(m.name for m in ob.data.materials))


if __name__ == "__main__":
    main()
