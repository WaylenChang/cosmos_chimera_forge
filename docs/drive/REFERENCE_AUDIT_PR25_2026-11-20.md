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

## Further continuation: creature encyclopedia Drive source path repair (2026-11-20)

- Inspected the live `creatures/encyclopedia.json` (Drive ID `1UcAd95blM-FGqiv3919wBP71oMKx8IOy`; 93 creature entries) against the 433-folder file-ID inventory. Re-listed 18 active creature subject folders, 12 portrait working folders (**262** matching entries, zero drift) and the `creatures/_backup` folder (**418** matching entries, zero drift).
- Updated **169** exact `sources[].path` values in place to the physical path of each unchanged `drive_file_id`: **72 Wiki**, **25 portrait** and **72 historical backup GLB** source references. The model references remain in `creatures/_backup` and do not claim any production approval. File ID, parent, MIME, source SHA-256 hashes, source selector, game IDs and review status were not changed.
- Read-back of the full Drive JSON was byte-identical to the validated update (before SHA-256 `95bd27fb3e42bd8b77b0b8e9be2a29000a810ef4453ce3f194b0cab38d5da314`, after SHA-256 `a2e11b49ac811f7ede581f1315744416210854ce9cacf11d7b93d3ad6f55532b`); all **169** Drive-backed source path values now point at the live physical folder/name for their existing Drive file IDs.
- Added a reversible full per-source mapping `docs/drive/creature-encyclopedia-reference-map-2026-11-20.json` on GitHub PR #25, also stored at Drive project root under the same filename (Drive ID `1cp37iI-OHwmKe0GpxuxOBBG1gyQJmOVc`). Full Drive read-back SHA-256 `1c0bc64d0c70b79a3168d4f4ed6a221bdb226abb950a60da7c1d58364e39a8b7` matched local mapping bytes.
- Corrected **60** `sources[].path` Wiki references in GitHub `Data/_incoming/p4-09-encyclopedia-01/creatures/drive-creatures.json` against their stable file IDs (commit `bb46d11ac17a1754845cb1ce20dadf39199b98c0`). This is an index/source reference repair; no authored species names, model approval or game content were rewritten.
- The encyclopedia client `encyclopedia.js` displays the source path as an author-only link label, opens the unchanged `drive_file_id`, and downloads portrait sources by file ID with the unchanged SHA-256 check. Authenticated live-browser E2E is still required.
- `*.prompt.md` payloads, model and image bytes, source SHA-256 values and review decisions were not modified; no GPU or Blender run took place. Keep PR #25 Draft pending full E2E and other unresolved legacy paths.


## Further continuation: character and move encyclopedia source path repair (2026-11-20)

- Inspected `characters/encyclopedia.json` (Drive file ID `1I5LcjW3Ukd9kyVdlHxV8Fpx_awpz0UrE`; original MIME `text/plain`; 3 entries) and `moves/encyclopedia.json` (Drive ID `1b7hytlPUo6dbPQ8cvL83bYfkpppmz8PV`; original MIME `application/json`; 367 entries). Found **25 stale Drive-backed `sources[].path` entries**, with **zero missing Drive file IDs**.
- Compared the stable Drive file IDs to the complete 433-folder ID inventory and separately re-listed the **16** affected live parent directories (3 character subjects, 10 independently versioned character Colab-model directories, and 3 creature starter lines). All **70** direct child entries matched by file ID, parent, current name and MIME; zero drift.
- Replaced exactly **16** character source path fields (3 Wiki, 3 portrait, **10 separately versioned historical Colab GLBs**) and **9** move source path fields (starter creature Wiki files) with the verified physical Drive relative paths. The old character model path was shared text, but its individual source IDs resolve to distinct `_03a_colab/_v1.._v4` files; no duplicates were merged, no source ID was redirected to an arbitrary version, and no version was newly approved.
- Changed only these `sources[].path` string spans in the existing Drive catalogs; preserved every other JSON byte, original Drive file IDs, parent folders, MIME, game IDs, status and original source SHA-256 values. A full reverse-substitution check reproduces each original JSON byte-for-byte.
- Raw Drive readback was byte-identical to each prepared replacement. Character JSON: **before SHA-256** `07e5ae640bb68b5398125277c930e9b3545349cb9b02d774b75097b6b1c4a607`, **after** `5445b59123067f142c2bcabb8a2fd28fcf7e7e2bac4017fe115246492775e087`; Move JSON: **before** `7131dbe8c7678deca909e73dce4d6ff0b1692602937b09c1529605429fa3f3a2`, **after** `a14f85738cb7a972afe9ee0a11ce79d2c6f9afbc6065df2c9907ff704aa6ccf3`.
- Created reversible per-source `docs/drive/character-move-encyclopedia-reference-map-2026-11-20.json` on PR #25 and synchronized an exact content copy to the project-root Drive (file ID `1sjvqfabWtDa__LF47X2MCJ_i5vD4Gdbo`); **25** entries contain catalog, source key, stable file ID, old path, current path, parent ID and MIME. Map SHA-256: `2ff1dd2e95da2a5a51be4d60f8291efaef43b531f5417a5097da23ec3b470136`. GitHub readback was exactly equal to the Drive map.
- The prior `fd5492ee44c47e4955ef0efb7b7639020c66b7fa` PR-head GitHub Actions workflow run `44736042544` had a **success** conclusion. This is not a browser-authenticated Drive E2E pass; CI for subsequent commits must be inspected separately.
- No `*.prompt.md` content, GLB bytes, PNG bytes, game IDs or review decisions changed; no Colab GPU or Blender jobs were started. Keep PR #25 Draft pending remaining uncertain legacy references, versioned/duplicate model provenance and authenticated end-to-end regression.


