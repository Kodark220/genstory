#!/usr/bin/env python3
"""
Deploy the AdventureStoryWeaver on GenLayer.

Usage:
    python deploy.py                    # Deploy to Studionet
    python deploy.py --network bradbury # Deploy to Bradbury
"""

from genlayer import *
import json
import sys

# Parse args
network = 'studionet'
rpc_url = 'https://studio.genlayer.com/api'

if '--network' in sys.argv:
    idx = sys.argv.index('--network')
    if idx + 1 < len(sys.argv):
        network = sys.argv[idx + 1]
        if network == 'bradbury':
            rpc_url = 'https://rpc-bradbury.genlayer.com'

# Connect
client = GenLayerClient(network=network, rpc_url=rpc_url)
my_address = client.account.address

print("╔══════════════════════════════════════════════════╗")
print("║   Random Adventure Story Weaver — Deploy         ║")
print("╚══════════════════════════════════════════════════╝")
print(f"  Network:  {network}")
print(f"  Deployer: {my_address}")

# Deploy
print("\n  🚀 Deploying...")
contract = client.deploy_contract(
    '/mnt/c/Users/OLUWATOYOSI/Desktop/AISTORY/AdventureStoryWeaver.py',
    constructor_args=[my_address]  # owner = you, min_stake = 0 (free to play)
)

print(f"\n  ✅ Deployed!")
print(f"  📍 Address: {contract.address}")

# Verify
settings = contract.get_settings()
print(f"\n  📋 Settings:")
print(f"     Owner:           {settings['owner']}")
print(f"     Min Stake:       {settings['min_stake']} wei")
print(f"     Max Chapters:    {settings['max_chapters_default']}")
print(f"     Platform Fee:    {settings['platform_fee_bps']} bps")
print(f"     Total Stories:   {settings['total_stories']}")

print(f"\n  🎭 Ready! Contract address: {contract.address}")
