---
name: agc-morph-amorphous-astral
description: >-
  Morphology guidelines for slimes, wisps, ghosts, plasma, and cosmic/void
  beings lacking fixed skeletal limbs. Activate when designing or reviewing
  fluid, gaseous, phantom, or astral creatures under agc-creature-design.
---

# Amorphous, Ethereal & Cosmic Entities (`amorphous-astral`)

Design rules for creatures built from fluid mass, vapor, ectoplasm, shadow, or celestial energy rather than rigid skeletons. Global palette, stage, and pipeline invariants live in [agc-creature-design](../agc-creature-design/SKILL.md).

## Core Design Levers
- **Hard Focal Core vs Soft Perimeter**: Anchor every amorphous form with **1–2 crisp high-contrast solids** (glowing eyes, floating bone/crystal core, mask, ribbon knot) surrounded by soft, flowing energy/slime edges.
- **Directional Flow Lines**: Sculpt vapor, cloak wisps, or slime tendrils along clear S-curves or rising/sweeping silhouettes (avoid symmetrical round blobs or random cloud puffs).
- **Negative-Space Framing**: Use hollow loops, floating orbital rings, or translucent outer membranes revealing internal stars/cores to create depth without heavy limb count.
- **Volume-Preserving Deformation**: Emphasize squash-and-stretch, splitting droplets, or phase-shifting trails during locomotion and attacks.

## 3D / 2D Structural Spec
- **Empirical Baseline**: Low bone/tri footprint (**29 nodes**, **~4,732 tris**), lowest silhouette fill (`0.502`), tall/floating proportions (`aspect_2d: 1.04`), strong reliance on translucency and emissive cores.
- **Shader & Blend Architecture**: Use `amorphous` anatomy strategy—combine solid core geometry + Fresnel/scroll-UV outer shells or `BLEND`/`MASK` wispy tendrils; keep transparent layers sorted cleanly (max 1–2 nested alpha shells to avoid Z-fighting).
- **Rigging Strategy**: Drive organic ooze/wisp squash-and-stretch with **shape keys (blendshapes)** and animated material UV offsets, plus minimal floating-bone anchors for orbiting cores or trailing tails.

## Hybrid Mixing Rules
- **As Primary**: Owns core-and-aura architecture, floating hover stance, and shader-driven silhouette; pairs strongly with `bio-element` (plasma/frost/shadow wisp), `bio-totem` (sealed spirit/mask), and `inanimate-biomimic` (haunted lantern/urn).
- **As Secondary**: Replaces distal extremities (smoke-tail, starry mantle, translucent slime collar, ghostly lower body) on an otherwise grounded biological or artifact chassis.

## Failure Modes (Don'ts)
- **Featureless Blob**: Designing a soft puddle or smoke cloud with no solid focal core or directional silhouette hook.
- **Alpha-Overdraw Soup**: Stacking 4+ translucent smoke layers that flicker in WebGL/Unity mobile renderers and blur into gray noise.
- **Rigid Stick Animation**: Animating an ethereal wisp with stiff bipedal walk cycles instead of hover, drift, and fluid squash-stretch.
