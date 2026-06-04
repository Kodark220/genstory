// GenLayer RPC client — talks directly to GenLayer JSON-RPC
// No web3/viem dependency needed
// On Vercel: call RPC directly (no proxy needed for Bradbury, it allows CORS)
// On local dev: vite.config.ts proxy handles it
const IS_VERCEL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')

const NETWORKS = {
  studionet: {
    name: 'Studionet',
    rpc: IS_VERCEL ? 'https://studio.genlayer.com/api' : '/api/studio',
    chainId: 61999,
    contract: '0x8836b45b95718dFEEb2bDd464201fD4A01195C23',
  },
  bradbury: {
    name: 'Bradbury Testnet',
    rpc: IS_VERCEL ? 'https://rpc-bradbury.genlayer.com' : '/api/rpc-bradbury',
    chainId: 4221,
    contract: '0x2eE92ba9bfa4FFd32293828ed28F463ed2b55c50',
  },
}

// Function signatures (keccak256 first 4 bytes pre-computed)
// get_settings() -> 0x5f3428e1
// get_story(string) -> 0xee3fd738
// get_all_stories() -> 0x5b5c60e8
// get_active_stories() -> 0x32b61e8c
// get_leaderboard() -> 0x9b28d5f6
// get_chapters(string) -> 0x3f5c9c87
// get_players(string) -> 0x474313d0
// get_pot(string) -> 0xf0e7a294

const SIGNATURES = {
  get_settings: '0x5f3428e1',
  get_story: '0xee3fd738',
  get_all_stories: '0x5b5c60e8',
  get_active_stories: '0x32b61e8c',
  get_leaderboard: '0x9b28d5f6',
  get_chapters: '0x3f5c9c87',
  get_players: '0x474313d0',
  get_pot: '0xf0e7a294',
}

let currentNetwork = 'bradbury'

export function setNetwork(net) {
  if (NETWORKS[net]) {
    currentNetwork = net
    return true
  }
  return false
}

export function getNetwork() {
  return { ...NETWORKS[currentNetwork], id: currentNetwork }
}

export function getNetworks() {
  return Object.entries(NETWORKS).map(([id, n]) => ({ id, ...n }))
}

// ABI-encode a string for eth_call (padded to 32 bytes)
function encodeString(str) {
  const hex = '0x' + [...new TextEncoder().encode(str)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  // Offset (32 bytes) + length (32 bytes) + data (padded)
  const offset = '0'.repeat(64) // offset = 0x20 (32 bytes from start)
  const length = BigInt(str.length).toString(16).padStart(64, '0')
  const padded = hex.slice(2).padEnd(64, '0')
  return offset + length + padded
}

async function rpcCall(method, params) {
  const network = NETWORKS[currentNetwork]
  const res = await fetch(network.rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))
  return data.result
}

export async function readContract(functionName, args = []) {
  const network = NETWORKS[currentNetwork]
  const sig = SIGNATURES[functionName]
  if (!sig) throw new Error(`Unknown function: ${functionName}`)

  // Build calldata: selector + encoded args
  let calldata = sig
  for (const arg of args) {
    if (typeof arg === 'string') {
      calldata += encodeString(arg)
    } else if (typeof arg === 'number' || typeof arg === 'bigint') {
      calldata += BigInt(arg).toString(16).padStart(64, '0')
    }
  }

  try {
    const result = await rpcCall('eth_call', [{
      to: network.contract,
      data: calldata.toLowerCase(),
    }, 'latest'])

    // Parse the return value — it's ABI-encoded dynamic bytes
    return parseResult(result, functionName)
  } catch (e) {
    console.error(`readContract(${functionName}):`, e.message)
    return null
  }
}

function parseResult(hex, fnName) {
  if (!hex || hex === '0x') return null
  const raw = hex.startsWith('0x') ? hex.slice(2) : hex

  // The return is ABI-encoded bytes. First 32 bytes = offset to data
  // Next 32 bytes = length, then the JSON string
  try {
    const offset = parseInt(raw.slice(0, 64), 16) * 2 // in hex chars
    const length = parseInt(raw.slice(offset, offset + 64), 16)
    const jsonHex = raw.slice(offset + 64, offset + 64 + length * 2)
    const jsonStr = jsonHex.match(/.{2}/g)
      ?.map(b => String.fromCharCode(parseInt(b, 16)))
      .join('')
    if (jsonStr) return JSON.parse(jsonStr)
  } catch {
    // Try raw utf-8 decode
    try {
      const str = raw.match(/.{2}/g)
        ?.map(b => String.fromCharCode(parseInt(b, 16)))
        .join('')
      if (str) return JSON.parse(str.replace(/^0+/, ''))
    } catch {}
  }
  return null
}

export async function fetchStats() {
  const [settings, stories, active, leaderboard] = await Promise.all([
    readContract('get_settings'),
    readContract('get_all_stories'),
    readContract('get_active_stories'),
    readContract('get_leaderboard'),
  ])

  return {
    settings,
    totalStories: stories?.total || 0,
    activeStories: active?.total || 0,
    stories: stories?.stories || [],
    active: active?.stories || [],
    totalPlayers: leaderboard?.total_players || 0,
    pot: (stories?.stories || []).reduce((sum: number, s: any) => sum + (s.pot || 0), 0),
    owner: settings?.owner || '',
  }
}
