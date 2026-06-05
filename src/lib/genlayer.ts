// GenLayer RPC client — talks directly to GenLayer JSON-RPC
// No web3/viem dependency needed
// On Vercel: call RPC directly (no proxy needed for Bradbury, it allows CORS)
// On local dev: vite.config.ts proxy handles it
import { keccak256 } from 'js-sha3'
import { getActiveProvider, ensureCorrectNetwork } from './wallet'

interface NetworkConfig {
  name: string
  rpc: string
  chainId: number
  contract: string
}

const NETWORKS: Record<string, NetworkConfig> = {
  studionet: {
    name: 'Studionet',
    rpc: '/api/studio',
    chainId: 61999,
    contract: '0x637e45554dE522Fa5E7323388Fc56964179508ea',
  },
  bradbury: {
    name: 'Bradbury Testnet',
    rpc: '/api/rpc-bradbury',
    chainId: 4221,
    contract: '0xBf3b627Bc1ffb7316AF1B1b5Ec2CdD532416D51E',
  },
}

/* ── Function selectors ── */

function computeSelector(signature: string): string {
  return '0x' + keccak256(signature).slice(0, 8)
}

// Read selectors
const READ_SIGNATURES: Record<string, { selector: string; params: string[] }> = {
  get_settings: { selector: computeSelector('get_settings()'), params: [] },
  get_story: { selector: computeSelector('get_story(string)'), params: ['string'] },
  get_all_stories: { selector: computeSelector('get_all_stories()'), params: [] },
  get_active_stories: { selector: computeSelector('get_active_stories()'), params: [] },
  get_leaderboard: { selector: computeSelector('get_leaderboard()'), params: [] },
  get_chapters: { selector: computeSelector('get_chapters(string,string)'), params: ['string', 'string'] },
  get_players: { selector: computeSelector('get_players(string)'), params: ['string'] },
  get_pot: { selector: computeSelector('get_pot(string)'), params: ['string'] },
}

// Write selectors
const WRITE_SIGNATURES: Record<string, { selector: string; params: string[] }> = {
  create_story: {
    selector: computeSelector('create_story(string,string,string,string,uint256,uint256,string)'),
    params: ['string', 'string', 'string', 'string', 'uint256', 'uint256', 'string'],
  },
  join_story: {
    selector: computeSelector('join_story(string,string,string,uint256)'),
    params: ['string', 'string', 'string', 'uint256'],
  },
  add_chapter: {
    selector: computeSelector('add_chapter(string,string,string,string)'),
    params: ['string', 'string', 'string', 'string'],
  },
  end_story: {
    selector: computeSelector('end_story(string,string,string,string,string)'),
    params: ['string', 'string', 'string', 'string', 'string'],
  },
}

let currentNetwork = 'studionet'

export function setNetwork(net: string): boolean {
  if (NETWORKS[net]) {
    currentNetwork = net
    return true
  }
  return false
}

export function getNetwork() {
  const base = NETWORKS[currentNetwork]
  const custom = typeof window !== 'undefined' ? localStorage.getItem(`custom_contract_${currentNetwork}`) : null
  return {
    ...base,
    id: currentNetwork,
    contract: custom || base.contract
  }
}

export function getNetworks() {
  return Object.entries(NETWORKS).map(([id, n]) => {
    const custom = typeof window !== 'undefined' ? localStorage.getItem(`custom_contract_${id}`) : null
    return { id, ...n, contract: custom || n.contract }
  })
}

/* ── ABI encoding ── */

function encodeUint256(value: number | bigint | string): string {
  return BigInt(value).toString(16).padStart(64, '0')
}

function encodeStringBytes(str: string): { head: string; length: number } {
  const encoded = new TextEncoder().encode(str)
  const length = encodeUint256(encoded.length)
  const hexData = Array.from(encoded).map((b: number) => b.toString(16).padStart(2, '0')).join('')
  const paddedData = encoded.length > 0 ? hexData.padEnd(Math.ceil(hexData.length / 64) * 64, '0') : ''
  return {
    head: length + paddedData,
    length: 32 + (encoded.length > 0 ? Math.ceil(encoded.length / 32) * 32 : 0),
  }
}

function abiEncode(types: string[], values: (string | number | bigint)[]): string {
  if (types.length !== values.length) throw new Error('Type/value count mismatch')

  const headSize = types.length * 32 // bytes
  let headParts: string[] = []
  let tailParts: string[] = []
  let tailOffset = headSize

  for (let i = 0; i < types.length; i++) {
    const type = types[i]
    const value = values[i]

    if (type === 'uint256') {
      headParts.push(encodeUint256(value))
    } else if (type === 'string') {
      // Dynamic type — head contains offset, tail contains data
      headParts.push(encodeUint256(tailOffset))
      const encoded = encodeStringBytes(String(value))
      tailParts.push(encoded.head)
      tailOffset += encoded.length
    }
  }

  return headParts.join('') + tailParts.join('')
}

/* ── RPC ── */

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const network = getNetwork()
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

/* ── Read contract ── */

