import L from 'leaflet'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  COOLDOWN_SKIP_FEE_MON,
  getStoredWalletAddress,
  payToSkipCooldown,
  shortenWalletAddress,
} from '../lib/wallet'
import {
  buildWorldPixelBoardDataUrl,
  latLngToWorldPixelCell,
  worldPixelCellToBounds,
  WORLD_PIXEL_BOUNDS,
  type PaintedPixels,
} from '../lib/worldPixelBoard'

const PIXEL_REVEAL_ZOOM = 4
const PAINTS_PER_SESSION = 64
const SESSION_COOLDOWN_MS = 30_000
const PAINTED_PIXELS_STORAGE_KEY = 'wplace.paintedPixels'
const PAINT_CREDITS_STORAGE_KEY = 'wplace.paintCredits'
const COOLDOWN_UNTIL_STORAGE_KEY = 'wplace.cooldownUntil'
const PALETTE_COLORS = [
  '#ffffff',
  '#0f172a',
  '#ef4444',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#a16207',
]

function readStoredPaintedPixels(): PaintedPixels {
  const rawState = localStorage.getItem(PAINTED_PIXELS_STORAGE_KEY)
  if (!rawState) {
    return {}
  }

  try {
    const parsedState = JSON.parse(rawState)
    if (!parsedState || typeof parsedState !== 'object') {
      return {}
    }

    return Object.entries(parsedState).reduce<PaintedPixels>(
      (accumulator, [key, value]) => {
        if (typeof value === 'string') {
          accumulator[key] = value
        }

        return accumulator
      },
      {},
    )
  } catch {
    return {}
  }
}

function readStoredNumber(key: string, fallbackValue: number): number {
  const rawValue = localStorage.getItem(key)
  if (!rawValue) {
    return fallbackValue
  }

  const parsedNumber = Number(rawValue)
  return Number.isFinite(parsedNumber) ? parsedNumber : fallbackValue
}

function readStoredNullableNumber(key: string): number | null {
  const rawValue = localStorage.getItem(key)
  if (!rawValue) {
    return null
  }

  const parsedNumber = Number(rawValue)
  return Number.isFinite(parsedNumber) ? parsedNumber : null
}

function shortenTransactionHash(txHash: string): string {
  return `${txHash.slice(0, 8)}...${txHash.slice(-6)}`
}

