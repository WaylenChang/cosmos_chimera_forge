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


## Legacy 3D inventory checkpoint
- `characters/02_3d/legacy/` contains three asset folders: `mdl-20261109-f048-1847-chr_3d04`, `mdl-20261109-f048-1847-chr_1286_1855`, and `mdl-20261109-f048-1847-chr_1286`. Direct-child listings currently show model/rig/image/texture/animation subfolders but **do not show `manifest.json`**; verify manifest existence and metadata before any branch classification. They are **not yet moved** because the correct new 3D branch must be derived from the manifest, not inferred from the `legacy` folder name.
- `creatures/02_3d/legacy/` contains 12 `mdl-20261111-*` asset folders (a111/b111/c111, four stages each). The `creatures/02_3d/ai_blender/` destination already contains many stage-specific `asset_cr_*` folders; check identity and duplicate collisions before any move.
- `characters/02_3d/colab/` already contains active model folders and runtime files; `characters/02_3d/ai_blender/` and `creatures/02_3d/colab/` were empty when inspected.
- No legacy 3D folder was moved during this checkpoint. The manifest-based branch mapping and collision audit remain mandatory.

## Verification checkpoint: missing direct-child manifests (2026-11-15)
- Re-read all three character legacy asset folder IDs (`1mDwl_qmIzzRMRztG5MKmExHZugZMjozo`, `1n4ZmoOT6RWx3wlZzV2zZIa12WmpekQY3`, `1tEyXR0YExqH7VwnGEPZzrtVXIGGInJlE`). Their immediate children are directories only; no direct-child `manifest.json` was returned.
- Sampled creature legacy asset folder `1A7bpdzLs0XvDFPn8HIQZ8tPSfgMtGgAs` (`mdl-20261111-c111-1301`): immediate children are `textures/`, `review/`, and `models/`, without a direct-child manifest.
- Sampled model/rig subfolders under these assets; the queried folders returned no files. A folder name alone is **not** evidence that `.glb`, `.blend`, or rig content exists.
- Treat these as **unverified/incomplete**, not approved models. Do not move or delete their Drive IDs until a manifest, source lineage, actual deliverables, target branch, and destination collision checks are recorded. Preserve `legacy/` as read-only quarantine.
- `pipeline.js` currently loads category-specific templates using the kind selected at `loadTemplates()` time. A later category switch can reuse cached templates from the previous kind. Add kind-keyed cache and a category-switch regression test before retiring root template fallback.

## Full legacy model-directory checkpoint (2026-11-15)
- Enumerated the immediate children of **all 15** legacy asset folders: three under `characters/02_3d/legacy/` and twelve under `creatures/02_3d/legacy/`. All 15 contain only subfolders at the immediate level; **none lists a direct-child `manifest.json`**.
- Enumerated each asset's `models/` folder (15/15). **All 15 model directories returned zero children** and no continuation token. No `.blend` or `.glb` deliverable was found in these model folders.
- Therefore these 15 folders cannot be treated as completed model packages or automatically migrated into `colab/` or `ai_blender/`. Retain their Drive IDs and legacy quarantine placement; do not delete or overwrite them. Inspect any remaining non-model subfolders and source records separately before deciding whether the placeholders are disposable.
- CI is still unverified: the PR head's combined status has no entries and the queried commit returned no pull-request workflow runs. Local `git ls-remote` failed because GitHub DNS resolution was unavailable in the execution container; **do not mark tests passed**.

## Outstanding work and blockers — handoff checklist (2026-11-15)

Status meanings: **BLOCKED** = prerequisite or verification missing; **PENDING** = not yet executed; **VERIFY** = code/data changed but no passing readback or test evidence. Do not treat any item as complete merely because its directory exists.

| ID | Status | Remaining action | Blocker / reason | Exit evidence |
| --- | --- | --- | --- | --- |
| M01 | BLOCKED | Inspect all remaining legacy `textures/`, `review/`, `rig/`, `images/`, `anims/` descendants and relevant external source records | All 15 legacy asset roots lack direct-child `manifest.json`; all 15 `models/` folders returned empty; full non-model inventory and provenance are not verified | Recursive inventory with IDs, file types, sizes, manifests/source lineage and explicit per-asset disposition |
| M02 | BLOCKED | Map each legacy package to its canonical `colab/` or `ai_blender/` target, kind, asset ID and evolution stage | No reliable branch/source metadata; possible destination identity collisions, especially existing creature `asset_cr_*` | Collision report and one unambiguous mapping per asset; do not infer from folder names |
| M03 | BLOCKED | Move only validated legacy Drive packages and verify parent IDs after each move | Depends on M01–M02; currently zero validated complete legacy model packages | Source/target Drive IDs, pre/post parents, size/hash where available, readback and migration log; leave incomplete placeholders quarantined |
| M04 | PENDING | Audit root `DIRECTORY.md`, `TRIGGERS.md`, quickstarts and Drive documentation; correct stale root `prompts/` references to kind-first paths | Root `DIRECTORY.md` still documents stage prompts as `prompts/*.prompt.md`; other references not exhaustively checked | Updated documentation and verified Drive readback |
| M05 | PENDING | Exhaustively scan GitHub runtime, scripts, workflows and tests for legacy read/write path literals (`drive-storage.js`, `forge.js`, `catalog.js`, `model-review.js`, wiki/review flows) | Only selected resolvers and template loaders were updated; all writers/readers have not been audited | Reference inventory and tests proving writes always begin `characters/`, `creatures/` or `moves/` |
| M06 | VERIFY | Verify category-local template copies, fallback behavior, and kind-switch cache isolation | Copies were reported and resolver/cache updated, but no full integration test or successful CI evidence | Drive file readbacks for all templates, unit tests for character→creature→character and missing-template fallback |
| M07 | PENDING | Verify wiki files are separated by kind and creature evolution stage, use `_wiki.md`, and are generated once | Existing wiki asset inventory and deduplication by subject+stage have not been fully checked | No duplicates/overwrites; creation and re-run idempotence tests |
| M08 | PENDING | Verify `reviews/`, `prompts/jobs/`, `01_portraits/`, `02_3d/`, `moves/01_vfx/` discovery, review, cache invalidation and acceptance gates | Cross-kind and cross-branch end-to-end paths not exercised | End-to-end cases for characters, creatures, moves, both 3D branches and post-Prompt-to-3D portrait |
| M09 | BLOCKED | Execute tests and inspect CI for PR #22 head | Queried GitHub combined commit statuses and PR workflow runs returned no entries; local `git ls-remote` failed on DNS resolution | Successful test command output, green required checks, deployment/build evidence |
| M10 | PENDING | Retire root shared prompt paths and `legacy/` read/write routes only after compatibility verification | Readers may still require read-only fallback; legacy package classification incomplete | No live references; migration readbacks and CI pass; preserve backup/rollback |
| M11 | PENDING | Final Drive ↔ GitHub directory/reference reconciliation and PR acceptance | Depends on M01–M10 | Final tree diff, orphan/duplicate report, verified links and passing CI; only then mark PR ready |

