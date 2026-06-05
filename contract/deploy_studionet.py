#!/usr/bin/env python3
import requests
# Monkeypatch requests to bypass Cloudflare User-Agent blocks
original_request = requests.Session.request
def patched_request(self, method, url, *args, **kwargs):
    headers = kwargs.get('headers', {})
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    kwargs['headers'] = headers
    return original_request(self, method, url, *args, **kwargs)
requests.Session.request = patched_request

from genlayer_py import create_client
from genlayer_py.chains import studionet as studionet_chain
from eth_account import Account
import os
import sys
import time

CONTRACT_PATH = "C:\\Users\\OLUWATOYOSI\\Desktop\\AISTORY\\contract\\AdventureStoryWeaver.py"

print("==================================================")
print("   Adventure Story Weaver - Studionet Deploy      ")
print("==================================================")

private_key = os.environ.get("GENLAYER_PRIVATE_KEY")
if not private_key:
    private_key = "0x5678a4edece8e3ebfc492d01219254ce18b4088ccec7570c789d7680226a38c8"

account = Account.from_key(private_key)
print(f"\n  Deployer: {account.address}")

print("\n  Connecting to Studionet...")
client = create_client(
    chain=studionet_chain,
    account=account
)

print(f"\n  Reading contract...")
with open(CONTRACT_PATH, "r") as f:
    contract_source = f.read()

print("\n  Deploying...")
try:
    result = client.deploy_contract(
        contract_source,
        args=[0],  # min_stake_wei
        account=account,
    )
    tx_hash = result
    print(f"  Deploy transaction sent! Hash: {tx_hash}")
    print("  Waiting for receipt (5s)...")
    time.sleep(5)
    receipt = client.get_transaction_receipt(tx_hash)
    contract_address = receipt.get("to", "")
    print(f"  Contract Deployed!")
    print(f"  Address: {contract_address}")

    if contract_address:
        # Save to .contract_address
        with open("C:\\Users\\OLUWATOYOSI\\Desktop\\AISTORY\\contract\\.contract_address", "w") as f_addr:
            f_addr.write(contract_address)
        
        # Update src/lib/genlayer.ts
        genlayer_ts_path = "C:\\Users\\OLUWATOYOSI\\Desktop\\AISTORY\\src\\lib\\genlayer.ts"
        with open(genlayer_ts_path, "r") as f_ts:
            content = f_ts.read()
        
        import re
        new_content = re.sub(
            r"(studionet:\s*\{[^}]*?contract:\s*')[0x0-9a-fA-F]+(')",
            rf"\g<1>{contract_address}\g<2>",
            content,
            flags=re.DOTALL
        )
        with open(genlayer_ts_path, "w") as f_ts:
            f_ts.write(new_content)
        print("  Successfully updated genlayer.ts with new contract address.")

except Exception as e:
    print(f"\n  Deployment failed: {e}")
    sys.exit(1)
