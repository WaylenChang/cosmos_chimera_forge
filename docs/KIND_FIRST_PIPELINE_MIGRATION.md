# Kind-first pipeline migration audit (2026-11-15)

## Verified current state
Google Drive root ID: `1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0`.
Top-level subject folders: `characters`, `creatures`, `moves`.
Shared `prompts/` contains legacy stage templates; `characters/02_3d` and `creatures/02_3d` contain `colab`, `ai_blender`, and `legacy`.
`AGENT_QUICKSTART.md` currently describes Colab and AI Blender as mutually exclusive. This conflicts with the intended Colab + AI + Blender branch.

## Canonical structure
All asset-specific read/write paths MUST begin with `<kind>/`, where kind is one of `characters`, `creatures`, `moves`. Under each kind, the pipeline branch comes before stage-specific outputs:
- `<kind>/pipelines/<pipeline_id>/<asset_id>/...`
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

## Status
Audit specification only. No Drive assets have been moved, and runtime code has not yet been migrated. Do not treat this document as evidence of completed migration.
