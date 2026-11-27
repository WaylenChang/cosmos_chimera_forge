"""Pose plans for the 21 actions with existing motion references."""

from dataclasses import replace
from math import cos, sin, tau

from shared_action_poses import CUP, GRIP, OPEN, PET, PINCH, POINT, RELAXED, IDLE, Pose, Sequence, hand


def stance(left=None, right=None, *, hip=(0, .015, -.056), body=(3, 0, 0), gaze=(0, 0, 0)):
    return Pose(left or IDLE.left, right or IDLE.right, hip, body, gaze)


def clip(*keys, seated=False, airborne=False, min_wrist_travel=.09):
    poses = tuple((frame, pose) for frame, pose, _ in keys)
    beats = tuple((frame, label) for frame, _, label in keys if label)
    return Sequence(poses, beats, seated, airborne, min_wrist_travel)


def both(x, y, z, fingers=(0, -.86, -.20), dorsal=(0, 0, 1), curl=RELAXED):
    return hand(x, y, z, fingers, dorsal, curl), hand(-x, y, z, fingers, dorsal, curl)


def idle_long():
    center = stance(body=(1, 0, 0))
    left = replace(center, left=hand(.215, -.048, .928, (.12, -.21, -1), (0, -1, 0)),
                   hip=(.022, .018, -.049), body=(2, 1.7, 1.2), gaze=(-1, -.8, -.7))
    right = replace(center, right=hand(-.218, -.055, .929, (-.10, -.21, -1), (0, -1, 0)),
                    hip=(-.021, .016, -.062), body=(1.7, -1.8, -.7), gaze=(1, .8, .5))
    return clip((1, center, "Settle"), (29, left, "Inhale"), (60, center, "Center"),
                (91, right, "Exhale"), (120, center, "Settle"), min_wrist_travel=.008)


def glide():
    level = stance(
        hand(.548, -.19, 1.633, (.52, -.77, .1), (0, .14, .96), GRIP),
        hand(-.548, -.19, 1.633, (-.52, -.77, .1), (0, .14, .96), GRIP),
        hip=(0, .065, .18), body=(16, 0, 0), gaze=(-13, 0, 0),
    )
    left = replace(level, left=replace(level.left, wrist=(.525, -.215, 1.646)),
                   right=replace(level.right, wrist=(-.544, -.165, 1.594)),
                   hip=(.017, .07, .192), body=(18, 3.2, 2), gaze=(-14, -1.5, -1))
    right = replace(level, left=replace(level.left, wrist=(.544, -.165, 1.599)),
                    right=replace(level.right, wrist=(-.529, -.213, 1.642)),
                    hip=(-.015, .061, .178), body=(15, -3.5, -2), gaze=(-12, 1.8, 1))
    return clip((1, level, "Level"), (12, left, "Trim left"), (23, level, "Center"),
                (34, right, "Trim right"), (45, level, "Level"), airborne=True, min_wrist_travel=.02)


def mount_idle():
    def rein(x, y, z):
        return hand(x, y, z, (0, -.88, -.34), (1 if x < 0 else -1, .05, .1), GRIP)
    center = stance(rein(.132, -.304, 1.046), rein(-.137, -.300, 1.039),
                    hip=(0, .028, -.22), body=(10, 0, 0), gaze=(-6, 0, 0))
    inhale = replace(center, left=rein(.14, -.316, 1.060), right=rein(-.143, -.312, 1.053),
                     hip=(.009, .024, -.212), body=(11, 1.1, .8), gaze=(-7, .4, -.5))
    exhale = replace(center, left=rein(.128, -.294, 1.039), right=rein(-.132, -.29, 1.033),
                     hip=(-.007, .03, -.227), body=(9, -.8, -.5), gaze=(-5, -.4, .5))
    return clip((1, center, "Set on saddle"), (18, inhale, "Inhale"), (34, center, "Center"),
                (47, exhale, "Exhale"), (60, center, "Set on saddle"), seated=True, min_wrist_travel=.009)


def command_point():
    ready = stance(right=hand(-.213, -.20, 1.218, (.12, -.76, .51), (-.60, .01, .80), POINT),
                   hip=(-.018, .015, -.056), body=(3, -2, -3), gaze=(-3, 0, 3))
    point = stance(right=hand(-.193, -.415, 1.318, (.07, -.995, .07), (-.10, 0, .99), POINT),
                   hip=(.006, -.034, -.054), body=(9, -2, 10), gaze=(-6, 0, -5))
    hold = replace(point, right=replace(point.right, wrist=(-.184, -.41, 1.32)))
    return clip((1, IDLE, "Neutral"), (6, ready, "Prepare index"), (10, point, "Point"),
                (15, hold, "Hold direction"), (20, ready, "Retract"), (24, IDLE, ""))


