import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getContractAddress,
  getCanvasFromChain,
  encodeSetPixels,
  key,
  MAX_BATCH_PIXELS,
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

type PendingPixel = { x: number; y: number; color: string }

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
  const [pending, setPending] = useState<PendingPixel[]>([])
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
    (x: number, y: number) => {
      const color = erasing ? '#000000' : selectedColor

      if (contractAddress) {
        setPending((prev) => {
          const byKey = new Map(prev.map((p) => [key(p.x, p.y), p]))
          if (color === '#000000') {
            byKey.delete(key(x, y))
          } else {
            byKey.set(key(x, y), { x, y, color })
          }
          return Array.from(byKey.values())
        })
        return
      }

      setPixels((prev) => {
        if (color === '#000000') {
          const next = { ...prev }
          delete next[key(x, y)]
          return next
        }
        return { ...prev, [key(x, y)]: color }
      })
      setStatus('')
      setPixelApi(x, y, color).catch((e) => {
        setStatus(e instanceof Error ? e.message : 'Failed to save pixel')
        load()
      })
    },
    [selectedColor, erasing, contractAddress, pending.length, load],
  )

  const handleSubmitBatch = useCallback(async () => {
    if (!contractAddress || !walletAddress || pending.length === 0) {
      if (contractAddress && pending.length === 0) setStatus('Stage some pixels first.')
      return
    }
    const batch = pending.slice(0, MAX_BATCH_PIXELS)
    setTxPending(true)
    setStatus('Confirm transaction in your wallet…')
    try {
      const data = encodeSetPixels(
        batch.map((p) => p.x),
        batch.map((p) => p.y),
        batch.map((p) => p.color),
      )
      await sendContractTransaction(contractAddress, data)
      setPending((prev) => {
        const batchSet = new Set(batch.map((p) => key(p.x, p.y)))
        return prev.filter((p) => !batchSet.has(key(p.x, p.y)))
      })
      await load()
      setStatus('')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Transaction failed')
    } finally {
      setTxPending(false)
    }
  }, [contractAddress, walletAddress, pending, load])

  const displayPixels: Pixels = { ...pixels }
  for (const p of pending) {
    if (p.color === '#000000') delete displayPixels[key(p.x, p.y)]
    else displayPixels[key(p.x, p.y)] = p.color
  }
  const pendingSet = new Set(pending.map((p) => key(p.x, p.y)))

  const grid = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const k = key(x, y)
      const isStaged = pendingSet.has(k)
      grid.push(
        <button
          key={k}
          type="button"
          className={`pixel ${isStaged ? 'staged' : ''}`}
          style={{
            left: x * CELL_SIZE,
            top: y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
            backgroundColor: displayPixels[k] ?? '#1a1a1a',
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
            <>
              {pending.length > 0 && (
                <span className="pending-badge">
                  {pending.length} staged (max {MAX_BATCH_PIXELS})
                </span>
              )}
              <span className="chain-badge">On-chain (Monad Testnet)</span>
            </>
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
      <p className="status-line">
        {status ||
          (contractAddress
            ? 'Click pixels to stage them, then click Submit to mint up to 32 at once.'
            : 'Click a pixel to draw')}
      </p>

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
        {contractAddress && pending.length > 0 && (
          <button
            type="button"
            className="submit-btn"
            onClick={handleSubmitBatch}
            disabled={!walletAddress || txPending}
          >
            {txPending
              ? 'Submitting…'
              : `Submit ${Math.min(pending.length, MAX_BATCH_PIXELS)} pixel${pending.length === 1 ? '' : 's'}`}
          </button>
        )}
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
