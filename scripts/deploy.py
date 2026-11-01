"""End-to-end deployment script for Silk Road Atlas.

Steps:
1. Generates a secure random origin secret.
2. Builds the Lambda package (backend/build).
3. Synthesizes / Deploys the CDK stack.
4. Retrieves the Amazon Location API Key value.
5. Builds the web frontend (injecting the API key).
6. Syncs web/dist to the S3 bucket.
7. Invalidates the CloudFront cache.
"""

from __future__ import annotations

import json
import secrets
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INFRA_DIR = ROOT / "infra"
WEB_DIR = ROOT / "web"
PYTHON = sys.executable


def run(cmd: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    print(f"\n>> Running: {' '.join(cmd)} (cwd={cwd or ROOT})")
    return subprocess.run(cmd, cwd=cwd or ROOT, check=check, text=True, shell=True)


def main() -> None:
    import boto3
    region = "us-east-1"
    account_id = boto3.client("sts").get_caller_identity()["Account"]
    print(f"=== Silk Road Atlas Deployment (Account: {account_id}, Region: {region}) ===")

    # 1. Secret for CloudFront <-> API Gateway origin verification
    origin_secret = secrets.token_urlsafe(32)
    import os
    os.environ["ORIGIN_SECRET"] = origin_secret

    # 2. Build Lambda backend
    print("\n[1/6] Packaging backend...")
    run([PYTHON, "scripts/build_backend.py"])

    # 3. Check CDK bootstrap
    print("\n[2/6] Verifying CDK Bootstrap...")
    chk = subprocess.run(
        ["aws", "cloudformation", "describe-stacks", "--stack-name", "CDKToolkit", "--region", region],
        capture_output=True,
        text=True,
    )
    if chk.returncode != 0:
        print("Bootstrapping CDK in", region, "...")
        run(["npx", "cdk", "bootstrap", f"aws://{account_id}/{region}"], cwd=INFRA_DIR)

    # 4. Deploy CDK stack
    print("\n[3/6] Deploying infrastructure with CDK...")
    run(
        [
            "npx",
            "cdk",
            "deploy",
            "--require-approval",
            "never",
            "--outputs-file",
            "outputs.json",
            "-c",
            f"originSecret={origin_secret}",
        ],
        cwd=INFRA_DIR,
    )

    outputs_file = INFRA_DIR / "outputs.json"
    if not outputs_file.exists():
        raise FileNotFoundError(f"CDK outputs file not found: {outputs_file}")

    outputs = json.loads(outputs_file.read_text(encoding="utf-8")).get("SilkRoadAtlas", {})
    bucket_name = outputs.get("SiteBucketName")
    dist_id = outputs.get("DistributionId")
    site_url = outputs.get("SiteUrl")
    key_name = outputs.get("MapsApiKeyName")

    print("\nDeployment outputs:")
    print("  Bucket:", bucket_name)
    print("  Distribution:", dist_id)
    print("  Site URL:", site_url)
    print("  Key Name:", key_name)

    # 5. Fetch Maps API key value
    print("\n[4/6] Retrieving Amazon Location Maps API key value...")
    import boto3
    loc = boto3.client("location", region_name=region)
    key_desc = loc.describe_key(KeyName=key_name)
    api_key_value = key_desc["Key"]
    print("  Key retrieved successfully.")

    # 6. Build Web frontend
    print("\n[5/6] Building web frontend with Vite...")
    env_local = WEB_DIR / ".env.production"
    env_local.write_text(
        f"VITE_AWS_REGION={region}\nVITE_LOCATION_API_KEY={api_key_value}\nVITE_API_BASE=/api\n",
        encoding="utf-8",
    )
    import os
    env_vars = os.environ.copy()
    env_vars["VITE_AWS_REGION"] = region
    env_vars["VITE_LOCATION_API_KEY"] = api_key_value
    env_vars["VITE_API_BASE"] = "/api"
    subprocess.run(["npm", "run", "build"], cwd=WEB_DIR, check=True, text=True, env=env_vars, shell=True)

    # 7. Sync to S3 & invalidate CloudFront
    print("\n[6/6] Syncing assets to S3 and invalidating CloudFront cache...")
    run(["aws", "s3", "sync", "dist", f"s3://{bucket_name}", "--delete"], cwd=WEB_DIR)
    run(["aws", "cloudfront", "create-invalidation", "--distribution-id", dist_id, "--paths", "/*"])

    print("\n" + "=" * 50)
    print(f"DEPLOYMENT COMPLETE! Live site: {site_url}")
    print("=" * 50)


if __name__ == "__main__":
    main()
