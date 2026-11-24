"""Geometry, era craft language and finishing for the everyday-object part kits (cosmos_chimera ADR-0016).

Every slot variant is one mesh object built in a shared function frame (Z up, -Y front, origin at the grip
or the floor contact), so the game assembles an object by placing one variant per slot at the same origin.
Pure bmesh, no operators: runs headless and gives the same mesh for the same (function, era, slot, variant).
"""
import math
import random
import zlib

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ERAS = ("Primal", "Agrarian", "Mercantile", "Industrial", "Ancient", "Steampunk", "Future", "Wasteland")
VARIANTS = 6

# Era craft language (everyday-objects.md#抽樣 圓潤度 drives bevel): material roles and surface treatment.
STYLE = {
    "Primal": dict(bevel=0.10, seg=1, noise=0.045, body="wood", fit="rope", grip="hide", accent="bone", metal="stone", glow=None),
    "Agrarian": dict(bevel=0.07, seg=1, noise=0.010, body="wood", fit="iron", grip="leather", accent="iron", metal="iron", glow=None),
    "Mercantile": dict(bevel=0.08, seg=2, noise=0.0, body="wood_dark", fit="brass", grip="leather", accent="brass", metal="iron", glow=None),
    "Industrial": dict(bevel=0.03, seg=1, noise=0.0, body="steel", fit="steel", grip="rubber", accent="paint", metal="steel", glow=None),
    "Steampunk": dict(bevel=0.07, seg=2, noise=0.0, body="brass", fit="copper", grip="leather", accent="brass", metal="brass", glow="glow_amber"),
    "Future": dict(bevel=0.22, seg=2, noise=0.0, body="shell", fit="shell_dark", grip="rubber", accent="paint", metal="shell_dark", glow="glow_cyan"),
    "Wasteland": dict(bevel=0.03, seg=1, noise=0.018, body="rust", fit="iron", grip="cloth", accent="paint", metal="rust", glow="glow_dim"),
    "Ancient": dict(bevel=0.20, seg=2, noise=0.0, body="stone", fit="stone_dark", grip="stone", accent="gold", metal="stone", glow="glow_rune"),
}

# Preview palette (Verdant-like). The game recolours by material name per region; these are only for sheets.
PALETTE = {
    "wood": "#8a5a34", "wood_dark": "#5e3b24", "bark": "#6b4a2e", "bone": "#e6dcc2", "hide": "#c9a27a",
    "rope": "#b89a62", "leather": "#7a4a2a", "cloth": "#8fae6a", "iron": "#5d6166", "steel": "#9aa1a8",
    "rust": "#94512c", "brass": "#c99b3c", "copper": "#b8673a", "paint": "#4f8a4a", "rubber": "#2e2f31",
    "shell": "#e9ece6", "shell_dark": "#56636a", "glass": "#a9d6dc", "stone": "#a39d8e", "stone_dark": "#6f6a60",
    "ceramic": "#c88a5a", "glaze": "#4e8c7a", "gold": "#e0b84a", "feather": "#d8d4cc",
    "glow_amber": "#ffb347", "glow_cyan": "#5ff3ff", "glow_rune": "#4fffd0", "glow_dim": "#ffd27a",
}
GLOW = {"glow_amber", "glow_cyan", "glow_rune", "glow_dim"}


def rng_for(*key):
    """Deterministic per-key RNG: crc32 of the key text, never Python's salted hash()."""
    return random.Random(zlib.crc32("|".join(str(k) for k in key).encode("utf-8")))


