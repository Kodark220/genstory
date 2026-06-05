// Wallet connector — EIP-1193 (MetaMask, Rabby)
// Zero dependencies. Works with any injected wallet.

const STORAGE_KEY = 'genstory_wallet'

export interface WalletState {
  address: string
  chainId: number
}

let _walletListenerAttached = false

// ── Persistence ──

export function getSavedWallet(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

function saveState(addr: string) {
  localStorage.setItem(STORAGE_KEY, addr)
}

export function clearWallet() {
  localStorage.removeItem(STORAGE_KEY)
}

// ── Detection ──

export function hasMetaMask(): boolean {
  return typeof window !== 'undefined' && !!(window as any).ethereum
}

// ── Connect via EIP-1193 (MetaMask, Rabby, etc.) ──

export async function connectMetaMask(): Promise<WalletState> {
  const eth = (window as any).ethereum
  if (!eth) throw new Error('No Ethereum wallet detected (MetaMask / Rabby)')

  const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' })
  if (!accounts || accounts.length === 0) throw new Error('No accounts available')

  const chainId = await eth.request({ method: 'eth_chainId' })
  const addr = accounts[0].toLowerCase()

  saveState(addr)

  // Listen for account changes
  if (!_walletListenerAttached) {
    _walletListenerAttached = true
    eth.on('accountsChanged', (accs: string[]) => {
      if (accs.length === 0) {
        clearWallet()
        window.dispatchEvent(new CustomEvent('wallet-disconnected'))
      } else {
        saveState(accs[0].toLowerCase())
        window.dispatchEvent(new CustomEvent('wallet-changed', { detail: accs[0].toLowerCase() }))
      }
    })
    eth.on('chainChanged', () => window.location.reload())
  }

  return { address: addr, chainId: parseInt(chainId, 16) }
}

// ── Restore saved session ──

export function restoreWallet(): WalletState | null {
  const addr = getSavedWallet()
  if (!addr) return null
  return { address: addr, chainId: 0 }
}

// ── Send transaction (MetaMask only) ──

export async function sendTx(tx: { from: string; to: string; data: string }): Promise<string> {
  const eth = (window as any).ethereum
  if (!eth) throw new Error('MetaMask not available for sending transactions')

  const result = await eth.request({
    method: 'eth_sendTransaction',
    params: [{ from: tx.from, to: tx.to, data: tx.data }],
  })
  return result
}

