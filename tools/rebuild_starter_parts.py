from pathlib import Path
import sys,json,struct
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
sys.path.insert(0,str(Path(__file__).resolve().parent))
from refine_starter_appearance import attribute,add_array,ROOT,STAGES
SRC=ROOT/'Art/_incoming/starters_anatomy'
OUT=ROOT/'Art/_incoming/starters_rebuilt'
def read(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0]
 return json.loads(raw[20:20+n]),bytearray(raw[28+n:])
def components(d,b):
 names=[d['nodes'][n]['name'] for n in d['skins'][0]['joints']]
 for p in d['meshes'][0]['primitives']:
  pos,j,w=[attribute(d,b,p,k).copy() for k in ('POSITION','JOINTS_0','WEIGHTS_0')]
  a=d['accessors'][p['indices']];v=d['bufferViews'][a['bufferView']]
  tri=np.frombuffer(b,{5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']],a['count'],v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,3).copy()
  _,weld=np.unique(pos.round(6),axis=0,return_inverse=True);t=weld[tri]
  graph=coo_matrix((np.ones(t.size),(t.ravel(),np.roll(t,1,axis=1).ravel())),shape=(weld.max()+1,)*2)
  _,labels=connected_components(graph,directed=False);labels=labels[weld];leaders=j[np.arange(len(pos)),w.argmax(1)]
  yield p,pos,tri,labels,[names[i] for i in leaders]

from collections import defaultdict
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation

def unit(v):
 return v/max(np.linalg.norm(v),1e-10)

class Surface:
 def __init__(self):
  self.vertices=[];self.faces=[]
 def loft(self,centers,width,depth,across,twist=None):
  centers=np.asarray(centers);offset=len(self.vertices);sides=14
  for i,(c,tangent) in enumerate(zip(centers,np.gradient(centers,axis=0))):
   axis=unit(tangent);x=unit(across-axis*np.dot(axis,across));y=np.cross(axis,x)
   phase=0 if twist is None else twist[i]
   for k in range(sides):
    a=2*np.pi*k/sides
    vx=width[i]*np.cos(a);vy=depth[i]*np.sin(a)
    self.vertices.append(c+x*(vx*np.cos(phase)-vy*np.sin(phase))+y*(vx*np.sin(phase)+vy*np.cos(phase)))
    if i:
     j=offset+i*sides+k;n=offset+i*sides+(k+1)%sides
     self.faces.extend(((j-sides,n-sides,n),(j-sides,n,j)))
  end=offset+(len(centers)-1)*sides
  for k in range(1,sides-1):
   self.faces.extend(((offset,offset+k+1,offset+k),(end,end+k,end+k+1)))

def rebuild(path):
 d,b=read(path);family=path.parent.name;stage=path.stem.split('_')[-1];age=STAGES.index(stage)
 names=[d['nodes'][i]['name'] for i in d['skins'][0]['joints']]
 materials={int(m['name'][:2]):i for i,m in enumerate(d['materials'])}
 parts=list(components(d,b));retained=[];old=defaultdict(list);batch=defaultdict(list);counts=defaultdict(int)
 nodes=d['nodes'];parent={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
 def transform(i):
  n=nodes[i];m=np.eye(4);m[:3,3]=n.get('translation',[0]*3);m[:3,:3]=Rotation.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()*n.get('scale',[1]*3)
  return transform(parent[i])@m if i in parent else m
 anchor={name:transform(i)[:3,3] for name,i in zip(names,d['skins'][0]['joints'])}
 # Source socket and skin determine origin, scale and joint assignment.
 def emit(slot,surf,donor):
  v=np.array(surf.vertices);tri=np.array(surf.faces);dv,dj,dw=donor
  _,nearest=cKDTree(dv).query(v)
  batch[slot].append((v,tri,dj[nearest],dw[nearest]))
 def tube(slot,c,w,h,across,donor,twist=None):
  surf=Surface();surf.loft(c,w,h,np.array(across,dtype=float),twist);emit(slot,surf,donor)
 u=np.linspace(0,1,21);U=u[:,None];bulge=np.sin(np.pi*u)**.7
 for pr,pos,tri,labels,ns in parts:
  slot=int(d['materials'][pr['material']]['name'][:2]);j=attribute(d,b,pr,'JOINTS_0').copy();w=attribute(d,b,pr,'WEIGHTS_0').copy();cut=[]
  for k in np.unique(labels):
   ix=np.flatnonzero(labels==k);v=pos[ix];center=v.mean(0);n=ns[ix[0]];donor=(v,j[ix],w[ix]);kind=None
   if family=='sun' and n=='Crown' and slot in (2,7) and len(ix)!=48:kind='crown'
   elif n=='Head' and ((slot==(7 if family=='moon' else 6) and len(ix)>250) or (slot==3 and 275<len(ix)<400) or (d['materials'][pr['material']]['name']=='11_eye_shine')):kind='eye'
   elif family in ('moon','star') and all(ns[q].startswith('Tail_') for q in ix) and slot!=12:kind='tail'
   elif family=='star' and n in ('Head','Neck_1','Neck_2') and slot in (4,5,9) and len(ix) in (44,90,142):kind='mane'
   elif family=='star' and n=='Head' and slot==2 and abs(center[0])<.001 and len(ix)>30:kind='horn'
   elif family=='sun' and slot==2 and n in ('Head','Jaw') and abs(center[0])<.001 and len(ix) in (72,92):kind='bill'
   elif family in ('sun','star') and n.startswith(('Wing_','Feather_')) and len(ix)==44:kind='wing'
   elif family=='moon' and n.endswith('_Foot') and slot in (1,15) and len(ix)==50:kind='toe'
   elif family=='moon' and n in ('Thorax','Lumbar','Pelvis') and slot in (7,12) and len(ix)==38:kind='frost'
   elif family=='moon' and n in ('Head','Jaw') and abs(center[0])<.001 and ((slot==1 and len(ix) in (430,446)) or (slot==3 and len(ix)>400)):kind='muzzle'
   if kind is None:continue
   cut.append(k);counts[kind]+=1;old[kind].append((slot,n,donor))
  if cut:
   kept=tri[~np.isin(labels[tri[:,0]],cut)]
   if len(kept)==0:continue
   verts,local=np.unique(kept.ravel(),return_inverse=True)
   for key,idx in list(pr['attributes'].items()):
    a=d['accessors'][idx];data=attribute(d,b,pr,key)[verts].copy()
    pr['attributes'][key]=add_array(d,b,data,data.dtype,a['type'],a['componentType'],key=='POSITION')
   pr['indices']=add_array(d,b,local,'<u4','SCALAR',5125)
  retained.append(pr)
 # Move the two mandibles forward out of the juvenile facial mass; retain independent jaw articulation.
 for sign in (-1,1):
  components_eye=[e for e in old['eye'] if np.mean(e[2][0][:,0])*sign>0]
  iris=next(e for e in components_eye if e[0]==(7 if family=='moon' else 6))
  pupil=next(e for e in components_eye if e[0]==3)
  donor=iris[2];v=donor[0];c=v.mean(0);forward=unit(pupil[2][0].mean(0)-c)
  forward=unit(np.array([forward[0],0,forward[2]]))
  horizontal=unit(np.cross([0,1.,0],forward));up=np.array([0,1.,0])
  height=np.ptp(v[:,1])*.57;width=max(np.ptp(v@horizontal)*.60,height*.66)
  # Convex elliptical iris with a continuous dark rim, pupil and two glints.
  def lens(slot,center,rx,ry):
   surf=Surface();verts=surf.vertices;faces=surf.faces
   for j in range(8):
    r=max(.001,j/7)
    for k in range(36):
     a=k*2*np.pi/36;xx=np.cos(a)*r;yy=np.sin(a)*r
     verts.append(center+horizontal*xx*rx+up*(yy*ry+sign*.10*xx*rx)+forward*rx*.22*(1-r*r))
     if j:
      h=j*36+k;m=j*36+(k+1)%36;faces.extend(((h-36,h,m),(h-36,m,m-36)))
   emit(slot,surf,donor)
  c+=forward*.23*width
  lens(3,c,width*1.12,height*1.08)
  lens(iris[0],c+forward*.09*width,width,height)
  lens(3,c+forward*.29*width,width*(.47 if family=='star' else .53),height*.67)
  lens(11,c+up*.33*height-horizontal*.20*width+forward*.45*width,width*.23,height*.19)
  lens(11,c-up*.32*height+horizontal*.18*width+forward*.44*width,width*.10,height*.08)
 if old['crown']:
  donor=tuple(np.concatenate([part[2][k] for part in old['crown']]) for k in range(3))
  jewel=next(q[2][0] for q in old['crown'] if q[0]==7);c=jewel.mean(0);r=np.ptp(jewel[:,0])*.65
  ang=np.deg2rad(55+256*u)
  arc=c+np.column_stack((np.cos(ang)*r,np.sin(ang)*r,np.zeros(len(u))))
  thick=r*(.012+.22*bulge)
  tube(2,arc,thick*.57,thick,[0,0,1],donor)
  for a in np.deg2rad([96,138,182,225,269]):
   out=np.array([np.cos(a),np.sin(a),0])
   ray=c+(r*(.98+.54*U))*out
   tube(2,ray,r*(.124*(1-u)+.002),r*(.065*(1-u)+.002),[-np.sin(a),np.cos(a),0],donor)
 for slot,n,donor in old['bill']:
  v=donor[0];lo=v.min(0);hi=v.max(0);span=hi-lo;mid=(lo+hi)/2
  start=np.array([0,mid[1],lo[2]+(.40 if age==0 else .03)*span[2]])
  L=span[2]*(1.66 if age==0 else 1.03)
  c=start+U*[0,0,L];c[:,1]+=(.04*np.sin(np.pi*u)-.08*u)*span[2]
  width=(.53-.52*u**1.12)*span[0];height=(.48-.47*u)*span[1]
  tube(slot,c,width,height,[1,0,0],donor)
 for slot,n,donor in old['wing']:
  v=donor[0];center=v.mean(0);_,_,basis=np.linalg.svd(v-center,full_matrices=False)
  axis=basis[0];proj=(v-center)@axis;ends=[center+axis*proj.min(),center+axis*proj.max()]
  root,tip=sorted(ends,key=lambda e:np.linalg.norm(e-anchor[n]))
  length=np.linalg.norm(tip-root);width=np.ptp((v-center)@basis[1])*.59
  across=basis[1]*(1 if basis[1][0]*(root[0] or 1)>0 else -1)
  c=root+(tip-root)*U+across*length*.073*np.sin(np.pi*U)
  c[:,1]+=.043*length*np.sin(np.pi*u)
  tube(slot,c,width*(.07+.93*bulge)*(1-.32*u),width*(.022+.12*bulge),across,donor)
 for slot,n,donor in old['horn']:
  v=donor[0];base=v[v[:,1]<np.quantile(v[:,1],.22)].mean(0);tip=v[v[:,1]>np.quantile(v[:,1],.96)].mean(0)
  c=base+(tip-base)*U;c[:,2]-=.15*(tip[1]-base[1])*np.sin(np.pi*u)
  radius=.52*np.ptp(v[:,0])*(1-u+.008)**.78
  tube(slot,c,radius,radius*.77,[1,0,0],donor,2.5*u)
  # A raised spiral follows the horn surface, narrowing into the same tip.
  a=4*np.pi*u;c[:,0]+=.87*radius*np.cos(a);c[:,2]+=.68*radius*np.sin(a)
  tube(9,c,radius*.105,radius*.105,[1,0,0],donor)
 if old['tail']:
  donor=tuple(np.concatenate([part[2][k] for part in old['tail']]) for k in range(3))
  v=donor[0];base=anchor['Tail_1'];tip=v[np.argmin(v[:,2])].copy()
  if family=='star':tip=v[np.argmin(v[:,1])].copy()
  # Anchor the dock inside the weighted rump; the tail pivot can sit outside its skin.
  body=next(item for item in parts if d['materials'][item[0]['material']]['name']=='00_body')
  rump_ids=np.flatnonzero(np.array(body[4])=='Pelvis')
  rump=body[1][rump_ids];height=np.quantile(rump[:,1],.72)
  rear=rump[rump[:,2]<np.quantile(rump[:,2],.28)]
  seat=rear[np.argmin(abs(rear[:,1]-height)+abs(rear[:,0])*.9)].copy()
  seat[0]=0;seat[2]+=.12*np.ptp(rump[:,2])
  base=seat
  pelvis_j=attribute(d,b,body[0],'JOINTS_0')[rump_ids].copy()
  pelvis_w=attribute(d,b,body[0],'WEIGHTS_0')[rump_ids].copy()
  donor=tuple(np.concatenate((a,z)) for a,z in zip(donor,(rump,pelvis_j,pelvis_w)))
  tip[0]=0;delta=tip-base;L=np.linalg.norm(delta);side=np.array([1.,0,0]);cross=unit(np.cross(unit(delta),side))
  center=base+U*delta
  center[:,1]+=L*(.19 if family=='star' else -.09)*np.sin(np.pi*u)
  center[:,2]-=L*(.17 if family=='star' else .04)*np.sin(np.pi*u)
  # Underfur core or tail dock; surrounding locks overlap through the entire fan.
  rad=L*((.085+.22*bulge)*(1-.82*u) if family=='moon' else (.069+.135*bulge)*(1-.65*u))
  tube(0 if family=='moon' else 4,center,rad,rad*.86,side,donor)
  for i in range(17 if family=='moon' else 13):
   a=i*2.39996;direction=side*np.cos(a)+cross*np.sin(a)
   c=center.copy();c+=direction*(rad*(.56+.65*U[:,0]))[:,None]
   c+=side*L*(.07*np.sin(2*np.pi*u+a)*u)[:,None]
   c+=direction*L*(.085*(u**2)*np.sin(a*3))[:,None]
   c[:,1]+=L*.078*u**2*np.cos(a*2)
   r=L*(.019+.092*bulge)*(1-.82*u)
   if family=='moon':
    start=.05+(i%5)*.125;end=min(1.,start+.41+.09*np.sin(i))
    sample=start+(end-start)*u
    mid=np.column_stack([np.interp(sample,u,center[:,k]) for k in range(3)])
    outer=np.interp(sample,u,rad)
    c=mid+direction*(outer*(.78+.45*u))[:,None]
    c+=side*(L*.038*np.sin(1.45*np.pi*u+a)*u)[:,None]
    r=L*(.034+.074*bulge)*(1-.91*u)
   slot=((0,2,15,0,2,1) if family=='moon' else (4,5,4,5,9))[i%(6 if family=='moon' else 5)]
   tube(slot,c,r,r*(.55 if family=='moon' else .33),side,donor,.38*np.sin(np.pi*u+a))
 if old['mane']:
  donor=tuple(np.concatenate([part[2][k] for part in old['mane']]) for k in range(3))
  v=donor[0];h=anchor['Head'];neck=anchor['Neck_1'];L=np.linalg.norm(h-neck);spine=unit(h-neck);crest=h.copy();crest[1]=np.quantile(v[:,1],.98);crest[2]-=.10*L
  for i in range(15):
   t=i/14;root=crest+(neck-h)*(.80*t);root[2]-=.12*L*t
   c=root+U*L*[.15+.06*np.cos(i),-.16-.18*t,-.53+.13*t]
   c[:,1]+=L*(.18+.05*np.sin(i))*np.sin(1.72*np.pi*u)*u**.5
   c[:,0]+=L*.14*np.sin(np.pi*u+.17*i)*u
   c[:,1]+=L*.18*np.sin(np.pi*u)
   r=L*(.029+.110*bulge)*(1-.86*u)
   tube((4,5,5,4,9)[i%5],c,r,r*.43,[1,0,0],donor)
  for i in range(4):
   c=crest+U*L*[(i-1.5)*.12,-.21,.30+.02*i];c[:,1]+=.15*L*np.sin(np.pi*u)
   r=L*(.021+.063*bulge)*(1-.83*u);tube(4 if i%2 else 5,c,r,r*.47,[1,0,0],donor)
 for slot,n,donor in old['toe']:
  v=donor[0];lo=v.min(0);hi=v.max(0);span=hi-lo;c=(lo+hi)/2
  axis=np.array([np.sign(c[0]-anchor[n][0])*.08,0,1.])
  base=c-axis*span[2]*.52
  path_toe=base+U*axis*span[2]*1.08
  path_toe[:,1]+=span[1]*.09*np.sin(np.pi*u)
  dome=.03+.97*np.sin(np.pi*u)**.65
  tube(slot,path_toe,span[0]*.47*dome,span[1]*.46*dome,[1,0,0],donor)
  start=path_toe[15].copy();start[1]+=.06*span[1]
  claw=start+U*axis*span[2]*(.42 if age else .26)
  claw[:,1]+=span[1]*(.12*np.sin(np.pi*u)-.32*u)
  rad=span[0]*(.21*(1-u)**.72+.002);tube(3,claw,rad,rad*1.15,[1,0,0],donor)
 for slot,n,donor in old['frost']:
  v=donor[0];lo=v.min(0);hi=v.max(0);span=hi-lo
  base=v[v[:,1]<=np.quantile(v[:,1],.22)].mean(0);L=np.linalg.norm(span)
  drift=np.sign(base[0])*.09 if abs(base[0])>.08*L else .025*np.sin(base[2]*5)
  c=base+U*L*[drift,.48,-.79];c[:,1]+=.13*L*np.sin(np.pi*u)
  rad=L*(.035+.13*bulge)*(1-.88*u)
  tube(4,c,rad,rad*.42,[1,0,0],donor)
  c[:,1]+=rad*.36
  tube(7,c,rad*.34,rad*.22,[1,0,0],donor)
 for slot,n,donor in old['muzzle']:
  v=donor[0];lo=v.min(0);hi=v.max(0);span=hi-lo;start=(lo+hi)/2;start[2]=lo[2];size=np.ptp(np.concatenate([z[2][0] for z in old['muzzle']]),axis=0)[2]
  elong=(.01,.15,.23,.26)[age]*size
  if slot==3:start[2]+=elong
  c=start+U*[0,0,span[2]+(0 if slot==3 else elong)]
  r=span[0]*(.012+.53*bulge)*(1-.19*u);hgt=span[1]*(.02+.53*bulge)
  tube(slot,c,r,hgt,[1,0,0],donor)
  if slot==1 and n=='Head' and age>=1:
   for sign in (-1,1):
    c=start+np.array([sign*.34*span[0],-.24*span[1],.66*(span[2]+elong)])+U*[0,-.55*span[1],-.13*span[2]]
    rad=span[0]*.105*(1-.99*u);tube(1,c,rad,rad*.85,[1,0,0],donor)
 for slot,items in batch.items():
  v=np.concatenate([i[0] for i in items]);offset=0;faces=[]
  for points,tri,_,_ in items:faces.append(tri+offset);offset+=len(points)
  tri=np.concatenate(faces);a,bb,cc=v[tri].transpose(1,0,2);fn=np.cross(bb-a,cc-a);norm=np.zeros_like(v)
  for i in range(3):np.add.at(norm,tri[:,i],fn)
  norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-12)
  uv=np.tile([(slot%4+.5)/4,(3-slot//4+.5)/4],(len(v),1))
  uv[:,0]+=.095*norm[:,0];uv[:,1]+=.095*norm[:,1]
  attrs={}
  for key,data,fmt,shape,component in [('POSITION',v,'<f4','VEC3',5126),('NORMAL',norm,'<f4','VEC3',5126),('TEXCOORD_0',uv,'<f4','VEC2',5126),('JOINTS_0',np.concatenate([i[2] for i in items]),'<u2','VEC4',5123),('WEIGHTS_0',np.concatenate([i[3] for i in items]),'<f4','VEC4',5126)]:
   attrs[key]=add_array(d,b,data,fmt,shape,component,key=='POSITION')
  retained.append(dict(attributes=attrs,material=materials[slot],indices=add_array(d,b,tri.ravel(),'<u4','SCALAR',5125),mode=4))
 d['meshes'][0]['primitives']=retained;d['buffers'][0]['byteLength']=len(b)
 b.extend(bytes(-len(b)%4));chunk=json.dumps(d,separators=(',',':')).encode();chunk+=b' '*(-len(chunk)%4)
 folder=OUT/family;folder.mkdir(parents=True,exist_ok=True)
 (folder/path.name).write_bytes(struct.pack('<4sII',b'glTF',2,28+len(chunk)+len(b))+struct.pack('<I4s',len(chunk),b'JSON')+chunk+struct.pack('<I4s',len(b),b'BIN\0')+b)
 return dict(counts)

if __name__=='__main__':
 report={}
 for family in ('sun','moon','star'):
  for path in sorted((SRC/family).glob('*.glb')):
   report[path.stem]=rebuild(path);print(path.stem,report[path.stem],flush=True)
 (OUT/'replacements.json').write_text(json.dumps(report,indent=2),encoding='utf8')

