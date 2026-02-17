const STORED_WALLET_KEY = 'wplace.connectedWallet'
const MONAD_CHAIN_ID_HEX = '0x279f'
const DEFAULT_COOLDOWN_COLLECTOR = '0x000000000000000000000000000000000000dEaD'
const DEFAULT_COOLDOWN_SKIP_FEE_WEI = '0x38d7ea4c68000' // 0.001 MON

export const COOLDOWN_SKIP_FEE_MON = '0.001'

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

async function requestWalletAccounts(provider: EthereumProvider): Promise<string[]> {
  const accountsResponse = await provider.request({
    method: 'eth_requestAccounts',
  })

  if (!Array.isArray(accountsResponse) || accountsResponse.length === 0) {
    throw new Error('Wallet connection failed: no account returned.')
  }

  const accounts = accountsResponse.filter(
    (account): account is string => typeof account === 'string',
  )

  if (accounts.length === 0) {
    throw new Error('Wallet connection failed: invalid account response.')
  }

  return accounts
}

export async function connectWallet(): Promise<string> {
  const provider = getInjectedProvider()
  await ensureMonadNetwork(provider)

  const [firstAccount] = await requestWalletAccounts(provider)

  localStorage.setItem(STORED_WALLET_KEY, firstAccount)
  return firstAccount
}

function getCooldownCollectorAddress(): string {
  const configuredAddress = import.meta.env.VITE_COOLDOWN_COLLECTOR as
    | string
    | undefined

  return configuredAddress && configuredAddress.length > 0
    ? configuredAddress
    : DEFAULT_COOLDOWN_COLLECTOR
}

function getCooldownSkipFeeWeiHex(): string {
  const configuredFee = import.meta.env.VITE_COOLDOWN_SKIP_FEE_WEI as
    | string
    | undefined

  return configuredFee && configuredFee.length > 0
    ? configuredFee
    : DEFAULT_COOLDOWN_SKIP_FEE_WEI
}

export async function payToSkipCooldown(): Promise<string> {
  const provider = getInjectedProvider()
  await ensureMonadNetwork(provider)
  const [account] = await requestWalletAccounts(provider)

  localStorage.setItem(STORED_WALLET_KEY, account)

  const txResponse = await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: account,
        to: getCooldownCollectorAddress(),
        value: getCooldownSkipFeeWeiHex(),
      },
    ],
  })

  if (typeof txResponse !== 'string') {
    throw new Error('Payment transaction failed: invalid transaction hash.')
  }

  return txResponse
}

export function getStoredWalletAddress(): string | null {
  return localStorage.getItem(STORED_WALLET_KEY)
}

export function shortenWalletAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
