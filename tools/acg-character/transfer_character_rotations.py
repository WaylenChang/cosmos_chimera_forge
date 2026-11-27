"""Copy only the requested sampled bone rotations to the existing full and LOD assets."""
import json
import struct
import sys
from pathlib import Path

def read(path):
    raw = path.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20+size]), bytearray(raw[28+size:])

def save(path, doc, binary):
    doc['buffers'][0]['byteLength'] = len(binary)
    header = json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode()
    header += b' '*(-len(header)%4)
    binary.extend(bytes(-len(binary)%4))
    path.write_bytes(struct.pack('<4sIII4s',b'glTF',2,28+len(header)+len(binary),len(header),b'JSON') +
                     header + struct.pack('<I4s',len(binary),b'BIN\0') + binary)

def transfer(original, staged):
    sampled, source = read(staged/'sampled.glb')
    clips = {a['name']:a for a in sampled['animations']}
    report = json.loads((staged/'performance.json').read_text())
    for path in original.glob('*.glb'):
        doc, binary = read(path)
        ids = {node['name']:i for i,node in enumerate(doc['nodes']) if 'name' in node}
        cache = {}
        def accessor(i):
            if i in cache:
                return cache[i]
            acc = sampled['accessors'][i].copy()
            view = sampled['bufferViews'][acc['bufferView']].copy()
            start = view.get('byteOffset',0)
            binary.extend(bytes(-len(binary)%4))
            view['byteOffset'] = len(binary)
            binary.extend(source[start:start+view['byteLength']])
            acc['bufferView'] = len(doc['bufferViews'])
            doc['bufferViews'].append(view)
            cache[i] = len(doc['accessors'])
            doc['accessors'].append(acc)
            return cache[i]
        for clip in doc['animations']:
            name = clip['name']
            wanted = set(report[name]['joints'])
            if not wanted:
                continue
            src = clips[name]
            existing = {(c['target']['node'],c['target']['path']):c for c in clip['channels']}
            duration = max(doc['accessors'][s['input']]['max'][0] for s in clip['samplers'])
            for c in src['channels']:
                joint = sampled['nodes'][c['target']['node']]['name']
                if c['target']['path']!='rotation' or joint not in wanted:
                    continue
                sampler = src['samplers'][c['sampler']]
                assert abs(sampled['accessors'][sampler['input']]['max'][0]-duration)<.001,(name,joint)
                target = existing.get((ids[joint],'rotation'))
                if target is None:
                    target = {'target':{'node':ids[joint],'path':'rotation'}}
                    clip['channels'].append(target)
                target['sampler'] = len(clip['samplers'])
                clip['samplers'].append({**sampler,'input':accessor(sampler['input']),'output':accessor(sampler['output'])})
                wanted.remove(joint)
            assert not wanted,(path,name,wanted)
        save(staged/path.name, doc, binary)

if __name__=='__main__':
    transfer(*map(Path,sys.argv[1:]))

