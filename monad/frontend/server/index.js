import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({ origin: true }))
app.use(express.json())

const W = 64
const H = 64

/** @type {Record<string, string>} */
const pixels = {}

function key(x, y) {
  return `${x}:${y}`
}

function valid(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < W && y >= 0 && y < H
}

// GET /api/canvas — return full pixel map
app.get('/api/canvas', (_req, res) => {
  res.json({ pixels: { ...pixels } })
})

// POST /api/pixel — set one pixel. Body: { x, y, color }
app.post('/api/pixel', (req, res) => {
  const { x, y, color } = req.body ?? {}
  if (!valid(x, y)) {
    return res.status(400).json({ error: 'Invalid x,y (0–63)' })
  }
  if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(400).json({ error: 'Invalid color (use #RRGGBB)' })
  }
  pixels[key(x, y)] = color
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Canvas API http://localhost:${PORT}`)
})