function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const boardOverlayRef = useRef<L.ImageOverlay | null>(null)
  const hoverCellRef = useRef<L.Rectangle | null>(null)
  const [zoomLevel, setZoomLevel] = useState(2)
  const [walletAddress, setWalletAddress] = useState<string | null>(() =>
    getStoredWalletAddress(),
  )
  const [selectedColor, setSelectedColor] = useState(PALETTE_COLORS[0]!)
  const [paintedPixels, setPaintedPixels] = useState<PaintedPixels>(() =>
    readStoredPaintedPixels(),
  )
  const [paintCredits, setPaintCredits] = useState(() =>
    readStoredNumber(PAINT_CREDITS_STORAGE_KEY, PAINTS_PER_SESSION),
  )
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(() =>
    readStoredNullableNumber(COOLDOWN_UNTIL_STORAGE_KEY),
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isPayingToSkip, setIsPayingToSkip] = useState(false)
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now())
  const initialOverlayDataUrlRef = useRef(
    buildWorldPixelBoardDataUrl(readStoredPaintedPixels()),
  )
  const navigate = useNavigate()

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTimeMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  const cooldownMsRemaining = cooldownUntil
    ? Math.max(cooldownUntil - currentTimeMs, 0)
    : 0
  const cooldownSecondsRemaining = Math.ceil(cooldownMsRemaining / 1000)
  const cooldownActive = cooldownMsRemaining > 0
  const sessionResetReady = cooldownUntil !== null && !cooldownActive
  const effectivePaintCredits = sessionResetReady ? PAINTS_PER_SESSION : paintCredits
  const walletConnected = walletAddress !== null

  useEffect(() => {
    localStorage.setItem(
      PAINTED_PIXELS_STORAGE_KEY,
      JSON.stringify(paintedPixels),
    )
  }, [paintedPixels])

  useEffect(() => {
    localStorage.setItem(PAINT_CREDITS_STORAGE_KEY, String(paintCredits))
  }, [paintCredits])

  useEffect(() => {
    if (cooldownUntil && cooldownUntil > currentTimeMs) {
      localStorage.setItem(COOLDOWN_UNTIL_STORAGE_KEY, String(cooldownUntil))
      return
    }

    localStorage.removeItem(COOLDOWN_UNTIL_STORAGE_KEY)
  }, [cooldownUntil, currentTimeMs])

  const clearHoverCell = useCallback(() => {
    const map = mapRef.current
    const hoverCell = hoverCellRef.current

    if (!map || !hoverCell) {
      return
    }

    if (map.hasLayer(hoverCell)) {
      map.removeLayer(hoverCell)
    }

    hoverCellRef.current = null
  }, [])

  const syncPixelBoardVisibility = useCallback(() => {
    const map = mapRef.current
    const boardOverlay = boardOverlayRef.current

    if (!map || !boardOverlay) {
      return
    }

    const currentZoom = map.getZoom()
    setZoomLevel(currentZoom)

    if (currentZoom >= PIXEL_REVEAL_ZOOM) {
      if (!map.hasLayer(boardOverlay)) {
        boardOverlay.addTo(map)
      }

      return
    }

    clearHoverCell()

    if (map.hasLayer(boardOverlay)) {
      map.removeLayer(boardOverlay)
    }
  }, [clearHoverCell])

  const paintPixelAtLatLng = useCallback(
    (latlng: L.LatLng) => {
      if (!walletAddress) {
        setStatusMessage('Connect your wallet to start painting.')
        navigate('/login')
        return
      }

      if (zoomLevel < PIXEL_REVEAL_ZOOM) {
        setStatusMessage(
          `Zoom to at least level ${PIXEL_REVEAL_ZOOM} to place pixels.`,
        )
        return
      }

      if (cooldownUntil && Date.now() < cooldownUntil) {
        setStatusMessage(
          `Cooldown active: wait ${cooldownSecondsRemaining}s or pay to skip.`,
        )
        return
      }

      const refreshedCredits = cooldownUntil ? PAINTS_PER_SESSION : paintCredits

      if (cooldownUntil) {
        setCooldownUntil(null)
        setPaintCredits(PAINTS_PER_SESSION)
      }

      if (refreshedCredits <= 0) {
        const nextCooldownAt = Date.now() + SESSION_COOLDOWN_MS
        setCooldownUntil(nextCooldownAt)
        setStatusMessage(
          `Session exhausted. Cooldown started (${SESSION_COOLDOWN_MS / 1000}s).`,
        )
        return
      }

      const cell = latLngToWorldPixelCell(latlng)

      setPaintedPixels((currentPixels) => ({
        ...currentPixels,
        [cell.key]: selectedColor,
      }))

      const remainingCredits = refreshedCredits - 1
      setPaintCredits(remainingCredits)

      if (remainingCredits === 0) {
        const nextCooldownAt = Date.now() + SESSION_COOLDOWN_MS
        setCooldownUntil(nextCooldownAt)
        setStatusMessage(
          '64 pixels placed in this session. Cooldown started for 30 seconds.',
        )
        return
      }

      setStatusMessage(
        `Pixel placed at (${cell.x}, ${cell.y}). ${remainingCredits} credits left.`,
      )
    },
    [
      cooldownSecondsRemaining,
      cooldownUntil,
      navigate,
      paintCredits,
      selectedColor,
      walletAddress,
      zoomLevel,
    ],
  )

  const handleHoverCell = useCallback(
    (latlng: L.LatLng) => {
      const map = mapRef.current
      if (!map || zoomLevel < PIXEL_REVEAL_ZOOM) {
        clearHoverCell()
        return
      }

      const cell = latLngToWorldPixelCell(latlng)
      const bounds = worldPixelCellToBounds(cell.x, cell.y)

      if (!hoverCellRef.current) {
        hoverCellRef.current = L.rectangle(bounds, {
          color: '#e2e8f0',
          weight: 0.8,
          fillOpacity: 0,
          interactive: false,
          dashArray: '2 2',
        }).addTo(map)
        return
      }

      hoverCellRef.current.setBounds(bounds)
    },
    [clearHoverCell, zoomLevel],
  )

  const handleSkipCooldown = useCallback(async () => {
    if (!walletAddress) {
      setStatusMessage('Connect your wallet first to purchase a cooldown skip.')
      navigate('/login')
      return
    }

    if (!cooldownActive) {
      setStatusMessage('No cooldown is active right now.')
      return
    }

    setIsPayingToSkip(true)
    setStatusMessage(null)

    try {
      const transactionHash = await payToSkipCooldown()
      setCooldownUntil(null)
      setPaintCredits(PAINTS_PER_SESSION)
      setWalletAddress(getStoredWalletAddress())
      setStatusMessage(
        `Cooldown skipped. Payment tx: ${shortenTransactionHash(transactionHash)}.`,
      )
    } catch (error) {
      if (error instanceof Error) {
        setStatusMessage(error.message)
      } else {
        setStatusMessage('Cooldown payment failed. Please try again.')
      }
    } finally {
      setIsPayingToSkip(false)
    }
  }, [cooldownActive, navigate, walletAddress])

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const map = L.map(mapContainerRef.current, {
      center: [22, 8],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      worldCopyJump: true,
      zoomControl: false,
      preferCanvas: true,
      maxBounds: WORLD_PIXEL_BOUNDS.pad(0.2),
    })
    mapRef.current = map

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const boardOverlay = L.imageOverlay(
      initialOverlayDataUrlRef.current,
      WORLD_PIXEL_BOUNDS,
      {
        opacity: 0.96,
        className: 'pixel-board-overlay',
        interactive: false,
      },
    )
    boardOverlayRef.current = boardOverlay

    map.on('zoomend', syncPixelBoardVisibility)
    syncPixelBoardVisibility()

    return () => {
      const boardOverlayLayer = boardOverlayRef.current
      if (boardOverlayLayer && map.hasLayer(boardOverlayLayer)) {
        map.removeLayer(boardOverlayLayer)
      }

      clearHoverCell()
      map.off('zoomend', syncPixelBoardVisibility)
      map.remove()
      mapRef.current = null
      boardOverlayRef.current = null
    }
  }, [clearHoverCell, syncPixelBoardVisibility])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      paintPixelAtLatLng(event.latlng)
    }

    const handleMapMouseMove = (event: L.LeafletMouseEvent) => {
      handleHoverCell(event.latlng)
    }

    const clearHover = () => {
      clearHoverCell()
    }

    map.on('click', handleMapClick)
    map.on('mousemove', handleMapMouseMove)
    map.on('mouseout', clearHover)

    return () => {
      map.off('click', handleMapClick)
      map.off('mousemove', handleMapMouseMove)
      map.off('mouseout', clearHover)
    }
  }, [clearHoverCell, handleHoverCell, paintPixelAtLatLng])

  useEffect(() => {
    const boardOverlay = boardOverlayRef.current
    if (!boardOverlay) {
      return
    }

    boardOverlay.setUrl(buildWorldPixelBoardDataUrl(paintedPixels))
  }, [paintedPixels])

  const zoomHint =
    zoomLevel >= PIXEL_REVEAL_ZOOM
      ? 'Pixel board active. Click any cell to paint.'
      : `Zoom to level ${PIXEL_REVEAL_ZOOM} or higher to reveal pixel art.`

  return (
    <section className="map-screen">
      <div ref={mapContainerRef} className="world-map" />

      <header className="map-header">
        <span className="brand">WPlace Monad (prototype)</span>
        <span className="wallet-chip">
          {walletAddress
            ? `Connected: ${shortenWalletAddress(walletAddress)}`
            : 'Viewing as guest'}
        </span>
      </header>

      <aside className="map-panel">
        <h2>Global Canvas</h2>
        <p>
          Explore the world map, zoom into regions, and discover community
          pixel art painted directly onto the world board.
        </p>
        <p className="zoom-hint">{zoomHint}</p>

        <div className="paint-stats">
          <span className="stat-chip">
            Session credits: {effectivePaintCredits}/{PAINTS_PER_SESSION}
          </span>
          <span className={cooldownActive ? 'stat-chip alert' : 'stat-chip ready'}>
            {cooldownActive
              ? `Cooldown: ${cooldownSecondsRemaining}s`
              : 'Painting ready'}
          </span>
        </div>

        <div className="palette-grid">
          {PALETTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`palette-color ${
                selectedColor === color ? 'selected' : ''
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setSelectedColor(color)}
              aria-label={`Select color ${color}`}
              title={color}
            />
          ))}
        </div>

        {!walletConnected ? (
          <button
            type="button"
            className="primary-btn"
            onClick={() => navigate('/login')}
          >
            Connect wallet to paint
          </button>
        ) : null}

        {walletConnected && cooldownActive ? (
          <button
            type="button"
            className="primary-btn"
            disabled={isPayingToSkip}
            onClick={handleSkipCooldown}
          >
            {isPayingToSkip
              ? 'Waiting for wallet confirmation...'
              : `Pay ${COOLDOWN_SKIP_FEE_MON} MON to skip cooldown`}
          </button>
        ) : null}

        {statusMessage ? <p className="status-line">{statusMessage}</p> : null}
      </aside>
    </section>
  )
}

export default MapPage
