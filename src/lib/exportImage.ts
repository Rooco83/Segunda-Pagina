import type { Screen } from '../types'
import { presetById } from '../data/modulePresets'
import { senderById } from '../data/senders'
import { cableRuns } from './cabling'

export interface ExportOptions {
  alpha: boolean
  name: boolean
  logo: boolean
  resolution: boolean
  cabling: boolean
}

/** Exporta una pantalla como PNG (grilla de módulos + overlays opcionales). */
export function exportScreenPng(screen: Screen, opts: ExportOptions) {
  const preset = presetById(screen.presetId)
  const fullW = screen.cols * preset.wPx
  const fullH = screen.rows * preset.hPx
  const scale = Math.min(1, 2000 / Math.max(fullW, fullH))
  const cellW = preset.wPx * scale
  const cellH = preset.hPx * scale

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(fullW * scale)
  canvas.height = Math.round(fullH * scale)
  const ctx = canvas.getContext('2d')!

  if (!opts.alpha) {
    ctx.fillStyle = '#0a0f0e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const off = new Set(screen.off)
  for (let i = 0; i < screen.cols * screen.rows; i++) {
    const r = Math.floor(i / screen.cols)
    const c = i % screen.cols
    const x = c * cellW
    const y = r * cellH
    if (off.has(i)) {
      if (!opts.alpha) {
        ctx.fillStyle = '#0c110f'
        ctx.fillRect(x, y, cellW, cellH)
      }
      continue
    }
    ctx.fillStyle = (r + c) % 2 === 0 ? screen.palette[0] : screen.palette[1]
    ctx.fillRect(x, y, cellW, cellH)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1)
  }

  if (opts.cabling) {
    const runs = cableRuns(screen, preset, senderById(screen.senderId))
    ctx.lineWidth = Math.max(2, cellW * 0.12)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const run of runs) {
      ctx.strokeStyle = run.color
      ctx.beginPath()
      run.cells.forEach((cl, idx) => {
        const r = Math.floor(cl.index / screen.cols)
        const c = cl.index % screen.cols
        const px = c * cellW + cellW / 2
        const py = r * cellH + cellH / 2
        if (idx === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
    }
  }

  if (opts.name) {
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.round(canvas.height * 0.06)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(screen.name, canvas.width / 2, canvas.height / 2)
  }
  if (opts.resolution) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `${Math.round(canvas.height * 0.028)}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(`W ${fullW} × H ${fullH}`, canvas.width / 2, canvas.height / 2 + canvas.height * 0.06)
  }
  if (opts.logo) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    const s = canvas.width * 0.05
    ctx.strokeRect(canvas.width * 0.04, canvas.height * 0.04, s, s)
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${screen.name.replace(/\s+/g, '_') || 'pantalla'}.png`
    a.click()
    URL.revokeObjectURL(url)
  })
}
