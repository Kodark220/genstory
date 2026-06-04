#!/usr/bin/env bash
# Deploy AdventureStoryWeaver to GenLayer Bradbury
# Usage: bash deploy_bradbury.sh
#
# Prerequisites:
#   - genlayer CLI installed (npm install -g genlayer)
#   - Account with GEN on Bradbury

set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║   Adventure Story Weaver — Bradbury Deploy       ║"
echo "╚══════════════════════════════════════════════════╝"

CONTRACT_PATH="C:\\Users\\OLUWATOYOSI\\Desktop\\AISTORY\\AdventureStoryWeaver.py"

# Switch to Bradbury
echo ""
echo "  🌐 Switching to Bradbury..."
genlayer network set testnet-bradbury

# Check account
echo ""
echo "  👤 Current account:"
ACCOUNT=$(genlayer account list 2>&1 | grep -oP '(0x[0-9a-fA-F]{40})' | head -1)
echo "     $ACCOUNT"

# Deploy
echo ""
echo "  🚀 Deploying contract..."
DEPLOY_OUTPUT=$(genlayer deploy --contract "$CONTRACT_PATH" 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract address
ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP '(0x[0-9a-fA-F]{40})' | head -1)

if [ -n "$ADDRESS" ]; then
    echo ""
    echo "  ✅ Deployed successfully!"
    echo "  📍 Address: $ADDRESS"

    # Save address
    echo "$ADDRESS" > /mnt/c/Users/OLUWATOYOSI/Desktop/AISTORY/.contract_address
    echo ""
    echo "  💾 Address saved to .contract_address"

    # Test with a view call
    echo ""
    echo "  🔍 Verifying deployment..."
    sleep 5  # Wait for finalization
    genlayer call "$ADDRESS" get_settings

    echo ""
    echo "  🎭 Ready! Contract address: $ADDRESS"
else
    echo ""
    echo "  ❌ Deployment failed. Check output above."
    echo "  📄 Full output: $DEPLOY_OUTPUT"
    exit 1
fi