def M(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    """Matrix from location, Euler degrees and scale."""
    r = Euler(tuple(math.radians(a) for a in rot)).to_matrix().to_4x4()
    s = Matrix.Diagonal(Vector(scale + (1,) if len(scale) == 3 else scale))
    return Matrix.Translation(Vector(loc)) @ r @ s


class Part:
    """One slot variant under construction: a bmesh plus its material-name table."""

    def __init__(self, era, rng, frame):
        self.frame = frame
        self.bm = bmesh.new()
        self.mats = []
        self.era = era
        self.style = STYLE[era]
        self.rng = rng

    def role(self, r):
        """Era material for a role name (body/fit/grip/accent/metal/glow); other names pass through."""
        m = self.style.get(r, r)
        return m if m is not None else self.style["accent"]

    def _add(self, build, mat, bevel=None, noise=None, bevel_seg=None):
        bm = self.bm
        before = set(bm.faces)
        build(bm)
        new = [f for f in bm.faces if f not in before]
        name = self.role(mat)
        if name not in self.mats:
            self.mats.append(name)
        idx = self.mats.index(name)
        bev = self.style["bevel"] if bevel is None else bevel
        if bev > 0 and new:
            edges = list({e for f in new for e in f.edges})
            size = _extent([v.co for f in new for v in f.verts])
            off = bev * 0.5 * min(size)
            if off > 1e-4:
                res = bmesh.ops.bevel(bm, geom=edges, offset=off, offset_type="OFFSET",
                                      segments=bevel_seg or self.style["seg"], profile=0.5, affect="EDGES",
                                      clamp_overlap=True)
                new = list(set(new) | set(res["faces"]))
                new = [f for f in new if f.is_valid]
        for f in new:
            f.material_index = idx
        amp = self.style["noise"] if noise is None else noise
        if amp > 0:
            verts = {v for f in new for v in f.verts}
            size = _extent([v.co for v in verts])
            a = amp * max(size)
            ph = [self.rng.uniform(0, 6.283) for _ in range(3)]
            for v in verts:
                p = v.co
                n = (math.sin(p.x * 23 + ph[0]) * math.sin(p.y * 19 + ph[1]) * math.sin(p.z * 17 + ph[2])
                     + 0.5 * math.sin(p.x * 51 + p.z * 47 + ph[1]))
                v.co = p + v.normal * (a * n) if v.normal.length > 0 else p
        return new

    # ---- primitives (all take a placement matrix m) ----
    def box(self, size, m=None, mat="body", **kw):
        mm = (m or Matrix()) @ Matrix.Diagonal(Vector((size[0], size[1], size[2], 1)))
        return self._add(lambda bm: bmesh.ops.create_cube(bm, size=1.0, matrix=mm), mat, **kw)

    def cyl(self, r1, r2, h, m=None, mat="body", segs=10, cap=True, **kw):
        """Cone/cylinder along local Z from z=0 to z=h."""
        mm = (m or Matrix()) @ Matrix.Translation((0, 0, h / 2))
        kw.setdefault("bevel", 0)
        return self._add(lambda bm: bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segs,
                                                          radius1=r1, radius2=r2, depth=h, matrix=mm), mat, **kw)

    def ball(self, r, m=None, mat="body", segs=(8, 6), **kw):
        mm = m or Matrix()
        return self._add(lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=r,
                                                              matrix=mm), mat, bevel=0, **kw)

    def lathe(self, profile, m=None, mat="body", segs=12, **kw):
        """Surface of revolution about local Z; profile = [(r, z), ...] bottom to top (r may be 0 at the ends)."""
        mm = m or Matrix()
        return self._add(lambda bm: _merge(bm, _lathe_bm(profile, segs), mm), mat, bevel=0, **kw)

    def ring(self, r, t, m=None, mat="fit", segs=12, square=True, **kw):
        """Torus about local Z (major radius r, minor t); square=True gives a flat band cross-section."""
        mm = m or Matrix()
        return self._add(lambda bm: _merge(bm, _torus_bm(r, t, segs, 4, square), mm), mat, bevel=0, **kw)

    def tube(self, pts, r, mat="fit", segs=6, **kw):
        """Swept tube through world points (handles, straps, wires, antlers)."""
        return self._add(lambda bm: _merge(bm, _tube_bm([Vector(p) for p in pts], r, segs), Matrix()), mat, bevel=0, **kw)

    def plate(self, outline, t, m=None, mat="metal", **kw):
        """Polygon in local XZ ([(x, z), ...]) extruded t along local Y, centred on y=0."""
        mm = m or Matrix()
        kw.setdefault("bevel_seg", 1)
        return self._add(lambda bm: _merge(bm, _plate_bm(outline, t), mm), mat, **kw)

    # ---- era fittings ----
    def band(self, r, z, h=None, m=None, mat="fit"):
        """Era binding around a round part at height z: rope, iron hoop, brass bead, bolted strap, riveted
        copper, glowing seam, wire wrap or rune ring."""
        e = self.era
        base = (m or Matrix()) @ Matrix.Translation((0, 0, z))
        h = h or r * 0.35
        seg = 8 if r < 0.06 else 12
        if e == "Primal":
            for i in range(2):
                self.ring(r * 1.02, h * 0.25, base @ Matrix.Translation((0, 0, (i - 0.5) * h * 0.5)) @ M(rot=(self.rng.uniform(-6, 6), 0, 0)),
                          mat="rope", segs=seg, square=True)
        elif e == "Wasteland":
            for i in range(2):
                self.ring(r * 1.03, h * 0.12, base @ Matrix.Translation((0, 0, (i - 0.5) * h * 0.4)) @ M(rot=(self.rng.uniform(-12, 12), self.rng.uniform(-8, 8), 0)),
                          mat="iron", segs=seg, square=True)
            self.box((r * 0.9, h * 0.15, h * 0.9), base @ Matrix.Translation((0, -r * 1.02, 0)), mat="cloth", bevel=0)
        elif e == "Future":
            self.ring(r * 1.005, h * 0.18, base, mat="shell_dark", segs=seg)
            self.ring(r * 1.02, h * 0.06, base, mat="glow", segs=seg)
        elif e == "Ancient":
            self.ring(r * 1.03, h * 0.3, base, mat="fit", segs=seg)
            for i in range(3):
                a = i * math.tau / 3 + 0.4
                self.box((r * 0.18, r * 0.06, h * 0.25), base @ M(loc=(math.cos(a) * r * 1.09, math.sin(a) * r * 1.09, 0), rot=(0, 0, math.degrees(a) + 90)), mat="glow", bevel=0)
        else:
            self.ring(r * 1.02, h * 0.3, base, mat=mat, segs=seg)
            studs = {"Agrarian": 0, "Mercantile": 0, "Industrial": 3, "Steampunk": 3}[e]
            if e == "Mercantile":
                self.ring(r * 1.04, h * 0.08, base @ Matrix.Translation((0, 0, h * 0.32)), mat="brass", segs=seg)
            for i in range(studs):
                a = i * math.tau / studs
                p = base @ M(loc=(math.cos(a) * r * 1.07, math.sin(a) * r * 1.07, 0), rot=(0, 90, math.degrees(a)))
                if e == "Industrial":
                    self.cyl(h * 0.12, h * 0.12, h * 0.1, p, mat="steel", segs=6)
                else:
                    self.ball(h * 0.09, p, mat="copper", segs=(4, 3))

    def screen(self, w, h, m, mat="glow"):
        """Flat display face; lights only from Steampunk on (earlier eras get a carved panel instead)."""
        if self.style["glow"]:
            self.box((w, 0.004, h), m, mat="glow", bevel=0)
        else:
            self.box((w, 0.004, h), m, mat="accent", bevel=0)


