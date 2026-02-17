import L from 'leaflet'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getStoredWalletAddress,
  shortenWalletAddress,
} from '../lib/wallet'
import {
  buildWorldPixelBoardDataUrl,
  latLngToWorldPixelCell,
  worldPixelCellToBounds,
  WORLD_PIXEL_BOUNDS,
  type PaintedPixels,
} from '../lib/worldPixelBoard'

const PIXEL_REVEAL_ZOOM = 4 // Show pixel canvas from zoom 4 so you can see what you draw
const MAX_PIXEL_CHARGES = 30 // wplace.live gives 30 charges
const CHARGE_REGENERATION_MS = 30_000 // One charge regenerates every 30 seconds
const PAINTED_PIXELS_STORAGE_KEY = 'wplace.paintedPixels'
const PAINT_CREDITS_STORAGE_KEY = 'wplace.pixelCharges'
const COOLDOWN_UNTIL_STORAGE_KEY = 'wplace.lastChargeRegenTime'
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
  const [isEraserMode, setIsEraserMode] = useState(false)
  const [isSpaceHeld, setIsSpaceHeld] = useState(false)
  const [paintedPixels, setPaintedPixels] = useState<PaintedPixels>(() =>
    readStoredPaintedPixels(),
  )
  const [pixelCharges, setPixelCharges] = useState(() =>
    readStoredNumber(PAINT_CREDITS_STORAGE_KEY, MAX_PIXEL_CHARGES),
  )
  const [lastChargeRegenTime, setLastChargeRegenTime] = useState(() =>
    readStoredNullableNumber(COOLDOWN_UNTIL_STORAGE_KEY) ?? Date.now(),
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
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

  // Regenerate charges every 30 seconds
  useEffect(() => {
    const timeSinceLastRegen = currentTimeMs - lastChargeRegenTime
    const chargesToAdd = Math.floor(timeSinceLastRegen / CHARGE_REGENERATION_MS)
    
    if (chargesToAdd > 0 && pixelCharges < MAX_PIXEL_CHARGES) {
      const newCharges = Math.min(MAX_PIXEL_CHARGES, pixelCharges + chargesToAdd)
      setPixelCharges(newCharges)
      setLastChargeRegenTime(
        lastChargeRegenTime + chargesToAdd * CHARGE_REGENERATION_MS
      )
    }
  }, [currentTimeMs, lastChargeRegenTime, pixelCharges])

  const timeUntilNextCharge = CHARGE_REGENERATION_MS - ((currentTimeMs - lastChargeRegenTime) % CHARGE_REGENERATION_MS)
  const secondsUntilNextCharge = Math.ceil(timeUntilNextCharge / 1000)
  const walletConnected = walletAddress !== null

  useEffect(() => {
    localStorage.setItem(
      PAINTED_PIXELS_STORAGE_KEY,
      JSON.stringify(paintedPixels),
    )
  }, [paintedPixels])

  useEffect(() => {
    localStorage.setItem(PAINT_CREDITS_STORAGE_KEY, String(pixelCharges))
  }, [pixelCharges])

  useEffect(() => {
    localStorage.setItem(COOLDOWN_UNTIL_STORAGE_KEY, String(lastChargeRegenTime))
  }, [lastChargeRegenTime])

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
        boardOverlay.bringToFront()
      }

      return
    }

    clearHoverCell()

    if (map.hasLayer(boardOverlay)) {
      map.removeLayer(boardOverlay)
    }
  }, [clearHoverCell])

  const paintPixelAtLatLng = useCallback(
    (latlng: L.LatLng, forcePaint = false) => {
      if (!walletAddress) {
        setStatusMessage('Connect your wallet to start painting.')
        navigate('/login')
        return false
      }

      if (zoomLevel < PIXEL_REVEAL_ZOOM) {
        setStatusMessage(
          `Zoom to at least level ${PIXEL_REVEAL_ZOOM} to place pixels.`,
        )
        return false
      }

      // Check if we have charges (eraser doesn't consume charges)
      if (!isEraserMode && pixelCharges <= 0) {
        setStatusMessage(
          `No charges available. Next charge in ${secondsUntilNextCharge}s.`,
        )
        return false
      }

      const cell = latLngToWorldPixelCell(latlng)
      const colorToUse = isEraserMode ? null : selectedColor

      setPaintedPixels((currentPixels) => {
        if (colorToUse === null) {
          // Eraser mode - remove pixel
          const { [cell.key]: removed, ...rest } = currentPixels
          return rest
        } else {
          // Paint mode - set pixel
          return {
            ...currentPixels,
            [cell.key]: colorToUse,
          }
        }
      })

      // Consume charge for painting (not erasing)
      if (!isEraserMode && pixelCharges > 0) {
        const newCharges = pixelCharges - 1
        setPixelCharges(newCharges)
        setLastChargeRegenTime(Date.now())
        
        if (newCharges === 0) {
          setStatusMessage(
            `No charges left. Next charge regenerates in ${CHARGE_REGENERATION_MS / 1000}s.`,
          )
        } else if (!forcePaint) {
          // Only show status message for manual clicks, not space+move
          setStatusMessage(
            `Pixel placed at (${cell.x}, ${cell.y}). ${newCharges}/${MAX_PIXEL_CHARGES} charges left.`,
          )
        }
      } else if (isEraserMode && !forcePaint) {
        setStatusMessage(
          `Pixel erased at (${cell.x}, ${cell.y}).`,
        )
      }

      return true
    },
    [
      navigate,
      pixelCharges,
      selectedColor,
      walletAddress,
      zoomLevel,
      isEraserMode,
      secondsUntilNextCharge,
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


  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const map = L.map(mapContainerRef.current, {
      center: [22, 8],
      zoom: 2,
      minZoom: 1, // wplace.live uses zoom 1-19
      maxZoom: 19, // wplace.live uses zoom 1-19
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
        opacity: 1,
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

  // Handle SPACE key for continuous painting
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        setIsSpaceHeld(true)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setIsSpaceHeld(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Track last painted cell to prevent rapid re-painting same cell during space+move
  const lastPaintedCellRef = useRef<string | null>(null)
  const lastPaintTimeRef = useRef<number>(0)

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

      // If SPACE is held, paint continuously (wplace.live behavior)
      if (isSpaceHeld && walletAddress && zoomLevel >= PIXEL_REVEAL_ZOOM) {
        const cell = latLngToWorldPixelCell(event.latlng)
        const now = Date.now()
        
        // Prevent painting same cell too rapidly (at least 100ms between paints)
        if (
          lastPaintedCellRef.current !== cell.key ||
          now - lastPaintTimeRef.current >= 100
        ) {
          // Check if we have charges
          if (pixelCharges > 0) {
            const success = paintPixelAtLatLng(event.latlng, true)
            if (success) {
              lastPaintedCellRef.current = cell.key
              lastPaintTimeRef.current = now
            }
          }
        }
      }
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
  }, [clearHoverCell, handleHoverCell, paintPixelAtLatLng, isSpaceHeld, walletAddress, zoomLevel, pixelCharges])

  useEffect(() => {
    const boardOverlay = boardOverlayRef.current
    if (!boardOverlay) {
      return
    }

    boardOverlay.setUrl(buildWorldPixelBoardDataUrl(paintedPixels))
  }, [paintedPixels])

  const zoomHint =
    zoomLevel >= PIXEL_REVEAL_ZOOM
      ? 'Pixel board active. Click to paint. Hold SPACE and move to paint continuously.'
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
            Charges: {pixelCharges}/{MAX_PIXEL_CHARGES}
          </span>
          <span className={pixelCharges < MAX_PIXEL_CHARGES ? 'stat-chip alert' : 'stat-chip ready'}>
            {pixelCharges < MAX_PIXEL_CHARGES
              ? `Next charge: ${secondsUntilNextCharge}s`
              : 'All charges ready'}
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
              onClick={() => {
                setSelectedColor(color)
                setIsEraserMode(false)
              }}
              aria-label={`Select color ${color}`}
              title={color}
            />
          ))}
        </div>

        <button
          type="button"
          className={`secondary-btn ${isEraserMode ? 'eraser-active' : ''}`}
          onClick={() => setIsEraserMode(!isEraserMode)}
          style={{ marginTop: '0.75rem' }}
        >
          {isEraserMode ? '✏️ Eraser Mode (Click to disable)' : '🗑️ Eraser'}
        </button>

        {!walletConnected ? (
          <button
            type="button"
            className="primary-btn"
            onClick={() => navigate('/login')}
          >
            Connect wallet to paint
          </button>
        ) : null}

        {statusMessage ? <p className="status-line">{statusMessage}</p> : null}
      </aside>
    </section>
  )
}

export default MapPage
