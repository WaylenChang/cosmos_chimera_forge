"""Key poses in metres on the 1.66 m shared rig, facing Blender -Y."""

from dataclasses import dataclass, replace
from math import cos, sin, tau


@dataclass(frozen=True)
class Hand:
    wrist: tuple[float, float, float]
    fingers: tuple[float, float, float]
    dorsal: tuple[float, float, float]
    curl: tuple[float, float, float, float, float]


RELAXED = (.18, .22, .29, .33, .39)
GRIP = (.48, .70, .80, .85, .86)
CUP = (.22, .22, .29, .36, .45)
OPEN = (.10, .04, .06, .09, .15)
POINT = (.26, .02, .78, .82, .85)
PET = (.20, .08, .12, .31, .42)
PINCH = (.45, .40, .66, .74, .79)


def hand(x, y, z, fingers=(0, -.85, -.22), dorsal=(0, 0, 1), curl=RELAXED):
    return Hand((x, y, z), fingers, dorsal, curl)


@dataclass(frozen=True)
class Pose:
    left: Hand = hand(.208, -.035, .915, (.12, -.14, -1), (0, -1, 0))
    right: Hand = hand(-.208, -.048, .92, (-.12, -.14, -1), (0, -1, 0))
    hip: tuple[float, float, float] = (0., .015, -.045)
    body: tuple[float, float, float] = (1., 0., 0.)
    gaze: tuple[float, float, float] = (0., 0., 0.)


IDLE = Pose()


@dataclass(frozen=True)
class Sequence:
    poses: tuple[tuple[int, Pose], ...]
    beats: tuple[tuple[int, str], ...]
    seated: bool = False
    airborne: bool = False
    min_wrist_travel: float = .09


def stride(frame):
    phase = tau * (frame - 1) / 23
    surge = sin(phase)
    rise = cos(phase * 2 - .35)
    roll = cos(phase)
    return Pose(
        left=hand(.132 + .008 * roll, -.344 - .019 * surge, 1.054 + .022 * rise,
                  (.04, -.88, -.27), (-.9, .03, .12), GRIP),
        right=hand(-.143 + .008 * roll, -.335 - .019 * surge, 1.055 + .022 * rise,
                   (-.02, -.88, -.25), (.9, .04, .16), GRIP),
        hip=(.014 * roll, .006 * surge, -.225 + .022 * rise),
        body=(19 + 3.5 * surge, -2.8 * roll, 2.5 * surge),
        gaze=(-13 - 1.8 * surge, 1.5 * roll, -1.4 * surge),
    )


def attack():
    guard = hand(.236, -.222, 1.112, (-.21, -.67, .33), (.7, -.06, .7), GRIP)
    windup = replace(IDLE, left=guard,
                     right=hand(-.342, -.202, 1.31, (-.14, -.73, .63), (-.64, -.13, .71), GRIP),
                     hip=(-.036, .04, -.07), body=(2, -4, -9), gaze=(-3, 2, 7))
    release = replace(IDLE, left=hand(.226, -.16, 1.115, (-.28, -.66, .34), (.4, -.3, .8), GRIP),
                      right=hand(-.225, -.437, 1.392, (.04, -.98, .10), (0, .03, 1), POINT),
                      hip=(.012, -.065, -.081), body=(11, -3, 16), gaze=(-8, 1, -8))
    follow = replace(release, right=hand(-.242, -.397, 1.361, (.02, -.96, -.14), (0, 0, 1), POINT),
                     hip=(.018, -.05, -.073), body=(8, -2, 12), gaze=(-6, 0, -6))
    recover = replace(IDLE, left=guard,
                      right=hand(-.182, -.26, 1.10, (.18, -.62, .42), (.35, 0, .9), RELAXED),
                      body=(4, -1, 6))
    return Sequence(((1, IDLE), (6, windup), (10, release), (13, follow), (18, recover), (24, IDLE)),
                    ((6, "Prepare"), (10, "Signal"), (18, "Recover")))


