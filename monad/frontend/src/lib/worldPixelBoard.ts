import L from 'leaflet'

// Canvas size must stay within browser limits (~16k per side). Use 2048x1024 so drawing is visible.
export const WORLD_PIXEL_WIDTH = 2048
export const WORLD_PIXEL_HEIGHT = 1024
export const WORLD_MIN_LATITUDE = -82
export const WORLD_MAX_LATITUDE = 82
export const WORLD_PIXEL_BOUNDS = L.latLngBounds(
  [WORLD_MIN_LATITUDE, -180],
  [WORLD_MAX_LATITUDE, 180],
)

export type PaintedPixels = Record<string, string>

type SeedArtwork = {
  center: [number, number]
  palette: Record<string, string>
  rows: string[]
  scale: number
}

const TRANSPARENT_TOKEN = '.'

const seedArtworks: SeedArtwork[] = [
  {
    center: [48.8566, 2.3522],
    scale: 2,
    palette: {
      R: '#fb7185',
    },
    rows: [
      '............',
      '...RR..RR...',
      '..RRRRRRRR..',
      '..RRRRRRRR..',
      '...RRRRRR...',
      '....RRRR....',
      '.....RR.....',
      '............',
    ],
  },
  {
    center: [40.7128, -74.006],
    scale: 2,
    palette: {
      P: '#8b5cf6',
    },
    rows: [
      'PP........PP',
      'PPP......PPP',
      'PPPP....PPPP',
      'PP.PP..PP.PP',
      'PP..PPPP..PP',
      'PP...PP...PP',
      'PP........PP',
      'PP........PP',
    ],
  },
  {
    center: [35.6764, 139.65],
    scale: 2,
    palette: {
      Y: '#facc15',
      B: '#0f172a',
      W: '#f8fafc',
    },
    rows: [
      '..WWWWWWWW..',
      '.WWYYYYYYWW.',
      'WWYBBYYBBYWW',
      'WWYYYYYYYYWW',
      'WWYBYYYYBYWW',
      'WWYYBBBBYYWW',
      '.WWYYYYYYWW.',
      '..WWWWWWWW..',
    ],
  },
  {
    center: [-23.5505, -46.6333],
    scale: 2,
    palette: {
      G: '#22c55e',
      W: '#f8fafc',
    },
    rows: [
      '....GGGG....',
      '...GWWWWG...',
      '..GWGGGGWG..',
      '..GWGGGGWG..',
      '..GWGGGGWG..',
      '..GWGGGGWG..',
      '...GWWWWG...',
      '....GGGG....',
    ],
  },
  {
    center: [30.0444, 31.2357],
    scale: 2,
    palette: {
      O: '#f97316',
      W: '#f8fafc',
      B: '#0f172a',
    },
    rows: [
      '..OOOOOOOO..',
      '.OOWWWWWWOO.',
      '.OOWBWWBWOO.',
      '.OOWWWWWWOO.',
      '.OOWBBBBWOO.',
      '.OOWWWWWWOO.',
      '.OOWWWWWWOO.',
      '..OOOOOOOO..',
    ],
  },
  {
    center: [51.5072, -0.1276],
    scale: 2,
    palette: {
      C: '#06b6d4',
      W: '#f8fafc',
    },
    rows: [
      '...CCCCCC...',
      '..CCWWWWCC..',
      '.CCWWWWWWCC.',
      '.CCWWCCWWCC.',
      '.CCWWCCWWCC.',
      '.CCWWWWWWCC.',
      '..CCWWWWCC..',
      '...CCCCCC...',
    ],
  },
]

