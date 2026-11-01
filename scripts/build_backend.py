"""Package the Lambda function into backend/build for CDK deployment."""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
BUILD_DIR = BACKEND_DIR / "build"
APP_DIR = BACKEND_DIR / "app"
REQ_FILE = BACKEND_DIR / "requirements-lambda.txt"


def main() -> None:
    print(f"Building Lambda package in {BUILD_DIR}...")
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)

    # Write lambda-specific requirements (exclude boto3 which is native to Lambda)
    reqs = [
        "pydantic>=2.7.0,<3.0.0",
        "pydantic-core>=2.18.0,<3.0.0",
        "typing-extensions>=4.10.0",
        "annotated-types>=0.6.0",
    ]
    REQ_FILE.write_text("\n".join(reqs), encoding="utf-8")

    # Install dependencies targeting Linux x86_64
    cmd = [
        sys.executable,
        "-m",
        "pip",
        "install",
        "-r",
        str(REQ_FILE),
        "--target",
        str(BUILD_DIR),
        "--platform",
        "manylinux2014_x86_64",
        "--only-binary=:all:",
        "--python-version",
        "3.12",
        "--no-compile",
    ]
    print("Running:", " ".join(cmd))
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("Warning: targeted pip install failed, falling back to standard pip install:", res.stderr)
        cmd_fallback = [
            sys.executable,
            "-m",
            "pip",
            "install",
            "-r",
            str(REQ_FILE),
            "--target",
            str(BUILD_DIR),
            "--no-compile",
        ]
        subprocess.run(cmd_fallback, check=True)

    # Copy app code
    dest_app = BUILD_DIR / "app"
    shutil.copytree(APP_DIR, dest_app)

    # Clean up __pycache__ and dist-info bloat
    for p in BUILD_DIR.rglob("__pycache__"):
        shutil.rmtree(p, ignore_errors=True)

    print(f"Successfully packaged Lambda into {BUILD_DIR}")


if __name__ == "__main__":
    main()
