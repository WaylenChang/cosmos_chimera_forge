# Anime3D Typed Pipeline — Six-class and mixed-anatomy execution

The original specification remains \`docs/AI_Agent_Colab_Anime3D_Pipeline.md\`.
This implementation separates **asset themes** (animal/fantasy/mechanical) from
**actual topology** (biped, winged quadruped, aquatic, segmented insect, rigid
mecha, composite organism, etc.). Every catalog \`base_parents\` is mapped to a
default topology. Catalog inference is a suggestion; when the creature is
hybrid, unusual, or anatomy ambiguous, author explicit \`anatomy\`, \`limbs\`
and world-space \`landmarks\` in the per-asset spec.

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
original model. For text-based **creatures only**, the existing prompt-to-3D
task also requires \`bestiary.md\`; image-based creatures and characters do not.

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
node --test tools/tests/*.cjs
\`\`\`

CI validates routing, catalog-parent coverage, missing-backend failure,
no fabricated asset, browser prompt integration and pre-existing tasks. Full
rendered-pose, Blender-version, GPU model and vendor API integration tests
require actual model/checkpoint installation and representative approved assets.
