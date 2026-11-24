"""Refit the editable protagonist faces, preserving the existing Humanoid and clips.

Run from the repository root with Blender:
  blender -b --python-exit-code 1 -P tools/acg-character/refit_protagonist_faces.py -- HERO STAGE
"""
from math import asin, cos, exp, pi, sin, sqrt
from pathlib import Path
import argparse
import json
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform, delaunay_2d_cdt
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from refine_protagonist_motion import glb_json
from protagonist_facial_shapes import FacialRig

HEROES = ('amemori_sumiha', 'roen', 'yeh_chengxi')
FORWARD = Vector((0, -1, 0))

# Millimetres in the fitted head, and fractions of chin-to-crown height.
SHAPES = {
    'amemori_sumiha': dict(eye_z=1.402, eye_x=.043, half=23.3, mouth=.158, smile=.25,
                          hair_color='#53394f', nose_tip=.0014, jaw_tip=.0012, jaw_taper=.045, nose_relief=.0018, chin_relief=.0017),
    'roen': dict(eye_z=1.472, eye_x=.039, half=21.1, mouth=.156, smile=-.45,
                 hair_color='#92756c', nose_tip=.0021, jaw_tip=.0018, jaw_taper=.038, nose_relief=.0021, chin_relief=.0020),
    'yeh_chengxi': dict(eye_z=1.436, eye_x=.045, half=24.5, mouth=.183, smile=3.8,
                        hair_color='#493640', nose_tip=.0010, jaw_tip=.0009, jaw_taper=.062, nose_relief=.0015, chin_relief=.0014),
}
# Pixel-coordinate aperture contours in the packed, pre-refit face atlas.
# The first eye is on the left of the front drawing. Each row is
# (x, upper eyelash edge, lower eyelid edge).
EYE_ART = {
    'roen': (
        ((129,150,150),(133,149,155),(138,147,161),(143,146,164),
         (148,147,164),(153,149,162),(157,153,158),(159,154,154)),
        ((178,154,154),(181,151,159),(185,148,162),(190,146,164),
         (195,146,164),(200,148,160),(203,149,156),(205,150,150)),
    ),
    'amemori_sumiha': (
        ((127,145,145),(131,143,149),(136,140,158),(141,139,162),
         (147,139,163),(152,141,161),(156,144,157),(160,151,151)),
        ((181,152,152),(185,146,157),(190,142,161),(195,140,163),
         (200,139,163),(206,140,160),(211,142,151),(217,145,145)),
    ),
    'yeh_chengxi': (
        ((120,136,136),(125,134,140),(131,131,152),(137,130,156),
         (143,132,156),(150,135,152),(154,139,148),(158,145,145)),
        ((180,145,145),(183,141,149),(188,135,153),(194,131,156),
         (199,129,156),(205,130,152),(211,133,143),(215,135,135)),
    ),
}
EYE_MM_PER_PIXEL = {'roen': 1.16, 'amemori_sumiha': 1.18, 'yeh_chengxi': 1.11}

# Hair-only outlines in the original atlas. The contour follows each lock
# across the brow and excludes the illustrated skin, eyes and ornaments.
FRINGE_OUTLINES = {
    'amemori_sumiha': (
        (119,49),(134,42),(155,41),(182,40),(202,42),(219,52),(222,80),
        (224,105),(226,128),(225,155),(223,170),(218,176),(215,164),
        (214,150),(211,141),(205,134),(199,126),(193,113),(189,101),
        (186,122),(186,139),(183,149),(179,150),(168,150),(163,149),
        (159,138),(156,126),(156,105),(153,115),(147,126),(140,134),
        (133,138),(125,145),(122,158),(123,174),(119,178),(115,164),
        (113,142),(114,119),(112,94),(113,72),
    ),
    'roen': (
        (117,52),(130,44),(148,44),(171,43),(190,43),(212,44),(224,54),
        (226,76),(230,92),(230,116),(228,137),(222,151),(212,162),
        (202,169),(205,158),(206,148),(203,138),(198,125),(193,115),
        (190,127),(187,137),(182,148),(176,157),(176,162),(179,167),
        (174,165),(169,160),(163,163),(155,167),(159,157),(161,145),
        (160,129),(156,117),(152,126),(147,133),(139,139),(133,144),
        (130,146),(132,138),(135,130),(140,120),(132,125),(123,129),
        (116,129),(118,123),(113,110),(112,88),(113,67),
    ),
    'yeh_chengxi': (
        (120,49),(140,42),(163,41),(187,41),(211,42),(224,53),(226,75),
        (228,100),(230,124),(228,148),(222,166),(216,178),(206,181),
        (211,175),(215,164),(217,153),(217,140),(212,135),(205,131),
        (197,124),(190,115),(184,103),(182,94),(179,111),(176,125),
        (178,139),(181,149),(180,154),(171,150),(165,144),(160,136),
        (155,122),(150,108),(148,97),(145,110),(141,121),(135,131),
        (128,137),(123,141),(122,154),(125,166),(131,176),(137,179),
        (128,181),(121,176),(115,163),(111,146),(111,121),(113,96),
        (115,70),
    ),
}


