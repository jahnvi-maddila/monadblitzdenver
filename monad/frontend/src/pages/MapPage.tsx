import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pixelArtIslands } from '../data/pixelArtData'
import { createPixelArtLayer } from '../lib/pixelArtLayer'
import { getStoredWalletAddress, shortenWalletAddress } from '../lib/wallet'

const PIXEL_REVEAL_ZOOM = 4

function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const [zoomLevel, setZoomLevel] = useState(2)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    setWalletAddress(getStoredWalletAddress())
  }, [])

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
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const pixelLayer = createPixelArtLayer(pixelArtIslands)

    const refreshPixelLayer = () => {
      const currentZoom = map.getZoom()
      setZoomLevel(currentZoom)

      if (currentZoom >= PIXEL_REVEAL_ZOOM) {
        if (!map.hasLayer(pixelLayer)) {
          pixelLayer.addTo(map)
        }

        return
      }

      if (map.hasLayer(pixelLayer)) {
        map.removeLayer(pixelLayer)
      }
    }

    map.on('zoomend', refreshPixelLayer)
    refreshPixelLayer()

    return () => {
      map.off('zoomend', refreshPixelLayer)
      map.remove()
    }
  }, [])

  const zoomHint =
    zoomLevel >= PIXEL_REVEAL_ZOOM
      ? 'Pixel art is visible. Pan and discover canvases.'
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
          pixel-art zones.
        </p>
        <p className="zoom-hint">{zoomHint}</p>
        <button
          type="button"
          className="primary-btn"
          onClick={() => navigate('/login')}
        >
          Start painting
        </button>
      </aside>
    </section>
  )
}

export default MapPage
