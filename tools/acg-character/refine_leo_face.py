"""Refine the latest editable Leo and export reference face meshes for GLB transfer.

Run in Blender on the accepted motion .blend, with the output directory after --.
"""
from pathlib import Path
from math import exp
import sys
import bpy

out = Path(sys.argv[-1]).resolve()
face = bpy.data.objects['Leo • face and speech']
rig = face.find_armature()
def face_export(name):
    bpy.ops.object.select_all(action='DESELECT')
    face.select_set(True)
    rig.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out/name),use_selection=True,export_animations=False,
                              export_morph=True,export_morph_normal=True)

face_export('reference-face.glb')
def smooth(x):
    t = max(0, min(1, x))
    return t*t*(3-2*t)

# Compress the projecting bridge and lobule, tapering into the unchanged alar grooves.
# Use the same offsets throughout the speech and expression targets.
basis = face.data.shape_keys.reference_key
offsets = []
for v in basis.data:
    x,y,z = v.co
    locality = smooth((.032-abs(x))/.017)*smooth((z-1.62)/.020)*smooth((1.701-z)/.023)
    prominence = max(0,-y-.089)
    dy = .50*prominence*locality*smooth(prominence/.013)
    dx = .14*x*exp(-((z-1.653)/.011)**2-(x/.019)**2)*smooth(prominence/.015)
    offsets.append((dx,dy))
for key in face.data.shape_keys.key_blocks:
    for v,(dx,dy) in zip(key.data,offsets):
        v.co.x += dx
        v.co.y += dy
face.data.update()

# Workbench material colour ignores the portrait atlas. Display textured solid shading on open.
for material in face.data.materials:
    for node in material.node_tree.nodes:
        if node.type=='TEX_IMAGE' and node.image:
            material.node_tree.nodes.active=node
            material.diffuse_color=bpy.data.materials['Warm brown skin'].diffuse_color
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            shading=area.spaces.active.shading
            if shading.type=='SOLID':
                shading.color_type='TEXTURE'
bpy.context.scene.display.shading.color_type='TEXTURE'
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(out/'leo_face_v11.blend'),compress=True)
face_export('edited-face.glb')
print('Maximum nose setback (mm)',max(y for x,y in offsets)*1000)
