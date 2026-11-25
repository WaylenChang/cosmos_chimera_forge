"""Builds the NPC beard slots on one baked male race base and exports them for Unity (ADR-0015, cosmos_chimera
docs/design/npc-uma-looks.md row 11).

Usage: blender -b Logs/npc/<id>.blend --python tools/acg-character/npc_beard.py -- --fbx <game>/_UMA/Npc/Beard/<id>.fbx
           [--preview <out.png>]

Every style of npc/beard_styles.json is grown from this base's own skin: clumps root on the jaw below the lips, the
chin, the upper lip and the cheeks in front of the ears (found from the eyes, the teeth and the skin's facing), fall
under a gravity bias and are kept off the skin, so each base's beard sits on its own jaw without a runtime fit. Sizes are
in head radii of that base. Like the hair (npc_hair.py), each mesh carries a shape key of the same name as every base
key that moves the head, plus "npc_beard_length": the basis is drawn at the shortest beard and the key at the longest,
from the same random draws, so a resident's continuous length is one key weight. Weighted to the head bone. Strand u
rides in UV0.x and the material is the hair's placeholder ("npc_hair"): Unity draws and tints beards as hair.

Pre: the .blend was saved by race.py (male base with its shape keys). Post: the FBX holds the rig and one mesh per
style, "beard_<style>"; --preview renders every style front and side. Side effects: edits the open scene in memory
only (never saved); overwrites the outputs.
"""
import argparse
import json
import math
import os
import random
import sys

import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import acg_hair  # noqa: E402
import acg_render  # noqa: E402
import npc_hair  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
LENGTH_KEY = "npc_beard_length"
# Clumps stay this far off any skin (jaw, neck, chest) while they fall.
SKIN_MARGIN_M = 0.002
STEPS = 10
GREY = ("#9c9c9c", "#d6d6d6", "#ffffff")


def _args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--fbx", required=True)
    p.add_argument("--preview")
    return p.parse_args(argv)


class Face:
    """The skin a beard grows from and falls past, with the landmarks its regions are cut by."""

    def __init__(self, body):
        helpers = {body.vertex_groups[n].index for n in ("HelperGeometry", "JointCubes") if n in body.vertex_groups}
        skin = [v for v in body.data.vertices if not any(g.group in helpers and g.weight > 0 for g in v.groups)]
        self.index = {v.index: i for i, v in enumerate(skin)}
        self.polys = [[self.index[k] for k in p.vertices] for p in body.data.polygons if all(k in self.index for k in p.vertices)]
        self.pts = [v.co.copy() for v in skin]
        self.normals = [v.normal.copy() for v in skin]
        self.tree = KDTree(len(self.pts))
        for i, p in enumerate(self.pts):
            self.tree.insert(p, i)
        self.tree.balance()
        head = acg_hair.Head(body)
        self.c = head.c
        self.eye_z = head.eye_z
        teeth = [body.vertex_groups[n].index for n in ("helper-upper-teeth", "helper-lower-teeth")]
        tz = [v.co.z for v in body.data.vertices if any(g.group in teeth for g in v.groups)]
        self.mouth_z = sum(tz) / len(tz)
        gi = body.vertex_groups["head"].index
        self.head = [i for i, v in enumerate(skin) if any(g.group == gi and g.weight > 0.3 for g in v.groups)]
        front = [self.pts[i] for i in self.head if self.pts[i].y < self.c.y and abs(self.pts[i].x) < 0.02]
        self.chin_z = min(p.z for p in front)
        crown = max(self.pts[i].z for i in self.head)
        # Head radius as the procedural head counts it (crown to chin = 1.98 radii).
        self.hr = (crown - self.chin_z) / 1.98

    def az(self, p):
        return math.degrees(math.atan2(p.x, -(p.y - self.c.y)))

    def region(self, g):
        hr, out = self.hr, []
        for i in self.head:
            p, n = self.pts[i], self.normals[i]
            a = abs(self.az(p))
            kind = g["region"]
            if kind in ("jaw", "chin"):
                ok = self.chin_z - 0.012 <= p.z <= self.mouth_z - 0.006 and a <= g.get("az", 90) and n.z < 0.6
                if kind == "chin":
                    ok = ok and abs(p.x) <= g["x"] * hr and n.y < 0
            elif kind == "lip":
                ok = self.mouth_z + 0.004 <= p.z <= self.mouth_z + 0.014 and abs(p.x) <= g["x"] * hr and n.y < -0.4
            elif kind == "cheek":
                ok = self.mouth_z <= p.z <= self.eye_z - 0.01 and g["az_from"] <= a <= g["az_to"]
            else:
                raise ValueError("unknown beard region " + kind)
            if ok:
                out.append(i)
        if len(out) < g["count"]:
            raise SystemExit("beard region %s has %d skin vertices for %d clumps" % (g["name"], len(out), g["count"]))
        # Spread the roots across the region by azimuth, then pick within each slice.
        out.sort(key=lambda i: self.az(self.pts[i]))
        return out

    def keep_off(self, p):
        _, i, _ = self.tree.find(p)
        depth = (p - self.pts[i]).dot(self.normals[i])
        return p + self.normals[i] * (SKIN_MARGIN_M - depth) if depth < SKIN_MARGIN_M else p

    def normal(self, p):
        _, i, _ = self.tree.find(p)
        return self.normals[i]


