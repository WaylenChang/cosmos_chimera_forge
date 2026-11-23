---
name: agc-morph-bio-nature
description: >-
  Morphology guidelines for creatures fused with flora, fungi, minerals, shells,
  or terrain features. Activate when designing or reviewing botanical, rocky,
  crystalline, or ecological-camouflage creatures under agc-creature-design.
---

# Botanical, Mineral & Terrain Bio-Fusion (`bio-nature`)

Design rules for fusing plants, fungi, stones, crystals, corals, or shells into living anatomy. Global palette, stage, and pipeline invariants live in [agc-creature-design](../agc-creature-design/SKILL.md).

## Core Design Levers
- **Symbiotic Growth Seams**: Build organic transition zones—bark-to-hide ridges, moss collars, lichen speckles, or stepped mineral osteoderms—so flora/rock reads as grown rather than glued on.
- **Dorsal & Distal Placement**: Grow heavy bulbs, canopies, crystal clusters, or boulders on low-deformation zones (skull crown, dorsal shell, shoulder hump, tail tip); keep belly and limb flexures supple.
- **Ecological Storytelling**: Tie attachment form to survival function (petal lure on tail, root-claw anchors, geothermal crystal vents, bioluminescent mushroom cap).
- **Stage Bloom Progression**: Seed/sprout/pebble (`juvenile`) → bud/sapling/ore-crust (`adolescent`) → full blossom/canopy/geode armor (`adult`) → spore-burst or crystalline spire overdrive (`overload`).

## 3D / 2D Structural Spec
- **Empirical Baseline**: Second-largest fusion category (23.2% prevalence); median **3.0 materials**, **41 nodes**, **~6,201 tris**, **low emissive (5.4%)**, highest mean color saturation (`0.346`), solid silhouette fill (`0.570`).
- **Leaf vs Mineral Topology**: Use double-sided alpha-cutout cards (`alphaMode: MASK`) sparingly for thin petals/fronds/vines; model mineral plates and crystals as crisp low-poly faceted chunks sharing the body atlas to control draw calls.
- **Roughness Contrast**: Separate wet/waxy petals and glossy crystals (roughness `0.15–0.35`) from matte bark, soil, and hide (`0.75–0.95`).

## Hybrid Mixing Rules
- **As Primary**: Controls body massing, terrain camouflage, and natural shell/canopy silhouette; pairs frequently with `bio-element` (magma rock, frost fern) and `bio-artifact` (petal cloak, bone-and-stone armor).
- **As Secondary**: Adds **1** ecological crest/collar/tail bloom or mineral armor ridge onto a beast or construct; keep canopy radius compact enough to clear melee camera framing.

## Failure Modes (Don'ts)
- **Potted-Plant Look**: Sticking a literal tree or crystal cylinder perpendicularly onto a smooth animal back with no root/skin transition.
- **Over-Dense Foliage Cards**: Using dozens of overlapping transparent leaf planes that cause alpha-sorting artifacts and high overdraw.
- **Joint-Locking Rocks**: Placing rigid stone slabs directly across knee, ankle, or spine-bend regions.
