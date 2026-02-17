const STORED_WALLET_KEY = 'wplace.connectedWallet'
const MONAD_CHAIN_ID_HEX = '0x279f'

type RequestParameters = readonly unknown[] | Record<string, unknown>

type RequestArguments = {
  method: string
  params?: RequestParameters
}

type EthereumProvider = {
  request: (args: RequestArguments) => Promise<unknown>
}

type ProviderError = Error & {
  code?: number
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

const MONAD_TESTNET_PARAMETERS = {
  chainId: MONAD_CHAIN_ID_HEX,
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://monad-testnet.socialscan.io'],
}

function getInjectedProvider(): EthereumProvider {
  if (!window.ethereum) {
    throw new Error('No wallet found. Install a wallet like MetaMask first.')
  }

  return window.ethereum
}

async function ensureMonadNetwork(provider: EthereumProvider): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_CHAIN_ID_HEX }],
    })
  } catch (error) {
    const providerError = error as ProviderError
    if (providerError.code !== 4902) {
      throw error
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [MONAD_TESTNET_PARAMETERS],
    })
  }
}

export async function connectWallet(): Promise<string> {
  const provider = getInjectedProvider()
  await ensureMonadNetwork(provider)

  const accountsResponse = await provider.request({
    method: 'eth_requestAccounts',
  })

  if (!Array.isArray(accountsResponse) || accountsResponse.length === 0) {
    throw new Error('Wallet connection failed: no account returned.')
  }

  const [firstAccount] = accountsResponse
  if (typeof firstAccount !== 'string') {
    throw new Error('Wallet connection failed: invalid account response.')
  }

  localStorage.setItem(STORED_WALLET_KEY, firstAccount)
  return firstAccount
}

export function getStoredWalletAddress(): string | null {
  return localStorage.getItem(STORED_WALLET_KEY)
}

export function shortenWalletAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
