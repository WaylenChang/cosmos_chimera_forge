"""Refine the editable protagonists in place on staged copies of the approved assets."""
import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

DIGITS = ('Index', 'Middle', 'Ring', 'Little')
SEGMENTS = ('Proximal', 'Intermediate', 'Distal')


def hand_surface(body, rig, side):
    sign = 1 if side == 'Left' else -1
    bones = rig.data.bones
    wrist = bones[side+'Hand'].head_local
    cut = sign*wrist.x - .006
    bm = bmesh.new()
    bm.from_mesh(body.data)
    selection = [v for v in bm.verts if sign*v.co.x > cut-.025]
    edges = {e for v in selection for e in v.link_edges}
    faces = {f for e in edges for f in e.link_faces}
    result = bmesh.ops.bisect_plane(bm, geom=selection+list(edges)+list(faces),
        plane_co=(sign*cut,0,0), plane_no=(sign,0,0), clear_outer=True, dist=1e-7)
    border = {v for v in result['geom_cut'] if isinstance(v,bmesh.types.BMVert) and v.is_valid}
    assert len(border)>8 and all(sum(e.is_boundary for e in v.link_edges)==2 for v in border)
    color=bm.verts.layers.float_color['Skin tone']
    samples=[v for v in bm.verts if sign*v.co.x>cut-.010 and sign*v.co.x<=cut]
    tone=sum((Vector(v[color]) for v in samples),Vector((0,0,0,0)))/len(samples)
    coords, weights, polys = [], [], []
    def vertex(p, bone):
        coords.append(tuple(p))
        weights.append(bone)
        return len(coords)-1
    def palm(x,y,z):
        return vertex((wrist.x+sign*x,y,wrist.z+z),side+'Hand')
    rows=[]
    for x,width,thick in ((-.002,.016,.012),(.009,.020,.014),(.032,.025,.013),(.048,.024,.009)):
        row=[[palm(x,width*(j/2-1),s*thick*(1-.22*abs(j/2-1)**2)) for j in range(5)] for s in (-1,1)]
        rows.append(row)
    def finger(socket, digit):
        chain=[bones[side+digit+seg] for seg in SEGMENTS]
        center=sum((Vector(coords[i]) for i in socket),Vector())/4
        along=(chain[-1].tail_local-center).normalized()
        across=Vector((-sign*along.y,sign*along.x,0)).normalized()
        up=along.cross(across).normalized()
        if up.z<0: up.negate()
        # Sort the socket around its axis to prevent twisted finger surfaces.
        order=sorted(socket,key=lambda i: math.atan2((Vector(coords[i])-center).dot(up),(Vector(coords[i])-center).dot(across)))
        prev=order
        radius={'Thumb':.0078,'Index':.0064,'Middle':.0067,'Ring':.0062,'Little':.0055}[digit]
        for p,r,bone in ((center.lerp(chain[0].tail_local,.48),1,chain[0]),(chain[0].tail_local,.98,chain[0]),
                         (chain[1].head_local.lerp(chain[1].tail_local,.48),.93,chain[1]),(chain[1].tail_local,.85,chain[1]),
                         (chain[2].head_local.lerp(chain[2].tail_local,.72),.76,chain[2]),(chain[2].tail_local,.49,chain[2])):
            ring=[vertex(p+(across*a*.86+up*b*.90)*radius*r,bone.name) for a,b in ((-1,-1),(1,-1),(1,1),(-1,1))]
            for j in range(4): polys.append((prev[j-1],prev[j],ring[j],ring[j-1]))
            prev=ring
        polys.append(tuple(prev))
    for k,(a,b) in enumerate(zip(rows,rows[1:])):
        for s in (0,1):
            for j in range(4): polys.append((a[s][j],a[s][j+1],b[s][j+1],b[s][j]))
        for j in (0,4):
            face=(a[0][j],b[0][j],b[1][j],a[1][j])
            if k==1 and j==0: finger(face,'Thumb')
            else: polys.append(face)
    a=rows[-1]
    for j,digit in enumerate(DIGITS): finger((a[0][j],a[0][j+1],a[1][j+1],a[1][j]),digit)
    mesh=bpy.data.meshes.new('Hand cage')
    mesh.from_pydata(coords,[],polys)
    temp=bpy.data.objects.new('Hand cage',mesh)
    bpy.context.scene.collection.objects.link(temp)
    for name in set(weights):
        temp.vertex_groups.new(name=name).add([i for i,w in enumerate(weights) if w==name],1,'REPLACE')
    mod=temp.modifiers.new('Round finger pads','SUBSURF')
    mod.levels=2
    ev=temp.evaluated_get(bpy.context.evaluated_depsgraph_get())
    smooth=ev.to_mesh()
    layer=bm.verts.layers.deform.verify()
    verts=[]
    for v in smooth.vertices:
        new=bm.verts.new(v.co)
        new[color]=tone
        verts.append(new)
        for g in v.groups:
            new[layer][body.vertex_groups[temp.vertex_groups[g.group].name].index]=g.weight
    skin=body.data.materials.find('Skin - Hands')
    assert skin>=0
    def add_face(points):
        f=bm.faces.new(points)
        f.material_index=skin
        f.smooth=True
        return f
    added=[add_face([verts[i] for i in p.vertices]) for p in smooth.polygons]
    root={v for v in verts if any(e.is_boundary for e in v.link_edges)}
    # Both wrist rings are star-shaped. Stitch in polar order to preserve the dense forearm.
    def angles(loop):
        c=sum((v.co for v in loop),Vector())/len(loop)
        return sorted((math.atan2(v.co.z-c.z,v.co.y-c.y),v) for v in loop)
    a,b=angles(border),angles(root)
    i=j=0
    while i<len(a) or j<len(b):
        an=a[(i+1)%len(a)][0]+(2*math.pi if i+1>=len(a) else 0)
        bn=b[(j+1)%len(b)][0]+(2*math.pi if j+1>=len(b) else 0)
        av,bv=a[i%len(a)][1],b[j%len(b)][1]
        if i<len(a) and (j==len(b) or an<=bn):
            i+=1
            added.append(add_face((av,bv,a[i%len(a)][1])))
        else:
            j+=1
            added.append(add_face((av,bv,b[j%len(b)][1])))
    assert all(e.is_manifold for v in root|border|set(verts) for e in v.link_edges)
    bmesh.ops.recalc_face_normals(bm,faces=added)
    # Match the preserved forearm winding across the stitched boundary.
    seam=next(e for v in border for e in v.link_edges if e.other_vert(v) in border and len(e.link_faces)==2 and any(f in added for f in e.link_faces))
    if not seam.is_contiguous: bmesh.ops.reverse_faces(bm,faces=added)
    bm.to_mesh(body.data)
    bm.free()
    ev.to_mesh_clear()
    bpy.data.objects.remove(temp,do_unlink=True)
    bpy.data.meshes.remove(mesh)

