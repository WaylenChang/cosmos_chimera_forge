"""Per-function forms: each era builds its own functional equivalent (cosmos_chimera everyday-objects-catalog.md).

form(part, era, slot) draws one slot variant into part; part.rng is seeded per (function, era, slot, variant),
so variants differ in proportions and optional details while sharing the joints of the function frame.
Frames: hafted tools stand on +Z with the grip at the origin; devices and vessels sit on z = 0 facing -Y.
"""
import math

from mathutils import Matrix

from kit_lib import M

FUNCTIONS = {}


def function(name, family, slots, size):
    """Registers a form. size: 'carried' (<= 600 tris assembled) or 'scene' (<= 1500)."""
    def wrap(fn):
        FUNCTIONS[name] = dict(family=family, slots=slots, size=size, form=fn)
        return fn
    return wrap


def J(p, v, s=0.12):
    """Per-variant jitter: only for dimensions no other slot depends on."""
    return v * (1 + p.rng.uniform(-s, s))


def F(p, v, s=0.12):
    """Frame dimension shared by every slot of this (function, era), so parts meet at the same joints.
    Draws in call order from the frame stream; each form draws its frame values first, in a fixed order."""
    return v * (1 + p.frame.uniform(-s, s))


def coin(p, chance=0.5):
    return p.rng.random() < chance


# ---------------------------------------------------------------- hafted (head, haft, joint, butt)
HAFTED = ("head", "haft", "joint", "butt")


def haft(p, L, r):
    e = p.era
    if e == "Primal":
        w = [J(p, 0.012, 0.6) * (1 if i % 2 else -1) for i in range(5)]
        p.tube([(w[i], w[(i + 2) % 5] * 0.5, L * i / 4) for i in range(5)], r, mat="body", segs=6)
        if coin(p):
            p.tube([(0, 0, L * 0.45), (r * 2.2, 0, L * 0.5)], r * 0.35, mat="body", segs=5)
    elif e == "Agrarian":
        p.cyl(r, r * J(p, 0.88, 0.05), L, mat="body", segs=8, bevel=0)
    elif e == "Mercantile":
        p.lathe([(r * 1.15, 0), (r, L * 0.08), (r * 0.92, L * 0.5), (r * J(p, 1.08, 0.05), L * 0.85), (r, L)], mat="body", segs=8)
        p.cyl(r * 1.1, r * 1.1, L * J(p, 0.22, 0.2), Matrix.Translation((0, 0, L * 0.05)), mat="grip", segs=8, bevel=0)
    elif e == "Industrial":
        p.cyl(r * 0.8, r * 0.8, L, mat="body", segs=8, bevel=0)
        p.cyl(r * 1.05, r * 1.05, L * J(p, 0.28, 0.15), mat="grip", segs=8, bevel=0)
        if coin(p):
            for i in range(2):
                p.ring(r * 1.07, r * 0.12, Matrix.Translation((0, 0, L * (0.08 + i * 0.1))), mat="grip", segs=8)
    elif e == "Steampunk":
        p.cyl(r, r * 0.92, L, mat="wood_dark", segs=8, bevel=0)
        p.band(r, L * J(p, 0.5, 0.3), h=r * 1.2)
    elif e == "Future":
        p.cyl(r, r * 0.9, L, M(scale=(J(p, 1.3, 0.1), 1, 1)), mat="body", segs=8, bevel=0)
        p.box((r * 0.6, r * 0.5, L * 0.22), Matrix.Translation((0, -r * 0.8, L * 0.15)), mat="grip")
        p.box((r * 0.18, r * 0.2, L * J(p, 0.5, 0.2)), Matrix.Translation((0, r * 0.95, L * 0.55)), mat="glow", bevel=0)
    elif e == "Wasteland":
        p.cyl(r * 0.85, r * 0.85, L, M(rot=(J(p, 2, 1), 0, 0)), mat="body", segs=7, bevel=0)
        for i in range(p.rng.randint(1, 3)):
            z = p.rng.uniform(0.05, 0.7) * L
            p.cyl(r * 1.05, r * 1.05, L * 0.08, Matrix.Translation((0, 0, z)), mat="grip", segs=7, bevel=0)
    else:  # Ancient
        p.cyl(r * 1.05, r, L, mat="body", segs=6, bevel=0.05)
        for i in range(3):
            z = L * (0.3 + i * 0.2)
            p.box((r * 0.3, r * 0.12, r * 1.4), Matrix.Translation((0, -r * 0.98, z)), mat="glow", bevel=0)


def joint(p, L, r):
    p.band(r * J(p, 1.25, 0.1), L * J(p, 0.9, 0.03), h=r * J(p, 2.2, 0.2))


def butt(p, r):
    e = p.era
    if e == "Primal":
        p.ball(r * J(p, 1.5, 0.2), M(scale=(1, 1, 0.8)), mat="body")
    elif e == "Agrarian":
        p.cyl(r * 1.1, r, r * 1.2, Matrix.Translation((0, 0, -r * 0.6)), mat="iron", segs=8, bevel=0)
    elif e == "Mercantile":
        p.lathe([(0, -r * 2), (r * 1.4, -r * 1.6), (r * J(p, 1.6, 0.15), -r * 0.8), (r * 1.1, 0)], mat="brass", segs=8)
    elif e == "Industrial":
        p.cyl(r * 1.12, r * 1.12, r * 1.4, Matrix.Translation((0, 0, -r * 0.9)), mat="rubber", segs=8)
    elif e == "Steampunk":
        p.lathe([(0, -r * 1.8), (r * 0.9, -r * 1.75), (r * 1.4, -r * 1.3), (r * 1.2, 0)], mat="brass", segs=8)
    elif e == "Future":
        p.ball(r * 1.25, M(loc=(0, 0, -r * 0.3), scale=(1.3, 1, 0.9)), mat="body", segs=(8, 4))
        p.ball(r * 0.35, M(loc=(0, -r * 1.2, -r * 0.3)), mat="glow", segs=(6, 4))
    elif e == "Wasteland":
        p.ball(r * J(p, 1.4, 0.2), M(loc=(0, 0, -r * 0.4)), mat="cloth", segs=(7, 5), noise=0.06)
    else:
        p.ball(r * 1.5, M(loc=(0, 0, -r * 0.6), rot=(0, 0, 22)), mat="body", segs=(4, 2))


def hafted(L, r, head):
    def form(p, slot):
        if slot == "haft":
            haft(p, L, r)
        elif slot == "joint":
            joint(p, L, r)
        elif slot == "butt":
            butt(p, r)
        else:
            head(p, L, r)
    return form


