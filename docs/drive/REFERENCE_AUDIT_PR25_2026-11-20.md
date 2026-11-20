# PR #25 — live Google Drive reference audit (2026-11-20)


This is a **partial, verified, in-place Drive audit** on the Draft PR #25 branch. The content here documents live Drive modifications and their verification; it does **not** mean every nested asset, manifest, or legacy reference has been migrated.


## Synced documentation


- Root Drive `DIRECTORY.md` (file ID `1UT4_289o-zh6-9wyq3rG_qMpfzdkjsi7`) synced from GitHub `docs/drive/DIRECTORY.md`. Exact content readback matched.
- Root Drive `AGENT_QUICKSTART.md` (file ID `1oN0va-tlEct7ofhgVNTsYc5_hKSSpf5O`) synced from GitHub `docs/drive/AGENT_QUICKSTART.md`. Exact content readback matched. GitHub PR #25 commit `5204371` clarified logical versus physical Drive paths.
- Original Drive file IDs and parent folders retained.


## In-place shared design-Prompt name alignment


Only the following three existing **character** prompts were renamed, with file ID, contents, MIME type, and parent unchanged:


| Drive file ID | Old name | Verified new name |
| --- | --- | --- |
| `1iUHwtp8gH2gDiLQOnZUqwD2hAXvKB5Bh` | `chr_yeh_chengxi.prompt.md` | `chr_protagonist_yeh_chengxi.prompt.md` |
| `1rMwi7MjwKXLC12IxNdPdMiWNGcql6yT0` | `chr_amemori_sumiha.prompt.md` | `chr_protagonist_amemori_sumiha.prompt.md` |
| `1XBdhsl72vFn2EW6827Y5EwmES2ElCTkg` | `chr_roen.prompt.md` | `chr_protagonist_roen.prompt.md` |


A top-level check of 41 active subject folders found 41 `*.prompt.md` design files. The remaining 38 already matched their physical subject folders. Cross-form creature design prompts remain unchanged as required by `FILE_NAMING_CONTRACT.md`.


## Verified live JSON reference corrections


The two JSON manifest files below were updated **in place** through the raw Drive upload action, preserving the original file IDs, parent folders, MIME `application/json`, subject IDs, stage labels, QA metadata, and other historical fields. Fresh post-update raw downloads were byte-for-byte identical to the intended JSON payloads.


### Water trial boss


Existing file: `creatures/ch_trial_boss_water_line/_03b_blender/line_water_trial_boss_03b_blender_manifest.json` (Drive file ID `1ietSBYrADa9Zvj1u2nnykJPuaai4JFg4`).


- `source_prompt`: `line_water_trial_boss.prompt.md` → `ch_trial_boss_water_line.prompt.md` (verified existing shared prompt in parent subject folder).
- Four stage `glb` references: `line_water_trial_boss_<stage>_03b_blender.glb` → `ch_trial_boss_water_line_model_form<i>_03b_blender_legacy.glb` for `juvenile=1`, `adolescent=2`, `adult=3`, `overload=4`; each exact destination file verified in the subject folder.
- Four explanatory `blend` messages: `03b_blender/line_water_trial_boss_import_to_blend.py` → `_03b_blender/line_water_trial_boss_import_to_blend.py`; script present in the physical `_03b_blender` directory.
- In total **9 corrected references**. The `blend` fields still honestly state the binaries are missing; they do not claim that Blender outputs exist.


### Ice trial boss


Existing file: `creatures/ch_trial_boss_ice_line/_03b_blender/line_ice_trial_boss_03b_blender_manifest.json` (Drive file ID `1KTDAmqbcg1Pg4h1zFvDB2xVtB8IkznOW`).


- Four stage `glb_file` references: `line_ice_trial_boss_<stage>_03b_blender.glb` → `ch_trial_boss_ice_line_model_form<i>_03b_blender_legacy.glb` for `juvenile=1`, `adolescent=2`, `adult=3`, `overload=4`; each exact destination file verified in the subject folder.
- In total **4 corrected references**. Other build-script/history fields retained.


**Total references corrected in these two manifests: 13 (9 water + 4 ice).**


## Other findings — deliberately not rewritten


- `ch_1st_batch_aqua_slime` form wiki still quotes a historical source path `wiki/_legacy/creatures/cr_aqua_slime_wiki.md`. A Google Doc with that historical source name exists physically under `creatures/_backup/_wiki_legacy/`. The quoted historical path is **not** automatically a live output path, so source provenance was left intact.
- Starter Sun `_03b_blender` manifests describe `models/`, `textures/`, and `review/` as archive-era logical paths; physical working files are flat with old filenames. Their `produced_by: legacy migration index` records are intentionally left unchanged pending historical/archive cross-reference resolution.
- Trial-boss root folders still contain ambiguously named GLBs, shared codex/wiki docs, scripts, and legacy paths. Do not mass-rename without a collision- and semantics-checked map.
- `qc_views` in the water trial-boss manifest includes names not verified as present in its current physical folder; these were not rewritten or marked delivered.
- The category-level `_prompts`, `_designed_prompts`, and `_backup` helper names observed are compliant. This was **not** a complete recurrence of the historical 433-folder inventory.


