"""Run both the local API proxy and the Vite development server in one terminal."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
WEB_DIR = ROOT / "web"
PYTHON = sys.executable


def main() -> None:
    print("==================================================")
    print("       🐫 Silk Road Atlas - Local Dev Server       ")
    print("==================================================")
    print("Starting backend API server (http://127.0.0.1:8000)...")

    # Start backend server
    backend_proc = subprocess.Popen(
        [PYTHON, "-m", "app.local_server"],
        cwd=BACKEND_DIR,
    )

    time.sleep(1)

    print("Starting Vite frontend server (http://localhost:5173)...")
    try:
        # Start Vite
        shell_cmd = "npm run dev"
        subprocess.run(shell_cmd, cwd=WEB_DIR, shell=True)
    except KeyboardInterrupt:
        print("\nStopping servers...")
    finally:
        backend_proc.terminate()
        try:
            backend_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            backend_proc.kill()
        print("Servers stopped.")


if __name__ == "__main__":
    main()
