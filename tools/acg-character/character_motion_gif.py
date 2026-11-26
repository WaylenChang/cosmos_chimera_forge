"""Build a looping four-panel GIF from the authored clips in a character asset."""

import argparse
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory


PREFERRED = (
    ("Slow walk", ("slow_walk", "walk_slow", "walk", "walking", "慢走", "走路")),
    ("Run", ("run", "running", "sprint", "奔跑", "跑步")),
    ("Crouch", ("crouch", "crouch_idle", "sneak_idle", "squat", "crouch_walk", "sneak_move", "蹲下", "下蹲")),
    ("Jump", ("jump", "jump_up", "leap", "hop", "跳躍")),
    ("Attack", ("attack", "melee_attack", "attack_1", "command_attack", "攻擊")),
    ("Block", ("block", "guard", "parry", "defend", "格擋", "格檔")),
    ("Roll", ("roll", "roll_dodge", "dodge_roll", "dodge", "翻滾")),
    ("Knockdown", ("knockdown", "knock_down", "fall_down", "fall", "defeated", "倒地", "擊倒")),
)
PANELS = tuple(f"{PREFERRED[i][0]} / {PREFERRED[i + 1][0]}"
               for i in range(0, len(PREFERRED), 2))


def choose_clips(clips):
    if not clips:
        raise ValueError("No authored action could be bound to this character.")

    def normalized(name):
        name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name)
        return re.sub(r"[^\w]+", "_", name.casefold()).strip("_")

    ordered = sorted(clips, key=lambda name: (not clips[name], name.casefold(), name))
    names = {name: normalized(name) for name in ordered}
    selected = []
    used = set()
    for _, aliases in PREFERRED:
        matches = (
            name
            for alias in aliases
            for name in ordered
            if names[name] == alias or names[name].endswith("_" + alias)
        )
        exact = next((name for name in matches if name not in used), None)
        selected.append(exact)
        if exact:
            used.add(exact)

    # Reserve the preferred matches before filling gaps. Repeat only after using every clip.
    unused = iter(name for name in ordered if name not in used)
    repeat = iter(ordered * len(PREFERRED))
    return [(name, False) if name else (next(unused, None) or next(repeat), True)
            for name in selected]


def blender_executable(explicit):
    command = explicit or os.environ.get("BLENDER")
    if command:
        return command
    found = shutil.which("blender")
    if found:
        return found
    if os.name == "nt":
        installs = (Path(os.environ["ProgramFiles"]) / "Blender Foundation").glob("*/blender.exe")
        found = max(installs, key=lambda p: tuple(int(n) for n in p.parent.name.split()[-1].split(".")
                                                 if n.isdecimal()), default=None)
        if found:
            return str(found)
    raise ValueError("Blender not found. Set BLENDER or pass --blender.")


def compose_gif(directory, output, selected, clips, size, fps):
    from PIL import Image, ImageDraw, ImageFont

    fonts = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    font_path = next((p for p in (fonts / "msyh.ttc", fonts / "segoeui.ttf") if p.is_file()), None)
    fonts_by_size = {pt: ImageFont.truetype(str(font_path), pt) if font_path
                     else ImageFont.load_default(size=pt) for pt in range(11, 16)}
    font = fonts_by_size[15]
    gutter, header = 8, 46
    tile_height = size + header
    frames = []
    for phase in range(2):
        pairs = selected[phase::2]
        length = max(clips[name]["frames"] for name, _ in pairs)
        for frame in range(length):
            canvas = Image.new("RGB", (2 * size + 3 * gutter, 2 * tile_height + 3 * gutter), "#101720")
            draw = ImageDraw.Draw(canvas)
            for panel, (name, fallback) in enumerate(pairs):
                x = gutter + (panel % 2) * (size + gutter)
                y = gutter + (panel // 2) * (tile_height + gutter)
                draw.rectangle((x, y, x + size - 1, y + tile_height - 1), fill="#202d3a")
                draw.text((x + 8, y + 3), PANELS[panel], font=font, fill="#dce6f0")
                requested = PREFERRED[2 * panel + phase][0]
                caption = f"{requested}{' alt' if fallback else ''}: {name}"
                caption_font = next((candidate for candidate in reversed(fonts_by_size.values())
                                     if draw.textlength(caption, font=candidate) <= size - 16),
                                    fonts_by_size[11])
                if draw.textlength(caption, font=caption_font) > size - 16:
                    while draw.textlength(caption + "...", font=caption_font) > size - 16:
                        caption = caption[:-1]
                    caption += "..."
                draw.text((x + 8, y + 24), caption, font=caption_font,
                          fill="#ffcf87" if fallback else "#a8d7fb")
                clip_id = clips[name]["id"]
                clip_frame = min(frame, clips[name]["frames"] - 1)
                with Image.open(directory / f"{clip_id:02d}-{clip_frame:05d}.png") as image:
                    image = image.convert("RGBA")
                    canvas.paste(image, (x, y + header), image)
            frames.append(canvas)

    durations = [10 * (round((i + 1) * 100 / fps) - round(i * 100 / fps))
                 for i in range(len(frames))]
    frames[0].save(output, format="GIF", save_all=True, append_images=frames[1:],
                   duration=durations, loop=0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Character .blend or .glb")
    parser.add_argument("-o", "--output", type=Path, help="Defaults to SOURCE_motion.gif")
    parser.add_argument("--blender", help="Path to Blender 4.4 or newer")
    parser.add_argument("--size", type=int, default=320, help="Square render size per panel (default: 320)")
    parser.add_argument("--fps", type=int, default=12, help="Preview sample rate (default: 12)")
    parser.add_argument("--yaw", type=float, default=25, help="Camera angle from character front")
    args = parser.parse_args()
    source = args.source.resolve()
    output = (args.output or source.with_name(source.stem + "_motion.gif")).resolve()
    if source.suffix.lower() not in {".blend", ".glb"} or not source.is_file():
        parser.error("source must be an existing .blend or .glb file")
    if output.suffix.lower() != ".gif" or args.size < 128 or not 1 <= args.fps <= 30:
        parser.error("use a .gif output, size >= 128, and fps between 1 and 30")
    if not math.isfinite(args.yaw):
        parser.error("--yaw must be a finite angle")
    try:
        import PIL
    except ImportError:
        parser.error("Pillow is required. Install it with python -m pip install Pillow")

    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix="motion-gif-", dir=output.parent) as temp:
        directory = Path(temp)
        command = [blender_executable(args.blender), "--background", "--factory-startup",
                   "--disable-autoexec", "--python-exit-code", "1", "--python",
                   str(Path(__file__).with_name("render_character_motion.py")), "--",
                   str(source), temp, str(args.size), str(args.fps), str(args.yaw)]
        subprocess.run(command, check=True)
        manifest = json.loads((directory / "clips.json").read_text(encoding="utf-8"))
        selected = manifest["selected"]
        candidate = directory / "preview.gif"
        compose_gif(directory, candidate, selected, manifest["clips"], args.size, args.fps)
        candidate.replace(output)
    for (requested, _), (actual, fallback) in zip(PREFERRED, selected):
        note = " (fallback)" if fallback else ""
        print(f"{requested}: {actual}{note}")
    print(output)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