def overload():
    charge = Pose(
        left=hand(.128, -.269, 1.16, (-.40, -.16, .85), (.9, .03, .3), CUP),
        right=hand(-.134, -.26, 1.155, (.40, -.15, .85), (-.9, -.01, .3), CUP),
        hip=(0., .019, -.102), body=(12, 0, 3), gaze=(9, 0, 0),
    )
    rise = replace(charge,
                   left=hand(.107, -.288, 1.306, (-.41, -.31, .86), (.83, .02, .25), OPEN),
                   right=hand(-.108, -.285, 1.30, (.43, -.32, .83), (-.83, .02, .25), OPEN),
                   hip=(0., 0., -.074), body=(6, 0, 0), gaze=(0, 0, 0))
    pulse = replace(rise,
                    left=hand(.267, -.316, 1.408, (.47, -.24, .78), (.20, .87, .14), OPEN),
                    right=hand(-.272, -.319, 1.416, (-.48, -.26, .80), (-.15, .88, .16), OPEN),
                    hip=(0., -.028, -.046), body=(-1, 0, 0), gaze=(-3, 0, 0))
    soften = replace(pulse,
                     left=hand(.238, -.274, 1.305, (.45, -.27, .60), (.16, .96, .10), CUP),
                     right=hand(-.24, -.265, 1.305, (-.5, -.30, .61), (-.16, .95, .10), CUP))
    return Sequence(((1, IDLE), (6, charge), (10, rise), (14, pulse), (20, soften), (30, IDLE)),
                    ((6, "Charge"), (14, "Open symbol"), (20, "Settle")))


def summon():
    ready = replace(IDLE,
                    left=hand(.16, -.237, 1.125, (-.25, -.89, .05), (0, .02, -1), CUP),
                    right=hand(-.155, -.235, 1.235, (.24, -.62, .47), (-.89, -.31, .12), PINCH),
                    hip=(-.008, .026, -.075), body=(7, -4, -12), gaze=(12, 2, 8))
    gather = replace(ready,
                     left=hand(.065, -.290, 1.17, (-.31, -.85, .10), (0, 0, -1), CUP),
                     right=hand(-.118, -.253, 1.308, (.15, -.70, .35), (-.85, -.04, -.52), PINCH),
                     body=(6, -3, -6), gaze=(10, 0, 5))
    present = Pose(
        left=hand(.202, -.281, 1.097, (-.14, -.86, .09), (-.1, -.03, -1), OPEN),
        right=hand(-.165, -.413, 1.312, (.21, -.94, .28), (.1, -.17, -.91), CUP),
        hip=(.013, -.05, -.072), body=(10, -2, 14), gaze=(-4, 0, -9),
    )
    hold = replace(present,
                   right=hand(-.162, -.385, 1.258, (.19, -.92, .23), (.08, -.14, -.94), OPEN),
                   body=(7, -1, 8), gaze=(3, 0, -4))
    return Sequence(((1, IDLE), (9, ready), (13, gather), (18, present), (24, hold), (36, IDLE)),
                    ((9, "Prepare focus"), (18, "Present focus"), (24, "Lower focus")))


def recall():
    seek = replace(IDLE,
                   left=hand(.176, -.207, 1.08, (-.20, -.84, .16), (0, -.10, -1), CUP),
                   right=hand(-.254, -.367, 1.355, (.02, -.20, .97), (.08, .95, .21), OPEN),
                   hip=(-.014, -.028, -.069), body=(8, -1, 9), gaze=(-3, 0, -6))
    collect = replace(seek,
                      left=hand(.139, -.244, 1.114, (-.14, -.88, .10), (.06, 0, -1), CUP),
                      right=hand(-.181, -.279, 1.278, (.32, -.27, .78), (.14, .92, .28), CUP),
                      hip=(-.028, .018, -.058), body=(3, -3, -3), gaze=(5, 2, 4))
    stow = replace(collect,
                   right=hand(-.122, -.181, 1.166, (.39, -.35, .49), (-.3, .72, .39), GRIP),
                   body=(1, -2, -8), gaze=(10, 2, 5))
    return Sequence(((1, IDLE), (9, seek), (11, seek), (14, collect), (20, stow), (30, IDLE)),
                    ((9, "Reach"), (14, "Gather"), (20, "Stow")))


