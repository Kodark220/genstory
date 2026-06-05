#!/usr/bin/env python3
"""
Deploy AdventureStoryWeaver to GenLayer Bradbury.

Uses genlayer-py SDK (not CLI) for direct deployment.

Usage:
    python3 deploy_bradbury.py
"""

from genlayer_py import create_client
from genlayer_py.chains import testnet_bradbury as bradbury_chain
from eth_account import Account
import os
import sys
import time

CONTRACT_PATH = "C:\\Users\\OLUWATOYOSI\\Desktop\\AISTORY\\contract\\AdventureStoryWeaver.py"
ADDRESS_FILE = "C:\\Users\\OLUWATOYOSI\\Desktop\\AISTORY\\contract\\.contract_address"

print("╔══════════════════════════════════════════════════╗")
print("║   Adventure Story Weaver — Bradbury Deploy       ║")
print("╚══════════════════════════════════════════════════╝")

# Get private key from env or prompt
private_key = os.environ.get("GENLAYER_PRIVATE_KEY")
if not private_key:
    private_key = input("  Enter your GenLayer private key: ").strip()

account = Account.from_key(private_key)
print(f"\n  👤 Deployer: {account.address}")

# Create Bradbury client
print("\n  🔗 Connecting to Bradbury...")
client = create_client(
    chain=bradbury_chain,
    account=account
)

# Read contract source
print(f"\n  📄 Reading contract...")
with open(CONTRACT_PATH, "r") as f:
    contract_source = f.read()

# Deploy
print("\n  🚀 Deploying...")
try:
    result = client.deploy_contract(
        contract_source,
        args=[0],  # min_stake_wei (owner is auto-set via gl.message.sender_account)
        account=account,
    )
    address = result.get("address", "")
    tx_hash = result.get("tx_hash", "")

    print(f"  ✅ Deploy transaction sent!")
    print(f"  📍 Address: {address}")
    print(f"  🔗 Tx Hash: {tx_hash}")

    # Save address
    with open(ADDRESS_FILE, "w") as f:
        f.write(address)
    print(f"\n  💾 Address saved to {ADDRESS_FILE}")

    # Wait for finalization
    print(f"\n  ⏳ Waiting for finalization (30s)...")
    time.sleep(30)

    # Verify via read
    print(f"\n  🔍 Verifying deployment...")
    try:
        settings = client.read_contract(
            address=address,
            function_name="get_settings",
            args=[],
            account=account,
            raw_return=True
        )
        print(f"  ✅ Contract verified! Settings: {settings}")
    except Exception as e:
        print(f"  ⚠️  Verification note: {e}")
        print(f"  (Bradbury may still be finalizing — try again in 30s)")

    print(f"\n  🎭 Ready!")
    print(f"  📍 Contract: {address}")

except Exception as e:
    print(f"\n  ❌ Deployment failed: {e}")
    sys.exit(1)