def command_recall():
    raised = stance(right=hand(-.276, -.282, 1.357, (-.11, -.19, .95), (-.25, .96, .15), OPEN),
                    body=(7, -3, 5), gaze=(-6, -1, -2))
    beckon = replace(raised, right=hand(-.216, -.264, 1.346, (.30, .11, .94), (-.18, .98, -.08),
                                           (.15, .37, .40, .43, .52)),
                     hip=(-.016, .031, -.074), body=(2, -3, -3))
    draw = replace(beckon, right=hand(-.166, -.225, 1.225, (.38, -.28, .84), (-.33, .91, .20), CUP))
    return clip((1, IDLE, "Neutral"), (7, raised, "Open palm"), (10, beckon, "Beckon back"),
                (15, draw, "Draw inward"), (24, IDLE, ""))


def item_self():
    support = hand(.158, -.243, 1.105, (-.42, -.80, .08), (0, .08, -1), CUP)
    grip = stance(support, hand(-.175, -.208, 1.10, (.19, -.78, .41), (-.7, -.22, .55), GRIP),
                  body=(5, -1, -4), gaze=(13, 0, 4))
    align = replace(grip, right=hand(-.123, -.254, 1.265, (.34, -.67, .56), (-.74, -.12, .36), GRIP),
                    gaze=(7, -2, 0))
    use = replace(align, right=hand(-.073, -.224, 1.397, (.18, -.64, .63), (-.75, .12, .4), GRIP),
                  body=(1, 1, 3), gaze=(-8, -2, -4))
    return clip((1, IDLE, "Neutral"), (9, grip, "Retrieve"), (16, align, "Raise"),
                (24, use, "Use on self"), (29, use, "Hold"), (33, grip, "Lower"), (40, IDLE, ""))


def item_other():
    ready = stance(hand(.171, -.241, 1.096, (-.42, -.81, .12), (-.09, .03, -1), CUP),
                   hand(-.176, -.24, 1.19, (.27, -.76, .42), (-.69, -.22, .57), GRIP),
                   body=(5, -3, -5), gaze=(8, 0, 1))
    offer = replace(ready, right=hand(-.13, -.437, 1.21, (.15, -.95, .21), (-.35, .12, -.91), OPEN),
                    left=hand(.192, -.253, 1.097, (-.30, -.86, .11), (-.08, .03, -1), RELAXED),
                    hip=(.008, -.050, -.073), body=(10, -1, 9), gaze=(3, 0, -5))
    carry = replace(offer, right=replace(offer.right, curl=GRIP))
    return clip((1, IDLE, "Neutral"), (9, ready, "Prepare item"), (16, carry, "Offer"),
                (20, offer, "Release to partner"), (29, ready, "Withdraw"), (40, IDLE, ""))


def place_action(trap=False):
    grip = stance(*both(.155, -.288, 1.032, (0, -.91, -.24), (0, .10, .98), GRIP),
                  hip=(-.017, .048, -.102), body=(12, -2, 2), gaze=(14, 0, 0))
    down = stance(*both(.174, -.375, .573, (0, -.67, -.63), (0, -.37, .94), GRIP),
                  hip=(-.012, .072, -.326), body=(42, -1, 1), gaze=(19, 0, 0))
    place = stance(
        hand(.171, -.362 if trap else -.392, .352 if trap else .419, (-.13, -.81, -.39), (.18, -.27, .94), OPEN),
        hand(-.168, -.363 if trap else -.389, .350 if trap else .416, (.13, -.81, -.39), (-.18, -.27, .94), OPEN),
        hip=(-.011, .029, -.479 if trap else -.446), body=(57 if trap else 52, -1, 0), gaze=(22, 0, 0),
    )
    hands_clear = replace(place, left=replace(place.left, wrist=(.205, -.390, .47)),
                          right=replace(place.right, wrist=(-.205, -.386, .47)))
    if trap:
        return clip((1, IDLE, "Neutral"), (7, grip, "Unfold trap"), (15, down, "Lower"),
                    (22, place, "Seat trap"), (28, hands_clear, "Clear fingers"),
                    (34, grip, "Stand"), (40, IDLE, ""))
    return clip((1, IDLE, "Neutral"), (9, grip, "Hold beacon"), (20, down, "Lower"),
                (30, place, "Set beacon"), (36, hands_clear, "Clear fingers"),
                (43, grip, "Stand"), (48, IDLE, ""))


