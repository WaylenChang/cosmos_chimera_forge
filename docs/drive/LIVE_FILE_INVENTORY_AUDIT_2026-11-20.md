# PR #25 — live Drive file inventory and CI continuation (2026-11-20)

## Scope and provenance

- Live Drive project: `cosmos_chimera_forge` (root ID `1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0`).
- Full, per-folder **read-only** metadata scan against the 433 exact folder IDs in `folder-migration-map-2026-11-20.json`.
- Reproducible ID-level inventory: `docs/drive/live-file-inventory-2026-11-20.json`.
- All 433 folders responded; no listing errors or 1,000-entry cap reached. This does **not** assert binary equality, valid contents, matching historical archives, or approval status.

## File inventory

| Category | Folders listed | Direct files |
| --- | ---: | ---: |
| `characters` | 128 | 368 |
| `creatures` | 294 | 1,277 |
| `moves` | 11 | 217 |
| **Total** | **433** | **1,862** |

The listed folders returned 2,245 child entries: 1,862 files and 383 direct folder child records. Those 383 records are edges/child entries, **not** additional distinct folders.

### Findings — do not automatically rename

1. **Three same-parent duplicate GLB filename groups (six exact Drive file IDs)**. A name-only resolver must never select one arbitrarily:
   - `characters/chr_protagonist_roen/_03a_colab/chr_3d04_03a_colab_source.glb`: `10So7a9tTN80AZb0rK0CDH2t0eHozP1Ss`, `187aasLcgBZP6rgW3E10lNFTIBfeoy3Y2`
   - `characters/chr_protagonist_amemori_sumiha/_03a_colab/chr_1855_03a_colab_source.glb`: `13mC4LBYSZMgzWA_U0zsBPUYAtrI7HZzF`, `1kXuodZd2XrmOfuIyUGpSsF4ZJEhnufSK`
   - `characters/chr_protagonist_yeh_chengxi/_03a_colab/chr_1286_03a_colab_source.glb`: `1f6sg1nvmAbUSwbLaMRhpJT9oqUJB29Dr`, `1RXd-JChoqqJceW829cB3_qXc0nAamePV`
   - Resolve via exact file-ID content/provenance and all consumers before collision-safe rename, archival separation or cleanup. No files merged/deleted here.
2. **One non-ASCII filename** `old_驗收說明.txt` (ID `1oKx-CijjxhDukTNfjgAi17opuJGH9XpZ`) is in `characters/_backup/_legacy_colab_runs/`, **outside** active subject-asset filename contract. It is not automatically a contract violation.
3. **648 subject-prefix heuristic candidates**: files under current subject directories whose names do not start with their physical subject prefix (excluding `backup`/`legacy` descendant paths and allowing `<subject>.prompt.md`). This is *triage only* and includes shared cross-form prompts, legacy scripts, manifests, starter Blender builder inputs, and ambiguous assets. It is **not** a verified count of rename-safe violations.
4. The previously documented **20 legacy trial-boss GLBs without production-step provenance** and **168 starter Blender archived reference slots** retain their read-only maps. They cannot be marked `03b_blender` or `final` from filenames alone.

## GitHub Actions trigger and validation

The workflow previously restricted PR verification to bases on `main`, but PR #25 targets `fix/pipeline-stage-prompt-isolation`. Changed to trigger on pull requests to **all** base branches, leaving the Pages build/deploy jobs restricted to `main`. GitHub Actions subsequently started on PR #25.

Initial full Node regression run on this PR: **166/179 passed**, **13 failed**; previously stale naming assumptions and test harnesses were found. Updated seven regression test files for the actual physical asset naming contract, imported `drive-folder-naming.js` into their VM tests, aligned the 45-line creature count, preserved fail-closed selection of ambiguous GLBs, and retained the production deployment gates.

After that test update: **178/179 passed**; the remaining test assumed every creature design line had four authored stages, though certain trial-boss lines only contain one. Updated the check to require 1–4 distinct, valid authored stages without inventing absent records. **A subsequent full CI run and Blender status must still be checked before claiming pass**.

## Deployment and remaining gates

- Do not mass-rename ambiguous GLBs, cross-form prompts, or historical files without source/consumer mapping and collision checks.
- Keep the live Drive `encyclopedia.json`/Wiki content synchronization gated by supported exact in-place replacement and reference verification; the GitHub canonical species names are not automatically proof that all live Drive content is current.
- Verify the final Node/Python/Blender CI run, production build outputs, authenticated browser OAuth/Drive reads/writes, per-form wiki/model rendering, and deployment compatibility before changing PR #25 out of Draft.
- No Colab GPU pipeline was started; no `*.prompt.md` content, model binary, or image bytes were modified during this continuation.