def ease(x):
    x=max(0.,min(1.,x))
    return x*x*(3-2*x)


def gauss(a, b):
    return exp(-(a*a+b*b))


def linear(hex_value):
    return tuple(((x/255+.055)/1.055)**2.4 if x/255>.04045 else x/255/12.92
                 for x in bytes.fromhex(hex_value.lstrip('#'))) + (1.,)


def shader_of(material):
    return next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def material(name, color, roughness, emission=.0, specular=.30):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    mat.diffuse_color=color
    bsdf=shader_of(mat)
    bsdf.inputs['Base Color'].default_value=color
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Emission Color'].default_value=color
    bsdf.inputs['Emission Strength'].default_value=emission
    bsdf.inputs['Specular IOR Level'].default_value=specular
    return mat


def recalc(mesh, closed=False):
    bm=bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    assert not any(f.calc_area()<1e-12 for f in bm.faces), mesh.name
    if closed:
        assert all(e.is_manifold and e.is_contiguous for e in bm.edges), mesh.name
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def mesh_data(name, points, faces, mats, indices=None, closed=False):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(points,[],faces)
    for mat in mats:
        mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth=True
        if indices is not None:
            poly.material_index=indices[poly.index]
    recalc(mesh,closed)
    return mesh


def head_object(name, mesh, collection, rig):
    obj=bpy.data.objects.new(name,mesh)
    collection.objects.link(obj)
    obj.parent=rig
    obj.vertex_groups.new(name='Head').add(list(range(len(mesh.vertices))),1.,'REPLACE')
    obj.modifiers.new('Humanoid skin','ARMATURE').object=rig
    return obj


