"""Geometry-only Blender QA; run with -b --python ... -- model.glb output_dir budget."""
import bpy, json, sys
from pathlib import Path
model,output,budget=Path(sys.argv[sys.argv.index("--")+1]),Path(sys.argv[sys.argv.index("--")+2]),int(sys.argv[sys.argv.index("--")+3])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(model))
meshes=[o for o in bpy.data.objects if o.type=="MESH"]
rigs=[o for o in bpy.data.objects if o.type=="ARMATURE"]
triangles=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in meshes)
vertices=sum(len(obj.data.vertices) for obj in meshes)
metrics={"passed":bool(meshes and vertices and triangles<=budget and rigs),
         "mesh_count":len(meshes),"armature_count":len(rigs),"triangles":triangles,
         "triangle_budget":budget,"vertices":vertices,
         "animations":[a.name for a in bpy.data.actions],
         "missing_uv":[o.name for o in meshes if not o.data.uv_layers],
         "missing_material":[o.name for o in meshes if not o.data.materials],
         "note":"Basic geometry QA only. Check deformation, animation and artistic consistency manually."}
(output/"qa").mkdir(parents=True,exist_ok=True)
(output/"models").mkdir(parents=True,exist_ok=True)
(output/"qa"/"metrics.json").write_text(json.dumps(metrics,ensure_ascii=False,indent=2),encoding="utf-8")
bpy.ops.wm.save_as_mainfile(filepath=str(output/"models"/(model.stem+".blend")))
print(json.dumps(metrics,ensure_ascii=False))
