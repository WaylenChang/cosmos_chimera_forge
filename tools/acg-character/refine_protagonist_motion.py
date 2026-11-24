"""Refine the editable protagonist studies and stage new Blender and glTF files.

Run at the repository root:
    blender -b --python-exit-code 1 -P tools/acg-character/refine_protagonist_motion.py -- HERO STAGE
Use --input ORIGINAL.blend to rebuild from a saved copy of the pre-refinement study.
"""
import argparse
import json
from math import cos, pi, sin, sqrt
from pathlib import Path
import struct
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

SIDES = ('Left', 'Right')
ZERO = Vector()
X, Y, Z = (Vector(v) for v in ((1, 0, 0), (0, 1, 0), (0, 0, 1)))
ARM = ('UpperArm', 'LowerArm', 'Hand')
LEG = ('UpperLeg', 'LowerLeg', 'Foot')
TORSO = ('Hips', 'Spine', 'Chest', 'UpperChest')


def glb_json(path):
    with path.open('rb') as file:
        magic, version, total, size, kind = struct.unpack('<4s4I', file.read(20))
        assert magic == b'glTF' and version == 2 and kind == 0x4E4F534A
        assert total == path.stat().st_size
        return json.loads(file.read(size))


def add_nape(rig, hero):
    hair = bpy.data.objects['Hair']
    coll = bpy.data.collections['Hair']
    name = 'HairLockNape'
    assert name not in bpy.data.objects, "Use the pre-refinement .blend as input"
    source = [o for o in coll.objects if o == hair or o.name.startswith('HairLock') and 'Temple' not in o.name]
    shells = []
    for obj in source:
        mesh = obj.data
        mesh.calc_loop_triangles()
        tris = list(mesh.loop_triangles)
        tree = BVHTree.FromPolygons([v.co for v in mesh.vertices], [t.vertices[:] for t in tris], all_triangles=True)
        shells.append((tree, mesh, tris))

    # The shorter lock layer starts underneath the existing large locks and
    # breaks up the round nape edge. Length and sweep follow each hairstyle.
    c = rig.data.bones['Head'].head_local.x
    base = min(v.co.z for v in hair.data.vertices)
    styles = {
        'roen': ((-.075, -.057, -.038, -.016, .005, .025, .045, .066, .083), .123, .009, 1),
        'amemori_sumiha': ((-.066, -.046, -.026, -.007, .014, .035, .057, .076), .075, .0060, -1),
        'yeh_chengxi': ((-.074, -.055, -.036, -.015, .007, .027, .047, .066), .073, .0060, 1),
    }
    offsets, height, relief, sweep = styles[hero]
    verts, faces = [], []
    rings, sectors = 19, 12
    for index, offset in enumerate(offsets):
        start = base + height + .008 * sin(index * 2.6)
        reach = base + .080 * (abs(offset) / .10)**2 - .008 + .005 * sin(index * 2.1)
        girth = .0085 + .002 * sin(index * 1.7)
        rows = []
        last_depth = None
        cap = shells[0][0]
        for j in range(rings):
            t = j/(rings-1)
            x = c+offset+sweep*(.012*sin(t*pi/2)-.004*t*t)+offset*.09*t
            z = start+(reach-start)*t
            hit = cap.ray_cast(Vector((x,.30,z)),-Y)[0]
            if hit is None:
                assert last_depth is not None, (hero,index,j)
                y = last_depth-.002
            else:
                y = hit.y
            nearby = cap.ray_cast(Vector((x+.003,.30,z)),-Y)[0]
            slope = max(-1.15,min(1.15,(nearby.y-y)/.003)) if nearby and hit else 0.
            rows.append((x,y,z,slope))
            last_depth = y

        surface = [row[1] for row in rows]
        for _ in range(2):
            surface = [surface[0], *((a+2*b+d)*.25 for a,b,d in zip(surface,surface[1:],surface[2:])), surface[-1]]
        first = len(verts)
        for j, ((x,_,z,slope), y) in enumerate(zip(rows,surface)):
            t = j/(rings-1)
            width = .0004+girth*(sin(pi*(.14+.86*t))**.95)
            depth = .00045+relief*sin(pi*t)**.8
            center = y-.009*(1-t)**4+.004*sin(pi*t)+.0015*t
            for k in range(sectors):
                angle = k*2*pi/sectors
                dx = width*cos(angle)
                verts.append(Vector((x+dx,center+slope*dx+depth*sin(angle),z)))
        for j in range(rings-1):
            for k in range(sectors):
                a = first + j*sectors + k
                b = first + j*sectors + (k+1)%sectors
                faces.append((a, b, b+sectors, a+sectors))
        faces.append(tuple(range(first+sectors-1, first-1, -1)))
        faces.append(tuple(range(first+(rings-1)*sectors, first+rings*sectors)))

    # Separate connected components keep the nape editable without merging the scalp.
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    layer = mesh.uv_layers.new(name=hair.data.uv_layers.active.name)
    # Keep the existing atlas across the entire lower layer. A slightly
    # softer finish brings out the overlap without changing the base palette.
    mat = hair.data.materials[0].copy()
    mat.name = 'Hair nape'
    shader = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Emission Strength'].default_value *= .97
    shader.inputs['Roughness'].default_value = .67
    mesh.materials.append(mat)
    tree, source_mesh, tris = shells[0]
    uvs = source_mesh.uv_layers.active.data
    for poly in mesh.polygons:
        poly.use_smooth = poly.loop_total == 4
        for loop in poly.loop_indices:
            p = verts[mesh.loops[loop].vertex_index]
            point, _, tri_idx, _ = tree.find_nearest(p)
            tri = tris[tri_idx]
            layer.data[loop].uv = barycentric_transform(point, *(source_mesh.vertices[i].co for i in tri.vertices),
                                 *(Vector((*uvs[i].uv, 0)) for i in tri.loops))[:2]
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    assert all(e.is_manifold and e.is_contiguous for e in bm.edges)
    assert min(f.calc_area() for f in bm.faces) > 1e-10
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    obj.parent = rig
    obj.vertex_groups.new(name='Head').add(list(range(len(verts))), 1, 'REPLACE')
    obj.modifiers.new('Humanoid skin', 'ARMATURE').object = rig
    # Verify every component starts below the outer surface and exits it.
    skin = BVHTree.FromPolygons(verts, faces)
    assert skin.overlap(shells[0][0]) or any(skin.overlap(tree) for tree, _, _ in shells[1:])
    for first in range(0, len(verts), rings*sectors):
        relevant = [tuple(i-first for i in f) for f in faces if first <= f[0] < first+rings*sectors]
        tree = BVHTree.FromPolygons(verts[first:first+rings*sectors], relevant)
        assert any(tree.overlap(surface) for surface, _, _ in shells), (hero, first)
    return obj


