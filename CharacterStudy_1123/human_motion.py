"""Bake CMU BVH performances onto the fitted study armatures in Blender."""
from functools import lru_cache
from math import atan2, pi, radians, sin
from pathlib import Path

import bpy
from io_anim_bvh.import_bvh import read_bvh
from mathutils import Euler, Quaternion, Vector

HERE = Path(__file__).resolve().parent
UP = Vector((0, 0, 1))
IDENTITY = Quaternion()
# BVH has +Y up, +Z forward and +X to the performer's left.
AXES = Quaternion((1, 0, 0), pi / 2)


@lru_cache(maxsize=1)
def capture(trial):
    nodes, _, count = read_bvh(bpy.context, str(HERE/'mocap'/(trial+'.bvh')), 'NATIVE')
    return nodes, count


def sample(nodes, frame):
    # BVH row 1 is the converter's calibration pose.
    i = int(frame)
    rotation, position = {}, {}
    for name, node in nodes.items():
        a, b = node.anim_data[i:i+2]
        order = node.rot_order_str[::-1]
        q = Euler(a[3:], order).to_quaternion().slerp(Euler(b[3:], order).to_quaternion(), frame-i)
        if node.parent:
            parent = node.parent.name
            rotation[name] = rotation[parent] @ q
            position[name] = position[parent] + rotation[parent] @ node.rest_head_local
        else:
            rotation[name] = AXES @ q
            position[name] = AXES @ Vector(a[:3]).lerp(Vector(b[:3]), frame-i)
    return rotation, position

# Source rows at start, event/gesture apex, and recovery. Walking intervals
# begin a quarter stride before the footstep marker.
TAKES = {
    'idle': ('77_02', 90, 210, 330), 'talk_idle': ('18_08', 680, 860, 1040),
    'walk': ('02_01', 115, 179, 243), 'run': ('02_03', 40, 87, 134),
    'jump': ('02_04', 38, 141, 249), 'roll_dodge': ('127_23', 28, 109, 224),
    'sneak_move': ('17_03', 38, 204, 370), 'sneak_idle': ('77_03', 240, 360, 480),
    'block': ('13_17', 2, 158, 2), 'hit_react': ('77_09', 211, 247, 218),
    'knockdown': ('77_18', 555, 395, 273), 'getup': ('77_18', 273, 432, 568),
    'defeated': ('77_18', 554, 399, 282), 'talk_gesture': ('18_08', 1220, 1302, 1432),
    'command_point': ('13_27', 2850, 2950, 3070), 'command_attack': ('13_27', 3100, 3190, 3280),
    'command_recall': ('13_27', 2020, 2140, 2230), 'summon': ('13_27', 2300, 2424, 2520),
    'recall': ('13_27', 1500, 1600, 1690), 'victory': ('13_27', 2320, 2424, 2480),
    'item_use_self': ('13_09', 138, 300, 478), 'item_use_other': ('18_08', 1215, 1300, 1415),
    'field_deploy': ('02_06', 48, 145, 195), 'backpack_open': ('18_08', 1200, 1310, 1440),
    'pet_xs': ('18_08', 1220, 1300, 1430), 'pet_s': ('77_09', 610, 707, 905),
    'pet_m': ('02_06', 52, 115, 58), 'pet_l': ('02_06', 560, 660, 570),
    'pet_xl': ('13_27', 2310, 2410, 2510),
    'throw_card': ('111_33', 175, 229, 268), 'throw_cube': ('111_33', 157, 229, 278),
    'throw_bead': ('02_06', 130, 214, 267),
}

MAP = dict(Hips='Hips', Spine='LowerBack', Chest='Spine', UpperChest='Spine1',
           Neck='Neck1', Head='Head')
for side in ('Left', 'Right'):
    for target, source in zip(('Shoulder','UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot','Toes'),
                              ('Shoulder','Arm','ForeArm','Hand','UpLeg','Leg','Foot','ToeBase')):
        MAP[side+target] = side+source

