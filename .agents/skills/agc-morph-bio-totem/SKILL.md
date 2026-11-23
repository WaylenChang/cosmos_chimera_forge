---
name: agc-morph-bio-totem
description: >-
  Morphology guidelines for creatures fused with cultural totems, mythic motifs,
  masks, or ritual ornaments. Activate when designing or reviewing myth-inspired,
  symbolic, or ceremonial creatures under agc-creature-design.
---

# Cultural Totem & Mythic Motif Fusion (`bio-totem`)

Design rules for translating cultural symbols, mythic archetypes, and ritual artifacts into original, abstracted creature silhouettes. Global palette, stage, and pipeline invariants live in [agc-creature-design](../agc-creature-design/SKILL.md).

## Core Design Levers
- **Abstract Geometry, Don't Transcribe**: Convert historical ornaments (halos, masks, bells, drums, knotwork, carved stone reliefs) into bold, readable geometric shapes rather than miniature realistic carvings.
- **Ceremonial Symmetry Anchor**: Establish authority through upright/monumental posture, twin flanking ornaments (drum rings, floating talismans, symmetric horns), or an oversized masked face plate.
- **Storytelling Through Negative Space**: Use floating rings, suspended sigils, or pierced stone halos around the head/shoulders to expand silhouette grandeur without bloating torso mass.
- **Sensitivity Gate**: Any motif drawn from living sacred traditions, deities, or ceremonial dress **must** be abstracted beyond literal replication and marked `sensitivity: review` in the brief.

## 3D / 2D Structural Spec
- **Empirical Baseline**: Upright, high-ornament silhouette (tallest median 2D aspect `1.13`, fill `0.608`); elevated **emissive (34.8%)**, **alpha (69.6%)**, and **metallic (78.3%)** usage; ~`9.7k` tris median.
- **Surface Hierarchy**: Keep large stone/lacquer/ceramic plains clean (`60%` base) so high-contrast rune lines or gilt trims (`10%` emissive/metallic accent) read cleanly at game-camera distance.
- **Floating Nodes**: Rig detached halos, masks, or rotating sigil rings to dedicated offset root/head bones with independent idle bob/spin tracks rather than baking them static into torso skinning.

## Hybrid Mixing Rules
- **As Primary**: Dictates monumental posture, mask/crest geometry, and sacred material palette (jade, bronze, obsidian, porcelain); pairs effectively with `bio-element` (elemental halos/runes) or `amorphous-astral` (spirit vessels).
- **As Secondary**: Contributes **1** iconic ritual anchor (carved face mask, floating ring behind shoulders, glyph markings on hide) to a beast or humanoid warrior.

## Failure Modes (Don'ts)
- **Stereotype Collage**: Pasting literal religious icons, national flags, or unabstracted sacred script directly onto a generic beast.
- **Micro-Pattern Noise**: Covering the body in dense tiny filigree lines that shimmer into gray mud on 2D thumbnails and 2048px textures.
- **Missing Sensitivity Flag**: Introducing recognizable deity/ritual aesthetics without setting `sensitivity: review`.
