#!/usr/bin/env python3
"""Optional personal Hey Jarvis detector for MAZos.

Runs on the owner's Windows PC, never on Vercel. Requires explicit launch and
local packages: openwakeword, sounddevice, numpy. This script DOES NOT record
or save conversation audio, send speech to an API, or execute a task.

openWakeWord Python code: Apache 2.0. Bundled pretrained wake models:
CC BY-NC-SA 4.0; personal/noncommercial use only.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import time
from datetime import datetime, timezone


def atomically_write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    os.replace(temporary, path)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def run(threshold: float, cooldown: float, directory: Path) -> None:
    try:
        import numpy as np
        import sounddevice as sd
        from openwakeword.model import Model
    except ImportError as exc:
        raise SystemExit(
            "Local voice packages missing. In a dedicated Python environment install: "
            "pip install openwakeword sounddevice numpy. " + str(exc)
        )

    status_path = directory / "wakeword-status.json"
    event_path = directory / "wakeword-event.json"
    frame_samples = 1280  # 80 ms of 16 kHz, 16-bit mono PCM
    try:
        detector = Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")
    except Exception as exc:
        atomically_write(status_path, {"at": utc_now(), "status": "error", "detail": "Model not installed"})
        raise SystemExit(
            "Hey Jarvis model unavailable. In the same environment run: "
            'python -c "import openwakeword; openwakeword.utils.download_models()"'
        ) from exc

    last_status = 0.0
    event_id = 0
    print("MAZos local wake-word listener active. No audio is saved. Press Ctrl+C to stop.", flush=True)
    try:
        while True:
            atomically_write(status_path, {"at": utc_now(), "status": "listening", "engine": "openWakeWord"})
            with sd.RawInputStream(samplerate=16000, channels=1, dtype="int16", blocksize=frame_samples) as stream:
                while True:
                    frame, overflow = stream.read(frame_samples)
                    if overflow:
                        continue
                    scores = detector.predict(np.frombuffer(frame, dtype=np.int16))
                    now = time.monotonic()
                    if now - last_status > 2.0:
                        atomically_write(status_path, {"at": utc_now(), "status": "listening", "engine": "openWakeWord"})
                        last_status = now
                    confidence = max((float(score) for name, score in scores.items() if "jarvis" in name.lower()), default=0.0)
                    if confidence >= threshold:
                        event_id += 1
                        atomically_write(event_path, {
                            "id": f"{int(time.time() * 1000)}-{event_id}",
                            "at": utc_now(), "word": "hey jarvis",
                        })
                        detector.reset()
                        print("Wake word detected: allowing brief speech-capture window.", flush=True)
                        break
            # Release audio stream so browser/core can take microphone ownership.
            atomically_write(status_path, {"at": utc_now(), "status": "capture-window", "engine": "openWakeWord"})
            time.sleep(cooldown)
    except KeyboardInterrupt:
        print("Stopping local wake-word listener.", flush=True)
    finally:
        atomically_write(status_path, {"at": utc_now(), "status": "stopped", "engine": "openWakeWord"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=float, default=0.65)
    parser.add_argument("--cooldown", type=float, default=10.0)
    parser.add_argument("--data-dir", type=Path, default=Path(os.getenv("MAZOS_DATA_DIR", "data/mazos")))
    args = parser.parse_args()
    if not (0.35 <= args.threshold <= 0.98):
        parser.error("threshold must be 0.35–0.98")
    if not (4 <= args.cooldown <= 25):
        parser.error("cooldown must be 4–25 seconds")
    run(args.threshold, args.cooldown, args.data_dir)