def fit_glove(body,rig,side):
    glove=bpy.data.objects[side[0]+'_Glove']
    sign=1 if side=='Left' else -1
    wrist=rig.data.bones[side+'Hand'].head_local
    bm=bmesh.new()
    deform=bm.verts.layers.deform.verify()
    points={}
    for v in body.data.vertices:
        if sign*(v.co.x-wrist.x)<-.010: continue
        p=bm.verts.new(v.co)
        points[v.index]=p
        for g in v.groups:
            name=body.vertex_groups[g.group].name
            group=glove.vertex_groups.get(name)
            if group is None:group=glove.vertex_groups.new(name=name)
            p[deform][group.index]=g.weight
    for poly in body.data.polygons:
        if poly.vertices[0] in points and all(i in points for i in poly.vertices):
            bm.faces.new([points[i] for i in poly.vertices])
    for point,normal in (((wrist.x-sign*.003,0,0),(-sign,0,0)),
                         ((wrist.x+sign*.047,0,0),(sign,0,0)),
                         ((0,-.026,0),(0,-1,0))):
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                               plane_co=point,plane_no=normal,clear_outer=True,dist=1e-7)
    bm.normal_update()
    for v in bm.verts:v.co+=v.normal*.0015
    edges=[e for e in bm.edges if e.is_boundary]
    result=bmesh.ops.extrude_edge_only(bm,edges=edges)
    for v in result['geom']:
        if isinstance(v,bmesh.types.BMVert):
            src=next(e.other_vert(v) for e in v.link_edges if e.other_vert(v) not in result['geom'])
            v.co-=src.normal*.0016
    uv=bm.loops.layers.uv.verify()
    for f in bm.faces:
        f.smooth=True
        us=[]
        for loop in f.loops:
            p=loop.vert.co
            u=(math.atan2(p.z-wrist.z,p.y)/math.tau)%1
            us.append(u)
            loop[uv].uv=(u,.78-.56*(sign*(p.x-wrist.x)+.003)/.050)
        if max(us)-min(us)>.5:
            for loop in f.loops:
                if loop[uv].uv.x<.5:loop[uv].uv.x+=1
    bm.to_mesh(glove.data)
    bm.free()


