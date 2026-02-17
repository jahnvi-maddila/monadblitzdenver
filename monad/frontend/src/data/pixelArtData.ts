export type PixelArtIsland = {
  id: string
  name: string
  center: [number, number]
  pixelSizeDegrees: number
  palette: Record<string, string>
  rows: string[]
}

export const pixelArtIslands: PixelArtIsland[] = [
  {
    id: 'monad-heart',
    name: 'Monad Heart',
    center: [48.8566, 2.3522],
    pixelSizeDegrees: 0.25,
    palette: {
      R: '#fb7185',
    },
    rows: [
      '..........',
      '..RR..RR..',
      '.RRRRRRRR.',
      '.RRRRRRRR.',
      '..RRRRRR..',
      '...RRRR...',
      '....RR....',
      '..........',
      '..........',
      '..........',
    ],
  },
  {
    id: 'pixel-smile',
    name: 'Pixel Smile',
    center: [35.6764, 139.65],
    pixelSizeDegrees: 0.23,
    palette: {
      Y: '#facc15',
      B: '#0f172a',
    },
    rows: [
      '..YYYYYY..',
      '.YYYYYYYY.',
      'YYBBYYBBYY',
      'YYYYYYYYYY',
      'YYBYYYYBYY',
      'YYYBBBBYYY',
      '.YYYYYYYY.',
      '..YYYYYY..',
      '..........',
      '..........',
    ],
  },
  {
    id: 'monad-m',
    name: 'Monad M',
    center: [40.7128, -74.006],
    pixelSizeDegrees: 0.25,
    palette: {
      P: '#8b5cf6',
    },
    rows: [
      'PP......PP',
      'PPP....PPP',
      'PPPP..PPPP',
      'PP.PPPP.PP',
      'PP..PP..PP',
      'PP......PP',
      'PP......PP',
      '..........',
      '..........',
      '..........',
    ],
  },
]