# Wrist goals relative to each shoulder, in arm lengths (outward, forward, up).
# Capture provides the shoulder roll and elbow pole. Blend into the interaction.
REACH = {
    'command_point': {'Right': (.10,.95,.04)}, 'command_attack': {'Right': (.18,.92,.20)},
    'command_recall': {'Right': (.05,.37,.18)}, 'recall': {'Right': (-.13,.40,-.12)},
    'item_use_other': {'Right': (.02,.80,-.25)}, 'backpack_open': {'Right': (-.24,.45,-.55),'Left': (-.18,.43,-.47)},
    'pet_xs': {'Right': (-.38,.47,-.38),'Left': (-.19,.50,-.56)},
    'pet_s': {'Right': (.07,.63,-.55)}, 'pet_m': {'Right': (.04,.75,-.43)},
    'pet_l': {'Right': (.08,.81,.12)}, 'pet_xl': {'Right': (.13,.73,.37),'Left': (.13,.73,.39)},
    'throw_bead': {'Right': (.02,.88,-.30)}, 'throw_card': {'Right': (.02,.92,.03)},
}


def reach(pose, bones, side, goal, amount):
    upper, lower = side+'UpperArm', side+'LowerArm'
    u, l = bones[upper], bones[lower]
    a, b = u.length, l.length
    def direction(name):
        return pose[name] @ (bones[name].tail_local-bones[name].head_local).normalized()
    old_u, old_l = direction(upper), direction(lower)
    desired = Vector((goal[0] if side=='Left' else -goal[0], -goal[1], goal[2])) * (a+b)
    wrist = (a*old_u + b*old_l).lerp(desired, amount)
    axis = wrist.normalized()
    distance = min(a+b-.0001, max(abs(a-b)+.0001,wrist.length))
    pole = old_u-axis*old_u.dot(axis)
    if pole.length < .01:
        pole = Vector((1 if side=='Left' else -1,0,-1))
        pole -= axis*pole.dot(axis)
    along = (a*a-b*b+distance*distance)/(2*distance)
    elbow = axis*along + pole.normalized()*max(0,a*a-along*along)**.5
    for name, old, new in ((upper,old_u,elbow),(lower,old_l,axis*distance-elbow)):
        swing = old.rotation_difference(new.normalized())
        pose[name] = swing @ pose[name]
        if name == lower:
            pose[side+'Hand'] = swing @ pose[side+'Hand']


