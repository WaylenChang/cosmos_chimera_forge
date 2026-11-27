#!/usr/bin/env python3
"""Local HTTP server for COSMIMERA with Drive/ filesystem API."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import shutil
import sys
from urllib.parse import parse_qs, unquote, urlparse

if __package__:
    from .project_drive import REPO_ROOT, project_drive_root
else:
    from project_drive import REPO_ROOT, project_drive_root

LOCAL_DRIVE_ROOT = project_drive_root()
FOLDER_MIME = "application/vnd.google-apps.folder"
LOCAL_ID_PREFIX = "local:"


def iso_mtime(stat_result: os.stat_result) -> str:
    return datetime.fromtimestamp(stat_result.st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_rel(raw: str) -> str:
    val = unquote(str(raw or "")).strip()
    if val.startswith(LOCAL_ID_PREFIX):
        val = val[len(LOCAL_ID_PREFIX):]
    val = val.strip("/")
    if not val:
        return ""
    if "\\" in val or "\x00" in val or ":" in val:
        raise ValueError("Invalid relative path")
    parts = val.split("/")
    if any(not p or p in (".", "..") for p in parts):
        raise ValueError("Path traversal is not allowed")
    return "/".join(parts)


def resolve_drive_path(rel: str) -> Path:
    clean = normalize_rel(rel)
    target = (LOCAL_DRIVE_ROOT / clean).resolve() if clean else LOCAL_DRIVE_ROOT
    if target != LOCAL_DRIVE_ROOT and LOCAL_DRIVE_ROOT not in target.parents:
        raise ValueError("Path escapes Drive/ root")
    return target


def entry_metadata(path: Path, rel: str) -> dict:
    st = path.stat()
    is_dir = path.is_dir()
    parent_rel = "/".join(rel.split("/")[:-1])
    mime = FOLDER_MIME if is_dir else (mimetypes.guess_type(path.name)[0] or "application/octet-stream")
    return {
        "id": f"{LOCAL_ID_PREFIX}{rel}" if rel else f"{LOCAL_ID_PREFIX}",
        "name": path.name,
        "path": rel,
        "mimeType": mime,
        "modifiedTime": iso_mtime(st),
        "size": "0" if is_dir else str(st.st_size),
        "parents": [f"{LOCAL_ID_PREFIX}{parent_rel}"],
    }


def drive_has_data() -> tuple[bool, int]:
    if not LOCAL_DRIVE_ROOT.is_dir():
        return False, 0
    count = 0
    for item in LOCAL_DRIVE_ROOT.iterdir():
        if item.name.startswith("."):
            continue
        count += 1
    return count > 0, count


class LocalDriveHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        # Keep console output concise.
        sys.stderr.write(f"[local_server] {format % args}\n")

    def _is_loopback(self) -> bool:
        host = self.client_address[0] if self.client_address else ""
        return host in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def _send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status: int, message: str) -> None:
        self._send_json(status, {"error": message})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/__local_drive__/"):
            if not self._is_loopback():
                self._send_error_json(HTTPStatus.FORBIDDEN, "Loopback access only")
                return
            self._handle_local_get(parsed)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/__local_drive__/"):
            self._send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        if not self._is_loopback():
            self._send_error_json(HTTPStatus.FORBIDDEN, "Loopback access only")
            return
        self._handle_local_post(parsed)

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/__local_drive__/"):
            self._send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        if not self._is_loopback():
            self._send_error_json(HTTPStatus.FORBIDDEN, "Loopback access only")
            return
        self._handle_local_put(parsed)

    def _handle_local_get(self, parsed) -> None:
        qs = parse_qs(parsed.query)
        endpoint = parsed.path[len("/__local_drive__/"):]
        try:
            if endpoint == "status":
                has_data, count = drive_has_data()
                self._send_json(HTTPStatus.OK, {
                    "available": True,
                    "hasData": has_data,
                    "entryCount": count,
                    "rootDir": "Drive",
                })
                return

            if endpoint == "list":
                raw_path = qs.get("path", qs.get("id", [""]))[0]
                rel = normalize_rel(raw_path)
                target = resolve_drive_path(rel)
                if not target.exists() or not target.is_dir():
                    self._send_error_json(HTTPStatus.NOT_FOUND, f"{rel or 'Drive'} 資料夾不存在")
                    return
                items = []
                for child in sorted(target.iterdir(), key=lambda p: p.name.lower()):
                    if child.name.startswith(".") and child.name != ".sync_state.json":
                        continue
                    if child.name == ".sync_state.json":
                        continue
                    child_rel = f"{rel}/{child.name}" if rel else child.name
                    items.append(entry_metadata(child, child_rel))
                self._send_json(HTTPStatus.OK, {"files": items})
                return

            if endpoint == "walk":
                raw_path = qs.get("path", qs.get("id", [""]))[0]
                rel = normalize_rel(raw_path)
                target = resolve_drive_path(rel)
                if not target.exists() or not target.is_dir():
                    self._send_error_json(HTTPStatus.NOT_FOUND, f"{rel or 'Drive'} 資料夾不存在")
                    return
                files = []
                for root_str, dirnames, filenames in os.walk(target):
                    dirnames[:] = sorted(d for d in dirnames if not d.startswith("."))
                    root_path = Path(root_str)
                    depth = len(root_path.relative_to(target).parts)
                    if depth > 12:
                        dirnames.clear()
                        continue
                    for fname in sorted(filenames):
                        if fname.startswith(".") or fname.lower().endswith(".zip"):
                            continue
                        fpath = root_path / fname
                        f_rel_from_target = fpath.relative_to(target).as_posix()
                        f_rel_from_root = f"{rel}/{f_rel_from_target}" if rel else f_rel_from_target
                        meta = entry_metadata(fpath, f_rel_from_root)
                        meta["path"] = f_rel_from_target
                        files.append(meta)
                self._send_json(HTTPStatus.OK, {"files": files})
                return

            if endpoint == "read":
                raw_path = qs.get("path", qs.get("id", [""]))[0]
                rel = normalize_rel(raw_path)
                if not rel:
                    self._send_error_json(HTTPStatus.BAD_REQUEST, "缺少檔案路徑")
                    return
                target = resolve_drive_path(rel)
                if not target.exists() or not target.is_file():
                    self._send_error_json(HTTPStatus.NOT_FOUND, f"{rel} 不存在")
                    return
                data = target.read_bytes()
                mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
                return

            self._send_error_json(HTTPStatus.NOT_FOUND, "Unknown endpoint")
        except ValueError as exc:
            self._send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception as exc:
            self._send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def _handle_local_post(self, parsed) -> None:
        endpoint = parsed.path[len("/__local_drive__/"):]
        try:
            if endpoint == "folder":
                payload = self._read_json_body()
                rel = normalize_rel(payload.get("path", ""))
                create = bool(payload.get("create", False))
                target = resolve_drive_path(rel)
                if not target.exists():
                    if not create:
                        self._send_error_json(HTTPStatus.NOT_FOUND, f"{rel} 資料夾不存在")
                        return
                    target.mkdir(parents=True, exist_ok=True)
                elif not target.is_dir():
                    self._send_error_json(HTTPStatus.CONFLICT, f"{rel} 不是資料夾")
                    return
                self._send_json(HTTPStatus.OK, entry_metadata(target, rel))
                return

            if endpoint == "move":
                payload = self._read_json_body()
                src_rel = normalize_rel(payload.get("fileId", payload.get("fromPath", "")))
                to_dir_rel = normalize_rel(payload.get("toParentId", payload.get("toDir", "")))
                if not src_rel:
                    self._send_error_json(HTTPStatus.BAD_REQUEST, "缺少來源路徑")
                    return
                src_path = resolve_drive_path(src_rel)
                to_dir = resolve_drive_path(to_dir_rel)
                if not src_path.exists():
                    self._send_error_json(HTTPStatus.NOT_FOUND, f"{src_rel} 不存在")
                    return
                to_dir.mkdir(parents=True, exist_ok=True)
                dest_path = to_dir / src_path.name
                if dest_path.exists():
                    self._send_error_json(HTTPStatus.CONFLICT, f"{dest_path.name} 目標已存在")
                    return
                shutil.move(str(src_path), str(dest_path))
                dest_rel = f"{to_dir_rel}/{dest_path.name}" if to_dir_rel else dest_path.name
                self._send_json(HTTPStatus.OK, entry_metadata(dest_path, dest_rel))
                return

            self._send_error_json(HTTPStatus.NOT_FOUND, "Unknown endpoint")
        except ValueError as exc:
            self._send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception as exc:
            self._send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

    def _handle_local_put(self, parsed) -> None:
        endpoint = parsed.path[len("/__local_drive__/"):]
        if endpoint != "write":
            self._send_error_json(HTTPStatus.NOT_FOUND, "Unknown endpoint")
            return
        qs = parse_qs(parsed.query)
        try:
            rel = normalize_rel(qs.get("path", [""])[0])
            if not rel:
                self._send_error_json(HTTPStatus.BAD_REQUEST, "缺少寫入路徑")
                return
            target = resolve_drive_path(rel)
            target.parent.mkdir(parents=True, exist_ok=True)
            length = int(self.headers.get("Content-Length", "0") or "0")
            data = self.rfile.read(length) if length > 0 else b""
            tmp_path = target.with_name(f".{target.name}.tmp")
            try:
                tmp_path.write_bytes(data)
                tmp_path.replace(target)
            finally:
                if tmp_path.exists():
                    tmp_path.unlink(missing_ok=True)
            self._send_json(HTTPStatus.OK, entry_metadata(target, rel))
        except ValueError as exc:
            self._send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception as exc:
            self._send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))


def main() -> int:
    parser = argparse.ArgumentParser(description="Start COSMIMERA local server with Drive/ API.")
    parser.add_argument("--port", type=int, default=8687)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    LOCAL_DRIVE_ROOT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((args.host, args.port), LocalDriveHandler)
    print(f"COSMIMERA 本機伺服器執行中：http://localhost:{args.port} (Drive 目錄：{LOCAL_DRIVE_ROOT})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
