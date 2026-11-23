---
name: agc-morph-bio-artifact
description: >-
  Morphology guidelines for creatures fused with costumes, armor, gear, or
  handheld props. Activate when designing or reviewing clothed, armed, or
  equipment-bearing creatures under agc-creature-design.
---

# Costume, Gear & Artifact Bio-Fusion (`bio-artifact`)

Design rules for integrating garments, armor, tools, and held props into creature silhouettes. Global palette, stage, and pipeline invariants live in [agc-creature-design](../agc-creature-design/SKILL.md).

## Core Design Levers
- **Biological Origin Over Human Tailoring**: Derive hats, cloaks, skirts, or armor from anatomical equivalents (mushroom cap hat, shed-scale haori, hardened chitin pauldrons, leaf-woven mantle) unless the concept is explicitly `humanoid-bio`.
- **Upper/Lower Readability Split**: Pair one bold headgear/collar frame (wide brim, helm crest, scarf) with either a flowing lower drape (cloak/skirt) OR an iconic held prop—never stack heavy headgear + full cape + oversized dual weapons simultaneously.
- **Role-Telegraphing Prop**: Let held gear (`sword`, `lantern`, `bell`, `shield`, `staff`) dictate combat stance (`ai_style`: `charge`, `hold`, `keep_distance`) and silhouette asymmetry.
- **Material Separation**: Contrast soft cloth/fur roughness (`0.7–0.9`) against brushed metal or lacquered armor (`metallic > 0.5`, roughness `0.2–0.4`).

## 3D / 2D Structural Spec
- **Empirical Baseline**: Highest structural complexity across corpora (15.0% prevalence); median **6.0 materials**, **81.5 nodes**, **~10,388 tris**, **62.9% alpha**, **58.2% metallic**, highest high-saturation accent share (`0.067`).
- **Rig & Cloth Clearance**: Budget separate bone chains (`cloak_*`, `skirt_*`, `hat_*`, `ribbon_*`) with explicit pivot sockets; keep sleeve cuffs, armor skirts, and pauldrons clear of armpit/pelvis bind zones.
- **Turnaround Requirement**: Concept turnarounds must show removable/lifted cape or cloak layers so back anatomy and waist topology remain visible for 3D modeling.

## Hybrid Mixing Rules
- **As Primary**: Owns upright/semi-upright silhouette, garment/armor proportions, and weapon socket; pairs strongly with `bio-element` (elemental blade/cloak trim) and `bio-nature` (petal dress, stone armor).
- **As Secondary**: Adds **1–2** signature accessories (headgear, scarf, gauntlet, hip charm) onto a natural/chimeric beast without converting its quadruped/avian rig into a humanoid cloth doll.

## Failure Modes (Don'ts)
- **Cosplay Mascot Trap**: Dressing a generic animal in modern human clothes with zippers/buttons unrelated to its ecology or era.
- **Rig Explosion**: Adding >4 overlapping cloth/ribbon chains plus multi-part handheld gear that clip during `walk`/`run`/`roll_dodge`.
- **Unmodeled Backside**: Hiding the entire spine behind an opaque cape with no back-layer geometry reference.