def _hoe_head(p, L, r):
    e = p.era
    w = J(p, 0.17, 0.15)
    h = J(p, 0.16, 0.15)
    top = L + 0.01
    tilt = J(p, 18, 0.4)
    blade = M(loc=(0, -0.15, top - h * 0.55), rot=(tilt, 0, 0))
    if e == "Primal":
        p.tube([(0, 0, top - 0.04), (0, -0.07, top + 0.01), (0, -0.15, top - 0.05), (0, -0.18, top - 0.2)], J(p, 0.022), mat="bone", segs=6)
        if coin(p):
            p.tube([(0, -0.1, top), (0.04, -0.14, top + 0.03)], 0.012, mat="bone", segs=5)
        p.band(r * 1.6, top - 0.04, h=0.03)
        return
    if e == "Future":
        p.box((0.12, 0.12, 0.09), Matrix.Translation((0, -0.06, top)), mat="body")
        for x in (-0.07, 0.07):
            p.cyl(J(p, 0.07, 0.15), 0.07, 0.025, M(loc=(x, -0.08, top - 0.08), rot=(0, 90, 0)), mat="shell_dark", segs=10)
        p.box((0.09, 0.01, 0.015), Matrix.Translation((0, -0.125, top + 0.02)), mat="glow", bevel=0)
        return
    neck = [(0, 0, top - 0.02), (0, -0.06, top + 0.03), (0, -0.13, top + 0.0)]
    if e == "Mercantile":
        neck = [(0, 0, top - 0.02), (0, -0.04, top + 0.06), (0, -0.11, top + 0.07), (0, -0.15, top - 0.0)]
    p.tube(neck, J(p, 0.016), mat="metal" if e != "Steampunk" else "iron", segs=6)
    if e == "Mercantile":
        outline = [(-w / 2, 0), (-w / 2 * 0.8, -h * 0.8), (0, -h), (w / 2 * 0.8, -h * 0.8), (w / 2, 0)]
    elif e == "Ancient":
        outline = [(-w * 0.6, 0.02), (-w * 0.45, -h * 0.9), (0, -h * 1.1), (w * 0.45, -h * 0.9), (w * 0.6, 0.02), (0, -h * 0.25)]
    else:
        outline = [(-w / 2, 0), (-w / 2 * J(p, 0.9, 0.08), -h), (w / 2 * J(p, 0.9, 0.08), -h), (w / 2, 0)]
    mat = {"Agrarian": "iron", "Industrial": "steel", "Steampunk": "iron", "Wasteland": "paint", "Ancient": "stone"}.get(e, "iron")
    p.plate(outline, 0.012 if e != "Ancient" else 0.03, blade @ Matrix.Translation((0, 0, h * 0.5)), mat=mat)
    if e == "Industrial":
        p.cyl(0.008, 0.008, w, M(loc=(-w / 2, -0.15, top - 0.005), rot=(0, 90, 0)), mat="steel", segs=6, bevel=0)
        p.band(r * 1.3, L * 0.97, h=0.04)
    elif e == "Steampunk":
        for i in range(3):
            p.ring(0.022, 0.004, M(loc=(0, -0.07, top + 0.005 + i * 0.014), rot=(90, 0, 0)), mat="brass", segs=8)
        p.ball(0.018, Matrix.Translation((0, -0.15, top + 0.0)), mat="brass", segs=(6, 4))
    elif e == "Wasteland":
        for x in (-w * 0.3, w * 0.3):
            p.cyl(0.008, 0.008, 0.016, M(loc=(x, -0.165, top - 0.04), rot=(90, 0, 0)), mat="rubber", segs=6, bevel=0)
        p.band(r * 1.4, top - 0.03, h=0.04)
    elif e == "Ancient":
        p.box((w * 0.7, 0.034, 0.008), blade @ Matrix.Translation((0, 0, h * 0.1)), mat="glow", bevel=0)
    elif e == "Mercantile":
        p.ring(r * 1.3, 0.006, Matrix.Translation((0, 0, top - 0.03)), mat="brass", segs=10, square=False)


def _hammer_head(p, L, r):
    e = p.era
    s = J(p, 1.0, 0.12)
    top = L + 0.03 * s
    if e == "Primal":
        p.ball(0.055 * s, M(loc=(0, -0.01, top), scale=(0.8, 1.3, 0.85)), mat="stone", segs=(8, 6), noise=0.08)
        p.band(r * 1.7, top - 0.01, h=0.05)
    elif e == "Agrarian":
        p.cyl(0.045 * s, 0.045 * s, 0.15 * s, M(loc=(0, 0.075 * s, top), rot=(90, 0, 0)), mat="wood", segs=10)
        for y in (-0.065, 0.065):
            p.ring(0.046 * s, 0.006, M(loc=(0, y * s, top), rot=(90, 0, 0)), mat="iron", segs=10)
    elif e == "Mercantile":
        p.box((0.04 * s, 0.09 * s, 0.045 * s), Matrix.Translation((0, -0.02 * s, top)), mat="iron")
        p.cyl(0.024 * s, 0.012 * s, 0.07 * s, M(loc=(0, 0.02 * s, top), rot=(-90, 0, 0)), mat="iron", segs=8)
        p.box((0.02, 0.02, 0.012), Matrix.Translation((0, 0, top + 0.026 * s)), mat="brass")
    elif e == "Industrial":
        p.cyl(0.022 * s, 0.022 * s, 0.07 * s, M(loc=(0, 0.0, top), rot=(90, 0, 0)), mat="steel", segs=8)
        claw = [(0, 0), (0.008, 0.03), (0.002, 0.07), (-0.01, 0.075), (-0.004, 0.03)]
        for x in (-0.009, 0.009):
            p.plate([(y, z) for z, y in claw], 0.008, M(loc=(x, 0.0, top), rot=(0, 0, 90)), mat="steel", bevel=0)
    elif e == "Steampunk":
        p.cyl(0.04 * s, 0.04 * s, 0.13 * s, M(loc=(0, 0.065 * s, top), rot=(90, 0, 0)), mat="brass", segs=10)
        p.band(0.04 * s, 0.0, m=M(loc=(0, 0.04 * s, top), rot=(90, 0, 0)), h=0.03)
        p.cyl(0.014, 0.014, 0.004, M(loc=(0, -0.0, top + 0.042 * s), rot=(0, 0, 0)), mat="glow", segs=8, bevel=0)
        p.tube([(0.03, 0.02, top), (0.05, 0.0, top - 0.05), (0.015, 0, top - 0.1)], 0.006, mat="copper", segs=5)
    elif e == "Future":
        p.box((0.06 * s, 0.13 * s, 0.06 * s), Matrix.Translation((0, 0, top)), mat="body")
        for y in (-0.066, 0.066):
            p.ring(0.022 * s, 0.005, M(loc=(0, y * s, top), rot=(90, 0, 0)), mat="glow", segs=8)
    elif e == "Wasteland":
        p.cyl(0.035 * s, 0.035 * s, 0.1 * s, M(loc=(0, 0.05 * s, top), rot=(90, 0, 0)), mat="body", segs=6)
        p.cyl(0.01, 0.01, 0.06, M(loc=(0, 0, top + 0.02)), mat="iron", segs=6, bevel=0)
        p.band(r * 1.5, L - 0.02, h=0.03)
    else:
        p.cyl(0.05 * s, 0.05 * s, 0.14 * s, M(loc=(0, 0.07 * s, top), rot=(90, 0, 0)), mat="stone", segs=8, bevel=0.12)
        p.ring(0.051 * s, 0.004, M(loc=(0, 0, top), rot=(90, 0, 0)), mat="glow", segs=8)


