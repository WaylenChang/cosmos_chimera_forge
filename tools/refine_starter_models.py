"""Second sculpt pass: fitted faces, swept feather/fur locks, raised fan wings,
continuous tails and locally unwrapped painted PBR regions. Same canonical IDs.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector, Matrix

sys.path.insert(0,str(Path(__file__).resolve().parent))
import blender_starters as b

V=Vector
PI=math.pi
old_register=b.register
old_skin=b.skin_body
old_atlas=b.atlas_uv
old_sun=b.build_sun
old_quad=b.build_quad


def local_uv(obj,slot):
    layers=obj.data.uv_layers
    if layers:
        layer=layers[0]
        saved=[tuple(p.uv) for p in layer.data]
        while len(layers)>1:layers.remove(layers[-1])
        layer.name='uv_pbr_atlas'
    else:
        layer=layers.new(name='uv_pbr_atlas')
        co=np.array([v.co[:] for v in obj.data.vertices]);lo=co.min(0);span=np.maximum(co.max(0)-lo,.001)
        saved=[]
        for loop in obj.data.loops:
            p=obj.data.vertices[loop.vertex_index].co
            saved.append(((p.x-lo[0])/span[0],(p.z-lo[2])/span[2]))
    for item,(u,v) in zip(layer.data,saved):item.uv=((slot%4+.07+.86*u)/4,(slot//4+.07+.86*v)/4)


def register(obj,name,mat,bone=None,body=False):
    result=old_register(obj,name,mat,bone,body)
    if not body:local_uv(obj,mat)
    if name.startswith(('eye_','iris','pupil','lid_','nostril','nose_','mirror_pane','ear_inner','mouth_','toe','hoof','crown_mirror','crown_bezel','sun_ray')):obj['detail_priority']=True
    return result


def discard(prefixes):
    for o in list(b.PARTS):
        if any(o.name.startswith(p) for p in prefixes):
            b.PARTS.remove(o);bpy.data.objects.remove(o,do_unlink=True)


def discard_body(prefixes):
    for o in list(b.BODY):
        if any(o.name.startswith(p) for p in prefixes):b.BODY.remove(o);bpy.data.objects.remove(o,do_unlink=True)


def weights_by_path(obj,tvalues,names):
    obj.vertex_groups.clear()
    for n in names:obj.vertex_groups.new(name=n)
    for v,t in zip(obj.data.vertices,tvalues):
        x=min(len(names)-1-.00001,max(0,t*(len(names)-1)))
        i=int(x);f=x-i
        obj.vertex_groups[names[i]].add([v.index],1-f,'REPLACE')
        obj.vertex_groups[names[i+1]].add([v.index],f,'REPLACE')


def blade(name,start,end,width,mat,bone,depth=.12,bend=(0,0,0),sides=4):
    """A swept, sharply tapered lenticular blade; no capsule-like fur pellets."""
    a,z=V(start),V(end);direction=(z-a).normalized()
    across=direction.cross(V((1,0,0)) if 'side_feather' in name else V((0,-1,0)))
    if across.length<.01:across=direction.cross(V((1,0,0)))
    across.normalize();normal=direction.cross(across).normalized()
    outline=[(0,0),(.17,-.65),(.45,-1),(.74,-.85),(1,0),(.74,.85),(.45,1),(.17,.65)]
    verts=[];params=[]
    depth=min(depth,.28) if 'ice' not in name else min(depth,.5)
    center=a.lerp(z,.48)+V(bend)*math.sin(PI*.48)
    verts=[tuple(center+normal*width*depth),tuple(center-normal*width*depth)]
    params=[(.5,.48),(.5,.48)]
    for t,w in outline:
        p=a.lerp(z,t)+V(bend)*math.sin(PI*t)+across*(width*w)
        verts.append(tuple(p));params.append(((w+1)/2,t))
    faces=[]
    for i in range(8):faces.extend([(0,i+2,(i+1)%8+2),(1,(i+1)%8+2,i+2)])
    obj=b.mesh_obj(name,verts,faces,mat,bone)
    obj['detail_priority']=True
    uv=obj.data.uv_layers[0]
    for loop in obj.data.loops:
        u,v=params[loop.vertex_index];uv.data[loop.index].uv=((mat%4+.07+.86*u)/4,(mat//4+.07+.86*v)/4)
    return obj


def catmull(points,steps=5):
    points=[V(p) for p in points];result=[]
    for i in range(len(points)-1):
        a=points[max(0,i-1)];c=points[i];d=points[i+1];e=points[min(len(points)-1,i+2)]
        for k in range(steps):
            t=k/steps
            result.append(.5*((2*c)+(-a+d)*t+(2*a-5*c+4*d-e)*t*t+(-a+3*c-3*d+e)*t*t*t))
    return result+[points[-1]]


def lock(name,points,width,mat,bone,thickness=.3,steps=4):
    path=catmull(points,steps);verts=[];faces=[];ts=[]
    for i,p in enumerate(path):
        t=i/(len(path)-1);direction=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized()
        across=direction.cross(V((0,-1,0)))
        if across.length<.01:across=direction.cross(V((1,0,0)))
        across.normalize();normal=direction.cross(across).normalized()
        w=width*(.26+.74*math.sin(PI*t*.86))*(1-t)**.4+.0005
        for k in range(6):
            angle=k*2*PI/6
            verts.append(tuple(p+across*w*math.cos(angle)+normal*w*thickness*math.sin(angle)));ts.append(t)
        if i:
            for k in range(6):faces.append(((i-1)*6+k,(i-1)*6+(k+1)%6,i*6+(k+1)%6,i*6+k))
    faces+=[tuple(reversed(range(6))),tuple((len(path)-1)*6+k for k in range(6))]
    obj=b.mesh_obj(name,verts,faces,mat,bone)
    uv=obj.data.uv_layers[0]
    for loop in obj.data.loops:
        index=loop.vertex_index;u=(index%6)/5;t=ts[index]
        uv.data[loop.index].uv=((mat%4+.07+.86*u)/4,(mat//4+.07+.86*t)/4)
    return obj


def panel(name,outline,mat,bone,thick=.012):
    points=[V(p) for p in outline];verts=[tuple(p+V((0,y,0))) for y in (-thick/2,thick/2) for p in points]
    n=len(points);faces=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return b.mesh_obj(name,verts,faces,mat,bone)


def fitted_eye(sign,center,w,h,family,adult=False):
    c=V(center);normal=V((sign*.24,-.97,.015)).normalized();across=V((.97,sign*.24,0)).normalized();up=V((0,0,1))
    def lens(name,center,width,height,mat,bulge=.012,tilt=0):
        verts=[tuple(center+normal*min(bulge,.003)),tuple(center-normal*.006)]
        outline=[]
        for j in range(24):
            angle=j*2*PI/24;x=math.cos(angle);z=math.copysign(abs(math.sin(angle))**1.25,math.sin(angle))
            outline.append(center+across*x*width+up*(z*height+sign*x*tilt))
        verts += [tuple(p) for p in outline]
        faces=[]
        for j in range(24):faces.extend([(0,j+2,(j+1)%24+2),(1,(j+1)%24+2,j+2)])
        return b.mesh_obj(name,verts,faces,mat,'Head')
    tilt=h*(.2 if family=='moon' and adult else .08)
    lens('eye_dark_contour',c,w*1.08,h*1.1,3,.007,tilt)
    lens('eye_fitted_sclera',c+normal*.005,w,h,1,.003,tilt)
    iris=c+normal*.012+across*(-sign*w*.07)
    lens('iris_gold' if family!='moon' else 'iris_aurora',iris,w*.69,h*.91,7 if family=='moon' else 6,.011)
    lens('pupil_embedded',iris+normal*.005,w*.38,h*.73,3,.002)
    b.ell('eye_light',iris+normal*.011+across*(-w*.24)+up*h*.4,(w*.17,.006,h*.16),12,'Head',seg=12,rings=6)
    b.ell('eye_small_light',iris+normal*.011+across*(w*.27)-up*h*.28,(w*.075,.004,h*.075),12,'Head',seg=8,rings=4)
    points=[]
    for j in range(9):
        angle=PI*j/8;x=math.cos(angle);z=math.sin(angle)**1.25
        points.append(c+normal*.014+across*x*w+up*(z*h+sign*x*tilt))
    b.tube('lid_upper',points,.009 if adult else .012,3,'Head',sides=6)


def ears(center,hr,hy,headz,family):
    for sign,label in [(1,'L'),(-1,'R')]:
        bone=label+'_Ear';a=V(b.BONES[bone]['head']);z=V(b.BONES[bone]['tail'])
        # Wide triangular shell with a lightly concave front and pointed tip.
        width=hr*(.48 if family=='moon' else .34)
        shell=[a+V((-width,0,-.025)),a+V((width,0,-.025)),z+V((sign*.025,.025,.025)),a+V((-width*.72,0,.17))]
        panel('ear_shell',shell,0 if family=='moon' else 2,bone,.055)
        inner=[p.lerp(sum(shell,V())/4,.22)+V((0,-.035,0)) for p in shell]
        panel('ear_inner',inner,15 if family=='moon' else 11,bone,.016)
        if family=='moon':
            for j in range(3):
                p=a+V(((j-1)*width*.4,-.045,.06+j*.04))
                blade('ear_fur',p,p+V((sign*.06,-.01,.19)),width*.3,1,bone,depth=.18)


def face(job):
    idx=job['index'];family=job['family'];baby=idx==0
    if family=='sun':
        hr=.47 if baby else .25;z=1.72 if baby else 2.45;y=-.09
        discard(['eye_','brow','beak','chin_plume','facial_crown_plume','cheek_crown_feather','nape_feather'])
        for sign in [-1,1]:fitted_eye(sign,(sign*hr*.48,y-hr*.775,z+.035),hr*.32,hr*(.35 if baby else .32),'sun',not baby)
        beak=[(-hr*.19,y-hr*.77,z-.045),(hr*.19,y-hr*.77,z-.045),(0,y-hr*(1.2 if baby else 1.62),z-.18)]
        panel('beak_gold',beak,2,'Head',hr*.15)
        b.tube('beak_seam',[(-hr*.14,y-hr*.81,z-.065),(0,y-hr*1.12,z-.095),(hr*.14,y-hr*.81,z-.065)],.006,5,'Head',sides=6)
        for sign in [-1,1]:
            for k in range(4):
                p=(sign*hr*.42,y-hr*.73,z+hr*(.55-k*.24))
                q=(sign*hr*(1.2+.13*k),y-hr*.36,z+hr*(.95-k*.45))
                blade('swept_face_feather',p,q,hr*.21,1,'Head',depth=.16,bend=(sign*hr*.1,-.02,-hr*.12))
        for k in range(5):
            x=(k-2)*hr*.19
            blade('chin_feather',(x,y-hr*.78,z-hr*.29),(x*1.4,y-hr*.64,z-hr*(.92-abs(k-2)*.14)),hr*.19,1,'Head',depth=.13,bend=(0,-.04,0))
        for k in [-1,0,1]:
            blade('forehead_plume',(k*hr*.2,y-hr*.54,z+hr*.9),(k*hr*.09,y-hr*.86,z+hr*.24),hr*.18,1,'Head',depth=.18,bend=(k*.03,-.06,.04))
        for row in range(3):
            for j in range(7):
                angle=(j-3)*PI/9
                p=(math.sin(angle)*hr*.82,y+math.cos(angle)*hr*.75,z+hr*(.5-row*.32))
                blade('nape_layer',p,(p[0]*1.08,p[1]+.04,p[2]-hr*.52),hr*.22,1,'Head',depth=.12,bend=(0,.04,.02))
        for sign in [-1,1]:
            for row in range(2):
                for j in range(3):
                    p=(sign*hr*.83,y+(j-1)*hr*.26,z+hr*(.35-row*.35))
                    blade('head_side_feather',p,(sign*hr*.94,p[1]+hr*.09,p[2]-hr*.52),hr*.2,1,'Head',depth=.12,bend=(sign*hr*.14,0,.02))
        return
    wolf=family=='moon';length=(.66 if baby else 1.04) if wolf else (.76 if baby else 1.)
    z=(1.4 if baby else 1.86) if wolf else (2.02 if baby else 2.37)
    y=-length-(.1 if wolf else .09);hr=(.43 if baby else .35 if idx>=2 else .31) if wolf else (.32 if baby else .26)
    discard(['eye_','brow','muzzle','nose','nostril','ear_','forehead_star','muzzle_seam'])
    discard_body(['muzzle_bridge'])
    if wolf:
        b.tube('refined_muzzle',[(0,y-.13,z-.1),(0,y-hr*.66,z-.13),(0,y-hr*1.11,z-.14)],[(hr*.7,hr*.43),(hr*.58,hr*.32),(hr*.3,hr*.14)],0,body=True,sides=16)
        for sign in [-1,1]:
            fitted_eye(sign,(sign*hr*.5,y-hr*.77,z+hr*.12),hr*(.33 if baby else .31),hr*(.31 if baby else .235),'moon',not baby)
            blade('white_muzzle_cheek',(sign*hr*.12,y-hr*.94,z-.13),(sign*hr*.8,y-hr*.68,z-.2),hr*.23,1,'Head',depth=.16,bend=(0,-.025,0))
        nosey=y-hr*1.13
        panel('nose_black',[(-hr*.2,nosey,z-.085),(hr*.2,nosey,z-.085),(0,nosey-.035,z-.19)],3,'Head',.035)
        b.tube('nose_glint',[(-hr*.1,nosey-.025,z-.1),(0,nosey-.035,z-.095),(hr*.09,nosey-.025,z-.1)],.008,15,'Head',sides=6)
        for sign in [-1,1]:b.tube('mouth_smile',[(0,nosey+.005,z-.18),(sign*hr*.16,nosey+.02,z-.24),(sign*hr*.33,nosey+.06,z-.21)],.005,3,'Head',sides=6)
    else:
        discard_body(['skull'])
        zs=[z-.47,z-.35,z-.05,z+.22,z+.34]
        radii=[(hr*.43,hr*.48),(hr*.65,hr*.6),(hr*1.14,hr*.78),(hr*1.08,hr*.77),(.035,.035)]
        b.tube('tapered_equine_face',[(0,y-hr*.38,t) for t in zs],radii,0,body=True,sides=20)
        for sign in [-1,1]:
            fitted_eye(sign,(sign*hr*.61,y-hr*1.09,z+.025),hr*.34,hr*.36,'star',not baby)
            b.ell('nostril_inset',(sign*hr*.38,y-hr*1.43,z-.35),(hr*.09,.009,hr*.09),8,'Head',seg=12,rings=6)
        blade('ivory_nose_blaze',(0,y-hr*1.33,z+.25),(0,y-hr*1.36,z-.34),hr*.18,1,'Head',depth=.1,bend=(0,-.005,0))
        b.ell('soft_muzzle',(0,y-hr*.91,z-.34),(hr*.64,hr*.53,hr*.38),1,'Head',seg=24,rings=10)
        b.tube('mouth_line',[(-hr*.3,y-hr*1.39,z-.43),(0,y-hr*1.47,z-.44),(hr*.3,y-hr*1.39,z-.43)],.005,8,'Head',sides=6)
        b.star('forehead_star',(0,y-hr*1.38,z+.23),hr*.48,12,'Head',points=5)
    ears((0,y,z),hr,y,z,family)


def refined_wing(sign,base,span,family,index,bone):
    a=V(base)
    if family=='sun':
        # Framed radial mirror panes over a layered ivory flight-feather fan.
        tip=a+V((sign*span,.02,-span*.08))
        b.tube('wing_leading_arm',[a,a+V((sign*span*.5,0,span*.24)),tip],[.052,.043,.026],2,bone,sides=8)
        for row,count in [(0,9),(1,8),(2,6)]:
            for j in range(count):
                t=j/(count-1)
                p=a+V((sign*span*(.05+.87*t),-.05-row*.035,span*(.14-.18*t)-row*span*.055))
                length=span*(.67-.32*t)*(1-row*.17)
                q=p+V((sign*span*(.12+.16*t),-.015,-length))
                blade('ivory_flight_feather',p,q,span*(.083 if row==0 else .072),1 if (j+row)%4 else 9,bone,depth=.12,bend=(sign*.05,-.015,-.015))
        center=a+V((sign*span*.1,-.15,-span*.07))
        def outer(t):return a+V((sign*span*(.08+.98*t),-.15,span*(.12+.42*math.sin(PI*(.12+.74*t)))))
        for j in range(6):
            l,r=j/6,(j+1)/6
            p,q=outer(l),outer(r)
            outline=[center.lerp(p,.19),center.lerp(q,.19),q,p]
            panel('mirror_gold_frame',outline,2,bone,.025)
            middle=sum(outline,V())/4
            inset=[v.lerp(middle,.14)+V((0,-.017,0)) for v in outline]
            panel('mirror_pane',inset,7,bone,.009)
            # Short, physically modeled white reflection streaks stay within glass.
            b.tube('mirror_reflection',[inset[0].lerp(inset[3],.4)+V((0,-.008,0)),inset[1].lerp(inset[2],.8)+V((0,-.008,0))],.009,12,bone,sides=4)
        return
    # Raised equine wing: long curved primary quills and three staggered covert rows.
    span*=.85 if index>=2 else 1
    def edge(t):return a+V((sign*span*t,.045*t,span*(.73*t+.11*math.sin(PI*t))))
    path=[edge(i/8) for i in range(9)]
    b.tube('golden_wing_spar',path,[.06*(1-i/10) for i in range(9)],2,bone,sides=8)
    for row,count in [(0,11),(1,10),(2,8)]:
        for j in range(count):
            t=j/(count-1);p=edge(.07+.91*t)+V((0,-.035-row*.035,-row*span*.045))
            q=p+V((sign*span*(.24+.19*t)*(1-row*.15),-.015,span*(-.46+.55*t)*(1-row*.2)))
            blade('golden_primary' if row==0 else 'golden_coverts',p,q,span*(.075-row*.014),2 if row==0 else 9,bone,depth=.1,bend=(sign*span*.035,-.015,span*.06))
            if row==0:blade('gold_quill_highlight',p,q,span*.012,13,bone,depth=.1,bend=(sign*span*.035,-.025,span*.075))
    if index==3:
        for j in range(7):
            t=.1+.88*j/6;p=edge(t)+V((0,.045,.025))
            lock('storm_curl',[p,p+V((sign*.15,.02,.21)),p+V((sign*.13,.04,.4)),p+V((-sign*.07,.03,.37))],span*.105,5,bone,thickness=.48)
        lightning=[edge(t)+V((0,-.12,.12+(.04 if i%2 else -.02))) for i,t in enumerate([.08,.2,.27,.39,.46,.58,.68,.76,.87,1.0])]
        b.tube('wing_lightning',lightning,.014,12,bone,sides=5)


def plumage(job):
    baby=job['index']==0;z=1.05 if baby else 1.65
    discard(['breast_plume','back_plume','tail_fan','storm_cloud_plume','storm_lightning'])
    for front in [-1,1]:
        for row in range(4 if baby else 5):
            count=7-row%2
            for j in range(count):
                angle=(j-(count-1)/2)*PI/7.5
                zz=z+.22-row*(.15 if baby else .14)
                x=math.sin(angle)*(.46 if baby else .32)
                y=.07+front*math.cos(angle)*(.33 if baby else .34)
                p=V((x,y,zz));length=(.37 if baby else .43)+b.RNG.uniform(-.04,.04)
                q=p+V((x*.2,front*.045,-length))
                bn='Spine_01' if row<2 else 'Hips'
                blade('layered_body_feather',p,q,.105 if baby else .09,1 if (j+row)%4 else 0,bn,depth=.12,bend=(x*.05,front*.055,.01))
    for sign in [-1,1]:
        for row in range(3):
            for j in range(3):
                p=(sign*(.49 if baby else .33),.07+(j-1)*.16,z+.15-row*.17)
                q=(sign*(.5 if baby else .35),p[1]+.065,p[2]-.39)
                blade('body_side_feather',p,q,.13 if baby else .115,1 if (j+row)%3 else 0,'Spine_01' if row<1 else 'Hips',depth=.12,bend=(sign*.07,.01,.01))
    for j in range(7):
        x=(j-3)*.065;p=(x,.3,.82 if baby else 1.25)
        blade('layered_tail_feather',p,(x*1.5,.82,.45 if baby else .84),.08,1 if j%2 else 9,'Tail_01',depth=.1,bend=(0,.06,.03))
    if job['index']>=2:
        # Embossed breast crest and small filigree curls match the illustrated armor.
        b.star('breast_solar_crest',(0,-.45,z+.04),.19,2,'Spine_01',points=6)
        b.star('breast_crest_core',(0,-.474,z+.04),.095,12,'Spine_01',points=4)
        for s in [-1,1]:
            lock('gold_chest_filigree',[(s*.06,-.43,z+.08),(s*.21,-.4,z+.18),(s*.29,-.35,z+.05),(s*.2,-.39,z-.05)],.022,2,'Spine_01',thickness=.65)


def wolf_coat(job):
    idx=job['index'];baby=idx==0;hr=.43 if baby else .35 if idx>=2 else .31
    length=.66 if baby else 1.04;z=1.4 if baby else 1.86;y=-length-.1;bodyz=.86 if baby else 1.17;width=.38 if baby else .46 if idx>=2 else .4
    discard(['ruff_lock','aurora_ruff_edge','chest_ruff','body_fur_lock','body_aurora_tip','flank_fur','aurora_flank','star_freckle','forehead_tuft','tail_','dorsal_ice','ice_luminous_facet'])
    # Sculpted cheek fans leave eyes and muzzle unobstructed.
    for s in [-1,1]:
        for row in range(3):
            for j in range(3):
                p=(s*hr*(.5+j*.17),y-hr*(.6-j*.3),z+hr*(.35-row*.36)-j*.03)
                q=(s*hr*(1.15+j*.12),y-hr*(.15-j*.3),z+hr*(.36-row*.5)-j*.03)
                blade('swept_cheek_fur',p,q,hr*.17,1 if row==2 else 2 if j%2 else 0,'Head',depth=.12,bend=(s*.07,-.015,.04))
        for j in range(7):
            theta=-PI*.05+j*PI*.17
            p=(s*(.18+.04*j),y+.18+j*.075,z-.13-j*.11)
            q=(s*(.5+.035*j)*(1.12 if idx>=2 else 1),y+.21+j*.1,z-.41-j*.11)
            blade('shoulder_ruff',p,q,.14 if baby else .18,1 if j%3==0 else 2,'Neck' if j<3 else 'Spine_02',depth=.16,bend=(s*.08,-.035,.025))
    for row in range(4 if baby else 5):
        for j in range(5-row%2):
            x=(j-(4-row%2)/2)*(.1 if baby else .115)
            p=(x,y-.24+row*.08,z-.2-row*.15)
            q=(x*1.25,y-.25+row*.08,z-.55-row*.15+abs(x)*.25)
            blade('white_chest_mane',p,q,.13 if baby else .15,1 if (row+j)%4 else 15,'Neck' if row<2 else 'Spine_02',depth=.12,bend=(x*.1,-.07,.03))
    # Forelock follows one sweeping direction instead of standing spikes.
    for j in range(6):
        p=((j-2.5)*hr*.12,y+.01,z+hr*.77)
        q=((j-2)*hr*.24,y-hr*.48,z+hr*(.72-.09*(j%3)))
        blade('wolf_forelock',p,q,hr*.18,2 if j%2 else 0,'Head',depth=.18,bend=(.07,-.04,.15))
    for row in range(3):
        for j in range(7):
            angle=(j-3)*PI/9
            p=(math.sin(angle)*hr*.84,y+math.cos(angle)*hr*.78,z+hr*(.5-row*.34))
            blade('wolf_nape_fur',p,(p[0]*1.14,p[1]+.045,p[2]-hr*.56),hr*.23,2 if (j+row)%3 else 1,'Head',depth=.13,bend=(0,.045,.02))
    for j in range(5):
        t=j/4;p=(0,-length*.6+t*length*1.3,bodyz+.33)
        blade('dorsal_fur',p,(0,p[1]+.38,p[2]-.04),.2,2,'Spine_02' if j<2 else 'Spine_01',depth=.18,bend=(0,0,.045))
        for s in [-1,1]:
            a=(s*width*.83,p[1],bodyz+.14)
            blade('flank_swept_fur',a,(s*(width+.12),p[1]+.32,bodyz-.13),.115,2 if j%2 else 0,'Spine_02' if j<2 else 'Spine_01',depth=.15,bend=(s*.03,0,.02))
            if j%2==0:blade('aurora_flank_mark',V(a)+V((s*.013,-.01,.02)),(s*(width+.13),p[1]+.28,bodyz-.07),.043,7,'Spine_02' if j<2 else 'Spine_01',depth=.08)
    for s in [-1,1]:
        lock('aurora_cheek_mark',[(s*hr*.83,y-hr*.61,z+.01),(s*hr*.96,y-hr*.52,z-.04),(s*hr*.82,y-hr*.48,z-.11)],.04,7,'Head',thickness=.12)
    b.star('forehead_diamond',(0,y-hr*.92,z+hr*.42),.045,7,'Head')
    if idx==3:
        for j in range(8):
            p=(0,-.55+j*.21,bodyz+.33)
            blade('ice_spine',p,(0,p[1]+.2,p[2]+.36+math.sin(j)*.06),.12,9,'Spine_02' if j<3 else 'Spine_01',depth=.4,bend=(0,.02,.06))
            blade('ice_spine_facet',V(p)+V((.012,-.018,0)),(0,p[1]+.19,p[2]+.34),.045,7,'Spine_02' if j<3 else 'Spine_01',depth=.12)
    tail(job)


def tail(job):
    wolf=job['family']=='moon';idx=job['index'];baby=idx==0
    length=(.66 if baby else 1.04) if wolf else (.76 if baby else 1)
    z=(.86 if baby else 1.17) if wolf else (1.18 if baby else 1.42)
    names=['Tail_01','Tail_02','Tail_03']
    control=([(0,length*.8,z+.15),(.25,length+.16,z+.12),(.67,length+.38,z+.26),(.9,length+.4,z+.62),(.8,length+.34,z+.93)] if wolf else [(0,length*.84,z+.19),(.2,length+.22,z+.24),(.41,length+.43,z-.1),(.48,length+.38,z-.52),(.35,length+.3,.19)])
    points=catmull(control,4)
    radii=[]
    for j in range(len(points)):
        t=j/(len(points)-1);r=(.12+.16*math.sin(PI*t)**.8)*(1-t)**.3+.005
        radii.append((r,r*.85))
    obj=b.tube('continuous_tail',points,radii,0 if wolf else 4,names[0],sides=12)
    weights_by_path(obj,[i//12/(len(points)-1) for i in range(len(obj.data.vertices))],names)
    # Wide uninterrupted swept locks overlap and conceal all core joints.
    for k in range(10 if wolf else 9):
        angle=2*PI*k/(10 if wolf else 9)
        strand=[]
        for i,(t,p) in enumerate(zip([0,.25,.5,.75,1],control)):
            direction=(V(control[min(i+1,4)])-V(control[max(0,i-1)])).normalized()
            across=direction.cross(V((0,0,1))).normalized();other=direction.cross(across).normalized()
            offset=(across*math.cos(angle)+other*math.sin(angle))*.24
            strand.append(V(p)+offset*(math.sin(PI*t*.9)+.3))
        strand[-1]+=V((math.cos(angle)*.16,.06,math.sin(angle)*.12))
        ob=lock('tail_fur_ribbon' if wolf else 'flowing_tail_ribbon',strand,.12 if wolf else .14,1 if wolf and k%4==0 else 2 if wolf else 5 if k%2 else 4,names[0],thickness=.23,steps=3)
        steps=(len(ob.data.vertices)//6)-1
        weights_by_path(ob,[i//6/steps for i in range(len(ob.data.vertices))],names)
        if k%3==1:
            mark=[p+V((0,-.035,0)) for p in strand]
            ob=lock('aurora_tail_ribbon' if wolf else 'tail_lightning_inlay',mark,.043 if wolf else .022,7 if wolf else 9,names[0],thickness=.1,steps=3)
            steps=(len(ob.data.vertices)//6)-1;weights_by_path(ob,[i//6/steps for i in range(len(ob.data.vertices))],names)
    if wolf:b.star('tail_star',V(control[-1])+V((0,-.035,.06)),.105,12,'Tail_03')


def horse_mane(job):
    baby=job['index']==0;length=.76 if baby else 1;y=-length-.09;z=2.02 if baby else 2.37;hr=.32 if baby else .26
    discard(['mane_','flowing_mane_curl','forelock','tail_','flowing_tail_','storm_cloud_plume','storm_lightning'])
    for s in [-1,1]:
        for j in range(5 if baby else 7):
            t=j/(4 if baby else 6)
            p=V((s*.04,y+.08+t*.25,z+hr*.78-t*.42))
            path=[p,p+V((s*.23,.03,.08)),p+V((s*(.4+.06*math.sin(j)),.13,-.12)),p+V((s*.34,.25,-.39)),p+V((s*.42,.3,-.53))]
            lock('silken_mane_lock',path,.115 if baby else .13,4 if j%2 else 5,'Head' if t<.25 else 'Neck',thickness=.22)
            if j%2==0:lock('mane_gold_streak',[q+V((0,-.025,0)) for q in path],.014,9,'Head' if t<.25 else 'Neck',thickness=.1)
    for j in range(5):
        p=V((.08+j*.025,y-hr*.2,z+hr*1.02-j*.028))
        path=[p,p+V((-.19,-hr*.6,.075)),p+V((-.38,-hr*1.1,-.035)),p+V((-.47,-hr*.95,-.22-j*.02))]
        lock('swept_forelock',path,.09,5 if j%2 else 4,'Head',thickness=.24)
        if j==1:lock('forelock_lightning',[q+V((0,-.027,0)) for q in path],.018,9,'Head',thickness=.12)
    for j in range(3):
        x=(j-1)*.09
        blade('ivory_chest_tuft',(x,y+.3,z-.5),(x*1.4,y+.47,z-.98+abs(x)*.3),.105,1,'Neck',depth=.1,bend=(0,-.06,0))
    tail(job)


def skin_body():
    old_skin();obj=b.PARTS[-1]
    # Retain local body UVs after voxel unification and paint pale lower legs.
    while obj.data.uv_layers:obj.data.uv_layers.remove(obj.data.uv_layers[0])
    local_uv(obj,0)
    if b.JOB['family']=='moon':
        obj.data.materials.append(b.MATS[1])
        for p in obj.data.polygons:
            if p.center.z<.43:p.material_index=1
        # p.center is refreshed by mesh update; choose actual vertex centroid.
        for p in obj.data.polygons:
            z=sum(obj.data.vertices[i].co.z for i in p.vertices)/len(p.vertices)
            if z<.43:
                p.material_index=1
                for i in p.loop_indices:
                    u,v=obj.data.uv_layers[0].data[i].uv;obj.data.uv_layers[0].data[i].uv=(u+.25,v)


def preserve_atlas(obj):
    if not obj.data.uv_layers:old_atlas(obj)
    else:
        while len(obj.data.uv_layers)>1:obj.data.uv_layers.remove(obj.data.uv_layers[-1])
        obj.data.uv_layers[0].active_render=True


def refined_materials(job):
    b.PALETTES['moon']=[(.09,.12,.29),(.65,.7,.9),(.22,.28,.55),(.008,.01,.025),(.19,.12,.42),(.31,.2,.65),(.34,.18,.8),(.025,.8,1),(.03,.28,.5),(.43,.64,.98),(.13,.065,.38),(.67,.78,.94),(.65,.97,1),(.14,.42,.87),(.08,.8,.7),(.43,.46,.72)]
    b.materials(job)
    n=job['size'][2];k=n//4
    base=np.ones((n,n,4),dtype=np.float32);orm=np.ones_like(base);normal=np.ones_like(base)
    normal[:,:,:3]=(.5,.5,1)
    palette=b.PALETTES[job['family']]
    for slot,color in enumerate(palette):
        y,x=(slot//4)*k,(slot%4)*k
        vv,uu=np.mgrid[0:k,0:k].astype(np.float32)/(k-1)
        # Painted central ridges / tapered edge shadows, smoothly graded tips.
        shade=.76+.18*vv+.15*np.exp(-((uu-.46)/.3)**2)
        if slot in (3,7,12):shade=.93+.07*vv
        if slot in (0,1,4,5,15):shade+=.018*np.sin(uu*PI*10+vv*3)*np.sin(PI*uu)**2
        base[y:y+k,x:x+k,:3]=np.clip(np.array(color)*shade[:,:,None],0,1)
        rough=.66 if slot in (0,1,15) else .44 if slot in (4,5,10) else .3 if slot in (2,9,13) else .12 if slot==7 and job['family']=='sun' else .52
        metal=.68 if slot in (2,9,13) and job['family']!='moon' else .0
        if slot==7 and job['family']=='sun':metal=.45
        if job['family']=='star' and slot in (2,9,13):rough=.48;metal=.24
        if job['family']=='star' and slot in (4,5):rough=.55
        orm[y:y+k,x:x+k,:3]=np.stack((np.ones_like(uu),np.ones_like(uu)*rough,np.ones_like(uu)*metal),axis=-1)
        if slot in (0,1,4,5,15):
            nx=.045*np.sin(uu*PI*12+vv*2)*np.sin(PI*uu)**2
            normal[y:y+k,x:x+k,0]=.5+nx;normal[y:y+k,x:x+k,1]=.5+.012*np.sin(vv*PI*5);normal[y:y+k,x:x+k,2]=np.sqrt(np.maximum(.0,1-(nx*2)**2))*.5+.5
    for suffix,arr in [('base_color',base),('orm',orm),('normal',normal)]:
        im=bpy.data.images['atlas_'+suffix];im.pixels.foreach_set(arr.ravel());im.save();im.pack()
    for m in b.MATS:
        nodes=m.node_tree.nodes;bs=nodes.get('Principled BSDF')
        for node in nodes:
            if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.28
        if m.name.startswith(('12_','07_')) and job['family']=='moon':bs.inputs['Emission Strength'].default_value=.55
        if m.name.startswith('12_'):bs.inputs['Emission Strength'].default_value=.8


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only');ap.add_argument('--preview',action='store_true');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    b.register=register;b.leaf=blade;b.eye_pair=lambda *a,**k:None;b.wing=refined_wing;b.skin_body=skin_body;b.atlas_uv=preserve_atlas
    jobs=json.loads(Path(args.jobs).read_text(encoding='utf-8-sig'))
    for job in jobs:
        if args.only and f"{job['family']}:{job['stage']}" not in args.only.split(','):continue
        b.JOB=job;b.PARTS=[];b.BODY=[];b.BONES={};b.MATS=[];b.RNG=random.Random(811+job['index'])
        bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
        Path(job['output']).mkdir(parents=True,exist_ok=True)
        print('REFINE_START',job['family'],job['stage'],flush=True)
        refined_materials(job)
        landmarks=old_sun(job) if job['family']=='sun' else old_quad(job)
        face(job)
        if job['family']=='sun':plumage(job)
        elif job['family']=='moon':wolf_coat(job)
        else:horse_mane(job)
        mesh,rig,scale=b.assemble(job,landmarks)
        if args.preview:
            cam,center,extent,_=b.setup_render(mesh)
            cam.location=center+V((0,-5,.12))*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
            bpy.context.scene.render.filepath=str(Path(job['output']).parent/f"preview_{job['family']}_{job['stage']}.png")
            bpy.ops.render.render(write_still=True)
            print('PREVIEW_TRIANGLES',sum(len(p.vertices)-2 for p in mesh.data.polygons),flush=True)
            continue
        clips=b.animate(job,rig,scale);b.reference_images(job,scale)
        b.render_views(job,mesh,rig)
        b.export(job,mesh,rig,clips);b.document(job,mesh,rig,clips)
        reportpath=Path(job['output'])/'review/build_report.json'
        report=json.loads(reportpath.read_text(encoding='utf8'))
        report.update(refinement=2,normal_map='Authored tangent-space fiber/ridge detail, not a high-poly bake.',changes=['Fitted almond eyes and tapered muzzle proportions.','Swept pointed fur and feather layers with continuous skinned tails.','Raised golden wing fans / framed radial mirror panes.','Local UV islands and differentiated skin, fur, silk, gold and mirror roughness.'])
        b.write_json(reportpath,report)
        print('REFINE_DONE',job['task_id'],flush=True)


if __name__=='__main__':main()
