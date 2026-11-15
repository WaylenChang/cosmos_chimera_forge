# Kind-first pipeline migration audit (2026-11-15)

## Verified current state
Google Drive root ID: `1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0`.
Top-level subject folders: `characters`, `creatures`, `moves`.
Shared `prompts/` contains legacy stage templates; `characters/02_3d` and `creatures/02_3d` contain `colab`, `ai_blender`, and `legacy`.
`AGENT_QUICKSTART.md` already documents the two parallel 3D routes; no correction is needed there.

## Canonical structure
All asset-specific read/write paths MUST begin with `<kind>/`, where kind is one of `characters`, `creatures`, `moves`. Under each kind, keep the existing production stage folders until the runtime and Drive have migrated together:
- `<kind>/01_portraits/<asset_id>/...`
- `<kind>/02_3d/colab/<asset_id>/...` (Colab + AI + Blender)
- `<kind>/02_3d/ai_blender/<asset_id>/...` (AI + Blender)
- `moves/01_vfx/<asset_id>/...`
Do not introduce an additional `pipelines/` nesting layer without updating all readers and writers first.
- `<kind>/wiki/<subject_id>[_<stage>]_wiki.md`
- `<kind>/reviews/<asset_id>.json`
- `<kind>/prompts/jobs/...`

Pipeline IDs must be defined centrally and independently of UI labels. Character/creature 3D branches: `colab_ai_blender` and `ai_blender`; both support the appropriate image/text input modes, and Prompt-to-3D must produce the post-model portrait before final acceptance. Moves use their own VFX pipeline. The wiki is an output, not a pipeline branch.

## Required migration safeguards
1. Inventory all Drive folder IDs and assets recursively; retain Drive IDs on moves.
2. Map each legacy output to one canonical target by kind, branch, asset ID, and evolution stage; reject ambiguous matches.
3. Scan `drive-storage.js`, `forge.js`, `catalog.js`, `model-review.js`, docs, tests, and workflow scripts for path literals and folder IDs.
4. Change resolvers and writers before moving Drive files. Support legacy read-only fallback during transition, but never write to legacy paths.
5. Move only verified assets; retain backup and migration manifest with source ID, destination ID, hash/size, and status.
6. Preserve existing wiki files and deduplicate by subject + stage; never overwrite approved work.
7. Test each kind and each pipeline branch for discovery, review, generation, cache invalidation, and idempotence.
8. Only retire legacy routes after CI and Drive readback pass.

## Verified correction
`docs/drive/AGENT_QUICKSTART.md` already correctly documents the two parallel 3D routes; the earlier initial audit mistakenly described this guardrail as obsolete. The remaining migration work concerns path references, old stage template identifiers, and legacy asset inventory.

## Migration progress (2026-11-15)
- Moved the existing `01b_move_vfx.prompt.md` Drive file (ID `1CTREBY6jf__0QhpuS-FUXYVtoZ-9oXAX`) from root `prompts/` to `moves/prompts/`; verified its parent folder is `1YBKLfe6wSoxYDrBNWXLB1cBjjAAyxqeV`.
- Copied eight shared stage templates into **each** of `characters/prompts/` and `creatures/prompts/` (16 category-local copies in total): `00_appearance`, `01_portrait`, `02_review_portrait`, `03a_colab`, `03b_blender`, `03c_portrait_after_3d`, `04_review_3d`, and `05_encyclopedia` (`*.prompt.md`). Source templates remain in root `prompts/` as compatibility references until readers are switched and verified.
- Inspected legacy `prompts/jobs/` and all three category-specific `prompts/jobs/` folders: all four were empty at inspection time. No job data was moved.
- **Still pending:** audit the actual runtime template readers and switch them to category-local paths; recursively inventory and migrate legacy 3D assets; resolve legacy `DIRECTORY.md`/`TRIGGERS.md`; verify category-specific copies, reference integrity, and CI. Do not retire root `prompts/` or consider PR #22 complete until these checks pass.

