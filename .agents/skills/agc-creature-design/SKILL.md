---
name: agc-creature-design
description: >-
  Master SSOT router and hybrid design specification for original AGC creatures.
  Use when designing, reviewing, or refactoring original creature concepts,
  evolution lines, or 2D-to-3D production briefs, and route 1 primary plus up to
  2 secondary morphology sub-skills from the agc-morph-* suite.
---

# AGC Creature Design (Master SSOT Router)

Single Source of Truth for designing original, production-ready AGC creatures across 2D concept art and 3D topology/rigging. Select **one Base Entity**, route **one Primary + 0–2 Secondary morphology sub-skills**, and enforce the global laws below without repeating them in sub-skills.

---

## 1. Base Entity Axis & Anatomy Mapping

Every creature concept begins with one **Base Entity** and one authoritative **Anatomy/Rig Profile** (`anatomy-profiles.js` contract):

| Base Entity | Concept Scope | Default Anatomy Candidates | Rig Strategy |
|---|---|---|---|
| `natural-bio` | Stylized fauna, beast, avian, reptile, aquatic, arthropod | `quadruped`, `avian`, `winged_quadruped`, `aquatic`, `serpentine`, `hexapod`, `octopod`, `tentacled` | Skeletal skinning aligned to biological locomotion |
| `humanoid-bio` | Upright bipedal, demi-human, martial/masked performer | `biped`, `winged_biped` | Biped skinning + secondary chains (hair/cloth/cape) |
| `supernatural-bio` | Mythic beasts, spirits, astral/void lifeforms, chimeras | `winged_quadruped`, `winged_biped`, `serpentine`, `amorphous`, `hybrid` | Multi-chain / shape-key / custom landmark rig |
| `non-bio` | Living artifacts, automata, mineral/clockwork constructs | `object`, `mechanism`, `humanoid_mecha`, `quadruped_mecha`, `multi_leg_mecha` | Rigid parts with explicit pivots or constrained joints |

> If cross-taxa limbs or mechanical + organic parts coexist, declare explicit `anatomy` (or `hybrid` with manual landmark verification) rather than forcing a standard biped rig.

---

## 2. Morphology Routing Table (8 Sub-Skills)

Route to the relevant sub-skill(s) below. Load **only** the selected sub-skill `SKILL.md` files needed for the active creature brief.

| Tag ID | Sub-Skill | Core Morphology Role | High-Synergy Pairings |
|---|---|---|---|
| `bio-element` | [agc-morph-bio-element](../agc-morph-bio-element/SKILL.md) | Elemental organs, aura vents, phase-state limbs | `bio-artifact`, `bio-nature`, `amorphous-astral` |
| `bio-nature` | [agc-morph-bio-nature](../agc-morph-bio-nature/SKILL.md) | Flora symbiosis, crystal/rock shells, ecological camo | `bio-element`, `bio-artifact`, `pure-stylized-bio` |
| `bio-artifact` | [agc-morph-bio-artifact](../agc-morph-bio-artifact/SKILL.md) | Costumes, armor plating, held props, tactical gear | `bio-element`, `bio-nature`, `bio-totem` |
| `bio-totem` | [agc-morph-bio-totem](../agc-morph-bio-totem/SKILL.md) | Abstracted cultural emblems, ritual masks, glyph rings | `bio-element`, `bio-artifact`, `amorphous-astral` |
| `multi-bio` | [agc-morph-multi-bio](../agc-morph-multi-bio/SKILL.md) | Cross-taxa chimeras (2–3 biological clades merged) | `bio-element`, `bio-nature`, `bio-totem` |
| `inanimate-biomimic` | [agc-morph-inanimate-biomimic](../agc-morph-inanimate-biomimic/SKILL.md) | Living tools, vessels, dolls, clockwork/mineral mimics | `bio-element`, `bio-nature`, `amorphous-astral` |
| `amorphous-astral` | [agc-morph-amorphous-astral](../agc-morph-amorphous-astral/SKILL.md) | Slime, vapor, wisp, astral/cosmic/void silhouettes | `bio-element`, `bio-totem`, `inanimate-biomimic` |
| `pure-stylized-bio` | [agc-morph-pure-stylized-bio](../agc-morph-pure-stylized-bio/SKILL.md) | Pure-silhouette exaggeration without external fusion | Solo anchor (or light `bio-nature` ecological cue) |

---

## 3. Multi-Tag Hybrid Mixing Protocol

Empirical corpus telemetry (1,324 reference creatures) shows **99.9%** of successful designs use **1–3 tags** (78.5% single-tag, 19.1% two-tag, 2.3% three-tag). Never exceed 3 tags.

