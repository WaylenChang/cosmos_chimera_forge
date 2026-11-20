# Character Colab Image-to-3D — CPU view preprocessing

**Scope:** Google Drive character Image-to-3D jobs with an approved independent front view, a 3-view sheet (front/side/back) or independent side and back views, and an independent 45-degree view for quality comparison. Individual assets stay in Drive. This is a **pre-GPU image preparation step**, not GPU inference.

## Stage order

```text
approved front.png + turnaround.png (or side.png/back.png) + 45-degree reference
  -> verify same character / source_pack / human portrait approval
  -> N00 CPU view preprocessing:
       validate paths & hashes
       identify explicit sheet panel order/regions
       split sheet into front/side/back (use separate approved front as canonical Front)
       apply existing alpha, verified mask, or explicitly specified solid-color key
       normalize full-body framing to a transparent square without changing limb directions
       inspect cropped edges, proportions, handedness, alpha, face, outfit and accessories
       save front.png + side.png + back.png + qa/view_preprocess.json
  -> CPU preflight / multi-image backend capability check
  -> GPU multi-image model call (when truly integrated)
  -> appearance QA using the independent 45-degree image
  -> repair decision -> rig -> Blender QA -> human approval
```

## Input contract

- **Both** approved independent `source_image` (front) **and** the approved turnaround/side/back images are **mandatory model image sources**. A character portrait is not a replacement. If the turnaround is one sheet, split it; use the sheet's front panel for cross-view comparison instead of duplicating the canonical front as another model input.
- A supplied independent 45-degree view remains a required QA reference, not a substitute for any missing front, side or back view.
- All inputs and outputs must be linked to the same `subject_id`, `source_pack` and `asset_id`. Original Drive images must not be overwritten. Changed sources, processing settings or model inputs require a new asset ID.
- Detect an unknown panel layout rather than assuming equal thirds. `layout: equal_columns` is allowed **only if the sheet layout has been checked**. Otherwise specify normalized `regions` for front, side and back and the precise panel `order`. Record whether the side image is `left` or `right`. Do not mirror to synthesize another viewpoint.
- Background: accept existing correct RGBA alpha, supplied masks, or an explicit uniform-color key. A solid-color key can erase clothing with the same color or leave halos; request visual verification. Never claim a general AI background remover is already installed. Preserve the original files and record every transformed image's SHA-256.
- Crop each **panel**, not a manually inferred character silhouette. Preserve complete hair, hands, shoes, skirts, accessories and T-pose. For uncalibrated inputs, remove external blank space with alpha bounding boxes, maintain aspect ratio, and use a consistent square output size. The final layout must be checked across views. Do not apply these changes to **calibrated** images without updating intrinsic/extrinsic camera parameters.
- Do not fabricate `transforms.json`. Pixel crops cannot recover reliable camera poses or calibration.

## Proposed per-character spec extension

```json
{
  "asset_id": "<new_asset_id>",
  "subject_id": "<game_subject_id>",
  "category": "character",
  "input_mode": "image",
  "source_image": "_01_portrait/front.png",
  "reference_views": {
    "front": "_01_portrait/front.png",
    "turnaround": "_01_portrait/turnaround.png",
    "three_quarter_45": "_01_portrait/three_quarter_45.png"
  },
  "view_preprocess": {
    "sheet": {
      "layout": "equal_columns",
      "order": ["front", "side", "back"]
    },
    "side_orientation": "left",
    "background": {
      "mode": "solid_color",
      "color": "#505050",
      "tolerance": 12
    }
  }
}
```

The `sheet` object is omitted when `reference_views` names both `side` and `back` as separate files. To avoid assuming equal panel widths, replace `layout` with explicit normalized bounding boxes:

```json
"regions": {
  "front": [0.00, 0.00, 0.32, 1.00],
  "side":  [0.34, 0.00, 0.66, 1.00],
  "back":  [0.68, 0.00, 1.00, 1.00]
}
```

`background.mode`: `existing_alpha`, `mask_file` (supply a `masks` mapping for each processed role with mask dimensions matching the role's cropped image), or `solid_color` (explicit hex key and 0–32 tolerance). The keying method is a deterministic color filter, not neural segmentation. For RGB images with nonuniform backgrounds use a separately validated matting model to prepare masks before this stage.

## CPU command and outputs

Run against the real approved physical character folder, not a guessed directory derived from the game ID:

```sh
python scripts/anime3d_view_preprocess.py \
  --subject-dir /content/drive/MyDrive/cosmos_chimera_forge/characters/<physical_subject_folder> \
  --spec /path/to/approved/asset_spec.json \
  --output /content/drive/MyDrive/cosmos_chimera_forge/characters/<physical_subject_folder>/_03a_colab/<asset_id> \
  --size 1024
```

The example Drive mount path is illustrative; verify the actual Colab mount. The command writes:

```text
_03a_colab/<asset_id>/
  inputs/
    front.png
    side.png
    back.png
  qa/
    view_preprocess.json
```

Receipt includes original and derived SHA-256 hashes, panel pixel boxes, side orientation, source bounding boxes, warnings, and `inference_executed: false` / `views_consumed_by_backend: false`. `status: REVIEW_REQUIRED` means **CPU preparation has finished but a model call and visual review have not**.

Re-running identical inputs verifies the same output digests; changed images/settings fail rather than modifying a version in place. The script never writes original images or approvals.

## Gating / backend matrix

| Backend | Can use uncalibrated split front/side/back directly? | Required action |
| --- | --- | --- |
| Pixal3D `inference.py` | No — single-image CLI | Do **not** call it for a mandatory-multiview job |
| Pixal3D `inference_mv.py` | No — requires genuine calibrated views and camera `transforms.json` | Only use a verified calibrated source bundle |
| TRELLIS.2 official single-image route | No | Separate verified multi-image adapter needed |
| Hunyuan3D-2mv | Candidate for explicit multi-view images | Verify and implement this project's actual adapter/CLI contract before use |

**Fail closed:** A preprocessed file existing is not proof that the model used it. Before enabling GPU, verify the selected adapter's actual interface accepts the front + side + back images, the exact view order/orientation and what it does with them. Save its executed command/arguments and per-input hashes to the generated job record. If the selected backend only consumes `source_image`, mark **BLOCKED**; do not silently fall back to single-view inference.

## Manual QA after CPU preprocessing

Review full-body visibility and T-pose, correctly labeled front/side/back orientation, same head-to-body scale and ground baseline, alpha halos and missing hair/props, consistent face/outfit/colors and non-mirrored asymmetry. Mismatched viewpoints or unknown background removal quality => `REVIEW_REQUIRED`; missing inputs, invalid crops, illegal path, inconsistent file digest => `BLOCKED`. Only an actual downstream model/visual reviewer can advance these statuses.

**Implementation boundary:** This PR adds the CPU preparation program and documentation. It does **not** add an automatically calibrated Pixal3D flow, Hunyuan3D runtime, automatic vision-based view consistency scoring, or a signed Google Drive runtime ZIP release. The existing PR #26 Drive ZIP must not be edited in place.
