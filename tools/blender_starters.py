"""Reference-directed original Blender models, skinning, animation and delivery.

Run with Blender --background --factory-startup --python tools/blender_starters.py
  -- --jobs Art/_incoming/starter_blender_20261111/jobs.json --only sun:juvenile
No pre-existing model or external reconstruction service is used.
"""
import argparse
import hashlib
import json
import math
import random
import shutil
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

PI = math.pi
V = Vector
PARTS = []
BODY = []
BONES = {}
MATS = []
JOB = None
RNG = random.Random(1111)


def write_json(p, data):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')


def add_bone(name, head, tail, parent=None, deform=True):
    BONES[name] = dict(head=tuple(head), tail=tuple(tail), parent=parent, deform=deform)
    return name


def smooth(obj):
    for face in obj.data.polygons:
        face.use_smooth = True


def register(obj, name, mat, bone=None, body=False):
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(MATS[mat])
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if bone:
        obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    smooth(obj)
    (BODY if body else PARTS).append(obj)
    obj.select_set(False)
    return obj


def ell(name, p, scale, mat=0, bone=None, body=False, seg=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=p)
    obj = bpy.context.object
    obj.scale = scale
    return register(obj, name, mat, bone, body)


def mesh_obj(name, verts, faces, mat, bone=None, body=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return register(obj, name, mat, bone, body)


def tube(name, points, radii, mat=0, bone=None, body=False, sides=10):
    points = [V(p) for p in points]
    verts, faces = [], []
    for i, p in enumerate(points):
        tangent = (points[min(i+1,len(points)-1)] - points[max(i-1,0)]).normalized()
        axis = tangent.cross(V((0,1,0)))
        if axis.length < .01:
            axis = tangent.cross(V((1,0,0)))
        axis.normalize()
        other = tangent.cross(axis).normalized()
        r = radii[i] if isinstance(radii, (tuple,list)) else radii
        a,b = r if isinstance(r,(tuple,list)) else (r,r)
        for k in range(sides):
            theta = 2*PI*k/sides
            verts.append(tuple(p + axis*a*math.cos(theta) + other*b*math.sin(theta)))
        if i:
            for k in range(sides):
                j = i*sides+k
                faces.append((j, i*sides+(k+1)%sides, (i-1)*sides+(k+1)%sides, (i-1)*sides+k))
    faces += [tuple(reversed(range(sides))), tuple((len(points)-1)*sides+k for k in range(sides))]
    return mesh_obj(name, verts, faces, mat, bone, body)


def leaf(name, start, end, width, mat, bone, depth=.12, bend=(0,0,0), sides=8):
    """Closed, ridged, curved feather/fur lock with real thickness."""
    start, end = V(start), V(end)
    direction = (end-start).normalized()
    axis = direction.cross(V((0,-1,0)))
    if axis.length < .05:
        axis = direction.cross(V((1,0,0)))
    axis.normalize()
    other = direction.cross(axis).normalized()
    verts, faces = [], []
    for i in range(7):
        t=i/6
        center=start.lerp(end,t)+V(bend)*math.sin(PI*t)
        shape = max(.012, math.sin(PI*(t*.91+.07))**.85 * (1-t)**.25)
        for k in range(sides):
            a=2*PI*k/sides
            verts.append(tuple(center + axis*math.cos(a)*width*shape + other*math.sin(a)*width*depth*shape))
        if i:
            for k in range(sides):
                faces.append(((i-1)*sides+k,(i-1)*sides+(k+1)%sides,i*sides+(k+1)%sides,i*sides+k))
    faces += [tuple(reversed(range(sides))),tuple(6*sides+k for k in range(sides))]
    return mesh_obj(name,verts,faces,mat,bone)


def orb_ring(name, center, radius, thickness, mat, bone, plane='xz', segments=64):
    c=V(center)
    points=[]
    for i in range(segments+1):
        a=2*PI*i/segments
        d=(math.sin(a)*radius,0,math.cos(a)*radius) if plane=='xz' else (math.sin(a)*radius,math.cos(a)*radius,0)
        points.append(c+V(d))
    return tube(name,points,thickness,mat,bone,sides=6)


def star(name, pos, radius, mat, bone, points=4):
    c=V(pos)
    outline=[]
    for i in range(points*2):
        a=2*PI*i/(points*2)
        r=radius if i%2==0 else radius*.28
        outline.append(c+V((math.sin(a)*r,0,math.cos(a)*r)))
    verts=[tuple(c+V((0,-radius*.18,0))),tuple(c+V((0,radius*.18,0)))]+[tuple(p) for p in outline]
    faces=[]
    for i in range(len(outline)):
        a,b=i+2,(i+1)%len(outline)+2
        faces.extend([(0,a,b),(1,b,a)])
    return mesh_obj(name,verts,faces,mat,bone)


def eye_pair(center, spread, size, family):
    x,y,z=center
    for sign in [-1,1]:
        ex=x+sign*spread
        ell('eye_socket',(ex,y,z),(size*1.1,size*.22,size*1.2),3,'Head')
        ell('eye_white',(ex,y-size*.1,z),(size*.88,size*.2,size*.99),1,'Head')
        ell('eye_iris',(ex-sign*size*.04,y-size*.26,z),(size*.65,size*.12,size*.82),7 if family=='moon' else 6,'Head')
        ell('eye_pupil',(ex-sign*size*.04,y-size*.36,z),(size*.32,size*.055,size*.63),3,'Head')
        ell('eye_catchlight',(ex-size*.2,y-size*.42,z+size*.38),(size*.19,size*.04,size*.23),12,'Head',seg=12,rings=6)
        leaf('brow',(ex-sign*size*.9,y,z+size*1.07),(ex+sign*size*.85,y+.015,z+size*.98),size*.16,0,'Head',depth=.7)


PALETTES = {
    'sun':[(.84,.79,.64),(.98,.94,.79),(.94,.57,.08),(.11,.065,.03),(.12,.29,.08),(.48,.29,.055),(.98,.57,.03),(.72,.83,.79),(.73,.24,.025),(.98,.72,.17),(.35,.5,.11),(.92,.84,.46),(1,.96,.77),(.86,.41,.065),(.4,.57,.23),(.98,.9,.65)],
    'moon':[(.055,.065,.19),(.54,.61,.8),(.16,.2,.41),(.009,.012,.032),(.15,.13,.36),(.31,.24,.55),(.34,.18,.8),(.03,.66,.96),(.035,.32,.48),(.33,.57,.91),(.13,.065,.38),(.67,.78,.94),(.5,.96,1),(.14,.42,.87),(.08,.8,.7),(.33,.4,.61)],
    'star':[(.9,.57,.19),(1,.83,.47),(.98,.59,.055),(.07,.015,.14),(.24,.025,.48),(.47,.08,.69),(.99,.47,.025),(.71,.21,.96),(.79,.27,.045),(1,.75,.08),(.13,.02,.29),(.93,.4,.35),(1,.94,.58),(.92,.81,.44),(.41,.09,.61),(1,.9,.74)]
}


def materials(job):
    global MATS
    MATS=[]
    texdir=Path(job['output'])/'textures'
    texdir.mkdir(parents=True,exist_ok=True)
    n=job['size'][2]
    palette=PALETTES[job['family']]
    arrays=[np.ones((n,n,4),np.float32) for _ in range(3)]
    arrays[1][:,:,:3]=(.5,.5,1)
    for i,color in enumerate(palette):
        x,y=(i%4)*(n//4),(i//4)*(n//4)
        k=n//4
        yy,xx=np.mgrid[0:k,0:k].astype(np.float32)/(k-1)
        grad=.86+.14*yy+.035*np.sin(xx*PI)
        arrays[0][y:y+k,x:x+k,:3]=np.minimum(1,np.array(color)[None,None,:]*grad[:,:,None])
        arrays[2][y:y+k,x:x+k,:3]=(1,.28 if i in (2,5,9) else .68,.78 if i in (2,5,9) and job['family']!='moon' else .0)
    images=[]
    for suffix,arr in zip(['base_color','normal','orm'],arrays):
        im=bpy.data.images.new('atlas_'+suffix,width=n,height=n,alpha=True)
        if suffix!='base_color':im.colorspace_settings.name='Non-Color'
        im.pixels.foreach_set(arr.ravel())
        im.filepath_raw=str(texdir/f"cr_{job['subject_id']}_{job['stage']}_{suffix}.png")
        im.file_format='PNG'
        im.save()
        im.pack()
        images.append(im)
    for i,c in enumerate(palette):
        m=bpy.data.materials.new(f'{i:02d}_'+['body','ivory','gold','ink','accent','bronze','iris','mirror','warm','highlight','leaf','detail','light','secondary','energy','pale'][i])
        m.diffuse_color=(*c,1)
        m.use_nodes=True
        nodes,links=m.node_tree.nodes,m.node_tree.links
        bs=nodes.get('Principled BSDF')
        tex=nodes.new('ShaderNodeTexImage');tex.image=images[0]
        links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        orm=nodes.new('ShaderNodeTexImage');orm.image=images[2]
        sep=nodes.new('ShaderNodeSeparateColor')
        links.new(orm.outputs['Color'],sep.inputs['Color'])
        links.new(sep.outputs['Green'],bs.inputs['Roughness'])
        links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
        normal=nodes.new('ShaderNodeNormalMap')
        tx=nodes.new('ShaderNodeTexImage');tx.image=images[1]
        links.new(tx.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs[0],bs.inputs['Normal'])
        if i==12 or (job['family']=='moon' and i in (7,14)):
            links.new(tex.outputs['Color'],bs.inputs['Emission Color'])
            bs.inputs['Emission Strength'].default_value=1.3 if i==12 else .65
        MATS.append(m)


def wing(sign,base,span,family,index,bone):
    base=V(base)
    # Leading arm and layered overlapping flight feathers, all volumetric.
    tip=base+V((sign*span,-.02,span*(.27 if family=='star' else -.14)))
    tube('wing_leading_arm',[base,base.lerp(tip,.5)+V((0,.02,.16)),tip],[.075,.06,.035],2,bone)
    count=8 if index<2 else 11
    for row in range(2):
        for j in range(count):
            t=j/(count-1)
            p=base.lerp(tip,t*.94)+V((0,-row*.075,-row*.075))
            feather_len=span*(.72-.2*t)*(1 if row==0 else .65)
            end=p+V((sign*feather_len*(.36+.4*t),-.02,-feather_len*(.9-.32*t)))
            leaf('flight_feather',p,end,span*(.075 if row==0 else .06),1 if family=='sun' else 2,bone,depth=.2,bend=(0,-.04,.04))
            if family=='star':
                leaf('feather_ridge',p,end*.98+p*.02,span*.012,9,bone,depth=.3)
    for j in range(6):
        t=j/5
        p=base.lerp(tip,t*.87)+V((0,-.14,.015))
        end=p+V((sign*span*.16,-.015,-span*.4))
        if family=='sun':
            leaf('mirror_feather_frame',p,end,span*.135,2,bone,depth=.22)
            leaf('mirror_feather_glass',p+V((0,-.026,0)),end+V((0,-.026,.035)),span*.105,7,bone,depth=.1)
        else:
            leaf('wing_coverts',p,end,span*.1,9,bone,depth=.25)


def build_sun(job):
    idx=job['index'];chick=idx==0
    # Normalized coordinates are freshly constructed for each canonical stage.
    hipz=.7 if chick else 1.15
    chestz=1.05 if chick else 1.65
    headz=1.72 if chick else 2.45
    hr=.47 if chick else .25
    add_bone('Root',(0,0,0),(0,0,.22),deform=False)
    add_bone('Hips',(0,0,hipz),(0,0,chestz-.1),'Root')
    add_bone('Spine_01',(0,0,chestz-.1),(0,0,chestz+.2),'Hips')
    add_bone('Neck',(0,0,chestz+.2),(0,-.08,headz-.1),'Spine_01')
    add_bone('Head',(0,-.08,headz-.1),(0,-.22,headz+.22),'Neck')
    add_bone('Crown',(0,0,headz+.2),(0,0,headz+.7),'Head')
    add_bone('Tail_01',(0,.2,hipz+.2),(0,.65,hipz-.1),'Hips')
    ell('torso',(0,.08,chestz-.12),(.51 if chick else .34,.37,.56),0,body=True)
    tube('neck',[(0,0,chestz),(0,.02,chestz+.3),(0,-.08,headz)],[.24 if chick else .16,.19 if chick else .105,hr*.65],0,body=True,sides=16)
    ell('skull',(0,-.09,headz),(hr,hr*.79,hr*.9),0,body=True)
    for s,label in [(1,'L'),(-1,'R')]:
        hip=(s*(.25 if chick else .17),.02,hipz)
        knee=(hip[0],.06,.32 if chick else .57)
        ankle=(hip[0],-.015,.12)
        toe=(hip[0],-.29,.065)
        add_bone(label+'_Hind_Upper',hip,knee,'Hips')
        add_bone(label+'_Hind_Lower',knee,ankle,label+'_Hind_Upper')
        add_bone(label+'_Hind_Foot',ankle,toe,label+'_Hind_Lower')
        tube('leg',[hip,knee,ankle],[.085 if chick else .061,.04,.033],2,body=True)
        for d in [-1,0,1]:
            tube('toe',[ankle,(ankle[0]+d*.065,-.16,.055),(ankle[0]+d*.13,-.3+abs(d)*.075,.035)],[.033,.024,.008],2,label+'_Hind_Foot')
        wbase=(s*.28,.05,chestz+.13)
        span=.68 if chick else (1.1 if idx==1 else 1.3)
        wend=(s*(.28+span),.02,chestz+.13)
        add_bone(f'Wing_{label}_01',wbase,wend,'Spine_01')
        wing(s,wbase,span,'sun',idx,f'Wing_{label}_01')
    eye_pair((0,-.09-hr*.73,headz+.015),hr*.48,hr*.29,'sun')
    tube('beak',[(0,-.09-hr*.7,headz-.08),(0,-.09-hr*(1.05 if chick else 1.28),headz-.13),(0,-.09-hr*(1.25 if chick else 1.6),headz-.22)],[hr*.2,hr*.13,.004],2,'Head',sides=4)
    for s in [-1,1]:
        for k in range(4):
            p=(s*hr*.4,-.09-hr*.65,headz+hr*.2-k*hr*.15)
            end=(s*hr*(1.15+.12*k),-.09-hr*.45,headz+hr*(.52-.28*k))
            leaf('cheek_crown_feather',p,end,hr*.21,1,'Head',depth=.35,bend=(0,-.05,-.03))
    # Chest and skirt feathers in curved rows; leaves and green breast jewel.
    for row in range(4 if chick else 6):
        z=chestz+.18-row*.16
        count=7 if row%2==0 else 6
        for j in range(count):
            a=(j-(count-1)/2)*PI/8
            p=(math.sin(a)*(.43 if chick else .29),-.15-math.cos(a)*.19,z)
            length=.33+.07*math.cos(a)+RNG.uniform(-.035,.035)
            leaf('breast_plume',p,(p[0]*1.12,p[1]-.015,z-length),.085 if chick else .065,1 if (row+j)%3 else 0,'Spine_01' if row<2 else 'Hips',depth=.32,bend=(0,-.055,0))
    # Back and rump remain fully modeled and feathered in the turn-around.
    for row in range(5):
        z=chestz+.22-row*.16
        count=7 if row%2==0 else 6
        for j in range(count):
            a=(j-(count-1)/2)*PI/8
            p=(math.sin(a)*(.45 if chick else .3),.12+math.cos(a)*.29,z)
            leaf('back_plume',p,(p[0]*1.1,p[1]+.04,z-.35-RNG.random()*.08),.09 if chick else .075,1 if (j+row)%3 else 0,'Spine_01' if row<2 else 'Hips',depth=.35,bend=(0,.06,0))
    for j in range(7):
        p=((j-3)*.07,.27,hipz+.12)
        leaf('tail_fan',p,((j-3)*.115,.76,hipz-.25),.085,1 if j%2 else 9,'Tail_01',depth=.32,bend=(0,.06,.04))
    for j in range(7):
        a=(j-3)*PI/9
        p=(math.sin(a)*hr*.76,.07+math.cos(a)*hr*.6,headz+hr*.35)
        leaf('nape_feather',p,(p[0]*1.1,p[1]+.05,headz-hr*.5),hr*.2,1,'Head',depth=.4,bend=(0,.06,0))
    for s in [-1,1]:
        for j in range(3):
            p=(s*hr*.15,-.09-hr*.77,headz+hr*(.4-j*.08))
            q=(s*hr*(.8+j*.1),-.09-hr*.64,headz+hr*(.75-j*.2))
            leaf('facial_crown_plume',p,q,hr*.13,1,'Head',depth=.33,bend=(0,-.045,.02))
    for j in range(5):
        x=(j-2)*hr*.15
        p=(x,-.09-hr*.74,headz-hr*.32)
        leaf('chin_plume',p,(x*1.25,-.09-hr*.7,headz-hr*.9+abs(j-2)*hr*.12),hr*.17,1,'Head',depth=.4,bend=(0,-.04,0))
    star('breast_garden_jewel',(0,-.4,chestz+.04),.16,4,'Spine_01')
    # Real circular crown mirror, gold sun-ray bezel, glass surface.
    crownz=headz+hr+.23
    radius=.23 if chick else .22
    orb_ring('crown_bezel',(0,-.035,crownz),radius,.035,2,'Crown')
    ell('crown_mirror',(0,-.035,crownz),(radius*.94,.026,radius*.94),7,'Crown',seg=32,rings=12)
    for k in range(8):
        a=k*PI/4
        p=V((math.sin(a)*radius,-.035,crownz+math.cos(a)*radius))
        q=p+V((math.sin(a)*.13,0,math.cos(a)*.13))
        leaf('sun_ray',p,q,.045,2,'Crown',depth=.5)
    for s in [-1,1]:
        if idx>=1:
            tube('cloud_tube',[(s*.3,.18,chestz+.2),(s*.59,.18,chestz+.57),(s*.75,.13,chestz+.45),(s*.74,.1,chestz+.24)],[.037]*4,2,'Spine_01')
        for k in range(6 if idx==0 else 9):
            p=(s*(.37+.037*k),-.08,chestz+.22+math.sin(k*.6)*.055)
            ell('garden_leaf',p,(.065,.06,.025),4,'Spine_01',seg=10,rings=6)
            if k%3==0:
                ell('flower_center',(p[0],p[1]-.025,p[2]+.045),(.022,.018,.022),9,'Spine_01',seg=10,rings=6)
                for j in range(5):
                    a=j*2*PI/5
                    ell('flower_petal',(p[0]+math.sin(a)*.036,p[1]-.026,p[2]+.045+math.cos(a)*.036),(.024,.012,.024),1,'Spine_01',seg=8,rings=4)
        if idx>=2:
            ell('cloud_reservoir',(s*.62,.15,chestz+.39),(.13,.13,.13),7,'Spine_01',seg=16,rings=8)
            orb_ring('reservoir_band',(s*.62,.15,chestz+.39),.14,.018,2,'Spine_01',plane='xy',segments=24)
    if idx>=2:
        center=(0,.26,chestz+.46)
        for ring in range(3 if idx==3 else 1):
            bn=add_bone('Array_'+str(ring+1),center,(0,.26,center[2]+.2),'Spine_01')
            r=.84+ring*.27
            orb_ring('solar_array',center,r,.024,2,bn,segments=72)
            orb_ring('solar_array_light',(0,.23,center[2]),r-.044,.009,12,bn,segments=72)
            for k in range(12+ring*4):
                a=k*2*PI/(12+ring*4)
                p=(math.sin(a)*r,.24,center[2]+math.cos(a)*r)
                orb_ring('array_mirror_bezel',p,.09,.016,2,bn,segments=20)
                ell('array_mirror',p,(.081,.022,.081),7,bn,seg=16,rings=8)
                if idx==3 and k%2==0:
                    star('corona_spark',(p[0],.2,p[2]),.13,12,bn)
        for s in [-1,1]:
            tube('array_mount',[(s*.25,.17,chestz),(s*.48,.25,chestz+.3),(s*.68,.26,chestz+.6)],[.045,.035,.025],2,'Spine_01')
    return dict(head=(0,-.22,headz),mouth=(0,-.65,headz-.15),front=(0,-.4,chestz),core=(0,0,chestz),pet=(0,-.1,headz+hr),height=3)


def build_quad(job):
    idx=job['index'];wolf=job['family']=='moon';baby=idx==0
    # Short puppy / foal proportions evolve into long-limbed adult silhouettes.
    bodyz=(.86 if baby else 1.17) if wolf else (1.18 if baby else 1.42)
    length=(.66 if baby else 1.04) if wolf else (.76 if baby else 1.0)
    width=(.38 if baby else .46 if idx>=2 else .4) if wolf else (.31 if baby else .34)
    headz=(1.4 if baby else 1.86) if wolf else (2.02 if baby else 2.37)
    heady=-length-(.1 if wolf else .09)
    hr=(.43 if baby else .35 if idx>=2 else .31) if wolf else (.32 if baby else .26)
    add_bone('Root',(0,0,0),(0,0,.2),deform=False)
    add_bone('Hips',(0,length*.66,bodyz),(0,length*.25,bodyz),'Root')
    add_bone('Spine_01',(0,length*.25,bodyz),(0,-length*.35,bodyz+.03),'Hips')
    add_bone('Spine_02',(0,-length*.35,bodyz+.03),(0,-length*.72,bodyz+.12),'Spine_01')
    add_bone('Neck',(0,-length*.72,bodyz+.12),(0,heady+.08,headz-.12),'Spine_02')
    add_bone('Head',(0,heady+.08,headz-.12),(0,heady-.28,headz+.13),'Neck')
    ell('ribcage',(0,-length*.16,bodyz),(width,length*.83,.4 if wolf else .39),0,body=True)
    ell('haunches',(0,length*.52,bodyz-.015),(width*.95,length*.5,.36),0,body=True)
    ell('chest',(0,-length*.64,bodyz+.02),(width*.95,.32,.43),0,body=True)
    tube('neck',[(0,-length*.67,bodyz+.08),(0,heady+.16,(bodyz+headz)/2),(0,heady,headz)],[.34 if wolf and idx>=2 else .27 if wolf else .28,.29 if wolf and idx>=2 else .23 if wolf else .2,hr*.72],0,body=True,sides=16)
    ell('skull',(0,heady,headz),(hr,hr*.9,hr*1.02),0,body=True)
    muzzle_z=headz-(hr*.25 if wolf else hr*.62)
    muzzle_y=heady-hr*(.95 if wolf else .78)
    ell('muzzle_bridge',(0,muzzle_y+.07,muzzle_z+.05),(hr*.7,hr*.8,hr*(.48 if wolf else .74)),0,body=True)
    ell('muzzle',(0,muzzle_y-.1,muzzle_z-.035),(hr*.72,hr*.48,hr*.42),1,'Head')
    if wolf:
        ell('nose',(0,muzzle_y-.24,muzzle_z+.055),(hr*.31,hr*.17,hr*.16),3,'Head',seg=16,rings=8)
        tube('muzzle_seam',[(0,muzzle_y-.235,muzzle_z+.01),(0,muzzle_y-.242,muzzle_z-.06),(.1,muzzle_y-.2,muzzle_z-.095)],[.009]*3,3,'Head',sides=6)
        tube('muzzle_seam_l',[(0,muzzle_y-.242,muzzle_z-.06),(-.1,muzzle_y-.2,muzzle_z-.095)],[.009]*2,3,'Head',sides=6)
    else:
        for s in [-1,1]:
            ell('nostril',(s*hr*.43,muzzle_y-.19,muzzle_z+.005),(hr*.12,hr*.05,hr*.12),8,'Head',seg=12,rings=6)
    eye_pair((0,heady-hr*.77,headz+hr*.13),hr*.61,hr*(.36 if baby else .29),job['family'])
    for s,label in [(1,'L'),(-1,'R')]:
        ep=(s*hr*.72,heady+.025,headz+hr*.65)
        et=(s*hr*1.05,heady+.05,headz+hr*(1.8 if wolf else 1.9))
        add_bone(label+'_Ear',ep,et,'Head')
        leaf('ear_outer',ep,et,hr*(.52 if wolf else .34),0,label+'_Ear',depth=.37,bend=(s*.03,0,.03))
        leaf('ear_inner',V(ep)+V((0,-.055,.025)),V(et)+V((0,-.055,-.06)),hr*(.36 if wolf else .22),5 if wolf else 11,label+'_Ear',depth=.15)
        for kind,y,parent in [('Front',-length*.65,'Spine_02'),('Hind',length*.65,'Hips')]:
            hip=(s*width*.78,y,bodyz-.03)
            knee=(s*width*.86,y+(.16 if kind=='Hind' else -.035),bodyz*.53)
            ankle=(s*width*.87,y+(.08 if kind=='Hind' else -.06),.19 if wolf else .18)
            toe=(s*width*.87,ankle[1]-.18,.09)
            upper=f'{label}_{kind}_Upper';lower=f'{label}_{kind}_Lower';foot=f'{label}_{kind}_Foot'
            add_bone(upper,hip,knee,parent)
            add_bone(lower,knee,ankle,upper)
            add_bone(foot,ankle,toe,lower)
            tube('limb',[hip,V(hip).lerp(V(knee),.45),knee,ankle],[.18 if wolf else .13,.145 if wolf else .105,.09 if wolf else .065,.065 if wolf else .046],0,body=True,sides=12)
            ell('knee',knee,(.08,.08,.092),0,body=True,seg=12,rings=8)
            if wolf:
                ell('paw',(ankle[0],ankle[1]-.07,.105),(.115,.17,.105),1,foot,seg=16,rings=8)
                for k in [-1,0,1]:
                    ell('toe',(ankle[0]+k*.062,ankle[1]-.18,.075),(.045,.077,.065),1,foot,seg=12,rings=6)
                    if idx==3:
                        leaf('ice_claw',(ankle[0]+k*.062,ankle[1]-.2,.085),(ankle[0]+k*.07,ankle[1]-.3,.025),.03,7,foot,depth=.6)
            else:
                tube('hoof',[(ankle[0],ankle[1]-.01,.045),(ankle[0],ankle[1]-.01,.15),(ankle[0],ankle[1]+.01,.23)],[(.095,.12),(.09,.105),(.062,.07)],4,foot,sides=12)
                leaf('fetlock',V(ankle)+V((0,-.02,.16)),V(ankle)+V((0,-.05,-.1)),.08,1,lower,depth=.3)
    # Three tail bones and thick, curving tail, with layered tufts.
    tailpts=([(0,length*.88,bodyz+.08),(.3,length+.15,bodyz+.04),(.74,length+.3,bodyz+.3),(.9,length+.4,bodyz+.64)] if wolf else [(0,length*.88,bodyz+.18),(.13,length+.32,bodyz-.03),(.23,length+.52,bodyz-.48),(.2,length+.48,.25)])
    for k in range(3):add_bone(f'Tail_{k+1:02d}',tailpts[k],tailpts[k+1],'Hips' if k==0 else f'Tail_{k:02d}')
    for k in range(3):
        a,b=V(tailpts[k]),V(tailpts[k+1])
        tube('tail_core',[a,a.lerp(b,.5),b],[.18,.22,.13 if k<2 else .008],0 if wolf else 4,f'Tail_{k+1:02d}',sides=14)
        if wolf and idx>=2:
            ell('tail_fur_volume',a.lerp(b,.55),(.25,.27,.25),2,f'Tail_{k+1:02d}',seg=16,rings=10)
        for j in range(9 if wolf else 6):
            theta=2*PI*j/(9 if wolf else 6)
            offset=V((math.cos(theta)*.15,0,math.sin(theta)*.13))
            p=a+offset
            q=b+offset*.9+V((math.cos(theta)*.1,.13,math.sin(theta)*.12))
            leaf('tail_lock',p,q,.12,1 if wolf and j%3==0 else (2 if wolf else 5),f'Tail_{k+1:02d}',depth=.55,bend=(.04,.03,.1))
            if j%3==1:
                leaf('tail_energy',p+V((0,-.02,0)),q,.035,7 if wolf else 9,f'Tail_{k+1:02d}',depth=.25)
    if wolf:
        # Overlapping fur follows the torso and wraps across the back and flanks.
        for row in range(8):
            y=-length*.7+row*length*.19
            bn='Spine_02' if row<3 else 'Spine_01' if row<6 else 'Hips'
            for j in range(10):
                a=2*PI*(j+(row%2)*.5)/10
                p=V((math.cos(a)*width*.93,y,bodyz+math.sin(a)*.36))
                q=p+V((math.cos(a)*.08,.25+RNG.random()*.09,-.1))
                coatmat=1 if idx>=2 and j in (0,1,4,5,6,9) and row%3==0 else 0 if (j+row)%4 else 2
                leaf('body_fur_lock',p,q,.14 if idx>=2 else .1,coatmat,bn,depth=.32,bend=(math.cos(a)*.035,0,math.sin(a)*.035))
                if j%3==0 and row%2==0:
                    leaf('body_aurora_tip',p+V((math.cos(a)*.018,-.015,math.sin(a)*.018)),q,.027,7,bn,depth=.25)
        # Dense directional mane and cheek planes, not a sphere-only surrogate.
        for s in [-1,1]:
            for row in range(3 if baby else 5):
                z=headz+.14-row*.17
                for j in range(4):
                    p=(s*(hr*.56+j*.035),heady-hr*.55+j*.07,z)
                    q=(s*(hr*.94+j*.055),heady-hr*.45+j*.1,z-.19)
                    leaf('ruff_lock',p,q,.105 if baby else .18 if idx>=2 else .13,1 if (j==0 and row>1) or (idx>=2 and (row+j)%3==0) else (5 if j%3==0 else 0),'Head' if row<2 else 'Neck',depth=.42)
                    if (j+row)%3==0:
                        leaf('aurora_ruff_edge',V(p)+V((0,-.025,0)),q,.035,7,'Head' if row<2 else 'Neck',depth=.3)
        for row in range(4 if baby else 6):
            z=headz-.25-row*.14
            for j in [-1,0,1]:
                p=(j*.095,heady-.25+row*.045,z)
                leaf('chest_ruff',p,(j*(.18 if idx>=2 else .13),p[1]-.015,z-.35 if idx>=2 else z-.28),.17 if idx>=2 else .12,1 if row%3!=2 else 15,'Neck' if row<2 else 'Spine_02',depth=.4,bend=(0,-.1,0))
        for s in [-1,1]:
            for j in range(9):
                y=-length*.6+j*length*.15
                p=(s*width*.88,y,bodyz+.12+math.sin(j)*.13)
                leaf('flank_fur',p,(s*(width+.095),y+.24,p[2]-.13),.085,2 if j%2 else 0,'Spine_01' if j>3 else 'Spine_02',depth=.5)
                if j%2==0:
                    leaf('aurora_flank',V(p)+V((s*.015,0,0)),(s*(width+.105),y+.21,p[2]-.05),.025,7,'Spine_01' if j>3 else 'Spine_02',depth=.3)
            for j in range(12):
                ell('star_freckle',(s*(width+.015),-.5+RNG.random()*length,bodyz+RNG.uniform(-.12,.22)),(.009,.018,.014),12,'Spine_01',seg=8,rings=4)
        star('tail_starlight',V(tailpts[-1])+V((0,0,.05)),.12,12,'Tail_03')
        if idx==3:
            for j in range(9):
                p=(0,-.52+j*.22,bodyz+.36)
                leaf('dorsal_ice',p,(0,p[1]+.17,p[2]+.35+.1*math.sin(j)),.13,9,'Spine_01' if j>3 else 'Spine_02',depth=.5,bend=(0,.04,.05),sides=6)
                leaf('ice_luminous_facet',V(p)+V((.015,-.025,0)),(0,p[1]+.16,p[2]+.31),.04,7,'Spine_01' if j>3 else 'Spine_02',depth=.3,sides=6)
        for k in range(5):
            p=(RNG.uniform(-.15,.15),heady+.02,headz+hr*.65)
            leaf('forehead_tuft',p,(p[0]*1.8,heady-.1,headz+hr*(1.17+.1*k)),.09,2,'Head',depth=.5,bend=(.03,0,.02))
        star('forehead_star',(0,heady-hr*.9,headz+hr*.53),.048,7,'Head')
    else:
        # Cascading broad purple mane locks plus gold lightning inlays.
        for j in range(15 if baby else 22):
            t=j/(14 if baby else 21)
            z=headz+hr*.7-t*(headz-bodyz+.4)
            y=heady+.13+t*.45
            s=-1 if j%3 else 1
            p=(s*.04,y,z)
            end=(s*(.35+.07*math.sin(j)),y+.22,z-.32)
            leaf('mane_lock',p,end,.12,4 if j%2 else 5,'Head' if t<.27 else 'Neck',depth=.55,bend=(s*.13,-.09,.16))
            if j%2==0:
                leaf('mane_lightning',V(p)+V((0,-.045,0)),V(end)+V((0,-.045,.06)),.025,9,'Head' if t<.27 else 'Neck',depth=.25,bend=(s*.13,-.09,.16))
        for j in range(8 if baby else 12):
            t=j/(7 if baby else 11);s=-1 if j%2 else 1
            p=V((s*.07,heady+.1+t*.28,headz+hr*.7-t*.6))
            points=[p,p+V((s*.22,.09,.07)),p+V((s*.39,.2,-.18)),p+V((s*.31,.31,-.48)),p+V((s*.38,.4,-.62))]
            tube('flowing_mane_curl',points,[.105,.12,.105,.06,.002],4 if j%3 else 5,'Head' if t<.3 else 'Neck',sides=10)
            if j%2==0:
                tube('mane_arc_inlay',[q+V((0,-.09,0)) for q in points],[.018,.022,.02,.012,.001],9,'Head' if t<.3 else 'Neck',sides=6)
        for j in range(5):
            p=(.05,heady,headz+hr*.65+j*.025)
            leaf('forelock',p,(-.34-j*.03,heady-hr*.91,headz+hr*(.6-j*.24)),.1,5,'Head',depth=.5,bend=(-.12,-.12,.08))
        star('forehead_star',(0,heady-hr*.96,headz+hr*.45),.14,12,'Head',points=5)
        if idx>=2:
            # The drawing's crescent-shaped forehead horn, not a straight unicorn cone.
            tube('crescent_horn',[(0,heady-.06,headz+hr*.85),(-.07,heady-.02,headz+hr*1.2),(-.08,heady+.06,headz+hr*1.45),(0,heady+.12,headz+hr*1.65)],[.065,.05,.028,.002],2,'Head',sides=10)
        if idx>=1:
            for s,label in [(1,'L'),(-1,'R')]:
                wbase=(s*.27,-length*.35,bodyz+.27)
                span=.36 if idx==1 else 1.35
                bn=add_bone(f'Wing_{label}_01',wbase,(s*(.27+span),-.27,bodyz+.6),'Spine_02')
                wing(s,wbase,span,'star',idx,bn)
                if idx==3:
                    for j in range(7):
                        t=.08+.9*j/6
                        p=(wbase[0]+s*span*t,wbase[1]-.01,wbase[2]+span*.27*t-.025)
                        leaf('storm_cloud_plume',p,(p[0]+s*.27,.08,p[2]+.45),.16,5,bn,depth=.85,bend=(s*.09,0,.07))
                        leaf('storm_lightning',V(p)+V((0,-.15,0)),(p[0]+s*.23,-.07,p[2]+.42),.023,12,bn,depth=.4,bend=(s*.11,0,.04))
    return dict(head=(0,heady,headz),mouth=(0,muzzle_y-.25,muzzle_z),front=(0,-length-.3,bodyz),core=(0,0,bodyz),pet=(0,heady,headz+hr),height=headz+hr*(1.8 if wolf else 1.9))


def skin_body():
    """Union overlapping anatomy into one watertight deformable surface."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in BODY:o.select_set(True)
    obj=BODY[0];bpy.context.view_layer.objects.active=obj
    bpy.ops.object.join()
    rem=obj.modifiers.new('continuous_anatomy','REMESH');rem.mode='VOXEL';rem.voxel_size=.034;rem.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=obj.modifiers.new('relax_surface','SMOOTH');sm.factor=1.1;sm.iterations=5
    bpy.ops.object.modifier_apply(modifier=sm.name)
    obj.vertex_groups.clear()
    # Four normalized influences; bone segments, not object origins.
    names=[n for n in BONES if n not in ('Root','Crown') and not n.startswith(('Wing_','Array_','Tail_','Socket_')) and not n.endswith(('_Ear','_Foot'))]
    starts=np.array([BONES[n]['head'] for n in names]);ends=np.array([BONES[n]['tail'] for n in names]);d=ends-starts
    coords=np.array([v.co[:] for v in obj.data.vertices]);delta=coords[:,None,:]-starts[None,:,:]
    t=np.clip(np.sum(delta*d[None,:,:],axis=2)/np.sum(d*d,axis=1)[None,:],0,1)
    distances=np.linalg.norm(delta-t[:,:,None]*d[None,:,:],axis=2)
    near=np.argsort(distances,axis=1)[:,:4]
    for n in names:obj.vertex_groups.new(name=n)
    for i in range(len(coords)):
        selected=near[i];weights=1/np.maximum(distances[i,selected],.025)**5
        weights/=sum(weights)
        for k,w in zip(selected,weights):
            if w>.0001:obj.vertex_groups[names[k]].add([i],float(w),'REPLACE')
    obj.name='continuous_body'
    PARTS.append(obj)
    BODY.clear()


def atlas_uv(obj):
    # Joined primitives retain their original UVMap; remove it so exporters and
    # shader default UV inputs use the atlas rather than the whole palette.
    while obj.data.uv_layers:obj.data.uv_layers.remove(obj.data.uv_layers[0])
    uv=obj.data.uv_layers.new(name='uv_pbr_atlas')
    coords=np.array([v.co[:] for v in obj.data.vertices])
    low=coords.min(axis=0);size=np.maximum(coords.max(axis=0)-low,.001)
    for poly in obj.data.polygons:
        mat=obj.data.materials[poly.material_index]
        slot=int(mat.name[:2]);x,y=slot%4,slot//4
        axis=max(range(3),key=lambda k:abs(poly.normal[k]))
        axes=[k for k in range(3) if k!=axis]
        for li in poly.loop_indices:
            v=obj.data.vertices[obj.data.loops[li].vertex_index].co
            u=.12+.76*(v[axes[0]]-low[axes[0]])/size[axes[0]]
            w=.12+.76*(v[axes[1]]-low[axes[1]])/size[axes[1]]
            uv.data[li].uv=((x+u)/4,(y+w)/4)


def assemble(job,landmarks):
    skin_body()
    if job.get('preserve_details'):
        # Fine facial patches and feather tips are protected from whole-model
        # decimation. Allocate the remaining budget to individual large shells.
        target=int(job['size'][1]*.91)
        flexible=[o for o in PARTS if not o.get('detail_priority')]
        for attempt in range(3):
            protected=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in PARTS if o.get('detail_priority'))
            small=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in flexible if sum(len(p.vertices)-2 for p in o.data.polygons)<=12)
            count=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in flexible)-small
            ratio=min(1,max(.02,(target-protected-small)/max(1,count)))
            if ratio>=.999:break
            for o in flexible:
                tris=sum(len(p.vertices)-2 for p in o.data.polygons)
                if tris>12:
                    bpy.context.view_layer.objects.active=o
                    mod=o.modifiers.new('local_surface_budget','DECIMATE');mod.ratio=ratio
                    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in PARTS:o.select_set(True)
    mesh=PARTS[0];bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.join()
    mesh.name=f"cr_{job['subject_id']}_{job['stage']}"
    # Target the middle of the published triangle interval.
    tris=sum(len(p.vertices)-2 for p in mesh.data.polygons)
    target=int(job['size'][1]*.98) if job.get('preserve_details') else int((job['size'][0]+job['size'][1])*.5)
    if job.get('preserve_details') and tris>target:
        raise RuntimeError(f'Protected-detail mesh exceeds budget: {tris} > {target}; no whole-mesh decimation allowed')
    if tris>target:
        dec=mesh.modifiers.new('budget_preserve_silhouette','DECIMATE');dec.ratio=target/tris
        bpy.ops.object.modifier_apply(modifier=dec.name)
    elif not job.get('preserve_details') or tris<job['size'][0]:
        sub=mesh.modifiers.new('subdivide_surface','SUBSURF');sub.subdivision_type='SIMPLE';sub.levels=1
        bpy.ops.object.modifier_apply(modifier=sub.name)
        tris=sum(len(p.vertices)-2 for p in mesh.data.polygons)
        if tris>target:
            dec=mesh.modifiers.new('budget_preserve_silhouette','DECIMATE');dec.ratio=target/tris
            bpy.ops.object.modifier_apply(modifier=dec.name)
    # Decimation interpolates groups at collapsed vertices; enforce the actual
    # four-influence contract again on the final editable and exported mesh.
    for vertex in mesh.data.vertices:
        groups=sorted([(g.group,g.weight) for g in vertex.groups],key=lambda g:g[1],reverse=True)
        keep=groups[:4];total=sum(w for _,w in keep)
        for group,_ in groups:mesh.vertex_groups[group].remove([vertex.index])
        for group,weight in keep:
            if total:mesh.vertex_groups[group].add([vertex.index],weight/total,'REPLACE')
    # Establish metric scale: sun = total standing height; quadrupeds = nose to rump.
    co=[v.co for v in mesh.data.vertices]
    feet={g.index for g in mesh.vertex_groups if g.name.endswith('_Foot')}
    footverts=[v.co.z for v in mesh.data.vertices if any(g.group in feet and g.weight>.7 for g in v.groups)]
    zmin=min(footverts) if footverts else min(v.z for v in co)
    if job['family']=='sun':extent=max(v.z for v in co)-zmin
    else:extent=abs(landmarks['mouth'][1])+(.72 if job['index']==0 else 1.1)*.95
    scale=job['dimension_m']/extent
    for v in mesh.data.vertices:v.co=(v.co-V((0,0,zmin)))*scale
    for info in BONES.values():
        info['head']=tuple((V(info['head'])-V((0,0,zmin)))*scale)
        info['tail']=tuple((V(info['tail'])-V((0,0,zmin)))*scale)
    for key in ('head','mouth','front','core','pet'):landmarks[key]=tuple((V(landmarks[key])-V((0,0,zmin)))*scale)
    for name,key,parent in [('Socket_Mouth','mouth','Head'),('Socket_Head','head','Head'),('Socket_Front','front','Spine_01'),('Socket_Core_FX','core','Spine_01'),('Socket_PetTouch','pet','Head'),('Socket_Ground_FX',None,'Root')]:
        p=landmarks[key] if key else (0,0,0)
        add_bone(name,p,V(p)+V((0,0,.12*scale)),parent,False)
    atlas_uv(mesh)
    ad=bpy.data.armatures.new(mesh.name+'_skeleton');rig=bpy.data.objects.new(mesh.name+'_rig',ad)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name,info in BONES.items():
        b=ad.edit_bones.new(name);b.head=info['head'];b.tail=info['tail'];b.use_deform=info['deform']
        if info['parent']:b.parent=ad.edit_bones[info['parent']]
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.show_in_front=True;rig.data.display_type='OCTAHEDRAL'
    arm=mesh.modifiers.new('generic_deformation','ARMATURE');arm.object=rig;arm.use_deform_preserve_volume=False
    mesh.parent=rig
    mesh['source_pack']=job['source_pack'];mesh['source_stage']=job['stage'];mesh['creature_id']=job['stage_data']['creature_id']
    mesh['construction']='Original reference-directed procedural surface modeling in Blender; no pre-existing model.'
    return mesh,rig,scale


def bone_aim(pb,head,tail):
    rest=pb.bone.matrix_local.to_quaternion()
    direction=pb.bone.tail_local-pb.bone.head_local
    rot=direction.rotation_difference(V(tail)-V(head)) @ rest
    pb.matrix=Matrix.Translation(head) @ rot.to_matrix().to_4x4()
    bpy.context.view_layer.update()


def solve_leg(rig,prefix,target):
    up=rig.pose.bones[prefix+'_Upper'];lo=rig.pose.bones[prefix+'_Lower'];ft=rig.pose.bones[prefix+'_Foot']
    a=up.head.copy();target=V(target)
    l1=up.bone.length;l2=lo.bone.length
    d=target-a;dist=max(.001,min(d.length,l1+l2-.0001));axis=d.normalized()
    # Canine/equine front knees flex back; hind stifles flex forward.
    bend=V((0,-1 if 'Hind' in prefix else 1,0));bend=(bend-axis*bend.dot(axis)).normalized()
    h=(l1*l1-l2*l2+dist*dist)/(2*dist)
    knee=a+axis*h+bend*math.sqrt(max(0,l1*l1-h*h))
    ankle=a+axis*dist
    bone_aim(up,a,knee);bone_aim(lo,knee,ankle)
    restdir=ft.bone.tail_local-ft.bone.head_local
    bone_aim(ft,ankle,ankle+restdir)


def animate(job,rig,scale):
    scene=bpy.context.scene;scene.render.fps=30
    clips=[]
    rig.animation_data_create()
    for actiondef in job['actions']:
        aid=actiondef['id'];frames=actiondef['f'];loop=bool(actiondef.get('loop'))
        action=bpy.data.actions.new(f"cr_{job['stage']}_{aid}")
        action.use_fake_user=True
        rig.animation_data.action=action
        for frame in sorted(set(list(range(0,frames+1,2))+[frames])):
            scene.frame_set(frame)
            t=frame/frames;p=2*PI*t;e=math.sin(PI*t)**2
            for pb in rig.pose.bones:
                pb.rotation_mode='QUATERNION';pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
            def rotate(n,x=0,y=0,z=0):
                if n in rig.pose.bones:
                    from mathutils import Euler
                    rig.pose.bones[n].rotation_quaternion=Euler((x,y,z),'XYZ').to_quaternion()
            # Stable, distinct short/long breathing cycles, independent ear and tail movement.
            breath=math.sin(p)*(.012 if aid=='idle_long' else .022)
            rotate('Spine_01',breath,0,0)
            rotate('Neck',-.5*breath,0,.02*math.sin(p))
            rotate('Head',.012*math.sin(p+.4),0,.016*math.sin(p))
            for s,label in [(1,'L'),(-1,'R')]:
                rotate(label+'_Ear',.035*math.sin(p+s*.7),0,s*.025*math.sin(2*p))
                rotate(f'Wing_{label}_01',0,.02*math.sin(p),s*.018*math.sin(p))
            for k in range(1,4):rotate(f'Tail_{k:02d}',.025*math.sin(p-k*.4),.04*math.sin(p-k*.6),.06*math.sin(p-k*.6))
            rotate('Crown',0,.04*math.sin(p),0)
            for k in range(1,4):rotate('Array_'+str(k),0,(.06 if aid=='idle_long' else .1)*math.sin(p+k*.5),0)
            hips=rig.pose.bones['Hips'];root=rig.pose.bones['Root']
            if aid in ('walk','run','sneak'):
                fast=aid=='run';sneak=aid=='sneak'
                stride=(.34 if fast else .22 if not sneak else .15)*scale
                lift=(.13 if fast else .075)*scale
                hips.location.z=(.035 if fast else .014)*scale*(1-math.cos(2*p))-(.1*scale if sneak else 0)
                rotate('Spine_01',(.05 if fast else .015)*math.sin(p),0,.02*math.sin(p))
                bpy.context.view_layer.update()
                legs=[n[:-6] for n in BONES if n.endswith('_Upper')]
                for pre in legs:
                    # Four-beat walk; alternating diagonal trot at speed. Biped bird alternates legs.
                    if job['family']=='sun':phase=0 if pre.startswith('L') else .5
                    elif fast:phase=0 if pre in ('L_Front','R_Hind') else .5
                    else:phase={'L_Hind':0,'L_Front':.25,'R_Hind':.5,'R_Front':.75}[pre]
                    q=(t+phase)%1
                    foot=V(BONES[pre+'_Lower']['tail'])
                    if q<.62:
                        foot.y+=stride*(q/.62-.5)
                    else:
                        w=(q-.62)/.38
                        foot.y+=stride*(.5-w);foot.z+=lift*math.sin(PI*w)
                    solve_leg(rig,pre,foot)
            elif aid.startswith('atk_'):
                ranged='ranged' in aid
                strike=math.sin(PI*min(1,max(0,(t-.18)/.48)))
                rotate('Neck',-.18*e if ranged else -.33*strike,0,0)
                rotate('Head',.16*e if ranged else .2*strike,0,0)
                rotate('Spine_01',.09*e,0,.23*strike if 'sweep' in aid else 0)
                hips.location.y=-.1*scale*e
                for s,label in [(1,'L'),(-1,'R')]:
                    rotate(f'Wing_{label}_01',-.08*e,0,s*(.34 if 'cone' in aid else .17)*e)
                    if 'melee_front' in aid:rotate(f'{label}_Front_Upper',-.65*strike if s==1 else 0,0,0)
                    if 'burst' in aid:rotate(f'{label}_Front_Upper',-.23*e,0,s*.22*e)
                for k in range(1,4):rotate('Array_'+str(k),0,.45*e*(-1 if k%2 else 1),0)
            elif aid=='block':
                hips.location.z=-.14*scale*e;rotate('Neck',.18*e,0,0)
                for s,label in [(1,'L'),(-1,'R')]:rotate(f'Wing_{label}_01',-.4*e,0,-s*.6*e)
            elif aid=='dodge_miss':
                root.location.x=.8*scale*(3*t*t-2*t*t*t)
                rotate('Hips',0,.13*e,-.24*e);hips.location.z=-.12*scale*e
            elif aid=='hit_react':rotate('Spine_01',-.3*e,0,.12*e);rotate('Head',-.2*e,0,0)
            elif aid=='faint':
                f=(3*t*t-2*t*t*t)
                if job['family']=='sun':rotate('Hips',0,0,1.35*f)
                else:rotate('Hips',0,1.45*f,0)
                hips.location.z=-.4*scale*f
                rotate('Neck',.22*f,0,0)
            elif aid in ('sup_self','sup_ally','field_deploy'):
                rotate('Neck',-.17*e,0,.25*e if aid=='sup_ally' else 0)
                rotate('Head',-.13*e,0,0)
                for s,label in [(1,'L'),(-1,'R')]:rotate(f'Wing_{label}_01',0,0,s*.4*e)
                hips.location.z=.08*scale*e
            elif aid=='petted':rotate('Neck',.2*e,0,0);rotate('Head',.14*e,0,.13*math.sin(p)*e)
            elif aid in ('summon_appear','recall_vanish'):
                f=t if aid=='summon_appear' else 1-t
                f=.02+.98*(3*f*f-2*f*f*f)
                root.scale=(f,f,f);rotate('Head',-.12*e,0,0)
            elif aid=='capture_struggle':
                rotate('Spine_01',.12*math.sin(3*p)*e,0,.23*math.sin(4*p)*e)
                rotate('Head',.1*math.sin(3*p)*e,0,.3*math.sin(4*p)*e)
            elif aid in ('overload_enter','overload_exit'):
                rise=e if aid=='overload_enter' else e*.5
                hips.location.z=.16*scale*rise;rotate('Neck',-.22*rise,0,0)
                for s,label in [(1,'L'),(-1,'R')]:rotate(f'Wing_{label}_01',-.1*rise,0,s*.55*rise)
                for k in range(1,4):rotate('Array_'+str(k),0,.8*rise*(-1 if k%2 else 1),0)
            elif aid=='hatch':
                f=math.sin(PI*t)**2
                hips.location.z=.15*scale*f;rotate('Head',.25*math.sin(3*p)*e,0,.17*math.sin(2*p)*e)
                rotate('Neck',.2*math.sin(p)*e,0,0)
            elif aid=='victory':
                rotate('Head',-.22*e,0,.12*math.sin(p)*e);hips.location.z=.12*scale*e
                for s,label in [(1,'L'),(-1,'R')]:rotate(f'Wing_{label}_01',0,0,s*.42*e)
            bpy.context.view_layer.update()
            for pb in rig.pose.bones:
                if pb.name.startswith('Socket_'):continue
                pb.keyframe_insert('location',frame=frame,group=pb.name)
                pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
                pb.keyframe_insert('scale',frame=frame,group=pb.name)
        action['loop']=loop;action['root_motion']=bool(actiondef.get('rm'));action['fps']=30
        for event in actiondef.get('ev',[]):
            name,f=event.split('@');marker=action.pose_markers.new(name);marker.frame=int(f)
        clips.append(dict(id=action.name,action=aid,fps=30,frames=frames,loop=loop,root_motion=bool(actiondef.get('rm')),events=actiondef.get('ev',[])))
        rig.animation_data.action=None
        track=rig.animation_data.nla_tracks.new();track.name=action.name
        strip=track.strips.new(action.name,0,action);strip.action_frame_start=0;strip.action_frame_end=frames
        track.mute=True
    rig.animation_data.action=bpy.data.actions.get(f"cr_{job['stage']}_idle")
    scene.frame_start=0;scene.frame_end=120;scene.frame_set(0)
    return clips


def setup_render(mesh):
    scene=bpy.context.scene
    if scene.world is None:scene.world=bpy.data.worlds.new('review_world')
    scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.world.color=(.12,.12,.12)
    scene.view_settings.view_transform='AgX'
    co=[mesh.matrix_world@V(c) for c in mesh.bound_box]
    low=V(tuple(min(v[i] for v in co) for i in range(3)));high=V(tuple(max(v[i] for v in co) for i in range(3)))
    center=(low+high)/2;extent=max(high-low)
    collection=bpy.data.collections.new('STUDIO_do_not_export');scene.collection.children.link(collection)
    def to_studio(obj):
        for c in list(obj.users_collection):c.objects.unlink(obj)
        collection.objects.link(obj)
    for name,loc,energy,size,color in [('key',(-3,-4,5),1100,4,(1,.89,.74)),('fill',(4,-2,3),850,3,(.65,.79,1)),('rim',(1,4,4),1300,3,(.9,.95,1))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=energy*extent**2/9;data.shape='DISK';data.size=size*extent/3;data.color=color
        obj=bpy.data.objects.new(name,data);collection.objects.link(obj);obj.location=center+V(loc)*extent/3
        obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    camdata=bpy.data.cameras.new('review_camera');cam=bpy.data.objects.new('review_camera',camdata);collection.objects.link(cam);scene.camera=cam
    camdata.type='ORTHO';camdata.ortho_scale=extent*1.25
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-extent*.012))
    plane=bpy.context.object;plane.name='studio_floor';to_studio(plane)
    floor=bpy.data.materials.new('studio_floor');floor.diffuse_color=(.038,.048,.075,1);floor.use_nodes=True
    floor.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.038,.048,.075,1);floor.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
    plane.data.materials.append(floor)
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.09,.15,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    return cam,center,extent,collection


def render_views(job,mesh,rig):
    out=Path(job['output'])/'images';out.mkdir(exist_ok=True)
    cam,center,extent,studio=setup_render(mesh)
    for suffix,direction in [('front',(0,-5,.12)),('side',(5,0,.12)),('back',(0,5,.12)),('three_quarter',(3.5,-5,1.1))]:
        cam.location=center+V(direction)*extent
        cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        bpy.context.scene.render.filepath=str(out/f'{mesh.name}_model_{suffix}.png')
        bpy.ops.render.render(write_still=True)
    # Inspect movement mid-stride, not only the rest pose.
    rig.animation_data.action=bpy.data.actions.get(f"cr_{job['stage']}_walk")
    bpy.context.scene.frame_set(8)
    cam.location=center+V((3.5,-5,1.1))*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.scene.render.filepath=str(out/f'{mesh.name}_walk_frame_08.png');bpy.ops.render.render(write_still=True)
    rig.animation_data.action=bpy.data.actions.get(f"cr_{job['stage']}_idle");bpy.context.scene.frame_set(0)
    studio.hide_viewport=True
    return studio


def reference_images(job,scale):
    refs=bpy.data.collections.new('REFERENCE_original_front_and_turnaround');bpy.context.scene.collection.children.link(refs)
    for kind in ['front','turnaround']:
        path=Path(job['source_dir'])/'images'/f"cr_{job['subject_id']}_{job['stage']}_{kind}.png"
        im=bpy.data.images.load(str(path));im.pack()
        obj=bpy.data.objects.new('reference_'+kind,None);refs.objects.link(obj);obj.empty_display_type='IMAGE';obj.data=im
        obj.empty_display_size=3*scale;obj.location=(0,2*scale,1.4*scale);obj.rotation_euler=(PI/2,0,0);obj.hide_render=True
    refs.hide_viewport=True;refs.hide_render=True


def export(job,mesh,rig,clips,clip_filter=None):
    out=Path(job['output']);models=out/'models';models.mkdir(exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    for track in rig.animation_data.nla_tracks:track.mute=True
    # ACTIONS mode exports each real armature action as an independent named clip.
    bpy.ops.export_scene.gltf(filepath=str(models/(mesh.name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_all_influences=False,export_def_bones=False,export_cameras=False,export_lights=False,export_extras=True)
    bpy.ops.export_scene.fbx(filepath=str(models/(mesh.name+'.fbx')),use_selection=True,object_types={'MESH','ARMATURE'},axis_forward='-Z',axis_up='Y',add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,path_mode='COPY',embed_textures=True)
    # The same armature and baked poses are provided as per-clip FBX deliveries.
    animdir=out/'anims';animdir.mkdir(exist_ok=True)
    for clip in clips:
        if clip_filter is not None and clip['action'] not in clip_filter:continue
        rig.animation_data.action=bpy.data.actions[clip['id']]
        bpy.context.scene.frame_end=clip['frames']
        bpy.ops.export_scene.fbx(filepath=str(animdir/(clip['id']+'.fbx')),use_selection=True,object_types={'ARMATURE'},axis_forward='-Z',axis_up='Y',add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True)
    rig.animation_data.action=bpy.data.actions.get(f"cr_{job['stage']}_idle");bpy.context.scene.frame_end=120;bpy.context.scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=str(models/(mesh.name+'.blend')),compress=True)


def document(job,mesh,rig,clips):
    out=Path(job['output'])
    rigdata=dict(spec='cosmimera-generic-rig/1',subject_id=job['subject_id'],stage=job['stage'],creature_id=job['stage_data']['creature_id'],units='meters',blender_up='Z',blender_forward='-Y',export_up='Y',export_forward='-Z',bones=[dict(name=n,**v) for n,v in BONES.items()],influences_max=4,weight_method='Normalized inverse segment-distance weights on continuous anatomy; rigid attachment weights for individual feathers, mane locks, eyes, mirrors and accessories.')
    write_json(out/'rig/rig_spec.json',rigdata)
    write_json(out/'anims/anim_spec.json',dict(fps=30,clips=clips,events_require_engine_import=True,notes='Locomotion keys use analytic two-link limb posing and stance/swing foot paths. Events are Blender action pose markers and JSON sidecar events; glTF has no standard event representation.'))
    report=dict(source_pack=job['source_pack'],source_drive_id=job['source_drive_id'],source_stage=job['stage'],method='Original reference-directed Blender procedural surface modeling, not a learned image-to-3D reconstruction.',blender=bpy.app.version_string,triangles=sum(len(p.vertices)-2 for p in mesh.data.polygons),budget=job['size'][:2],bones=len(rig.data.bones),materials=len(mesh.data.materials),texture_resolution=job['size'][2],clips=len(clips),normal_map='Neutral tangent-space normal; geometric detail is modeled into the mesh. No high-poly normal bake is claimed.',review_status='technical_validation_pending',visual_status='review_required',limitations=['Stylized reconstructed interpretation; not pixel-identical to the concept art.','Broad color/normal/ORM UV atlas; detailed painted linework is represented by geometry/color regions, not reproduced illustration strokes.','No game-engine retarget/import acceptance has been performed.'],research=[{'url':'https://www.allaboutbirds.org/guide/Great_Egret/lifehistory','use':'Heron reference: upright wading and neck configuration; fantasy mirror apparatus is original.'},{'url':'https://wolf.org/wolf-info/basic-wolf-info/wolf-faqs/','use':'Canid reference: feet, flexible toes, sustained trot.'},{'url':'https://equipedia.ifce.fr/en/equipedia-the-universe-of-the-horse-ifce/riding/olympic-disciplines/dressage/the-horses-natural-gaits','use':'Equine walk uses four beats; trot uses diagonal pairs. Fantasy wings and lightning are original.'}])
    write_json(out/'review/build_report.json',report)
    shutil.copy2(job['prompt'],out/'review/execution_prompt.md')
    files=[]
    for p in sorted(out.rglob('*')):
        if not p.is_file() or p.name=='manifest.json' or p.suffix=='.blend1':continue
        rel=p.relative_to(out).as_posix();ext=p.suffix
        kind='view' if rel.startswith('images/') else 'anim' if rel.startswith('anims/') and ext=='.fbx' else 'model' if rel.startswith('models/') else 'spec' if ext=='.json' else 'report'
        files.append(dict(path=rel,kind=kind,level='L1',sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
    write_json(out/'manifest.json',dict(spec='cosmimera-art-task/1',task_header=job['header'],task_id=job['task_id'],task_type='creature-model-rig',subject_id=job['subject_id'],stage=job['stage'],produced_by='Codex / Blender '+bpy.app.version_string,source_pack=job['source_pack'],files=files,missing=[],notes='Editable Blender source and direct GLB/FBX export. Reference-directed procedural reconstruction; review/build_report.json records material and likeness limitations. Technical verification is independent of visual/game acceptance.'))


def main():
    global JOB,PARTS,BODY,BONES,MATS,RNG
    ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only');ap.add_argument('--skip-render',action='store_true')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    jobs=json.loads(Path(args.jobs).read_text(encoding='utf8'))
    for job in jobs:
        if args.only and f"{job['family']}:{job['stage']}" not in args.only.split(','):continue
        JOB=job;PARTS=[];BODY=[];BONES={};MATS=[];RNG=random.Random(111+job['index'])
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.preferences.filepaths.save_version=0
        Path(job['output']).mkdir(parents=True,exist_ok=True)
        print('STAGE_START',job['family'],job['stage'],flush=True)
        materials(job)
        landmarks=build_sun(job) if job['family']=='sun' else build_quad(job)
        mesh,rig,scale=assemble(job,landmarks)
        clips=animate(job,rig,scale)
        reference_images(job,scale)
        if not args.skip_render:render_views(job,mesh,rig)
        export(job,mesh,rig,clips)
        document(job,mesh,rig,clips)
        print('STAGE_DONE',job['task_id'],flush=True)


if __name__=='__main__':main()