def _pick_head(p, L, r):
    e = p.era
    span = J(p, 0.25, 0.12)
    rise = J(p, 0.05, 0.3)
    top = L + 0.02
    th = 0.02 if e != "Ancient" else 0.035

    def crescent(left, right):
        pts = []
        for i in range(5):
            t = -1 + i / 2
            y = t * (span if t > 0 else span * left)
            z = rise * (1 - t * t) * 0.6
            pts.append((y, z + 0.012 * (1 - abs(t))))
        lower = [(y, z - 0.028 * (1 - abs(t) * (0.9 if (t > 0 and right) or (t < 0 and left) else 0.3)))
                 for (y, z), t in zip(pts, [-1 + i / 2 for i in range(5)])]
        return pts + lower[::-1]

    head = M(loc=(0, 0, top), rot=(0, 0, 90))
    if e == "Primal":
        p.plate([(0, 0.02), (span * 0.9, -0.03), (0, -0.03)], 0.03, head, mat="stone", noise=0.06)
        p.band(r * 1.6, top - 0.01, h=0.05)
        return
    if e == "Wasteland":
        p.tube([(0, span, top - 0.06), (0, span * 0.5, top + 0.02), (0, 0, top + 0.03), (0, -span * 0.6, top + 0.0), (0, -span * 0.9, top - 0.05)], 0.012, mat="rust", segs=6)
        p.box((0.05, 0.05, 0.04), Matrix.Translation((0, 0, top)), mat="iron")
        return
    left = 1.0 if e in ("Mercantile", "Industrial", "Steampunk", "Future", "Ancient") else 0.55
    p.plate(crescent(left, True), th, head, mat={"Agrarian": "iron", "Mercantile": "iron", "Industrial": "steel", "Steampunk": "iron", "Future": "shell", "Ancient": "stone"}[e])
    if e == "Agrarian":
        p.plate([(-span * 0.55, 0.01), (-span * 0.6, -0.03), (-span * 0.35, -0.02)], 0.05, head, mat="iron", bevel=0)
    if e in ("Industrial", "Mercantile"):
        p.box((0.045, 0.05, 0.05), Matrix.Translation((0, 0, top)), mat="steel" if e == "Industrial" else "brass")
    if e == "Steampunk":
        p.cyl(0.025, 0.025, 0.08, M(loc=(0, 0, top + 0.02)), mat="brass", segs=8)
        p.ring(0.026, 0.004, Matrix.Translation((0, 0, top + 0.07)), mat="copper", segs=8)
        p.ball(0.012, Matrix.Translation((0, -0.02, top + 0.1)), mat="glow", segs=(6, 4))
    if e == "Future":
        for y in (-span, span):
            p.cyl(0.008, 0.0, 0.03, M(loc=(0, y * 0.98, top - 0.005), rot=(90 if y < 0 else -90, 0, 0)), mat="glow", segs=6, bevel=0)
        p.box((0.05, 0.06, 0.05), Matrix.Translation((0, 0, top)), mat="body", bevel_seg=1)
    if e == "Ancient":
        p.box((0.008, span * 1.4, 0.008), Matrix.Translation((0, 0, top + rise * 0.55)), mat="glow", bevel=0)


function("Hoe", "Hafted", HAFTED, "carried")(hafted(1.2, 0.017, _hoe_head))
function("Hammer", "Hafted", HAFTED, "carried")(hafted(0.32, 0.013, _hammer_head))
function("Pickaxe", "Hafted", HAFTED, "carried")(hafted(0.85, 0.017, _pick_head))


# ---------------------------------------------------------------- devices (shell, panel, controls, core, attachment)
DEVICE = ("shell", "panel", "controls", "core", "attachment")


@function("Communicator", "Device", DEVICE, "carried")
def communicator(p, slot):
    e = p.era
    if e == "Primal":  # signal drum
        h, r = F(p, 0.32), F(p, 0.13)
        if slot == "shell":
            p.lathe([(r * 0.8, 0), (r, h * 0.3), (r * 0.95, h * 0.85), (r, h)], mat="body", segs=10)
        elif slot == "panel":
            p.cyl(r * 1.04, r * 1.04, 0.01, Matrix.Translation((0, 0, h)), mat="hide", segs=10, bevel=0)
        elif slot == "controls":
            for i in range(8):
                a = i * math.tau / 8
                p.tube([(math.cos(a) * r, math.sin(a) * r, h), (math.cos(a + 0.4) * r * 0.95, math.sin(a + 0.4) * r * 0.95, h * 0.55)], 0.004, mat="rope", segs=4)
        elif slot == "core":
            p.tube([(r * 0.6, -r, h + 0.05), (r * 1.4, -r * 1.4, h + 0.2)], 0.008, mat="wood", segs=5)
            p.ball(0.02, Matrix.Translation((r * 0.6, -r, h + 0.05)), mat="hide", segs=(6, 4))
        else:
            p.ring(r * 1.02, 0.008, Matrix.Translation((0, 0, h * 0.55)), mat="rope", segs=10, square=False)
    elif e == "Agrarian":  # pigeon cage
        r, h = F(p, 0.14), F(p, 0.3)
        if slot == "shell":
            p.cyl(r, r, 0.03, mat="wood", segs=10)
            p.lathe([(r, h * 0.8), (r * 0.7, h * 0.95), (0, h)], mat="wood", segs=10)
        elif slot == "panel":
            n = 10
            for i in range(n):
                a = i * math.tau / n
                p.cyl(0.004, 0.004, h * 0.78, Matrix.Translation((math.cos(a) * r * 0.95, math.sin(a) * r * 0.95, 0.02)), mat="wood", segs=4, bevel=0)
        elif slot == "controls":
            p.box((0.06, 0.012, 0.08), Matrix.Translation((0, -r * 0.98, h * 0.35)), mat="iron")
        elif slot == "core":
            p.ball(0.05, M(loc=(0, 0, 0.09), scale=(0.8, 1.3, 0.9)), mat="feather", segs=(8, 6))
            p.ball(0.028, Matrix.Translation((0, -0.05, 0.14)), mat="feather", segs=(6, 4))
            p.cyl(0.008, 0.0, 0.02, M(loc=(0, -0.075, 0.14), rot=(90, 0, 0)), mat="gold", segs=4, bevel=0)
        else:
            p.ring(0.03, 0.006, M(loc=(0, 0, h + 0.03), rot=(90, 0, 0)), mat="iron", segs=8, square=False)
    elif e == "Mercantile":  # speaking tube
        L = F(p, 0.3)
        if slot == "shell":
            p.lathe([(0.02, 0), (0.022, L * 0.6), (0.04, L * 0.85), (J(p, 0.07), L)], m=M(rot=(-90, 0, 0), loc=(0, L * 0.5, 0.12)), mat="brass", segs=12)
        elif slot == "panel":
            p.ring(0.06, 0.006, M(loc=(0, -L * 0.5, 0.12), rot=(90, 0, 0)), mat="brass", segs=12, square=False)
        elif slot == "controls":
            p.cyl(0.012, 0.016, 0.04, M(loc=(0, -L * 0.55, 0.16), rot=(0, 0, 0)), mat="wood_dark", segs=8)
            p.tube([(0, -L * 0.5, 0.2), (0.02, -L * 0.4, 0.17), (0.02, -L * 0.3, 0.14)], 0.002, mat="brass", segs=4)
        elif slot == "core":
            p.ring(0.024, 0.004, M(loc=(0, L * 0.1, 0.12), rot=(90, 0, 0)), mat="copper", segs=10)
        else:
            p.box((0.08, 0.02, 0.24), Matrix.Translation((0, L * 0.5 + 0.01, 0.12)), mat="wood_dark")
    elif e == "Industrial":  # telegraph key
        if slot == "shell":
            p.box((J(p, 0.16), 0.24, 0.025), Matrix.Translation((0, 0, 0.0125)), mat="wood_dark")
        elif slot == "panel":
            p.box((0.016, 0.16, 0.01), M(loc=(0, -0.02, 0.06), rot=(J(p, 4, 0.5), 0, 0)), mat="brass")
            p.box((0.012, 0.012, 0.035), Matrix.Translation((0, 0.05, 0.04)), mat="brass")
        elif slot == "controls":
            p.cyl(0.02, 0.022, 0.012, Matrix.Translation((0, -0.1, 0.065)), mat="rubber", segs=10)
            for x in (-0.05, 0.05):
                p.cyl(0.008, 0.008, 0.02, Matrix.Translation((x, 0.09, 0.025)), mat="brass", segs=6, bevel=0)
        elif slot == "core":
            p.cyl(0.022, 0.022, 0.04, Matrix.Translation((0.05, -0.02, 0.025)), mat="copper", segs=10)
        else:
            p.tube([(0.05, 0.09, 0.03), (0.08, 0.13, 0.01), (0.12, 0.1, 0.005), (0.16, 0.15, 0.005)], 0.004, mat="rubber", segs=4)
    elif e == "Steampunk":  # brass handset
        if slot == "shell":
            p.tube([(0, 0, 0.02), (0, -0.02, 0.1), (0, 0, 0.18)], J(p, 0.018), mat="brass", segs=8)
            p.cyl(0.05, 0.055, 0.04, Matrix.Translation((0, 0.04, 0.0)), mat="wood_dark", segs=10)
        elif slot == "panel":
            for z, a in ((0.02, 30), (0.19, -30)):
                p.lathe([(0.012, 0), (0.035, 0.025), (0.036, 0.03)], M(loc=(0, -0.01, z), rot=(90 + a, 0, 0)), mat="brass", segs=10)
        elif slot == "controls":
            p.cyl(0.04, 0.04, 0.008, M(loc=(0, 0.04, 0.042)), mat="copper", segs=12)
            p.ring(0.03, 0.004, Matrix.Translation((0, 0.04, 0.052)), mat="brass", segs=10)
        elif slot == "core":
            p.cyl(0.012, 0.012, 0.05, Matrix.Translation((0.035, 0.07, 0.04)), mat="glass", segs=8, bevel=0)
            p.ball(0.008, Matrix.Translation((0.035, 0.07, 0.065)), mat="glow", segs=(6, 4))
        else:
            pts = [(0.0 + 0.012 * math.cos(i * 1.3), 0.04 + 0.012 * math.sin(i * 1.3), 0.04 + i * 0.009) for i in range(10)]
            p.tube(pts, 0.003, mat="cloth", segs=4)
    elif e == "Future":  # holo communicator
        w, h = F(p, 0.075), F(p, 0.14)
        if slot == "shell":
            p.box((w, 0.014, h), Matrix.Translation((0, 0, h / 2)), mat="body")
        elif slot == "panel":
            p.screen(w * 0.85, h * 0.7, Matrix.Translation((0, -0.008, h * 0.55)))
        elif slot == "controls":
            p.box((w * 0.5, 0.004, 0.006), Matrix.Translation((0, -0.008, h * 0.12)), mat="shell_dark", bevel=0)
        elif slot == "core":
            p.cyl(0.01, 0.025, 0.03, M(loc=(0, -0.01, h)), mat="glow", segs=10, bevel=0)
        else:
            p.ring(w * 0.6, 0.004, M(loc=(0, 0.012, h * 0.4), rot=(90, 0, 0), scale=(1, 1.5, 1)), mat="shell_dark", segs=12)
    elif e == "Wasteland":  # salvaged walkie
        w, h = F(p, 0.08), F(p, 0.15)
        if slot == "shell":
            p.box((w, 0.04, h), M(loc=(0, 0, h / 2), rot=(0, J(p, 3, 1), 0)), mat="body")
            p.box((w * 0.6, 0.005, h * 0.35), Matrix.Translation((w * 0.15, -0.022, h * 0.3)), mat="paint")
        elif slot == "panel":
            for i in range(4):
                p.box((w * 0.6, 0.004, 0.005), Matrix.Translation((0, -0.021, h * (0.6 + i * 0.07))), mat="rubber", bevel=0)
        elif slot == "controls":
            p.cyl(0.01, 0.01, 0.015, Matrix.Translation((-w * 0.3, 0, h)), mat="rubber", segs=6)
            p.cyl(0.008, 0.008, 0.012, Matrix.Translation((0, 0, h)), mat="paint", segs=6)
        elif slot == "core":
            p.ball(0.01, Matrix.Translation((w * 0.3, -0.02, h * 0.92)), mat="glow", segs=(6, 4))
        else:
            p.tube([(w * 0.3, 0, h), (w * 0.35, 0, h + 0.08), (w * 0.5, 0.01, h + 0.14)], 0.003, mat="iron", segs=4)
            p.band(0.03, h * 0.2, m=Matrix.Translation((0, 0, 0)), h=0.03)
    else:  # Ancient rune relay
        w, h = F(p, 0.12), F(p, 0.24)
        if slot == "shell":
            p.box((w, 0.05, h), Matrix.Translation((0, 0, h / 2)), mat="body")
        elif slot == "panel":
            p.box((w * 0.7, 0.01, h * 0.6), Matrix.Translation((0, -0.026, h * 0.5)), mat="stone_dark")
        elif slot == "controls":
            for i in range(3):
                p.box((0.012, 0.008, 0.012), Matrix.Translation((-w * 0.2 + i * w * 0.2, -0.03, h * 0.5)), mat="glow", bevel=0)
            p.box((w * 0.5, 0.008, 0.006), Matrix.Translation((0, -0.03, h * 0.7)), mat="glow", bevel=0)
        elif slot == "core":
            p.ball(0.025, Matrix.Translation((0, 0, h + 0.05)), mat="glow", segs=(8, 6))
        else:
            p.ring(w * 0.6, 0.012, M(loc=(0, 0, 0.01), scale=(1, 0.6, 1)), mat="stone_dark", segs=10)