def bake(rig, action, name):
    trial, start, apex, end = TAKES[name]
    nodes, count = capture(trial)
    assert min(start,apex,end)>=2 and max(start,apex,end)<count
    bones = rig.data.bones
    rest = {n:bones[n].matrix_local.to_quaternion() for n in MAP}
    calibration, _ = sample(nodes,1)
    neutral, origin = sample(nodes, start)
    facing = neutral['Hips'] @ Vector((0,0,1))
    yaw = Quaternion(UP, -atan2(facing.x,-facing.y))
    correction = {}
    for n, src in MAP.items():
        correction[n] = calibration[src].inverted()
        if n.endswith(('UpperLeg','LowerLeg','UpperArm','LowerArm')):
            dst_dir = (bones[n].tail_local-bones[n].head_local).normalized()
            src_dir = nodes[src].children[0].rest_head_local.normalized()
            correction[n] = AXES.inverted() @ dst_dir.rotation_difference(AXES @ src_dir)
    scale = sum(bones['Left'+n].length for n in ('UpperLeg','LowerLeg')) / sum(
        nodes[n].rest_head_local.length for n in ('LeftLeg','LeftFoot'))
    length = int(action.frame_end)
    marks = list(action.pose_markers)
    event = marks[0].frame if marks and name not in ('walk','run','roll_dodge') else length/2
    previous = {}
    _, finish = sample(nodes,end)
    baked = []
    rig.animation_data.action = action
    bag = action.layers[0].strips[0].channelbag(rig.animation_data.action_slot)
    fingers = {}
    for side,sign in [('Left',1),('Right',-1)]:
        for digit in ('Thumb','Index','Middle','Ring','Little'):
            for segment, factor in [('Proximal',1),('Intermediate',.8),('Distal',.55)]:
                n = side+digit+segment
                axis = Vector((0,sign,0)) if digit!='Thumb' else Vector((0,0,sign))
                fingers[n] = (bones[n].matrix_local.to_quaternion().inverted() @ axis,side,digit,factor)
    replaced = {rig.pose.bones[n].path_from_id('rotation_quaternion') for n in (*MAP,*fingers)}
    replaced.update(rig.pose.bones[n].path_from_id('location') for n in ('Hips','Root'))
    for curve in list(bag.fcurves):
        if curve.data_path in replaced:
            bag.fcurves.remove(curve)
    for f in range(length+1):
        t = f/length
        if f <= event:
            row = start+(apex-start)*f/event
        else:
            row = apex+(end-apex)*(f-event)/(length-event)
        rotation, p = sample(nodes,row)
        pose = {n:yaw @ rotation[src] @ correction[n] for n,src in MAP.items()}
        for side, goal in REACH.get(name,{}).items():
            w = sin(pi/2 * (f/event if f<=event else (length-f)/(length-event)))**2
            reach(pose,bones,side,goal,w)
        delta = yaw @ (p['Hips']-origin['Hips']) * scale
        if name in ('walk','run','sneak_move'):
            delta -= yaw @ (finish['Hips']-origin['Hips']) * (scale*t)
        # Ground the fitted feet with their own heel and toe proportions.
        heads = {'Hips': bones['Hips'].head_local.copy()}
        for n in MAP:
            if n=='Hips': continue
            parent = bones[n].parent.name
            heads[n] = heads[parent]+pose[parent] @ (bones[n].head_local-bones[parent].head_local)
        floor = min((heads[s+'Foot']+pose[s+'Foot'] @ Vector((0,.028,-bones[s+'Foot'].head_local.z))).z
                    for s in ('Left','Right'))
        for s in ('Left','Right'):
            toe = bones[s+'Toes']
            floor = min(floor,(heads[s+'Toes']+pose[s+'Toes'] @ Vector((0,-toe.length,-toe.head_local.z))).z)
        if name in ('roll_dodge','knockdown','defeated','getup'):
            delta.z = (p['Hips'].z*scale - bones['Hips'].head_local.z)
            # The head on the drawn characters is larger than the performer's.
            delta.z = max(delta.z,-min(heads['Head'].z-.12,heads['Hips'].z-.08,floor))
        else:
            air = 0
            if name in ('jump','run'):
                air = max(0,min(p[s+'ToeBase'].z for s in ('Left','Right'))-.8)*scale
            delta.z = air-floor
        baked.append((pose,delta))
    first_pose,first_offset = baked[0]
    end_pose,end_offset = baked[-1]
    for f,(pose,delta) in enumerate(baked):
        t = f/length
        if action.use_cyclic and t>.80:
            w = (t-.80)/.20
            w = w*w*(3-2*w)
            pose = {n:q @ IDENTITY.slerp(end_pose[n].inverted() @ first_pose[n],min(1,w))
                    for n,q in pose.items()}
            delta = delta + (first_offset-end_offset)*w
        for n, q in pose.items():
            parent = bones[n].parent.name
            local = rest[n].inverted() @ pose.get(parent,IDENTITY).inverted() @ q @ rest[n]
            if n in previous: local.make_compatible(previous[n])
            previous[n] = local
            pb = rig.pose.bones[n]
            pb.rotation_quaternion = local
            pb.keyframe_insert('rotation_quaternion',frame=f,group=n)
        # These captures have no independent distal finger tracks. Articulate
        # a relaxed palm, tightening or releasing the grip at gameplay markers.
        for n,(axis,side,digit,factor) in fingers.items():
            curl = {'Thumb':8,'Index':14,'Middle':19,'Ring':24,'Little':30}[digit]
            if name in ('run','block','roll_dodge'):
                curl += 16
            if side=='Right' and name.startswith(('throw_','command_')):
                closed = 6 if digit=='Index' or (name=='throw_card' and digit=='Middle') else 50
                grip = min(1,f/max(1,event*.5)) if f<=event else (length-f)/(length-event)
                curl += (closed-curl)*grip
            pb = rig.pose.bones[n]
            pb.rotation_quaternion = Quaternion(axis,radians(curl*factor))
            pb.keyframe_insert('rotation_quaternion',frame=f,group=n)
        travel = Vector((delta.x,delta.y,0)) if action.get('root_motion') else Vector()
        for n,offset in [('Hips',delta-travel),('Root',travel)]:
            pb = rig.pose.bones[n]
            pb.location = bones[n].matrix_local.to_quaternion().inverted() @ offset
            pb.keyframe_insert('location',frame=f,group=n)
    for curve in bag.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
    action['mocap_source'] = 'CMU '+trial
    action['mocap_rows'] = [start,apex,end]


def apply_motion(rig):
    actions = {a.name[4:]:a for a in bpy.data.actions if a.name.startswith('chr_')}
    assert actions.keys()==TAKES.keys()
    for name, action in actions.items():
        bake(rig, action, name)
    rig.animation_data.action = actions['idle']
    bpy.context.scene.frame_set(0)


if __name__ == '__main__':
    apply_motion(bpy.data.objects['Humanoid'])
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath,compress=True)