def finish_part(owner,name,coords,faces,material,rigid=False):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(coords,[],faces)
    bm=bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons: p.use_smooth=True
    # Copy collection, modifier, visibility drivers and group indices from the garment.
    obj=owner.copy()
    obj.name=name
    obj.data=mesh
    owner.users_collection[0].objects.link(obj)
    mesh.materials.append(material)
    tree=KDTree(len(owner.data.vertices))
    for v in owner.data.vertices: tree.insert(v.co,v.index)
    tree.balance()
    if not len(obj.vertex_groups):
        for g in owner.vertex_groups: obj.vertex_groups.new(name=g.name)
    center=sum((v.co for v in mesh.vertices),Vector())/len(mesh.vertices)
    for v in mesh.vertices:
        _,i,_=tree.find(center if rigid else v.co)
        for g in owner.data.vertices[i].groups:
            obj.vertex_groups[owner.vertex_groups[g.group].name].add([v.index],g.weight,'REPLACE')
    return obj


def trim(owner,name,paths,radius,mat,rigid=False):
    verts,faces=[],[]
    for points,closed in paths:
        offset=len(verts)
        for i,p in enumerate(points):
            before=points[(i-1)%len(points)] if closed or i else p
            after=points[(i+1)%len(points)] if closed or i+1<len(points) else p
            tangent=(after-before).normalized()
            ref=Vector((0,0,1)) if abs(tangent.z)<.85 else Vector((0,1,0))
            # Parallel transport avoids twists through a vertical tangent.
            if i: ref=normal
            normal=(ref-tangent*ref.dot(tangent)).normalized()
            other=tangent.cross(normal)
            for j in range(8):
                angle=j*math.tau/8
                verts.append(p+radius*(normal*math.cos(angle)+other*math.sin(angle)))
        for i in range(len(points) if closed else len(points)-1):
            a=offset+8*i
            b=offset+8*((i+1)%len(points))
            for j in range(8): faces.append((a+j,a+(j+1)%8,b+(j+1)%8,b+j))
        if not closed:
            for k in (0,len(points)-1): faces.append(tuple(offset+8*k+j for j in range(8)))
    return finish_part(owner,name,verts,faces,mat,rigid)


def shader(name,color,rough,metal=0,sheen=0):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    node=mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value=(*color,1)
    node.inputs['Roughness'].default_value=rough
    node.inputs['Metallic'].default_value=metal
    node.inputs['Sheen Weight'].default_value=sheen
    return mat


def pocket(owner,cloth,metal):
    vs=owner.data.vertices
    sign=1 if owner.name.startswith('L_') else -1
    lo=[min(v.co[i] for v in vs) for i in range(3)]
    hi=[max(v.co[i] for v in vs) for i in range(3)]
    tree=__import__('mathutils.bvhtree',fromlist=['BVHTree']).BVHTree.FromPolygons(
        [v.co for v in vs],[list(p.vertices) for p in owner.data.polygons])
    def surface(u,h,lift):
        y=(lo[1]+hi[1])/2+(hi[1]-lo[1])*u
        z=lo[2]+(hi[2]-lo[2])*h
        hit=tree.ray_cast(Vector((sign,y,z)),Vector((-sign,0,0)))[0]
        assert hit is not None,(owner.name,u,h)
        hit.x+=sign*lift
        return hit
    verts=[]
    faces=[]
    for depth in (0,.0023):
        for i in range(4):
            for j in range(9):
                u=(j-4)/4
                h=.84-i/3*(.21-.055*abs(u)**2)
                verts.append(surface(.34*u,h,depth+.0005*math.sin(math.pi*i/3)))
    for offset in (0,36):
        for i in range(3):
            for j in range(8):
                k=offset+9*i+j
                faces.append((k,k+1,k+10,k+9))
    border=list(range(9))+[17,26]+list(range(35,26,-1))+[18,9]
    for a,b in zip(border,border[1:]+border[:1]):faces.append((a,b,b+36,a+36))
    flap=finish_part(owner,owner.name+' folded flap',verts,faces,cloth)
    p=surface(0,.70,.0027)
    ring=[p+Vector((0,.0032*math.cos(t*math.tau/16),.0032*math.sin(t*math.tau/16))) for t in range(16)]
    snap=trim(owner,owner.name+' press stud',[(ring,True)],.0012,metal,True)
    return [flap,snap]


