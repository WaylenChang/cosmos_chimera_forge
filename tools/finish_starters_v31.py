"""V3.1: reference surface refinement and canonical skeletal action library.

Retains the species-first anatomy. Decoration is attached to real 3-D surfaces,
not arranged into a front silhouette. Original V3 files remain reproducible.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
import anatomy_starters_v3 as a
b=a.b
V=Vector
PI=math.pi


def parameters(job):
    i=job['index'];baby=i==0;family=job['family']
    if family=='sun':return dict(bodyz=.83 if baby else 1.43,headz=1.3 if baby else 2.35,heady=-.25 if baby else -.53,hr=.26 if baby else .155,width=.34 if baby else .275,length=.49)
    wolf=family=='moon';length=.72 if baby else .94 if i==1 else 1.05
    return dict(bodyz=(.84 if baby else 1.1) if wolf else (1.13 if baby else 1.34),headz=(1.24 if baby else 1.61) if wolf else (1.92 if baby else 2.16),heady=-length-(.2 if wolf else .13),hr=(.27 if baby else .215 if i==1 else .255) if wolf else (.235 if baby else .21 if i==1 else .225),width=(.26 if baby else .27 if i==1 else .35) if wolf else (.27 if baby else .30 if i==1 else .34),length=length)


def materials(job):
    b.PALETTES['sun'][0]=(.91,.865,.73);b.PALETTES['sun'][1]=(.99,.955,.84)
    b.PALETTES['moon'][0]=(.085,.10,.245);b.PALETTES['moon'][1]=(.69,.75,.94);b.PALETTES['moon'][2]=(.18,.21,.43)
    b.PALETTES['star'][0]=(.95,.65,.28);b.PALETTES['star'][4]=(.23,.025,.46);b.PALETTES['star'][5]=(.43,.06,.68)
    b.materials(job)
    n=job['size'][2];tile=n//4
    normal=bpy.data.images['atlas_normal'];arr=np.ones((n,n,4),dtype=np.float32);arr[:,:,:3]=(.5,.5,1)
    orm=bpy.data.images['atlas_orm'];packed=np.ones_like(arr)
    for slot in range(16):
        y,x=slot//4*tile,slot%4*tile;vv,uu=np.mgrid[0:tile,0:tile].astype(np.float32)/tile
        fiber=.016*np.sin(uu*PI*95+np.sin(vv*PI*6)*.6)+.006*np.sin(uu*PI*211+vv*5)
        if slot in (0,1,4,5,15):
            arr[y:y+tile,x:x+tile,0]=.5+fiber
            arr[y:y+tile,x:x+tile,1]=.5+.008*np.sin(vv*PI*40)
            arr[y:y+tile,x:x+tile,2]=np.sqrt(np.maximum(0,1-(fiber*2)**2))*.5+.5
        metal=(slot in (2,9,13) and job['family']!='moon') or (slot==7 and job['family']=='sun')
        rough=.14 if slot==7 and job['family']=='sun' else .31 if metal else .68 if slot in (0,1,15) else .42
        if slot in (6,3):rough=.24
        packed[y:y+tile,x:x+tile,:3]=(1,rough,.88 if metal else 0)
    for im,data in [(normal,arr),(orm,packed)]:im.pixels.foreach_set(data.ravel());im.save();im.pack()
    for mat in b.MATS:
        for node in mat.node_tree.nodes:
            if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.24


def adjacent_weights(ob,names):
    ob.vertex_groups.clear()
    for name in names:ob.vertex_groups.new(name=name)
    for vert in ob.data.vertices:
        ds=[]
        for name in names:
            p,q=V(b.BONES[name]['head']),V(b.BONES[name]['tail']);d=q-p;t=max(0,min(1,(vert.co-p).dot(d)/d.length_squared));ds.append(((vert.co-(p+t*d)).length,name))
        chosen=sorted(ds)[:2];weights=[1/max(d,a.SCALE*.025)**4 for d,name in chosen];total=sum(weights)
        for (_,name),w in zip(chosen,weights):ob.vertex_groups[name].add([vert.index],w/total,'REPLACE')


def refine_surface(job,mesh,rig):
    par=parameters(job);s=a.SCALE;shift=V(b.BONES['Head']['head'])/s-V((0,par['heady'],par['headz']))
    P=lambda p:(V(p)+shift)*s
    bare=mesh.vertex_groups['QA_BARE_ANATOMY'].index
    owned={v.index for v in mesh.data.vertices if any(g.group==bare and g.weight>.5 for g in v.groups)}
    faces=[tuple(p.vertices) for p in mesh.data.polygons if all(i in owned for i in p.vertices)]
    tree=BVHTree.FromPolygons([v.co for v in mesh.data.vertices],faces,all_triangles=False)
    added=[]
    def plume(name,p,q,w,mat,bone,normal,thick=.007):
        root,end=V(p),V(q);d=(end-root).normalized();n=V(normal);n=(n-d*n.dot(d)).normalized();side=d.cross(n).normalized()
        root-=n*.009*s;verts=[];faces=[]
        for j in range(8):
            t=j/7;span=w*(.88+.15*math.sin(PI*t))*(1-t)**.6+.0005*s;c=root.lerp(end,t)+n*math.sin(PI*t)*thick*s*.3
            for k in range(6):
                theta=2*PI*k/6;verts.append(tuple(c+side*math.cos(theta)*span+n*math.sin(theta)*thick*s*(1-t*.8)))
            if j:
                for k in range(6):faces.append(((j-1)*6+k,(j-1)*6+(k+1)%6,j*6+(k+1)%6,j*6+k))
        faces.extend([tuple(reversed(range(6))),tuple(42+k for k in range(6))])
        ob=b.mesh_obj(name,verts,faces,mat,bone);added.append(ob);return ob
    def strand(name,pts,widths,mat,names):
        ob=a.curved_tube(name,pts,widths,mat,bone=names[0]);adjacent_weights(ob,names);added.append(ob);return ob
    def surface(center,direction):
        n=V(direction).normalized();hit,normal,_,_=tree.ray_cast(P(center)+n*2*s,-n,4*s)
        return (hit+normal*.004*s,normal) if hit is not None else (None,None)
    family=job['family'];idx=job['index'];baby=idx==0;length=par['length'];z=par['bodyz'];hy=par['heady'];hz=par['headz'];hr=par['hr'];width=par['width']
    # Paint contiguous anatomy regions, preserving the existing volume/weights.
    if family in ('moon','star'):
        mesh.data.materials.append(b.MATS[1]);pale=len(mesh.data.materials)-1
        for face in mesh.data.polygons:
            if not all(i in owned for i in face.vertices):continue
            c=sum((mesh.data.vertices[i].co for i in face.vertices),V())/len(face.vertices)/s-shift
            lower=family=='moon' and c.z<(.36 if baby else .45)
            chest=abs(c.x)<width*.65 and c.y<-length*.55 and z-.34<c.z<z+.18
            if family=='moon':chest=chest or abs(c.x)<width*.58 and c.y<-length*.72 and z-.1<c.z<hz-.08 and face.normal.y<-.15
            if lower or chest:face.material_index=pale
    if family in ('sun','moon'):
        count=9 if family=='sun' else (7 if baby else 10)
        for row in range(count):
            y=(-.23+row*.075) if family=='sun' else (-length*.66+row*length*.14)
            center=(0,y,z)
            for k in range(12):
                ang=2*PI*(k+.5*(row%2))/12;n=V((math.cos(ang),0,math.sin(ang)))
                if family=='moon' and abs(n.x)<.83:continue
                root,n=surface(center,n)
                if root is None:continue
                direction=V((0,.12,-.055 if family=='sun' else -.035));direction-=n*direction.dot(n)*.45
                end=root+direction*s
                mat=1 if family=='sun' else (2 if (k+row)%5==0 else 0)
                plume('surface_contour_feather' if family=='sun' else 'surface_coat',root,end,(.065 if family=='sun' else .045)*s,mat,'Thorax' if row<3 else 'Lumbar' if row<6 else 'Pelvis',n,.009 if family=='sun' else .005)
        # Nape/cheek growth wraps the skull and neck, leaving eye/nose zones clear.
        for row in range(3 if baby else 4):
            for k in range(9):
                ang=-.9+1.8*k/8;n=V((math.sin(ang),math.cos(ang),.12-row*.07)).normalized()
                root,n=surface((0,hy+.04,hz+.06-row*hr*.32),n)
                if root is None:continue
                d=V((n.x*.08,.07,-.12))*s
                plume('nape_layer',root,root+d,hr*.24*s,1 if family=='sun' or row>=2 else 2,'Head' if row<2 else 'Neck_2',n,.008)
        if family=='moon':
            for row in range(4 if idx<2 else 6):
                center=(0,-length*.71,z+.27-row*.085)
                for k in range(5):
                    ang=(k-2)*.22;n=V((math.sin(ang),-math.cos(ang),.1))
                    root,n=surface(center,n)
                    if root is not None:plume('pale_throat_mane',root,root+V((n.x*.06,.035,-.18))*s,.073*s,1,'Neck_1' if row<2 else 'Thorax',n,.009)
            for side in [-1,1]:
                for j in range(5):
                    n=V((side*.9,-.3,.2));root,n=surface((0,-length*.35+j*.25,z+.13),n)
                    if root is not None:plume('aurora_coat_inlay',root+n*.003*s,root+V((0,.14,.07))*s,.014*s,7,'Thorax' if j<2 else 'Lumbar',n,.002)
            if idx>=2:
                for row in range(3):
                    for k in range(10):
                        ang=2*PI*(k+row*.4)/10;n=V((math.cos(ang),0,math.sin(ang)))
                        root,n=surface((0,-length*.7+row*.13,z+.21),n)
                        if root is not None:plume('shoulder_ruff',root,root+V((n.x*.045,.14,n.z*.03-.06))*s,.07*s,1 if n.z<.15 else 2,'Thorax',n,.008)
    # Fitted upper lids follow each species' local orbital plane.
    for side in [-1,1]:
        angle=.52 if family=='moon' else .82 if family=='star' else .7
        normal=V((side*angle,-math.sqrt(1-angle*angle),.04)).normalized();across=V((0,0,1)).cross(normal).normalized();up=normal.cross(across)
        size=(.077 if baby else .061) if family=='moon' else (.072 if baby else .055) if family=='star' else (.071 if baby else .044)
        c=P((0,hy-(.045 if family=='moon' else .055 if family=='star' else .025),hz+(.02 if family=='moon' else .045 if family=='star' else .01)))
        c+=V((normal.x*hr*(.91 if family=='moon' else .87 if family=='star' else .95),normal.y*hr*(.83 if family=='moon' else .66 if family=='star' else 1.12),hr*.12))*s
        pts=[c+normal*size*.48*s+across*(math.cos(t)*size*s)+up*((math.sin(t)*.82+.10)*size*s) for t in np.linspace(0,PI,10)]
        ob=b.tube('fitted_upper_lid',pts,.008*s,3,'Head',sides=6);added.append(ob)
    if family=='star':
        # Replace the coarse mane's silhouette with overlapping, curved 3-D locks.
        for j in range(14):
            t=j/13;side=1 if j%5 else -1;p=V((0,hy+.10+t*.46,hz+.22-t*.53))
            path=[P(p),P(p+V((side*.10,.04,.07))),P(p+V((side*.23,.16,-.06))),P(p+V((side*.24,.28,-.26))),P(p+V((side*.19,.35,-.39)))]
            names=['Head','Neck_2'] if j<4 else ['Neck_2','Neck_1']
            strand('flowing_mane',path,[(.055*s,.019*s),(.08*s,.024*s),(.075*s,.021*s),(.055*s,.018*s),(.002*s,.002*s)],5 if j%3 else 4,names)
            if j%3==0:strand('mane_lightning', [p+V((side*.015,-.018,0))*s for p in path], [.009*s,.012*s,.011*s,.006*s,.001*s],9,names)
        for j in range(5):
            p=V((.06+j*.012,hy-.02,hz+.21-j*.02));path=[P(p),P(p+V((-.1,-.10,.08))),P(p+V((-.27,-.15,.015))),P(p+V((-.29,-.17,-.15-j*.018)))]
            strand('swept_forelock',path,[(.05*s,.017*s),(.07*s,.025*s),(.07*s,.018*s),(.001*s,.001*s)],5 if j%2 else 4,['Head'])
    # Tail locks are weighted only along the tail chain, with real depth.
    if family in ('moon','star'):
        names=[n for n in b.BONES if n.startswith('Tail_')];controls=[V(b.BONES[n]['head']) for n in names]+[V(b.BONES[names[-1]]['tail'])]
        for k in range(10 if family=='moon' else 12):
            ang=2*PI*k/(10 if family=='moon' else 12);path=[]
            for j,p in enumerate(controls):
                tangent=(controls[min(j+1,len(controls)-1)]-controls[max(j-1,0)]).normalized();u=tangent.cross(V((1,0,0)))
                if u.length<.1:u=tangent.cross(V((0,0,1)))
                u.normalize();v=tangent.cross(u);rad=(.06+.08*math.sin(PI*j/(len(controls)-1)))*s
                path.append(p+(u*math.cos(ang)+v*math.sin(ang))*rad)
            path[-1]+=V((math.sin(ang)*.05,.07,math.cos(ang)*.04))*s
            w=(.055 if family=='moon' else .065)*s
            strand('tail_surface_lock',path,[(w*.55,w*.22),(w,w*.27),(w*.75,w*.23),(.001*s,.001*s)],2 if family=='moon' and k%3 else 1 if family=='moon' else 5 if k%3 else 4,names)
            if k%4==0:strand('tail_luminous_streak',path,[.01*s,.018*s,.012*s,.001*s],7 if family=='moon' else 9,names)
    if family=='sun':
        center=P((0,hy+.035,hz+.35))
        for k in range(8):
            ang=2*PI*k/8;root=center+V((math.sin(ang)*.135,0,math.cos(ang)*.135))*s
            plume('crown_ray',root,center+V((math.sin(ang)*.20,0,math.cos(ang)*.20))*s,.027*s,2,'Crown',(0,-1,0),.013)
        for side in [-1,1]:
            for k in range(5):
                p=(side*(.17+k*.018),-.02,z+.29)
                ob=b.ell('foliage_mount',P(p),(.07*s,.07*s,.08*s),4,'Thorax',seg=12,rings=8);added.append(ob)
                if k%2==0:
                    center=P((p[0],p[1]-.035,p[2]+.065))
                    for petal in range(5):
                        ang=petal*2*PI/5;ob=b.ell('blossom',center+V((math.cos(ang)*.023,0,math.sin(ang)*.023))*s,(.018*s,.009*s,.018*s),1,'Thorax',seg=8,rings=6);added.append(ob)
        if idx>=2:
            for side in [-1,1]:
                pts=[P((side*.14,.15,z+.3)),P((side*.32,.22,z+.56)),P((side*.34,.55,z+.59)),P((side*.25,.72,z+.45))]
                strand('ether_conduit',pts,[.024*s]*4,2,['Thorax'])
    # Dense feathers remain supported by the articulated wing, including coverts.
    for f in a.FEATHERS:
        start=V(b.BONES[f['name']]['head']);end=V(b.BONES[f['name']]['tail'])
        for sign in [-1,1]:
            root=start+V((0,0,sign*.015*s));tip=root.lerp(end,.6)+V((0,0,sign*.02*s))
            plume('layered_wing_covert',root,tip,.07*s,1 if family=='sun' else 9,f['name'],(0,0,sign),.009)
        if family=='star' and idx==3 and f['group']=='primary' and f['index']%2==0:
            tangent=end-start;normal=V((0,0,1));p=start+tangent*.4
            strand('storm_cloud_curl',[p,p+V((0,.05,.11))*s,p+V((0,.16,.16))*s,p+V((0,.23,.09))*s,p+V((0,.17,.04))*s],[.025*s,.06*s,.065*s,.04*s,.005*s],5,[f['name']])
            strand('cloud_lightning',[p+V((0,-.02,.04))*s,p+V((.03,.08,.17))*s,p+V((-.02,.13,.12))*s,p+V((.02,.22,.17))*s],[.006*s]*4,12,[f['name']])
    # Join new detail to the existing skin without a whole-model decimation.
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True)
    for ob in added:ob.select_set(True)
    bpy.context.view_layer.objects.active=mesh;bpy.ops.object.join()
    import bmesh
    bm=bmesh.new();bm.from_mesh(mesh.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6*s)
    tiny=[f for f in bm.faces if f.calc_area()<1e-13*s*s]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES_ONLY')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh.data);bm.free()
    deform={g.index for g in mesh.vertex_groups if g.name in rig.data.bones}
    for vertex in mesh.data.vertices:
        current=sorted([(g.group,g.weight) for g in vertex.groups if g.group in deform],key=lambda x:x[1],reverse=True)
        keep=current[:4];total=sum(w for _,w in keep)
        for group,_ in current:mesh.vertex_groups[group].remove([vertex.index])
        for group,w in keep:mesh.vertex_groups[group].add([vertex.index],w/total,'REPLACE')
    b.atlas_uv(mesh)
    mesh['revision']='3.1';mesh['status']='reference surface refinement; art acceptance pending'
    return mesh


def pulse(t,peak=.48):
    u=t/peak if t<peak else (1-t)/(1-peak);u=max(0,min(1,u));return u*u*(3-2*u)


def definitions(job):
    primary=[dict(d,category='canonical',name='cr_'+job['stage']+'_'+d['id']) for d in job['actions']]
    extra=[dict(d,category='supplemental',name='v3_'+job['stage']+'_'+d['id']) for d in a.motion_defs(job)]
    return primary+extra


def animate(job,rig,mesh):
    scene=bpy.context.scene;scene.render.fps=30;rig.animation_data_create();clips=[];checks=[];S=a.SCALE
    # Rigid sole points allow accurate contact/flight measurements and toe roll.
    footverts={}
    for limb,info in a.LEGS.items():
        name=info['names'][-1];group=mesh.vertex_groups.get(name)
        footverts[limb]=[v.co.copy() for v in mesh.data.vertices if any(g.group==group.index and g.weight>.999 for g in v.groups)]
    def footmin(limb):
        name=a.LEGS[limb]['names'][-1];pb=rig.pose.bones[name];m=pb.matrix@pb.bone.matrix_local.inverted()
        return min((m@v).z for v in footverts[limb])
    for definition in definitions(job):
        aid=definition['id'];frames=definition['f'];name=definition['name'];reviewkey=('canonical_' if definition['category']=='canonical' else '')+aid
        action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
        maxerr=0;contacts=[];flight=[];support=[];ground_corrections=[];speed=0
        for frame in range(frames+1):
            scene.frame_set(frame);t=frame/frames;p=2*PI*t;e=math.sin(PI*t)**2
            for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
            root=rig.pose.bones['Root'];targets={n:V(info['points'][3])*S for n,info in a.LEGS.items()};bodylift=0;rx=0;ry=0;fold=.88;flap=0;is_faint=aid=='faint';stance=[]
            a.rot_world(rig,'Thorax',x=.009*math.sin(p));a.rot_world(rig,'Head',z=.02*math.sin(p));a.rot_world(rig,'Neck_1',x=-.006*math.sin(p))
            for j in range(1,4):a.rot_world(rig,'Tail_'+str(j),z=.07*math.sin(p-j*.5))
            for side in ['L','R']:a.rot_world(rig,side+'_Ear',y=(.07 if side=='L' else -.07)*math.sin(p+.6))
            gait=aid if aid in ('walk','trot','gallop','canter','sneak') else ('walk' if job['family']=='sun' else 'gallop' if job['family']=='moon' else 'canter') if aid=='run' else None
            if gait:
                duty={'walk':.7,'sneak':.8,'trot':.46,'gallop':.24,'canter':.33}[gait]
                stride={'walk':.26,'sneak':.14,'trot':.38,'gallop':.44,'canter':.40}[gait]*S
                phases=({'L_Hind':0,'L_Front':.75,'R_Hind':.5,'R_Front':.25} if gait in ('walk','sneak') else {'L_Hind':0,'R_Front':0,'R_Hind':.5,'L_Front':.5} if gait=='trot' else {'R_Hind':0,'L_Hind':.75,'R_Front':.75,'L_Front':.5} if gait=='canter' else {'R_Hind':0,'L_Hind':.91,'R_Front':.58,'L_Front':.47})
                if job['family']=='sun':phases={'L_Hind':0,'R_Hind':.5};duty=.42 if aid=='run' else duty
                for limb in targets:
                    q=(t+phases[limb])%1
                    if q<duty:targets[limb].y+=stride*(q/duty-.5);stance.append(limb)
                    else:
                        u=(q-duty)/(1-duty);smooth=u*u*(3-2*u);targets[limb].y+=stride*(.5-smooth)
                        targets[limb].z+=(.09 if gait in ('walk','sneak') else .17)*S*math.sin(PI*u)
                bodylift=-S*(.09 if gait=='sneak' else .05 if gait in ('gallop','canter') else .025)+S*(.012 if gait in ('walk','sneak') else .025)*math.sin(2*p)
                if not stance:bodylift+=.055*S
                if gait in ('gallop','canter'):
                    a.rot_world(rig,'Lumbar',x=(.09 if job['family']=='moon' else .045)*math.sin(p+.5))
                    a.rot_world(rig,'Thorax',x=-(.065 if job['family']=='moon' else .035)*math.sin(p+.5))
                    for side in ['L','R']:a.rot_world(rig,side+'_Scapula',x=.065*math.sin(p+(0 if side=='L' else PI)))
                speed=stride/(frames/30*duty)
            elif aid in ('crouch','block'):bodylift=-.16*S*e;fold=.9;flap=-.14*e;a.rot_world(rig,'Neck_1',x=.14*e)
            elif aid=='wing_fold':fold=1-e
            elif aid=='flap':fold=.06;flap=.57*math.cos(p);bodylift=-.025*S+.02*S*math.sin(p)
            elif aid in ('neck_strike','focus'):
                if aid=='neck_strike':a.rot_world(rig,'Neck_1',x=-.22*e);a.rot_world(rig,'Neck_2',x=.68*e);a.rot_world(rig,'Neck_3',x=-.46*e)
                else:fold=.88-.76*e;flap=-.5*e;a.rot_world(rig,'Crown',x=.35*e)
            elif aid in ('howl','victory'):
                a.rot_world(rig,'Neck_1',x=-.22*e);a.rot_world(rig,'Neck_2',x=-.21*e);a.rot_world(rig,'Head',x=-.22*e);a.rot_world(rig,'Jaw',x=.25*e)
                if job['family']=='sun':fold=.86-.66*e;flap=-.45*e
            elif aid in ('pounce','atk_melee_burst'):
                jump=math.sin(PI*min(1,max(0,(t-.15)/.7)))**2 if .15<t<.85 else 0
                bodylift=S*(.25*jump-.10*e)
                for limb in targets:targets[limb].z+=.3*S*jump
                a.rot_world(rig,'Lumbar',x=.08*math.sin(p));a.rot_world(rig,'Thorax',x=-.07*math.sin(p));fold=.88-.35*jump
            elif aid in ('rear','kick'):
                if aid=='rear':a.rot_world(rig,'Pelvis',x=-.34*e);bodylift=-.04*S*e
                else:a.rot_world(rig,'Lumbar',x=.06*e)
                for limb in targets:
                    if ('Front' if aid=='rear' else 'Hind') in limb:targets[limb]+=V((0,.08 if aid=='rear' else .36,.48 if aid=='rear' else .34))*S*e
            elif aid=='tail_sweep':
                for j in range(1,4):a.rot_world(rig,'Tail_'+str(j),z=.32*math.sin(p-j*.3)*e)
            elif aid.startswith('atk_'):
                hit=next((int(x.split('@')[1])/frames for x in definition.get('ev',[]) if x.startswith('ev_hit@')),.48);strike=pulse(t,hit)
                ranged='ranged' in aid;sweep='sweep' in aid
                a.rot_world(rig,'Thorax',x=-.08*strike,z=.20*strike if sweep else 0);a.rot_world(rig,'Neck_1',x=-.17*strike,z=.12*strike if sweep else 0)
                a.rot_world(rig,'Head',x=.14*strike if not ranged else -.1*strike);a.rot_world(rig,'Jaw',x=.28*strike if job['family']=='moon' and not ranged else .08*strike)
                if job['family']=='sun':fold=.88-(.77 if ranged else .5)*strike;flap=-.48*strike;a.rot_world(rig,'Neck_2',x=.5*strike if not ranged else .08*strike);a.rot_world(rig,'Neck_3',x=-.3*strike)
                elif ranged:fold=.88-.65*strike;flap=-.44*strike
                else:
                    for limb in targets:
                        if limb=='L_Front':targets[limb]+=V((-.03,-.18,.21))*S*strike
                bodylift=-.04*S*strike
            elif aid=='dodge_miss':
                rx=.5*S*(t*t*(3-2*t));bodylift=.10*S*e
                for limb in targets:targets[limb]+=V((rx,0,.10*S*e))
                a.rot_world(rig,'Thorax',z=-.16*e)
            elif aid=='hit_react':a.rot_world(rig,'Thorax',x=-.19*e,z=.12*e);a.rot_world(rig,'Head',x=-.14*e);bodylift=-.07*S*e
            elif aid=='faint':
                bodylift=-.14*S*pulse(min(t,.55)/.55,1) if t<.55 else -.14*S
                a.rot_world(rig,'Neck_1',x=.2*t);a.rot_world(rig,'Head',x=.18*t);fold=1
            elif aid in ('sup_self','sup_ally','field_deploy'):
                fold=.88-.68*e;flap=-.5*e;a.rot_world(rig,'Neck_1',x=-.14*e,z=.24*e if aid=='sup_ally' else 0);a.rot_world(rig,'Head',z=.15*e if aid=='sup_ally' else 0)
                if aid=='field_deploy':
                    for limb in targets:
                        if 'Front' in limb:targets[limb].z+=.10*S*max(0,math.sin(p))*e
            elif aid=='petted':a.rot_world(rig,'Neck_1',x=.15*e);a.rot_world(rig,'Head',x=.16*e,z=.1*math.sin(p)*e)
            elif aid in ('summon_appear','recall_vanish'):
                f=t if aid=='summon_appear' else 1-t;factor=.04+.96*(f*f*(3-2*f));root.scale=(factor,)*3
            elif aid=='capture_struggle':
                a.rot_world(rig,'Thorax',x=.09*math.sin(3*p)*e,z=.14*math.sin(3*p)*e);a.rot_world(rig,'Head',z=.25*math.sin(4*p)*e);bodylift=-.07*S*e
            elif aid in ('overload_enter','overload_exit'):
                strength=e if aid=='overload_enter' else .6*e;fold=.88-.8*strength;flap=-.5*strength
                a.rot_world(rig,'Neck_1',x=-.2*strength)
                for j in range(1,4):a.rot_world(rig,'Array_'+str(j),y=(-1 if j%2 else 1)*.55*strength)
            elif aid=='hatch':
                bodylift=-.10*S*(1-t)+.05*S*e;a.rot_world(rig,'Head',x=.15*math.sin(3*p)*e,z=.12*math.sin(p)*e)
            root.location=root.bone.matrix_local.to_3x3().inverted()@V((rx,ry,bodylift));bpy.context.view_layer.update()
            # Pose at full size first; appearance scale is applied after limb IK.
            rootscale=root.scale.x;root.scale=(1,1,1);bpy.context.view_layer.update()
            for attempt in range(30):
                overflow=0
                for limb,info in a.LEGS.items():
                    pts=[V(x)*S for x in info['points']];names=info['names'];reach=rig.pose.bones[names[0]].bone.length+rig.pose.bones[names[1]].bone.length
                    overflow=max(overflow,(targets[limb]+pts[2]-pts[3]-rig.pose.bones[names[0]].head).length-reach+.001*S)
                if overflow<=0:break
                bodylift-=max(.002*S,overflow*1.1);root.location=root.bone.matrix_local.to_3x3().inverted()@V((rx,ry,bodylift));bpy.context.view_layer.update()
            for limb,info in a.LEGS.items():maxerr=max(maxerr,a.pose_leg(rig,info,targets[limb]))
            a.pose_wings(rig,fold,flap)
            for j in range(1,4):
                if 'Array_'+str(j) in rig.pose.bones and aid not in ('overload_enter','overload_exit'):a.rot_world(rig,'Array_'+str(j),y=.04*math.sin(p+j*.6))
            bpy.context.view_layer.update()
            if is_faint:
                amount=max(0,min(1,(t-.22)/.78));amount=amount*amount*(3-2*amount)
                from mathutils import Quaternion
                rest=root.bone.matrix_local.to_quaternion();root.rotation_quaternion=rest.inverted()@Quaternion((0,1,0),1.48*amount)@rest
                bpy.context.view_layer.update();evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());temp=evaluated.to_mesh();minimum=min(v.co.z for v in temp.vertices);evaluated.to_mesh_clear()
                if minimum<0:root.location+=root.bone.matrix_local.to_3x3().inverted()@V((0,0,-minimum));bpy.context.view_layer.update()
            for limb in targets:
                if limb in stance:contacts.append(dict(frame=frame,limb=limb,phase='stance',target_z=targets[limb].z))
            if gait:
                support.append(dict(frame=frame,limbs=stance.copy()))
                if not stance:flight.append(dict(frame=frame,min_sole_z_m=min(footmin(limb) for limb in targets)))
            root.scale=(rootscale,)*3
            bpy.context.view_layer.update()
            for pb in rig.pose.bones:pb.keyframe_insert('location',frame=frame,group=pb.name);pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
            root.keyframe_insert('scale',frame=frame,group='Root')
        loop=bool(definition.get('loop'));action['loop']=loop;action['category']=definition['category'];action['root_motion']=bool(definition.get('rm'));action['in_place_speed_m_s']=speed
        for event in definition.get('ev',[]):key,f=event.split('@');marker=action.pose_markers.new(key);marker.frame=int(f)
        clips.append(dict(id=name,action=reviewkey,semantic=aid,category=definition['category'],frames=frames,fps=30,loop=loop,events=definition.get('ev',[]),root_motion=bool(definition.get('rm')),in_place_speed_m_s=speed,uniform_appearance_scale=aid in ('summon_appear','recall_vanish')))
        checks.append(dict(id=name,action=reviewkey,semantic=aid,max_foot_target_error_m=maxerr,stance_samples=contacts,flight_samples=flight,support=support,design_only=False))
    rig.animation_data.action=bpy.data.actions['v3_'+job['stage']+'_idle'];scene.frame_start=0;scene.frame_end=60;scene.frame_set(0)
    return clips,checks


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only');ap.add_argument('--no-render',action='store_true');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    for job in json.loads(Path(args.jobs).read_text(encoding='utf-8-sig')):
        if args.only and job['family']+':'+job['stage'] not in args.only.split(','):continue
        print('V31_START',job['task_id'],flush=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
        b.JOB=job;b.PARTS=[];b.BODY=[];b.BONES={};a.SAMPLES=[];a.LEGS={};a.WINGS={};a.FEATHERS=[];a.AXIAL=[]
        Path(job['output']).mkdir(parents=True,exist_ok=True);materials(job)
        landmarks=a.build_bird(job) if job['family']=='sun' else a.build_quad(job)
        mesh,rig=a.join_skin(job,landmarks);mesh=refine_surface(job,mesh,rig);clips,qa=animate(job,rig,mesh)
        if not args.no_render:a.render(job,mesh,rig,clips)
        b.reference_images(job,a.SCALE);a.export_and_report(job,mesh,rig,clips,qa)
        report=json.loads((Path(job['output'])/'build_report.json').read_text(encoding='utf8'));report.update(revision='3.1',status='reference_refinement_pending_review',canonical_clips=sum(c['category']=='canonical' for c in clips),supplemental_clips=sum(c['category']=='supplemental' for c in clips),textures='embedded base color, authored fiber normal, ORM; no high-poly bake',limitations=['Reference-directed procedural reconstruction still differs from hand-drawn linework and facial design.','Final game-engine import and art acceptance not performed.','Soft tissue, aerodynamic and collision simulation are not claimed.']);b.write_json(Path(job['output'])/'build_report.json',report)
        b.write_json(Path(job['output'])/'motion_spec.json',dict(revision='3.1',status='canonical clips authored; review pending',clips=clips,checks=qa))
        print('V31_DONE',job['task_id'],flush=True)


if __name__=='__main__':main()
