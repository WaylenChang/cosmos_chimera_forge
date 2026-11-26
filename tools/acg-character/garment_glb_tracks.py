"""Write only sleeve weights into existing glTF clips; facial morphs stay independently controllable."""
import json
import struct
from pathlib import Path

import numpy as np


def write_sleeve_tracks(path, samples, fps):
    raw=path.read_bytes()
    length=struct.unpack_from("<I",raw,12)[0]
    doc=json.loads(raw[20:20+length])
    payload=bytearray(raw[28+length:28+length+doc["buffers"][0]["byteLength"]])
    def accessor(values):
        payload.extend(bytes((-len(payload))%4))
        offset=len(payload);values=np.asarray(values,dtype="<f4").ravel()
        payload.extend(values.tobytes())
        view=len(doc["bufferViews"])
        doc["bufferViews"].append(dict(buffer=0,byteOffset=offset,byteLength=values.nbytes))
        doc["accessors"].append(dict(bufferView=view,componentType=5126,count=len(values),
            type="SCALAR",min=[float(values.min())],max=[float(values.max())]))
        return len(doc["accessors"])-1
    hair=isinstance(samples,dict)
    parts=("TiedHair",) if hair else ("L_KimonoSleeve","R_KimonoSleeve")
    sleeves=[(i,doc["meshes"][n["mesh"]]["extras"]["targetNames"])
             for i,n in enumerate(doc["nodes"]) if n["name"] in parts]
    assert len(sleeves)==len(parts)
    for a in doc["animations"]:
        levels=samples.get(a["name"],[]) if hair else []
        frames=list(enumerate(range(len(levels)))) if hair else [(i+10,f) for i,(clip,f) in enumerate(samples) if clip==a["name"]]
        if frames:
            times=[(f-frames[0][1])/fps for _,f in frames]
            duration=max(doc["accessors"][s["input"]]["max"][0] for s in a["samplers"])
            assert abs(duration-times[-1]) < 1e-4,(a["name"],duration,times)
        else:
            frames=[(-100,0)];times=[0.]
        time=accessor(times)
        for node,keys in sleeves:
            if hair:
                assert keys==["Garment clearance"]
                values=levels or [0.]
            else:
                assert all(k.startswith("Clearance_") for k in keys)
                indices={int(k.split("_")[1]):i for i,k in enumerate(keys)}
                values=np.zeros((len(frames),len(keys)),dtype="f")
                for i,(code,_) in enumerate(frames):
                    if code in indices:values[i,indices[code]]=1
            si=len(a["samplers"])
            a["samplers"].append(dict(input=time,output=accessor(values),interpolation="LINEAR"))
            a["channels"].append(dict(sampler=si,target=dict(node=node,path="weights")))
    doc["buffers"][0]["byteLength"]=len(payload)
    body=json.dumps(doc,separators=(",",":")).encode()
    body+=b" "*((-len(body))%4);payload.extend(bytes((-len(payload))%4))
    size=28+len(body)+len(payload)
    staged=path.with_suffix(".tmp")
    staged.write_bytes(struct.pack("<4sIII4s",b"glTF",2,size,len(body),b"JSON")+body+
                       struct.pack("<I4s",len(payload),b"BIN\0")+payload)
    staged.replace(path)
