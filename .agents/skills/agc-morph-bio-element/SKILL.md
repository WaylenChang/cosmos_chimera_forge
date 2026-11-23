---
name: agc-morph-bio-element
description: >-
  Morphology guidelines for elemental bio-fusion creatures (fire, water, ice,
  thunder, wind, light, shadow, poison). Activate when designing or reviewing
  elemental organs, aura vents, or elemental hybrid variants under agc-creature-design.
---

# Elemental Bio-Fusion (`bio-element`)

Design rules for fusing elemental matter or energy directly into living anatomy. Global palette, stage, and pipeline invariants live in [agc-creature-design](../agc-creature-design/SKILL.md).

## Core Design Levers
- **Anchor Element to Specialized Organs**: Bind elemental mass to 1–2 functional biological sites (tail exhaust, dorsal fins, cheek capacitors, mane/crown vents, forearm gauntlets)—never paint an ordinary beast a flat element color.
- **Dual-State Material Contrast**: Pair matte/soft organic tissue (fur, scales, chitin) with sharp refractive, fluid, or glowing elemental structures (crystalline frost, ember vents, plasma arcs).
- **Phase-Driven Silhouette**: Use element behavior to break contour symmetry—upward licking plumes (fire/wind), downward dripping/draped fins (water/poison), or jagged radial spikes (thunder/ice).
- **Stage Escalation**: Shift from contained sparks/buds (`juvenile`) to externalized organs (`adolescent`/`adult`) to detached orbiting or overflowing fields (`overload`).

## 3D / 2D Structural Spec
- **Empirical Baseline**: Most prevalent morphology (43.9% of corpus); median **3.0 materials**, **44 nodes**, **~6,570 tris**, **18.9% emissive**, **48.5% alpha**, high-saturation accents (`0.045`).
- **Emissive & Alpha Discipline**: Keep emissive masks inside the **10% accent** area (core vents, eyes, crest tips) so bloom never washes out facial readability. Use alpha-masked cards (`alphaMode: MASK/BLEND`) only for outer wisps/fins/sparks, keeping a solid inner mesh core for crisp 3D shadows.
- **Rigging**: Give trailing elemental manes/tails dedicated 3–5 bone spring chains (`flame_*`, `aura_*`); keep VFX emitters off shoulder/knee skinning seams.

## Hybrid Mixing Rules
- **As Primary**: Drives body proportions, elemental locomotion (gliding vents, magma treads), and core organ shape; pairs cleanly with `bio-nature` (volcanic stone, frost bark) or `bio-artifact` (elemental blade/cloak).
- **As Secondary**: Occupies **<= 30%** of silhouette via distal vents (tail tip, collar plume, horn glow, eye/chest core) and supplies the **10% accent** color without altering the primary rig.

## Failure Modes (Don'ts)
- **Palette Swap Syndrome**: Recoloring a base animal red/blue with zero anatomical elemental organ changes.
- **Whole-Body Neon Bloom**: Applying high emissive factor across >25% of the mesh, destroying form depth and 2D/3D lighting separation.
- **Joint-Clipping VFX**: Growing rigid ice crystals or rigid magma plates directly across elbow, wrist, or hip deformation loops.
