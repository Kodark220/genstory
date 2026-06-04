// Web3 wallet connector — works with MetaMask, Rabby, and any EIP-1193 provider
// No dependencies needed — uses window.ethereum

const WALLET_KEY = 'genstory_wallet'

export function getSavedWallet() {
  return localStorage.getItem(WALLET_KEY)
}

export function clearSavedWallet() {
  localStorage.removeItem(WALLET_KEY)
}

export function saveWallet(addr) {
  localStorage.setItem(WALLET_KEY, addr)
}

// Check if an injected wallet is available
export function hasInjectedWallet() {
  return typeof window !== 'undefined' && window.ethereum !== undefined
}

// Connect via EIP-1193 (MetaMask, Rabby, etc.)
export async function connectEIP1193() {
  const eth = window.ethereum
  if (!eth) throw new Error('No wallet detected')

  const accounts = await eth.request({ method: 'eth_requestAccounts' })
  if (!accounts || accounts.length === 0) throw new Error('No accounts')

  const chainId = await eth.request({ method: 'eth_chainId' })

  return {
    address: accounts[0],
    chainId: parseInt(chainId, 16),
    provider: eth,
  }
}

// Send a raw transaction via EIP-1193
export async function sendTransaction(tx) {
  const eth = window.ethereum
  if (!eth) throw new Error('No wallet connected')
  return await eth.request({
    method: 'eth_sendTransaction',
    params: [{
      from: tx.from,
      to: tx.to,
      data: tx.data,
    }]
  })
}