## Remaining gates


1. Perform complete physical Drive file inventory, including binary media and nested backup/version directories, with real per-folder listing and pagination.
2. Resolve each manifest and wiki reference against actual Drive file ID and historical archive path before altering it; preserve game IDs and provenance.
3. Verify compatible GitHub runtime lookups and tests before renaming ambiguous files or shared cross-form documents.
4. Run CI, browser and connected Drive end-to-end regressions and deploy compatible resolver before closing the Draft PR.


No `*.prompt.md` contents, GLB bytes, image bytes, or game IDs were modified. No Colab GPU job was started.


## Further continuation: naming contract and water QC links (2026-11-20)


- Added the previously absent `FILE_NAMING_CONTRACT.md` to the **root** of the live Drive project (file ID `12J_5ZpNVWn2zXv0ivzS7b5thkmTYJQra`, parent `1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0`). Content was checked **exactly equal** to GitHub `docs/drive/FILE_NAMING_CONTRACT.md` (5,924 characters), with one root file of this name. This repairs the existing links in `DIRECTORY.md` and `AGENT_QUICKSTART.md`; the GitHub document was not rewritten.
- Continued in-place editing the water trial-boss manifest (same Drive ID `1ietSBYrADa9Zvj1u2nnykJPuaai4JFg4`): changed the **four** `qc_views[0]` H8 filename references from `<stage>_h8.png` to the verified in-folder names `ch_trial_boss_water_line_qc_h8_form<i>_03b_blender_legacy.png` (forms 1–4). Verified the four PNG files by individual Drive ID in the live `_03b_blender` directory and a post-upload SHA-256 exact match of the full JSON payload. File ID, MIME type, and parent unchanged.
- **Scope correction:** The water manifest now has **13** corrected references (9 earlier + 4 H8); the ice manifest has **4**. Combined, the two manifests have **17** corrected references after this continuation. The earlier counts in this audit reflect their respective earlier checkpoints, not the new cumulative total.
- The eight remaining water `qc_views` entries named `<stage>_v8.png` and `<stage>_closeups.png` do not match the direct files found in the current Blender folder; they remain untouched as **unverified historical references**, not proof that those QC outputs currently exist. No files were fabricated or marked complete.


## Further continuation: starter Blender legacy-reference mapping (2026-11-20)


- Inspected all 12 historical `03b_blender` manifests for the three starters: `starter_sun_line`, `starter_moon_line`, and `starter_star_line` across `juvenile`, `adolescent`, `adult`, and `overload`.
- Their original `files[].path` entries contain 14 archive-era logical paths per manifest (`models/`, `textures/`, `review/`, and JSON reports). Verified the corresponding current *physical* files through the actual `_03b_blender` folder listings, not name search. **All 168/168 reference slots resolve to exactly one physical file** in the respective current folder; the 12 existing manifests retain original bytes.
- Added full ID-level, reversible read-only map `docs/drive/starter-blender-reference-map-2026-11-20.json` on PR #25 and synced that file to Google Drive project root as `starter-blender-reference-map-2026-11-20.json` (file ID `1x6cpU_Qb8rI-cB6pAFDsoYnsNYKUWZNI`). GitHub blob SHA `0efe3598230d84741022bb9e35c56cefae17f4c2` also matches the freshly downloaded Drive bytes after sync.
- Mapping fields: original `archive_path`, current physical Drive relative path and filename, exact Drive file ID, MIME type, per-form manifest ID, physical subject folder, and `_03b_blender` folder ID. This is an existence/name mapping **not binary content equivalence** to the historical archive. No auto-renaming, approval, or binary validation was implied.
- **Compatibility hold:** The starter Blender builder script still emits legacy `starter_<line>_line_<stage>_03b_blender.glb` filenames. Do not rename these live GLB/Blend/texture files or replace the original manifest `files[].path` until builders, app path lookup, and archive semantics have all been updated and tested.
- All legacy `source_pack`, stable `subject_id`, human-review status, and `*.prompt.md` contents were preserved. No Blender/Colab jobs executed.


## Further continuation: trial-boss Wiki reference repair and uncertain model inventory (2026-11-20)


