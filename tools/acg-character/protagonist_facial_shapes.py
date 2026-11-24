"""Facial morphs for the protagonist head, eyelids, brows and teeth."""
from dataclasses import dataclass
from math import cos, pi, sin

import numpy as np
from mathutils import Vector


@dataclass(frozen=True)
class MouthPose:
    half: float
    upper: float
    lower: float
    corners: float = 0.
    forward: float = 0.
    jaw: float = 0.
    teeth: float = 0.


# All distances are millimetres. Eye settings are (opening ratio, vertical
# offset, brow offset, inner-brow lift). The same morph names travel in glTF.
VISEMES = {
    'Viseme_A': MouthPose(20,5.,13.,1.0,0,7.0,.13),
    'Viseme_I': MouthPose(24,2.3,3.5,2.0,0,1.7,.72),
    'Viseme_U': MouthPose(10,5.6,6.6,-.2,1.8,3.2,0),
    'Viseme_E': MouthPose(23,3.0,7.5,1.8,0,3.6,.50),
    'Viseme_O': MouthPose(13,6.4,10.0,.3,1.3,5.6,0),
    'Viseme_MBP': MouthPose(15,.38,.45,0,.7,0,0),
}
EXPRESSIONS = {
    'Smile': (MouthPose(25,1.7,7.7,7.3,0,2.8,.70),(.68,1.7,1.6,0),(.68,1.7,1.6,0)),
    'Surprise': (MouthPose(13,6.3,12.8,0,.7,6.8,.05),(1.17,.8,5.5,1.0),(1.17,.8,5.5,1.0)),
    'Angry': (MouthPose(18,1.1,3.3,-3.3,0,0,.40),(.76,-.5,-1.7,-4.0),(.76,-.5,-1.7,-4.0)),
    'Sad': (MouthPose(15,.64,2.3,-4.7,0,0,0),(.82,-.95,.9,5.1),(.82,-.95,.9,5.1)),
    'Blink': (None,(.043,-1.6,0,0),(.043,-1.6,0,0)),
    'Wink_L': (None,(1,0,0,0),(.043,-1.6,.7,0)),
    'Wink_R': (None,(.043,-1.6,.7,0),(1,0,0,0)),
}
REST_EYE = (1.,0.,0.,0.)
LIP_DEPTH_SCALE = .64


def smooth(value):
    t=max(0.,min(1.,value))
    return t*t*(3.-2.*t)