class Face:
    def __init__(self, original, hero):
        self.hero=hero
        self.config=SHAPES[hero]
        rings={}
        for v in original.data.vertices:
            rings.setdefault(round(v.co.z,6),[]).append(v.co)
        self.old_z=np.asarray(sorted(rings))
        self.bottom,self.top=float(self.old_z[0]),float(self.old_z[-1])
        self.height=self.top-self.bottom
        self.center=bpy.data.objects['Humanoid'].data.bones['Head'].head_local.x
        self.radius=np.asarray([max(abs(v.x-self.center) for v in rings[z]) for z in self.old_z])
        self.old_front=np.asarray([min(v.y for v in rings[z]) for z in self.old_z])
        self.back=np.asarray([max(v.y for v in rings[z]) for z in self.old_z])
        self.eye_z=self.config['eye_z']
        img=next(n.image for n in original.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE')
        width,height=img.size
        assert width==336 and height==259, (hero,img.size[:])
        atlas=np.empty(width*height*4,dtype=np.float32)
        img.pixels.foreach_get(atlas)
        self.eyepaint=atlas.reshape(height,width,4)[::-1].copy()
        self.eyecolor_space=img.colorspace_settings.name
        self.eye_mm=EYE_MM_PER_PIXEL[hero]*.001
        self.eye_art={side:np.asarray(rows,dtype=float)
                      for side,rows in zip((-1,1),EYE_ART[hero])}
        self.eye_x=self.config['eye_x']
        self.eye_r=.027
        self.nose_z=self.z(.313)
        self.mouth_z=self.z(self.config['mouth'])
        mesh=original.data
        mesh.calc_loop_triangles()
        uv=mesh.uv_layers.active.data
        self.atlas_uv=[tuple(Vector((*uv[i].uv,0)) for i in tri.loops) for tri in mesh.loop_triangles]
        self.atlas_coords=[tuple(mesh.vertices[i].co.copy() for i in tri.vertices) for tri in mesh.loop_triangles]
        self.atlas_tree=BVHTree.FromPolygons([p for tri in self.atlas_uv for p in tri],
                                           [(i,i+1,i+2) for i in range(0,3*len(self.atlas_uv),3)],
                                           all_triangles=True)

    def atlas_point(self,u,v):
        origin=Vector(((u+.5)/336,1-(v+.5)/259,.1))
        hit,_,index,_=self.atlas_tree.ray_cast(origin,Vector((0,0,-1)))
        assert hit is not None,(u,v)
        return barycentric_transform(hit,*self.atlas_uv[index],*self.atlas_coords[index])

    def z(self,t):
        return self.bottom+t*self.height

    def t(self,z):
        return (z-self.bottom)/self.height

    def width(self,t):
        original=float(np.interp(self.z(t),self.old_z,self.radius))
        # A short jaw plane rounds into the existing neck socket.
        target=float(np.interp(t,[0,.032,.074,.13,.21,.3],[.034,.043,.052,.064,.074,.084]))
        return target+(original-target)*ease((t-.17)/.15)

    def pos(self,a,t):
        w=self.width(t)
        dx=w*sin(a)
        z=self.z(t)
        back=float(np.interp(z,self.old_z,self.back))
        target=float(np.interp(t,[0,.028,.065,.108,.16,.21,.285,.36,.435,.51,.62,.77,1],
                                  [-.038,-.058,-.073,-.076,-.079,-.080,-.080,-.080,-.081,-.088,-.093,-.080,-.019]))
        old=float(np.interp(z,self.old_z,self.old_front))
        front=target+(old-target)*ease((t-.59)/.29)
        facing=max(0.,cos(a))
        # Seat the eyes in the orbit and keep the nose, lips and chin close to
        # the fitted skull. All relief below is in metres.
        dx_abs=abs(dx)
        orbit=gauss((dx_abs-self.eye_x)/.022,(z-self.eye_z)/.019)
        cheek=gauss((dx_abs-.050)/.026,(z-self.z(.285))/.027)
        brow=gauss((dx_abs-.027)/.030,(z-self.eye_z-.021)/.013)
        tip=gauss(dx/.0131,(z-self.nose_z)/.0118)
        bridge=gauss(dx/.0088,(z-self.nose_z-.016)/.026)
        alar=gauss((dx_abs-.011)/.0065,(z-self.nose_z+.005)/.0048)
        nostril=gauss((dx_abs-.0083)/.0031,(z-self.nose_z+.0074)/.0027)
        lips=gauss(dx/.024,(z-self.mouth_z)/.009)
        fold=gauss(dx/.019,(z-self.mouth_z+.011)/.0055)
        y=(front+back)*.5-(back-front)*.5*cos(a)
        y+=facing**2*(.0075*orbit-.0032*cheek-.003*brow-.0108*tip-.007*bridge
                       -.0045*alar+.0038*nostril-.00265*lips+.00172*fold)
        # Lift the side of the lower jaw toward the joint, while the anterior
        # chin stays rounded and the lower rear edge meets the neck.
        z+=.011*ease((.21-t)/.21)*(abs(sin(a))**1.6)-.0035*ease((.19-t)/.19)*facing
        # Keep the prior eye surface independent of the nose and chin refinements.
        below_eye=ease((self.eye_z-.013-z)/.012)
        y+=facing**3*(self.config['nose_tip']*tip*below_eye
                      +self.config['jaw_tip']*gauss(dx/.024,(t-.072)/.061))
        # Adjust only depth. The localized bridge and alar wing terms fall
        # away before the orbit, and both lip outlines stay in the same x/z.
        nose_boundary=ease((self.eye_z-.004-z)/.010)*ease((.026-dx_abs)/.010)
        ridge=.47*bridge+.76*tip+.29*alar-.18*nostril
        chin=gauss(dx/.027,(t-.076)/.034)
        under_chin=gauss(dx/.031,(t-.025)/.021)
        y-=facing**3*(self.config['nose_relief']*ridge*nose_boundary
                      +self.config['chin_relief']*(chin-.24*under_chin))
        dx*=1-(.10+self.config['jaw_taper'])*ease((.30-t)/.27)*facing
        return Vector((self.center+dx,y,z))

    def param(self,x,z):
        t=min(1.,max(0.,self.t(z)))
        # The small chin correction affects the frontal silhouette only.
        a=asin(max(-.998,min(.998,(x-self.center)/self.width(t))))
        taper=1-(.10+self.config['jaw_taper'])*ease((.30-t)/.27)*max(0.,cos(a))
        a=asin(max(-.998,min(.998,(x-self.center)/(self.width(t)*taper))))
        return Vector((a,t))

    def front(self,x,z):
        return self.pos(*self.param(x,z))

    def art_xy(self,side,u):
        contour=self.eye_art[side]
        x=contour[0,0]+np.asarray(u)*(contour[-1,0]-contour[0,0])
        upper=np.interp(x,contour[:,0],contour[:,1])
        lower=np.interp(x,contour[:,0],contour[:,2])
        mid_x=(contour[0,0]+contour[-1,0])/2
        mid=(np.interp(mid_x,contour[:,0],contour[:,1])+np.interp(mid_x,contour[:,0],contour[:,2]))/2
        return x,upper,lower,mid

    def opening(self,side,angle,scale=1.):
        half=self.config['half']*.001
        across=cos(angle)
        _,top,bottom,mid=self.art_xy(side,(across+1)/2)
        edge=top if sin(angle)>=0 else bottom
        x=self.center+side*self.eye_x+scale*half*across
        z=self.eye_z+scale*(mid-edge)*self.eye_mm
        return x,z

    def eye_center(self,side):
        x=self.center+side*self.eye_x
        # The globe sits behind the brow plane and behind the nasal bridge.
        return Vector((x,self.front(x,self.eye_z).y+self.eye_r-.0028,self.eye_z))

    def eyeball(self,side,x,z):
        c=self.eye_center(side)
        dx=x-c.x
        sphere=sqrt(max(.000004,self.eye_r**2-dx*dx-(z-c.z)**2))
        # The exposed dome flattens at the limbus. Its temporal side recedes
        # with the socket and its anterior apex still aims straight ahead.
        y=c.y-self.eye_r+.28*(self.eye_r-sphere)+.19*side*dx
        return Vector((x,y,z))


def make_head(face, facial, materials):
    # A continuous surface forms the head and lids. Constrained aperture edges
    # keep the opening exact and avoid splitting the head into coplanar decals.
    angular=112
    height_steps=58
    scale=.38
    def param(x,z):
        a,t=face.param(x,z)
        return Vector((a*scale,t))
    points=[]
    for row in range(height_steps+1):
        t=row/height_steps
        for col in range(angular+1):
            a=2*pi*col/angular-pi
            # Preserve similar tessellation in the orbit. The CDT will add its lid contour.
            if abs(a)<1.32 and abs(face.z(t)-face.eye_z)<.024:
                if any(((face.pos(a,t).x-face.center-side*face.eye_x)/.035)**2+
                       ((face.z(t)-face.eye_z)/.023)**2<1.12 for side in (-1,1)):
                    continue
            points.append(Vector((a*scale,t)))
    loops={}
    segments=48
    for side in (-1,1):
        outline=[]
        for step in range(segments):
            angle=step*2*pi/segments
            xy=face.opening(side,angle,1.37)
            outline.append(len(points))
            points.append(param(*xy))
        loops[side]=outline
    mouth_loop=[]
    for angle in facial.angles():
        x=face.center+.046*cos(angle)
        z=face.mouth_z+.030*sin(angle)
        mouth_loop.append(len(points))
        points.append(param(x,z))
    apertures=[]
    for outline in (*loops.values(),mouth_loop):
        signed=sum(points[a].cross(points[b]) for a,b in zip(outline,outline[1:]+outline[:1]))
        apertures.append(outline if signed>0 else outline[::-1])
    pts, _, tris, orig_verts, _, orig_faces=delaunay_2d_cdt(points,[],apertures,0,1e-7,True)
    boundaries={idx:i for i,orig in enumerate(orig_verts) for idx in orig}
    ids=[0]*len(pts)
    verts=[]
    seam={}
    for i,uv in enumerate(pts):
        a,t=uv.x/scale,uv.y
        if abs(abs(a)-pi)<1e-5:
            key=round(t,7)
            if key in seam:
                ids[i]=seam[key]
                continue
            seam[key]=len(verts)
            a=-pi
        ids[i]=len(verts)
        verts.append(face.pos(a,t))
    lid_loops={side:[ids[boundaries[i]] for i in outline] for side,outline in loops.items()}
    eyelids={side:[] for side in loops}
    mouth_boundary=[ids[boundaries[i]] for i in mouth_loop]
    polygons=[]
    indices=[]
    for tri,source in zip(tris,orig_faces):
        if not source:
            polygons.append(tuple(ids[i] for i in tri))
            indices.append(0)
    for t in (0,1):
        cap=sorted((u.x,ids[i]) for i,u in enumerate(pts) if abs(u.y-t)<1e-7 and u.x<pi*scale-1e-6)
        polygons.append(tuple(index for _,index in cap))
        indices.append(0)
    for side,outer in lid_loops.items():
        last=outer
        eyelids[side].extend((i,.31,0.) for i in outer)
        for state, size in enumerate((1.19,1.048,1.005,.976)):
            ring=[]
            for step in range(segments):
                angle=step*2*pi/segments
                x,z=face.opening(side,angle,size)
                shell=face.front(x,z)
                eye=face.eyeball(side,x,z)
                if state==0:
                    shell.y=.38*shell.y+.62*(eye.y-.0012)
                else:
                    shell.y=eye.y+(-.0012,-.00105,.00034)[state-1]
                ring.append(len(verts))
                verts.append(shell)
            for i in range(segments):
                j=(i+1)%segments
                polygons.append((last[i],last[j],ring[j],ring[i]))
                indices.append(1 if state==2 and i<segments//2 else 0)
            weight=(.57,.97,1.,1.)[state]
            eyelids[side].extend((i,weight,.00115 if state==1 and j<segments//2 else 0.)
                                  for j,i in enumerate(ring))
            last=ring
        # Close inside the globe where it is invisible and preserve a watertight skin mesh.
        midpoint=face.eye_center(side)
        midpoint.y+=.004
        k=len(verts)
        verts.append(midpoint)
        eyelids[side].append((k,1.,0.))
        for i in range(segments):
            polygons.append((last[i],last[(i+1)%segments],k))
            indices.append(0)
    mouth=facial.append_mouth(verts,polygons,indices,mouth_boundary)
    used=sorted({i for poly in polygons for i in poly})
    ids={i:j for j,i in enumerate(used)}
    compact=[verts[i] for i in used]
    polygons=[tuple(ids[i] for i in poly) for poly in polygons]
    mesh=mesh_data('Head anatomy',compact,polygons,materials,indices,closed=True)
    assert all((v.co-p).length<1e-6 for v,p in zip(mesh.vertices,compact))
    return mesh,[ids[i] for i in mouth],{side:[(ids[i],w,l) for i,w,l in ring] for side,ring in eyelids.items()}


def eye_globe(face,side,material_):
    # Sample the globe only inside its eyelid aperture. Close the shell behind
    # the socket, where the rest of the globe cannot peek through the cheek.
    c=face.eye_center(side)
    segments,rings=64,16
    apex=face.eyeball(side,c.x,c.z)
    verts=[apex]
    faces=[]
    uv=[(.5,.5)]
    for ring in range(1,rings+1):
        for k in range(segments):
            x,z=face.opening(side,2*pi*k/segments,.976*ring/rings)
            verts.append(face.eyeball(side,x,z))
            uv.append((.5+(x-c.x)/.043,.5+(z-c.z)/.043))
    # A second ring overlaps the wet rim by less than a millimetre, behind
    # the external eyelid. All other surfaces are behind the face.
    outer=len(verts)
    for k in range(segments):
        x,z=face.opening(side,2*pi*k/segments,1.015)
        p=face.eyeball(side,x,z)
        p.y+=.0017
        verts.append(p)
        uv.append((.5+(x-c.x)/.043,.5+(z-c.z)/.043))
    rear=len(verts)
    verts.append(c-FORWARD*face.eye_r*.44)
    uv.append((.5,.5))
    for j in range(segments):
        k=(j+1)%segments
        faces.append((0,1+j,1+k))
        for ring in range(rings):
            row=1+ring*segments
            faces.append((row+j,row+k,row+k+segments,row+j+segments))
        faces.append((rear,outer+k,outer+j))
    mesh=mesh_data('Orbital surface',verts,faces,[material_],closed=True)
    layer=mesh.uv_layers.new(name='Eye pigment')
    for loop in mesh.loops:
        layer.data[loop.index].uv=uv[loop.vertex_index]
    return mesh


def eye_material(face,side):
    # Preserve the original eye pigment and linework inside the new eyelids.
    # Sampling is clamped to the eye contour, so surrounding skin and painted
    # facial shadows cannot enter this texture.
    width=256
    axis=(np.arange(width)+.5)/width-.5
    dx,dz=np.meshgrid(axis*.043,axis*.043)
    u=np.clip(dx/(2*face.config['half']*.001)+.5,0,1)
    x,upper,lower,mid=face.art_xy(side,u)
    y=np.clip(mid-dz/face.eye_mm,upper,lower)
    x0=x.astype(int)
    y0=y.astype(int)
    x1=x0+1
    y1=y0+1
    xs=(x-x0)[...,None]
    ys=(y-y0)[...,None]
    art=face.eyepaint
    pixels=(art[y0,x0]*(1-xs)+art[y0,x1]*xs)*(1-ys)+(art[y1,x0]*(1-xs)+art[y1,x1]*xs)*ys
    tag='R' if side<0 else 'L'
    img=bpy.data.images.new('Original eye artwork '+tag,width=width,height=width,alpha=False)
    img.colorspace_settings.name=face.eyecolor_space
    img.pixels.foreach_set(pixels.astype(np.float32).ravel())
    img.pack()
    mat=material('Eye pigment '+tag,(.84,.79,.74,1),.28,.26,.29)
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=img
    bsdf=shader_of(mat)
    mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Emission Color'])
    return mat


def ribbon(name, pts, widths, mat, coll, rig, lift=0.):
    verts=[]
    faces=[]
    for i,(p,w) in enumerate(zip(pts,widths)):
        axis=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        across=axis.cross(FORWARD).normalized()
        p=p+FORWARD*lift
        verts.extend((p+across*w/2,p-across*w/2))
        if i:
            j=2*i
            faces.append((j-2,j-1,j+1,j))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.materials.append(mat)
    for poly in mesh.polygons:
        if poly.normal.y>0:
            poly.flip()
    return head_object(name,mesh,coll,rig)


def details(face,facial,head,rig,body,brow_color):
    brow=material('Brow hair',linear(brow_color),.83,.045,.17)
    reference_brows={
        'roen': (((132,133),(141,135),(149,138),(159,143)),
                 ((180,143),(187,138),(193,136),(201,135))),
        'amemori_sumiha': (((137,124),(144,127),(151,130),(159,135)),
                          ((183,135),(190,131),(199,128),(208,125))),
        'yeh_chengxi': (((131,122),(138,125),(145,129),(151,135)),
                        ((176,137),(183,130),(191,125),(201,120))),
    }
    result=[]
    for sign,side,landmarks in zip((-1,1),('R','L'),reference_brows[face.hero]):
        curve=np.asarray(landmarks)
        x=np.linspace(curve[0,0],curve[-1,0],20)
        points=[face.atlas_point(u,v) for u,v in zip(x,np.interp(x,curve[:,0],curve[:,1]))]
        points=[face.front(p.x,p.z) for p in points]
        width=.0033 if face.hero=='yeh_chengxi' else .00255
        obj=ribbon('Brow '+side,points,[.00045+width*sin(pi*t)**.78 for t in np.linspace(0,1,len(points))],
                   brow,body,rig,.00055)
        facial.brow_keys(obj,head,sign)
        result.append(obj)
    enamel=material('Teeth enamel',linear('#fff2e0'),.39,.38,.28)
    points=facial.teeth_points(facial.neutral)
    polys=[(i,i+2,i+3,i+1) for i in range(0,len(points)-2,2)]
    tooth_mesh=mesh_data('Upper teeth',points,polys,[enamel])
    for p in tooth_mesh.polygons:
        if p.normal.y>0:
            p.flip()
    teeth=head_object('Upper teeth',tooth_mesh,body,rig)
    facial.mouth_part_keys(teeth,head,facial.teeth_points)
    tongue_mat=material('Tongue pigment',linear('#bc737b'),.61,.12,.21)
    tongue_mesh=mesh_data('Tongue',facial.tongue_points(facial.neutral),polys,[tongue_mat])
    for p in tongue_mesh.polygons:
        if p.normal.y>0:
            p.flip()
    tongue=head_object('Tongue',tongue_mesh,body,rig)
    facial.mouth_part_keys(tongue,head,facial.tongue_points)
    return result+[teeth,tongue]


def inside_polygon(x,y,outline):
    inside=np.zeros(np.broadcast_shapes(np.shape(x),np.shape(y)),dtype=bool)
    previous=outline[-1]
    for current in outline:
        ax,ay=previous
        bx,by=current
        if ay!=by:
            inside^=((ay>y)!=(by>y))&(x<(bx-ax)*(y-ay)/(by-ay)+ax)
        previous=current
    return inside


def make_fringe(face,rig):
    outline=FRINGE_OUTLINES[face.hero]
    points=[Vector(p) for p in outline]
    x0=min(x for x,_ in outline)
    x1=max(x for x,_ in outline)
    y0=min(y for _,y in outline)
    y1=max(y for _,y in outline)
    for y in range(y0+2,y1,3):
        for x in range(x0+2,x1,3):
            if inside_polygon(x,y,outline):
                points.append(Vector((x,y)))
    boundary=list(range(len(outline)))
    if sum(points[a].cross(points[b]) for a,b in zip(boundary,boundary[1:]+boundary[:1]))<0:
        boundary.reverse()
    coords,_,triangles,_,_,_=delaunay_2d_cdt(points,[],[boundary],1,1e-5,True)
    used=sorted({i for tri in triangles for i in tri})
    index={i:j for j,i in enumerate(used)}
    triangles=[tuple(index[i] for i in tri) for tri in triangles]
    coords=[coords[i] for i in used]
    verts=[]
    for u,v in coords:
        upper=46 if face.hero=='amemori_sumiha' else 42
        mapped_v=upper+(v-39)*(62-upper)/(62-39) if v<62 else v
        old=face.atlas_point(u,mapped_v)
        p=face.front(old.x,old.z)
        t=face.t(old.z)
        bulge=.002+.0055*ease((.91-t)/.22)
        ridges=.0015*cos((u-168)*.34+.026*v)
        side=abs(old.x-face.center)
        clearance=.011*gauss((old.z-face.eye_z)/.024,0)*ease((side-.056)/.025)
        p.y-=bulge+ridges-clearance
        verts.append(p)
    outer=len(verts)
    edges={}
    for tri in triangles:
        for a,b in zip(tri,tri[1:]+tri[:1]):
            key=tuple(sorted((a,b)))
            edges[key]=edges.get(key,0)+1
    perimeter=[(a,b) for (a,b),count in edges.items() if count==1]
    rim_vertices={i for edge in perimeter for i in edge}
    verts.extend(p-FORWARD*(.0035 if i in rim_vertices else .009) for i,p in enumerate(verts[:]))
    polygons=list(triangles)+[tuple(i+outer for i in reversed(t)) for t in triangles]
    polygons.extend((a,b,b+outer,a+outer) for a,b in perimeter)

    # The packed texture carries the fringe only. Extend edge pigment into a
    # small padding band to avoid sampling the old face through texture filtering.
    offset_x,offset_y=x0-4,y0-4
    w,h=x1-x0+9,y1-y0+9
    yy,xx=np.mgrid[offset_y:offset_y+h,offset_x:offset_x+w]
    valid=inside_polygon(xx+.15,yy+.15,outline)
    if face.hero=='yeh_chengxi':
        original=valid.copy()
        for axis,shift in ((0,-1),(0,1),(1,-1),(1,1)):
            valid&=np.roll(original,shift,axis=axis)
    pixels=face.eyepaint[yy,xx].copy()
    r,g,b=pixels[:,:,:3].transpose(2,0,1)
    if face.hero=='roen':
        # Keep the pale blond ink, which is more yellow and less pink than the skin.
        skin=(r>.80)&(g>.61)&(g<r*.828)&(r-b>.18)
    else:
        skin=(r>.62)&(g>.42)&(r-b>.11)
    valid&=~skin
    base=np.median(pixels[valid],axis=0)
    current=np.where(valid[:,:,None],pixels,base)
    for _ in range(10):
        colours=np.zeros_like(current)
        weight=np.zeros_like(valid,dtype=np.float32)
        for axis,step in ((0,-1),(0,1),(1,-1),(1,1)):
            neighbour=np.roll(valid,step,axis=axis)
            colours+=np.roll(current,step,axis=axis)*neighbour[:,:,None]
            weight+=neighbour
        edge=(weight>0)&~valid
        current[edge]=colours[edge]/weight[edge,None]
        valid|=edge
    im=bpy.data.images.new('Reference fringe pigment',width=w,height=h,alpha=False)
    im.colorspace_settings.name=face.eyecolor_space
    im.pixels.foreach_set(current[::-1].astype(np.float32).ravel())
    im.pack()
    mat=material('Reference fringe',linear(face.config['hair_color']),.72,.62,.18)
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=im
    bsdf=shader_of(mat)
    mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Emission Color'])
    lining=material('Fringe cut edge',linear(face.config['hair_color']),.72,.52,.18)
    slots=[0]*len(triangles)+[1]*(len(polygons)-len(triangles))
    mesh=mesh_data('Forehead hair',verts,polygons,[mat,lining],slots,closed=True)
    uv=mesh.uv_layers.new(name='Fringe pigment')
    for loop in mesh.loops:
        x,y=coords[loop.vertex_index%outer]
        uv.data[loop.index].uv=((x-offset_x+.5)/w,1-(y-offset_y+.5)/h)
    return head_object('HairLockFringe',mesh,bpy.data.collections['Hair'],rig)


def face_pigment(head,face):
    mat=head.data.materials[0]
    base=np.asarray(shader_of(mat).inputs['Base Color'].default_value)
    colors=np.empty((len(head.data.vertices),4),dtype=np.float32)
    for v in head.data.vertices:
        x,y,z=v.co
        warmth=ease((-y-.018)/.044)*ease((face.t(z)-.04)/.26)
        cheek=gauss((abs(x-face.center)-.056)/.024,(z-face.z(.29))/.019)*warmth
        colors[v.index]=np.clip(base+warmth*np.array([.045,.059,.064,0])
                                +cheek*np.array([.013,-.025,-.019,0]),0,1)
    attribute=head.data.color_attributes.new(name='Facial pigment',type='FLOAT_COLOR',domain='POINT')
    attribute.data.foreach_set('color',colors.ravel())
    node=mat.node_tree.nodes.new('ShaderNodeVertexColor')
    node.layer_name=attribute.name
    bsdf=shader_of(mat)
    mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
    mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Emission Color'])


def remove_face_transfer_from_hair():
    """Replace the projected face and neck pixels inside the scalp atlas."""
    hair=bpy.data.objects['Hair']
    image=next(n.image for n in hair.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE')
    w,h=image.size
    old=np.empty(w*h*4,dtype=np.float32)
    image.pixels.foreach_get(old)
    pixels=old.reshape(h,w,4)
    u=(np.arange(w)+.5)/w
    v=(np.arange(h)+.5)/h
    cap=min((p for p in hair.data.polygons if p.loop_total>4), key=lambda p:p.center.z)
    cap_edge=max(hair.data.uv_layers.active.data[i].uv.y for i in cap.loop_indices)
    # The lower planar UV island sits just above V=0, beneath the long hair strip.
    island=np.clip((cap_edge+.042-v)/.024,0,1)[:,None]
    # Keep the authored crown strands above the face-transfer region.
    front=np.clip((.241-abs(u-.5))/.080,0,1)[None,:]*np.clip((.615-v)/.13,0,1)[:,None]
    mask=np.maximum(island,front)
    mask=mask*mask*(3-2*mask)
    sample=pixels[np.ix_((v>.26)&(v<.68),((u>.225)&(u<.295))|((u>.705)&(u<.775)))][:,:,:3]
    pigment=np.median(sample.reshape(-1,3),axis=0)
    grain=1+.018*np.cos(2*pi*(u*13-v[:,None]*.23))
    pixels[:,:,:3]*=(1-mask[:,:,None])
    pixels[:,:,:3]+=mask[:,:,None]*grain[:,:,None]*pigment
    updated=bpy.data.images.new('Scalp pigment without face transfer',width=w,height=h,alpha=False)
    updated.colorspace_settings.name=image.colorspace_settings.name
    updated.pixels.foreach_set(pixels.ravel())
    updated.pack()
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        for node in m.node_tree.nodes:
            if node.type=='TEX_IMAGE' and node.image==image:
                node.image=updated


def configure_skin():
    body=bpy.data.objects['Body surface']
    shades=list(body.data.materials)
    # Retain the body's base pigment and subtle existing undertone variation.
    # A constant fill is shared across skin materials. AO and cast shadows are
    # produced by scene lights and geometry, not multiplied into the albedo.
    albedo=tuple(body.data.color_attributes['Skin tone'].data[0].color)
    head=material('Skin - Head neutral',albedo,.61,.47,.23)
    for m in shades:
        bsdf=shader_of(m)
        base=bsdf.inputs['Base Color']
        assert base.is_linked and base.links[0].from_node.type=='VERTEX_COLOR', m.name
        bsdf.inputs['Emission Strength'].default_value=.47
    ear_skin=material('Skin - Ear',albedo,.64,.47,.23)
    warm=material('Skin - Ear cartilage',(albedo[0],albedo[1]*.947,albedo[2]*.941,1),.65,.47,.23)
    for obj in bpy.data.collections['Body'].objects:
        if 'Ear' not in obj.name:
            continue
        obj.data.materials.clear()
        obj.data.materials.append(warm if obj.name.endswith('Concha') else ear_skin)
    return head


def export(asset,stage,additions):
    source=asset/(asset.name+'_03b_blender.glb')
    previous=glb_json(source)
    old_mouth={'Lip upper','Lip lower','Mouth seam','Mouth and teeth','Lower lip'}
    names={n['name'] for n in previous['nodes']}-old_mouth
    names|={o.name for o in additions}
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.name in names and not obj.hide_viewport:
            obj.select_set(True)
    op=bpy.ops.export_scene.gltf(filepath=str(stage/source.name),use_selection=True,
         export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,
         export_morph=True,export_morph_animation=False,export_extras=True)
    assert op=={'FINISHED'}
    current=glb_json(stage/source.name)
    assert {n['name'] for n in current['nodes']}==names
    assert {n['name'] for n in current['animations']}=={n['name'] for n in previous['animations']}
    assert len(current['skins'])==len(previous['skins'])
    assert not any(c['target']['path']=='weights' for a in current['animations'] for c in a['channels'])
    head_mesh=next(current['meshes'][n['mesh']] for n in current['nodes']
                   if n['name']=='Head' and 'mesh' in n)
    assert len(head_mesh['extras']['targetNames'])==13 and not any(head_mesh.get('weights',[]))
    return current


def refine(hero,stage,do_export=True,input_file=None):
    asset=Path.cwd()/'Drive/characters'/('chr_protagonist_'+hero)
    source=asset/'03b_blender'/(asset.name+'_03b_blender.blend')
    stage.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(input_file or source))
    rig=bpy.data.objects['Humanoid']
    head=bpy.data.objects['Head']
    body=bpy.data.collections['Body']
    assert len(head.vertex_groups)==1 and head.vertex_groups[0].name=='Head'
    scene=bpy.context.scene
    outfit=bpy.data.objects['Wardrobe']
    saved_action=rig.animation_data.action
    saved_frame=scene.frame_current
    assert outfit['outfit']==1
    oldmesh=head.data
    face=Face(head,hero)
    before_front=float(min(face.old_front))
    old_name=oldmesh.name
    skin=configure_skin()
    assets={
        'amemori_sumiha':('#be877f','#4a354c','#553542'),
        'roen':('#b6887f','#655052','#4f3a3c'),
        'yeh_chengxi':('#bf8271','#483739','#54363c'),
    }
    lip,brow,lid=assets[hero]
    rim=material('Upper eyelid rim',linear(lid),.72,.06,.22)
    lips=material('Lip pigment',linear(lip),.60,.16,.20)
    mouth_interior=material('Mouth interior',linear('#442930'),.72,.055,.16)
    facial=FacialRig(face)
    mesh,mouth,eyelids=make_head(face,facial,[skin,rim,lips,mouth_interior])
    head.data=mesh
    # Assign new vertex indices to the same original head bone.
    head.vertex_groups.new(name='Head').add(list(range(len(head.data.vertices))),1.,'REPLACE')
    bpy.data.meshes.remove(oldmesh)
    head.data.name=old_name
    face_pigment(head,face)
    facial.head_keys(head,mouth,eyelids)
    eyes=[]
    for sign,side in ((-1,'R'),(1,'L')):
        eye=head_object('Eye globe '+side,eye_globe(face,sign,eye_material(face,sign)),body,rig)
        facial.eye_keys(eye,head,sign)
        eyes.append(eye)
    pieces=details(face,facial,head,rig,body,brow)
    fringe=make_fringe(face,rig)
    remove_face_transfer_from_hair()
    new_objects=pieces+eyes+[fringe]
    measurements={
        'source':str(input_file or source),
        'eye_distance_m':face.eye_x*2,
        'eye_dome_reference_diameter_m':face.eye_r*2,
        'eye_apex_y_m':[face.eye_center(side).y-face.eye_r for side in (-1,1)],
        'nose_tip_y_m':face.front(face.center,face.nose_z).y,
        'lip_mid_y_m':face.front(face.center,face.mouth_z).y,
        'mouth_corner_y_m':face.front(face.center+facial.neutral.half*.001,face.mouth_z).y,
        'chin_y_m':face.front(face.center,face.z(.075)).y,
        'head_front_y_old_m':before_front,
        'head_front_y_new_m':min(v.co.y for v in head.data.vertices),
    }
    assert min(measurements['eye_apex_y_m'])>measurements['nose_tip_y_m']
    assert measurements['head_front_y_new_m']>before_front-.001
    rig.animation_data.action=saved_action
    scene.frame_set(saved_frame)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(stage/source.name),compress=True,relative_remap=False)
    (stage/'geometry.json').write_text(json.dumps(measurements,indent=2),encoding='utf8')
    if do_export:
        export(asset,stage,new_objects)


if __name__=='__main__':
    cli=argparse.ArgumentParser()
    cli.add_argument('hero',choices=HEROES)
    cli.add_argument('stage',type=Path)
    cli.add_argument('--blend-only',action='store_true')
    cli.add_argument('--input',type=Path,help='Pre-refit Blender file containing the original eye artwork')
    args=cli.parse_args(sys.argv[sys.argv.index('--')+1:])
    refine(args.hero,args.stage.resolve(),not args.blend_only,args.input.resolve() if args.input else None)

