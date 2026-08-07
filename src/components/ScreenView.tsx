import { useMemo } from 'react'
import type { Screen } from '../types'
import { useStore } from '../store'
import { presetById } from '../data/modulePresets'
import { senderById } from '../data/senders'
import { screenMetrics } from '../lib/metrics'
import { cableRuns, serpentineOrder } from '../lib/cabling'
import { Draggable } from './Draggable'
import { IconGear, IconPalette, IconTrash } from './icons'

const CM_PX = 1 // px por cm a zoom 1

export function ScreenView({ screen }: { screen: Screen }) {
  const selected = useStore((s) => s.selectedId === screen.id)
  const select = useStore((s) => s.select)
  const openEdit = useStore((s) => s.openEdit)
  const cycleColor = useStore((s) => s.cycleColor)
  const deleteScreen = useStore((s) => s.deleteScreen)
  const toggleModule = useStore((s) => s.toggleModule)
  const updateScreen = useStore((s) => s.updateScreen)
  const tool = useStore((s) => s.tool)

  const preset = presetById(screen.presetId)
  const sender = senderById(screen.senderId)
  const m = screenMetrics(screen)

  const cellW = preset.wCm * CM_PX
  const cellH = preset.hCm * CM_PX
  const gridW = screen.cols * cellW
  const gridH = screen.rows * cellH

  // numeración en orden de cableado (serpentina)
  const orderMap = useMemo(() => {
    const order = serpentineOrder(screen.cols, screen.rows)
    const map = new Array<number>(screen.cols * screen.rows)
    order.forEach((cell, i) => {
      map[cell.index] = i + 1
    })
    return map
  }, [screen.cols, screen.rows])

  const runs = useMemo(
    () => cableRuns(screen, preset, sender),
    [screen, preset, sender],
  )

  const offSet = useMemo(() => new Set(screen.off), [screen.off])

  const center = (index: number) => {
    const r = Math.floor(index / screen.cols)
    const c = index % screen.cols
    return { x: c * cellW + cellW / 2, y: r * cellH + cellH / 2 }
  }

  const cells = []
  for (let i = 0; i < screen.cols * screen.rows; i++) {
    const isOff = offSet.has(i)
    const r = Math.floor(i / screen.cols)
    const c = i % screen.cols
    const shade = (r + c) % 2 === 0 ? screen.palette[0] : screen.palette[1]
    cells.push(
      <div
        key={i}
        className={`mod ${isOff ? 'off' : ''}`}
        data-sid={screen.id}
        data-idx={i}
        style={{ width: cellW, height: cellH, background: shade }}
        onClick={(e) => {
          e.stopPropagation()
          if (tool === 'hand') toggleModule(screen.id, i)
        }}
      >
        {orderMap[i]}
      </div>,
    )
  }

  return (
    <div
      className={`screen ${selected ? 'selected' : ''}`}
      onPointerDown={() => select(screen.id)}
    >
      <div className="corner tl">
        {m.areaM2.toFixed(1)} m² <span className="dim">({(m.wPx / 1000).toFixed(2)}k px)</span>
      </div>
      <div className="corner tr">
        <span className="pitch">P{preset.pitch}</span>{' '}
        <span className="dim">{preset.wCm} × {preset.hCm}</span>
        <button
          className="stbtn"
          title="Editar pantalla"
          style={{ width: 22, height: 22, marginLeft: 4 }}
          onClick={(e) => {
            e.stopPropagation()
            openEdit(screen.id)
          }}
        >
          <IconGear />
        </button>
      </div>

      <div className="screen-tools">
        <button
          className="stbtn"
          title="Cambiar color"
          onClick={(e) => {
            e.stopPropagation()
            cycleColor(screen.id)
          }}
        >
          <IconPalette />
        </button>
        <button
          className="stbtn del"
          title="Eliminar pantalla"
          onClick={(e) => {
            e.stopPropagation()
            deleteScreen(screen.id)
          }}
        >
          <IconTrash />
        </button>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${screen.cols}, ${cellW}px)` }}
      >
        {cells}
      </div>

      <svg className="wire" viewBox={`0 0 ${gridW} ${gridH}`} preserveAspectRatio="none" width={gridW} height={gridH}>
        {runs.map((run) => {
          const pts = run.cells.map((cl) => center(cl.index))
          const line = pts.map((p) => `${p.x},${p.y}`).join(' ')
          const s0 = pts[0]
          return (
            <g key={run.output}>
              <polyline
                points={line}
                fill="none"
                stroke={run.color}
                strokeWidth={4.5}
                strokeOpacity={0.9}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={s0.x} cy={s0.y} r={12} fill={run.color} />
              <text x={s0.x} y={s0.y + 3} fontSize={8} fontFamily="monospace" fill="#08110c" textAnchor="middle" fontWeight={700}>
                S{run.output + 1}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="overlay">
        <div className="res">W {m.wPx} × H {m.hPx}</div>
      </div>

      <Draggable pos={screen.namePos} onChange={(p) => updateScreen(screen.id, { namePos: p })}>
        <div className="drag-name">{screen.name}</div>
      </Draggable>
      <Draggable
        className=""
        pos={screen.logoPos}
        onChange={(p) => updateScreen(screen.id, { logoPos: p })}
      >
        <div className="drag-logo">
          <svg viewBox="0 0 34 34" fill="none">
            <rect x="2" y="2" width="30" height="30" rx="6" stroke="currentColor" strokeWidth="1.6" />
            <rect x="7" y="7" width="7" height="7" fill="currentColor" />
            <rect x="20" y="20" width="7" height="7" fill="currentColor" />
          </svg>
          TU LOGO
        </div>
      </Draggable>
    </div>
  )
}