def wardrobe(hero):
    objects=bpy.data.objects
    brass=hero=='amemori_sumiha'
    metal=shader('Brushed brass' if brass else 'Satin gunmetal',(.51,.32,.11) if brass else (.22,.25,.27),.38,.8)
    cloth=shader('Folded pocket twill',{'roen':(.055,.064,.071),'yeh_chengxi':(.12,.065,.038),
                 'amemori_sumiha':(.12,.057,.075)}[hero],.77,sheen=.28)
    edging=shader('Bound neckline tape',(.058,.048,.055),.72,sheen=.22)
    additions=[]
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':continue
        n=o.name
        values={}
        if n.startswith('Hair') or n in ('TiedHair','Topknot'):
            values={'Anisotropic':.48,'Metallic':0}
        elif n.endswith(('_Glove','_Boot')): values={'Roughness':.61,'Sheen Weight':.12}
        elif n in ('FieldCup','CapPin','Triangle hair clip','North star hair pin','Belt buckle'):
            values={'Metallic':.72,'Roughness':.36}
        elif n in ('CubeLanyard','PackTassel','SashTail','CupHanger','Backpack') or 'strap' in n:
            values={'Roughness':.72,'Sheen Weight':.18}
        for m in o.data.materials:
            nd=next((nd for nd in m.node_tree.nodes if nd.type=='BSDF_PRINCIPLED'),None) if m.node_tree else None
            if nd:
                for key,value in values.items():nd.inputs[key].default_value=value
        if n.endswith(('CargoPocket','ThighPouch')): additions.extend(pocket(o,cloth,metal))
        if n in ('Bodice','Inner shirt','TrainingTop'):
            count=o.data.polygons[0].vertices[1]
            assert count in (44,48)
            points=[v.co.copy() for v in o.data.vertices[:count]]
            additions.append(trim(o,n+' collar binding',[(points,True)],.0019,edging))
        if n.endswith('pack strap'):
            v=o.data.vertices
            c=(v[192].co+v[193].co)/2
            across=(v[193].co-v[192].co).normalized()
            up=(v[196].co-v[188].co).normalized()
            normal=up.cross(across).normalized()
            if normal.y>0:normal.negate()
            c+=normal*.002
            corners=[]
            for sx,sz,angle in ((1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)):
                for j in range(5):
                    t=math.radians(angle+j*22.5)
                    corners.append(c+across*(sx*.010+.0026*math.cos(t))+up*(sz*.004+.0026*math.sin(t)))
            bar=[c-across*.012+normal*.0008,c+across*.012+normal*.0008]
            additions.append(trim(o,n+' slider',[(corners,True),(bar,False)],.0015,metal,True))
        if n in ('PackTassel','CubeLanyard','CupHanger'):
            # Crimp follows the existing loft around the accessory's fixed end.
            ring=[v.co.copy() for v in o.data.vertices[48:96]]
            additions.append(trim(o,n+' ferrule',[(ring,True)],.0016,metal))
    return additions
def islands(body, start, sign):
    vertices = {v.index for v in body.data.vertices if sign*v.co.x > start}
    adj = {i: [] for i in vertices}
    for e in body.data.edges:
        a,b = e.vertices
        if a in vertices and b in vertices:
            adj[a].append(b)
            adj[b].append(a)
    groups=[]
    while vertices:
        queue=[vertices.pop()]
        group=[]
        while queue:
            i=queue.pop()
            group.append(i)
            for j in adj[i]:
                if j in vertices:
                    vertices.remove(j)
                    queue.append(j)
        groups.append(group)
    return groups

def verify_hands():
    body=bpy.data.objects['Body surface']
    rig=bpy.data.objects['Humanoid']
    for sign,side in ((1,'Left'),(-1,'Right')):
        wrist=abs(rig.data.bones[side+'Hand'].head_local.x)
        for dx,n in ((0,1),(.035,2),(.060,4),(.073,4)):
            groups=islands(body,wrist+dx,sign)
            assert len(groups)==n,(side,dx,len(groups))
            if n==4:
                ranges=sorted((min(body.data.vertices[i].co.y for i in g),max(body.data.vertices[i].co.y for i in g)) for g in groups)
                assert all(b[0]-a[1]>.0005 for a,b in zip(ranges,ranges[1:])),ranges


def main():
    cli=argparse.ArgumentParser()
    cli.add_argument('asset',type=Path)
    cli.add_argument('stage',type=Path)
    args=cli.parse_args(sys.argv[sys.argv.index('--')+1:])
    asset=args.asset.resolve()
    stage=args.stage.resolve()
    source=asset/'03b_blender'/(asset.name+'_03b_blender.blend')
    stage.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    for side in ('Left','Right'):hand_surface(bpy.data.objects['Body surface'],bpy.data.objects['Humanoid'],side)
    for side in ('Left','Right'):fit_glove(bpy.data.objects['Body surface'],bpy.data.objects['Humanoid'],side)
    additions=wardrobe(asset.name.removeprefix('chr_protagonist_'))
    names=[o.name for o in additions]
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(stage/source.name),compress=True,relative_remap=False)
    bpy.ops.wm.open_mainfile(filepath=str(stage/source.name))
    verify_hands()
    for n in names:
        obj=bpy.data.objects[n]
        assert obj.find_armature() and all(v.groups for v in obj.data.vertices),n
        assert {d.data_path for d in obj.animation_data.drivers}=={'hide_render','hide_viewport'}
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    from refit_protagonist_faces import export
    export(asset,stage,[bpy.data.objects[n] for n in names if not n.startswith('Training')])
    print('Verified',asset.name,names)


if __name__=='__main__': main()




