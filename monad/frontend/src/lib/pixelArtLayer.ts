import L from 'leaflet'
import type { PixelArtIsland } from '../data/pixelArtData'

const TRANSPARENT_TOKEN = '.'

export function createPixelArtLayer(artworks: PixelArtIsland[]): L.LayerGroup {
  const layerGroup = L.layerGroup()

  for (const artwork of artworks) {
    const rowCount = artwork.rows.length
    const columnCount = artwork.rows[0]?.length ?? 0

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = artwork.rows[rowIndex]

      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const token = row[columnIndex]
        if (token === TRANSPARENT_TOKEN) {
          continue
        }

        const color = artwork.palette[token]
        if (!color) {
          continue
        }

        const north =
          artwork.center[0] +
          (rowCount / 2 - rowIndex) * artwork.pixelSizeDegrees
        const south = north - artwork.pixelSizeDegrees
        const west =
          artwork.center[1] +
          (columnIndex - columnCount / 2) * artwork.pixelSizeDegrees
        const east = west + artwork.pixelSizeDegrees

        L.rectangle(
          [
            [south, west],
            [north, east],
          ],
          {
            color,
            fillColor: color,
            fillOpacity: 0.92,
            weight: 0,
            stroke: false,
            interactive: false,
          },
        ).addTo(layerGroup)
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
