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