def adjacent(values, index, offset, cycle):
    last = len(values)-1
    return values[(index+offset) % last if cycle else max(0, min(last, index+offset))]


def denoise(samples, cycle, strength, rotation):
    if len(samples) < 3:
        return samples
    result = []
    for i, value in enumerate(samples):
        if rotation:
            near = adjacent(samples, i, -1, cycle).slerp(adjacent(samples, i, 1, cycle), .5)
            far = adjacent(samples, i, -2, cycle).slerp(adjacent(samples, i, 2, cycle), .5)
            result.append(value.slerp(near.slerp(far, .16), strength))
        else:
            near = (adjacent(samples, i, -1, cycle)+adjacent(samples, i, 1, cycle))*.5
            far = (adjacent(samples, i, -2, cycle)+adjacent(samples, i, 2, cycle))*.5
            result.append(value.lerp(near.lerp(far, .16), strength))
    if cycle:
        result[-1] = result[0].copy()
    else:
        result[0], result[-1] = samples[0], samples[-1]
    return result


class Clearance:
    """Fit pose envelopes to the character's dressed trunk and limbs."""
    def __init__(self, rig):
        self.rig = rig
        self.bones = rig.pose.bones
        self.rest = {b.name: b.bone.matrix_local.to_quaternion() for b in self.bones}
        self.local = {b.name: b.parent.bone.matrix_local.inverted() @ b.bone.matrix_local
                      for b in self.bones if b.parent}
        c = self.bones['Hips'].bone.head_local.x
        hip = self.bones['Hips'].bone.head_local.z
        chest = self.bones['UpperChest'].bone.head_local.z
        top = self.bones['Neck'].bone.head_local.z - .028
        top_name = 'Jacket' if bpy.data.objects.get('Jacket') else 'Bodice'
        jacket = bpy.data.objects[top_name]
        self.trunk = []
        for owner, z, half_height in (
                ('Hips', hip-.033, .106), ('Spine', (hip+chest)*.5, .136),
                ('Chest', chest+.020, .100), ('UpperChest', top-.039, .066)):
            row = [v.co for v in jacket.data.vertices if abs(v.co.z-z)<.032 and abs(v.co.x-c)<.155]
            # Use measured layer width, keeping armholes out of the trunk proxy.
            if row:
                width = min(.137,max(abs(p.x-c) for p in row))
                back, front = max(p.y for p in row), min(p.y for p in row)
            else:
                width, back, front = .117, .081, -.081
            self.trunk.append((owner, self.bones[owner].bone.matrix_local.inverted() @
                               Vector((c,(back+front)*.5,z)),
                               Vector((width,(back-front)*.5,half_height))))
        self.pack = None
        if backpack := bpy.data.objects.get('Backpack'):
            lo = Vector([min(v.co[k] for v in backpack.data.vertices) for k in range(3)])
            hi = Vector([max(v.co[k] for v in backpack.data.vertices) for k in range(3)])
            self.pack = ('UpperChest', self.bones['UpperChest'].bone.matrix_local.inverted() @ ((lo+hi)*.5),
                         (hi-lo)*.5)
        self.sleeves = {}
        for side in SIDES:
            if not (obj := bpy.data.objects.get(side[0]+'_KimonoSleeve')):
                continue
            bone = self.bones[side+'SleeveFall']
            group = obj.vertex_groups[bone.name].index
            vertices = [v.co for v in obj.data.vertices if any(g.group==group and g.weight>.62 for g in v.groups)]
            points = sorted(vertices, key=lambda co:co.z)[::max(1,len(vertices)//28)]
            self.sleeves[side] = [bone.bone.matrix_local.inverted() @ p for p in points]

    def pose(self, rotations, locations):
        result = {}
        for pb in self.bones:
            basis = rotations.get(pb.name, Quaternion()).to_matrix().to_4x4()
            basis.translation = locations.get(pb.name, ZERO)
            if pb.parent is None:
                parent = None
                rest = pb.bone.matrix_local
            else:
                parent = result[pb.parent.name]
                rest = self.local[pb.name]
            if pb.bone.use_inherit_rotation or parent is None:
                result[pb.name] = (parent @ rest if parent else rest) @ basis
            else:
                bind = pb.bone.matrix_local.copy()
                bind.translation = parent @ rest.translation
                result[pb.name] = bind @ basis
        return result

    def world_shapes(self, pose):
        shapes = [(pose[n] @ center, (pose[n].to_quaternion() @ self.rest[n].inverted()).inverted(), radii)
                  for n, center, radii in self.trunk]
        if self.pack:
            n, center, radii = self.pack
            shapes.append((pose[n] @ center, (pose[n].to_quaternion() @ self.rest[n].inverted()).inverted(), radii))
        return shapes

    @staticmethod
    def depth(point, shapes, margin):
        amount = 0.0
        for center, rotate, radii in shapes:
            local = rotate @ (point-center)
            x, y, z = radii.x+margin, radii.y+margin, radii.z+margin
            dist = sqrt((local.x/x)**2+(local.y/y)**2+(local.z/z)**2)
            amount = max(amount, (1-dist)*min(x,y,z))
        return amount

    def chain(self, pose, side, names):
        result = [pose[side+n].translation.copy() for n in names]
        b = self.bones[side+names[-1]]
        result.append(pose[b.name] @ Vector((0,b.length,0)))
        return result

    @staticmethod
    def arm_samples(chain):
        a,b,c,d = chain
        return ((a.lerp(b,.58),.030), (a.lerp(b,.85),.031), (b,.028),
                (b.lerp(c,.35),.028), (b.lerp(c,.72),.027),
                (c.lerp(d,.30),.032), (c.lerp(d,.85),.028))

    def arm_score(self, chain, opponent, legs, shapes):
        samples = self.arm_samples(chain)
        depth = [self.depth(p,shapes,r) for p,r in samples]
        for p,r in samples[2:]:
            depth.extend(max(0,r+rad-(p-q).length) for q,rad in opponent[2:])
            depth.extend(max(0,r+rad-(p-q).length) for q,rad in legs)
        return sum(max(0,d-.004)**2 for d in depth), max(depth, default=0)

    @staticmethod
    def leg_samples(chain):
        a,b,c,d=chain
        return ((a.lerp(b,.42),.051), (a.lerp(b,.74),.052), (b,.043),
                (b.lerp(c,.48),.049), (b.lerp(c,.84),.045), (c.lerp(d,.62),.044))

    def leg_score(self, chain, other):
        depths = [max(0,r+s-(p-q).length) for p,r in self.leg_samples(chain)
                  for q,s in self.leg_samples(other)]
        return sum(max(0,d-.004)**2 for d in depths), max(depths)

    @staticmethod
    def swing_chain(chain, index, q):
        pivot = chain[index]
        return [p if j<=index else pivot+q@(p-pivot) for j,p in enumerate(chain)]

    def turn(self, rot, pose, name, world):
        local = pose[name].to_quaternion()
        return (rot[name] @ local.inverted() @ world @ local).normalized()

    def adjust(self, pose, rotations):
        shapes = self.world_shapes(pose)
        chest_q = pose['Chest'].to_quaternion() @ self.rest['Chest'].inverted()
        lateral, fore = chest_q @ X, chest_q @ Y
        arm = {s:self.chain(pose,s,ARM) for s in SIDES}
        legs = {s:self.chain(pose,s,LEG) for s in SIDES}
        updates = {}
        # First preserve space between thighs/shins, then solve fast hand and
        # forearm contacts against the updated pose. Angle penalties protect gestures.
        for side, other in (SIDES, SIDES[::-1]):
            chain = legs[side]
            score = self.leg_score(chain,legs[other])[0]
            if score < .00006:
                continue
            best = score, None, chain
            for angle in (.035,.07,.115,.16):
                for sign in (-1,1):
                    q = Quaternion(fore,sign*angle)
                    moved = self.swing_chain(chain,0,q)
                    contact = self.leg_score(moved,legs[other])[0]
                    contact += .05*(chain[-1].z-moved[-1].z)**2 + .0015*angle**2
                    if contact < best[0]:
                        best = contact, q, moved
            if best[1] is not None:
                n = side+'UpperLeg'
                updates[n] = self.turn(rotations,pose,n,best[1])
                legs[side] = best[2]

        leg_samples = [sample for chain in legs.values() for sample in self.leg_samples(chain)]
        for side, other in (SIDES, SIDES[::-1]):
            chain = arm[side]
            opponent = self.arm_samples(arm[other])
            score = self.arm_score(chain,opponent,leg_samples,shapes)[0]
            if score < .00002:
                continue
            best = score, chain, Quaternion(), Quaternion()
            for idx in (0,1,0):
                _, moved, upper, lower = best
                for axis in (fore,lateral,(fore+lateral).normalized(),(fore-lateral).normalized()):
                    for angle in (.08,-.08,.17,-.17,.28,-.28):
                        q = Quaternion(axis,angle)
                        a,b = (q@upper,lower) if idx==0 else (upper,q@lower)
                        candidate = self.swing_chain(moved,idx,q)
                        cost = self.arm_score(candidate,opponent,leg_samples,shapes)[0]
                        cost += .0015*(a.angle*a.angle+b.angle*b.angle)
                        if cost < best[0]:
                            best = cost, candidate, a, b
            _, arm[side], a,b = best
            n = side+'UpperArm'
            if a.angle > 1e-4:
                updates[n] = self.turn(rotations,pose,n,a)
            if b.angle > 1e-4:
                n = side+'LowerArm'
                updates[n] = self.turn(rotations,pose,n,a.inverted()@b@a)
        return updates

    def score(self, pose):
        shapes = self.world_shapes(pose)
        arms = {s:self.arm_samples(self.chain(pose,s,ARM)) for s in SIDES}
        legs = {s:self.chain(pose,s,LEG) for s in SIDES}
        l,r = SIDES
        leg_samples = [point for chain in legs.values() for point in self.leg_samples(chain)]
        arm = sum(self.arm_score(self.chain(pose,s,ARM),arms[o],leg_samples,shapes)[0] for s,o in (SIDES,SIDES[::-1]))
        leg = self.leg_score(legs[l],legs[r])[0]
        sleeve = sum(max(0,self.depth(pose[s+'SleeveFall'] @ p,shapes,0)-.008)**2
                     for s,points in self.sleeves.items() for p in points)
        return arm,leg,sleeve

    def sleeve_shift(self, pose, side):
        name = side+'SleeveFall'
        matrix = pose[name]
        shapes = self.world_shapes(pose)
        points = [matrix @ p for p in self.sleeves[side]]
        def cost(shift):
            return sum(max(0,self.depth(p+shift,shapes,0)-.008)**2 for p in points) + .25*shift.length_squared
        best = cost(ZERO), ZERO
        if best[0] < .00005:
            return ZERO
        q = pose['Chest'].to_quaternion() @ self.rest['Chest'].inverted()
        outward = (1 if side=='Left' else -1)*X
        for direction in (outward,-Y,Y,(outward-Y).normalized(),(outward+Y).normalized()):
            for size in (.014,.028,.045):
                shift = q @ direction * size
                fit = cost(shift)
                if fit < best[0]:
                    best = fit,shift
        return matrix.to_quaternion().inverted() @ best[1]


def modify_action(rig, solver, action):
    data = rig.animation_data
    data.action = action
    bag = action.layers[0].strips[0].channelbag(data.action_slot)
    frames = np.arange(int(action.frame_start),int(action.frame_end)+1, dtype='f')
    duration = len(frames)
    old_rot, old_loc = {}, {}
    filtered_rot, filtered_loc = {}, {}
    curves = {}

    for pb in rig.pose.bones:
        if pb.name.startswith('Socket'):
            continue
        for prop, dims, cls, old, dest in (
                ('rotation_quaternion',4,Quaternion,old_rot,filtered_rot),
                ('location',3,Vector,old_loc,filtered_loc)):
            path = pb.path_from_id(prop)
            channels = [bag.fcurves.find(path,index=i) for i in range(dims)]
            if not all(channels):
                continue
            values = [cls(tuple(fc.evaluate(f) for fc in channels)) for f in frames]
            rotate = dims==4
            if rotate:
                for i, q in enumerate(values):
                    q.normalize()
                    if i:
                        q.make_compatible(values[i-1])
            old[pb.name] = values
            close = abs(values[0].dot(values[-1])) > .99998 if rotate else (values[0]-values[-1]).length < .0004
            cycle = action.use_cyclic and close
            strength = .48 if rotate else .42
            if rotate and pb.name.endswith(('UpperLeg','LowerLeg','Foot','Toes')):
                strength = .21  # retain the contact timing of the source gait
            if prop=='location' and pb.name=='Root':
                dest[pb.name] = values  # root translation is part of the clip's gameplay contract
            else:
                dest[pb.name] = denoise(values,cycle,strength,rotate)
            if pb.name != 'Root' or rotate:
                curves[pb.name,prop] = channels

    def row(table,i):
        return {n:values[i] for n,values in table.items()}

    before = np.zeros(3)
    after = np.zeros(3)
    before_max = np.zeros(3)
    after_max = np.zeros(3)
    candidate = {n:list(values) for n,values in filtered_rot.items()}
    for i in range(duration):
        before_score = solver.score(solver.pose(row(old_rot,i),row(old_loc,i)))
        before += before_score
        before_max = np.maximum(before_max,before_score)
        angles, shifts = row(filtered_rot,i),row(filtered_loc,i)
        for name,q in solver.adjust(solver.pose(angles,shifts),angles).items():
            candidate[name][i] = q
    for name, values in candidate.items():
        original = filtered_rot[name]
        if not any(a is not b for a,b in zip(values,original)):
            continue
        corrections = [a.inverted() @ b for a,b in zip(original,values)]
        cycle = action.use_cyclic and abs(original[0].dot(original[-1]))>.99998
        corrections = denoise(corrections,cycle,.57,True)
        filtered_rot[name] = [(a@b).normalized() for a,b in zip(original,corrections)]

    for side in solver.sleeves:
        name = side+'SleeveFall'
        shift = [solver.sleeve_shift(solver.pose(row(filtered_rot,i),row(filtered_loc,i)),side)
                 for i in range(duration)]
        values = filtered_loc[name]
        cycle = action.use_cyclic and (values[0]-values[-1]).length<.0004
        smooth = denoise(shift,cycle,.62,False)
        filtered_loc[name] = [a+b for a,b in zip(values,smooth)]

    for i in range(duration):
        score = solver.score(solver.pose(row(filtered_rot,i),row(filtered_loc,i)))
        after += score
        after_max = np.maximum(after_max,score)

    def motion_metric(table):
        result = []
        for n, samples in table.items():
            if n.endswith(('UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot')) or n in TORSO+('Head','Neck'):
                velocities = [a.rotation_difference(b) for a,b in zip(samples,samples[1:])]
                result.extend(min(q.angle,2*pi-q.angle)**2 for q in
                              (a.rotation_difference(b) for a,b in zip(velocities,velocities[1:])))
        return sum(result),len(result)

    for (name,prop), channels in curves.items():
        out = (filtered_rot if prop=='rotation_quaternion' else filtered_loc)[name]
        raw = (old_rot if prop=='rotation_quaternion' else old_loc)[name]
        if all((abs(a.dot(b))>1-1e-7 if isinstance(a,Quaternion) else (a-b).length<1e-7) for a,b in zip(raw,out)):
            continue
        if prop=='rotation_quaternion':
            for i in range(1,len(out)):
                out[i].make_compatible(out[i-1])
        for idx,fc in enumerate(channels):
            fc.keyframe_points.clear()
            fc.keyframe_points.add(duration)
            fc.keyframe_points.foreach_set('co',np.column_stack((frames,[v[idx] for v in out])).astype('f').ravel())
            for key in fc.keyframe_points:
                key.interpolation = 'LINEAR'
            fc.update()
    return {'frames':duration, 'before':before.tolist(), 'after':after.tolist(), 'before_peak':before_max.tolist(),
            'after_peak':after_max.tolist(), 'angular_before':motion_metric(old_rot), 'angular_after':motion_metric(filtered_rot)}


def mesh_points(obj, depsgraph):
    mesh = obj.evaluated_get(depsgraph).data
    values = np.empty(3*len(mesh.vertices),dtype='f')
    mesh.vertices.foreach_get('co',values)
    return values.reshape(-1,3)


class SleeveContact:
    """Bake garment clearance against the evaluated outfit surfaces."""
    def __init__(self, rig):
        self.rig = rig
        self.samples = {}
        for side in SIDES:
            tag = side[0]+'_'
            hanging = bpy.data.objects.get(tag+'KimonoSleeve')
            sleeve = hanging or bpy.data.objects.get(tag+'RolledSleeve')
            if not sleeve or not bpy.data.objects.get('Backpack'):
                continue
            bone = side+('SleeveDrop' if hanging else 'SleeveFold')
            groups = {group.index for group in sleeve.vertex_groups
                      if group.name in (bone,side+'SleeveFall')}
            shares = np.array([sum(g.weight for g in v.groups if g.group in groups)
                               for v in sleeve.data.vertices],dtype='f')
            sleeve.data.calc_loop_triangles()
            faces = np.array([t.vertices[:] for t in sleeve.data.loop_triangles],dtype='i')
            faces = faces[(shares[faces] >= (.28 if hanging else .13)).all(axis=1)]
            ids, indices = np.unique(faces.ravel(),return_inverse=True)
            targets = ('Backpack','PleatedSkirt','Bodice') if hanging else ('Backpack',)
            self.samples[bone] = (sleeve, ids, indices.reshape(-1,3).tolist(),
                                  shares[ids,None], targets, side, bool(hanging))

    def bake(self, action):
        if not self.samples:
            return
        rig = self.rig
        data = rig.animation_data
        data.action = action
        bag = action.layers[0].strips[0].channelbag(data.action_slot)
        start,end = map(int,action.frame_range)
        frames = sorted(set(range(start,end+1,3))|{end}|{m.frame for m in action.pose_markers})
        offsets = {n:[] for n in self.samples}
        for name in self.samples:
            rig.pose.bones[name].location = ZERO
        scene = bpy.context.scene
        basis_chest = rig.data.bones['Chest'].matrix_local.to_quaternion().inverted()
        for frame in frames:
            scene.frame_set(frame)
            deps = bpy.context.evaluated_depsgraph_get()
            trees = {}
            chest = rig.pose.bones['Chest'].matrix.to_quaternion() @ basis_chest
            for name,(obj,ids,faces,shares,targets,side,hanging) in self.samples.items():
                for target in targets:
                    if target not in trees:
                        trees[target] = BVHTree.FromObject(bpy.data.objects[target],deps)
                positions = mesh_points(obj,deps)[ids]
                def overlaps(shift):
                    coords = positions+shares*np.array(shift,dtype='f')
                    tree = BVHTree.FromPolygons(coords.tolist(),faces,all_triangles=True)
                    return sum(len({p[0] for p in tree.overlap(trees[t])}) for t in targets)
                initial = overlaps(ZERO)
                best = (initial,ZERO)
                outward = X if side=='Left' else -X
                if initial>8:
                    for axis in (outward, -Y, (outward-Y).normalized(), (outward+Y).normalized()):
                        for distance in ((.024,.054,.084) if hanging else (.023,.046)):
                            move = chest@axis*distance
                            cost = overlaps(move)+2500*move.length_squared
                            if cost<best[0]:
                                best = (cost,move)
                # Ignore marginal changes and preserve shoulder attachment.
                chosen = best[1] if best[0]<initial*.88 else ZERO
                offsets[name].append(rig.pose.bones[name].matrix.to_quaternion().inverted()@chosen)
        all_frames = np.arange(start,end+1,dtype='f')
        for name,values in offsets.items():
            if action.use_cyclic:
                values[0] = values[-1] = (values[0]+values[-1])*.5
            values = np.asarray(values)
            motion = np.column_stack([np.interp(all_frames,frames,values[:,i]) for i in range(3)])
            for _ in range(2):
                if action.use_cyclic:
                    edge = np.vstack((motion[-2],motion,motion[1]))
                else:
                    edge = np.vstack((motion[0],motion,motion[-1]))
                motion = .25*edge[:-2]+.5*edge[1:-1]+.25*edge[2:]
            path = rig.pose.bones[name].path_from_id('location')
            for i in range(3):
                fc = bag.fcurves.find(path,index=i)
                if fc:
                    motion[:,i] += [fc.evaluate(f) for f in all_frames]
                else:
                    fc = bag.fcurves.new(path,index=i)
                fc.keyframe_points.clear()
                fc.keyframe_points.add(len(all_frames))
                fc.keyframe_points.foreach_set('co',np.column_stack((all_frames,motion[:,i])).astype('f').ravel())
                for key in fc.keyframe_points:
                    key.interpolation = 'LINEAR'
                fc.update()


def export_model(asset, source, output, nape):
    current = asset/(source.stem+'.glb')
    reference = glb_json(current)
    bpy.ops.object.select_all(action='DESELECT')
    names = {n['name'] for n in reference['nodes']} | {nape.name}
    for o in bpy.context.scene.objects:
        if o.name in names and not o.hide_viewport:
            o.select_set(True)
    result = bpy.ops.export_scene.gltf(filepath=str(output/current.name),use_selection=True,export_animation_mode='ACTIONS',
                                     export_frame_range=False,export_force_sampling=True,export_extras=True)
    assert result == {'FINISHED'}
    candidate = glb_json(output/current.name)
    for key in ('animations','nodes','meshes'):
        names = {n['name'] for n in reference[key]}
        if key != 'animations':
            names.add(nape.name)
        actual = {n['name'] for n in candidate[key]}
        assert names == actual,(key, names-actual,actual-names)
    assert len(reference['skins'])==len(candidate['skins'])


def run(hero, output, input_file=None):
    asset = Path.cwd()/'Drive/characters'/('chr_protagonist_'+hero)
    source = asset/'03b_blender'/(asset.name+'_03b_blender.blend')
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(input_file or source))
    bpy.context.preferences.filepaths.save_version = 0
    rig = bpy.data.objects['Humanoid']
    initial = rig.animation_data.action
    assert bpy.data.objects['Wardrobe']['outfit'] == 1, 'Save with the reference outfit active'
    scene = bpy.context.scene
    frame = scene.frame_current
    nape = add_nape(rig,hero)
    solver = Clearance(rig)
    measurements = {}
    for action in bpy.data.actions:
        if action.name.startswith('chr_'):
            measurements[action.name] = modify_action(rig,solver,action)
            print(hero,action.name,measurements[action.name],flush=True)
    cloth = SleeveContact(rig)
    for action in bpy.data.actions:
        if action.name.startswith('chr_'):
            cloth.bake(action)
    rig.animation_data.action = initial
    scene.frame_set(frame)
    (output/'motion.json').write_text(json.dumps(measurements,indent=2),encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(output/source.name),compress=True,relative_remap=False)
    export_model(asset,source,output,nape)


if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('hero', choices=('amemori_sumiha', 'roen', 'yeh_chengxi'))
    cli.add_argument('output', type=Path)
    cli.add_argument('--input', type=Path)
    args = cli.parse_args(sys.argv[sys.argv.index('--')+1:])
    run(args.hero, args.output.resolve(), args.input.resolve() if args.input else None)
