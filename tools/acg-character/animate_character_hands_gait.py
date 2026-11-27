"""Blender pass over the editable personal performances. Stage separately from inputs."""
import bpy
import json
import sys
from math import asin, atan2, cos, degrees, pi, radians, sin
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector

out = Path(sys.argv[-1])
out.mkdir(parents=True, exist_ok=True)
hero = out.name
leo = hero == 'leo'
# Lean angle, arm swing, elbow bend and arm clearance give each gait a silhouette.
lean, swing, elbow, width = {
    'leo': (11, 32, 78, .44), 'roen': (8, 25, 83, .13),
    'amemori_sumiha': (6, 23, 69, .48), 'yeh_chengxi': (13, 38, 75, .21),
}[hero]
sys.path.insert(0,str(Path(__file__).parent))
from character_mocap_accents import MotionReference
reference = None if leo else MotionReference(sys.argv[-2],hero)
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
bones = rig.pose.bones
saved = rig.animation_data.action, scene.frame_current
visible = [o for o in scene.objects if o.type == 'MESH' and not o.hide_get()]
for obj in visible:
    obj.hide_set(True)

def bone(side, human, beacon):
    return bones[beacon + '.' + side[0] if leo else side + human]

def smooth(x):
    x = min(1, max(0, x))
    return x*x*(3-2*x)

def hand_shape(name, side, t):
    loose = (17, 14, 20, 26, 31)
    fist = (49, 64, 70, 73, 76)
    open_hand = (12, 5, 8, 11, 14)
    pinch = (38, 43, 20, 27, 33)
    point = (36, 2, 60, 67, 71)
    phase = sin(2*pi*t)
    grip = {'run': .93, 'walk': .14, 'Step Forward': .14, 'sneak_move': .26}
    if name in grip:
        shape, amount = fist, grip[name] + .045*phase*(1 if side=='Left' else -1)
    else:
        peak = {'throw_bead':15/28,'throw_card':.5,'throw_cube':18/32}.get(name,.46)
        amount = smooth(t/(peak*.67))*smooth((1-t)/.28)
        if name.startswith('throw_') and side=='Right':
            shape = pinch if name!='throw_cube' else fist
            release = smooth((t-peak+.035)/.09)
            shape = tuple(a+(b-a)*release for a,b in zip(shape,open_hand))
        elif name in ('command_point','command_attack','Beacon Signal') and side=='Right':
            shape = point
        elif name in ('field_deploy','backpack_open','item_use_self','item_use_other') and side=='Right':
            shape = pinch
        elif name in ('roll_dodge','attack','hit_react'):
            shape = fist
        elif name in ('idle','talk_idle','Field Idle','sneak_idle','crouch'):
            shape, amount = fist, .08+.05*phase
        elif name in ('command_recall','recall'):
            shape = fist if side=='Right' else open_hand
        else:
            shape = open_hand
    return [a+(b-a)*amount for a,b in zip(loose,shape)]