- Inspected all **10** trial-boss physical subject folders and their **40** four-form GLBs via live Drive folder listing. Ice/light/metal/shadow/water each have four already canonical `ch_trial_boss_*_model_form<i>_03b_blender_legacy.glb` names (20 files).
- Edited four existing **native Google Docs** Wiki files in place with `replaceAllText`, guarded by each original Docs `revisionId`: ice doc `1GhpeedxleZFcnCbha3upZ8D96QrEJjdZdxfVHKpc1_Q`, light `1MeImbGb_8pEwiB2teduog9xtPKR9x4sPFxPY9_FrSPk`, metal `1BbgqL1NWDcG4fbfgfN8hbHzXQ144ED_KjQDywNkDJhQ`, shadow `1bSP1AiKS9w9bnPE2zAnzoMj7JATU8UaPfqEv0UO97PA`.
- Replaced **21 exact Wiki references**: 4 GLB names and 1 shared design Prompt name per Wiki (20 total), plus ice's physical directory `_03b_blender/` reference (1). Each target Prompt/GLB filename was verified in the respective Drive folder; all replacements reported one occurrence each and were checked by document readback. Unrelated Wiki prose and structure were preserved.
- Earth/fire/thunder/wind/wood have 20 GLBs with recognizable legacy form names, but no substantiated source-pipeline step or approval label. Each existing Wiki still references the exact original name. Those 20 GLB files and 5 Wikis remain **unchanged**.
- Added a read-only ID-level map `docs/drive/trial-boss-unverified-model-map-2026-11-20.json` and synced byte-identical JSON to project root Google Drive (file ID `1cQfFjLrLwEueqEnOAtb_2tbtYfsM7lfp`). For each of the 20 existing GLBs, records the source filename, Drive file ID, subject folder, explicit 1–4 form index and Wiki reference count. Each name uniquely existed as a `model/gltf-binary` in its proper parent. GitHub blob SHA and the freshly downloaded Drive raw bytes both verified as `f5fc5a5078988c1d9a4dfd0ab63bb5a80dd309d7`.
- **Safety gate:** No 03b_blender provenance was inferred for these 20 assets; do not force a form-dependent final filename or rename them until the production-step provenance, consumer compatibility, and approval are verified.
- No `*.prompt.md` content was edited, no GLB bytes changed, and no Colab GPU job was run.


## Further continuation: GitHub runtime and deployment regression fixes (2026-11-20)


The current PR #25 branch was checked against a locally reconstructed source/test subset (Node.js v22; the connected GitHub repository cannot be cloned directly from this execution environment). These fixes address **real runtime contract violations**; they do not constitute a complete deployed-browser or authenticated-Drive E2E run.


- **Build whitelist:** `tools/build-site.mjs` previously omitted `drive-folder-naming.js`, even though `index.html` includes that script and downstream `drive-storage.js` / `wiki.js` require its `COSMI_DRIVE_NAMES` API. Added the module to the published file whitelist and extended `tools/tests/test_drive_storage.cjs` to assert inclusion and cache-busted script URL.
- **Shared Prompt writes:** `recordPipelineWrite` in `drive-storage.js` previously treated `prompts/save.prompt.md` as a subject directory while updating its index, resulting in a post-write `canonicalFolderName` validation exception. Restricted physical subject-name conversion to actual category subject paths; category helpers and shared root prompts no longer enter the subject parser.
- **Test harness fidelity:** `tools/tests/test_drive_storage.cjs` was missing the actual `COSMI_DRIVE_NAMES` dependency, yielding false-positive legacy tests. Injected the naming module into the VM harness, updated migrated underscore paths and stage-scoped wiki name expectations. The local targeted naming/Wiki/storage suite passed **43/43 tests** (full build-dependent test excluded because the selective local source snapshot lacks most production assets).
- **3D model review safety:** `model-review.js` previously chose an arbitrary lexicographically sorted GLB whenever a historical `models/<old>.glb` path no longer matched a flattened physical file. In a four-form creature folder this could select the wrong form. The fallback now infers explicit `juvenile/adolescent/adult/overload` from the manifest basename and requires exactly one matching legacy stage or modern `_form1..4` candidate. Ambiguous or absent matches fail closed, while a sole legacy character GLB remains compatible. Added guarded tests in `tools/tests/test_model_review.cjs`; a separate local set of **14 targeted selection cases** passed.
- **Still pending:** complete production `node --test` from a full checkout, site build and deployed asset presence check, browser OAuth/Drive reading and rendering, and live end-to-end model/Prompt regression. No Drive assets or `*.prompt.md` content were changed in this runtime-only continuation; no GPU job was started.

## Further continuation: starter portrait encyclopedia paths (2026-11-20)

