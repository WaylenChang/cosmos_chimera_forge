---
name: agc-morph-pure-stylized-bio
description: >-
  Morphology guidelines for clean, stylized biological creatures whose appeal
  comes from shape language, proportion exaggeration, and ecological behavior
  rather than external fusion attachments. Activate under agc-creature-design.
---

# Stylized Pure-Bio Archetypes (`pure-stylized-bio`)

Design rules for foundational biological creatures (mammals, birds, reptiles, fish, arthropods) driven purely by expressive silhouette exaggeration and ecological charm. Global palette, stage, and pipeline invariants live in [agc-creature-design](../agc-creature-design/SKILL.md).

## Core Design Levers
- **Shape-Language Compression**: Distill real anatomy into 2–3 bold primitive volumes (circle = friendly/roly-poly, triangle = agile/predatory, square = sturdy/tanky) rather than realistic muscle-by-muscle modeling.
- **Signature Proportion Push**: Exaggerate **exactly 1–2 biological features**—oversized wool fleece, sweeping ears, plump cheeks, armored tail club, elongated crest feathers—until the 100% black silhouette is unmistakable.
- **Micro-Behavioral Hook**: Bake ecology or personality directly into posture and silhouette (slumped drowsy shoulders, curled defensive ball, puffed vocal sac, alert tripod tail-stand).
- **Roster Balance Function**: Serve as approachable early-biome fauna and clean silhouettes that give visual breathing room beside high-complexity `bio-artifact` / `multi-bio` elites.

## 3D / 2D Structural Spec
- **Empirical Baseline**: Second-largest group (25.7% of corpus); leanest biological rig & shader footprint—median **3.0 materials**, **32 nodes**, **~5,163 tris**, minimal **emissive (4.4%)**, low **alpha (25.4%)**, clean silhouette fill (`0.509`), restrained high-saturation share (`0.006`).
- **Topology & Material Economy**: Target **<= 3 body materials** (body, markings/fur-ruff, eyes/mouth). Avoid unnecessary alpha cards—use sculpted tufts, rounded ear shells, and crisp UV patterns for clean cel/stylized shading.
- **Expression First**: Reserve silhouette/polygon budget for expressive eyes, brow ridges, ear pivots, and squashy cheeks/tails that shine in `idle_long` and `pet_*` interactions.

## Hybrid Mixing Rules
- **Solo Default**: Strongest when deployed standalone (`1` tag) to establish crisp, memorable early-stage or mascot creatures.
- **With Light Secondary**: Can accept **1** minimal accent from `bio-nature` (single berry/leaf tuft) or `bio-element` (static spark cheek/flame tail tip) at **<= 15% volume**, keeping its lean 3-material budget intact.

## Failure Modes (Don'ts)
- **National-Geographic Realism**: Copying realistic animal proportions and fur noise without stylized shape simplification.
- **Over-Accessorizing**: Piling hats, elemental halos, and rune belts onto a pure-bio design until its core biological charm disappears.
- **Zero Focal Exaggeration**: Leaving ears, limbs, and tail at uniform realistic scale so the silhouette merges with generic background wildlife.