## Further continuation: character production manifests and source-GLB collisions (2026-11-20)

- Inspected the three protagonists' `_01_portrait` JSON manifests and `_03a_colab` JSON manifests. Found three nonempty, stale portrait-manifest `encyclopedia_path` strings plus one in Chengxi's Colab manifest; the other two Colab manifests have an empty `encyclopedia_path` and were correctly left unchanged.
- Updated exactly **four** active `encyclopedia_path` values in place to their corresponding already-verified current physical character Wiki paths (`characters/chr_protagonist_<name>/<physical_subject>_wiki_05_wiki_legacy.md`): Roen, Amemori Sumiha and Yeh Chengxi portrait manifests, and Yeh Chengxi Colab manifest. Every exact target Wiki File ID was cross-checked against the current character encyclopedia and the independently re-listed root character folders.
- Raw readback of all four edited manifests exactly equaled the prepared JSON bytes; only the single path value changed in each. All original `files[].path` archive-era delivery records, file IDs, parent folders, MIME types, task and game IDs, content SHA-256 records, QA status and binary source files were preserved.
- Reversible per-file before/after SHA-256s and File ID mappings are in GitHub `docs/drive/character-manifest-wiki-reference-map-2026-11-20.json` and exact copy in project-root Drive (`character-manifest-wiki-reference-map-2026-11-20.json`, ID `1NVqr3Rk1btaiSCO7HGepGD27TAmtWly5`), SHA-256 `20bfa438093799005ebbd510b69bca9aff3f7ab347075b49f3693e631c9116ee`. The GitHub and Drive mapping contents were read back as exactly equal.
- Independently re-listed the three protagonist `_03a_colab` directories and confirmed **three same-parent duplicate source-GLB filename pairs**: Roen `chr_3d04_03a_colab_source.glb` files `10So7a9tTN80AZb0rK0CDH2t0eHozP1Ss` (2,341,712 bytes) and `187aasLcgBZP6rgW3E10lNFTIBfeoy3Y2` (1,913,548); Sumiha `chr_1855_03a_colab_source.glb` IDs `13mC4LBYSZMgzWA_U0zsBPUYAtrI7HZzF` (2,346,860) and `1kXuodZd2XrmOfuIyUGpSsF4ZJEhnufSK` (1,909,348); Chengxi `chr_1286_03a_colab_source.glb` IDs `1f6sg1nvmAbUSwbLaMRhpJT9oqUJB29Dr` (2,430,280) and `1RXd-JChoqqJceW829cB3_qXc0nAamePV` (1,796,696). Different byte sizes prove each pair is not byte-identical.
- Their source `03a_colab` manifests retain historical `models/<task>.glb`, `source/<task>.glb`, and `rig/<task>.glb` paths but do **not** specify an exact Drive File ID for these same-name duplicates. Size alone does not prove which file corresponds to which historical build slot. Thus **no duplicate binary was renamed, removed, merged, promoted, or assigned a new provenance**; any name-only resolver must fail closed until source build records are correlated by verified IDs/bytes.
- No `*.prompt.md` payload, GLB/PNG bytes, review decision or game data was modified. No GPU/Blender job was started. PR remains Draft pending source/version provenance and authenticated browser/Drive E2E.