def _clump(face, root_i, g, length_hr, rng):
    hr = face.hr
    p = face.pts[root_i] + face.normals[root_i] * 0.001
    n = face.normals[root_i]
    flow = Vector(g.get("flow_vec") or acg_hair.FLOWS[g.get("flow", "down")])
    if g.get("mirror_x") and p.x < 0:
        flow.x = -flow.x
    flow.normalize()
    t = (n * g.get("lift", 0.5) + flow).normalized()
    jit = g.get("jitter", 0.1)
    # Draws first, all of them, so the short and the long beard share every random choice.
    jitters = [Vector((rng.uniform(-jit, jit), rng.uniform(-jit, jit), rng.uniform(-jit, jit))) for _ in range(STEPS)]
    ph = rng.uniform(0, 2 * math.pi)
    w = g["width"] * hr * rng.uniform(0.8, 1.2)
    length = length_hr * hr * rng.uniform(0.85, 1.15)
    ds = length / STEPS
    pts = [p.copy()]
    for k in range(STEPS):
        t = (t + flow * g.get("gravity", 0.4) + jitters[k] * 0.3).normalized()
        p = face.keep_off(p + t * ds)
        pts.append(p.copy())
    wave = g.get("wave", 0.0)
    if wave:
        m = len(pts)
        for k in range(1, m):
            u = k / (m - 1)
            pts[k] = pts[k] + Vector((1, 0, 0)) * wave * hr * math.sin(2 * math.pi * g.get("wave_freq", 2.0) * u + ph) * min(1.0, 4 * u)
    tp = g.get("taper", 1.6)
    widths = [w * (0.75 + 0.25 * min(1.0, 4 * k / (len(pts) - 1))) * (1 - (k / (len(pts) - 1)) ** tp) for k in range(len(pts))]
    return pts, widths


def _cap(face, region, verts, faces, us, lift):
    """The skin of `region` lifted `lift` off itself: the beard's base, so no skin shows between the clumps."""
    keep = set(region)
    at = {}
    for poly in face.polys:
        if not all(k in keep for k in poly):
            continue
        for k in poly:
            if k not in at:
                at[k] = len(verts)
                verts.append(face.pts[k] + face.normals[k] * lift)
                us.append(0.2)
        faces.append(tuple(at[k] for k in poly))


def _geometry(face, style, beard_len, lo):
    """Vertices, faces and strand u of one style at beard length `beard_len` (head radii)."""
    rng = random.Random(style.get("seed", 1))
    verts, faces, us = [], [], []
    for g in style["groups"]:
        region = face.region(g)
        if g.get("cap"):
            _cap(face, region, verts, faces, us, g["cap"] * face.hr)
        n = g["count"]
        for k in range(n):
            a = int(len(region) * k / n)
            b = max(a + 1, int(len(region) * (k + 1) / n))
            root = region[rng.randrange(a, b)]
            length = g["length"] + g.get("grow", 0.0) * (beard_len - lo)
            pts, widths = _clump(face, root, g, length, rng)
            acg_hair._tube(pts, widths, face, g.get("flat", 0.35), verts, faces, us)
    return verts, faces, us


def _grow(face, rig, styles):
    lo, hi = styles["min_length"], styles["max_length"]
    mat = acg_hair._gradient_material("npc_hair", *GREY, 0.55)
    out = []
    for name, style in sorted(styles["styles"].items()):
        verts, faces, us = _geometry(face, style, lo, lo)
        long_verts, long_faces, _ = _geometry(face, style, hi, lo)
        if len(long_verts) != len(verts) or long_faces != faces:
            raise SystemExit("beard %s: short and long meshes differ in topology" % name)
        me = bpy.data.meshes.new("beard_" + name)
        me.from_pydata(verts, [], faces)
        me.materials.append(mat)
        me.validate()
        uv = me.uv_layers.new(name="Strand")
        for loop in me.loops:
            u = us[loop.vertex_index]
            uv.data[loop.index].uv = ((0.5 + u * (acg_hair.GRADIENT_WIDTH - 1)) / acg_hair.GRADIENT_WIDTH, 0.5)
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new("beard_" + name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = rig
        ob.vertex_groups.new(name="head").add(list(range(len(verts))), 1.0, "REPLACE")
        ob.modifiers.new("Armature", "ARMATURE").object = rig
        out.append((ob, long_verts))
    return out


def main():
    a = _args()
    with open(os.path.join(HERE, "npc", "beard_styles.json"), encoding="utf-8") as f:
        styles = json.load(f)
    rig, body = npc_hair._body()
    face = Face(body)
    pts, normals, moving = npc_hair._head_follow(body)
    tree = npc_hair._tree(pts)
    beards = _grow(face, rig, styles)
    for ob, long_verts in beards:
        npc_hair._bake_keys(ob, tree, moving)
        sk = ob.shape_key_add(name=LENGTH_KEY, from_mix=False)
        for i, co in enumerate(long_verts):
            sk.data[i].co = co
        sk.value = 0.0
        acg_render._limit_weights(ob, set(rig.data.bones.keys()), 4)
    obs = [ob for ob, _ in beards]
    if a.preview:
        npc_hair._preview(body, obs, a.preview)
    npc_hair._export(rig, obs, a.fbx)
    print("NPC_BEARD_OK", os.path.basename(a.fbx), "hr=%.3f" % face.hr, "keys=%d" % len(moving),
          " ".join("%s:%d" % (o.name, len(o.data.vertices)) for o in obs))


if __name__ == "__main__":
    main()
