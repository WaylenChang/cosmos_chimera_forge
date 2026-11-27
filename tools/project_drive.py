"""Resolve the project's Drive folder from a checkout-local mount setting."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
LEGACY_DRIVE_DIR = REPO_ROOT / "Drive"
MOUNT_SETTING = LEGACY_DRIVE_DIR / ".root"


def mounted_drive_root() -> Path | None:
    try:
        configured = MOUNT_SETTING.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return None

    root = Path(configured)
    if not root.is_absolute() or not root.is_dir():
        raise RuntimeError(f"Project Drive mount is unavailable: {configured!r}")
    return root.resolve(strict=True)


def project_drive_root() -> Path:
    return mounted_drive_root() or LEGACY_DRIVE_DIR.resolve()
