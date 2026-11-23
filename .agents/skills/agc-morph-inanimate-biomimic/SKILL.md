---
name: agc-morph-inanimate-biomimic
description: >-
  Morphology guidelines for living objects, automata, clockwork mimics, and
  mineral/artifact entities exhibiting lifelike traits. Activate when designing
  or reviewing non-bio mimics or animated constructs under agc-creature-design.
---

# Inanimate Biomimicry & Living Objects (`inanimate-biomimic`)

Design rules for turning everyday vessels, tools, instruments, confections, or mechanical constructs into expressive, living AGC creatures. Global palette, stage, and pipeline invariants live in [agc-creature-design](../agc-creature-design/SKILL.md).

## Core Design Levers
- **Recognizable Geometric Archetype**: Preserve the core object's iconic silhouette (sphere, bell, lantern, teapot, anchor, gear-cluster, sword-hilt) so players read *what it mimics* in under 1 second.
- **Minimalist Sentience Anchors**: Express life through **1–2** restrained bio cues—an integrated eye slit/lens, articulated hinge-jaw, floating appendage handles, or rhythmic bobbing posture—instead of slapping cartoon arms and faces everywhere.
- **Object-Logic Locomotion**: Match movement to construction—rolling/bouncing for orbs, hopping/tip-toeing on rim legs for vessels, magnetic levitation for gears/blades, or piston-driven gait for mecha.
- **True Material Authenticity**: Commit to ceramic glaze, weathered brass, cast iron, glass, or frosted pastry PBR values rather than skin-like plastic.

## 3D / 2D Structural Spec
- **Empirical Baseline**: Leanest structural footprint across corpora (4.0% prevalence); median **3.0 materials**, **17 nodes**, **~3,676 tris**, muted base saturation (`0.255`, high-sat `0.002`).
- **Rigid-Pivot Hierarchy**: Declare `anatomy` as `object`, `mechanism`, `humanoid_mecha`, `quadruped_mecha`, or `multi_leg_mecha`. Separate rigid moving parts (lids, gears, shields, floating rings) into discrete child nodes with explicit pivot origins; avoid soft-skinning rigid metal plates.
- **Facial UV / Emissive Eyes**: When rigid shells lack deformable eyelids, use UV-offset eye slots or emissive visor textures for expressions.

## Hybrid Mixing Rules
- **As Primary**: Owns rigid core geometry, mechanical/object pivots, and non-bio material identity; pairs naturally with `bio-element` (furnace core, electric coil), `bio-nature` (overgrown ruin golem, mossy bell), or `amorphous-astral` (possessed/haunted vessel).
- **As Secondary**: Contributes rigid shell/gear/mirror/lantern modules embedded into a biological host (e.g., clockwork carapace, bell-tail).

## Failure Modes (Don'ts)
- **Sticker-Face Object**: Drawing generic anime eyes and a mouth onto an unmodified household item with zero structural re-proportioning.
- **Rubber-Metal Deformation**: Soft-weight-painting steel gears or stone slabs onto an organic spine so rigid parts bend like jelly.
- **Cluttered Micro-Greebles**: Overloading small constructs with unreadable screws and wires that blow past the ~4k–8k tri target.