export async function readContract(functionName: string, args: (string | number | bigint)[] = []): Promise<unknown> {
  const network = getNetwork()
  const fn = READ_SIGNATURES[functionName]
  if (!fn) throw new Error(`Unknown read function: ${functionName}`)

  const calldata = fn.selector + abiEncode(fn.params, args)

  try {
    const result = await rpcCall('eth_call', [{
      to: network.contract,
      data: calldata.toLowerCase(),
    }, 'latest'])

    return parseResult(result as string)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`readContract(${functionName}):`, message)
    return null
  }
}

/* ── Write contract (via MetaMask) ── */

export async function writeContract(
  functionName: string,
  args: (string | number | bigint)[],
  from: string,
): Promise<string> {
  const network = getNetwork()
  const fn = WRITE_SIGNATURES[functionName]
  if (!fn) throw new Error(`Unknown write function: ${functionName}`)
  if (fn.params.length !== args.length) {
    throw new Error(`${functionName} expects ${fn.params.length} args, got ${args.length}`)
  }

  const calldata = fn.selector + abiEncode(fn.params, args)

  const eth = getActiveProvider()
  if (!eth) throw new Error('No active wallet provider available for sending transactions')

  // Enforce correct GenLayer network
  await ensureCorrectNetwork(eth, network.chainId)

  const isBradbury = network.chainId === 4221
  const txParams: any = {
    from,
    to: network.contract,
    data: calldata.toLowerCase(),
  }

  // Only apply EVM gas/price overrides on Bradbury where the OKX gas estimation block occurs.
  // Studionet simulator RPC does not support these parameters and throws an error if they are present.
  if (isBradbury) {
    txParams.gas = '0x1e8480'
    txParams.gasPrice = '0x0'
    txParams.value = '0x0'
  }

  const txHash = await eth.request({
    method: 'eth_sendTransaction',
    params: [txParams],
  })

  return txHash
}

/* ── Parse result ── */

function parseResult(hex: string): unknown {
  if (!hex || hex === '0x') return null
  const raw = hex.startsWith('0x') ? hex.slice(2) : hex

  // Look for JSON object '{' (7b) or JSON array '[' (5b)
  const braceIndex = raw.indexOf('7b')
  const bracketIndex = raw.indexOf('5b')
  
  let jsonStart = -1
  if (braceIndex !== -1 && bracketIndex !== -1) {
    jsonStart = Math.min(braceIndex, bracketIndex)
  } else {
    jsonStart = braceIndex !== -1 ? braceIndex : bracketIndex
  }

  if (jsonStart !== -1) {
    const jsonHex = raw.slice(jsonStart)
    try {
      const jsonStr = jsonHex.match(/.{2}/g)
        ?.map((b: string) => String.fromCharCode(parseInt(b, 16)))
        .join('')
      if (jsonStr) {
        const isObject = jsonStr.startsWith('{')
        const endChar = isObject ? '}' : ']'
        const lastIdx = jsonStr.lastIndexOf(endChar)
        if (lastIdx !== -1) {
          const cleanJson = jsonStr.slice(0, lastIdx + 1)
          return JSON.parse(cleanJson)
        }
      }
    } catch (e) {
      console.warn('Failed to parse decoded JSON string:', e)
    }
  }

  // Fallback to original offset/length ABI parser if no braces are found
  try {
    const offset = parseInt(raw.slice(0, 64), 16) * 2
    const length = parseInt(raw.slice(offset, offset + 64), 16)
    const jsonHex = raw.slice(offset + 64, offset + 64 + length * 2)
    const jsonStr = jsonHex.match(/.{2}/g)
      ?.map((b: string) => String.fromCharCode(parseInt(b, 16)))
      .join('')
    if (jsonStr) return JSON.parse(jsonStr)
  } catch {
    try {
      const str = raw.match(/.{2}/g)
        ?.map((b: string) => String.fromCharCode(parseInt(b, 16)))
        .join('')
      if (str) return JSON.parse(str.replace(/^0+/, ''))
    } catch { /* parsing failed */ }
  }
  return null
}

/* ── Fetch stats ── */

interface StoryData {
  pot?: number
}

interface FetchStatsResult {
  settings: unknown
  totalStories: number
  activeStories: number
  stories: StoryData[]
  active: StoryData[]
  totalPlayers: number
  pot: number
  owner: string
}

export async function fetchStats(): Promise<FetchStatsResult> {
  const [settings, stories, active, leaderboard] = await Promise.all([
    readContract('get_settings'),
    readContract('get_all_stories'),
    readContract('get_active_stories'),
    readContract('get_leaderboard'),
  ]) as [
    Record<string, unknown> | null,
    Record<string, unknown> | null,
    Record<string, unknown> | null,
    Record<string, unknown> | null,
  ]

  return {
    settings,
    totalStories: (stories?.total as number) || 0,
    activeStories: (active?.total as number) || 0,
    stories: (stories?.stories as StoryData[]) || [],
    active: (active?.stories as StoryData[]) || [],
    totalPlayers: (leaderboard?.total_players as number) || 0,
    pot: ((stories?.stories as StoryData[]) || []).reduce((sum: number, s: StoryData) => sum + (s.pot || 0), 0),
    owner: (settings?.owner as string) || '',
  }
}
