"""Exercise a sudden stop on a scratch action, without changing the delivered clips."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from bake_protagonist_swing import bake

rig, = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
beacon = rig.name != "Humanoid"
names = (["Swing_Bead_tether", "Swing_Coat_L", "Swing_Hair_•_fringe_coils"] if beacon else
         ["Swing_HairLock1","Swing_HairLock1_Tip","LeftSleeveDrop","Swing_PackTassel"])
scene = bpy.context.scene
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis.identity()
    pb.rotation_quaternion = Quaternion()
    pb.location = Vector()
root = rig.pose.bones["root" if beacon else "Root"]
axis = root.bone.matrix_local.to_quaternion().inverted() @ Vector((0,0,1))
for frame, angle in ((1,0),(12,0),(21,55),(71,55)):
    root.rotation_quaternion = Quaternion(axis, math.radians(angle))
    root.keyframe_insert(data_path="rotation_quaternion",frame=frame)
action = rig.animation_data.action
bag=action.layers[0].strips[0].channelbag(rig.animation_data.action_slot)
for fc in bag.fcurves:
    for k in fc.keyframe_points:
        k.interpolation="LINEAR"
bake(rig,names,action)
def sample(frame):
    scene.frame_set(frame)
    return {n:rig.pose.bones[n].rotation_quaternion.copy() for n in names}
rest=sample(71)
rows=[sample(f) for f in range(21,72)]
def angle(q,r):
    return math.degrees(2*math.acos(min(1,abs(q.dot(r))/(q.magnitude*r.magnitude))))
metrics={}
for n in names:
    errors=[angle(row[n],rest[n]) for row in rows]
    quiet=next(i for i in range(len(errors)) if max(errors[i:]) < .25)
    metrics[n]={"peak_deg_after_stop":round(max(errors),3),"frames_to_quarter_degree":quiet}
assert max(m["peak_deg_after_stop"] for m in metrics.values()) > 1
Path(sys.argv[-1]).write_text(json.dumps({"fps":scene.render.fps/scene.render.fps_base,"stop_frame":21,"bones":metrics}, indent=2))