def backpack():
    strap = Pose(
        left=hand(.177, -.166, 1.174, (-.06, -.78, .62), (.82, .05, .34), GRIP),
        right=hand(-.233, -.146, 1.235, (.15, -.50, .75), (-.73, -.57, .22), GRIP),
        hip=(-.018, .025, -.075), body=(9, -3, -17), gaze=(-5, 4, -7),
    )
    swing = Pose(
        left=hand(.105, -.289, 1.02, (-.20, -.88, .09), (.16, -.03, -1), CUP),
        right=hand(-.382, -.126, 1.134, (.24, -.46, -.69), (-.38, -.56, .60), GRIP),
        hip=(-.034, .012, -.087), body=(10, -5, -9), gaze=(12, -3, -10),
    )
    brace = hand(.175, -.301, 1.059, (-.59, -.45, .15), (.62, .13, -.70), GRIP)
    front = Pose(
        left=brace, right=hand(-.141, -.292, 1.154, (.31, -.42, -.71), (0, -.82, .50), PINCH),
        hip=(.026, .018, -.102), body=(16, 2, 2), gaze=(13, 0, -2),
    )
    search_in = replace(front,
                        right=hand(-.063, -.338, 1.02, (.37, -.15, -.89), (-.57, -.66, .11), CUP),
                        gaze=(17, -3, 0))
    search_across = replace(front,
                            right=hand(.008, -.292, 1.094, (-.14, -.46, -.83), (.40, -.70, .40), PINCH),
                            gaze=(18, 4, 4))
    return Sequence(((1, IDLE), (8, strap), (15, swing), (22, front), (28, search_in),
                     (33, search_across), (39, front), (46, swing), (53, strap), (60, IDLE)),
                    ((8, "Take strap"), (15, "Swing around"), (22, "Open"), (33, "Search"),
                     (39, "Close"), (53, "Return to back")))


def handbook():
    support = hand(.151, -.311, 1.112, (-.52, -.74, .07), (.23, 0, -1), CUP)
    read = Pose(
        left=support, right=hand(-.183, -.299, 1.124, (.44, -.72, .09), (-.11, -.08, -1), CUP),
        hip=(.010, .014, -.051), body=(6, 1, 0), gaze=(18, 0, -3),
    )
    pinch = replace(read, right=hand(-.192, -.351, 1.19, (.49, -.40, -.44), (-.11, -.10, .94), PINCH),
                    gaze=(20, -2, -4))
    flip = replace(read, right=hand(-.037, -.31, 1.278, (.59, -.35, -.46), (-.35, -.43, .79), PINCH),
                   gaze=(16, 1, 1), body=(6, 1, 3))
    land = replace(read, right=hand(.089, -.299, 1.178, (.49, -.32, -.68), (-.13, -.19, .95), POINT),
                   gaze=(20, 4, 6), body=(6, 1, 4))
    return Sequence(((1, read), (6, read), (14, pinch), (23, flip), (30, land),
                     (36, land), (49, read), (60, read)),
                    ((14, "Pinch page"), (23, "Turn page"), (30, "Lay page flat")))


def revive():
    kneel = Pose(
        left=hand(.229, -.194, .805, (-.12, -.69, -.40), (.10, .74, .61), CUP),
        right=hand(-.210, -.187, .813, (.14, -.70, -.45), (-.15, .76, .59), CUP),
        hip=(-.028, .062, -.266), body=(30, -4, -8), gaze=(19, 2, 6),
    )
    focus = replace(kneel,
                    left=hand(.131, -.344, .788, (-.32, -.67, -.35), (.37, .01, .93), CUP),
                    right=hand(-.113, -.343, .830, (.20, -.78, -.33), (-.42, .02, .91), CUP),
                    body=(31, -2, -3), gaze=(21, 0, 3))
    pulse = replace(focus,
                    left=hand(.192, -.426, .716, (.08, -.85, -.33), (.12, -.09, 1), OPEN),
                    right=hand(-.181, -.424, .720, (-.07, -.86, -.32), (-.11, -.10, 1), OPEN),
                    body=(37, -1, 1), gaze=(18, 0, 0),
                    hip=(-.012, .021, -.285))
    lift = replace(kneel,
                   left=hand(.202, -.278, .82, (-.13, -.87, -.25), (.02, -.10, 1), RELAXED),
                   right=hand(-.203, -.273, .817, (.12, -.87, -.23), (-.02, -.10, 1), RELAXED),
                   body=(23, -2, 3), gaze=(14, 1, -2))
    return Sequence(((1, IDLE), (8, kneel), (18, focus), (28, pulse), (35, pulse),
                     (44, lift), (54, IDLE)),
                    ((8, "Lower stance"), (18, "Gather light"), (28, "Revive"),
                     (44, "Withdraw hands")))