@function("GameConsole", "Device", DEVICE, "carried")
def game_console(p, slot):
    e = p.era
    if e == "Primal":  # pebble pit board
        L = F(p, 0.36)
        if slot == "shell":
            p.box((L, 0.14, 0.04), Matrix.Translation((0, 0, 0.02)), mat="stone", noise=0.03)
        elif slot == "panel":
            for i in range(6):
                for y in (-0.035, 0.035):
                    p.cyl(0.02, 0.018, 0.004, Matrix.Translation((-L * 0.4 + i * L * 0.16, y, 0.04)), mat="stone_dark", segs=6, bevel=0)
        elif slot == "controls":
            for i in range(5):
                p.ball(0.009, Matrix.Translation((p.rng.uniform(-L / 2, L / 2) * 0.8, p.rng.uniform(-0.04, 0.04), 0.047)), mat="bone", segs=(5, 3))
        elif slot == "core":
            p.ball(0.014, Matrix.Translation((L * 0.47, 0, 0.05)), mat="accent", segs=(6, 4))
        else:
            p.ring(0.02, 0.005, M(loc=(-L * 0.5 - 0.02, 0, 0.02), rot=(90, 0, 0)), mat="rope", segs=8, square=False)
    elif e == "Agrarian":  # dice cup and tray
        if slot == "shell":
            p.box((0.22, 0.16, 0.012), Matrix.Translation((0, 0, 0.006)), mat="wood")
            for x, y, sx, sy in ((0, -0.08, 0.22, 0.01), (0, 0.08, 0.22, 0.01), (-0.11, 0, 0.01, 0.16), (0.11, 0, 0.01, 0.16)):
                p.box((sx, sy, 0.025), Matrix.Translation((x, y, 0.02)), mat="wood", bevel=0)
        elif slot == "panel":
            p.box((0.2, 0.14, 0.003), Matrix.Translation((0, 0, 0.013)), mat="cloth", bevel=0)
        elif slot == "controls":
            for i in range(2):
                p.box((0.016, 0.016, 0.016), M(loc=(-0.03 + i * 0.03, 0.01 * i, 0.022), rot=(0, 0, 20 * i)), mat="bone", bevel=0.25)
        elif slot == "core":
            p.lathe([(0, 0.013), (0.035, 0.013), (0.04, 0.09), (0.042, 0.095)], Matrix.Translation((0.06, 0.0, 0)), mat="bark", segs=10)
        else:
            p.ring(0.041, 0.004, Matrix.Translation((0.06, 0, 0.07)), mat="iron", segs=10)
    elif e == "Mercantile":  # mechanical toy box
        if slot == "shell":
            p.box((0.18, 0.12, 0.1), Matrix.Translation((0, 0, 0.05)), mat="body")
        elif slot == "panel":
            p.box((0.185, 0.125, 0.015), M(loc=(0, 0.04, 0.12), rot=(-J(p, 25, 0.3), 0, 0)), mat="wood")
        elif slot == "controls":
            p.tube([(0.09, 0, 0.05), (0.12, 0, 0.05), (0.12, 0, 0.09)], 0.004, mat="brass", segs=4)
            p.ball(0.01, Matrix.Translation((0.12, 0, 0.095)), mat="wood_dark", segs=(6, 4))
        elif slot == "core":
            p.ball(0.025, Matrix.Translation((0, 0, 0.12)), mat="accent", segs=(8, 6))
            p.cyl(0.006, 0.006, 0.02, Matrix.Translation((0, 0, 0.1)), mat="brass", segs=6, bevel=0)
        else:
            for x in (-0.07, 0.07):
                p.box((0.02, 0.005, 0.02), Matrix.Translation((x, -0.062, 0.08)), mat="brass", bevel=0)
    elif e == "Industrial":  # tabletop pinball
        if slot == "shell":
            p.box((0.2, 0.36, 0.06), M(loc=(0, 0, 0.06), rot=(J(p, 6, 0.3), 0, 0)), mat="paint")
            for x in (-0.09, 0.09):
                p.cyl(0.008, 0.008, 0.05, Matrix.Translation((x, -0.16, 0)), mat="steel", segs=6, bevel=0)
        elif slot == "panel":
            p.box((0.18, 0.34, 0.004), M(loc=(0, 0, 0.092), rot=(6, 0, 0)), mat="glass", bevel=0)
        elif slot == "controls":
            for x in (-0.103, 0.103):
                p.cyl(0.01, 0.012, 0.012, M(loc=(x, -0.12, 0.06), rot=(0, 90 if x > 0 else -90, 0)), mat="rubber", segs=8)
            p.cyl(0.006, 0.006, 0.04, M(loc=(0.07, -0.2, 0.05), rot=(90, 0, 0)), mat="steel", segs=6, bevel=0)
        elif slot == "core":
            for i in range(3):
                p.cyl(0.015, 0.015, 0.02, Matrix.Translation((-0.05 + i * 0.05, 0.08 + (i % 2) * 0.03, 0.07)), mat="accent", segs=8)
        else:
            p.box((0.2, 0.03, 0.12), Matrix.Translation((0, 0.18, 0.12)), mat="paint")
    elif e == "Steampunk":  # clockwork game box with drum reels
        if slot == "shell":
            p.box((0.2, 0.12, 0.14), Matrix.Translation((0, 0, 0.07)), mat="wood_dark")
            p.band(0.1, 0.02, m=M(scale=(1, 0.62, 1)), h=0.02)
        elif slot == "panel":
            p.box((0.15, 0.01, 0.06), Matrix.Translation((0, -0.06, 0.09)), mat="glass", bevel=0)
        elif slot == "controls":
            for i in range(3):
                p.cyl(0.02, 0.02, 0.035, M(loc=(-0.045 + i * 0.045, -0.04, 0.09), rot=(0, 90, 0)), mat="bone", segs=8)
        elif slot == "core":
            p.ball(0.008, Matrix.Translation((0, -0.066, 0.135)), mat="glow", segs=(6, 4))
            p.ball(0.008, Matrix.Translation((0.05, -0.066, 0.135)), mat="glow", segs=(6, 4))
        else:
            p.tube([(0.1, 0, 0.08), (0.13, 0, 0.08)], 0.005, mat="brass", segs=5)
            p.plate([(-0.02, -0.01), (0, 0.03), (0.02, -0.01), (0, 0.0)], 0.006, M(loc=(0.135, 0, 0.08), rot=(0, 0, 90)), mat="brass", bevel=0)
    elif e == "Future":  # handheld
        w = F(p, 0.17)
        if slot == "shell":
            p.box((w, 0.022, 0.08), Matrix.Translation((0, 0, 0.04)), mat="body")
            for x in (-w / 2, w / 2):
                p.cyl(0.04, 0.04, 0.022, M(loc=(x, 0.011, 0.04), rot=(90, 0, 0)), mat="body", segs=12)
        elif slot == "panel":
            p.screen(w * 0.55, 0.055, Matrix.Translation((0, -0.012, 0.042)))
        elif slot == "controls":
            p.cyl(0.009, 0.009, 0.006, M(loc=(-w * 0.52, -0.01, 0.045), rot=(90, 0, 0)), mat="shell_dark", segs=8)
            for i in range(2):
                p.cyl(0.006, 0.006, 0.006, M(loc=(w * 0.48 + i * 0.015, -0.01, 0.05 - i * 0.012), rot=(90, 0, 0)), mat="accent", segs=8)
        elif slot == "core":
            p.box((0.02, 0.003, 0.004), Matrix.Translation((0, -0.012, 0.008)), mat="glow", bevel=0)
        else:
            for x in (-w * 0.35, w * 0.35):
                p.box((0.03, 0.012, 0.008), Matrix.Translation((x, 0.006, 0.082)), mat="shell_dark")
    elif e == "Wasteland":  # patched handheld with strapped battery
        w = F(p, 0.17)
        if slot == "shell":
            p.box((w, 0.03, 0.09), M(loc=(0, 0, 0.045), rot=(0, J(p, 2, 1), 0)), mat="body")
        elif slot == "panel":
            p.box((w * 0.5, 0.004, 0.05), Matrix.Translation((0, -0.016, 0.05)), mat="glass", bevel=0)
            p.box((w * 0.2, 0.004, 0.012), M(loc=(w * 0.12, -0.018, 0.07), rot=(0, 25, 0)), mat="cloth", bevel=0)
        elif slot == "controls":
            p.cyl(0.01, 0.01, 0.008, M(loc=(-w * 0.35, -0.016, 0.05), rot=(90, 0, 0)), mat="paint", segs=6)
            p.cyl(0.007, 0.007, 0.008, M(loc=(w * 0.35, -0.016, 0.05), rot=(90, 0, 0)), mat="rubber", segs=6)
        elif slot == "core":
            p.box((w * 0.45, 0.004, 0.035), Matrix.Translation((0, -0.017, 0.05)), mat="glow_dim", bevel=0)
        else:
            p.cyl(0.018, 0.018, w * 0.7, M(loc=(-w * 0.35, 0.03, 0.05), rot=(0, 90, 0)), mat="paint", segs=8)
            p.band(0.02, 0, m=M(loc=(0, 0.03, 0.05), rot=(0, 90, 0)), h=0.02)
    else:  # Ancient stone handheld with rune screen
        w = F(p, 0.18)
        if slot == "shell":
            p.box((w, 0.03, 0.09), Matrix.Translation((0, 0, 0.045)), mat="body")
        elif slot == "panel":
            p.box((w * 0.5, 0.006, 0.055), Matrix.Translation((0, -0.016, 0.048)), mat="stone_dark", bevel=0)
            p.box((w * 0.38, 0.004, 0.035), Matrix.Translation((0, -0.019, 0.048)), mat="glow", bevel=0)
        elif slot == "controls":
            for x in (-w * 0.38, w * 0.38):
                p.ball(0.012, M(loc=(x, -0.016, 0.048), scale=(1, 0.5, 1)), mat="gold", segs=(6, 4))
        elif slot == "core":
            for i in range(3):
                p.box((0.006, 0.004, 0.006), Matrix.Translation((-0.02 + i * 0.02, -0.016, 0.012)), mat="glow", bevel=0)
        else:
            for x in (-w / 2, w / 2):
                p.box((0.02, 0.034, 0.1), Matrix.Translation((x, 0, 0.045)), mat="stone_dark")