def throw_card():
    prep = stance(
        hand(.203, -.188, 1.046, (-.14, -.63, -.71), (-.12, -.91, .27), CUP),
        hand(-.252, -.25, 1.211, (.03, -.84, .46), (-.66, .10, .75), PINCH),
        hip=(-.024, .021, -.062), body=(5, -4, -10), gaze=(1, 1, 8))
    cross = replace(prep, right=hand(-.113, -.288, 1.243, (.49, -.76, .27), (-.23, .15, .95), PINCH))
    release = replace(prep, right=hand(-.23, -.451, 1.294, (.08, -.96, .22), (-.06, .12, .98), (.20, .06, .12, .74, .84)),
                      hip=(.012, -.05, -.079), body=(10, -2, 15), gaze=(-4, 0, -9))
    follow = replace(release, right=replace(release.right, wrist=(-.288, -.411, 1.253)))
    return clip((1, IDLE, "Neutral"), (6, prep, "Pinch card"), (8, cross, "Wind wrist"),
                (12, release, "Release card"), (16, follow, "Follow through"), (24, IDLE, ""))


def throw_bead():
    prep = stance(right=hand(-.264, -.175, 1.083, (.24, -.93, .10), (0, 0, -1), PINCH),
                  hip=(-.029, .028, -.075), body=(5, -4, -8), gaze=(8, 1, 5))
    back = replace(prep, right=hand(-.318, -.066, .943, (-.12, -.91, -.25), (-.26, .1, -.95), CUP),
                   body=(2, -4, -12))
    release = replace(prep, right=hand(-.214, -.441, 1.141, (.12, -.87, .41), (-.08, .09, -.99), OPEN),
                      hip=(.014, -.060, -.081), body=(13, -1, 11), gaze=(0, 0, -7))
    follow = replace(release, right=replace(release.right, wrist=(-.205, -.392, 1.229)))
    return clip((1, IDLE, "Neutral"), (8, prep, "Cup bead"), (10, back, "Swing low"),
                (15, release, "Underhand release"), (20, follow, "Follow through"), (28, IDLE, ""))


def throw_cube():
    set_cube = stance(
        hand(.111, -.305, 1.108, (-.32, -.83, .18), (-.15, .02, -1), CUP),
        hand(-.141, -.283, 1.172, (.31, -.69, .36), (-.55, .06, .84), PINCH),
        body=(6, -2, -7), gaze=(14, 1, 4))
    rotate = replace(set_cube,
                     right=hand(-.17, -.293, 1.203, (.34, -.62, .54), (-.6, -.38, .62), GRIP),
                     left=replace(set_cube.left, wrist=(.121, -.313, 1.111)))
    load = stance(hand(.179, -.198, 1.08, (-.21, -.87, .14), (0, 0, -1), RELAXED),
                  hand(-.334, -.225, 1.429, (.03, -.65, .73), (-.6, .4, .7), GRIP),
                  hip=(-.028, .035, -.067), body=(3, -4, -9), gaze=(-5, 1, 6))
    release = replace(load, right=hand(-.206, -.401, 1.425, (.22, -.96, -.12), (-.04, -.10, .99), OPEN),
                      hip=(.018, -.056, -.084), body=(12, -2, 14), gaze=(-6, 1, -9))
    follow = replace(release, right=replace(release.right, wrist=(-.194, -.355, 1.228)))
    return clip((1, IDLE, "Neutral"), (8, set_cube, "Hold cube"), (11, rotate, "Rotate cube"),
                (14, load, "Lift over shoulder"), (18, release, "Overhand release"),
                (23, follow, "Follow through"), (32, IDLE, ""))


def forage():
    down = stance(hand(.201, -.190, .777, (-.07, -.51, -.76), (.1, -.92, .33), RELAXED),
                  hand(-.193, -.341, .683, (.29, -.70, -.55), (-.21, -.43, .84), OPEN),
                  hip=(-.016, .061, -.249), body=(34, -5, -1), gaze=(20, 2, 2))
    pinch = replace(down, right=hand(-.174, -.401, .616, (.15, -.66, -.72), (-.08, -.44, .88), PINCH),
                    hip=(-.021, .059, -.284), body=(40, -5, 3), gaze=(21, 1, -1))
    pull = replace(pinch, right=replace(pinch.right, wrist=(-.16, -.382, .735)),
                   hip=(-.015, .057, -.224), body=(29, -4, -3), gaze=(16, 1, 2))
    carry = stance(right=hand(-.184, -.252, 1.034, (.19, -.92, .23), (-.2, .02, -.97), CUP),
                   hip=(-.016, .03, -.085), body=(10, -2, 0), gaze=(9, 0, 0))
    return clip((1, IDLE, "Neutral"), (11, down, "Reach plant"), (18, pinch, "Pinch stem"),
                (22, pull, "Pick plant"), (32, carry, "Lift sample"), (42, IDLE, ""))


