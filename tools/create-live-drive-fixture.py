import bpy,sys
from pathlib import Path
workspace=Path(__file__).resolve().parents[1]
out=Path(sys.argv[-1]).resolve()
if not out.is_relative_to(workspace/'Art'/'_incoming'):
    raise ValueError('Fixture output must stay under workspace Art/_incoming')
out.mkdir(exist_ok=True,parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=0.2)
cube=bpy.context.object;cube.name='transport_test_cube'
cube.location.z=0.0;cube.keyframe_insert(data_path='location',frame=1)
cube.location.z=0.02;cube.keyframe_insert(data_path='location',frame=10)
cube.animation_data.action.name='idle'
bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=10
bpy.ops.wm.save_as_mainfile(filepath=str(out/'fixture.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'fixture.glb'),export_format='GLB')
print('VALIDATION_FIXTURE_WRITTEN')