@function("Timepiece", "Device", DEVICE, "carried")
def timepiece(p, slot):
    e = p.era
    if e == "Primal":  # shadow stone
        if slot == "shell":
            p.cyl(J(p, 0.15), 0.14, 0.05, mat="stone", segs=10, noise=0.05)
        elif slot == "panel":
            for i in range(6):
                a = math.pi * (i / 5) + math.pi
                p.box((0.03, 0.006, 0.004), M(loc=(math.cos(a) * 0.1, math.sin(a) * 0.1, 0.052), rot=(0, 0, math.degrees(a))), mat="stone_dark", bevel=0)
        elif slot == "controls":
            for i in range(3):
                p.ball(0.01, Matrix.Translation((p.rng.uniform(-0.1, 0.1), 0.11, 0.05)), mat="bone", segs=(5, 3))
        elif slot == "core":
            p.plate([(0, 0), (0.0, 0.12), (0.06, 0)], 0.012, M(loc=(0, -0.0, 0.05), rot=(0, 0, 90)), mat="stone")
        else:
            p.ring(0.15, 0.006, Matrix.Translation((0, 0, 0.025)), mat="rope", segs=10, square=False)
    elif e == "Agrarian":  # hourglass
        h = F(p, 0.2)
        if slot == "shell":
            for z in (0, h):
                p.cyl(0.06, 0.06, 0.015, Matrix.Translation((0, 0, z)), mat="wood", segs=8)
        elif slot == "panel":
            p.lathe([(0.045, 0.015), (0.04, h * 0.35), (0.008, h * 0.5), (0.04, h * 0.65), (0.045, h)], mat="glass", segs=10)
        elif slot == "controls":
            for i in range(3):
                a = i * math.tau / 3
                p.cyl(0.006, 0.006, h, Matrix.Translation((math.cos(a) * 0.052, math.sin(a) * 0.052, 0.01)), mat="wood", segs=5, bevel=0)
        elif slot == "core":
            p.lathe([(0.035, 0.016), (0.02, 0.04), (0, 0.05)], mat="hide", segs=8)
        else:
            p.ring(0.03, 0.005, M(loc=(0, 0, h + 0.04), rot=(90, 0, 0)), mat="iron", segs=8, square=False)
    elif e == "Mercantile":  # pocket watch
        r = F(p, 0.05, 0.1)
        frame = M(loc=(0, 0, r + 0.01), rot=(90, 0, 0))
        if slot == "shell":
            p.cyl(r, r, 0.016, frame, mat="brass", segs=14)
        elif slot == "panel":
            p.cyl(r * 0.88, r * 0.88, 0.002, frame @ Matrix.Translation((0, 0, -0.002)), mat="bone", segs=14, bevel=0)
            for i in range(4):
                a = i * math.pi / 2
                p.box((0.003, 0.003, 0.008), M(loc=(math.cos(a) * r * 0.75, -0.0045, r + 0.01 + math.sin(a) * r * 0.75)), mat="iron", bevel=0)
        elif slot == "controls":
            p.cyl(0.006, 0.006, 0.012, Matrix.Translation((0, 0, 2 * r + 0.008)), mat="brass", segs=8)
        elif slot == "core":
            p.box((0.002, 0.002, r * 0.7), M(loc=(0.0, -0.005, r + 0.01), rot=(0, 40, 0)), mat="iron", bevel=0)
            p.box((0.002, 0.002, r * 0.5), M(loc=(0.0, -0.005, r + 0.01), rot=(0, -70, 0)), mat="iron", bevel=0)
        else:
            p.ring(0.012, 0.003, M(loc=(0, 0, 2 * r + 0.028), rot=(90, 0, 0)), mat="brass", segs=8, square=False)
            p.tube([(0, 0, 2 * r + 0.04), (0.04, 0, 2 * r + 0.02), (0.07, 0, r)], 0.0025, mat="brass", segs=4)
    elif e == "Industrial":  # alarm clock
        r = F(p, 0.06, 0.1)
        frame = M(loc=(0, 0, r + 0.02), rot=(90, 0, 0))
        if slot == "shell":
            p.cyl(r, r, 0.04, frame @ Matrix.Translation((0, 0, -0.02)), mat="paint", segs=14)
        elif slot == "panel":
            p.cyl(r * 0.85, r * 0.85, 0.003, frame @ Matrix.Translation((0, 0, -0.022)), mat="bone", segs=14, bevel=0)
        elif slot == "controls":
            for x in (-r * 0.6, r * 0.6):
                p.lathe([(0, 0), (r * 0.4, 0.005), (r * 0.42, r * 0.3)], M(loc=(x, 0, 2 * r + 0.01), rot=(180, 0, 0)), mat="steel", segs=10)
            p.box((0.01, 0.004, r * 0.9), Matrix.Translation((0, 0, 2 * r + 0.05)), mat="steel", bevel=0)
        elif slot == "core":
            p.box((0.003, 0.003, r * 0.65), M(loc=(0, -0.025, r + 0.02), rot=(0, 120, 0)), mat="rubber", bevel=0)
        else:
            for x in (-r * 0.6, r * 0.6):
                p.cyl(0.008, 0.004, 0.025, M(loc=(x, 0, 0.02), rot=(180, 0, 0)), mat="steel", segs=6, bevel=0)
    elif e == "Steampunk":  # brass astronomical clock with gears
        if slot == "shell":
            p.box((0.16, 0.1, 0.22), Matrix.Translation((0, 0, 0.11)), mat="wood_dark")
            p.lathe([(0.08, 0.22), (0.07, 0.26), (0, 0.29)], mat="brass", segs=10)
        elif slot == "panel":
            p.cyl(0.06, 0.06, 0.006, M(loc=(0, -0.05, 0.14), rot=(90, 0, 0)), mat="brass", segs=14)
            p.cyl(0.05, 0.05, 0.002, M(loc=(0, -0.056, 0.14), rot=(90, 0, 0)), mat="bone", segs=14, bevel=0)
        elif slot == "controls":
            for x, z, r in ((-0.05, 0.05, 0.022), (0.04, 0.045, 0.016)):
                p.ring(r, 0.005, M(loc=(x, -0.052, z), rot=(90, 0, 0)), mat="copper", segs=8)
        elif slot == "core":
            p.ball(0.014, Matrix.Translation((0, -0.05, 0.25)), mat="glow", segs=(8, 6))
            p.ring(0.025, 0.002, M(loc=(0, -0.05, 0.25), rot=(60, 0, 0)), mat="brass", segs=10, square=False)
        else:
            p.lathe([(0.1, 0), (0.09, 0.015), (0.085, 0.018)], mat="brass", segs=10)
    elif e == "Future":  # wrist projection watch
        if slot == "shell":
            p.box((0.04, 0.012, 0.04), Matrix.Translation((0, 0, 0.03)), mat="body")
        elif slot == "panel":
            p.screen(0.032, 0.032, Matrix.Translation((0, -0.007, 0.03)))
        elif slot == "controls":
            p.cyl(0.004, 0.004, 0.006, M(loc=(0.022, 0, 0.032), rot=(0, 90, 0)), mat="shell_dark", segs=6)
        elif slot == "core":
            p.cyl(0.03, 0.03, 0.002, M(loc=(0, -0.03, 0.07), rot=(70, 0, 0)), mat="glow", segs=14, bevel=0)
        else:
            p.ring(0.03, 0.006, M(loc=(0, 0.012, 0.03), rot=(0, 90, 0), scale=(1.3, 1, 1)), mat="rubber", segs=12)
    elif e == "Wasteland":  # scrap clock
        if slot == "shell":
            p.box((0.13, 0.05, 0.13), M(loc=(0, 0, 0.065), rot=(0, J(p, 3, 1), 0)), mat="body")
        elif slot == "panel":
            p.cyl(0.05, 0.05, 0.004, M(loc=(0, -0.026, 0.065), rot=(90, 0, 0)), mat="bone", segs=10, bevel=0)
        elif slot == "controls":
            p.box((0.004, 0.003, 0.04), M(loc=(0, -0.03, 0.065), rot=(0, 30, 0)), mat="iron", bevel=0)
            p.cyl(0.012, 0.012, 0.02, Matrix.Translation((0.04, 0, 0.13)), mat="paint", segs=6)
        elif slot == "core":
            p.ball(0.01, Matrix.Translation((-0.045, -0.026, 0.12)), mat="glow", segs=(6, 4))
        else:
            p.tube([(-0.065, 0, 0.05), (-0.09, -0.01, 0.1), (-0.07, 0, 0.15)], 0.003, mat="iron", segs=4)
            p.band(0.07, 0.03, m=M(scale=(1, 0.4, 1)), h=0.02)
    else:  # Ancient rune dial
        if slot == "shell":
            p.ring(J(p, 0.1), 0.02, M(loc=(0, 0, 0.13), rot=(90, 0, 0)), mat="body", segs=10)
        elif slot == "panel":
            for i in range(6):
                a = i * math.tau / 6
                p.box((0.012, 0.01, 0.012), Matrix.Translation((math.cos(a) * 0.1, -0.022, 0.13 + math.sin(a) * 0.1)), mat="glow", bevel=0)
        elif slot == "controls":
            p.ring(0.06, 0.005, M(loc=(0, 0, 0.13), rot=(90, 30, 0)), mat="gold", segs=12)
        elif slot == "core":
            p.ball(0.022, Matrix.Translation((0, 0, 0.13)), mat="glow", segs=(8, 6))
        else:
            p.box((0.12, 0.06, 0.03), Matrix.Translation((0, 0, 0.015)), mat="stone_dark")


