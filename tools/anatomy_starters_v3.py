"""Species-first structural prototypes; no V1/V2 body, face, wing or motion reuse.

Uses primitive/export utilities only from blender_starters. This is a design
prototype, not a final art, topology-budget, texture or animation delivery.
Blender --background --python tools/anatomy_starters_v3.py -- --jobs PATH --only moon:adult
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector, Matrix, Euler
from mathutils.kdtree import KDTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import blender_starters as b

V=Vector
PI=math.pi
SAMPLES=[]
LEGS={}
WINGS={}
FEATHERS=[]
AXIAL=[]
SCALE=1
BODYOBJ=None


def region(obj,names):
    """Keep anatomical ownership for skin transfer after voxel union."""
    for vert in obj.data.vertices:SAMPLES.append((tuple(vert.co),tuple(names)))
    return obj


def ell(name,p,scale,mat=0,names=None,bone=None):
    ob=b.ell(name,p,scale,mat,bone,body=names is not None,seg=24,rings=16)
    if names:region(ob,names)
    return ob


def tube(name,pts,radii,mat=0,names=None,bone=None,sides=16):
    ob=b.tube(name,pts,radii,mat,bone,body=names is not None,sides=sides)
    if names:region(ob,names)
    return ob


def curved_tube(name,points,radii,mat=0,names=None,bone=None):
    pts=[V(p) for p in points];dense=[];widths=[]
    for i in range(len(pts)-1):
        p0,p1,p2,p3=pts[max(0,i-1)],pts[i],pts[i+1],pts[min(len(pts)-1,i+2)]
        for j in range(5):
            t=j/5;dense.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
            a,c=radii[i],radii[i+1]
            widths.append(tuple(x*(1-t)+y*t for x,y in zip(a,c)) if isinstance(a,tuple) else a*(1-t)+c*t)
    dense.append(pts[-1]);widths.append(radii[-1])
    return tube(name,dense,widths,mat,names,bone,sides=20)


def orient_ell(name,center,normal,scale,mat,bone):
    """A curved eye/lid seated on the side of a skull, with its own frame."""
    n=V(normal).normalized();a=V((0,0,1)).cross(n).normalized();up=n.cross(a)
    verts=[];faces=[]
    for j in range(13):
        phi=PI*j/12
        for k in range(24):
            theta=2*PI*k/24
            verts.append(tuple(V(center)+a*(scale[0]*math.sin(phi)*math.cos(theta))+up*(scale[1]*math.cos(phi))+n*(scale[2]*math.sin(phi)*math.sin(theta))))
    for j in range(12):
        for k in range(24):faces.append((j*24+k,j*24+(k+1)%24,(j+1)*24+(k+1)%24,(j+1)*24+k))
    return b.mesh_obj(name,verts,faces,mat,bone)


def eyes(center,rx,ry,rz,size,family):
    for s in [-1,1]:
        angle=.52 if family=='moon' else .82 if family=='star' else .7
        normal=V((s*angle,-math.sqrt(1-angle*angle),.04)).normalized()
        c=V(center)+V((normal.x*rx,normal.y*ry,rz*.12))
        orient_ell('orbital_rim',c,normal,(size*1.13,size*1.08,size*.35),0,'Head')
        orient_ell('curved_sclera',c+normal*size*.15,normal,(size,size*.92,size*.32),1,'Head')
        orient_ell('iris',c+normal*size*.43,normal,(size*.64,size*.74,size*.075),7 if family=='moon' else 6,'Head')
        orient_ell('pupil',c+normal*size*.5,normal,(size*.28,size*.52,size*.035),3,'Head')
        orient_ell('eye_glint',c+normal*size*.54+V((-size*.17,0,size*.3)),normal,(size*.14,size*.14,size*.025),12,'Head')


def leaf(name,start,end,width,mat,bone,normal=(0,0,1),thickness=.018):
    """A curved tapered closed feather; thickness follows the wing surface."""
    a,z=V(start),V(end);d=(z-a).normalized();n=V(normal);n=(n-d*n.dot(d)).normalized();side=d.cross(n).normalized()
    verts=[];faces=[];steps=9
    for j in range(steps):
        t=j/(steps-1);w=width*(math.sin(PI*t*.96)**.65+.015)*(1-t*.55)
        c=a.lerp(z,t)+n*math.sin(PI*t)*thickness*.7
        for k in range(6):
            q=2*PI*k/6
            verts.append(tuple(c+side*math.cos(q)*w+n*math.sin(q)*thickness*(.2+.8*math.sin(PI*t))))
        if j:
            for k in range(6):faces.append(((j-1)*6+k,(j-1)*6+(k+1)%6,j*6+(k+1)%6,j*6+k))
    faces.extend([tuple(reversed(range(6))),tuple((steps-1)*6+k for k in range(6))])
    return b.mesh_obj(name,verts,faces,mat,bone)


def init_materials(family):
    b.MATS=[]
    for i,c in enumerate(b.PALETTES[family]):
        mat=bpy.data.materials.new(f'{i:02d}_prototype_region')
        mat.diffuse_color=(*c,1);mat.use_nodes=True
        bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1)
        bs.inputs['Roughness'].default_value=.65 if i in (0,1,4,5) else .32
        if i in (2,9) and family!='moon':bs.inputs['Metallic'].default_value=.65
        if i in (6,7):bs.inputs['Roughness'].default_value=.23
        b.MATS.append(mat)


def common_bones(hip,loin,chest,neckpoints,head,headend):
    global AXIAL
    b.add_bone('Root',(0,0,0),(0,0,.2),deform=False)
    b.add_bone('Pelvis',hip,loin,'Root');b.add_bone('Lumbar',loin,chest,'Pelvis')
    b.add_bone('Thorax',chest,neckpoints[0],'Lumbar')
    parent='Thorax';AXIAL=['Pelvis','Lumbar','Thorax']
    for j in range(len(neckpoints)-1):
        name=f'Neck_{j+1}';b.add_bone(name,neckpoints[j],neckpoints[j+1],parent);parent=name;AXIAL.append(name)
    b.add_bone('Head',head,headend,parent);AXIAL.append('Head')


def limb(prefix,points,radii,parent,mat=0,paw=True):
    names=[prefix+'_'+n for n in ('Upper','Lower','Metapodial','Foot')]
    for j in range(4):b.add_bone(names[j],points[j],points[j+1],parent if j==0 else names[j-1])
    LEGS[prefix]=dict(names=names,points=[tuple(p) for p in points],bend=-1 if 'Hind' in prefix else 1)
    # Segment surfaces overlap at joints and merge into one continuous skin.
    for j in range(3):
        a,z=V(points[j]),V(points[j+1]);mid=a.lerp(z,.45)
        candidates=names[max(0,j-1):min(4,j+2)]
        tube('limb_'+prefix,[a,mid,z],[radii[j],(radii[j]+radii[j+1])*.55,radii[j+1]],mat,names=candidates)
    if paw:
        ankle=V(points[3]);center=ankle+V((0,-.07,-.045))
        ell('paw',center,(.105,.155,.08),1,bone=names[3])
        for k in range(4):ell('digit',center+V(((k-1.5)*.042,-.085,-.015)),(.029,.065,.047),1,bone=names[3])
    else:
        ankle=V(points[3]);tube('hoof',[ankle+V((0,-.025,-.13)),ankle+V((0,0,-.04)),ankle+V((0,.01,.055))],[(.085,.105),(.08,.093),(.057,.065)],4,bone=names[3])


def make_ears(center,hr,family):
    for s,label in [(1,'L'),(-1,'R')]:
        base=V(center)+V((s*hr*.68,.025,hr*.65));tip=base+V((s*.06,.035,hr*(1.2 if family=='moon' else 1.5)))
        name=label+'_Ear';b.add_bone(name,base,tip,'Head')
        across=V((hr*(.47 if family=='moon' else .28),0,0))
        # Outer convex cup and recessed inner face; genuine front/back volume.
        verts=[tuple(base-across),tuple(base+across),tuple(tip),tuple(base+V((0,.085,.1))),tuple(base+V((0,-.025,.1)))]
        faces=[(0,3,1),(1,3,2),(2,3,0),(0,1,4),(1,2,4),(2,0,4)]
        b.mesh_obj('ear_cup',verts,faces,0 if family=='moon' else 2,name)
        leaf('ear_inner',base+V((0,-.028,.04)),tip+V((0,-.025,-.05)),hr*.18,5 if family=='moon' else 11,name,normal=(0,-1,0),thickness=.009)


def make_tail(points,widths,mat):
    names=[]
    for j in range(len(points)-1):
        name=f'Tail_{j+1}';b.add_bone(name,points[j],points[j+1],'Pelvis' if j==0 else names[-1]);names.append(name)
    ob=tube('continuous_tail',points,widths,mat,bone=names[0],sides=18)
    # Blend only adjacent tail bones, so the tail cannot pull the torso/legs.
    ob.vertex_groups.clear()
    for name in names:ob.vertex_groups.new(name=name)
    for v in ob.data.vertices:
        ring=v.index//18;u=ring/(len(points)-1)*(len(names)-1);k=min(len(names)-1,int(u));w=u-k
        ob.vertex_groups[names[k]].add([v.index],1-w,'REPLACE')
        if k+1<len(names):ob.vertex_groups[names[k+1]].add([v.index],w,'REPLACE')
    return names


def wings(family,index,shoulderz,shouldery):
    if family=='star' and index==0:return
    span=.37 if index==0 or (family=='star' and index==1) else 1.3
    for s,label in [(1,'L'),(-1,'R')]:
        points=[V((s*.24,shouldery,shoulderz)),V((s*(.24+span*.32),shouldery+.08,shoulderz-.015)),V((s*(.24+span*.7),shouldery-.04,shoulderz)),V((s*(.24+span),shouldery+.06,shoulderz-.02))]
        parent='Thorax';names=[]
        for j in range(3):
            name=f'Wing_{label}_{j}';b.add_bone(name,points[j],points[j+1],parent);parent=name;names.append(name)
            tube('wing_living_volume',[points[j],points[j].lerp(points[j+1],.5),points[j+1]],[.07 if j==0 else .045,.055 if j==0 else .035,.045 if j==0 else .025],0 if family=='sun' else 2,bone=name)
        WINGS[label]=dict(points=[tuple(p) for p in points],names=names,sign=s)
        for group,count,segment in [('secondary',6,1),('primary',7,2)]:
            for k in range(count):
                t=(k+.2)/(count+.3);root=points[segment].lerp(points[segment+1],t)
                if group=='secondary':end=root+V((s*span*.05,span*(.48-.08*t),-.015))
                else:end=root+V((s*span*(.08+.27*t),span*(.47-.16*t),-.025))
                name=f'Feather_{label}_{group}_{k}';b.add_bone(name,root,end,names[segment])
                FEATHERS.append(dict(name=name,parent=names[segment],head=tuple(root),tail=tuple(end),sign=s,group=group,index=k))
                leaf('flight_'+group,root,end,span*(.078 if group=='secondary' else .07),1 if family=='sun' else 2,name,thickness=span*.014)
                # Local top/bottom coverts cover the root rather than all facing front.
                for signz in [-1,1]:leaf('covert',root+V((0,0,signz*.02)),root.lerp(end,.48)+V((0,0,signz*.025)),span*.065,0 if family=='sun' else 9,name,thickness=.012)
                if family=='sun' and index>=1 and k%2==0:
                    leaf('mirror_feather',root+V((0,0,.03)),root.lerp(end,.73)+V((0,0,.03)),span*.055,7,name,thickness=.009)


def build_quad(job):
    wolf=job['family']=='moon';idx=job['index'];baby=idx==0
    length=.72 if baby else (.94 if idx==1 else 1.05)
    bodyz=(.84 if baby else 1.1) if wolf else (1.13 if baby else 1.34)
    width=(.26 if baby else .27 if idx==1 else .35) if wolf else (.27 if baby else .30 if idx==1 else .34)
    headz=(1.24 if baby else 1.61) if wolf else (1.92 if baby else 2.16)
    heady=-length-.2 if wolf else -length-.13
    hr=(.27 if baby else .215 if idx==1 else .255) if wolf else (.235 if baby else .21 if idx==1 else .225)
    neckpts=[(0,-length*.59,bodyz+.12),(0,-length*.88,bodyz+.36),(0,heady+.06,headz-.06)]
    common_bones((0,length*.7,bodyz),(0,length*.21,bodyz),(0,-length*.35,bodyz+.07),neckpts,(0,heady,headz),(0,heady-.3,headz-.1))
    # Distinct ribcage, tucked waist, pelvis and shoulder musculature.
    ell('ribcage',(0,-length*.24,bodyz),(width,length*.71,.36 if wolf else .42),names=['Thorax','Lumbar'])
    ell('waist',(0,length*.28,bodyz+.025),(width*.73,length*.48,.25 if wolf else .32),names=['Lumbar','Pelvis'])
    ell('pelvis_mass',(0,length*.65,bodyz),(width*.94,length*.38,.32 if wolf else .39),names=['Pelvis','Lumbar'])
    ell('brisket',(0,-length*.65,bodyz-.035),(width*.8,.3,.32 if wolf else .42),names=['Thorax'])
    if wolf:
        curved_tube('neck',neckpts,[.29 if idx>=2 else .21,.255 if idx>=2 else .19,.19 if idx>=2 else .17],names=['Thorax','Neck_1','Neck_2','Head'])
        ell('cranium',(0,heady,headz),(hr,hr*.97,hr*.9),names=['Head'])
        # Nasal wedge projects forward, rather than adding a second round muzzle.
        snout=.23 if baby else .39
        tube('nasal_wedge',[(0,heady-.09,headz-.04),(0,heady-.22,headz-.09),(0,heady-snout,headz-.125)],[(hr*.72,hr*.64),(.105,.095),(.075,.065)],names=['Head'])
        muzzle=(0,heady-snout,headz-.145)
        ell('pale_muzzle',(0,heady-snout+.055,headz-.17),(.09,.12,.065),1,bone='Head')
        ell('nose',(0,heady-snout-.05,headz-.11),(.072,.035,.045),3,bone='Head')
        eyes((0,heady-.045,headz+.02),hr*.91,hr*.83,hr,.077 if baby else .061,'moon')
    else:
        # Neck rises from the breast/withers; poll-to-muzzle axis slopes forward.
        curved_tube('arched_equine_neck',neckpts,[(.27,.34),(.21,.31),(.15,.22)],names=['Thorax','Neck_1','Neck_2','Head'])
        ell('jaw_cheek',(0,heady+.015,headz-.03),(hr*.83,.205,.24),names=['Head'])
        muzzle=(0,heady-.38,headz-.32)
        tube('long_nasal_axis',[(0,heady,headz+.07),(0,heady-.18,headz-.08),muzzle],[(hr*.8,hr*.77),(.12,.155),(.105,.115)],names=['Head'])
        ell('equine_muzzle',muzzle,(.122,.13,.095),1,bone='Head')
        for s in [-1,1]:orient_ell('nostril',V(muzzle)+V((s*.101,-.045,.01)),(s*.8,-.58,0),(.031,.038,.009),8,'Head')
        eyes((0,heady-.055,headz+.045),hr*.87,hr*.66,hr,.072 if baby else .055,'star')
    # A jaw hinge is present even in the structural prototype.
    b.add_bone('Jaw',(0,heady+.06,headz-.1),muzzle,'Head')
    if wolf:ell('lower_jaw',(0,heady-(.1 if baby else .15),headz-.205),(.095,.145 if baby else .22,.045),1,bone='Jaw')
    else:ell('lower_lip',(0,heady-.26,headz-.34),(.088,.18,.032),1,bone='Jaw')
    make_ears((0,heady,headz),hr,job['family'])
    for s,label in [(1,'L'),(-1,'R')]:
        x=s*width*.75;fy=-length*.64;hy=length*.66
        # Real upper arm, elbow, carpus; no featureless vertical sticks.
        sh=(x,fy,bodyz+.16);el=(x,fy+.16,bodyz-.29);car=(x,fy-.015,.35 if wolf else .57);fet=(x,fy-.06,.15 if wolf else .24);toe=(x,fy-.23,.1)
        scap=f'{label}_Scapula';b.add_bone(scap,(x,fy+.16,bodyz+.32),sh,'Thorax')
        ell('shoulder_muscle',(x*.77,fy,bodyz+.01),(.17,.25,.29),names=['Thorax',scap])
        limb(label+'_Front',[sh,el,car,fet,toe],[.12 if wolf else .135,.085,.045,.04],scap,paw=wolf)
        hip=(x,hy,bodyz+.015);st=(x,hy-.25,bodyz-.28);hock=(x,hy+.18,.38 if wolf else .62);fet2=(x,hy+.02,.15 if wolf else .24);toe2=(x,hy-.15,.1)
        ell('thigh_muscle',(x*.82,hy-.025,bodyz-.13),(.17,.26,.32),names=['Pelvis',label+'_Hind_Upper'])
        limb(label+'_Hind',[hip,st,hock,fet2,toe2],[.17,.125,.048,.04],'Pelvis',paw=wolf)
    if wolf:
        points=[(0,length*.92,bodyz+.07),(0,length*1.2,bodyz-.015),(0,length*1.5,bodyz-.18),(0,length*1.7,bodyz-.33)]
        make_tail(points,[.1,.16,.14,.018],0)
        # Coat follows surfaces; a few silhouette tufts instead of stacked plates.
        for s in [-1,1]:
            for j in range(4):
                p=(s*hr*.78,heady+.04+j*.08,headz-.04-j*.045)
                leaf('cheek_ruff',p,(s*(hr+.06),p[1]+.15,p[2]-.08),.055,1 if j<2 else 2,'Head' if j<2 else 'Neck_2',normal=(s,0,.2),thickness=.018)
            for j in range(3):
                p=(s*.12,-length*.7,bodyz+.23-j*.13)
                leaf('chest_coat',p,(s*.14,p[1]-.03,p[2]-.23),.12,1,'Thorax',normal=(0,-1,0),thickness=.022)
            for j in range(3):
                p=(s*(width*.95),-.25+j*.25,bodyz+.05)
                leaf('aurora_surface',p,(p[0],p[1]+.2,p[2]+.12),.018,7,'Thorax' if j==0 else 'Lumbar',normal=(s,0,0),thickness=.005)
        b.star('tail_star',points[-1],.085,12,'Tail_3')
        if idx==3:
            for j in range(6):
                p=(0,-.4+j*.19,bodyz+.35)
                leaf('dorsal_ice',p,(0,p[1]+.16,p[2]+.23),.085,9,'Thorax' if j<2 else 'Lumbar',normal=(1,0,0),thickness=.04)
    else:
        # Neck-back crest, asymmetric fall: avoid two front-facing hair curtains.
        for j in range(8):
            t=j/7;p=V((0,heady+.12+t*.47,headz+.19-t*.52))
            leaf('mane',p,p+V((.18,.17,-.28)),.11,4 if j%2 else 5,'Head' if j<2 else 'Neck_2' if j<5 else 'Neck_1',normal=(1,0,0),thickness=.025)
        make_tail([(0,length*.95,bodyz+.18),(0,length*1.2,bodyz),(0,length*1.36,bodyz-.4),(.06,length*1.48,.22)],[.07,.16,.19,.025],4)
        b.star('forehead_star',(0,heady-.18,headz+.02),.065,12,'Head',points=5)
        if idx>=2:tube('crescent_horn',[(0,heady+.02,headz+.22),(-.055,heady+.035,headz+.38),(-.04,heady+.09,headz+.5),(0,heady+.12,headz+.55)],[.045,.035,.02,.002],2,bone='Head')
        wings('star',idx,bodyz+.36,-length*.31)
    return dict(head=(0,heady,headz),mouth=muzzle,core=(0,0,bodyz),nose_y=muzzle[1],rump_y=length*.98)


def build_bird(job):
    idx=job['index'];baby=idx==0
    bodyz=.83 if baby else 1.43;headz=1.3 if baby else 2.35
    heady=-.25 if baby else -.53;hr=.26 if baby else .155
    neckpts=([(0,-.18,.98),(0,-.21,1.08),(0,-.23,1.18),(0,heady,headz)] if baby else [(0,-.24,bodyz+.19),(0,-.36,bodyz+.45),(0,-.16,headz-.25),(0,heady,headz)])
    common_bones((0,.2,bodyz-.16),(0,.08,bodyz),(0,-.12,bodyz+.04),neckpts,(0,heady,headz),(0,heady-.25,headz))
    ell('deep_keel_thorax',(0,.055,bodyz),(.34 if baby else .275,.42 if baby else .49,.38),names=['Thorax','Lumbar','Pelvis'])
    ell('sternum',(0,-.2,bodyz-.06),(.28 if baby else .22,.28,.3),names=['Thorax'])
    curved_tube('S_neck',neckpts,[.19 if baby else .135,.16 if baby else .095,.13 if baby else .075,.12 if baby else .07],names=['Thorax','Neck_1','Neck_2','Neck_3','Head'])
    ell('avian_skull',(0,heady,headz),(hr,hr*1.38,hr*.87),names=['Head'])
    beakend=(0,heady-(hr+.15 if baby else .64),headz-.055)
    tube('tapered_bill',[(0,heady-hr,headz-.035),(0,heady-hr-.07 if baby else heady-hr-.1,headz-.03),beakend],[.07 if baby else .052,.045,.002],2,bone='Head',sides=8)
    eyes((0,heady-.025,headz+.01),hr*.95,hr*1.12,hr,.071 if baby else .044,'sun')
    b.add_bone('Jaw',(0,heady-.08,headz-.07),beakend,'Head')
    for s,label in [(1,'L'),(-1,'R')]:
        x=s*(.17 if baby else .13)
        points=[(x,.11,bodyz-.18),(x,-.08,bodyz-.35),(x,.13,.29 if baby else .59),(x,-.04,.075),(x,-.31,.04)]
        names=[label+'_Hind_'+n for n in ('Upper','Lower','Metapodial','Foot')]
        for j in range(4):b.add_bone(names[j],points[j],points[j+1],'Pelvis' if j==0 else names[j-1])
        LEGS[label+'_Hind']=dict(names=names,points=points,bend=-1)
        for j in range(3):tube('bird_leg',[points[j],points[j+1]],[.065 if j==0 else .032,.032 if j==0 else .023],2,names=names[max(0,j-1):j+2])
        for k in [-1,0,1]:tube('front_toe',[points[3],(x+k*.06,-.2,.035),(x+k*.11,-.34+abs(k)*.07,.025)],[.023,.018,.004],2,bone=names[3],sides=8)
        tube('hind_toe',[points[3],(x,.12,.03),(x,.2,.025)],[.022,.014,.004],2,bone=names[3],sides=8)
        for k in range(3):
            p=(s*hr*.7,heady+.035,headz+.04+k*.035)
            leaf('nape_plume',p,(s*hr*.95,heady+.26+k*.025,headz+.04-k*.06),.035,1,'Head',normal=(s,0,.3),thickness=.011)
    make_tail([(0,.34,bodyz-.03),(0,.58,bodyz-.13),(0,.78,bodyz-.19)],[.12,.13,.01],1)
    wings('sun',idx,bodyz+.2,-.12)
    b.add_bone('Crown',(0,heady+.03,headz+.13),(0,heady+.03,headz+.46),'Head')
    center=V((0,heady+.035,headz+.35))
    tube('crown_mount',[(0,heady,headz+.12),center],[.025,.02],2,bone='Crown',sides=10)
    b.orb_ring('crown_rim',center,.13,.018,2,'Crown')
    ell('crown_mirror',center,(.114,.017,.114),7,bone='Crown')
    if idx>=2:
        for k in range(1 if idx==2 else 3):
            center=(0,.95+k*.09,bodyz+.36);radius=.59+k*.15
            name='Array_'+str(k+1);b.add_bone(name,center,V(center)+V((0,.13,0)),'Thorax')
            b.orb_ring('array_depth_ring',center,radius,.021,2,name,segments=48)
            for j in range(10):
                a=2*PI*j/10;p=V(center)+V((math.cos(a)*radius,0,math.sin(a)*radius))
                ell('array_mirror',p,(.065,.021,.065),7,bone=name)
            for s in [-1,1]:tube('back_support',[(s*.12,.29,bodyz+.25),(s*.22,.65,bodyz+.49),(s*.28,.95,bodyz+.42)],[.03,.025,.022],2,bone='Thorax')
    return dict(head=(0,heady,headz),mouth=beakend,core=(0,0,bodyz),nose_y=beakend[1],rump_y=.78)


def join_skin(job,landmarks):
    global SCALE,BODYOBJ
    bpy.ops.object.select_all(action='DESELECT')
    for ob in b.BODY:ob.select_set(True)
    body=b.BODY[0];bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
    rem=body.modifiers.new('union_anatomical_volumes','REMESH');rem.mode='VOXEL';rem.voxel_size=.023 if job['index'] else .021;rem.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=body.modifiers.new('surface_relax','SMOOTH');sm.factor=.65;sm.iterations=4;bpy.ops.object.modifier_apply(modifier=sm.name)
    dec=body.modifiers.new('prototype_density','DECIMATE');dec.ratio=.7;bpy.ops.object.modifier_apply(modifier=dec.name)
    tree=KDTree(len(SAMPLES))
    for i,(co,names) in enumerate(SAMPLES):tree.insert(co,i)
    tree.balance();body.vertex_groups.clear()
    for name,info in b.BONES.items():
        if info['deform']:body.vertex_groups.new(name=name)
    for v in body.data.vertices:
        _,i,_=tree.find(v.co);names=[n for n in SAMPLES[i][1] if n in b.BONES]
        dist=[]
        for n in names:
            a,z=V(b.BONES[n]['head']),V(b.BONES[n]['tail']);d=z-a;t=max(0,min(1,(v.co-a).dot(d)/d.length_squared))
            dist.append(((v.co-(a+t*d)).length,n))
        chosen=sorted(dist)[:4];weights=[1/max(d,.04)**4 for d,n in chosen];total=sum(weights)
        for (d,n),w in zip(chosen,weights):body.vertex_groups[n].add([v.index],w/total,'REPLACE')
    body.name='ANATOMY_continuous_region_skinned';BODYOBJ=body
    b.PARTS.append(body);b.BODY=[]
    # Identify the bare structural body before joining all attachment shells.
    anatomy=body.vertex_groups.new(name='QA_BARE_ANATOMY');anatomy.add(list(range(len(body.data.vertices))),1,'REPLACE')
    bpy.ops.object.select_all(action='DESELECT')
    for ob in b.PARTS:ob.select_set(True)
    mesh=body;bpy.context.view_layer.objects.active=mesh;bpy.ops.object.join()
    mesh.name=f"cr_{job['subject_id']}_{job['stage']}_v3_structure"
    footgroups={g.index for g in mesh.vertex_groups if g.name.endswith('_Foot')}
    ground=min(v.co.z for v in mesh.data.vertices if any(g.group in footgroups and g.weight>.9 for g in v.groups))
    if job['family']=='sun':extent=max(v.co.z for v in mesh.data.vertices)-min(v.co.z for v in mesh.data.vertices)
    else:extent=landmarks['rump_y']-landmarks['nose_y']
    SCALE=job['dimension_m']/extent
    shift=V((0,0,ground))
    for v in mesh.data.vertices:v.co=(v.co-shift)*SCALE
    # QA_BARE_ANATOMY is a selection group, never an exported deform influence.
    for info in b.BONES.values():info['head']=tuple((V(info['head'])-shift)*SCALE);info['tail']=tuple((V(info['tail'])-shift)*SCALE)
    for info in LEGS.values():info['points']=[tuple(V(p)-shift) for p in info['points']]
    for info in FEATHERS:info['head']=tuple(V(info['head'])-shift);info['tail']=tuple(V(info['tail'])-shift)
    ad=bpy.data.armatures.new(mesh.name+'_skeleton');rig=bpy.data.objects.new(mesh.name+'_rig',ad);bpy.context.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for n,info in b.BONES.items():
        bone=ad.edit_bones.new(n);bone.head=info['head'];bone.tail=info['tail'];bone.use_deform=info['deform']
        if info['parent']:bone.parent=ad.edit_bones[info['parent']]
    bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
    mod=mesh.modifiers.new('anatomical_skin','ARMATURE');mod.object=rig;mesh.parent=rig
    for ob in (mesh,rig):ob['status']='V3 structure prototype; not final art';ob['source_pack']=job['source_pack']
    return mesh,rig


def rot_world(rig,name,x=0,y=0,z=0):
    if name not in rig.pose.bones:return
    pb=rig.pose.bones[name];rest=pb.bone.matrix_local.to_quaternion();world=Euler((x,y,z),'XYZ').to_quaternion()
    pb.rotation_quaternion=rest.inverted()@world@rest


def pose_wings(rig,fold,flap=0):
    for label,info in WINGS.items():
        s=info['sign'];names=info['names'];p=rig.pose.bones[names[0]].head.copy()
        for j,name in enumerate(names):
            rest=V(b.BONES[name]['tail'])-V(b.BONES[name]['head'])
            folded=V([(s*.18,.93,-.3),(-s*.14,-.96,-.22),(s*.07,.98,-.12)][j]).normalized()*rest.length
            d=rest.lerp(folded,fold);d.normalize();d*=rest.length
            if flap:d=Matrix.Rotation(flap*s,3,'Y')@d
            b.bone_aim(rig.pose.bones[name],p,p+d);p=p+d
        for feather in [f for f in FEATHERS if f['sign']==s]:
            name=feather['name'];pb=rig.pose.bones[name];parent=rig.pose.bones[feather['parent']]
            restparent=parent.bone.matrix_local
            root=parent.matrix@(restparent.inverted()@(V(feather['head'])*SCALE))
            original=(V(feather['tail'])-V(feather['head']))*SCALE
            spread=parent.matrix.to_quaternion()@parent.bone.matrix_local.to_quaternion().inverted()@original
            folded=V((s*.02,1,-.18)).normalized()*original.length
            d=spread.lerp(folded,fold).normalized()*original.length
            b.bone_aim(pb,root,root+d)


def pose_leg(rig,info,foot_target,lift=0):
    names=info['names'];pts=[V(p)*SCALE for p in info['points']]
    # Foot and metapodial direction remain stable during ground support.
    ankle=V(foot_target);meta=(pts[2]-pts[3]);target=ankle+meta
    up=rig.pose.bones[names[0]];a=up.head.copy();d=target-a;distance=d.length;l1=up.bone.length;l2=rig.pose.bones[names[1]].bone.length
    reach=min(l1+l2-.00001,max(abs(l1-l2)+.00001,distance));axis=d.normalized()
    bend=V((0,info['bend'],0));bend=(bend-axis*bend.dot(axis)).normalized()
    along=(l1*l1-l2*l2+reach*reach)/(2*reach);joint=a+axis*along+bend*math.sqrt(max(0,l1*l1-along*along));end=a+axis*reach
    b.bone_aim(up,a,joint);b.bone_aim(rig.pose.bones[names[1]],joint,end)
    ankle=end-meta
    b.bone_aim(rig.pose.bones[names[2]],end,ankle)
    b.bone_aim(rig.pose.bones[names[3]],ankle,ankle+(pts[4]-pts[3]))
    return (ankle-V(foot_target)).length


def motion_defs(job):
    family=job['family'];idx=job['index']
    defs=[('idle',60,True),('walk',48,True),('crouch',60,False)]
    if family=='sun':defs += [('wing_fold',80,False),('flap',48,True),('neck_strike',50,False),('focus',72,False)]
    elif family=='moon':defs += [('trot',32,True),('gallop',26,True),('howl',80,False),('pounce',60,False),('tail_sweep',60,False)]
    else:
        defs += [('trot',32,True),('canter',36,True),('rear',64,False),('kick',52,False)]
        if idx>=1:defs += [('wing_fold',80,False)]
        if idx>=2:defs += [('flap',48,True)]
    return [dict(id=i,f=f,loop=loop) for i,f,loop in defs]


def animate(job,rig):
    scene=bpy.context.scene;scene.render.fps=30;rig.animation_data_create();clips=[];qa=[]
    for actiondef in motion_defs(job):
        aid=actiondef['id'];frames=actiondef['f'];action=bpy.data.actions.new('v3_'+job['stage']+'_'+aid);action.use_fake_user=True;rig.animation_data.action=action
        maxerr=0;contacts=[]
        for frame in range(frames+1):
            scene.frame_set(frame);t=frame/frames;p=2*PI*t;e=math.sin(PI*t)**2
            for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
            fold=.9;flap=0;root=rig.pose.bones['Root'];bodylift=0;targets={n:V(i['points'][3])*SCALE for n,i in LEGS.items()}
            # Very small respiratory change, with stable feet.
            rot_world(rig,'Thorax',x=.006*math.sin(p));rot_world(rig,'Head',z=.025*math.sin(p))
            for j in range(1,4):rot_world(rig,'Tail_'+str(j),z=.08*math.sin(p-j*.6))
            if aid in ('walk','trot','gallop','canter'):
                duty=.68 if aid=='walk' else .52 if aid=='trot' else .42
                stride=(.28 if aid=='walk' else .42 if aid=='trot' else .5)*SCALE
                phases=({'L_Hind':0,'L_Front':.75,'R_Hind':.5,'R_Front':.25} if aid=='walk' else {'L_Hind':0,'R_Front':0,'R_Hind':.5,'L_Front':.5} if aid=='trot' else {'R_Hind':0,'L_Hind':2/3,'R_Front':2/3,'L_Front':1/3} if aid=='canter' else {'R_Hind':0,'L_Hind':.88,'R_Front':.53,'L_Front':.4})
                if job['family']=='sun':phases={'L_Hind':0,'R_Hind':.5}
                for n,i in LEGS.items():
                    q=(t+phases[n])%1;target=targets[n]
                    if q<duty:target.y+=stride*(q/duty-.5)
                    else:
                        u=(q-duty)/(1-duty);target.y+=stride*(.5-u);target.z+=SCALE*(.105 if aid=='walk' else .18)*math.sin(PI*u)
                    if q<duty:contacts.append(dict(frame=frame,limb=n,phase='stance',target_z=target.z))
                bodylift=(.007 if aid=='walk' else .016)*SCALE*(1-math.cos(2*p))-(0 if aid=='walk' else .035*SCALE)
            elif aid=='crouch':bodylift=-.17*SCALE*e;rot_world(rig,'Neck_1',x=-.12*e)
            elif aid=='wing_fold':fold=1-e
            elif aid=='flap':fold=.06;flap=.55*math.cos(p);bodylift=.035*SCALE*math.sin(p)
            elif aid=='neck_strike':
                rot_world(rig,'Neck_1',x=-.3*e);rot_world(rig,'Neck_2',x=.8*e);rot_world(rig,'Neck_3',x=-.5*e)
            elif aid=='focus':fold=.9-.75*e;rot_world(rig,'Crown',x=.4*e)
            elif aid=='howl':rot_world(rig,'Neck_1',x=-.3*e);rot_world(rig,'Neck_2',x=-.3*e);rot_world(rig,'Head',x=-.35*e);rot_world(rig,'Jaw',x=.12*e)
            elif aid=='pounce':
                bodylift=SCALE*(.3*math.sin(PI*t)**4-.13*math.sin(2*PI*t)**2)
                for n in targets:targets[n].z+=max(0,bodylift)
                rot_world(rig,'Thorax',x=.12*math.sin(p))
            elif aid=='tail_sweep':
                for j in range(1,4):rot_world(rig,'Tail_'+str(j),z=.35*math.sin(p-j*.35)*e)
            elif aid=='rear':
                rot_world(rig,'Pelvis',x=-.37*e);bodylift=-.035*SCALE*e
                for n in targets:
                    if 'Front' in n:targets[n]+=V((0,.08,.52))*SCALE*e
            elif aid=='kick':
                rot_world(rig,'Lumbar',x=.05*e)
                for n in targets:
                    if 'Hind' in n:targets[n]+=V((0,.4,.4))*SCALE*e
            # Root is oriented along Z in rest: local Y is the world-up axis.
            root.location=root.bone.matrix_local.to_3x3().inverted()@V((0,0,bodylift))
            bpy.context.view_layer.update()
            if aid in ('walk','trot','gallop','canter'):
                # Correct whole-body support height instead of stretching legs
                # or allowing stance targets to slide when a stride reaches out.
                for attempt in range(24):
                    overflow=0
                    for n,info in LEGS.items():
                        names=info['names'];pts=[V(p)*SCALE for p in info['points']]
                        delta=targets[n]+pts[2]-pts[3]-rig.pose.bones[names[0]].head
                        reach=rig.pose.bones[names[0]].bone.length+rig.pose.bones[names[1]].bone.length
                        overflow=max(overflow,delta.length-reach+.001*SCALE)
                    if overflow<=0:break
                    bodylift-=max(.002*SCALE,overflow*1.1)
                    root.location=root.bone.matrix_local.to_3x3().inverted()@V((0,0,bodylift));bpy.context.view_layer.update()
            for n,info in LEGS.items():maxerr=max(maxerr,pose_leg(rig,info,targets[n]))
            pose_wings(rig,fold,flap)
            bpy.context.view_layer.update()
            for pb in rig.pose.bones:
                pb.keyframe_insert('location',frame=frame,group=pb.name);pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
        action['status']='structural_motion_prototype';action['loop']=actiondef['loop']
        clips.append(dict(id=action.name,action=aid,frames=frames,fps=30,loop=actiondef['loop']))
        qa.append(dict(action=aid,max_foot_target_error_m=maxerr,stance_samples=contacts,design_only=False))
    rig.animation_data.action=bpy.data.actions.get('v3_'+job['stage']+'_idle');scene.frame_start=0;scene.frame_end=60;scene.frame_set(0)
    return clips,qa


def render(job,mesh,rig,clips):
    scene=bpy.context.scene;out=Path(job['output']);review=out/'review';review.mkdir(exist_ok=True)
    cam,center,extent,studio=b.setup_render(mesh)
    # One shared framing envelope across angles and poses, including spread
    # wings. A folded-pose bounding box would crop the open-wing inspection.
    points=[v.co.copy() for v in mesh.data.vertices]
    for clip in clips:
        rig.animation_data.action=bpy.data.actions[clip['id']]
        for fraction in (0,.25,.5,.75,1):
            scene.frame_set(round(clip['frames']*fraction))
            evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
            points.extend(evaluated.matrix_world@V(c) for c in evaluated.bound_box)
    low=V(tuple(min(v[i] for v in points) for i in range(3)));high=V(tuple(max(v[i] for v in points) for i in range(3)))
    center=(low+high)/2;extent=max(high-low)
    rig.animation_data.action=bpy.data.actions['v3_'+job['stage']+'_idle'];scene.frame_set(0)
    scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=512;scene.render.resolution_y=512
    scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
    scene.display.shading.background_type='WORLD';scene.world.color=(.055,.067,.09)
    cam.data.ortho_scale=extent*1.18
    next(o for o in studio.objects if o.name.startswith('studio_floor')).hide_render=True
    for k in range(8):
        angle=2*PI*k/8;cam.location=center+V((math.sin(angle)*6,-math.cos(angle)*6,.1))*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(review/f'view_{k*45:03d}.png');bpy.ops.render.render(write_still=True)
    cam.location=center+V((0,0,6))*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(review/'view_top.png');bpy.ops.render.render(write_still=True)
    # Bare body has its own hidden review duplicate; it exposes structure without fur/wings/rings.
    bare=mesh.copy();bare.data=mesh.data.copy();bpy.context.collection.objects.link(bare);bare.name='QA_BARE_BODY';bare.parent=rig
    import bmesh
    bm=bmesh.new();bm.from_mesh(bare.data);bm.verts.ensure_lookup_table();group=bare.vertex_groups['QA_BARE_ANATOMY'].index;weights=bm.verts.layers.deform.active
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v[weights].get(group,0)<.5],context='VERTS');bm.to_mesh(bare.data);bm.free()
    mesh.hide_render=True;scene.display.shading.color_type='SINGLE';scene.display.shading.single_color=(.56,.61,.68)
    for suffix,d in [('front',(0,-6,.1)),('side',(6,0,.1)),('back',(0,6,.1)),('top',(0,0,6))]:
        cam.location=center+V(d)*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(review/f'bare_{suffix}.png');bpy.ops.render.render(write_still=True)
    bare.hide_render=True;bare.hide_set(True);mesh.hide_render=False;scene.display.shading.color_type='MATERIAL'
    if WINGS:
        rig.animation_data.action=bpy.data.actions.get('v3_'+job['stage']+'_wing_fold') or rig.animation_data.action
        scene.frame_set(40)
        for suffix,d in [('front',(0,-6,.1)),('side',(6,0,.1)),('back',(0,6,.1)),('top',(0,0,6))]:
            cam.location=center+V(d)*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(review/f'open_{suffix}.png');bpy.ops.render.render(write_still=True)
    scene.render.resolution_x=256;scene.render.resolution_y=256
    for clip in clips:
        rig.animation_data.action=bpy.data.actions[clip['id']]
        for i in range(8):
            scene.frame_set(round(clip['frames']*i/7))
            for view,d in [('side',(6,0,.3)),('quarter',(4,-6,1.1))]:
                cam.location=center+V(d)*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(review/f"motion_{clip['action']}_{view}_{i}.png");bpy.ops.render.render(write_still=True)
    rig.animation_data.action=bpy.data.actions['v3_'+job['stage']+'_idle'];scene.frame_set(0)
    cam.location=center+V((4,-6,1.1))*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    studio.hide_viewport=True


def export_and_report(job,mesh,rig,clips,qa):
    out=Path(job['output']);(out/'models').mkdir(exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT');mesh.hide_set(False);mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(out/'models'/(mesh.name+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_extras=True,export_cameras=False,export_lights=False)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'models'/(mesh.name+'.blend')),compress=True)
    b.write_json(out/'rig_spec.json',dict(status='structure prototype',bones=b.BONES,legs=LEGS,wings=WINGS,skinning='Voxel union, anatomical source-region transfer, max 4 segment-distance influences within each region; accessories local rigid or adjacent-chain weights.'))
    b.write_json(out/'motion_spec.json',dict(status='prototype subset, not the former 303-clip delivery',clips=clips,checks=qa))
    b.write_json(out/'build_report.json',dict(status='structure_prototype_pending_review',source_pack=job['source_pack'],family=job['family'],stage=job['stage'],triangles=sum(len(p.vertices)-2 for p in mesh.data.polygons),bones=len(rig.data.bones),scale=SCALE,clips=len(clips),limitations=['No final fur/feather sculpt or texture set.','Fantasy flight and supernatural apparatus are design inventions, not biological claims.','Prototype density/bone count are not final production budgets.','Motion prototypes require performance and deformation polish; no final art acceptance inferred.']))


def main():
    global SAMPLES,LEGS,WINGS,FEATHERS,AXIAL
    ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only');ap.add_argument('--no-render',action='store_true');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    for job in json.loads(Path(args.jobs).read_text(encoding='utf-8-sig')):
        if args.only and job['family']+':'+job['stage'] not in args.only.split(','):continue
        print('ANATOMY_START',job['task_id'],flush=True)
        bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
        b.JOB=job;b.PARTS=[];b.BODY=[];b.BONES={};SAMPLES=[];LEGS={};WINGS={};FEATHERS=[];AXIAL=[]
        Path(job['output']).mkdir(parents=True,exist_ok=True);init_materials(job['family'])
        landmarks=build_bird(job) if job['family']=='sun' else build_quad(job)
        mesh,rig=join_skin(job,landmarks);clips,qa=animate(job,rig)
        if not args.no_render:render(job,mesh,rig,clips)
        b.reference_images(job,SCALE);export_and_report(job,mesh,rig,clips,qa)
        print('ANATOMY_DONE',job['task_id'],flush=True)


if __name__=='__main__':main()
