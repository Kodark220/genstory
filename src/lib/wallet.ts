// Wallet connector implementing EIP-6963 (Multi-Injected Provider Discovery)
// Dynamically discovers and connects to MetaMask, OKX Wallet, Rabby, Coinbase Wallet, etc.

const STORAGE_KEY = 'genstory_wallet'
const PROVIDER_RDNS_KEY = 'genstory_wallet_rdns'

export interface WalletState {
  address: string
  chainId: number
}

export interface EIP6963ProviderDetail {
  info: {
    uuid: string
    name: string
    icon: string // SVG data URI
    rdns: string
  }
  provider: any
}

// ── Injected Provider State ──
let announcedProviders: EIP6963ProviderDetail[] = []
const listeners = new Set<(providers: EIP6963ProviderDetail[]) => void>()
let activeProvider: any = null

// ── Listen for EIP-6963 Announcements ──
if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', (event: any) => {
    const detail = event.detail as EIP6963ProviderDetail
    if (!announcedProviders.some(p => p.info.uuid === detail.info.uuid)) {
      announcedProviders.push(detail)
      listeners.forEach(l => l([...announcedProviders]))
    }
  })

  // Request providers immediately
  window.dispatchEvent(new CustomEvent('eip6963:requestProvider'))
}

// Subscribe to discovered providers
export function subscribeProviders(callback: (providers: EIP6963ProviderDetail[]) => void): () => void {
  listeners.add(callback)
  callback([...announcedProviders])

  // Request again to ensure we catch any delayed provider injections
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eip6963:requestProvider'))
  }

  return () => {
    listeners.delete(callback)
  }
}

// Get active provider for sending transactions
export function getActiveProvider() {
  if (activeProvider) return activeProvider

  const savedRdns = localStorage.getItem(PROVIDER_RDNS_KEY)
  if (savedRdns) {
    const detail = announcedProviders.find(p => p.info.rdns === savedRdns)
    if (detail) {
      activeProvider = detail.provider
      return activeProvider
    }
  }

  // Fallback to window.ethereum or window.okxwallet
  if (typeof window !== 'undefined') {
    return (window as any).ethereum || (window as any).okxwallet
  }
  return null
}

// ── Network Switching / Auto-Configuration ──
export async function ensureCorrectNetwork(provider: any, targetChainId: number): Promise<void> {
  if (!provider) return
  const targetChainIdHex = '0x' + targetChainId.toString(16)

  try {
    // Attempt to switch to target network
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainIdHex }],
    })
  } catch (switchError: any) {
    // Code 4902 indicates that the chain has not been added to the wallet
    if (
      switchError.code === 4902 || 
      switchError.message?.includes('Unrecognized chain') ||
      switchError.message?.toLowerCase().includes('switch')
    ) {
      try {
        const isBradbury = targetChainId === 4221
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: targetChainIdHex,
            chainName: isBradbury ? 'GenLayer Bradbury Testnet' : 'GenLayer Studionet',
            nativeCurrency: {
              name: 'GEN',
              symbol: 'GEN',
              decimals: 18
            },
            rpcUrls: [isBradbury ? 'https://rpc-bradbury.genlayer.com' : 'https://studio.genlayer.com/api'],
            blockExplorerUrls: isBradbury ? ['https://explorer.genlayer.com'] : []
          }]
        })
      } catch (addError) {
        console.error('Failed to add network:', addError)
        throw new Error('Please add the GenLayer network to your wallet to continue.')
      }
    } else {
      console.error('Failed to switch network:', switchError)
      throw new Error('Please switch your wallet to the GenLayer network to continue.')
    }
  }
}

// ── Connect via selected provider ──
export async function connectProvider(detail: EIP6963ProviderDetail, targetChainId: number): Promise<WalletState> {
  const provider = detail.provider
  if (!provider) throw new Error(`Provider for ${detail.info.name} is not available`)

  const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' })
  if (!accounts || accounts.length === 0) throw new Error('No accounts returned from wallet')

  // Enforce correct target network
  await ensureCorrectNetwork(provider, targetChainId)

  const chainId = await provider.request({ method: 'eth_chainId' })
  const addr = accounts[0].toLowerCase()

  activeProvider = provider
  localStorage.setItem(STORAGE_KEY, addr)
  localStorage.setItem(PROVIDER_RDNS_KEY, detail.info.rdns)

  // Attach listener to update UI on account change
  provider.on('accountsChanged', (accs: string[]) => {
    if (accs.length === 0) {
      clearWallet()
      window.dispatchEvent(new CustomEvent('wallet-disconnected'))
    } else {
      localStorage.setItem(STORAGE_KEY, accs[0].toLowerCase())
      window.dispatchEvent(new CustomEvent('wallet-changed', { detail: accs[0].toLowerCase() }))
    }
  })
  
  provider.on('chainChanged', () => window.location.reload())

  return { address: addr, chainId: parseInt(chainId, 16) }
}

// ── Connect via legacy/direct window.ethereum or window.okxwallet ──
export async function connectFallback(type: 'okx' | 'ethereum', targetChainId: number): Promise<WalletState> {
  const provider = typeof window !== 'undefined'
    ? (type === 'okx' ? (window as any).okxwallet : (window as any).ethereum)
    : null
    
  if (!provider) throw new Error(`No wallet of type ${type} detected`)

  const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' })
  if (!accounts || accounts.length === 0) throw new Error('No accounts returned from wallet')

  // Enforce correct target network
  await ensureCorrectNetwork(provider, targetChainId)

  const chainId = await provider.request({ method: 'eth_chainId' })
  const addr = accounts[0].toLowerCase()

  activeProvider = provider
  localStorage.setItem(STORAGE_KEY, addr)
  localStorage.setItem(PROVIDER_RDNS_KEY, type === 'okx' ? 'com.okx.wallet' : 'io.metamask')

  provider.on('accountsChanged', (accs: string[]) => {
    if (accs.length === 0) {
      clearWallet()
      window.dispatchEvent(new CustomEvent('wallet-disconnected'))
    } else {
      localStorage.setItem(STORAGE_KEY, accs[0].toLowerCase())
      window.dispatchEvent(new CustomEvent('wallet-changed', { detail: accs[0].toLowerCase() }))
    }
  })
  
  provider.on('chainChanged', () => window.location.reload())

  return { address: addr, chainId: parseInt(chainId, 16) }
}

// ── Session Restoration ──
export function getSavedWallet(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function restoreWallet(): WalletState | null {
  const addr = getSavedWallet()
  if (!addr) return null
  return { address: addr, chainId: 0 }
}

export function clearWallet() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(PROVIDER_RDNS_KEY)
  activeProvider = null
}

// ── Send Transaction helper ──
export async function sendTx(tx: { from: string; to: string; data: string }, targetChainId: number): Promise<string> {
  const provider = getActiveProvider()
  if (!provider) throw new Error('No active wallet provider available. Please connect first.')

  // Enforce correct target network
  await ensureCorrectNetwork(provider, targetChainId)

  const txParams: any = {
    from: tx.from, 
    to: tx.to, 
    data: tx.data
  }

  // Only apply EVM gas/price overrides on Bradbury where the OKX gas estimation block occurs.
  if (targetChainId === 4221) {
    txParams.gas = '0x1e8480'
    txParams.gasPrice = '0x0'
    txParams.value = '0x0'
  }

  const result = await provider.request({
    method: 'eth_sendTransaction',
    params: [txParams],
  })
  return result
}