def pet_xs():
    support = hand(.179, -.285, 1.17, (-.50, -.84, .04), (-.03, .02, -1), CUP)
    brace = replace(IDLE, left=support, hip=(.017, .01, -.058), body=(5, 2, 2), gaze=(17, 6, 4))
    hover = replace(brace,
                    right=hand(-.056, -.350, 1.319, (.87, -.07, -.23), (.06, -.02, 1), PET))
    touch = replace(hover,
                    right=hand(.016, -.359, 1.269, (.88, -.06, -.20), (.06, -.06, 1), PET),
                    gaze=(22, 5, 3))
    stroke = replace(touch,
                     right=hand(.025, -.374, 1.267, (.80, .14, -.25), (.05, .12, 1), PET))
    brush_again = replace(stroke,
                          right=hand(.015, -.365, 1.289, (.83, -.03, -.19), (.04, -.04, 1), PET))
    return Sequence(((1, IDLE), (12, brace), (20, hover), (27, touch), (30, stroke),
                     (35, brush_again), (41, touch), (46, hover), (60, IDLE)),
                    ((12, "Support palm"), (27, "First touch"), (30, "Stroke"), (46, "Withdraw")))


def pet_l():
    approach = Pose(
        left=hand(.230, -.138, .99, (-.03, -.58, -.63), (0, -.8, .65), RELAXED),
        right=hand(-.223, -.277, 1.318, (-.12, -.73, .40), (-.03, .74, .60), OPEN),
        hip=(-.017, -.024, -.05), body=(7, -3, 7), gaze=(-8, -4, -5),
    )
    high = replace(approach,
                   right=hand(-.236, -.354, 1.493, (-.08, -.31, .92), (-.07, .94, .32), PET),
                   hip=(-.023, -.045, -.053), body=(8, -4, 10), gaze=(-12, -4, -7))
    touch = replace(high,
                    right=hand(-.217, -.373, 1.448, (-.04, -.32, .91), (-.07, .94, .32), PET),
                    gaze=(-10, -2, -4))
    stroke = replace(touch,
                     right=hand(-.211, -.389, 1.345, (.05, -.42, .83), (-.03, .90, .49), PET),
                     body=(9, -3, 9), gaze=(-5, -2, -4))
    return Sequence(((1, IDLE), (11, approach), (19, high), (24, touch), (30, touch),
                     (36, stroke), (44, touch), (51, approach), (60, IDLE)),
                    ((19, "Reach neck"), (24, "Contact"), (30, "Stroke"), (51, "Withdraw")))


def pet_xl():
    lift = Pose(
        left=hand(.243, -.251, 1.291, (-.23, -.20, .88), (.24, .91, .23), OPEN),
        right=hand(-.238, -.252, 1.323, (.23, -.23, .87), (-.22, .92, .20), OPEN),
        hip=(.002, -.02, -.056), body=(5, 0, -1), gaze=(-6, 0, 0),
    )
    steady = replace(lift,
                     left=hand(.283, -.350, 1.449, (-.30, -.31, .87), (.48, .81, .32), PET),
                     right=hand(-.281, -.356, 1.475, (.30, -.31, .85), (-.48, .81, .32), PET),
                     hip=(-.009, -.047, -.063), body=(9, -1, 1), gaze=(-11, 0, 0))
    touch = replace(steady,
                    left=hand(.262, -.372, 1.451, (-.29, -.27, .86), (.52, .78, .22), PET),
                    right=hand(-.266, -.372, 1.390, (.28, -.27, .86), (-.51, .78, .23), PET),
                    body=(10, -2, 3), gaze=(-7, -2, 3))
    stroke = replace(touch,
                     left=hand(.259, -.371, 1.380, (-.26, -.33, .87), (.53, .76, .24), PET),
                     right=hand(-.267, -.373, 1.462, (.28, -.29, .85), (-.50, .78, .21), PET),
                     body=(9, 2, -2), gaze=(-7, 2, -3))
    return Sequence(((1, IDLE), (13, lift), (25, steady), (36, touch), (44, stroke),
                     (53, touch), (63, lift), (72, IDLE)),
                    ((13, "Lift hands"), (25, "Contact sides"), (36, "Start strokes"),
                     (53, "Last stroke"), (63, "Withdraw")))


ACTIONS = {
    "chr_mount_run": Sequence(tuple((frame, stride(frame)) for frame in range(1, 25)),
                              ((1, "Stride start"), (7, "Follow saddle"), (13, "Second beat"),
                               (19, "Recover saddle")), seated=True),
    "chr_command_attack": attack(),
    "chr_command_overload": overload(),
    "chr_summon": summon(),
    "chr_recall": recall(),
    "chr_backpack_open": backpack(),
    "chr_handbook_open": handbook(),
    "chr_revive_ally": revive(),
    "chr_pet_xs": pet_xs(),
    "chr_pet_l": pet_l(),
    "chr_pet_xl": pet_xl(),
}