# ---------------------------------------------------------------- vessels (body, lid, handle, band)
VESSEL = ("body", "lid", "handle", "band")


@function("Barrel", "Vessel", VESSEL, "scene")
def barrel(p, slot):
    e = p.era
    h, r = F(p, 0.9, 0.1), F(p, 0.3, 0.1)
    if slot == "body":
        if e == "Primal":
            p.lathe([(r * 0.9, 0), (r, h * 0.5), (r * 0.92, h)], mat="bark", segs=10, noise=0.03)
        elif e in ("Agrarian", "Mercantile", "Steampunk"):
            p.lathe([(r * 0.85, 0), (r * 1.08, h * 0.5), (r * 0.85, h)], mat="wood" if e != "Mercantile" else "wood_dark", segs=12)
        elif e == "Future":
            p.lathe([(r * 0.8, 0), (r, h * 0.1), (r, h * 0.9), (r * 0.8, h)], mat="body", segs=16)
        elif e == "Ancient":
            p.lathe([(r * 0.7, 0), (r * 1.05, h * 0.3), (r, h * 0.8), (r * 0.75, h)], mat="ceramic", segs=10)
        else:
            p.cyl(r * 0.95, r * 0.95, h, mat="body", segs=12, bevel=0)
            if e == "Wasteland":
                p.box((r * 0.7, 0.02, h * 0.3), M(loc=(0, -r * 0.92, h * 0.6), rot=(0, 8, 0)), mat="iron")
    elif slot == "lid":
        if e == "Primal":
            p.cyl(r * 0.95, r * 0.95, 0.03, Matrix.Translation((0, 0, h)), mat="hide", segs=10, bevel=0)
        elif e == "Future":
            p.lathe([(r * 0.8, h), (r * 0.6, h + 0.06), (0, h + 0.08)], mat="shell_dark", segs=16)
        elif e == "Ancient":
            p.lathe([(r * 0.78, h), (r * 0.5, h + 0.08), (0, h + 0.1)], mat="stone", segs=8)
        else:
            p.cyl(r * 0.84, r * 0.84, 0.015, Matrix.Translation((0, 0, h - 0.01)), mat="metal" if e in ("Industrial", "Wasteland") else "wood", segs=12, bevel=0)
            if e in ("Steampunk", "Industrial"):
                p.cyl(0.03, 0.03, 0.04, Matrix.Translation((r * 0.4, 0, h)), mat="brass" if e == "Steampunk" else "steel", segs=8)
    elif slot == "handle":
        if e in ("Primal", "Agrarian"):
            p.tube([(-r * 0.9, 0, h * 0.85), (0, -r * 0.4, h * 1.15), (r * 0.9, 0, h * 0.85)], 0.012, mat="rope", segs=5)
        elif e == "Mercantile":
            p.cyl(0.025, 0.02, 0.08, M(loc=(0, -r * 1.02, h * 0.2), rot=(90, 0, 0)), mat="brass", segs=8)
        elif e == "Steampunk":
            p.cyl(0.03, 0.03, 0.01, M(loc=(0, -r * 1.07, h * 0.55), rot=(90, 0, 0)), mat="brass", segs=12)
            p.cyl(0.025, 0.025, 0.002, M(loc=(0, -r * 1.085, h * 0.55), rot=(90, 0, 0)), mat="glow", segs=12, bevel=0)
            p.tube([(r * 0.3, -r * 0.9, h), (r * 0.5, -r * 1.1, h * 0.8), (r * 0.5, -r * 1.1, h * 0.3)], 0.012, mat="copper", segs=6)
        elif e == "Future":
            for a in (0, 180):
                p.box((0.08, 0.03, 0.03), M(loc=(0, 0, h * 0.85), rot=(0, 0, a)) @ Matrix.Translation((0, -r - 0.01, 0)), mat="shell_dark")
        elif e == "Ancient":
            for a in (90, 270):
                p.ring(0.05, 0.012, M(loc=(math.cos(math.radians(a)) * 0 + (r if a == 90 else -r), 0, h * 0.7), rot=(0, 90, 0)), mat="stone_dark", segs=8)
        else:
            p.cyl(0.04, 0.04, 0.015, Matrix.Translation((-r * 0.4, 0, h)), mat="steel" if e == "Industrial" else "paint", segs=8)
    else:
        if e == "Future":
            p.ring(r * 1.0, 0.012, Matrix.Translation((0, 0, h * 0.5)), mat="glow", segs=16)
        elif e == "Ancient":
            p.band(r * 1.03, h * 0.35, h=0.08)
        elif e in ("Industrial", "Wasteland"):
            for z in (0.33, 0.66):
                p.ring(r * 0.97, 0.012, Matrix.Translation((0, 0, h * z)), mat="body", segs=12, square=False)
        else:
            zs = (0.12, 0.88) if e != "Mercantile" else (0.1, 0.3, 0.7, 0.9)
            for z in zs:
                rr = r * (0.88 + 0.2 * (1 - abs(z - 0.5) * 2) ** 2 * 0.98)
                p.band(rr if e != "Primal" else r, h * z, h=0.04)