report = {}
for action in bpy.data.actions:
    rig.animation_data.action = action
    name = action.name.removeprefix('chr_')
    lo, hi = map(round, action.frame_range)
    touched = set()
    if name == 'Idle_Art':
        report[action.name] = {'joints': []}
        continue
    gait = name in ('run','walk','Step Forward','sneak_move')
    strength = 1 if name=='run' else .60 if name=='sneak_move' else .48
    feet = [bone(side,'Foot','foot') for side in ('Left','Right')]
    strides = []
    if gait:
        for f in range(lo,hi+1):
            scene.frame_set(f)
            strides.append(feet[0].head.y-feet[1].head.y)
    previous = {}
    # Snapshot values before inserting any keys into sparse source curves.
    frames = []
    for f in range(lo,hi+1):
        scene.frame_set(f)
        t = (f-lo)/max(1,hi-lo)
        keys = {}
        def turn(b, world_q):
            orient = b.matrix.to_quaternion()
            keys[b.name] = b.rotation_quaternion @ orient.inverted() @ world_q @ orient
        pitch = Quaternion()
        if gait:
            spine = bones['spine' if leo else 'Spine']
            neck = bones['neck' if leo else 'Neck']
            axis = neck.head - spine.head
            current = atan2(-axis.y,axis.z)
            target = current if name=='sneak_move' else radians(lean*strength+1.3*cos(4*pi*t))
            pitch = Quaternion((1,0,0),target-current)
            turn(spine,pitch)
            turn(neck,Quaternion((1,0,0),-.55*pitch.angle*(1 if pitch.axis.x>0 else -1)))
        elif reference:
            for joint,source in [('Chest','Spine'),('Head','Head'),('LeftUpperArm','LeftArm'),('RightUpperArm','RightArm')]:
                if hero=='amemori_sumiha' and name in ('command_point','field_deploy','jump','pet_m','roll_dodge','talk_gesture','talk_idle','throw_bead','victory') and joint!='Head':
                    continue
                b = bones[joint]
                rest = b.bone.matrix_local.to_quaternion()
                keys[joint] = b.rotation_quaternion @ rest.inverted() @ reference.delta(name,source,t) @ rest
        for side, sign in [('Left',1),('Right',-1)]:
            if gait:
                step = sign*strides[f-lo]/max(.001,max(map(abs,strides)))
                arm, fore, hand = [bone(side,a,b) for a,b in [('UpperArm','upper_arm'),('LowerArm','forearm'),('Hand','hand')]]
                other = bone('Right' if side=='Left' else 'Left','UpperArm','upper_arm')
                # Cancel shoulder yaw at wrist level near the passing pose.
                center = (arm.head + other.head)*.5
                shoulder_offset = (pitch @ (arm.head-center)).y
                reach = (fore.head-arm.head).length + (hand.head-fore.head).length*cos(radians(elbow*strength))
                theta = radians((swing*step-7)*strength) + shoulder_offset/max(.08,reach)
                if leo or hero=='amemori_sumiha':
                    theta += radians(15)
                compact_run = leo and name == "run"
                # Halfway between the two earlier comparison poses, measured in shoulder-to-elbow offset.
                lateral = .2703 if compact_run else width
                fore_lateral = .23 if leo or hero=="amemori_sumiha" else .04
                phi = theta+radians(elbow*strength+6*step)
                if compact_run:
                    # Counter the shoulder turn while carrying the elbow behind the torso on recovery.
                    passing = 1-step*step
                    fore_lateral = .08 + .95*passing
                    fore_lateral += .18*(1-step)/2
                    theta = radians(-2.5+39.5*step)+shoulder_offset/max(.08,reach)
                    # Include lateral offsets when solving the three-dimensional elbow angle.
                    phi = theta + pi/2 + asin(lateral*fore_lateral) + radians(5)*passing
                u = Vector((sign*lateral,-sin(theta),-cos(theta))).normalized()
                v = Vector((sign*fore_lateral,-sin(phi),-cos(phi))).normalized()
                old_u, old_v = fore.head-arm.head, hand.head-fore.head
                arm_q = old_u.rotation_difference(pitch.inverted() @ u)
                turn(arm,arm_q)
                fore_q = old_v.rotation_difference(arm_q.inverted() @ pitch.inverted() @ v)
                if compact_run:
                    def basis(forward, radial):
                        forward = forward.normalized()
                        radial = (radial-forward*radial.dot(forward)).normalized()
                        return Matrix((forward,radial,forward.cross(radial))).transposed().to_quaternion()

                    up = Vector((0,0,1))
                    palm_axis = bone(side,'Middle','middle').bone.head_local-hand.bone.head_local
                    radial = bone(side,'Index','index').bone.head_local-bone(side,'Little','pinky').bone.head_local
                    parent_delta = pitch @ arm_q
                    fore_world = parent_delta @ fore_q @ fore.matrix.to_quaternion()
                    neutral_radial = fore_world @ (fore.bone.matrix_local.to_quaternion().inverted() @ radial)
                    twist = basis(v,up) @ basis(v,neutral_radial).inverted()
                    fore_q = parent_delta.inverted() @ twist @ parent_delta @ fore_q
                    # Follow the forearm while keeping the index side above the little finger.
                    forward = v
                    target = basis(up-forward*up.dot(forward),forward) @ basis(radial,palm_axis).inverted() @ hand.bone.matrix_local.to_quaternion()
                    inherited = parent_delta @ fore_q
                    turn(hand,inherited.inverted() @ target @ hand.matrix.to_quaternion().inverted())
                turn(fore,fore_q)
            for digit,angle in zip(('Thumb','Index','Middle','Ring','Little'),hand_shape(name,side,t)):
                segments = ('','_tip') if leo else ('Proximal','Intermediate','Distal')
                for j,segment in enumerate(segments):
                    b = bone(side,digit+segment,('pinky' if digit=='Little' else digit.lower())+segment)
                    rest = b.bone.matrix_local.to_quaternion()
                    # Palm faces down in both bind rigs. Oppose the thumb toward the finger pads.
                    axis = Vector((.42 if digit=='Thumb' else 0,sign,0)).normalized()
                    q = Quaternion(axis,radians(angle*(1 if j<2 else .65)))
                    if digit=='Thumb' and j==0:
                        q = Quaternion((0,0,sign),radians(angle*.65)) @ q
                    if leo and name=='run':
                        # Leo has two phalanges. Fold the distal segment back to the palm pad.
                        base = bone(side,digit,('pinky' if digit=='Little' else digit.lower())).bone
                        distal = bone(side,digit,('pinky' if digit=='Little' else digit.lower())+'_tip').bone
                        root = base.head_local
                        first = base.tail_local-root
                        last = distal.tail_local-distal.head_local
                        if digit=='Thumb':
                            # Lay the thumb across the outside of the folded index and middle fingers.
                            target = Vector((sign*.691,-.012,1.389))
                            pole = Vector((sign*.012,-.043,-.024))
                        else:
                            middle = bone(side,'Middle','middle').bone.head_local
                            target = Vector((root.x-sign*.024, root.y*.75+middle.y*.25,root.z-.025))
                            pole = Vector((sign*.006,0,-1))
                        ray = target-root
                        direction = ray.normalized()
                        reach = min(ray.length,first.length+last.length-.0001)
                        along = (first.length_squared-last.length_squared+reach**2)/(2*reach)
                        normal = (pole-direction*pole.dot(direction)).normalized()
                        hinge = direction*along+normal*max(0,first.length_squared-along**2)**.5
                        base_q = first.rotation_difference(hinge)
                        q = base_q if j==0 else last.rotation_difference(base_q.inverted() @ (target-root-hinge))
                    keys[b.name] = rest.inverted() @ q @ rest
        frames.append(keys)
    for f,keys in enumerate(frames,lo):
        for n,q in keys.items():
            q.make_compatible(previous.get(n,q))
            previous[n] = q.copy()
            b = bones[n]
            b.rotation_quaternion = q
            b.keyframe_insert(data_path='rotation_quaternion',frame=f,group=n)
            touched.add(n)
    report[action.name] = {'joints':sorted(touched)}

for obj in visible:
    obj.hide_set(False)
rig.animation_data.action = saved[0]
scene.frame_set(saved[1])
(out/'performance.json').write_text(json.dumps(report))
bpy.ops.wm.save_as_mainfile(filepath=str(out/Path(bpy.data.filepath).name),compress=True)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
mesh = min((o for o in visible if o.find_armature()==rig),key=lambda o:len(o.data.vertices))
mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'sampled.glb'),use_selection=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_morph_animation=False,export_optimize_animation_size=False)

















