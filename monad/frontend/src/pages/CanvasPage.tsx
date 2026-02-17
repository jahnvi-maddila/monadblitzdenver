import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getContractAddress,
  getCanvasFromChain,
  encodeSetPixel,
  key,
  type Pixels,
} from '../lib/canvasContract'
import {
  connectWallet,
  getStoredWalletAddress,
  sendContractTransaction,
  shortenWalletAddress,
} from '../lib/wallet'

const SIZE = 64
const CELL_SIZE = 10
const POLL_MS = 3000
const API = '/api'

const PALETTE = [
  '#ffffff',
  '#000000',
  '#ef4444',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#78716c',
]

async function fetchCanvasApi(): Promise<Pixels> {
  const res = await fetch(`${API}/canvas`)
  if (!res.ok) throw new Error('Failed to load canvas')
  const data = await res.json()
  return data.pixels ?? {}
}

async function setPixelApi(x: number, y: number, color: string): Promise<void> {
  const res = await fetch(`${API}/pixel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y, color }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to set pixel')
  }
}

export default function CanvasPage() {
  const contractAddress = getContractAddress()
  const [pixels, setPixels] = useState<Pixels>({})
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]!)
  const [status, setStatus] = useState<string>('Loading…')
  const [erasing, setErasing] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(() =>
    getStoredWalletAddress(),
  )
  const [isConnecting, setIsConnecting] = useState(false)
  const [txPending, setTxPending] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      if (contractAddress) {
        const next = await getCanvasFromChain(contractAddress)
        setPixels(next)
      } else {
        const next = await fetchCanvasApi()
        setPixels(next)
      }
      setStatus('')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not load canvas')
    }
  }, [contractAddress])

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  const handleConnectWallet = useCallback(async () => {
    setIsConnecting(true)
    setStatus('')
    try {
      const addr = await connectWallet()
      setWalletAddress(addr)
      setStatus('')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const handleCellClick = useCallback(
    async (x: number, y: number) => {
      const color = erasing ? '#000000' : selectedColor
      setPixels((prev) => {
        if (color === '#000000') {
          const next = { ...prev }
          delete next[key(x, y)]
          return next
        }
        return { ...prev, [key(x, y)]: color }
      })
      setStatus('')

      if (contractAddress) {
        if (!walletAddress) {
          setStatus('Connect your wallet to mint pixels on-chain.')
          load()
          return
        }
        setTxPending(true)
        try {
          const data = encodeSetPixel(x, y, color)
          await sendContractTransaction(contractAddress, data)
          await load()
        } catch (e) {
          setStatus(e instanceof Error ? e.message : 'Transaction failed')
          load()
        } finally {
          setTxPending(false)
        }
        return
      }

      try {
        await setPixelApi(x, y, color)
      } catch (e) {
        setStatus(e instanceof Error ? e.message : 'Failed to save pixel')
        load()
      }
    },
    [selectedColor, erasing, load, contractAddress, walletAddress],
  )

  const grid = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const k = key(x, y)
      grid.push(
        <button
          key={k}
          type="button"
          className="pixel"
          style={{
            left: x * CELL_SIZE,
            top: y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
            backgroundColor: pixels[k] ?? '#1a1a1a',
          }}
          onClick={() => handleCellClick(x, y)}
          disabled={contractAddress ? txPending : false}
          aria-label={`Pixel ${x},${y}`}
        />,
      )
    }
  }

  return (
    <div className="canvas-screen">
      <header className="canvas-header">
        <span className="title">64×64 Canvas</span>
        <div className="header-right">
          {contractAddress && (
            <span className="chain-badge">On-chain (Monad Testnet)</span>
          )}
          {walletAddress ? (
            <span className="wallet-chip">{shortenWalletAddress(walletAddress)}</span>
          ) : (
            <button
              type="button"
              className="connect-btn"
              onClick={handleConnectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </div>
      </header>
      <p className="status-line">{status || (contractAddress ? 'Click a pixel to mint on-chain' : 'Click a pixel to draw')}</p>

      <div
        className="canvas-wrap"
        style={{
          width: SIZE * CELL_SIZE,
          height: SIZE * CELL_SIZE,
        }}
      >
        {grid}
      </div>

      <div className="tools">
        <div className="palette">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`palette-color ${selectedColor === c && !erasing ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                setSelectedColor(c)
                setErasing(false)
              }}
              aria-label={`Color ${c}`}
              title={c}
            />
          ))}
        </div>
        <button
          type="button"
          className={`eraser ${erasing ? 'on' : ''}`}
          onClick={() => setErasing((e) => !e)}
        >
          Eraser
        </button>
      </div>
    </div>
  )
}