@function("Jar", "Vessel", VESSEL, "scene")
def jar(p, slot):
    e = p.era
    h, r = F(p, 0.42, 0.12), F(p, 0.15, 0.12)
    prof = {
        "Primal": [(0, 0), (r * 0.7, 0.02), (r, h * 0.3), (r * 0.5, h * 0.55), (r * 0.7, h * 0.75), (r * 0.25, h * 0.92), (r * 0.25, h)],
        "Agrarian": [(0, 0), (r * 0.6, 0), (r, h * 0.45), (r * 0.75, h * 0.85), (r * 0.6, h * 0.9), (r * 0.7, h)],
        "Mercantile": [(0, 0), (r * 0.55, 0), (r, h * 0.35), (r * 0.85, h * 0.7), (r * 0.45, h * 0.85), (r * 0.5, h)],
        "Industrial": [(0, 0), (r * 0.9, 0), (r * 0.9, h * 0.85), (r * 0.7, h * 0.92), (r * 0.7, h)],
        "Steampunk": [(0, 0), (r * 0.8, 0), (r, h * 0.2), (r, h * 0.8), (r * 0.7, h * 0.95), (r * 0.7, h)],
        "Future": [(0, 0), (r * 0.8, 0), (r, h * 0.15), (r, h * 0.85), (r * 0.8, h)],
        "Wasteland": [(0, 0), (r * 0.85, 0), (r * 0.85, h * 0.85), (r * 0.65, h * 0.93), (r * 0.65, h)],
        "Ancient": [(0, 0), (r * 0.5, 0), (r * 1.05, h * 0.4), (r * 0.6, h * 0.85), (r * 0.55, h)],
    }[e]
    mat = {"Primal": "bark", "Agrarian": "ceramic", "Mercantile": "glaze", "Industrial": "glass", "Steampunk": "brass",
           "Future": "shell", "Wasteland": "glass", "Ancient": "ceramic"}[e]
    top = prof[-1]
    if slot == "body":
        p.lathe(prof, mat=mat, segs=12)
    elif slot == "lid":
        if e == "Primal":
            p.ball(top[0] * 1.2, Matrix.Translation((0, 0, h + 0.01)), mat="wood", segs=(6, 4))
        elif e in ("Agrarian", "Mercantile", "Ancient"):
            p.lathe([(top[0] * 1.1, h), (top[0] * 0.8, h + 0.04), (0.012, h + 0.05), (0.02, h + 0.07), (0, h + 0.08)], mat="ceramic" if e != "Ancient" else "stone", segs=10)
        elif e == "Future":
            p.lathe([(top[0] * 1.02, h), (top[0], h + 0.03), (0, h + 0.035)], mat="shell_dark", segs=14)
        else:
            p.cyl(top[0] * 1.08, top[0] * 1.08, 0.04, Matrix.Translation((0, 0, h - 0.01)), mat="iron" if e == "Wasteland" else "brass" if e == "Steampunk" else "steel", segs=12)
    elif slot == "handle":
        if e in ("Primal", "Agrarian", "Ancient"):
            for s in (-1, 1):
                p.tube([(s * r * 0.7, 0, h * 0.75), (s * r * 1.15, 0, h * 0.7), (s * r * 0.95, 0, h * 0.5)], 0.012, mat="rope" if e == "Primal" else mat, segs=5)
        elif e == "Steampunk":
            p.cyl(0.012, 0.012, 0.06, Matrix.Translation((0, 0, h + 0.03)), mat="copper", segs=6)
            p.cyl(0.025, 0.025, 0.006, M(loc=(0, -r, h * 0.5), rot=(90, 0, 0)), mat="glow", segs=10, bevel=0)
        elif e == "Future":
            p.box((0.012, 0.005, h * 0.6), Matrix.Translation((0, -r - 0.001, h * 0.5)), mat="glow", bevel=0)
        else:
            p.tube([(-r * 0.7, 0, h * 0.95), (0, -r * 0.3, h * 1.15), (r * 0.7, 0, h * 0.95)], 0.004, mat="iron", segs=4)
    else:
        if e == "Future":
            p.ring(r, 0.008, Matrix.Translation((0, 0, h * 0.15)), mat="shell_dark", segs=14)
        elif e in ("Mercantile", "Ancient"):
            p.band(r * 0.98, h * 0.35, h=0.05)
        elif e == "Wasteland":
            p.box((r * 0.9, 0.003, h * 0.3), Matrix.Translation((0, -r * 0.86, h * 0.45)), mat="paint", bevel=0)
        else:
            p.ring(top[0] * 1.05, 0.008 if e != "Primal" else 0.01, Matrix.Translation((0, 0, h * 0.93)), mat="rope" if e in ("Primal", "Agrarian") else "fit", segs=10, square=False)