function normalizeLongitude(longitude: number): number {
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180
  return wrapped === 180 ? -180 : wrapped
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function keyForCell(x: number, y: number): string {
  return `${x}:${y}`
}

function paintCell(target: PaintedPixels, x: number, y: number, color: string): void {
  if (x < 0 || x >= WORLD_PIXEL_WIDTH || y < 0 || y >= WORLD_PIXEL_HEIGHT) {
    return
  }

  target[keyForCell(x, y)] = color
}

function stampArtwork(target: PaintedPixels, artwork: SeedArtwork): void {
  const centerCell = latLngToWorldPixelCell(
    L.latLng(artwork.center[0], artwork.center[1]),
  )
  const rowCount = artwork.rows.length
  const columnCount = artwork.rows[0]?.length ?? 0

  const totalHeight = rowCount * artwork.scale
  const totalWidth = columnCount * artwork.scale
  const topLeftX = centerCell.x - Math.floor(totalWidth / 2)
  const topLeftY = centerCell.y - Math.floor(totalHeight / 2)

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = artwork.rows[rowIndex] ?? ''

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const token = row[columnIndex] ?? TRANSPARENT_TOKEN
      const color = artwork.palette[token]

      if (token === TRANSPARENT_TOKEN || !color) {
        continue
      }

      for (let scaleY = 0; scaleY < artwork.scale; scaleY += 1) {
        for (let scaleX = 0; scaleX < artwork.scale; scaleX += 1) {
          paintCell(
            target,
            topLeftX + columnIndex * artwork.scale + scaleX,
            topLeftY + rowIndex * artwork.scale + scaleY,
            color,
          )
        }
      }
    }
  }
}

const seededPixels: PaintedPixels = (() => {
  const basePixels: PaintedPixels = {}

  for (const artwork of seedArtworks) {
    stampArtwork(basePixels, artwork)
  }

  return basePixels
})()

export function latLngToWorldPixelCell(latlng: L.LatLng): {
  x: number
  y: number
  key: string
} {
  const normalizedLongitude = normalizeLongitude(latlng.lng)
  const normalizedLatitude = clamp(
    latlng.lat,
    WORLD_MIN_LATITUDE,
    WORLD_MAX_LATITUDE,
  )

  const x = clamp(
    Math.floor(((normalizedLongitude + 180) / 360) * WORLD_PIXEL_WIDTH),
    0,
    WORLD_PIXEL_WIDTH - 1,
  )
  const y = clamp(
    Math.floor(
      ((WORLD_MAX_LATITUDE - normalizedLatitude) /
        (WORLD_MAX_LATITUDE - WORLD_MIN_LATITUDE)) *
        WORLD_PIXEL_HEIGHT,
    ),
    0,
    WORLD_PIXEL_HEIGHT - 1,
  )

  return { x, y, key: keyForCell(x, y) }
}

export function worldPixelCellToBounds(x: number, y: number): L.LatLngBounds {
  const north =
    WORLD_MAX_LATITUDE -
    (y / WORLD_PIXEL_HEIGHT) * (WORLD_MAX_LATITUDE - WORLD_MIN_LATITUDE)
  const south =
    WORLD_MAX_LATITUDE -
    ((y + 1) / WORLD_PIXEL_HEIGHT) *
      (WORLD_MAX_LATITUDE - WORLD_MIN_LATITUDE)
  const west = (x / WORLD_PIXEL_WIDTH) * 360 - 180
  const east = ((x + 1) / WORLD_PIXEL_WIDTH) * 360 - 180

  return L.latLngBounds(
    [south, west],
    [north, east],
  )
}

function drawPixelsIntoContext(
  context: CanvasRenderingContext2D,
  pixels: PaintedPixels,
): void {
  for (const [positionKey, color] of Object.entries(pixels)) {
    const [xToken, yToken] = positionKey.split(':')
    const x = Number(xToken)
    const y = Number(yToken)
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      continue
    }

    context.fillStyle = color
    context.fillRect(x, y, 1, 1)
  }
}

export function buildWorldPixelBoardDataUrl(
  playerPaintedPixels: PaintedPixels,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = WORLD_PIXEL_WIDTH
  canvas.height = WORLD_PIXEL_HEIGHT

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to create world pixel board context.')
  }

  // Fill with a visible background so the canvas and drawn pixels are always visible
  context.fillStyle = '#1e293b'
  context.fillRect(0, 0, WORLD_PIXEL_WIDTH, WORLD_PIXEL_HEIGHT)
  drawPixelsIntoContext(context, seededPixels)
  drawPixelsIntoContext(context, playerPaintedPixels)

  return canvas.toDataURL('image/png')
}
