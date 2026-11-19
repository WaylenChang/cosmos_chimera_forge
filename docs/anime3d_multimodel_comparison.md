# Colab Image-to-3D multi-model comparison (phase 1)

This phase adds a **CPU-only** inventory of candidate meshes. It does not install
models, download weights, run Colab, invoke a GPU, rig models, or approve output.

## Candidate contract

For each approved asset, place generated GLBs at:

```text
<root>/02_3d/colab/<asset-id>/candidates/
  pixal3d/source.glb
  trellis2/source.glb
  hunyuan3d21/source.glb
```

Candidate generation is **not** implemented by this comparison command.
Existing Pixal3D generation remains unchanged. TRELLIS.2 and Hunyuan3D 2.1
require separate pinned upstream adapters, runtime verification and GPU tests.

## Read-only inventory

```bash
python scripts/anime3d_compare.py \
  --root /path/to/characters \
  --asset-id mdl-yeh-chengxi-compare-v1 \
  --backends pixal3d trellis2 hunyuan3d21
```

To save a report, add `--report /path/to/characters/02_3d/colab/mdl-yeh-chengxi-compare-v1/comparison.json`.
No `--execute` flag exists; this command never runs inference.

## Safety and quality gates

- Missing/invalid candidate GLBs are reported; no score is fabricated.
- Valid GLB structure is **not** a quality, topology or rigging certification.
- Default visual review weights: face 30, hair 20, clothing 20, accessories 15,
  texture 10, mesh 5. These are metadata only; scoring is not automated.
- Selection stays null and `human_approved` stays false.
- Existing SkinTokens, Blender, animation, Drive review and shutdown flows are
  untouched. Only a human-selected, separately validated GLB should enter them.

## Next phases (not yet implemented)

1. Pin official TRELLIS.2 and Hunyuan3D 2.1 versions and license/checkpoint
   requirements; implement separate isolated adapters.
2. Build model-specific preflight (CUDA/PyTorch/VRAM), output conversion,
   texture/material checks and candidate-level resumable execution.
3. Generate standardized orthographic/face previews and record human scores.
4. Validate the selected candidate with SkinTokens and Blender before formal
   asset publication. Preserve existing review gates.

Run GPU tests only after explicitly scheduling a Colab session; this phase
requires no GPU verification.