1. **Volume & Silhouette Budget**:
   - **Primary Tag (1 required)**: Owns **60–70%** of macro silhouette, base anatomy, and primary locomotion rig.
   - **Secondary Tag(s) (0–2 max)**: Own **30–40%** combined—restricted to focal zones (headgear, dorsal crest, tail tip, collar, held prop, or surface shader accents).
2. **Conflict Arbitration Rules**:
   - **Skeleton First**: Primary tag owns the spine and root joint hierarchy; secondary attachments bind only to distal sockets or non-deforming plates (never cover shoulder/hip/knee hinges).
   - **Material Cap**: Merge secondary surface accents into **<= 4 body PBR material groups** (excluding facial eye/mouth flipbook slots).
   - **Focal Budget**: At most **2** high-detail silhouette protrusions (e.g., horned crown + elemental tail) so secondary traits do not fight each other.
   - **Palette Lock**: Secondary tags must pull from the **30% Theme** or **10% Accent** slots of the single 60-30-10 palette—never introduce a second independent color scheme.

---

## 4. Global AGC Quality Laws (SSOT)

Sub-skills assume these global invariants and **must not** repeat them:

1. **3-Second Silhouette Rule**: At 100% black fill (`alpha > 0`), the creature must remain identifiable within 3 seconds via macro torso/head proportion plus 1–2 distinct directional protrusions. Keep 2D silhouette fill ratio roughly `0.45–0.65` (avoid solid featureless blobs or fragmented noise).
2. **60-30-10 Color Budget**:
   - `60%` Dominant base tone (low/medium saturation fur, hide, hull, or garment base).
   - `30%` Secondary theme tone (elemental organ, floral mantle, armor trim, or pattern mask).
   - `10%` High-contrast focal accent (eyes/iris, emissive core, crest jewel, weapon edge).
3. **4-Stage Progression Scaling** (`juvenile` → `adolescent` → `adult` → `overload`, matching `Data/schemas/creature.schema.json`):
   - `juvenile` (XS/S): Rounded head-heavy ratio (`1:2`–`1:2.5`), simplified secondary tag hint (bud/spark/collar).
   - `adolescent` (S/M): Lengthened limbs, secondary tag becomes functional organ/gear.
   - `adult` (M/L): Full silhouette span, mature seam transitions, crisp 60-30-10 hierarchy.
   - `overload` (L/XL, `overload_of` adult): Dramatic silhouette expansion (floating rings, unleashed element, unfolded wings/armor) + emissive overdrive without breaking base rig.
4. **2D-to-3D Production Gates**:
   - **2D Concept**: Supply neutral-lit front/3/4 orthographic clarity (`#6B7280`/`#9CA3AF` neutral backdrop) and unoccluded dorsal/joint views (lift capes, wings, or foliage collars in turnaround).
   - **3D Budget**: Target `4k–12k` tris for compact/stylized creatures (`pure-stylized-bio`, `inanimate-biomimic`) and up to `12k–25k` tris for multi-chain `bio-artifact` / `bio-totem` / `multi-bio` rigs; keep rig nodes clean and reserve `alphaMode` (`BLEND`/`MASK`) strictly for hair/feathers/flames/veils.
5. **Originality & Compliance Redlines**:
   - Never copy iconic silhouettes, color-blocked spherical capture-device motifs, or named assets from any existing commercial IP.
   - Sacred, ceremonial, or culturally specific motifs (`bio-totem`) must abstract geometry and set `concept.sensitivity: "review"` for human sign-off.

---

## 5. Actionable Design Brief Output Contract

When generating or reviewing an AGC creature concept, always emit this compact spec block before drafting prompts or JSON:

```yaml
creature_brief:
  base_entity: natural-bio | humanoid-bio | supernatural-bio | non-bio
  primary_tag: <agc-morph-*>
  secondary_tags: [<agc-morph-*>] # 0 to 2 items
  anatomy: <anatomy-profiles.js key>
  stage: juvenile | adolescent | adult | overload
  size_class: XS | S | M | L | XL
  silhouette_hook: "<macro shape + 1-2 directional protrusions>"
  palette_60_30_10:
    dominant_60: "<color + material>"
    secondary_30: "<color + material>"
    accent_10: "<color + emissive/eye focal>"
  fusion_seams: "<how primary & secondary materials/organs meet without clipping joints>"
  shader_rig_flags:
    emissive: true | false
    alpha_cards: true | false
    metallic: true | false
    extra_bone_chains: ["<e.g. cape, tail, flame_crest>"]
  stage_delta: "<concrete visual change vs previous stage>"
  sensitivity: null | review
```