def two_grips(left, right, hip, body, gaze):
    # The axis between grip centers defines a common shaft orientation.
    delta = tuple(a - b for a, b in zip(left, right, strict=True))
    left_top = (0, -.9, .16)
    right_top = (0, .92, -.16)
    return stance(hand(*left, delta, left_top, GRIP),
                  hand(*right, delta, right_top, GRIP), hip=hip, body=body, gaze=gaze)


def mine():
    ready = two_grips((.082, -.346, 1.04), (-.158, -.26, 1.11),
                      (-.022, .04, -.087), (11, -3, -7), (6, 0, -3))
    wind = two_grips((-.127, -.284, 1.399), (-.315, -.226, 1.383),
                     (-.030, .041, -.09), (5, -7, -19), (-6, 2, 9))
    strike = two_grips((.096, -.465, .895), (-.117, -.339, .968),
                       (.012, -.032, -.139), (25, -2, 12), (11, 0, -7))
    stop = two_grips((.112, -.408, .923), (-.101, -.319, .993),
                     (.015, -.027, -.150), (27, -2, 12), (14, 0, -5))
    return clip((1, ready, "Set pick"), (10, wind, "Raise pick"), (16, strike, "Contact"),
                (20, stop, "Absorb impact"), (28, ready, "Reset tool"), (36, ready, ""))


def reel_stance(left, right, pitch=7, hip=(0, .009, -.059), yaw=3):
    return stance(hand(*left, (-.17, -.88, .37), (.85, .05, .44), GRIP),
                  hand(*right, (.18, -.89, .33), (-.87, -.05, .41), GRIP),
                  hip=hip, body=(pitch, -2, yaw), gaze=(-1, 1, -yaw * .45))


ROD_READY = reel_stance((.084, -.304, 1.087), (-.146, -.276, 1.075))


def fish_cast():
    load = reel_stance((.081, -.256, 1.237), (-.308, -.200, 1.360), 4, (-.032, .035, -.07), -12)
    over = reel_stance((.088, -.296, 1.241), (-.23, -.268, 1.397), 5, (-.016, .018, -.073), -8)
    cast = reel_stance((.103, -.410, 1.16), (-.153, -.439, 1.202), 12, (.01, -.051, -.084), 9)
    follow = reel_stance((.118, -.362, 1.086), (-.18, -.346, 1.13), 9, (.008, -.03, -.073), 6)
    return clip((1, ROD_READY, "Hold rod"), (8, load, "Load rod"), (12, over, "Lift tip"),
                (16, replace(cast, right=replace(cast.right, curl=(.46, .12, .70, .85, .86))), "Release line"), (22, follow, "Follow cast"), (30, ROD_READY, ""))


def fish_wait():
    buoy = reel_stance((.087, -.321, 1.104), (-.143, -.289, 1.095), 9, (.006, -.004, -.052), 3.6)
    breathe = reel_stance((.080, -.298, 1.077), (-.153, -.276, 1.07), 5, (-.007, .016, -.064), 2.4)
    return clip((1, ROD_READY, "Hold rod"), (15, buoy, "Watch line"), (31, ROD_READY, "Settle"),
                (47, breathe, "Release shoulder"), (60, ROD_READY, "Hold rod"), min_wrist_travel=.012)


def fish_reel():
    brace = reel_stance((.101, -.34, 1.142), (-.164, -.294, 1.111), 8, (-.012, .016, -.08), 4)
    def crank(x, y, z, curl=GRIP):
        return hand(x, y, z, (.31, -.80, .37), (-.8, -.1, .52), curl)
    turn_a = replace(brace, right=crank(-.117, -.349, 1.193))
    turn_b = replace(brace, right=crank(-.098, -.380, 1.112))
    tension = reel_stance((.084, -.283, 1.22), (-.142, -.275, 1.175), 3, (-.022, .057, -.095), -4)
    turn_c = replace(brace, right=crank(-.136, -.325, 1.075))
    return clip((1, ROD_READY, "Hold rod"), (7, turn_a, "Grasp crank"), (12, turn_b, "Crank down"),
                (20, tension, "Lift line"), (26, turn_c, "Crank again"), (36, ROD_READY, ""))


