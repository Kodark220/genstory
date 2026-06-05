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
    contract: '0x4e6D991e6387F8a7C9d16D5143081706Ffb87e76',
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
  return { ...NETWORKS[currentNetwork], id: currentNetwork }
}

export function getNetworks() {
  return Object.entries(NETWORKS).map(([id, n]) => ({ id, ...n }))
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

/* ── GenVM Calldata Encoding (CBOR/RLP) ── */

const TYPE_SPECIAL = 0
const TYPE_PINT = 1
const TYPE_NINT = 2
const TYPE_STR = 4
const TYPE_ARR = 5
const TYPE_MAP = 6

const SPECIAL_NULL = (0 << 3) | TYPE_SPECIAL
const SPECIAL_FALSE = (1 << 3) | TYPE_SPECIAL
const SPECIAL_TRUE = (2 << 3) | TYPE_SPECIAL

function appendUleb128(val: number | bigint): number[] {
  let i = BigInt(val)
  const mem: number[] = []
  if (i === 0n) {
    mem.push(0)
  }
  while (i > 0n) {
    let cur = Number(i & 0x7Fn)
    i = i >> 7n
    if (i > 0n) {
      cur |= 0x80
    }
    mem.push(cur)
  }
  return mem
}

function encodeCalldata(val: unknown): Uint8Array {
  const mem: number[] = []

  function impl(b: unknown) {
    if (b === null || b === undefined) {
      mem.push(SPECIAL_NULL)
    } else if (b === true) {
      mem.push(SPECIAL_TRUE)
    } else if (b === false) {
      mem.push(SPECIAL_FALSE)
    } else if (typeof b === 'number' || typeof b === 'bigint') {
      let val = BigInt(b)
      if (val >= 0n) {
        val = (val << 3n) | BigInt(TYPE_PINT)
        mem.push(...appendUleb128(val))
      } else {
        val = -val - 1n
        val = (val << 3n) | BigInt(TYPE_NINT)
        mem.push(...appendUleb128(val))
      }
    } else if (typeof b === 'string') {
      const bytes = new TextEncoder().encode(b)
      const lb = (bytes.length << 3) | TYPE_STR
      mem.push(...appendUleb128(lb))
      mem.push(...Array.from(bytes))
    } else if (Array.isArray(b)) {
      const lb = (b.length << 3) | TYPE_ARR
      mem.push(...appendUleb128(lb))
      for (const item of b) {
        impl(item)
      }
    } else if (typeof b === 'object') {
      const keys = Object.keys(b as Record<string, unknown>).sort()
      const le = (keys.length << 3) | TYPE_MAP
      mem.push(...appendUleb128(le))
      const encoder = new TextEncoder()
      for (const k of keys) {
        const kBytes = encoder.encode(k)
        mem.push(...appendUleb128(kBytes.length))
        mem.push(...Array.from(kBytes))
        impl((b as Record<string, unknown>)[k])
      }
    } else {
      throw new Error('Unsupported type: ' + typeof b)
    }
  }

  impl(val)
  return new Uint8Array(mem)
}

function numberToBytes(num: number): Uint8Array {
  const hex = num.toString(16)
  const padded = hex.length % 2 === 0 ? hex : '0' + hex
  const bytes = new Uint8Array(padded.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function rlpEncodeBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 1 && bytes[0] < 0x80) {
    return bytes
  }
  if (bytes.length < 56) {
    const header = 0x80 + bytes.length
    const res = new Uint8Array(1 + bytes.length)
    res[0] = header
    res.set(bytes, 1)
    return res
  }
  const lenBytes = numberToBytes(bytes.length)
  const header = 0xb7 + lenBytes.length
  const res = new Uint8Array(1 + lenBytes.length + bytes.length)
  res[0] = header
  res.set(lenBytes, 1)
  res.set(bytes, 1 + lenBytes.length)
  return res
}

function rlpEncodeList(items: Uint8Array[]): Uint8Array {
  let totalLength = 0
  for (const item of items) {
    totalLength += item.length
  }
  if (totalLength < 56) {
    const header = 0xc0 + totalLength
    const res = new Uint8Array(1 + totalLength)
    res[0] = header
    let offset = 1
    for (const item of items) {
      res.set(item, offset)
      offset += item.length
    }
    return res
  }
  const lenBytes = numberToBytes(totalLength)
  const header = 0xf7 + lenBytes.length
  const res = new Uint8Array(1 + lenBytes.length + totalLength)
  res[0] = header
  res.set(lenBytes, 1)
  let offset = 1 + lenBytes.length
  for (const item of items) {
    res.set(item, offset)
    offset += item.length
  }
  return res
}

function encodeReadRequest(methodName: string, args: unknown[] = []): string {
  const calldataObj: Record<string, unknown> = { method: methodName }
  if (args.length > 0) {
    calldataObj.args = args
  }
  const calldataBytes = encodeCalldata(calldataObj)
  const calldataRlp = rlpEncodeBytes(calldataBytes)
  const dummyRlp = rlpEncodeBytes(new Uint8Array([0]))
  const listRlp = rlpEncodeList([calldataRlp, dummyRlp])
  
  return '0x' + Array.from(listRlp).map((b: number) => b.toString(16).padStart(2, '0')).join('')
}

function encodeWriteRequest(methodName: string, args: unknown[] = [], leaderOnly = false): string {
  const calldataObj: Record<string, unknown> = { method: methodName }
  if (args.length > 0) {
    calldataObj.args = args
  }
  const calldataBytes = encodeCalldata(calldataObj)
  const calldataRlp = rlpEncodeBytes(calldataBytes)
  
  const leaderOnlyBytes = leaderOnly ? new Uint8Array([1]) : new Uint8Array([0])
  const leaderOnlyRlp = rlpEncodeBytes(leaderOnlyBytes)
  
  const listRlp = rlpEncodeList([calldataRlp, leaderOnlyRlp])
  return '0x' + Array.from(listRlp).map((b: number) => b.toString(16).padStart(2, '0')).join('')
}

/* ── Read contract ── */

export async function readContract(functionName: string, args: (string | number | bigint)[] = []): Promise<unknown> {
  const network = getNetwork()
  const calldata = encodeReadRequest(functionName, args)

  try {
    const result = await rpcCall('gen_call', [{
      type: 'read',
      to: network.contract,
      from: '0x0000000000000000000000000000000000000000',
      data: calldata,
      transaction_hash_variant: 'latest-nonfinal'
    }])

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

  const calldata = encodeWriteRequest(functionName, args, false)

  const eth = getActiveProvider()
  if (!eth) throw new Error('No active wallet provider available for sending transactions')

  // Enforce correct GenLayer network
  await ensureCorrectNetwork(eth, network.chainId)

  const txParams: any = {
    from,
    to: network.contract,
    data: calldata.toLowerCase(),
    // GenLayer does not support eth_estimateGas on any network.
    // Without explicit gas values, wallets (MetaMask/OKX) hang trying to estimate.
    gas: '0x1e8480',     // 2,000,000
    gasPrice: '0x0',
    value: '0x0',
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
