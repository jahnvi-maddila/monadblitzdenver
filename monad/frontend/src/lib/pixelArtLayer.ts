import L from 'leaflet'
import type { PixelArtIsland } from '../data/pixelArtData'

const TRANSPARENT_TOKEN = '.'
const EMPTY_PIXEL_COLOR = '#1e293b'

export type PixelClickPosition = {
  islandId: string
  rowIndex: number
  columnIndex: number
  key: string
}

type PixelArtLayerOptions = {
  artworks: PixelArtIsland[]
  paintedPixels: Record<string, string>
  onPixelClick?: (position: PixelClickPosition) => void
}

function getPixelStorageKey(
  islandId: string,
  rowIndex: number,
  columnIndex: number,
): string {
  return `${islandId}:${rowIndex}:${columnIndex}`
}

export function createPixelArtLayer({
  artworks,
  paintedPixels,
  onPixelClick,
}: PixelArtLayerOptions): L.LayerGroup {
  const layerGroup = L.layerGroup()

  for (const artwork of artworks) {
    const rowCount = artwork.rows.length
    const columnCount = artwork.rows[0]?.length ?? 0

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = artwork.rows[rowIndex] ?? ''

      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const token = row[columnIndex] ?? TRANSPARENT_TOKEN
        const key = getPixelStorageKey(artwork.id, rowIndex, columnIndex)
        const paintedColor = paintedPixels[key]

        const baseColor =
          token === TRANSPARENT_TOKEN ? null : artwork.palette[token] ?? null
        const color = paintedColor ?? baseColor ?? EMPTY_PIXEL_COLOR
        const isTransparent = !paintedColor && token === TRANSPARENT_TOKEN

        const north =
          artwork.center[0] +
          (rowCount / 2 - rowIndex) * artwork.pixelSizeDegrees
        const south = north - artwork.pixelSizeDegrees
        const west =
          artwork.center[1] +
          (columnIndex - columnCount / 2) * artwork.pixelSizeDegrees
        const east = west + artwork.pixelSizeDegrees

        const rectangle = L.rectangle(
          [
            [south, west],
            [north, east],
          ],
          {
            color,
            fillColor: color,
            fillOpacity: isTransparent ? 0.12 : 0.92,
            weight: 0.35,
            stroke: true,
            interactive: Boolean(onPixelClick),
          },
        )

        if (onPixelClick) {
          rectangle.on('click', () => {
            onPixelClick({
              islandId: artwork.id,
              rowIndex,
              columnIndex,
              key,
            })
          })
        }

        rectangle.addTo(layerGroup)
      }
    }

    L.marker(artwork.center, {
      interactive: false,
      icon: L.divIcon({
        className: 'pixel-art-label',
        html: `<span>${artwork.name}</span>`,
      }),
    }).addTo(layerGroup)
  }

  return layerGroup
}