def cook():
    brace = hand(.167, -.338, .944, (-.55, -.50, .05), (.66, .08, -.70), GRIP)
    keys = []
    for frame, label in ((1, "Hold pan"), (12, "Drag stir"), (21, "Lift food"),
                         (30, "Toss"), (39, "Catch"), (50, "Return"), (60, "Hold pan")):
        phase = tau * (frame - 1) / 59
        tool = hand(-.131 + .066 * sin(phase), -.365 - .046 * cos(phase),
                    .986 + .081 * sin(phase * .5) ** 4, (.17, -.77, -.41), (-.17, -.39, .91), GRIP)
        pose = stance(brace, tool, hip=(.013 * sin(phase), .055, -.146), body=(20, 2 * sin(phase), 2),
                      gaze=(20, -2, -2))
        keys.append((frame, pose, label))
    return clip(*keys, min_wrist_travel=.085)


def forge():
    brace = hand(.182, -.345, .985, (-.40, -.67, -.16), (.05, -.14, .99), GRIP)
    center = stance(brace, hand(-.13, -.316, 1.106, (.22, -.77, -.38), (-.5, -.08, .82), GRIP),
                    hip=(.005, .019, -.102), body=(15, -1, 3), gaze=(19, 0, 0))
    raise_tool = replace(center, right=hand(-.282, -.25, 1.417, (.11, -.44, .87), (-.72, .08, .58), GRIP),
                         body=(6, -4, -8), gaze=(10, 0, 2))
    impact = replace(center, right=hand(-.139, -.421, 1.003, (.24, -.89, -.23), (-.16, -.22, .96), GRIP),
                     hip=(-.007, -.008, -.127), body=(19, -1, 8), gaze=(20, 0, -4))
    rebound = replace(center, right=hand(-.149, -.353, 1.154, (.21, -.68, .59), (-.50, .06, .84), GRIP))
    return clip((1, center, "Brace workpiece"), (11, raise_tool, "Raise hammer"),
                (18, impact, "Strike anvil"), (26, rebound, "Rebound"),
                (37, center, "Reset"), (48, center, "Brace workpiece"))


def pet_small(medium=False):
    hip_z = -.17 if medium else -.276
    lean = 28 if medium else 39
    height = .963 if medium else .699
    lower = stance(
        hand(.216, -.19, .969 if medium else .786, (-.10, -.44, -.88), (.31, -.87, .31), RELAXED),
        hand(-.197, -.262, height + .117, (.13, -.82, -.42), (-.01, -.08, .99), OPEN),
        hip=(-.029, .063, hip_z), body=(lean - 5, -5, 2), gaze=(19, -1, -4))
    approach = replace(lower, right=hand(-.165, -.365, height + .044, (.09, -.91, -.36),
                                         (-.07, -.10, .99), PET),
                       body=(lean, -4, 3), gaze=(22, 0, -5))
    touch = replace(approach, right=hand(-.147, -.419, height, (.14, -.91, -.33),
                                        (-.08, -.11, .98), PET), gaze=(22, 1, -5))
    stroke = replace(touch, right=hand(-.17, -.362, height + .009, (.08, -.91, -.29),
                                      (-.08, -.11, .98), PET))
    return clip((1, IDLE, "Neutral"), (12, lower, "Bend" if medium else "Crouch"),
                (23, approach, "Reach head"), (30, touch, "Touch head"), (38, stroke, "Stroke"),
                (46, approach, "Withdraw hand"), (53, lower, "Recover weight"), (60, IDLE, ""))


ACTIONS = {
    "chr_idle_long": idle_long(),
    "chr_glide": glide(),
    "chr_mount_idle": mount_idle(),
    "chr_command_point": command_point(),
    "chr_command_recall": command_recall(),
    "chr_item_use_self": item_self(),
    "chr_item_use_other": item_other(),
    "chr_field_deploy": place_action(),
    "chr_throw_card": throw_card(),
    "chr_throw_bead": throw_bead(),
    "chr_throw_cube": throw_cube(),
    "chr_gather_forage": forage(),
    "chr_mine_pick": mine(),
    "chr_fish_cast": fish_cast(),
    "chr_fish_wait": fish_wait(),
    "chr_fish_reel": fish_reel(),
    "chr_cook_camp": cook(),
    "chr_craft_forge": forge(),
    "chr_trap_place": place_action(trap=True),
    "chr_pet_s": pet_small(),
    "chr_pet_m": pet_small(medium=True),
}

