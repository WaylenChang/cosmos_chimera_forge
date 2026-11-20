# Google Drive naming audit — 2026-11-20

Source: the `cosmos_chimera_forge` folder in Google Drive (root ID `1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0`); compared with PR #24 head `7d444d072ba44a85ac52c51169de914db6971ac1`.

## Requested contract

- Within `characters/`, `creatures/`, and `moves/`, **all non-subject folders**, at any depth, must have an ASCII-English snake-case name with a leading underscore (`_prompts`, `_03a_colab`, `_v2`, `_models`).
- Subject folders, directly under their category only, must have an English batch/title and name: `chr_<batch>_<name>`, `ch_<batch>_<name>`, `mv_<batch>_<name>`.
- These are **Drive folder names**, not an instruction to mutate existing game IDs, filenames, wiki contents, or `.prompt.md` text. The original identifiers are retained in existing assets and manifests until there is a separate, explicit, tested data-ID migration.
- Do not rename the three category roots themselves (`characters`, `creatures`, `moves`) or folders of different names in unrelated repository data trees.

## Read-only inventory

The metadata-only Drive recursion visited **433** folders across 6 descendant levels (50 / 81 / 55 / 37 / 96 / 114). No non-ASCII folder names were found. Under the requested *strict* contract, **417** names are not compliant: **114** under characters, **292** under creatures and **11** under moves. This count is a folder-name audit, not a count of unique assets or broken files.

First-level examples:
- Character ID folders: `chr_1286`, `chr_1855`, `chr_3d04` lack batch/title and English name; the existing warden folders already match the intended form.
- Creature ID folders: `cr_aqua_slime` and other `cr_*` folders use the old prefix; `starter_sun_line`, `starter_moon_line`, `starter_star_line` and `line_*_trial_boss` lack the `ch_<batch>_<name>` scheme.
- `prompts`, `backup`, `designed_prompts` must become `_prompts`, `_backup`, `_designed_prompts` in each category.
- Nested `00_settings`, `01_portrait`, `03a_colab`, `03b_blender`, `v2`, `models`, `jobs`, `legacy_*` and similar utility folders need an underscore.

Google Drive category root IDs:
- `characters`: `1NQ4omQINkHXTCbmdd0zSRmyPiGIL4daD`
- `creatures`: `1zAbLoEZMv5BxKmPaEZJJLrt99H3kro9C`
- `moves`: `1alulsIhFcb8m8UKXaA-9-orBCEr__P8B`

## Migration completion — 2026-11-20

The user-approved Drive folder rename has now been performed in place. All **417** noncompliant physical folder names were renamed while retaining each original Drive file/folder ID; no files or `.prompt.md` contents were edited. 12 pre-existing, different folders with the same version name under the same parent received distinct `_vN_duplicate_<id>` names instead of being merged or overwritten. `docs/drive/folder-migration-map-2026-11-20.json` preserves source and destination names, exact IDs, parents, and collisions for audit/rollback.

A full readback recursion of Google Drive returned **433/433** expected folder IDs across levels **50 / 81 / 55 / 37 / 96 / 114**, **zero** unexpected or missing folder IDs, **zero** naming-rule violations, and **zero** mismatched destination names. This verifies the physical tree, not deployed browser behavior or all stored references.

GitHub includes logical-to-physical folder resolution, inverse mapping for legacy game subject IDs, and nested path normalization in `drive-storage.js`; these changes are in the Draft PR branch, **not necessarily the deployed site**. Full runtime regression and deployment remain outstanding.

## Compatibility/rollout

This branch introduces an English folder-name contract and a folder resolver that tries the new physical name before the old one. Physical Drive directory renames have been completed with ID-preserving, collision-safe updates and full metadata readback; the site rollout and full runtime verification still require completion. Renaming hundreds of directories first would break unpatched paths in `drive-storage.js`, `pipeline.js`, `wiki.js`, `tasks.js`, stored manifests, asset references, and historical wiki paths.

Follow-up requirements for fully operational application compatibility:
1. Test the new resolver and all existing category/portrait/Colab/wiki/VFX regression suites.
2. Audit filenames and manifest references; decide whether existing IDs such as `cr_aqua_slime` must remain game IDs. The recommended approach is **folder rename only**, with reverse folder-name-to-stable-asset-ID mapping where the Drive scanner currently uses `entry.name`.
3. Add a resumable, idempotent migration with dry-run output, destination collision detection, pre-change name+folder-ID mapping, and per-folder verification. Preserve every Drive folder/file ID and byte contents. Rollback must use stored original names.
4. Keep legacy logical ID-to-physical-name compatibility until all consumers are migrated; do not repeat the already completed renames.
5. Complete end-to-end website/CI regression, deploy the compatible app, validate asset and prompt reads and writes, and check downstream references.

No Colab/GPU task, asset-file update, or `.prompt.md` content change was performed; **417 Google Drive folders were renamed in place**.