### Explicitly completed, but not sufficient for sign-off
- Kind-first canonical directory contract and initial resolver changes are in PR #22.
- `01b_move_vfx.prompt.md` was moved into `moves/prompts/` and 16 character/creature template copies were reported; root `prompts/` remains compatibility-only.
- The four inspected `prompts/jobs/` directories were empty at the inspection checkpoint.
- `pipeline.js` now keeps per-kind template caches and reads the selected kind's template when building prompts. A category-switch regression test was committed; **test execution has not been confirmed**.
- All 15 legacy model directories were enumerated and returned empty; no legacy asset has been moved or deleted.

### Safety / sequencing rules
1. Run M01 → M02 → M03; never move incomplete legacy model placeholders into production branches.
2. Run M04–M08 independently where possible; keep root compatibility paths read-only.
3. Run M09 after changes and rerun after fixes; do not interpret absence of statuses as success.
4. Complete M10–M11 only after Drive readback, deduplication, and green CI.
5. Keep PR #22 **draft** until all exit evidence is attached. Do not merge, delete legacy data, or silently rewrite approved assets.

## Reconciliation checkpoint: actual Drive readback (2026-11-15, supersedes earlier negative inventory)

**Correction:** Earlier sections saying all 15 legacy roots lack direct-child `manifest.json` and all 15 `models/` directories are empty are **superseded by later verified Drive listings**. They are retained above solely as historical checkpoints, not as current migration blockers.

- Re-listed all 15 legacy roots: **15/15 contain a direct-child `manifest.json`** (3 characters, 12 creatures). Each root also has its corresponding `models/` directory.
- Re-listed all 15 `models/` folders: **15/15 contain one nonzero-size `.glb` and one nonzero-size `.blend`**, 30 model files total. These are presence/size checks only, not Blender openability, rigging, animation, or acceptance tests.
- Character task folders: `mdl-20261109-f048-1847-chr_3d04`, `mdl-20261109-f048-1847-chr_1286_1855`, `mdl-20261109-f048-1847-chr_1286`. Their manifests identify `character-model-rig` tasks and source packs. The two `chr_1286` tasks have distinct source packs/identities but both name `models/chr_1286.glb` and `models/chr_1286.blend`; **do not deduplicate by filename or subject ID alone**.
- Creature task folders: `mdl-20261111-{a111,b111,c111}-{1300,1301,1302,1303}`. Manifests identify creature-model-rig tasks with subject/stage/source-pack fields; e.g. `c111-1301` is `starter_star_line` / `adolescent` / `cr-20261111-c111-1200`. The creature manifests state `produced_by: legacy migration index` and explicitly note that human visual/animation review remains pending.
- Existing destinations were listed: `characters/02_3d/colab/` contains three active model task folders plus runtime files; `characters/02_3d/ai_blender/` and `creatures/02_3d/colab/` are empty; `creatures/02_3d/ai_blender/` contains many `asset_cr_*` stage-specific folders. These listings do **not** establish branch provenance or content equivalence.
- **M01 updated to PARTIAL/VERIFY:** manifests and 3D deliverable presence verified; recursively inventory non-model descendants and verify actual bytes/source provenance. **M02 remains BLOCKED:** determine `colab_ai_blender` versus `ai_blender` from authoritative provenance, compare target assets by subject+stage+source and content, and resolve the `chr_1286` naming ambiguity. **M03 remains BLOCKED:** no production move without M01/M02 evidence and collision-safe mapping.
- **No legacy folder moved/deleted; no asset accepted; no CI pass claimed.** Preserve legacy Drive IDs and read-only quarantine pending safe mapping.

### Next executable steps
1. Build an asset-level manifest index: task ID, Drive folder ID, subject, stage, source pack, producer, declared relative files, observed file IDs/sizes, and missing-file discrepancies.
2. Compare all 15 packages against existing production tasks and `asset_cr_*` folders; do not use the target folder's emptiness as proof of correct pipeline branch.
3. Verify non-model descendants, Blender/GLB integrity, provenance and acceptance gates; then move only uniquely mapped packages with parent-ID readback and rollback manifest.
4. Independently complete M04–M09 (documentation, code references, wiki/review/jobs, tests and CI) while keeping compatibility reads and legacy writes disabled.
