#!/usr/bin/env python3
"""Sync Google Drive cosmos_chimera_forge folder with local Drive/ directory."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading

if __package__:
    from .project_drive import LEGACY_DRIVE_DIR, REPO_ROOT, mounted_drive_root
else:
    from project_drive import LEGACY_DRIVE_DIR, REPO_ROOT, mounted_drive_root
DRIVE_CONFIG_PATH = REPO_ROOT / "drive-config.js"
FOLDER_MIME = "application/vnd.google-apps.folder"
GOOGLE_NATIVE_EXPORTS = {
    "application/vnd.google-apps.document": (".md", "md"),
    "application/vnd.google-apps.spreadsheet": (".csv", "csv"),
    "application/vnd.google-apps.presentation": (".pdf", "pdf"),
}
SKIP_NAMES = {".sync_state.json", "Thumbs.db", ".DS_Store"}


def read_default_root_id() -> str:
    if DRIVE_CONFIG_PATH.exists():
        text = DRIVE_CONFIG_PATH.read_text(encoding="utf-8")
        m = re.search(r'rootId:\s*"([^"]+)"', text)
        if m:
            return m.group(1)
    return "1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0"


def find_gdrive_bin() -> str:
    found = shutil.which("gdrive")
    if found:
        return found
    fallback = Path.home() / ".gemini/config/plugins/gdrive/skills/gdrive/scripts/gdrive.cmd"
    if fallback.exists():
        return str(fallback)
    raise RuntimeError("找不到 gdrive CLI，請確認已安裝 gdrive 外掛。")


def run_gdrive(gdrive_bin: str, args: list[str]) -> str:
    cmd = [gdrive_bin, *args]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"gdrive {' '.join(args[:3])} 失敗: {err}")
    return proc.stdout


def parse_iso_ts(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()
    except ValueError:
        return 0.0


def sanitize_name(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip()


def list_drive_folder(gdrive_bin: str, folder_id: str) -> list[dict]:
    out = run_gdrive(gdrive_bin, ["readonly", "ls", folder_id, "--json"])
    if not out.strip():
        return []
    data = json.loads(out)
    return data if isinstance(data, list) else []


def walk_drive(
    gdrive_bin: str,
    root_id: str,
    workers: int = 6,
) -> tuple[dict[str, str], dict[str, dict]]:
    """Return (folders_by_relpath, latest_files_by_relpath)."""
    folders: dict[str, str] = {"": root_id}
    files: dict[str, dict] = {}
    lock = threading.Lock()

    def scan_dir(rel_prefix: str, folder_id: str, depth: int) -> list[tuple[str, str, int]]:
        if depth > 14:
            return []
        entries = list_drive_folder(gdrive_bin, folder_id)
        subdirs: list[tuple[str, str, int]] = []
        # Pick latest folder or file if duplicate names exist in Drive.
        seen_folders: dict[str, dict] = {}
        for item in entries:
            name = sanitize_name(item.get("name", ""))
            if not name or name in SKIP_NAMES:
                continue
            mime = item.get("mimeType", "")
            rel = f"{rel_prefix}/{name}" if rel_prefix else name
            if mime == FOLDER_MIME:
                prev = seen_folders.get(rel)
                if not prev or parse_iso_ts(item.get("modifiedTime")) > parse_iso_ts(prev.get("modifiedTime")):
                    seen_folders[rel] = item
            else:
                if mime in GOOGLE_NATIVE_EXPORTS:
                    ext, fmt = GOOGLE_NATIVE_EXPORTS[mime]
                    if not rel.lower().endswith(ext):
                        rel = f"{rel}{ext}"
                    item = {**item, "_export_format": fmt}
                with lock:
                    prev = files.get(rel)
                    if not prev or parse_iso_ts(item.get("modifiedTime")) > parse_iso_ts(prev.get("modifiedTime")):
                        files[rel] = {**item, "rel": rel, "parentId": folder_id}
        for rel, item in seen_folders.items():
            with lock:
                folders[rel] = item["id"]
            subdirs.append((rel, item["id"], depth + 1))
        return subdirs

    queue: list[tuple[str, str, int]] = [("", root_id, 0)]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        while queue:
            futures = [pool.submit(scan_dir, rel, fid, depth) for rel, fid, depth in queue]
            queue = []
            for fut in as_completed(futures):
                queue.extend(fut.result())

    return folders, files


def needs_download(local_path: Path, item: dict) -> bool:
    if not local_path.exists():
        return True
    drive_ts = parse_iso_ts(item.get("modifiedTime"))
    local_stat = local_path.stat()
    if "_export_format" not in item and item.get("size") is not None:
        try:
            drive_size = int(item["size"])
            if drive_size >= 0 and local_stat.st_size != drive_size:
                return True
        except (ValueError, TypeError):
            pass
    return drive_ts > local_stat.st_mtime + 2.0


def download_file(gdrive_bin: str, item: dict, local_path: Path) -> None:
    local_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = local_path.with_name(f".{local_path.name}.tmp")
    try:
        fmt = item.get("_export_format")
        if fmt:
            run_gdrive(gdrive_bin, ["readonly", "export", item["id"], str(tmp_path), "--format", fmt])
        else:
            run_gdrive(gdrive_bin, ["readonly", "download", item["id"], "--out", str(tmp_path)])
        tmp_path.replace(local_path)
        ts = parse_iso_ts(item.get("modifiedTime"))
        if ts > 0:
            os.utime(local_path, (ts, ts))
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def ensure_drive_folder(
    gdrive_bin: str,
    rel_dir: str,
    folders: dict[str, str],
    folder_lock: threading.Lock,
) -> str:
    if not rel_dir or rel_dir == ".":
        return folders[""]
    parts = [p for p in rel_dir.split("/") if p]
    prefix = ""
    parent_id = folders[""]
    for part in parts:
        prefix = f"{prefix}/{part}" if prefix else part
        with folder_lock:
            existing = folders.get(prefix)
        if existing:
            parent_id = existing
            continue
        with folder_lock:
            existing = folders.get(prefix)
            if existing:
                parent_id = existing
                continue
            out = run_gdrive(
                gdrive_bin,
                ["mutate", "mkdir", part, "--parent", parent_id, "--json"],
            )
            created = json.loads(out)
            new_id = created["id"]
            folders[prefix] = new_id
            parent_id = new_id
    return parent_id


def upload_or_update_file(
    gdrive_bin: str,
    local_path: Path,
    rel: str,
    drive_item: dict | None,
    folders: dict[str, str],
    folder_lock: threading.Lock,
) -> str:
    if drive_item:
        if "_export_format" in drive_item:
            return "skip_native"
        run_gdrive(gdrive_bin, ["mutate", "update", drive_item["id"], str(local_path)])
        return "updated"
    rel_dir = "/".join(rel.split("/")[:-1])
    parent_id = ensure_drive_folder(gdrive_bin, rel_dir, folders, folder_lock)
    run_gdrive(gdrive_bin, ["mutate", "upload", str(local_path), "--parent", parent_id])
    return "uploaded"


def collect_local_files(local_dir: Path) -> dict[str, Path]:
    result: dict[str, Path] = {}
    if not local_dir.exists():
        return result
    for path in local_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.name in SKIP_NAMES or path.name.startswith(".") and path.name.endswith(".tmp"):
            continue
        rel = path.relative_to(local_dir).as_posix()
        result[rel] = path
    return result


def sync_drive(
    mode: str,
    root_id: str,
    local_dir: Path,
    workers: int = 6,
    dry_run: bool = False,
) -> dict[str, int]:
    gdrive_bin = find_gdrive_bin()
    local_dir.mkdir(parents=True, exist_ok=True)
    print(f"正在掃描 Google Drive 目錄 ({root_id})...", flush=True)
    folders, drive_files = walk_drive(gdrive_bin, root_id, workers=workers)
    local_files = collect_local_files(local_dir)
    print(
        f"掃描完成：雲端 {len(drive_files)} 個檔案 / {len(folders) - 1} 個資料夾；本地 {len(local_files)} 個檔案。",
        flush=True,
    )

    to_download: list[tuple[str, dict, Path]] = []
    to_upload: list[tuple[str, Path, dict | None]] = []

    if mode in ("pull", "sync"):
        for rel, item in sorted(drive_files.items()):
            local_path = local_dir / rel
            if needs_download(local_path, item):
                to_download.append((rel, item, local_path))

    if mode in ("push", "sync"):
        for rel, local_path in sorted(local_files.items()):
            item = drive_files.get(rel)
            if item is None:
                to_upload.append((rel, local_path, None))
            else:
                drive_ts = parse_iso_ts(item.get("modifiedTime"))
                if local_path.stat().st_mtime > drive_ts + 2.0:
                    to_upload.append((rel, local_path, item))

    stats = {"downloaded": 0, "uploaded": 0, "updated": 0, "skipped": 0, "errors": 0}
    if dry_run:
        print(f"[DRY-RUN] 待下載 {len(to_download)} 檔，待上傳/更新 {len(to_upload)} 檔")
        for rel, _, _ in to_download[:20]:
            print(f"  ↓ {rel}")
        for rel, _, item in to_upload[:20]:
            print(f"  ↑ {rel} ({'update' if item else 'new'})")
        return stats

    if to_download:
        print(f"開始下載 {len(to_download)} 個檔案到 {local_dir} ...", flush=True)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = {
                pool.submit(download_file, gdrive_bin, item, local_path): rel
                for rel, item, local_path in to_download
            }
            for fut in as_completed(futs):
                rel = futs[fut]
                try:
                    fut.result()
                    stats["downloaded"] += 1
                    if stats["downloaded"] % 25 == 0 or stats["downloaded"] == len(to_download):
                        print(f"  已下載 {stats['downloaded']}/{len(to_download)}", flush=True)
                except Exception as exc:
                    stats["errors"] += 1
                    print(f"  [ERROR] 下載 {rel}: {exc}", file=sys.stderr, flush=True)

    if to_upload:
        print(f"開始上傳 {len(to_upload)} 個檔案到 Google Drive ...", flush=True)
        folder_lock = threading.Lock()
        with ThreadPoolExecutor(max_workers=min(4, workers)) as pool:
            futs = {
                pool.submit(upload_or_update_file, gdrive_bin, local_path, rel, item, folders, folder_lock): rel
                for rel, local_path, item in to_upload
            }
            for fut in as_completed(futs):
                rel = futs[fut]
                try:
                    action = fut.result()
                    if action == "uploaded":
                        stats["uploaded"] += 1
                    elif action == "updated":
                        stats["updated"] += 1
                    else:
                        stats["skipped"] += 1
                except Exception as exc:
                    stats["errors"] += 1
                    print(f"  [ERROR] 上傳 {rel}: {exc}", file=sys.stderr, flush=True)

    print(
        f"同步完成：下載 {stats['downloaded']}、新增上傳 {stats['uploaded']}、更新 {stats['updated']}、略過 {stats['skipped']}、錯誤 {stats['errors']}。",
        flush=True,
    )
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Google Drive cosmos_chimera_forge with local Drive/ directory.")
    parser.add_argument("mode", nargs="?", default="pull", choices=["pull", "push", "sync"], help="Sync direction")
    parser.add_argument("--root-id", default=read_default_root_id(), help="Google Drive root folder ID")
    parser.add_argument("--local-dir", type=Path, help="Explicit export directory")
    parser.add_argument("--workers", type=int, default=6, help="Concurrent workers")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without modifying files")
    args = parser.parse_args()

    mounted_root = mounted_drive_root()
    if mounted_root is not None and args.local_dir is None:
        parser.error("This checkout uses the mounted Drive directly. Use --local-dir for an independent export.")
    local_dir = (args.local_dir or LEGACY_DRIVE_DIR).resolve()
    if mounted_root is not None and any(
        local_dir.is_relative_to(root) or root.is_relative_to(local_dir)
        for root in (mounted_root, LEGACY_DRIVE_DIR.resolve())
    ):
        parser.error("The export directory must be separate from the mounted Drive and the checkout's Drive folder.")

    stats = sync_drive(
        mode=args.mode,
        root_id=args.root_id,
        local_dir=local_dir,
        workers=max(1, args.workers),
        dry_run=args.dry_run,
    )
    return 1 if stats["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