@function("Crate", "Vessel", VESSEL, "scene")
def crate(p, slot):
    e = p.era
    s = F(p, 0.6, 0.1)
    if slot == "body":
        if e == "Primal":
            for x in (-1, 1):
                for y in (-1, 1):
                    p.tube([(x * s / 2, y * s / 2, 0), (x * s / 2 * 0.95, y * s / 2 * 0.95, s)], 0.02, mat="body", segs=5)
            for z in (0.05, 0.5, 0.95):
                for a in range(4):
                    c = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
                    (x0, y0), (x1, y1) = c[a], c[(a + 1) % 4]
                    p.tube([(x0 * s / 2, y0 * s / 2, z * s), (x1 * s / 2, y1 * s / 2, z * s)], 0.012, mat="body", segs=4)
        elif e == "Future":
            p.box((s, s, s * 0.8), Matrix.Translation((0, 0, s * 0.4)), mat="body")
        elif e == "Ancient":
            p.box((s, s * 0.7, s * 0.6), Matrix.Translation((0, 0, s * 0.3)), mat="stone")
        elif e in ("Industrial", "Steampunk"):
            p.box((s, s, s), Matrix.Translation((0, 0, s / 2)), mat="wood" if e == "Industrial" else "iron")
        else:
            for i in range(4):
                p.box((s, s, s * 0.235), Matrix.Translation((0, 0, s * (0.12 + i * 0.25))), mat="wood", bevel=0.04, noise=0.004 if e == "Wasteland" else 0)
            if e == "Wasteland":
                p.box((s * 0.5, 0.01, s * 0.4), M(loc=(s * 0.15, -s / 2 - 0.006, s * 0.55), rot=(0, 7, 0)), mat="rust")
    elif slot == "lid":
        if e == "Primal":
            p.box((s * 1.02, s * 1.02, 0.02), Matrix.Translation((0, 0, s)), mat="hide", bevel=0)
        elif e == "Future":
            p.box((s * 1.01, s * 1.01, s * 0.2), Matrix.Translation((0, 0, s * 0.9)), mat="shell_dark")
        elif e == "Ancient":
            p.box((s * 1.05, s * 0.75, s * 0.15), Matrix.Translation((0, 0, s * 0.67)), mat="stone_dark")
        else:
            p.box((s * 1.02, s * 1.02, 0.03), Matrix.Translation((0, 0, s + 0.015)), mat="wood_dark" if e != "Steampunk" else "brass")
    elif slot == "handle":
        if e == "Future":
            for x in (-s / 2, s / 2):
                p.box((0.02, s * 0.3, 0.04), Matrix.Translation((x, 0, s * 0.6)), mat="shell_dark")
        elif e == "Ancient":
            for x in (-s / 2, s / 2):
                p.ring(0.05, 0.012, M(loc=(x * 1.04, 0, s * 0.35), rot=(0, 90, 0)), mat="stone_dark", segs=8)
        elif e == "Primal":
            p.tube([(-s * 0.3, -s / 2, s * 0.7), (0, -s / 2 - 0.05, s * 0.6), (s * 0.3, -s / 2, s * 0.7)], 0.012, mat="rope", segs=4)
        else:
            for x in (-s / 2, s / 2):
                p.tube([(x * 1.02, -0.08, s * 0.7), (x * 1.08, 0, s * 0.68), (x * 1.02, 0.08, s * 0.7)], 0.01, mat="iron" if e != "Mercantile" else "brass", segs=5)
    else:
        if e == "Future":
            p.box((s * 1.005, s * 1.005, 0.01), Matrix.Translation((0, 0, s * 0.45)), mat="glow", bevel=0)
        elif e == "Ancient":
            p.box((s * 0.6, 0.01, 0.02), Matrix.Translation((0, -s * 0.355, s * 0.35)), mat="glow", bevel=0)
        elif e == "Primal":
            for z in (0.05, 0.5, 0.95):
                for x in (-1, 1):
                    for y in (-1, 1):
                        p.ball(0.03, Matrix.Translation((x * s / 2, y * s / 2, z * s)), mat="rope", segs=(5, 3))
        else:
            for x in (-1, 1):
                for y in (-1, 1):
                    p.box((0.05, 0.05, s), Matrix.Translation((x * (s / 2 - 0.02), y * (s / 2 - 0.02), s / 2)), mat="fit" if e != "Agrarian" else "wood_dark", bevel=0.1)
            if e in ("Industrial", "Steampunk"):
                for z in (0.25, 0.75):
                    for x in (-s * 0.25, s * 0.25):
                        p.ball(0.012, Matrix.Translation((x, -s / 2 - 0.003, s * z)), mat="copper" if e == "Steampunk" else "steel", segs=(6, 4))
