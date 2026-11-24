"""Refit starter plumage, coats and wing roots on the existing animated GLBs."""
import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Art/_incoming/starters_anatomy"
STAGES = ("juvenile", "adolescent", "adult", "overload")
# sRGB swatches in the original atlas tile order.
PALETTE = {
    "moon": "303356 ccd7e9 595674 23203b 746bb0 9785c2 9892ff 70ddfd 415775 83bbdf 363057 d5e8fb a8edff 627ca2 69bfae a2adce",
    "star": "e6b361 f3d390 e6b24b 332139 522871 9145ac eaa536 ad75ed c58e5c f3c96e 392948 fff3ce ffe9ac 916742 86499f e6c390",
    "sun": "f1e8d2 fff8e5 d9a94c 49362f 74804c ae7844 f4b340 c8e8e7 c17d48 f1cc75 798542 fff5cd fff0be 946731 97a560 f0dfbb",
}

def atlas(path, family, kind):
    image = Image.open(path).convert("RGB")
    pixels = np.array(image)
    h, w = pixels.shape[:2]
    for slot, swatch in enumerate(PALETTE[family].split()):
        row, col = 3 - slot // 4, slot % 4
        tile = pixels[row*h//4:(row+1)*h//4, col*w//4:(col+1)*w//4]
        y, x = np.mgrid[0:tile.shape[0], 0:tile.shape[1]] / np.array(tile.shape[:2])[:, None, None]
        grain = np.sin((x*36 + 1.8*np.sin(y*5) + y*3)*np.pi)
        metal = (family == "sun" and slot in (2, 7, 13))
        if kind == "base_color":
            rgb = np.frombuffer(bytes.fromhex(swatch), dtype=np.uint8)
            value = .97 + .027*np.cos((y-.18)*np.pi) + .006*grain
            tile[:] = np.clip(value[...,None]*rgb, 0, 255)
        elif kind == "orm":
            gloss = slot in (6, 7, 11, 12)
            rough = .30 if metal else .26 if gloss else .66 if family == "star" else .78
            tile[:,:,1] = 255*(rough+.023*grain)
            tile[:,:,2] = 185 if metal else 0
        else:
            # Subtle tangent-space ridges. Avoid engraving fur or polished eyes.
            strength = 0 if slot in (3,6,7,10,11,12) else 2 if metal else 5
            tile[:,:,0] = 128 + strength*grain
            tile[:,:,1] = 128 - .20*strength*grain
            tile[:,:,2] = 255
    buf = io.BytesIO()
    Image.fromarray(pixels).save(buf, format="PNG")
    return buf.getvalue()

def read_positions(doc, binary, index):
    a = doc["accessors"][index]
    view = doc["bufferViews"][a["bufferView"]]
    assert a["componentType"] == 5126 and a["type"] == "VEC3"
    return np.ndarray((a["count"],3), dtype="<f4", buffer=binary,
                      offset=view.get("byteOffset",0)+a.get("byteOffset",0),
                      strides=(view.get("byteStride",12),4))

def sculpt(doc, binary, family):
    primitives = doc["meshes"][0]["primitives"]
    body = next(p for p in primitives if doc["materials"][p["material"]]["name"]=="00_body")
    base = read_positions(doc,binary,body["attributes"]["POSITION"])
    low, high = base.min(axis=0), base.max(axis=0)
    span = high-low
    for p in primitives:
        a = p["attributes"]
        pos = read_positions(doc,binary,a["POSITION"])
        normals = read_positions(doc,binary,a["NORMAL"])
        x,y,z = ((pos-low)/span).T.copy()
        # A continuous transverse deformation spans every material at the joint.
        # Taper outside the shoulder so flight feathers and head retain their width.
        side = (pos[:,0]/span[0]).copy()
        if family=="sun":
            strength, height, fore, width = .20,.51,.64,.31
        elif family=="moon":
            strength, height, fore, width = .23,.59,.67,.23
        else:
            strength, height, fore, width = .24,.60,.62,.25
        falloff = np.exp(-((y-height)/.26)**2-((z-fore)/width)**2-(side/.85)**4)
        v = strength*falloff
        jac_x = 1+v*(1-4*(side/.85)**4)
        jac_y = pos[:,0]*v*(-2*(y-height)/(.26**2*span[1]))
        jac_z = pos[:,0]*v*(-2*(z-fore)/(width**2*span[2]))
        pos[:,0] *= 1+v
        normals[:,0] /= jac_x
        normals[:,1] -= normals[:,0]*jac_y
        normals[:,2] -= normals[:,0]*jac_z
        normals[:] /= np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
        for index, data in [(a["POSITION"],pos),(a["NORMAL"],normals)]:
            acc=doc["accessors"][index]
            if "min" in acc:acc.update(min=data.min(axis=0).tolist(),max=data.max(axis=0).tolist())

def attribute(doc, binary, primitive, key):
    a = doc["accessors"][primitive["attributes"][key]]
    v = doc["bufferViews"][a["bufferView"]]
    width = int(a["type"][-1])
    dtype = np.dtype({5121:"u1",5123:"<u2",5126:"<f4"}[a["componentType"]])
    return np.ndarray((a["count"],width),dtype=dtype,buffer=binary,
                      offset=v.get("byteOffset",0)+a.get("byteOffset",0),
                      strides=(v.get("byteStride",width*dtype.itemsize),dtype.itemsize))

def align_tiles(doc,binary):
    # Legacy exporter laid out UVs by primitive order, not the material slot ID.
    for p in doc["meshes"][0]["primitives"]:
        slot=int(doc["materials"][p["material"]]["name"][:2])
        uv=attribute(doc,binary,p,"TEXCOORD_0")
        local=np.clip(uv*4-np.floor(np.median(uv,axis=0)*4),.025,.975)
        uv[:]=(local+[slot%4,3-slot//4])/4

def add_array(doc,binary,values,fmt,shape,component,position=False):
    data=np.ascontiguousarray(values,dtype=fmt)
    binary.extend(bytes((-len(binary))%4))
    view=len(doc["bufferViews"])
    doc["bufferViews"].append(dict(buffer=0,byteOffset=len(binary),byteLength=data.nbytes))
    binary.extend(data.tobytes())
    acc=dict(bufferView=view,componentType=component,type=shape,count=len(data))
    if position:acc.update(min=data.min(0).tolist(),max=data.max(0).tolist())
    doc["accessors"].append(acc)
    return len(doc["accessors"])-1

def grow_mantle(doc,binary,family,stage):
    """Root each closed lock in the actual skinned surface and inherit its weights."""
    primitives=doc["meshes"][0]["primitives"]
    skin=next(p for p in primitives if doc["materials"][p["material"]]["name"]=="00_body")
    pos,norm,joints,weights=[attribute(doc,binary,skin,k).copy() for k in ("POSITION","NORMAL","JOINTS_0","WEIGHTS_0")]
    names=[doc["nodes"][n]["name"] for n in doc["skins"][0]["joints"]]
    leaders=joints[np.arange(len(pos)),weights.argmax(1)]
    groups={}
    maturity=(.72,.88,1.,1.10)[STAGES.index(stage)]
    regions={"moon":[("Head",5),("Neck_2",6),("Neck_1",5),("Thorax",5),("Lumbar",3)],
             "sun":[("Thorax",6),("Neck_1",4)],
             "star":[("Head",5),("Neck_2",5),("Neck_1",5),("Thorax",4)]}[family]
    for bone,count in regions:
        ids=np.flatnonzero(leaders==names.index(bone))
        if len(ids)<8:continue
        points=pos[ids];low,high=points.min(0),points.max(0)
        span=high-low
        mane = family=="star" and bone.startswith("Neck")
        for sign in ((1,) if mane else (-1,1)):
            for i in range(count):
                t=(i+.5)/count
                # A cheek fan sweeps toward the nape. Coverts run back and down.
                target=low+span*np.array([.98 if sign>0 else .02,.31+.46*t,.66-.33*t])
                if family=="star" and bone!="Thorax":
                    target=low+span*np.array([.51+.06*t,.97-.08*t,.83-.65*t])
                if family=="star" and bone=="Head":
                    target=low+span*np.array([.50+sign*(.04+.15*t),.98-.07*t,.33+.24*t])
                dorsal=family=="moon" and bone in ("Thorax","Lumbar")
                if dorsal:
                    target=low+span*np.array([.50+sign*(.15+.23*t),.92-.26*t,.76-.44*t])
                side=np.where(points[:,0]*sign>0)[0]
                key=ids[side[np.argmin(np.sum(((points[side]-target)/np.maximum(span,.001))**2,axis=1))]]
                root=pos[key].astype(float);out=norm[key].astype(float)
                if out[0]*sign<.10:out=np.array([sign*.83,.45,0])
                out/=np.linalg.norm(out)
                size=span[0]*maturity
                root-=out*.065*size
                direction=np.array([sign*(.17+.19*t),-.28+.30*t,-.54])
                if family=="star" and bone!="Thorax":direction=np.array([sign*.40,-.72+.1*t,-.32])
                if family=="sun":direction=np.array([sign*.24,-.42,-.58])
                if family=="star" and bone=="Head":
                    direction=np.array([sign*(.16+.16*t),.15-.42*t,.42+.16*t])
                if dorsal:
                    direction=np.array([sign*.20,-.12-.10*t,-.68])
                if family=="moon":
                    size*= (.58 if stage=="juvenile" else .84) * (.68 if dorsal else 1)
                    if bone=="Neck_1":direction=np.array([sign*.12,-.60,-.36])
                if mane:direction=np.array([.24+.18*t,-.55-.18*t,-.40])
                axis=direction/np.linalg.norm(direction)
                across=np.cross(axis,out);across/=max(np.linalg.norm(across),.001)
                ridge=np.cross(across,axis);ridge/=np.linalg.norm(ridge)
                slot=({"moon":(2,15,1),"sun":(0,1,15),"star":(4,5,4)}[family])[(i+int(bone=="Head"))%3]
                if family=="star" and bone=="Thorax":slot=1 if i%3 else 0
                if family=="moon" and bone=="Head" and t>.6:slot=0
                if dorsal:slot=0 if i%3 else 2
                batch=groups.setdefault(slot,dict(pos=[],normal=[],uv=[],j=[],w=[],tri=[]))
                start=len(batch["pos"])
                for ring in range(9):
                    u=ring/8
                    radius=(.06+.14*np.sin(np.pi*(.09+.91*u))**.8)*(1-u*.97)*size
                    center=root+direction*size*u+out*size*(.10*np.sin(np.pi*u)+.03*u)
                    if family=="star" and bone=="Head":
                        center[1]+=size*(.19*np.sin(np.pi*u)-.16*u*u)
                    depth=.55
                    if family=="sun" or (family=="star" and bone=="Thorax"):
                        radius=size*(.025+.125*np.sin(np.pi*u)**.72)*(1-.50*u)
                        depth=.14+.09*(1-u)
                    elif family=="star":
                        radius*=.69
                        depth=.32
                        center+=across*size*.10*np.sin(1.7*np.pi*u)*u
                    else:
                        radius*=.80+.15*np.cos(i*2.4)
                    for k in range(10):
                        a=2*np.pi*k/10
                        v=center+radius*(across*np.cos(a)+ridge*depth*np.sin(a))
                        nn=across*depth*np.cos(a)+ridge*np.sin(a)+axis*(.12+.15*u)
                        batch["pos"].append(v);batch["normal"].append(nn/np.linalg.norm(nn))
                        batch["uv"].append([(slot%4+.5+.36*np.cos(a))/4,(3-slot//4+.06+.88*u)/4])
                        batch["j"].append(joints[key]);batch["w"].append(weights[key])
                        if ring:
                            a0=start+(ring-1)*10+k;a1=start+(ring-1)*10+(k+1)%10
                            batch["tri"].extend((a0,a1+10,a1,a0,a0+10,a1+10))
                for k in range(1,9):
                    batch["tri"].extend((start,start+k,start+k+1,start+80,start+81+k,start+80+k))
    for slot,b in groups.items():
        mat=next(i for i,m in enumerate(doc["materials"]) if int(m["name"][:2])==slot)
        attrs={}
        for key,data,fmt,shape,component in [
            ("POSITION","pos","<f4","VEC3",5126),("NORMAL","normal","<f4","VEC3",5126),
            ("TEXCOORD_0","uv","<f4","VEC2",5126),("JOINTS_0","j","<u2","VEC4",5123),
            ("WEIGHTS_0","w","<f4","VEC4",5126)]:
            attrs[key]=add_array(doc,binary,b[data],fmt,shape,component,key=="POSITION")
        primitives.append(dict(attributes=attrs,indices=add_array(doc,binary,b["tri"],"<u2","SCALAR",5123),material=mat,mode=4))


def species_motion(doc,binary,family,stage):
    nodes=doc["nodes"]
    parent={c:i for i,n in enumerate(nodes) for c in n.get("children",[])}
    def rest_world(i):
        q=Rotation.from_quat(nodes[i].get("rotation",[0,0,0,1]))
        return rest_world(parent[i])*q if i in parent else q
    if family=="sun":
        # Sustain the species flap in place. World travel belongs to the controller.
        from copy import deepcopy
        source=next(a for a in doc["animations"] if a["name"]=="v3_"+stage+"_flap")
        def duration(clip):
            return max(doc["accessors"][s["input"]]["max"][0] for s in clip["samplers"])
        for clip in doc["animations"]:
            if clip["name"] not in ("cr_"+stage+"_fly_move","cr_"+stage+"_fly_idle"):continue
            ratio=duration(clip)/duration(source)
            clip["channels"]=deepcopy(source["channels"])
            clip["samplers"]=deepcopy(source["samplers"])
            inputs={}
            for sampler in clip["samplers"]:
                i=sampler["input"]
                if i not in inputs:
                    acc=doc["accessors"][i];v=doc["bufferViews"][acc["bufferView"]]
                    t=np.frombuffer(binary,"<f4",acc["count"],v.get("byteOffset",0)+acc.get("byteOffset",0)).copy()*ratio
                    idx=add_array(doc,binary,t,"<f4","SCALAR",5126)
                    doc["accessors"][idx].update(min=[float(t.min())],max=[float(t.max())])
                    inputs[i]=idx
                sampler["input"]=inputs[i]
    for clip in doc["animations"]:
        mode=clip["name"].split(stage+"_")[-1]
        air=family=="sun" and mode in ("fly_move","fly_idle","flap")
        ground=mode in ("idle","idle_long","walk","run","trot","canter","gallop","sneak","mount_run","mount_idle")
        for ch in clip["channels"]:
            target=ch["target"]
            if target["path"]!="rotation":continue
            i=target["node"];name=nodes[i]["name"]
            wing=ground and name.startswith("Wing_")
            trail=air and (name.endswith("Hind_Upper") or name in ("Neck_1","Neck_2","Head"))
            tail=family=="moon" and ground and name.startswith("Tail_")
            if not (wing or trail or tail):continue
            sampler=clip["samplers"][ch["sampler"]]
            acc=doc["accessors"][sampler["output"]];view=doc["bufferViews"][acc["bufferView"]]
            values=np.frombuffer(binary,"<f4",acc["count"]*4,view.get("byteOffset",0)+acc.get("byteOffset",0)).reshape(-1,4).copy()
            curve=Rotation.from_quat(values)
            parent_q=rest_world(parent[i])
            def world_offset(axis,degrees):
                return parent_q.inv()*Rotation.from_euler(axis,np.reshape(degrees,(-1,1)),degrees=True)*parent_q
            if wing:
                rest=Rotation.from_quat(nodes[i]["rotation"])
                side=1 if "_L_" in name else -1
                angle=(38,19,9)[int(name[-1])]
                delta=(rest.inv()*curve).as_rotvec()
                curve=world_offset("y",side*angle)*rest*Rotation.from_rotvec(delta*.12)
            elif trail:
                degrees=68 if name.endswith("Upper") else {"Neck_1":-29,"Neck_2":14,"Head":15}[name]
                curve=world_offset("x",degrees)*curve
            else:
                rank=int(name[-1]);times=np.linspace(0,2*np.pi,len(values))
                amplitude=(3 if mode in ("idle","idle_long") else 6)*rank/3
                # Two-key static curves retain the original rest orientation.
                if len(values)<3:continue
                curve=world_offset("y",amplitude*np.sin(times-.55*rank))*curve
            sampler["output"]=add_array(doc,binary,curve.as_quat(),"<f4","VEC4",5126)

def build(source, family, stage, baseline=False):
    raw = source.read_bytes()
    length = struct.unpack_from("<I",raw,12)[0]
    doc = json.loads(raw[20:20+length])
    binary = bytearray(raw[28+length:])
    if not baseline:
        sculpt(doc,binary,family)
        align_tiles(doc,binary)
        grow_mantle(doc,binary,family,stage)
        species_motion(doc,binary,family,stage)
        # Paint broad countershading across touching parts in bind-space.
        for p in doc["meshes"][0]["primitives"]:
            slot=int(doc["materials"][p["material"]]["name"][:2])
            if slot not in (0,1,2,4,5,9,15):continue
            xyz=attribute(doc,binary,p,"POSITION").copy()
            normal=attribute(doc,binary,p,"NORMAL").copy()
            upward=np.clip(.5+.5*normal[:,1],0,1)
            warm=np.array({"sun":[.70,.62,.54],"star":[.71,.57,.63],"moon":[.67,.68,.82]}[family])
            color=warm+(1-warm)*upward[:,None]
            if family=="sun" and slot in (0,1,15):
                color*=np.array([1,.982,.935])
            p["attributes"]["COLOR_0"]=add_array(doc,binary,color,"<f4","VEC3",5126)
    for image in doc["images"]:
        kind = next(k for k in ("normal","orm","base_color") if image["name"].endswith(k))
        source_map = next((source.parent/"_03b_blender").glob("*_textures_*_"+kind+".png"))
        data = source_map.read_bytes() if baseline else atlas(source_map,family,kind)
        binary.extend(bytes((-len(binary))%4))
        image["bufferView"] = len(doc["bufferViews"])
        doc["bufferViews"].append(dict(buffer=0,byteOffset=len(binary),byteLength=len(data)))
        binary.extend(data)
    if not baseline:
        for mat in doc["materials"]:
            pbr=mat["pbrMetallicRoughness"]
            if "metallicRoughnessTexture" in pbr:
                pbr.update(metallicFactor=1,roughnessFactor=1)
            if "normalTexture" in mat:mat["normalTexture"]["scale"]=.64
            if "emissiveFactor" in mat:
                mat["emissiveFactor"]=[v*.50 for v in mat["emissiveFactor"]]
    doc["buffers"][0]["byteLength"] = len(binary)
    binary.extend(bytes((-len(binary))%4))
    chunk=json.dumps(doc,separators=(",",":")).encode()
    chunk+=b" "*((-len(chunk))%4)
    name=f"{family}_{STAGES.index(stage)+1}_{stage}"
    folder=OUT/("baseline_models" if baseline else family)
    folder.mkdir(parents=True,exist_ok=True)
    (folder/(name+".glb")).write_bytes(struct.pack("<4sII",b"glTF",2,28+len(chunk)+len(binary))+struct.pack("<I4s",len(chunk),b"JSON")+chunk+struct.pack("<I4s",len(binary),b"BIN\0")+binary)

if __name__ == "__main__":
    for family in PALETTE:
        for n, stage in enumerate(STAGES,1):
            source=next((ROOT/"Drive/creatures"/f"ch_starter_{family}_line").glob(f"*form{n}_*_legacy.glb"))
            build(source,family,stage)