- Reviewed the three existing `_01_portrait/starter_{sun,moon,star}_line_adult_01_portrait_manifest.json` files and their live parent folders. Each JSON manifest had five active encyclopedia path values (`encyclopedia_path` plus the four `encyclopedia_paths` forms) pointing to the old logical `creatures/wiki/starter_*_line_<stage>_wiki.md` names.
- Confirmed all **12 physical Wiki targets** (four forms for each starter) directly under `creatures/ch_starter_<sun|moon|star>_line/`, named `ch_starter_<sun|moon|star>_line_wiki_form<i>_05_wiki_legacy.md`, by live Drive folder listing.
- Rewrote **15 active encyclopedia references** (five per manifest) in place to the exact verified physical relative paths. The `adult` reference appears in two JSON fields per manifest and now consistently targets `form3`. The original manifest file ID, parent, `application/json` MIME type, unrelated JSON fields, stable `subject_id`, and `qa_status: REVIEW_REQUIRED` were preserved.
  - Sun manifest Drive ID: `1Tr52KpLLElFcmGzWggDQ-IUN0PEiQLo4`; parent `1cuLb1wdvir2SLi-a-LJOhzPpwooT95i4`; verified post-update SHA-256 `482510cd545bb2fe89d541a2dcf7276653e1ff3f8c51aa9bdf805efaa50ae8fc`.
  - Moon manifest Drive ID: `15zP1zXucgWs8-l25Mdvpnyy8fwIAvNZt`; parent `1I9Gz0WX7eBo36VnIzM1-StOxD7L9Dt__`; verified post-update SHA-256 `fc1bb85fd08b1fb99c26a8483316db521f5ae7fdfeb676f860407deb02c3ca30`.
  - Star manifest Drive ID: `1pNDN3YJ3IUtdAdXoRzbhtP1VLuf52t5R`; parent `1qLayh0vZaz6mPeeDg9RvZ03dKzLoCZOC`; verified post-update SHA-256 `0f87f09a91c0728ffbdef6eb5c4cbe0a754ef680321fcc5ed82f1e40b0033df8`.
- After fresh downloads, the full bytes of all three Drive manifests exactly matched the prepared, JSON-validated replacements. This is a **reference repair**, not an assertion that archived `files[].path` records (`images/`, `prompts/`, or `concept.json`) correspond to current flattened Drive outputs. Those archive-era path records remain untouched until source/archive provenance and downstream consumers can be established.
- No `*.prompt.md` payloads, model or image bytes, Wiki content, game IDs or approval decisions changed. No Colab GPU run was started. PR #25 remains Draft pending broader references and authenticated browser/Drive E2E verification.

## Further continuation: starter portrait archive mapping and water QC existence audit (2026-11-20)

- Examined the existing three starter `_01_portrait` manifests and their exact 52 `files[].path` slots: 13 Sun, 14 Moon, 25 Star. Checked current Drive folder listings for all three subject portrait directories and two preserved pre-flattening prompt archives.
- Resolved **52/52** original manifest slots to exactly one existing Drive file ID: 36 image PNG files and 3 concept JSON files in the active `_01_portrait` directories; **13 prompt text reports remain physically in** `creatures/_backup/_legacy_pre_flat_20261116/_01_portraits/_cr_20261111_{b111,c111}_1200/_prompts/`. Each resolution records source `files[].path`, four-form index, actual physical path, file ID, parent folder ID and MIME type. No filename-only ambiguity was found in these 52 slots.
- Created supplemental, reversible **read-only** map `docs/drive/starter-portrait-reference-map-2026-11-20.json` in GitHub PR #25 and synced the same bytes to the project root of Drive as `starter-portrait-reference-map-2026-11-20.json` (Drive ID `1doAEq-rR2w4ainHFP6xAR6sKYTrtAhFP`). Git blob SHA `37061c38e6ec7a825646eed12485e61844cef7e6`, and freshly downloaded Drive map matched SHA-256 `c66878a2a484344abf7d0c1f7eee07515140fd0de79db89ddea5c7e93cc2cb6e`.
- Preserved **all 52 historical `files[].path` strings** in the original portrait manifests because they describe an archived delivery index and downstream consumer semantics are not yet validated. This mapping proves matching names, MIME, parents, and file IDs, not historical-vs-current binary equivalence or final approval.
- Rechecked the Water trial-boss `_03b_blender` folder by live listing (Drive folder ID `1J4kXahHPUWLwZ3ufQtfle9jR_pEMu8P0`): it currently contains only the manifest, the Blender converter script, and four correctly named H8 PNGs. Its other **8** `qc_views` entries (`juvenile|adolescent|adult|overload` × `v8.png|closeups.png`) have no same-name files in this folder and no same-name entries in the earlier complete 433-folder inventory; these remain **unresolved historical references**. Do not change them to `delivered`, fabricate files, or guess alternate names.
- Existing model/portrait/wiki/game IDs, `*.prompt.md` contents and all binary assets remained untouched. No Colab/Blender job executed. PR remains Draft; broader recursive active-reference evaluation and authenticated browser/Drive E2E still pending.