# ---- scratch-bmesh builders ----


def _merge(dst, src, m):
    """Copies src into dst transformed by m; frees src."""
    vmap = {}
    for v in src.verts:
        vmap[v] = dst.verts.new(m @ v.co)
    for f in src.faces:
        try:
            dst.faces.new([vmap[v] for v in f.verts])
        except ValueError:
            pass
    src.free()


def _lathe_bm(profile, segs):
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(i * math.tau / segs), r * math.sin(i * math.tau / segs), z)) for i in range(segs)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(segs):
            j = (i + 1) % segs
            if len(a) == 1:
                bm.faces.new((a[0], b[i], b[j])[::-1])
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0])[::-1])
            else:
                bm.faces.new((a[i], a[j], b[j], b[i])[::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def _torus_bm(R, t, segs, minor, square):
    bm = bmesh.new()
    rings = []
    for i in range(segs):
        a = i * math.tau / segs
        c = Vector((math.cos(a), math.sin(a), 0))
        ring = []
        for k in range(minor):
            b = k * math.tau / minor + (math.pi / 4 if square else 0)
            d = c * math.cos(b) + Vector((0, 0, 1)) * math.sin(b)
            ring.append(bm.verts.new(c * R + d * t))
        rings.append(ring)
    for i in range(segs):
        a, b = rings[i], rings[(i + 1) % segs]
        for k in range(minor):
            j = (k + 1) % minor
            bm.faces.new((a[k], b[k], b[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def _tube_bm(pts, r, segs):
    bm = bmesh.new()
    rings = []
    up = Vector((0, 0, 1))
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = up if abs(t.dot(up)) < 0.9 else Vector((1, 0, 0))
        u = t.cross(ref).normalized()
        v = t.cross(u)
        rings.append([bm.verts.new(p + (u * math.cos(k * math.tau / segs) + v * math.sin(k * math.tau / segs)) * r) for k in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for k in range(segs):
            j = (k + 1) % segs
            bm.faces.new((a[k], a[j], b[j], b[k]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def _plate_bm(outline, t):
    bm = bmesh.new()
    front = [bm.verts.new((x, -t / 2, z)) for x, z in outline]
    back = [bm.verts.new((x, t / 2, z)) for x, z in outline]
    n = len(outline)
    bm.faces.new(front[::-1])
    bm.faces.new(back)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], quad_method="BEAUTY", ngon_method="EAR_CLIP")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def _extent(cos):
    if not cos:
        return (0, 0, 0)
    lo = Vector((min(c.x for c in cos), min(c.y for c in cos), min(c.z for c in cos)))
    hi = Vector((max(c.x for c in cos), max(c.y for c in cos), max(c.z for c in cos)))
    d = hi - lo
    return (max(d.x, 1e-4), max(d.y, 1e-4), max(d.z, 1e-4))


# ---- finishing ----
# Per-variant silhouette modulation (bulge, off-centre swell); v0 is the base shape.
MORPH = ((0.0, 0.0), (0.10, 0.04), (-0.08, 0.05), (0.06, -0.06), (-0.05, 0.07), (0.14, -0.03))


def morph(part, k):
    """Radially swells or pinches a part along its own height; both ends stay put, so the joints with the
    neighbouring slots (which sit at a part's top and bottom) do not move."""
    a, b = MORPH[k % len(MORPH)]
    verts = part.bm.verts
    if (a == 0 and b == 0) or not verts:
        return
    zs = [v.co.z for v in verts]
    lo, hi = min(zs), max(zs)
    if hi - lo < 0.005:
        return
    cx = sum(v.co.x for v in verts) / len(verts)
    cy = sum(v.co.y for v in verts) / len(verts)
    for v in verts:
        t = (v.co.z - lo) / (hi - lo)
        f = 1 + a * math.sin(math.pi * t) + b * math.sin(2 * math.pi * t)
        v.co.x = cx + (v.co.x - cx) * f
        v.co.y = cy + (v.co.y - cy) * f


def finish(part, name, coll):
    """Turns a Part into a mesh object: smooth by angle, cavity/edge/damage masks in COLOR_0, materials by name.

    COLOR_0: R cavity (darken creases), G convex edge (wear highlight), B damage mask (threshold at runtime),
    A 1. Linear values: they are masks, not colours.
    Returns (object, triangle count).
    """
    bm = part.bm
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(38):
            e.smooth = False
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    nbr = [[] for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices
        nbr[a].append(b)
        nbr[b].append(a)
    rng = part.rng
    ph = [rng.uniform(0, 6.283) for _ in range(3)]
    for v in me.vertices:
        acc = 0.0
        for j in nbr[v.index]:
            d = me.vertices[j].co - v.co
            if d.length > 1e-6:
                acc += v.normal.dot(d.normalized())
        acc = acc / max(1, len(nbr[v.index]))
        cav = max(0.0, min(1.0, acc * 2.5))
        edge = max(0.0, min(1.0, -acc * 2.5))
        p = v.co
        dmg = 0.5 + 0.25 * math.sin(p.x * 31 + ph[0]) * math.sin(p.y * 29 + ph[1]) + 0.25 * math.sin(p.z * 37 + p.x * 13 + ph[2])
        attr.data[v.index].color = (cav, edge, max(0.0, min(1.0, dmg)), 1.0)
    for n in part.mats:
        me.materials.append(material(n))
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    return ob, tris


def _lin(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def material(name):
    """Preview toon material named m_<name>: 3-step cel ramp darkened by the cavity mask; glow is emissive.
    The game keys its own material off the same name."""
    full = "m_" + name
    m = bpy.data.materials.get(full)
    if m:
        return m
    m = bpy.data.materials.new(full)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    base = _lin(PALETTE.get(name, "#ff00ff"))
    m.diffuse_color = base
    if name in GLOW:
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs[0].default_value = base
        em.inputs[1].default_value = 4.0
        nt.links.new(em.outputs[0], out.inputs[0])
        return m
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    s2r = nt.nodes.new("ShaderNodeShaderToRGB")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    shade = tuple(c * 0.55 for c in base[:3]) + (1.0,)
    ramp.color_ramp.elements[0].color = tuple(c * 0.38 for c in base[:3]) + (1.0,)
    ramp.color_ramp.elements[1].position = 0.5
    ramp.color_ramp.elements[1].color = base
    mid = ramp.color_ramp.elements.new(0.18)
    mid.color = shade
    nt.links.new(diff.outputs[0], s2r.inputs[0])
    nt.links.new(s2r.outputs[0], ramp.inputs[0])
    col = nt.nodes.new("ShaderNodeVertexColor")
    col.layer_name = "Col"
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(col.outputs[0], sep.inputs[0])
    # Cavity darkens up to 45 %, convex edges brighten 25 %: the hand-painted look without a texture.
    dark = nt.nodes.new("ShaderNodeMath")
    dark.operation = "MULTIPLY_ADD"
    dark.inputs[1].default_value = -0.45
    dark.inputs[2].default_value = 1.0
    nt.links.new(sep.outputs[0], dark.inputs[0])
    lift = nt.nodes.new("ShaderNodeMath")
    lift.operation = "MULTIPLY_ADD"
    lift.inputs[1].default_value = 0.25
    nt.links.new(sep.outputs[1], lift.inputs[0])
    nt.links.new(dark.outputs[0], lift.inputs[2])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    nt.links.new(ramp.outputs[0], mix.inputs[6])
    comb = nt.nodes.new("ShaderNodeCombineColor")
    for i in range(3):
        nt.links.new(lift.outputs[0], comb.inputs[i])
    nt.links.new(comb.outputs[0], mix.inputs[7])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(mix.outputs[2], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m
