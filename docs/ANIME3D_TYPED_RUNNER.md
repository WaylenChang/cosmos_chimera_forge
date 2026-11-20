# Anime3D Typed Pipeline — Six-class and mixed-anatomy execution

The original specification remains \`docs/AI_Agent_Colab_Anime3D_Pipeline.md\`.
This implementation separates **asset themes** (animal/fantasy/mechanical) from
**actual topology** (biped, winged quadruped, aquatic, segmented insect, rigid
mecha, composite organism, etc.). Every catalog \`base_parents\` is mapped to a
default topology. Catalog inference is a suggestion; when the creature is
hybrid, unusual, or anatomy ambiguous, author explicit \`anatomy\`, \`limbs\`
and world-space \`landmarks\` in the per-asset spec.

## Character Colab Image-to-3D v2 (GitHub-maintained)

**Scope:** This opt-in upgrade is for `category=character`, `input_mode=image`, `pipeline=colab`, with `character_colab_workflow: "character-colab/2"`. Existing jobs without this flag keep their previous reproducible execution behavior. Every per-character spec, screenshot, scoring report, GLB and derived asset belongs only in Drive. GitHub owns this generic specification and `docs/pipeline/characters/03a_colab.prompt.md`; Drive's `characters/_prompts/` copy is an ordinary read-only publication mirror (not yet ACL-enforced).

### Reference and calibration prerequisites

The user provides **front + side/back (or a turnaround sheet) + an independent 45° three-quarter image**. The source `source_pack` must be approved in `reviews/<source_pack>.json`; `source_image` must point to the exact front file. The new `reference_views` mapping contains `front`, `three_quarter_45` and either `side`+`back` or `turnaround`, all relative to the approved portrait folder. Source files are hashed into `qa/reference_views.json`; any mismatch requires a new model asset ID. Uncalibrated three-view sheets are **not** passed to Pixal3D as calibrated multi-view: only a `multiview_dir` with verified `transforms.json`, image paths and valid camera matrices can enable `inference_mv.py`.

### Deterministic quality gate

After the first actual generated GLB, **before rigging**, the runner writes `qa/appearance_gate.json` and returns `REVIEW_REQUIRED` if `qa/appearance_review.json` does not exist or is not sufficient. This does not execute a vision model automatically. An independent reviewer or integrated, actually executed visual evaluator must write a report with:
- `schema: "cosmimera-character-appearance-review/1"`, `asset_id`, `model_sha256`, `reference_sha256`, `method: "human"|"external_vision"|"hybrid"`, a nonempty `reviewer`;
- complete `scores` object with normalized [0,1] `silhouette`, `face`, `outfit`, `details`, `texture`, and optional typed `issues` objects with `type` from `missing_angle`, `occlusion`, `geometry`, `identity`, `outfit`, `details`, `texture`, `uncertain`.

Suggested initial thresholds are silhouette .82, face .85, outfit .82, details .80 and texture .76. These are **project heuristics**, not validated perceptual scores. Passing numeric scores allows the existing rigging/Blender QA to proceed; it is **never** the human final approval.

Decision table:

| Issue/evidence | Next action | Guardrail |
| --- | --- | --- |
| Missing/occluded angle | `REQUEST_MV_ADAPTER` | MV-Adapter is a **recommendation only**, not an installed inference step. At most one supplementation pass; keep source identity/poses consistent and supply real calibration before multi-view inference |
| Topology/geometry defect | `REPAIR_GEOMETRY` | Local Blender correction; do not confuse model holes with missing view data |
| Face, silhouette, outfit or identity mismatch | `REVISE_PROMPT_OR_COMPARE_BACKEND` | Targeted prompt/mask/reference update or truly installed alternative model, not seed-only loops; at most 2 re-generations |
| Material/UV/color issue only | `REFINE_TEXTURE` | Repair UV, seams, texture maps and detail fidelity without unnecessary remeshing |
| Uncertain evaluation, retry budget exhausted | `HUMAN_REVIEW_MODEL` | Present candidates to human; do not continue unreviewed |
| Every dimension passed, no issues | `CONTINUE_RIG` | Resume with the same frozen model/spec/review hashes |

Each input/model/backend change must be assigned **a fresh `asset_id`** (the runner prevents changed fingerprints from reusing a result). The module does not automatically re-run, change prompts, generate supplemental images or switch models. It returns an explicit action for an authorized worker to carry out in a new version, preventing repeated, low-evidence generation loops. The gate runs again against each actual candidate.

### Stage and QA

The preflight validates runtime and approved source; reference set validation in the runner additionally checks required v2 views. On `--stage gpu`, missing external appearance review stops at `REVIEW_REQUIRED` *after* initial source generation and before SkinTokens. The notebook's GPU shutdown guard must still execute, including on nonzero process exit. After the reviewer supplies the exact hash-matched report, re-run the same asset/spec/revision, GPU resources as needed for SkinTokens, then `post_gpu` for Blender topology, UV, materials, animation and GLB round-trip checks. Review outputs remain in Drive; GitHub receives only reusable workflow changes.

**Important:** Numeric appearance scoring, MV-Adapter, texture restoration and cross-backend candidate ranking are not claimed as integrated ML services in this PR. Missing evaluators, model weights or calibrated camera transforms must be disclosed rather than simulated.

## Character-only staged Colab appearance gate (`character-colab/2`)

The character Image-to-3D route now supports a separately enabled **hash-bound appearance gate** before SkinTokens/Blender. The spec and approved images remain in Google Drive; only common policy and code belong in GitHub. Require front, side+back or turnaround, and an independent 45-degree view. A turnaround sheet is not calibrated Pixal3D multi-view data; use `multiview_dir` only with real transforms.json poses. `--stage gpu` generates source GLB and stops; a real evaluator must then write `qa/appearance_review.json`, whose model/source hashes and five independent appearance scores are verified before `--stage post_gpu` can rig. Missing or stale scores block. See [Character Colab quality workflow](pipeline/CHARACTER_COLAB_QUALITY.md). Actual MV-Adapter and texture-repair inference are **not yet integrated**; the gate only produces targeted next-action recommendations, not fabricated output. Existing jobs without the `character_colab_workflow` opt-in remain on the legacy route.

## Production path

\`\`\`text
Character / Creature + catalog concept
        │
        ▼
Image-to-3D (approved portrait)     Prompt-to-3D (original design brief)
        │                                      │
        ├─ Tripo API (explicit paid consent)   └─ Blender text adapter
        ├─ AniGen adapter                         (external model runtime)
        ├─ Pixal3D adapter
        └─ PartCrafter adapter
                    │
                    ▼
       actual, nonempty source GLB
                    │
                    ▼
     Blender topology-aware QA / guided rig
     ├─ biped/quad/multi-leg: articulated skeleton
     ├─ winged/aquatic/serpentine: specialized chains
     ├─ plant/tentacle/amorphous: flexible/shape guidance
     └─ rigid machinery/mecha: authored parts, pivots, axes and limits
                    │
                    ▼
       .blend + re-exported .glb + structured QA
                    │
                    ▼
      Manual animation/visual inspection and approval
\`\`\`

**Not a guarantee of output quality:** Blender cannot infer reliable, unique
joints and skin weights from arbitrary newly generated meshes. Provisional
envelope rigs are opt-in and must pass visual deformation QA before publishing.
A re-exported GLB, an approximate motion template, or passing primitive geometry
checks is NOT a final production-ready approval.

## Example: Winged four-legged creature (image)

\`\`\`json
{
  "source_pack": "cr-approved-adult",
  "license_status": "verified",
  "asset_class": "fantasy_creature",
  "anatomy": "winged_quadruped",
  "input_mode": "image",
  "surface_mode": "organic",
  "limbs": {"legs": 4, "wings": 2, "tails": 1},
  "requested_clips": ["idle", "walk", "fly", "land"],
  "poly_budget_triangles": 35000,
  "allow_provisional_rig": false
}
\`\`\`

The image source must exist in \`01_portraits/<source_pack>/\` and an
\`ok\` review must exist in \`reviews/<source_pack>.json\`. To plan:

\`\`\`sh
python scripts/anime3d_universal.py --root /content/drive/MyDrive/project/cosmos_chimera_forge --asset-id mdl-dragon --spec /path/to/dragon.json
\`\`\`

To **actually run** AniGen after installing its compatible, isolated
environment and preparing an executable adapter:

\`\`\`sh
python scripts/anime3d_universal.py --root /content/drive/MyDrive/project/cosmos_chimera_forge --asset-id mdl-dragon --spec /path/to/dragon.json --backend anigen --generator-executable /opt/anigen/adapter --blender /usr/bin/blender --execute
\`\`\`

The adapter is a program (not a shell command string) that accepts:
\`--input PATH --spec PATH --output PATH\`, exits nonzero on failure, and writes
an actual valid GLB to \`--output\`. It must honor the installed model's license,
checkpoint, runtime dependencies, rigging behavior, and hardware requirements.
Each model family should run in its **own CUDA/Torch environment**. Providing a
path to a nonexistent adapter does not enable the backend. An adapter cannot
claim success on a placeholder GLB.

## Example: Prompt-to-3D from original design

\`\`\`json
{
  "asset_class": "fantasy_creature",
  "anatomy": "serpentine",
  "input_mode": "text",
  "appearance": "Original translucent river serpent, three sets of opalescent fins",
  "limbs": {"legs": 0, "tails": 1, "fins": 6},
  "requested_clips": ["idle", "swim", "attack"]
}
\`\`\`

\`\`\`sh
python scripts/anime3d_universal.py --root /content/drive/MyDrive/project/cosmos_chimera_forge --asset-id mdl-serpent --spec /path/to/serpent.json --backend blender_text --generator-executable /opt/creative-blender/adapter --blender /usr/bin/blender --execute
\`\`\`

This does **not** quietly fall back to an unrelated model or the previous
image generation job. The separately installed adapter must itself produce the
original model. For text-based **creatures only**, the model must reference an original
wiki at `wiki/creatures/<subject_id>_<stage>_wiki.md` for every creature stage, or a backward-compatible
legacy `bestiary.md` only for reading historical assets. Image-to-3D and Prompt-to-3D
share exactly the same stage-specific wiki identity, and model packages reference it via
`manifest.encyclopedia_path`; do not generate copies per modeling branch.

## Built-in AniGen / Pixal3D / PartCrafter execution

Three model adapters now call the published upstream CLI directly, without
requiring you to implement your own wrapper. Install each external repository,
its compatible model weights, CUDA/Torch dependencies and the exact version
recommended by that project. Do not install conflicting GPU dependencies into
the same Python environment.

Configure a local JSON file using
[anime3d_backends.example.json](anime3d_backends.example.json):

\`\`\`json
{
  "anigen": {"repo": "/opt/models/AniGen", "python": "/opt/envs/anigen/bin/python"},
  "pixal3d": {"repo": "/opt/models/Pixal3D", "python": "/opt/envs/pixal3d/bin/python", "low_vram": true, "attn_backend": "sdpa"},
  "partcrafter": {"repo": "/opt/models/PartCrafter", "python": "/opt/envs/partcrafter/bin/python"}
}
\`\`\`

Execute with, for example:

\`\`\`sh
python scripts/anime3d_universal.py \
  --root /content/drive/MyDrive/project/cosmos_chimera_forge \
  --asset-id mdl-dragon --spec /path/to/approved-dragon.json \
  --backend anigen --backend-config /path/to/backends.json \
  --blender /usr/bin/blender --execute
\`\`\`

Supported official CLI scripts:
- AniGen: \`example.py\` using \`--image_path\`, \`--output_name\`,
  \`--joints_density\`. Requires the actual pretrained weights.
- Pixal3D: \`inference.py\` (single view) or \`inference_mv.py\`
  (calibrated multi-view). Multi-view requires \`multiview_dir\` relative
  to the approved source directory, valid \`transforms.json\` and
  correctly posed camera matrices; it is not a substitute for source review.
- PartCrafter: \`scripts/inference_partcrafter.py\`; preserves separate
  \`part_*.glb\` alongside the merged GLB.

Each run uses a new temporary directory and verifies the resulting glTF 2.0
container before publishing the model into its immutable source folder.
The separate Blender stage exports a \`models/<asset_id>.blend\` and
\`models/<asset_id>.glb\`. Final animated GLBs are re-imported and
their action clips inspected. The original generator output stays under
\`source/<asset_id>.glb\`. No stale output can satisfy a failed generator job.

**Limitations:** These adapters execute the installed official CLIs but do not
provide pretrained checkpoints, GPU/CUDA, environment installation, or artistic
approval. AniGen topology-appropriate anatomical skeletons must still be
visually reviewed. PartCrafter output is not by itself a jointed mechanism:
author explicit pivots and joint limits before motion can be approved.
A text-to-3D model generator still needs a separately installed executable
that produces an original GLB. All multi-view/animation QA currently requires
Blender and visual verification. CI runs isolated backend CLI contract tests
plus real Blender smoke tests with synthetic data (no downloaded weights).

## Existing model QA

\`\`\`sh
python scripts/anime3d_universal.py --root /content/drive/MyDrive/project/cosmos_chimera_forge --asset-id mdl-existing --spec /path/to/spec.json --backend existing --input-model /path/to/model.glb --blender /usr/bin/blender --execute
\`\`\`

A profile contains \`qa_checks\`, \`rig_strategy\`, \`backend_priority\`,
\`motion_plan\`, \`warnings\` and \`unsupported\`. Generated QA contains hard
checks, missing materials/UVs, requested vs. actual clip names, Blender
export/import result, explicit or provisional rig state, and outstanding
visual/physics checks. \`passed\` remains false until final human approval.
No asset is automatically moved to \`03_completed\`.

For rigid components, supply:

\`\`\`json
{
  "parts": [
    {
      "object": "Hatch",
      "pivot": [0, 0, 1.2],
      "joint": "hinge",
      "axis": [0, 1, 0],
      "min": 0,
      "max": 1.57
    }
  ]
}
\`\`\`

Component names must match actual mesh objects. Physical engineering constraints,
including colliders and mechanical linkage, need additional verification.


## Anatomy coverage and acceptance gates

All six asset classes are routed independently from visual catalog themes.
The topology profile is the execution contract, not a claim that every model
can be rigged without landmarks or a working model backend.

| Asset family | Topologies | Rig/motion path | Final acceptance blocker |
| --- | --- | --- | --- |
| Characters / humanoids | `biped`, `winged_biped` | Skinned character bones; independent wing chains where needed | Correct weights, face/garment clearance, clip review |
| Monsters | `biped`, `tentacled`, `hybrid`, multi-leg variants | Topology-specific guides; ambiguous hybrids require authored landmarks | Every distinct appendage identified and animated |
| Animals | `quadruped`, `avian`, `aquatic`, `hexapod`, `octopod` | Leg gaits, fin/spine, or wing chains, never human fallback | Ground/water contact and limb topology |
| Fantasy creatures | `winged_quadruped`, `winged_biped`, `serpentine`, `plant`, `amorphous`, `object`, `hybrid` | Wings, body chains, object transforms or specialized procedural channels | Pose sweeps, silhouette and self-intersections |
| Machinery | `mechanism`, `object` | Rigid parts, authored pivots/axis/limits; no soft-skin default | Motion linkage and collision sweep |
| Robots / mecha | `humanoid_mecha`, `quadruped_mecha`, `multi_leg_mecha` | Rigid articulated assemblies, leg count retained | Armor clearance, joint limits, planted feet |

When no `anatomy` is specified, robot leg counts choose two-legged,
four-legged or multi-legged **mecha** routes before organic insect/quadruped
rules; explicitly authored anatomy always takes precedence. The browser and
Python planner both apply this rule.

**What is implemented:** typed planning and routing, selectable external
generators, source validation, guide rig construction (opt-in), original
GLB preservation, rigid authored pivots, procedural animation generation where
a matching armature/part channel exists, Blender QA, multiple preview angles,
GLB export/reimport and animation-track checks, resumable job state and tests.

**What is not automatic:** complete commercial-quality skin weights, approved
character anatomy for arbitrary generated meshes, all requested motions for
every unusual topology, semantics/kinematics inferred from raw PartCrafter
pieces, vendor model installation, and final artistic/Unity approval. Missing
rig or missing motion channels must remain `QA_PENDING` or
`REVIEW_REQUIRED`; they are not complete deliverables. Real production
execution needs the upstream model weights and source assets.

## Execution and status rules

- Dry-run is default. \`--execute\` permits configured local runtime activity,
  **not** paid Tripo activity.
- Tripo additionally requires \`--backend tripo --allow-paid-tripo\` and
  \`TRIPO_API_KEY\`. Tripo's currently implemented connector supports a limited
  set of topologies; unknown rig/motion must not be labeled supported.
- For mesh creation adapters, model weights, cloud services, external auth,
  Colab GPU availability, Blender installation and artistic inspection are not
  bundled here. They must be provisioned in the actual execution environment.
- \`QUEUED\` means planned. \`QA_PENDING\` means required checks could not run
  or passed insufficiently. \`REVIEW_REQUIRED\` means a real asset exists but
  still needs visual review, or an incompatible backend blocked execution.
- The type-specific Blender script is intentionally conservative:
  \`automated_pass\` and \`passed\` are distinct; no model is auto-approved.
- The notebook \`notebooks/07_batch_runner.ipynb\` exposes backend selection,
  dry-run, adapter executable path, Blender and paid consent separately.

## Verification

\`\`\`sh
python -m compileall -q scripts
python -m unittest discover -s tests -p 'test_anime3d*.py' -v
# Install Blender to run non-skipped mesh/animation integration tests
node --test tools/tests/*.cjs
\`\`\`

CI validates routing, catalog-parent coverage, missing-backend failure,
no fabricated asset, browser prompt integration and pre-existing tasks. Full
rendered-pose, Blender-version, GPU model and vendor API integration tests
require actual model/checkpoint installation and representative approved assets.
