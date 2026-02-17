import { createPublicClient, encodeFunctionData, http, type Chain } from 'viem'

const MONAD_TESTNET: Chain = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'Socialscan', url: 'https://monad-testnet.socialscan.io' } },
}

export const MAX_BATCH_PIXELS = 32

const PIXEL_CANVAS_ABI = [
  {
    inputs: [
      { name: 'x', type: 'uint8' },
      { name: 'y', type: 'uint8' },
      { name: 'color', type: 'bytes3' },
    ],
    name: 'setPixel',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'xs', type: 'uint8[]', internalType: 'uint8[]' },
      { name: 'ys', type: 'uint8[]', internalType: 'uint8[]' },
      { name: 'colors', type: 'bytes3[]', internalType: 'bytes3[]' },
    ],
    name: 'setPixels',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCanvas',
    outputs: [{ name: '', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export type Pixels = Record<string, string>

function key(x: number, y: number) {
  return `${x}:${y}`
}

/** #rrggbb -> 0xrrggbb for bytes3 */
function hexToBytes3(hex: string): `0x${string}` {
  const s = hex.startsWith('#') ? hex.slice(1) : hex
  if (s.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(s)) return '0x000000'
  return `0x${s}` as `0x${string}`
}

/** bytes(12288) from getCanvas() -> Pixels. Unset (0) pixels omitted so UI can use default background. */
function decodeCanvasBytes(data: `0x${string}`): Pixels {
  const out: Pixels = {}
  const raw = data.slice(2)
  if (raw.length < 64 * 64 * 3 * 2) return out
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 6
      const r = raw.slice(i, i + 2)
      const g = raw.slice(i + 2, i + 4)
      const b = raw.slice(i + 4, i + 6)
      const color = `#${r}${g}${b}`
      if (color !== '#000000') out[key(x, y)] = color
    }
  }
  return out
}

export function getContractAddress(): string | null {
  const addr = import.meta.env.VITE_PIXEL_CANVAS_ADDRESS as string | undefined
  return addr && addr.startsWith('0x') ? addr : null
}

export async function getCanvasFromChain(contractAddress: string): Promise<Pixels> {
  const client = createPublicClient({
    chain: MONAD_TESTNET,
    transport: http(),
  })
  const data = await client.readContract({
    address: contractAddress as `0x${string}`,
    abi: PIXEL_CANVAS_ABI,
    functionName: 'getCanvas',
  })
  return decodeCanvasBytes(data as `0x${string}`)
}

export function encodeSetPixel(x: number, y: number, colorHex: string): `0x${string}` {
  return encodeFunctionData({
    abi: PIXEL_CANVAS_ABI,
    functionName: 'setPixel',
    args: [x, y, hexToBytes3(colorHex)],
  })
}

export function encodeSetPixels(
  xs: number[],
  ys: number[],
  colorHexes: string[],
): `0x${string}` {
  const colors = colorHexes.map((h) => hexToBytes3(h))
  return encodeFunctionData({
    abi: PIXEL_CANVAS_ABI,
    functionName: 'setPixels',
    args: [xs, ys, colors],
  })
}

export { key }
