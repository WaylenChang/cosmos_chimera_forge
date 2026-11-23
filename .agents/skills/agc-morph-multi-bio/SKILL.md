---
name: agc-morph-multi-bio
description: >-
  Morphology guidelines for chimeric creatures merging traits from two or more
  distinct biological taxa. Activate when designing or reviewing multi-species
  hybrids, mythical chimeras, or cross-clade beasts under agc-creature-design.
---

# Chimeric Multi-Bio Fusion (`multi-bio`)

Design rules for synthesizing multiple animal/biological clades into one anatomically coherent creature. Global palette, stage, and pipeline invariants live in [agc-creature-design](../agc-creature-design/SKILL.md).

## Core Design Levers
- **Strict 2–3 Taxa Cap**: Combine **1 Primary Chassis** (e.g., feline, canid, reptile, insectoid) with **1–2 Donor Features** (e.g., raptor wings + scorpion stinger). Exceeding 3 taxa destroys silhouette memory.
- **Dominant Skeleton Ownership**: Let the Primary Chassis dictate spine curvature, center of gravity, and gait; graft donor limbs/organs cleanly onto existing girdle sockets (scapula for wings, sacrum for secondary tail).
- **Morphological Bridge Seam**: Blend transitions with intermediate anatomy—shoulder feather-ruffs merging into fur, scaled collars fading into chitin plates, or shared horn/claw keratin material.
- **Unified Surface Rhythm**: Carry one unifying pattern or texture language across both clades so the creature looks evolved rather than stitched together.

## 3D / 2D Structural Spec
- **Empirical Baseline**: Densest silhouette fill (`0.645`), high mesh/material complexity (**~10,338 tris**, **47+ nodes**, **78.9% alpha**, **42.1% emissive** when paired with supernatural elements).
- **Anatomy & Rig Declaration**: Multi-limb chimeras (`winged_quadruped`, `winged_biped`, or extra appendages) must declare explicit limb counts and `anatomy: hybrid` (or specific winged rig) per `anatomy-profiles.js`; never rely on default biped auto-rigging.
- **Wing & Tail Clearance**: Ensure folded/resting wings and extra tails do not intersect hind legs during `idle`, `walk`, or `pet_*` animations.

## Hybrid Mixing Rules
- **As Primary**: Owns the biological fusion architecture and base locomotion; pairs best with `bio-element` (elemental breath/stinger/wings), `bio-totem` (mythic guardian framing), or `bio-nature` (moss/coral hide).
- **As Secondary**: Injects **1** unmistakable cross-clade trait (e.g., bat wings on a feline, cephalopod tentacles on an armored crustacean) into an elemental or totem design.

## Failure Modes (Don'ts)
- **Frankenstein Kitbash**: Gluing 4+ unrelated animal heads/limbs onto one torso with abrupt color and texture seams.
- **Zero-Graft Floating Limbs**: Attaching wings or extra arms without clavicle/scapula musculature or carapace anchorage.
- **Silhouette Muddle**: Overlapping wings, tails, horns, and tentacles into an unreadable dark blob (`fill_ratio > 0.72`).