class FacialRig:
    def __init__(self, face):
        self.face=face
        self.neutral=(MouthPose(25,.7,10.8,4.1,0,0,.70) if face.hero=='yeh_chengxi'
                      else MouthPose(12,.38,.43,.22 if face.hero=='amemori_sumiha' else -.35))
        self.states={name:(x,REST_EYE,REST_EYE) for name,x in VISEMES.items()}
        self.states.update({n:(m or self.neutral,r,l) for n,(m,r,l) in EXPRESSIONS.items()})
        self.count=64

    def angles(self):
        return [2*pi*i/self.count for i in range(self.count)]

    def mouth_shape(self, pose):
        f=self.face
        rings=[[],[],[],[]]
        for a in self.angles():
            u,v=cos(a),sin(a)
            sign=1 if v>=0 else -1
            lift=pose.upper if sign>0 else pose.lower
            for i,(width,margin,depth) in enumerate(((5.7,5.1,0),(2.,1.55,-.31),
                                                     (0.,0,-.24),(-1.1,-.16,7.5))):
                x=f.center+(pose.half+width)*.001*u
                z=f.mouth_z+.001*(pose.corners*u*u+sign*(lift+margin)*abs(v)**.83)
                p=f.front(x,z)
                p.y+=.001*(depth-pose.forward*LIP_DEPTH_SCALE*(.4 if i==0 else 1.))
                rings[i].append(p)
        center=f.front(f.center,f.mouth_z-.00028*pose.lower)
        center.y+=.014
        return [p for ring in rings for p in ring]+[center]

    def append_mouth(self, verts, polygons, indices, boundary):
        added=self.mouth_shape(self.neutral)
        start=len(verts)
        verts.extend(added)
        last=boundary
        for k,material in enumerate((0,0,2,3)):
            ring=list(range(start+k*self.count,start+(k+1)*self.count))
            for i in range(self.count):
                j=(i+1)%self.count
                polygons.append((last[i],last[j],ring[j],ring[i]))
                indices.append(material)
            last=ring
        for i in range(self.count):
            polygons.append((last[i],last[(i+1)%self.count],len(verts)-1))
            indices.append(3)
        return list(range(start,len(verts)))

    def jaw(self,p,pose):
        """Blend the jaw into the unchanged neck behind the mandible."""
        f=self.face
        if not pose.jaw or p.z>f.mouth_z or p.y>-.024:
            return p.copy()
        x=(p.x-f.center)/.085
        below=smooth((f.mouth_z-p.z)/.025)
        front=smooth((-.024-p.y)/.060)
        strength=below*front*max(0.,1-x*x)
        return p+Vector((0,pose.jaw*.000095*strength,-pose.jaw*.001*strength))

    def orbital(self,p,side,setting,weight=1.,lash=0.):
        opening,offset,_,_=setting
        if opening==1. and offset==0.:
            return p.copy()
        f=self.face
        x=(p.x-f.eye_center(side).x)/(f.config['half']*.001)
        closed=smooth((.48-opening)/.4)
        curve=.0029*max(0.,1-x*x)+.00068*side*max(-1.,min(1.,x))
        z=f.eye_z+(p.z-f.eye_z)*opening+offset*.001+closed*(curve+lash)
        moved=p.copy()
        moved.z+=(z-p.z)*weight
        # A narrow opening retracts at center. During blink the skin folds in
        # front of the compressed eye, which removes the iris from the side.
        depth=abs(p.x-f.eye_center(side).x)/.030
        moved.y+=.0011*max(0,1-opening)*max(0.,1-depth)*weight
        return moved

    def head_keys(self,head,mouth,eyelids):
        base=head.shape_key_add(name='Basis',from_mix=False)
        origins=[v.co.copy() for v in head.data.vertices]
        eyes={i:(side,w,lash) for side,indices in eyelids.items() for i,w,lash in indices}
        members=set(mouth)
        for name,(pose,right,left) in self.states.items():
            eye_settings={-1:right,1:left}
            key=head.shape_key_add(name=name,from_mix=False)
            key.value=0.
            mouth_poses=self.mouth_shape(pose) if pose!=self.neutral else None
            for i,p in enumerate(origins):
                if i in members:
                    continue
                point=self.jaw(p,pose)
                if i in eyes:
                    side,weight,lash=eyes[i]
                    point=self.orbital(point,side,eye_settings[side],weight,lash)
                elif p.y<-.036 and abs(p.z-self.face.eye_z)<.051:
                    side=1 if p.x>self.face.center else -1
                    eye_x=self.face.center+side*self.face.eye_x
                    d=((p.x-eye_x)**2/.044**2+(p.z-self.face.eye_z)**2/.046**2)**.5
                    weight=.66*smooth(1-d)
                    point=self.orbital(point,side,eye_settings[side],weight)
                key.data[i].co=point
            if mouth_poses is not None:
                for i,p in zip(mouth,mouth_poses):
                    key.data[i].co=p
            key.slider_min=0
            key.slider_max=1
        assert base.name=='Basis'
        head.active_shape_key_index=0
        head['Facial controls']='Object Data > Shape Keys | one viseme or expression at a time. A viseme may be paired with blink or wink.'

    def teeth_points(self,pose):
        verts=[]
        for t in np.linspace(-1.,1.,25):
            u=float(t)*.83
            x=self.face.center+pose.half*.001*u
            arch=(1-u*u)**.5
            upper=self.face.mouth_z+.001*(pose.corners*u*u+pose.upper*arch)
            gap=(pose.upper+pose.lower)*arch*.001
            depth=.0020+(.006 if pose.teeth==0 else 0)
            top=upper-.00075 if pose.teeth>0 else upper+.0018
            thickness=max(.00032,gap*pose.teeth)
            for row in (0.,1.):
                p=self.face.front(x,top-row*thickness)
                p.y+=depth-.001*pose.forward*LIP_DEPTH_SCALE
                verts.append(p)
        return verts

    def tongue_points(self,pose):
        verts=[]
        shown=pose.half>=18 and pose.lower>=7.
        for t in np.linspace(-1.,1.,25):
            u=float(t)*.71
            x=self.face.center+pose.half*.001*u
            arch=(1-u*u)**.5
            center=self.face.mouth_z+(pose.corners*u*u-pose.lower*.71*arch)*.001
            span=max(.00045,pose.lower*.001*.33*arch)
            for k in (-.5,.5):
                p=self.face.front(x,center+span*k)
                p.y+=.0047 if shown else .018
                verts.append(p)
        return verts

    def drive(self,obj,head,name):
        key=obj.shape_key_add(name=name,from_mix=False)
        key.value=0.
        drv=key.driver_add('value').driver
        drv.type='AVERAGE'
        var=drv.variables.new()
        var.type='SINGLE_PROP'
        target=var.targets[0]
        target.id_type='KEY'
        target.id=head.data.shape_keys
        target.data_path=f'key_blocks["{name}"].value'
        return key

    def eye_keys(self,obj,head,side):
        obj.shape_key_add(name='Basis',from_mix=False)
        original=[v.co.copy() for v in obj.data.vertices]
        for name,(_,right,left) in self.states.items():
            setting=left if side>0 else right
            if setting==REST_EYE:
                continue
            key=self.drive(obj,head,name)
            for i,p in enumerate(original):
                point=self.orbital(p,side,setting)
                if setting[0]<.1:
                    point.y+=.0038
                key.data[i].co=point

    def brow_keys(self,obj,head,side):
        obj.shape_key_add(name='Basis',from_mix=False)
        original=[v.co.copy() for v in obj.data.vertices]
        for name,(_,right,left) in self.states.items():
            setting=left if side>0 else right
            lift,tilt=setting[2:]
            if not lift and not tilt:
                continue
            key=self.drive(obj,head,name)
            center=self.face.eye_center(side).x
            for i,p in enumerate(original):
                inner=max(-1.,min(1.,-side*(p.x-center)/.024))
                z=p.z+(lift+tilt*inner)*.001
                old=self.face.front(p.x,p.z)
                new=self.face.front(p.x,z)
                key.data[i].co=p+Vector((0,new.y-old.y,z-p.z))

    def mouth_part_keys(self,obj,head,coordinates):
        obj.shape_key_add(name='Basis',from_mix=False)
        for name,(pose,_,_) in self.states.items():
            if pose!=self.neutral:
                key=self.drive(obj,head,name)
                for i,p in enumerate(coordinates(pose)):
                    key.data[i].co=p
