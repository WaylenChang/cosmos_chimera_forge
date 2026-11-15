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

## Continuation checkpoint — 2026-11-15 (PR #22)

### Verified this session
- GitHub PR #22 remains open/draft; migration is not signed off.
- Committed kind-first trigger documentation correction in `docs/pipeline/TRIGGERS.md` (commit `c3d55d57d76ba1b219df3943be327f6a96bdd48e`): category-local template paths, moves VFX path, root prompt read-only compatibility, and wiki reuse rules. GitHub file readback confirmed the update.
- Re-listed Drive root `1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0`: top-level `characters`, `creatures`, `moves` coexist with root `prompts`, `00_settings`, `backup`, `DIRECTORY.md`, and `AGENT_QUICKSTART.md`. Root `prompts` remains a compatibility/migration item, not an approved asset write target.
- Re-listed `characters/02_3d/legacy` (3 task folders) and `creatures/02_3d/legacy` (12 task folders); all 15 task folder identities are still present at their original legacy parent locations.
- Re-listed three character legacy task roots and one creature sample (`mdl-20261111-c111-1301`): **4/4 sampled roots contain `manifest.json`**. The creature sample also has `build_report.json`, `motion_spec.json`, and `rig_spec.json`. This confirms that the earlier negative manifest inventory is stale; use the later positive reconciliation checkpoint above.
- No model folder was moved or deleted this session. The existing 15/15 model-presence checkpoint remains historical evidence, not a fresh binary integrity test.

### Remaining action / blocking conditions
- **M01 PARTIAL/VERIFY:** inventory remaining descendants for all 15 assets, capture actual file IDs/sizes and source lineage, and validate manifest declarations against observed children; the current session only sampled four roots.
- **M02 BLOCKED:** determine authoritative pipeline provenance and identity/collision mapping, especially the two distinct `chr_1286` source packs and existing creature `asset_cr_*` targets. Do not classify a branch by folder name.
- **M03 BLOCKED:** do not move legacy assets until M01/M02 are complete and a reversible source-ID/target-ID manifest is prepared.
- **M04 PARTIAL:** GitHub `docs/pipeline/TRIGGERS.md` is corrected and read back; Drive root `DIRECTORY.md` and other root documentation still require content reconciliation and readback.
- **M05–M08 PENDING/VERIFY:** audit every runtime writer/resolver, wiki deduplication, reviews/jobs and both 3D routes; verify per-kind template cache switching.
- **M09 BLOCKED/UNVERIFIED:** no green CI or executed integration tests were established in this session.
- **M10–M11 PENDING:** do not retire compatibility paths or mark PR ready until Drive and GitHub references reconcile and checks pass.

### Next execution order
1. Extract manifests and observed descendants into a per-asset evidence matrix (Drive ID, task ID, subject, stage, source pack, producer, actual deliverables).
2. Cross-check destination `colab`/`ai_blender` assets for duplicate content and identity collisions before any move.
3. Complete Drive root documentation updates and GitHub code reference scan; preserve read-only compatibility until verified.
4. Run tests/CI, read back Drive paths, record rollback manifest, and only then perform individually verified moves.

### 2026-11-15 follow-up: complete legacy task/model folder readback

- Independently re-listed **all 15/15** legacy task folders: **15/15** direct-child `manifest.json`, **15/15** direct-child `models/`. The three character tasks each have `textures/`, `rig/`, `images/`, `anims/`; all 12 creature tasks each have `build_report.json`, `motion_spec.json`, `rig_spec.json`, `textures/`, `review/`, `models/`.
- Independently re-listed **all 15/15** `models/` folders: each contains exactly one nonzero-size `.glb` and one nonzero-size `.blend` (**30/30 observed model files**). Character GLBs: 2,173,940; 2,171,932; 2,165,208 bytes; corresponding BLENDs: 381,502; 381,486; 379,554 bytes. Creature GLBs range from 2,948,880 to 8,148,984 bytes; BLENDs from 7,582,994 to 12,820,794 bytes. These are metadata/size checks, not parse, rig, animation or visual QA.
- **Confirmed collision risk:** `mdl-20261109-f048-1847-chr_1286_1855` and `mdl-20261109-f048-1847-chr_1286` each contain `chr_1286.glb` and `chr_1286.blend`, but their file IDs and sizes differ (GLB 2,171,932 vs 2,165,208 bytes; BLEND 381,486 vs 379,554 bytes). Preserve both as distinct assets pending provenance validation; never deduplicate by basename.
- The 12 creature GLB/BLEND pairs cover star, moon and sun lines, each at juvenile, adolescent, adult and overload stages, based on file names; subject/stage claims still require manifest verification.
- Attempted to fetch all 15 manifest bodies. The Drive connector returned empty inline text while exposing downloaded-file attachments, so **manifest content was not successfully parsed in this pass**. Presence is verified, contents/provenance are not; this is an explicit M01/M02 blocker. Do not infer provenance from folder/file names.
- **M01 advanced:** complete direct-child inventory and model size census, but deep descendant integrity and manifest parsing still pending. **M02/M03 remain blocked**; no files moved/deleted and no CI executed in this pass.

### 2026-11-15 continuation: manifest identity and destination collision audit

- Follow-up manifest attachments from the previous Drive fetch were exposed as readable source content. **Correction to the preceding checkpoint:** the claim that manifest bodies could not be inspected is superseded. The 15 manifests include 3 `character-model-rig` and 12 `creature-model-rig` task indexes. Their `files[]` declarations list expected outputs and `missing: []`, but that declaration is not equivalent to full descendant verification or human QA.
- **Character identity collision resolved at the semantic level, not as a move:** `mdl-20261109-f048-1847-chr_1286_1855` has `subject_id=chr_1286`, name **雨森澄羽 / Amemori Sumiha**, `source_pack=chr-20261106-1286-1855`; `mdl-20261109-f048-1847-chr_1286` has the same subject ID, name **葉澄汐 / Chengxi Yeh**, `source_pack=chr-20261106-1286-2039`. Both say `produced_by=Gemini Argon（任務模式）`. They are different named character designs despite the identical `chr_1286` ID/basenames; require distinct canonical asset IDs and an explicit mapping before any move. The third task is `chr_3d04` / 洛恩 / Roen, `source_pack=chr-20261106-3d04-2100`.
- **Creature manifest provenance:** 12 task manifests identify `starter_sun_line`, `starter_moon_line`, `starter_star_line`, each with `juvenile`, `adolescent`, `adult`, `overload`. Source packs respectively `cr-20261111-a111-1200`, `cr-20261111-b111-1200`, `cr-20261111-c111-1200`; `produced_by=legacy migration index`, so these records **do not establish an authoritative Colab vs AI Blender branch**. They explicitly require human visual/animation review.
- **Live destination readback:** `characters/02_3d/colab/` has 3 task folders (`mdl-20261114-3d04-0000`, `mdl-20261114-1855-0000`, `mdl-20261113-1286-0000`) plus runtime/support files; `characters/02_3d/ai_blender/` has 0 children; `creatures/02_3d/colab/` has 0; `creatures/02_3d/ai_blender/` has 60 `asset_cr_*` stage folders. The existing 60 are separate subject families; never overwrite or infer the correct destination from emptiness.
- **Updated blockers:** M01 has complete task-root/model-folder census and manifest identity/expected-file declarations; nested textures/review/rig/animations actual-vs-declared reconciliation and model QA remain. M02 now has explicit character identity collision and creature source-pack matrix, but pipeline provenance and target collision resolution remain. M03 remains blocked until an approved, reversible per-folder ID mapping exists. No Drive writes/moves and no CI execution in this continuation.
