"""Normalize connected-component face winding before the final export/audit."""
import argparse
import json
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_starters import export


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    for job in json.loads(Path(args.jobs).read_text(encoding='utf8')):
        if args.only and f"{job['family']}:{job['stage']}" not in args.only.split(','):continue
        out=Path(job['output']);unit=f"cr_{job['subject_id']}_{job['stage']}"
        bpy.ops.wm.open_mainfile(filepath=str(out/'models'/(unit+'.blend')))
        bpy.context.preferences.filepaths.save_version=0
        mesh=bpy.data.objects[unit];rig=mesh.parent
        bm=bmesh.new();bm.from_mesh(mesh.data)
        extent=max(max(v.co[i] for v in bm.verts)-min(v.co[i] for v in bm.verts) for i in range(3))
        collapsed=[f for f in bm.faces if len(f.verts)==3 and all(len(e.link_faces)==1 for e in f.edges) and f.calc_area()<extent*extent*.0001]
        # Isolated single triangles are collapsed sub-pixel freckles/fur tips,
        # not a valid volume. Remove these decimation remnants explicitly.
        collapsed_count=len(collapsed)
        if collapsed:bmesh.ops.delete(bm,geom=collapsed,context='FACES')
        bm.normal_update()
        single_faces=[f for f in bm.faces if all(len(e.link_faces)==1 for e in f.edges)]
        deform=bm.verts.layers.deform.active
        uv=bm.loops.layers.uv.active
        for face in single_faces:
            old=list(face.verts);uvs={loop.vert:loop[uv].uv.copy() for loop in face.loops} if uv else {}
            new=[];normal=face.normal.normalized()
            for v in old:
                nv=bm.verts.new(v.co+normal*extent*.0005)
                if deform:
                    for group,weight in v[deform].items():nv[deform][group]=weight
                new.append(nv)
            origin={nv:ov for nv,ov in zip(new,old)}
            caps=[bm.faces.new(tuple(reversed(new)))]
            for i in range(len(old)):caps.append(bm.faces.new((old[i],old[(i+1)%len(old)],new[(i+1)%len(new)],new[i])))
            for cap in caps:
                cap.material_index=face.material_index
                cap.smooth=face.smooth
                if uv:
                    for loop in cap.loops:loop[uv].uv=uvs[origin.get(loop.vert,loop.vert)]
        boundary=[e for e in bm.edges if len(e.link_faces)==1]
        # Small collapsed fur-tip/cap rings can become open during decimation.
        # Fill the actual boundary loops, then independently require zero open
        # shells below; do not waive the topology check.
        filled=bmesh.ops.holes_fill(bm,edges=boundary,sides=0) if boundary else {'faces':[]}
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        # Blender's operation makes faces consistent; explicitly orient every
        # closed disconnected feather/fur/accessory shell to positive volume.
        remaining=set(bm.faces);components=0;flipped=0;open_shells=0
        while remaining:
            first=remaining.pop();group={first};stack=[first]
            while stack:
                face=stack.pop()
                for edge in face.edges:
                    for neighbor in edge.link_faces:
                        if neighbor in remaining:
                            remaining.remove(neighbor);group.add(neighbor);stack.append(neighbor)
            components+=1
            edges={edge for face in group for edge in face.edges}
            if any(len(edge.link_faces)!=2 for edge in edges):
                open_shells+=1
                print('NONMANIFOLD_COMPONENT',len(group),'faces',len(edges),'edges',{'boundary':sum(len(e.link_faces)==1 for e in edges),'multi':sum(len(e.link_faces)>2 for e in edges)},'materials',sorted({f.material_index for f in group}),flush=True)
            volume=0
            for f in group:
                a=f.verts[0].co
                for i in range(1,len(f.verts)-1):volume+=a.dot(f.verts[i].co.cross(f.verts[i+1].co))/6
            if volume<0:
                for f in group:f.normal_flip()
                flipped+=1
        bm.to_mesh(mesh.data);bm.free();mesh.data.update()
        if open_shells:raise RuntimeError(f'{job["task_id"]}: {open_shells} open shells')
        clips=json.loads((out/'anims/anim_spec.json').read_text(encoding='utf8'))['clips']
        export(job,mesh,rig,clips,clip_filter=[])
        (out/'review/mesh_integrity.json').write_text(json.dumps(dict(closed_components=components,open_components=open_shells,flipped_components=flipped,collapsed_tiny_triangles_removed=collapsed_count,collapsed_single_faces_given_thickness=len(single_faces),boundary_edges_repaired=len(boundary),cap_faces_added=len(filled['faces']),face_orientation='outward'),indent=2),encoding='utf8')
        print('FINALIZED',job['task_id'],components,'closed shells',flush=True)


if __name__=='__main__':main()
