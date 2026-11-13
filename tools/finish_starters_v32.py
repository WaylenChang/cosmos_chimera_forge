"""V3.2 reference polish: inset faces, growth-guided organic clumps, worked gold.

Keeps V3.1's complete action library and species rig; replaces surface design,
not a layer of identical random spikes on top of the previous coat.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
import finish_starters_v31 as v31
a=v31.a;b=a.b;V=Vector;PI=math.pi
JOB=None
R=random.Random(3200)


def loft(name,points,width,depth,mat,bone,normal=(0,-1,0),phase=0):
    """Closed smooth S-curved lock, broad embedded root, swept pointed tip."""
    pts=[V(p) for p in points];verts=[];faces=[];rings=11;sides=8
    n=V(normal).normalized();axis=(pts[-1]-pts[0]).normalized();side=axis.cross(n)
    if side.length<.05:side=axis.cross(V((1,0,0)))
    side.normalize();n=side.cross(axis).normalized()
    for j in range(rings):
        t=j/(rings-1);u=1-t
        c=u**3*pts[0]+3*u*u*t*pts[1]+3*u*t*t*pts[2]+t**3*pts[3]
        span=width*(.88+.20*math.sin(PI*t))*(1-t)**.72+.0002*max(width,.01)
        # Different left and right barbs; quiet, continuous silhouette variation.
        for k in range(sides):
            q=2*PI*k/sides;asym=1+.09*math.sin(phase+4.1*t+q)*math.sin(PI*t)
            verts.append(tuple(c+side*(math.cos(q)*span*asym)+n*(math.sin(q)*depth*(.7+.3*math.sin(PI*t))*(1-.85*t))))
        if j:
            for k in range(sides):faces.append(((j-1)*sides+k,(j-1)*sides+(k+1)%sides,j*sides+(k+1)%sides,j*sides+k))
    faces.extend([tuple(reversed(range(sides))),tuple((rings-1)*sides+k for k in range(sides))])
    return b.mesh_obj(name,verts,faces,mat,bone)


def lens(name,c,normal,width,height,depth,mat,bone='Head',slant=0):
    n=V(normal).normalized();across=V((0,0,1)).cross(n).normalized();up=n.cross(across)
    verts=[];faces=[];N=32
    for layer in (0,1):
        for ring in range(5):
            r=(ring+.001)/4.001
            for k in range(N):
                q=2*PI*k/N;x=math.cos(q)*width*r
                y=math.sin(q)*height*r*(.72+.28*abs(math.sin(q)))+slant*x
                z=(depth*(1-r*r) if layer==0 else -.008)
                verts.append(tuple(V(c)+across*x+up*y+n*z))
                if ring:
                    j=layer*5*N+ring*N+k;prev=j-N
                    faces.append((prev,layer*5*N+(ring-1)*N+(k+1)%N,layer*5*N+ring*N+(k+1)%N,j) if layer==0 else (j,layer*5*N+ring*N+(k+1)%N,layer*5*N+(ring-1)*N+(k+1)%N,prev))
        faces.append(tuple(layer*5*N+k for k in range(N)))
    for k in range(N):faces.append((4*N+k,4*N+(k+1)%N,9*N+(k+1)%N,9*N+k))
    return b.mesh_obj(name,verts,faces,mat,bone)


def eyes(center,rx,ry,rz,size,family):
    # Eye depths are measured from a skull surface, never stacked cylinders.
    par=v31.parameters(JOB);hy=par['heady'];hz=par['headz'];baby=JOB['index']==0
    for sign in (-1,1):
        if family=='moon':
            hr=.30 if baby else .27 if JOB['index']==1 else .315
            n=V((sign*.59,-.807,.025));c=V((sign*hr*.53,hy-hr*.76,hz+.047));w=.096 if baby else .086;h=.060 if baby else .037;slant=-sign*.23
        elif family=='star':
            n=V((sign*.72,-.69,.025));c=V((sign*rx*.74,hy-.165,hz+.055));w=.074 if baby else .065;h=.058 if baby else .046;slant=-sign*.15
        else:
            radial=V((sign*.48,-.877,0));hr=.26 if baby else .155;rz=hr*.87;zz=.034
            distance=math.sqrt(1-(zz/rz)**2)/math.sqrt((radial.x/hr)**2+(radial.y/(hr*1.38))**2)
            c=V((radial.x*distance,hy+radial.y*distance,hz+zz));n=V((radial.x*distance/(hr*hr),radial.y*distance/(hr*1.38)**2,zz/rz**2)).normalized()
            c+=n*.004;w=.09 if baby else .058;h=.083 if baby else .055;slant=-sign*.10
        n.normalize();c-=n*.007
        lens('inset_orbit',c,n,w*1.08,h*1.12,.007,0,slant=slant)
        lens('almond_eye',c+n*.005,n,w,h,.010,15 if family=='moon' else 1,slant=slant)
        # Elliptical iris sits almost flush inside the almond opening.
        iris=c+n*.019+V((-sign*.006,0,0))
        a.orient_ell('soft_iris',iris,n,(w*.48,h*.84,.004),7 if family=='moon' else 6,'Head')
        a.orient_ell('vertical_pupil',iris+n*.004,n,(w*.21,h*.65,.002),3,'Head')
        a.orient_ell('small_catchlight',iris+n*.007+V((-w*.18,0,h*.34)),n,(w*.11,h*.14,.001),1,'Head')
        across=V((0,0,1)).cross(n).normalized();up=n.cross(across)
        upper=[c+n*.007+across*(w*math.cos(q))+up*(h*math.sin(q)+slant*w*math.cos(q)) for q in np.linspace(0,PI,13)]
        b.tube('upper_lash',upper,[.0035+.0025*math.sin(PI*k/12) for k in range(13)],3,'Head',sides=6)
        # Brow is a soft fur ridge with an embedded root and a swept outer tip.
        p=c+up*h*1.0-n*.008
        loft('brow_flow',[p-across*w*.55,p+up*.025,p+across*w*.8+up*.013,p+across*w*1.2-up*.008],w*.22,.012,2 if family=='moon' else 0,'Head',n,sign)


def ears(center,hr,family):
    if family!='moon':return ORIGINAL_EARS(center,hr,family)
    baby=JOB['index']==0
    for sign,label in ((1,'L'),(-1,'R')):
        base=V(center)+V((sign*(.21 if baby else .215),.035,.16));height=.38 if baby else .34;width=.13 if baby else .12
        tip=base+V((sign*.07,.045,height));name=label+'_Ear';b.add_bone(name,base,tip,'Head')
        verts=[];faces=[];rows=13;cols=9
        for back in (False,True):
            for j in range(rows):
                t=j/(rows-1);w=width*(.72+.43*math.sin(PI*t))*(1-t)**.66+.0001
                for k in range(cols):
                    u=2*k/(cols-1)-1;p=base.lerp(tip,t)+V((u*w,0,0))
                    p.y+=(.052 if back else .014-.047*u*u)*math.sin(PI*t*.9)
                    verts.append(tuple(p))
                    if j and k:
                        i=int(back)*rows*cols+j*cols+k;faces.append((i-cols-1,i-cols,i,i-1) if not back else (i-1,i,i-cols,i-cols-1))
        off=rows*cols
        for j in range(rows-1):
            for k in (0,cols-1):x=j*cols+k;faces.append((x,x+cols,x+cols+off,x+off))
        for k in range(cols-1):
            for j in (0,rows-1):x=j*cols+k;faces.append((x,x+1,x+1+off,x+off))
        ob=b.mesh_obj('soft_ear_cup',verts,faces,0,name);ob.data.materials.append(b.MATS[5]);ob.data.materials.append(b.MATS[1])
        for face in ob.data.polygons:
            if all(i<off for i in face.vertices):
                c=sum((ob.data.vertices[i].co for i in face.vertices),V())/len(face.vertices);t=(c.z-base.z)/height
                if .15<t<.85 and abs(c.x-(base.x+sign*.07*t))<width*(1-t)**.7*.63:face.material_index=1
        for j in range(3):
            p=base+V((sign*(j-1)*.035,-.02,.07+j*.035));loft('ear_inner_fur',[p,p+V((0,-.018,.045)),p+V((sign*.02,0,.095)),p+V((sign*.015,0,.13))],.027,.012,1,name,(0,-1,0),j)


ORIGINAL_EARS=a.make_ears
ORIGINAL_ELL=a.ell
ORIGINAL_TUBE=a.tube
ORIGINAL_LEAF=a.leaf
ORIGINAL_TAIL=a.make_tail


def base_ell(name,p,scale,mat=0,names=None,bone=None):
    if JOB['family']=='moon':
        p=V(p);scale=list(scale);baby=JOB['index']==0
        if name=='cranium':scale=[.30,.28,.27] if baby else [.27,.265,.25] if JOB['index']==1 else [.315,.28,.28]
        if name in ('pale_muzzle','nose'):p.y+=.035 if baby else .075
        if name=='pale_muzzle':scale=[.105 if baby else .10,.115,.072]
        if name=='lower_jaw':p.y+=.035;scale[1]*=.85
    return ORIGINAL_ELL(name,p,scale,mat,names,bone)


def base_tube(name,pts,radii,mat=0,names=None,bone=None,sides=16):
    if JOB['family']=='moon' and name=='nasal_wedge':
        pts=[V(p) for p in pts];pts[-1].y+=.035 if JOB['index']==0 else .075
        radii=[(.16,.14),(.125,.105),(.09,.075)] if JOB['index']==0 else [(.20,.17),(.135,.11),(.085,.075)]
    return ORIGINAL_TUBE(name,pts,radii,mat,names,bone,sides)


def base_leaf(name,start,end,width,mat,bone,normal=(0,0,1),thickness=.018):
    if name in ('cheek_ruff','chest_coat','aurora_surface','nape_plume','mane','mirror_feather','covert','dorsal_ice'):return None
    if name.startswith('flight_'):
        p,q=V(start),V(end);delta=q-p;n=V(normal);phase=R.uniform(0,2*PI)
        q=p+delta*R.uniform(.91,1.09)+n*R.uniform(.005,.025)
        return loft(name,[p,p+delta*.30+n*.022,p+delta*.73+n*R.uniform(.028,.055),q],width*R.uniform(.87,1.12),thickness*.7,1 if JOB['family']=='sun' else 9,bone,n,phase)
    return ORIGINAL_LEAF(name,start,end,width,mat,bone,normal,thickness)


def base_tail(points,widths,mat):
    if JOB['family']=='moon':
        length=v31.parameters(JOB)['length'];z=v31.parameters(JOB)['bodyz'];baby=JOB['index']==0
        points=[(0,length*.92,z+.07),(.035,length*1.21,z+.16),(.02,length*1.43,z+.37),(0,length*1.55,z+.61)]
        widths=[.09,.135 if baby else .155,.125 if baby else .15,.010]
    return ORIGINAL_TAIL(points,widths,mat)


def materials(job):
    v31.materials(job)
    palettes={'moon':{0:(.072,.105,.255),1:(.73,.78,.92),2:(.16,.20,.40),4:(.26,.29,.53),5:(.33,.31,.55),9:(.27,.56,.84),15:(.42,.48,.70)},'sun':{0:(.91,.86,.71),1:(.99,.955,.84),2:(.76,.43,.12),9:(.98,.72,.32),13:(.40,.21,.065),15:(.94,.89,.77)},'star':{0:(.96,.64,.28),2:(.82,.48,.13),4:(.16,.025,.37),5:(.37,.07,.60),9:(.99,.74,.35),13:(.50,.25,.07),15:(.91,.73,.48)}}
    colors=b.PALETTES[job['family']].copy()
    for i,c in palettes[job['family']].items():colors[i]=c
    n=job['size'][2];k=n//4;base=np.array(bpy.data.images['atlas_base_color'].pixels[:],dtype=np.float32).reshape(n,n,4);orm=np.array(bpy.data.images['atlas_orm'].pixels[:],dtype=np.float32).reshape(n,n,4)
    for i,c in enumerate(colors):
        y,x=i//4*k,i%4*k;yy,xx=np.mgrid[0:k,0:k].astype(np.float32)/(k-1)
        variation=.94+.055*yy+.009*np.sin(xx*17+np.sin(yy*13))
        srgb=np.array(c);linear=np.where(srgb<=.04045,srgb/12.92,((srgb+.055)/1.055)**2.4)
        base[y:y+k,x:x+k,:3]=np.minimum(1,linear*variation[:,:,None]);b.MATS[i].diffuse_color=(*linear,1)
        metallic=.78 if i in (2,13) and job['family']!='moon' else .30 if i==9 and job['family']=='star' else 0
        rough=.90 if i in (0,1,4,5,15) else .40 if i==9 else .29 if metallic else .5
        if job['family']=='moon' and i==2:rough=.92
        if i==7 and job['family']=='sun':rough=.13;metallic=.92
        orm[y:y+k,x:x+k,:3]=(1,rough,metallic)
        bs=b.MATS[i].node_tree.nodes.get('Principled BSDF');bs.inputs['Specular IOR Level'].default_value=.22 if i in (0,1,4,5,15) else .4
        if job['family']=='moon' and i==2:bs.inputs['Specular IOR Level'].default_value=.18
        # glTF's sheen extension has a different weight convention. A white
        # Blender sheen tint can become full white sheen after reimport.
        bs.inputs['Sheen Weight'].default_value=0
    for name,data in [('base_color',base),('orm',orm)]:
        im=bpy.data.images['atlas_'+name];im.pixels.foreach_set(data.ravel());im.save();im.pack()


def refine(job,mesh,rig):
    par=v31.parameters(job);S=a.SCALE;family=job['family'];idx=job['index'];baby=idx==0
    shift=V(b.BONES['Head']['head'])/S-V((0,par['heady'],par['headz']));P=lambda p:(V(p)+shift)*S
    owned={v.index for v in mesh.data.vertices if any(g.group==mesh.vertex_groups['QA_BARE_ANATOMY'].index and g.weight>.5 for g in v.groups)}
    skinfaces=[tuple(p.vertices) for p in mesh.data.polygons if all(i in owned for i in p.vertices)]
    tree=BVHTree.FromPolygons([v.co for v in mesh.data.vertices],skinfaces)
    added=[];old=set(bpy.data.objects);z=par['bodyz'];hy=par['heady'];hz=par['headz'];length=par['length'];width=par['width']
    def hit(center,n):
        # A global front-to-back ray could hit the muzzle while asking for a
        # throat tuft at the same height. Limit canid queries to the local mass.
        radius=.55 if family=='moon' else 2
        n=V(n).normalized();p,normal,_,_=tree.ray_cast(P(center)+n*radius*S,-n,2*radius*S)
        return (p,normal) if p is not None else (None,None)
    def lock(p,d,w,mat,bone,n,scale=1):
        n=V(n).normalized();d=V(d)*S;root=V(p)-n*(.010 if family=='sun' else .018)*S;side=d.normalized().cross(n)
        bend=side*R.uniform(-.025,.025)*S
        ob=loft('growth_clump',[root,root+d*.28+n*(.045 if family=='sun' else .018)*S,root+d*.75+n*(.055 if family=='sun' else .025)*S+bend,root+d+n*R.uniform(.007,.025)*S],w*S,(.013 if family=='sun' else .023)*S*scale,mat,bone,n,R.uniform(0,6))
        # The root inherits its actual underlying skin region, rather than a
        # guessed head/neck label that could detach during howls and strikes.
        _,_,faceid,_=tree.find_nearest(V(p));weights={}
        for vi in skinfaces[faceid]:
            vertex=mesh.data.vertices[vi];factor=1/max((vertex.co-V(p)).length,.003*S)**2
            for g in vertex.groups:
                name=mesh.vertex_groups[g.group].name
                if name in rig.data.bones:weights[name]=weights.get(name,0)+g.weight*factor
        chosen=sorted(weights.items(),key=lambda item:item[1],reverse=True)[:4];total=sum(w for _,w in chosen);ob.vertex_groups.clear()
        for name,weight in chosen:ob.vertex_groups.new(name=name).add(list(range(len(ob.data.vertices))),weight/total,'REPLACE')
        return ob
    # Continuous light muzzle/chest boundaries follow anatomy; coat clumps soften them.
    for i in (1,2,15):mesh.data.materials.append(b.MATS[i])
    pale=len(mesh.data.materials)-3;mid=pale+1;soft=pale+2
    for f in mesh.data.polygons:
        if not all(i in owned for i in f.vertices):continue
        c=sum((mesh.data.vertices[i].co for i in f.vertices),V())/len(f.vertices)/S-shift
        if family=='moon':
            if c.z<(.31 if baby else .43)+.025*math.sin(c.y*31+c.x*19):f.material_index=pale
            if c.y<hy+.02 and c.z<hz-.065 and c.z>hz-.25:f.material_index=pale
            if c.y<-length*.51 and z-.29<c.z<hz-.16 and abs(c.x)<width*.77 and f.normal.y<-.27:f.material_index=pale
            elif c.z>z+.22 and c.y>hy+.20:f.material_index=mid
        elif family=='star' and c.y<-length*.55 and z-.30<c.z<z+.15 and abs(c.x)<width*.56:f.material_index=pale
    if family=='moon':
        # Cheek fans, forehead and throat have different guides and silhouette roles.
        for sign in (-1,1):
            for j in range(13 if baby else 18):
                t=j/(12 if baby else 17);center=(0,hy+.03+t*.28,hz+.16-t*.46);n=(sign*(.7+R.random()*.3),-.5+R.random()*.45,.26-t*.35)
                p,n=hit(center,n)
                if p is None:continue
                d=(sign*R.uniform(.08,.15),R.uniform(.10,.18),-.012-t*.025)
                lock(p,d,R.uniform(.037,.067),1 if t>.50 else 2 if j%3 else 4,'Head' if t<.45 else 'Neck_2',n)
            for j in range(8):
                t=(j+.3)/8;p,n=hit((0,hy-.01,hz+.18),(sign*(.1+t*.75),-.72,.65-t*.2))
                if p is not None:lock(p,(sign*.04,.08,.09-.12*t),R.uniform(.025,.045),2 if j%3 else 15,'Head',n)
        for j in range(45 if idx>=2 else 30):
            t=R.random();angle=R.uniform(-1.25,1.25);p,n=hit((0,-length*.77,z+.34-t*.58),(math.sin(angle),-math.cos(angle),.06))
            if p is None:continue
            lock(p,(n.x*.08,.025,-R.uniform(.13,.24)),R.uniform(.042,.083),1 if abs(angle)<.70 else 15 if j%3 else 2,'Neck_1' if t<.25 else 'Thorax',n,1.15)
        # Broad shoulder/rump groups, sparse short flank coat. No tiled rows.
        for j in range(180 if idx>=2 else 110):
            y=R.uniform(-length*.8,length*.79);angle=R.uniform(0,2*PI);p,n=hit((0,y,z),(math.cos(angle),0,math.sin(angle)))
            if p is None or n.z<-.55:continue
            shoulder=y<-length*.25;long=(shoulder or y>length*.48)
            if not long and -.30<n.z<.52:continue
            d=(n.x*.04,R.uniform(.12,.22) if long else R.uniform(.07,.13),-.02-R.random()*.025)
            lock(p,d,R.uniform(.037,.065) if long else R.uniform(.029,.049),2 if n.z>.25 else 0 if j%4 else 4,'Thorax' if shoulder else 'Lumbar' if y<length*.32 else 'Pelvis',n)
        # Central forehead blaze and the supraorbital fan break the bald dome.
        for sign in (-1,1):
            for j in range(5):
                p=P((sign*(.025+j*.018),hy-.20,hz+.20-j*.01))
                loft('forehead_sweep',[p,p+V((sign*.07,-.015,.05))*S,p+V((sign*.12,.025,.055))*S,p+V((sign*.16,.07,.02))*S],.036*S,.018*S,2 if j%3 else 4,'Head',(0,-1,0),j)
        p=P((0,hy-.235,hz+.19));loft('forehead_blaze',[p,p+V((0,-.025,-.03))*S,p+V((0,-.035,-.10))*S,p+V((0,-.02,-.16))*S],.028*S,.012*S,15,'Head',(0,-1,0),0)
        # Aurora follows three flowing, tapered stripes rather than equal slashes.
        for sign in (-1,1):
            for stripe in range(3):
                pts=[]
                for j in range(9):
                    t=j/8;y=-length*.70+stripe*.40+t*.38;p,n=hit((0,y,z+.06+math.sin(t*PI+stripe)*.13),(sign*.97,0,.18))
                    if p is not None:pts.append(p+n*.003*S)
                if len(pts)>3:b.tube('flowing_aurora',pts,[.002*S+.009*S*math.sin(PI*j/(len(pts)-1)) for j in range(len(pts))],7,'Thorax' if stripe==0 else 'Lumbar',sides=6)
        if idx==3:
            for j in range(7):
                p,n=hit((0,-length*.44+j*.19,z),(0,0,1))
                if p is not None:
                    d=V((R.uniform(-.035,.035),.13+R.random()*.06,.16+.13*math.sin(PI*(j+.8)/8)))*S
                    loft('swept_ice_spine',[p,p+d*.3+V((0,-.03,.02))*S,p+d*.75,p+d],R.uniform(.045,.065)*S,.03*S,9,'Thorax' if j<3 else 'Lumbar',(1,0,0),j)
    elif family=='sun':
        # Downward chest feather fans and back contour feathers overlap in growth groups.
        for j in range(135 if not baby else 95):
            y=R.uniform(-.32,.43);ang=R.uniform(0,2*PI);p,n=hit((0,y,z),(math.cos(ang),0,math.sin(ang)))
            if p is None:continue
            d=V((n.x*.018,.06+R.random()*.08,-.11-R.random()*.065))
            lock(p,d,R.uniform(.038,.069),1 if j%5 else 15,'Thorax' if y<-.1 else 'Lumbar' if y<.16 else 'Pelvis',n,.8)
        for front,count in ((True,65),(False,40)):
            for j in range(count):
                n=V((R.uniform(-.75,.75),-1 if front else 1,R.uniform(-.85,.9)));p,n=hit((0,-.04 if front else .13,z),n)
                if p is not None:lock(p,(n.x*.025,.018 if front else .06,-R.uniform(.12,.21)),R.uniform(.035,.067),1 if j%5 else 15,'Thorax' if front else 'Pelvis',n,.75)
        for sign in (-1,1):
            for j in range(9):
                t=j/8;p,n=hit((0,hy+.025,hz+.04),(sign*(.42+.5*t),-.50+.8*t,.45-.9*t))
                if p is not None:lock(p,(sign*(.06+.025*math.sin(PI*t)),.10,-.005-.035*t),.035 if baby else .025,1,'Head',n,.6)
            for j in range(7):
                if baby:continue  # Short-neck chick has no hanging throat plume.
                t=j/6;p,n=hit((0,-.27,z+.15+t*.42),(sign*.25,-.95,.1))
                if p is not None:lock(p,(sign*.025,.015,-.17),.043,1,'Neck_1' if t>.5 else 'Thorax',n,.7)
        # Crown forehead tuft: a directional fan, not a naked smooth forehead.
        for j in range(7):
            t=(j-3)/3;p,n=hit((0,hy,hz),(t*.45,-.75,.58))
            if p is not None:lock(p,(t*.055,-.025,.09-abs(t)*.06),.035 if baby else .022,1,'Head',n,.5)
        for sign in (-1,1):
            # A leaf-and-flower cluster, with designed mass and uneven individual leaves.
            for j in range(9):
                t=j/8;root=P((sign*(.17+.07*t),-.09+.17*t,z+.27));d=V((sign*R.uniform(.03,.07),R.uniform(-.03,.09),R.uniform(.07,.12)))*S
                loft('botanical_leaf',[root,root+d*.3,root+d*.8+V((0,0,.02))*S,root+d],R.uniform(.018,.036)*S,.008*S,4,'Thorax',(sign,0,1),j)
            for j in range(3):
                p=P((sign*(.18+j*.034),-.10+j*.055,z+.34+(.018 if j==1 else 0)))
                for k in range(5):
                    angle=2*PI*k/5+.3*j;off=V((math.cos(angle)*.021,math.sin(angle)*.014,.012))*S;b.ell('small_flower_petal',p+off,(.017*S,.013*S,.011*S),1,'Thorax',seg=10,rings=6)
                b.ell('flower_heart',p+V((0,0,.02))*S,(.009*S,)*3,9,'Thorax',seg=8,rings=6)
        # Gold gorget with one central gem and two organic scrolls, on the real chest.
        center,n=hit((0,-.2,z+.16),(0,-1,0))
        if center is not None:
            for sign in (-1,1):
                pts=[center+V((sign*x,-.006,zz))*S for x,zz in [(0,.04),(.07,.075),(.12,.035),(.10,-.035),(.045,-.06),(.03,-.025),(.06,-.015)]]
                ob=a.curved_tube('worked_gold_gorget',pts,[.009*S,.012*S,.011*S,.009*S,.008*S,.006*S,.003*S],2,bone='Thorax')
            loft('chest_jewel',[center,center+V((0,-.018,-.04))*S,center+V((0,-.02,-.08))*S,center+V((0,-.012,-.12))*S],.032*S,.012*S,4,'Thorax',(0,-1,0),0)
        crown=P((0,hy+.035,hz+.35))
        for j in range(7):
            angle=2*PI*(j+.02*math.sin(j*2))/7;d=V((math.sin(angle),0,math.cos(angle)));root=crown+d*.128*S
            loft('crown_gold_ray',[root,root+d*.025*S,root+d*.06*S,root+d*(.083 if j%3 else .10)*S],.022*S,.010*S,2,'Crown',(0,-1,0),j)
        # Frame each actual mirror; no floating white beads on a bare circular wire.
        for k in range(1 if idx==2 else 3 if idx==3 else 0):
            center=P((0,.95+k*.09,z+.36));rad=(.59+k*.15)*S;name='Array_'+str(k+1)
            for j in range(10):
                angle=2*PI*j/10;p=center+V((math.cos(angle)*rad,0,math.sin(angle)*rad))
                b.orb_ring('mirror_bezel',p,.064*S,.009*S,2,name,segments=24)
                if j in (0,2,5,7):
                    d=V((math.cos(angle),0,math.sin(angle)));loft('array_finial',[p+d*.055*S,p+d*.08*S,p+d*.11*S,p+d*.14*S],.021*S,.012*S,9,name,(0,-1,0),j)
    # Freeform mane: a few large guide curls, subordinate finer strands.
    if family=='star':
        for j in range(3):
            p=P((.03+j*.022,hy+.04,hz+.20));pts=[p,p+V((-.03,-.05,.20-j*.025))*S,p+V((-.22,-.16,.20-j*.05))*S,p+V((-.28+j*.02,-.20,.015-j*.04))*S]
            loft('crest_hero_curl',pts,(.068-j*.005)*S,.030*S,5 if j<2 else 4,'Head',(0,-1,0),j)
        for j in range(20):
            t=(j+R.uniform(-.25,.25))/20;side=1 if j%7 else -1;p=P((0,hy+.10+t*.48,hz+.20-t*.54));L=R.uniform(.31,.54)*(1.08 if idx>=2 else 1)
            pts=[p,p+V((side*.10,.04,.10))*S,p+V((side*.23,.20,-L*.5))*S,p+V((side*(.13+R.random()*.08),.26,-L))*S]
            ob=loft('mane_guide_curl',pts,R.uniform(.042,.074)*S,.025*S,5 if j%4 else 4,'Head' if t<.17 else 'Neck_2' if t<.65 else 'Neck_1',(side,0,0),j)
            v31.adjacent_weights(ob,['Head','Neck_2'] if t<.25 else ['Neck_2','Neck_1'])
            if j%4==0:
                b.tube('gold_mane_thread',[p+V((0,-.013,0))*S for p in pts],[.005*S,.007*S,.005*S,.0005*S],9,'Head' if t<.25 else 'Neck_2',sides=6)
        for j in range(6):
            p=P((.03+j*.009,hy+.01,hz+.20-j*.013));pts=[p,p+V((-.08,-.12,.11))*S,p+V((-.21,-.17,.035-j*.025))*S,p+V((-.24+j*.018,-.19,-.10-j*.028))*S]
            loft('swept_forelock',pts,(.045+j*.001)*S,.019*S,5 if j%3 else 4,'Head',(0,-1,0),j)
    if family in ('moon','star'):
        names=[n for n in b.BONES if n.startswith('Tail_')];controls=[V(b.BONES[n]['head']) for n in names]+[V(b.BONES[names[-1]]['tail'])]
        for j in range(29 if family=='moon' else 15):
            angle=2*PI*(j*.61803398875%1);path=[]
            for k,p in enumerate(controls):
                tangent=(controls[min(k+1,3)]-controls[max(k-1,0)]).normalized();u=tangent.cross(V((1,0,0))).normalized();v=tangent.cross(u);rad=(.06+.15*math.sin(PI*k/3))*(.85+.25*R.random())*S
                path.append(p+(u*math.cos(angle)+v*math.sin(angle))*rad)
            path[-1]+=V((math.sin(angle)*R.uniform(.03,.10),R.uniform(-.01,.08),math.cos(angle)*.06))*S
            ob=loft('tail_growth_lock',path,R.uniform(.055,.10)*S,.025*S,1 if family=='moon' and j%6==0 else 2 if family=='moon' and j%3 else 0 if family=='moon' else 5 if j%3 else 4,names[0],(math.cos(angle),0,math.sin(angle)),j)
            v31.adjacent_weights(ob,names)
        if family=='moon':b.star('tail_guiding_star',controls[-1],.07*S,12,names[-1])
    # Coverts follow individual feathers, with staggered size, curl and root depth.
    for f in a.FEATHERS:
        p=V(b.BONES[f['name']]['head']);q=V(b.BONES[f['name']]['tail']);d=q-p
        for side in (-1,1):
            n=V((0,0,side));r=p+n*.013*S;factor=R.uniform(.40,.61)
            loft('wing_median_covert',[r,r+d*.15+n*.018*S,r+d*factor*.8+n*.03*S,r+d*factor+n*.017*S],R.uniform(.050,.075)*S,.009*S,1 if family=='sun' else 9,f['name'],n,R.random()*6)
        if family=='sun' and idx>=1 and f['index'] in (0,2,5):
            root=p+V((0,0,.035))*S;tip=p+d*.74+V((0,0,.045))*S
            loft('mirror_gold_frame',[root,root+d*.23,root+d*.55,tip],.065*S,.012*S,2,f['name'],(0,0,1),f['index'])
            loft('mirror_silver_inset',[root+d*.06+V((0,0,.010))*S,root+d*.24+V((0,0,.012))*S,root+d*.53+V((0,0,.012))*S,tip-d*.045+V((0,0,.010))*S],.050*S,.006*S,7,f['name'],(0,0,1),f['index'])
        if family=='star' and idx==3 and f['group']=='primary' and f['index']%2==0:
            p=p+d*.4
            pts=[p,p+V((0,.05,.10))*S,p+V((.025,.16,.16))*S,p+V((0,.23,.08))*S]
            a.curved_tube('cloud_curl',pts,[.022*S,.055*S,.055*S,.003*S],5,bone=f['name'])
    added=[o for o in bpy.data.objects if o not in old and o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True)
    for ob in added:ob.select_set(True)
    bpy.context.view_layer.objects.active=mesh;bpy.ops.object.join()
    bm=bmesh.new();bm.from_mesh(mesh.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6*S);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh.data);bm.free()
    deform={g.index for g in mesh.vertex_groups if g.name in rig.data.bones}
    for vert in mesh.data.vertices:
        weights=sorted([(g.group,g.weight) for g in vert.groups if g.group in deform and g.weight>1e-8],key=lambda x:x[1],reverse=True);keep=weights[:4];total=sum(w for _,w in keep)
        for g,_ in weights:mesh.vertex_groups[g].remove([vert.index])
        for g,w in keep:mesh.vertex_groups[g].add([vert.index],w/total,'REPLACE')
    b.atlas_uv(mesh);mesh['revision']='3.2';mesh['status']='growth-guided reference polish; technical and visual review required'
    return mesh


def main():
    global JOB,R
    ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only');ap.add_argument('--no-render',action='store_true');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    for job in json.loads(Path(args.jobs).read_text(encoding='utf-8-sig')):
        if args.only and job['family']+':'+job['stage'] not in args.only.split(','):continue
        JOB=job;R=random.Random(3200+job['index']*101+['sun','moon','star'].index(job['family'])*900)
        print('V32_START',job['task_id'],flush=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
        b.JOB=job;b.PARTS=[];b.BODY=[];b.BONES={};a.SAMPLES=[];a.LEGS={};a.WINGS={};a.FEATHERS=[];a.AXIAL=[]
        Path(job['output']).mkdir(parents=True,exist_ok=True);materials(job)
        a.eyes=eyes;a.make_ears=ears;a.ell=base_ell;a.tube=base_tube;a.leaf=base_leaf;a.make_tail=base_tail
        landmarks=a.build_bird(job) if job['family']=='sun' else a.build_quad(job)
        a.ell=ORIGINAL_ELL;a.tube=ORIGINAL_TUBE;a.leaf=ORIGINAL_LEAF;a.make_tail=ORIGINAL_TAIL
        if job['family']=='moon':
            for ob in list(b.PARTS):
                if ob.name.startswith('tail_star'):b.PARTS.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
            new=V(landmarks['mouth']);new.y+=.035 if job['index']==0 else .075;landmarks['mouth']=tuple(new);landmarks['nose_y']=new.y;b.BONES['Jaw']['tail']=tuple(new)
        mesh,rig=a.join_skin(job,landmarks);mesh=refine(job,mesh,rig);clips,checks=v31.animate(job,rig,mesh)
        if not args.no_render:a.render(job,mesh,rig,clips)
        b.reference_images(job,a.SCALE);a.export_and_report(job,mesh,rig,clips,checks)
        out=Path(job['output']);report=json.loads((out/'build_report.json').read_text(encoding='utf8'));report.update(revision='3.2',status='reference_polish_pending_independent_review',canonical_clips=sum(c['category']=='canonical' for c in clips),supplemental_clips=sum(c['category']=='supplemental' for c in clips),surface_design='inset almond eyes, anatomical muzzle, ear cups, growth-guided variable clump masses, staggered curved flight feathers, fitted gold bezels and asymmetric botanical clusters',textures='embedded base color, authored normal, ORM; no high-poly bake',limitations=['Stylized procedural reconstruction; original illustration remains the design authority.','Target engine acceptance and exhaustive collision simulation not performed.']);b.write_json(out/'build_report.json',report);b.write_json(out/'motion_spec.json',dict(revision='3.2',status='303 canonical and 93 supplemental library retained; independent checks pending',clips=clips,checks=checks))
        print('V32_DONE',job['task_id'],flush=True)


if __name__=='__main__':main()
