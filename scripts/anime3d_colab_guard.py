#!/usr/bin/env python3
"""Colab GPU guard, batch queue dispatcher, and idle auto-shutdown.

Enforces strict N00-N08 pipeline ordering across CPU (pre_gpu) -> GPU (gpu) ->
CPU/local (post_gpu) stages and shuts down the Colab GPU runtime whenever the
queue is empty, the GPU batch finishes, or the GPU remains idle.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time


def shutdown_colab_runtime(reason: str, unassign_fn=None) -> bool:
    """Flush pending Drive writes and unassign the Colab GPU runtime."""
    print(f"[GPU-GUARD] Shutting down Colab runtime: {reason}", flush=True)
    if os.name == "posix":
        subprocess.run(["sync"], check=False)
    if unassign_fn is not None:
        unassign_fn(reason)
        return True
    try:
        from google.colab import runtime  # type: ignore

        runtime.unassign()
        return True
    except ImportError:
        print("[GPU-GUARD] google.colab.runtime unavailable; skipping unassign.", flush=True)
        return False


def query_gpu_utilization() -> int | None:
    """Return current GPU utilization percentage via nvidia-smi, or None."""
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if res.returncode != 0 or not res.stdout.strip():
            return None
        return max(int(line.strip()) for line in res.stdout.strip().splitlines() if line.strip().isdigit())
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None


class GpuIdleWatchdog:
    """Monitor GPU activity and trigger shutdown if idle past threshold."""

    def __init__(
        self,
        idle_timeout_sec: float = 180.0,
        poll_interval_sec: float = 15.0,
        util_threshold: int = 5,
        shutdown_fn=None,
        util_fn=query_gpu_utilization,
    ):
        self.idle_timeout_sec = max(0.05, float(idle_timeout_sec))
        self.poll_interval_sec = max(0.05, float(poll_interval_sec))
        self.util_threshold = util_threshold
        self.shutdown_fn = shutdown_fn or (lambda r: shutdown_colab_runtime(r))
        self.util_fn = util_fn
        self._busy = False
        self._last_active = time.monotonic()
        self._stop_event = threading.Event()
        self._triggered = False
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None

    def set_busy(self, busy: bool) -> None:
        with self._lock:
            self._busy = busy
            self._last_active = time.monotonic()

    def touch(self) -> None:
        with self._lock:
            self._last_active = time.monotonic()

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, daemon=True, name="gpu-idle-watchdog")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)

    def _loop(self) -> None:
        while not self._stop_event.wait(self.poll_interval_sec):
            util = self.util_fn()
            with self._lock:
                if self._busy or (util is not None and util >= self.util_threshold):
                    self._last_active = time.monotonic()
                    continue
                idle_for = time.monotonic() - self._last_active
                if idle_for >= self.idle_timeout_sec and not self._triggered:
                    self._triggered = True
                    break
        if self._triggered:
            self.shutdown_fn("idle_timeout")


def _job_state(root: Path, item: dict) -> dict:
    pipeline = item.get("pipeline", "colab")
    state_path = root / "02_3d" / pipeline / item["asset_id"] / "typed_state.json"
    if not state_path.is_file():
        return {}
    try:
        return json.loads(state_path.read_text(encoding="utf8"))
    except (OSError, json.JSONDecodeError):
        return {}


def filter_queue(root: Path, items: list[dict], stage: str) -> list[dict]:
    """Select only jobs eligible for the requested pipeline stage."""
    selected = []
    for item in items:
        state = _job_state(root, item)
        completed = state.get("stage_completed")
        status = state.get("status")
        if stage == "pre_gpu":
            if completed in {"gpu", "post_gpu"} or status in {"GPU_COMPLETED", "REVIEW_REQUIRED", "PASSED"}:
                continue
        elif stage == "gpu":
            if completed in {"gpu", "post_gpu"} or status in {"GPU_COMPLETED", "REVIEW_REQUIRED", "PASSED"}:
                continue
        elif stage == "post_gpu":
            if completed != "gpu" and status != "GPU_COMPLETED":
                continue
        selected.append(item)
    return selected


def build_universal_cmd(
    root: Path,
    item: dict,
    stage: str,
    backend_config: str = "",
    blender: str = "",
    execute: bool = True,
) -> list[str]:
    script = Path(__file__).with_name("anime3d_universal.py")
    cmd = [
        sys.executable,
        str(script),
        "--root",
        str(root),
        "--asset-id",
        item["asset_id"],
        "--spec",
        str(item["spec"]),
        "--backend",
        item.get("backend", "pixal3d"),
        "--pipeline",
        item.get("pipeline", "colab"),
        "--stage",
        stage,
    ]
    if execute and stage != "pre_gpu":
        cmd.append("--execute")
    rig = item.get("rig_backend", "none")
    if rig and rig != "none":
        cmd += ["--rig-backend", rig]
    cfg = item.get("backend_config") or backend_config
    if cfg:
        cmd += ["--backend-config", str(cfg)]
    if item.get("generator_executable"):
        cmd += ["--generator-executable", str(item["generator_executable"])]
    if stage in {"post_gpu", "all"} and blender:
        cmd += ["--blender", blender]
    return cmd


def run_batch(
    root: Path,
    queue_path: Path,
    stage: str,
    backend_config: str = "",
    blender: str = "",
    execute: bool = True,
    auto_shutdown: bool = True,
    idle_timeout_sec: float = 180.0,
    shutdown_fn=None,
    runner_fn=None,
) -> int:
    """Execute a staged batch queue while enforcing GPU auto-shutdown."""
    raw_items = json.loads(queue_path.read_text(encoding="utf8"))
    if not isinstance(raw_items, list):
        raise ValueError("Batch queue must be a JSON array of job objects")
    pending = filter_queue(root, raw_items, stage)
    run_cmd = runner_fn or (lambda argv: subprocess.run(argv, check=False).returncode)

    if stage == "gpu" and not pending:
        if auto_shutdown:
            shutdown_colab_runtime("empty_gpu_queue", unassign_fn=shutdown_fn)
        return 0

    watchdog = None
    if stage == "gpu" and auto_shutdown:
        watchdog = GpuIdleWatchdog(
            idle_timeout_sec=idle_timeout_sec,
            shutdown_fn=lambda r: shutdown_colab_runtime(r, unassign_fn=shutdown_fn),
        )
        watchdog.start()

    exit_code = 0
    try:
        for item in pending:
            if watchdog is not None:
                watchdog.set_busy(True)
            argv = build_universal_cmd(
                root,
                item,
                stage=stage,
                backend_config=backend_config,
                blender=blender,
                execute=execute,
            )
            rc = run_cmd(argv)
            if watchdog is not None:
                watchdog.set_busy(False)
            if rc != 0:
                exit_code = rc
    finally:
        if watchdog is not None:
            watchdog.stop()
        if stage == "gpu" and auto_shutdown:
            shutdown_colab_runtime("gpu_stage_finished", unassign_fn=shutdown_fn)
    return exit_code


def main() -> int:
    p = argparse.ArgumentParser(description="Colab GPU guard and staged batch runner")
    p.add_argument("--root", required=True)
    p.add_argument("--queue", required=True, help="Path to batch_queue.json")
    p.add_argument("--stage", choices=["pre_gpu", "gpu", "post_gpu", "all"], required=True)
    p.add_argument("--backend-config", default="")
    p.add_argument("--blender", default="")
    p.add_argument("--idle-timeout", type=float, default=180.0)
    p.add_argument("--no-auto-shutdown", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    return run_batch(
        root=Path(a.root).resolve(),
        queue_path=Path(a.queue).resolve(),
        stage=a.stage,
        backend_config=a.backend_config,
        blender=a.blender,
        execute=not a.dry_run,
        auto_shutdown=not a.no_auto_shutdown,
        idle_timeout_sec=a.idle_timeout,
    )


if __name__ == "__main__":
    sys.exit(main())
