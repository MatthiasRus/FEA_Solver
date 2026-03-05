import './App.css'
import { useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import Plot from 'react-plotly.js'
import type { Layout } from 'plotly.js'
import Plotly from 'plotly.js-dist-min'

type SolveResponse = {
  ok: boolean
  code: number
  stdout: string
  stderr: string
  executablePath: string
  modelPath: string
  outputDir: string
  outputFiles: string[]
  error?: string
}

const API_BASE_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '')

function apiUrl(pathname: string) {
  if (!API_BASE_URL) return pathname
  return `${API_BASE_URL}${pathname}`
}

async function parseApiResponse(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {
      ok: false,
      error: `Non-JSON response from API (${response.status}): ${text.slice(0, 240)}`,
    }
  }
}

type LoadCase = {
  id: number
  name: string
}

type ChartPoint = {
  lineId: number
  value: number
}

type VizNode = {
  id: number
  x: number
  y: number
  z: number
  ux: number
  uy: number
  uz: number
}

type VizLine = {
  id: number
  node1: number
  node2: number
  stress: number
  shear: number
  moment: number
}

type ResultsResponse = {
  ok: boolean
  error?: string
  outputDir: string
  selectedLoadCaseId: number
  selectedLoadCaseName: string
  loadCases: LoadCase[]
  summary: {
    nodeCount: number
    lineCount: number
    maxDisp: { nodeId: number | null; value: number }
    maxStress: { lineId: number | null; value: number }
    maxShear: { lineId: number | null; value: number }
    maxMoment: { lineId: number | null; value: number }
  }
  charts: {
    stressByLine: ChartPoint[]
    shearByLine: ChartPoint[]
    momentByLine: ChartPoint[]
  }
  visualization: {
    nodes: VizNode[]
    lines: VizLine[]
  }
}

type BuilderNode = {
  id: number
  x: number
  y: number
  z: number
  support: 'FREE' | 'FIXED' | 'PINNED' | 'ROLLER'
}

type BuilderLine = {
  id: number
  node1: number
  node2: number
}

type BuilderNodalLoad = {
  id: number
  nodeId: number
  fx: number
  fy: number
  fz: number
  mx: number
  my: number
  mz: number
}

type BuilderLineConcLoad = {
  id: number
  lineId: number
  rel: number
  fx: number
  fy: number
  fz: number
  mx: number
  my: number
  mz: number
}

type BuilderLineDistLoad = {
  id: number
  lineId: number
  relStart: number
  relEnd: number
  fxS: number
  fyS: number
  fzS: number
  mxS: number
  myS: number
  mzS: number
  fxE: number
  fyE: number
  fzE: number
  mxE: number
  myE: number
  mzE: number
}

type BuilderMaterial = {
  name: string
  e: number
  g: number
}

type ChartBlockProps = {
  title: string
  points: ChartPoint[]
  unit: string
}

type ProjectNode = {
  id: number
  x: number
  z: number
  cx: number
  cy: number
}

function nextId(items: Array<{ id: number }>) {
  return items.length > 0 ? Math.max(...items.map((item) => item.id)) + 1 : 1
}

function asFinite(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function vectorMagnitude(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z)
}

function distance3D(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const dz = p2.z - p1.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function isPointOnSegment3D(
  point: { x: number; y: number; z: number },
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  tolerance = 1e-4,
) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const apx = point.x - a.x
  const apy = point.y - a.y
  const apz = point.z - a.z

  const abLenSq = abx * abx + aby * aby + abz * abz
  const abLen = Math.sqrt(abLenSq)
  if (abLen < 1e-12) return false

  const crossX = aby * apz - abz * apy
  const crossY = abz * apx - abx * apz
  const crossZ = abx * apy - aby * apx
  const distToLine = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ) / abLen
  if (distToLine > tolerance) return false

  const dot = apx * abx + apy * aby + apz * abz
  const rel = dot / abLenSq
  return rel > 1e-6 && rel < 1 - 1e-6
}

function metricColor(value: number, min: number, max: number) {
  const span = Math.max(1e-12, max - min)
  const t = clamp((value - min) / span, 0, 1)
  const anchors = [
    { t: 0.0, r: 34, g: 211, b: 238 },
    { t: 0.25, r: 59, g: 130, b: 246 },
    { t: 0.5, r: 34, g: 197, b: 94 },
    { t: 0.75, r: 250, g: 204, b: 21 },
    { t: 1.0, r: 239, g: 68, b: 68 },
  ]

  for (let idx = 1; idx < anchors.length; idx += 1) {
    const a = anchors[idx - 1]
    const b = anchors[idx]
    if (t <= b.t) {
      const lt = clamp((t - a.t) / Math.max(1e-12, b.t - a.t), 0, 1)
      const r = Math.round(lerp(a.r, b.r, lt))
      const g = Math.round(lerp(a.g, b.g, lt))
      const blue = Math.round(lerp(a.b, b.b, lt))
      return `rgb(${r},${g},${blue})`
    }
  }

  return 'rgb(239,68,68)'
}

function projectXZ(nodes: Array<{ id: number; x: number; z: number }>, width = 760, height = 340) {
  if (nodes.length === 0) {
    return { width, height, points: [] as ProjectNode[] }
  }

  const xs = nodes.map((item) => item.x)
  const zs = nodes.map((item) => item.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const spanX = Math.max(1e-9, maxX - minX)
  const spanZ = Math.max(1e-9, maxZ - minZ)
  const padding = 26

  const mapX = (x: number) => padding + ((x - minX) / spanX) * (width - 2 * padding)
  const mapZ = (z: number) => height - padding - ((z - minZ) / spanZ) * (height - 2 * padding)

  const points = nodes.map((node) => ({ id: node.id, x: node.x, z: node.z, cx: mapX(node.x), cy: mapZ(node.z) }))
  return { width, height, points }
}

function arrowGeometry(x1: number, y1: number, x2: number, y2: number, size = 6) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / length
  const uy = dy / length
  const px = -uy
  const py = ux

  const hx = x2 - ux * size
  const hy = y2 - uy * size
  const leftX = hx + px * size * 0.55
  const leftY = hy + py * size * 0.55
  const rightX = hx - px * size * 0.55
  const rightY = hy - py * size * 0.55

  return { leftX, leftY, tipX: x2, tipY: y2, rightX, rightY }
}

function momentSymbolGeometry(cx: number, cy: number, magnitude: number, signRef: number, baseSize = 8) {
  if (magnitude < 1e-9) return null

  const radius = baseSize + 5 * clamp(magnitude / 3000, 0, 1)
  const clockwise = signRef < 0
  const angle = clockwise ? -Math.PI / 4 : (-3 * Math.PI) / 4

  const tipX = cx + radius * Math.cos(angle)
  const tipY = cy + radius * Math.sin(angle)

  const tangentX = clockwise ? Math.sin(angle) : -Math.sin(angle)
  const tangentY = clockwise ? -Math.cos(angle) : Math.cos(angle)

  const backX = tipX - tangentX * 6
  const backY = tipY - tangentY * 6
  const normalX = -tangentY
  const normalY = tangentX

  const leftX = backX + normalX * 3.4
  const leftY = backY + normalY * 3.4
  const rightX = backX - normalX * 3.4
  const rightY = backY - normalY * 3.4

  return { radius, tipX, tipY, leftX, leftY, rightX, rightY }
}

function pathLabel(path: string) {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || path
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function ChartBlock({ title, points, unit }: ChartBlockProps) {
  const max = Math.max(0, ...points.map((point) => point.value))

  return (
    <article className="card">
      <h2>{title}</h2>
      {points.length === 0 ? (
        <p>No data.</p>
      ) : (
        <div className="bars">
          {points.map((point) => {
            const width = max > 0 ? `${(point.value / max) * 100}%` : '0%'
            return (
              <div className="bar-row" key={`${title}-${point.lineId}`}>
                <span className="bar-label">Line {point.lineId}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width }} />
                </div>
                <span className="bar-value">{point.value.toExponential(3)} {unit}</span>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}

function App() {
  const [executablePath, setExecutablePath] = useState('build-linux/MyProject')
  const [modelPath, setModelPath] = useState('models/sample_frame.fea')
  const [outputDir, setOutputDir] = useState('output')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('Ready. Use the builder and run solve to generate results.')
  const [files, setFiles] = useState<string[]>([])
  const [results, setResults] = useState<ResultsResponse | null>(null)
  const [loadingResults, setLoadingResults] = useState(false)
  const [selectedLoadCaseId, setSelectedLoadCaseId] = useState<number>(1)
  const [activeResultsDir, setActiveResultsDir] = useState('output')
  const [feapreviewOpen, setFeaPreviewOpen] = useState(false)
  const [solvePanelOpen, setSolvePanelOpen] = useState(true)
  const [bridgeLogOpen, setBridgeLogOpen] = useState(true)
  const [outputFilesOpen, setOutputFilesOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [resultsMetric, setResultsMetric] = useState<'stress' | 'shear' | 'moment'>('moment')
  const [resultsScale, setResultsScale] = useState('120')
  const [resultsStructurePlotDiv, setResultsStructurePlotDiv] = useState<any>(null)
  const [resultsGraphPlotDiv, setResultsGraphPlotDiv] = useState<any>(null)
  const [exportingReport, setExportingReport] = useState(false)

  const [nodes, setNodes] = useState<BuilderNode[]>([
    { id: 1, x: 0, y: 0, z: 0, support: 'FIXED' },
    { id: 2, x: 0, y: 0, z: 5, support: 'FREE' },
    { id: 3, x: 10, y: 0, z: 5, support: 'FREE' },
    { id: 4, x: 10, y: 0, z: 0, support: 'FIXED' },
  ])
  const [lines, setLines] = useState<BuilderLine[]>([
    { id: 1, node1: 1, node2: 2 },
    { id: 2, node1: 2, node2: 3 },
    { id: 3, node1: 3, node2: 4 },
  ])
  const [nodalLoads, setNodalLoads] = useState<BuilderNodalLoad[]>([
    { id: 1, nodeId: 2, fx: 0, fy: -4000, fz: 0, mx: 0, my: 0, mz: 0 },
    { id: 2, nodeId: 3, fx: 0, fy: -4000, fz: 0, mx: 0, my: 0, mz: 0 },
  ])
  const [lineConcLoads, setLineConcLoads] = useState<BuilderLineConcLoad[]>([])
  const [lineDistLoads, setLineDistLoads] = useState<BuilderLineDistLoad[]>([])

  const [materials, setMaterials] = useState<BuilderMaterial[]>([
    { name: 'CONCRETE', e: 2e10, g: 8e9 },
  ])
  const [defaultMaterialName, setDefaultMaterialName] = useState('CONCRETE')

  const [nodeX, setNodeX] = useState('0')
  const [nodeY, setNodeY] = useState('0')
  const [nodeZ, setNodeZ] = useState('0')
  const [nodeSupport, setNodeSupport] = useState<'FREE' | 'FIXED' | 'PINNED' | 'ROLLER'>('FREE')

  const [lineNode1, setLineNode1] = useState<number>(1)
  const [lineNode2, setLineNode2] = useState<number>(2)

  const [loadNode, setLoadNode] = useState<number>(2)
  const [loadFx, setLoadFx] = useState('0')
  const [loadFy, setLoadFy] = useState('-1000')
  const [loadFz, setLoadFz] = useState('0')
  const [loadMx, setLoadMx] = useState('0')
  const [loadMy, setLoadMy] = useState('0')
  const [loadMz, setLoadMz] = useState('0')

  const [concLineId, setConcLineId] = useState<number>(2)
  const [concRel, setConcRel] = useState('0.5')
  const [concFx, setConcFx] = useState('0')
  const [concFy, setConcFy] = useState('-1000')
  const [concFz, setConcFz] = useState('0')
  const [concMx, setConcMx] = useState('0')
  const [concMy, setConcMy] = useState('0')
  const [concMz, setConcMz] = useState('0')

  const [distLineId, setDistLineId] = useState<number>(2)
  const [distRelStart, setDistRelStart] = useState('0.2')
  const [distRelEnd, setDistRelEnd] = useState('0.8')
  const [distFxS, setDistFxS] = useState('0')
  const [distFyS, setDistFyS] = useState('-500')
  const [distFzS, setDistFzS] = useState('0')
  const [distMxS, setDistMxS] = useState('0')
  const [distMyS, setDistMyS] = useState('0')
  const [distMzS, setDistMzS] = useState('0')
  const [distFxE, setDistFxE] = useState('0')
  const [distFyE, setDistFyE] = useState('-500')
  const [distFzE, setDistFzE] = useState('0')
  const [distMxE, setDistMxE] = useState('0')
  const [distMyE, setDistMyE] = useState('0')
  const [distMzE, setDistMzE] = useState('0')

  const [matNameInput, setMatNameInput] = useState('STEEL')
  const [matEInput, setMatEInput] = useState('2.1e11')
  const [matGInput, setMatGInput] = useState('8.1e10')

  const [selectedNodes, setSelectedNodes] = useState<number[]>([])

  const statusClass = useMemo(() => {
    if (busy) return 'status pending'
    if (log.startsWith('Solve success')) return 'status ok'
    if (
      log.startsWith('Solve failed') ||
      log.startsWith('Bridge error') ||
      log.startsWith('Results load failed') ||
      log.startsWith('Builder error')
    ) {
      return 'status err'
    }
    return 'status'
  }, [busy, log])

  const modelOptions = useMemo(() => {
    const values = new Set(['models/sample_frame.fea', 'models/two_story_frame.fea'])
    if (modelPath.endsWith('.fea')) values.add(modelPath)
    return Array.from(values).filter(Boolean)
  }, [modelPath])

  const outputDirOptions = useMemo(() => {
    const values = new Set(['output', activeResultsDir, outputDir])
    return Array.from(values).filter(Boolean)
  }, [activeResultsDir, outputDir])

  const builderProjection = useMemo(() => projectXZ(nodes), [nodes])

  const builderLookup = useMemo(
    () => new Map(builderProjection.points.map((point) => [point.id, point])),
    [builderProjection],
  )

  const builderSegments = useMemo(
    () =>
      lines
        .map((line) => {
          const p1 = builderLookup.get(line.node1)
          const p2 = builderLookup.get(line.node2)
          if (!p1 || !p2) return null
          return { id: line.id, x1: p1.cx, y1: p1.cy, x2: p2.cx, y2: p2.cy }
        })
        .filter((item): item is { id: number; x1: number; y1: number; x2: number; y2: number } => item !== null),
    [lines, builderLookup],
  )

  const builderLineLookup = useMemo(() => {
    const map = new Map<number, { x1: number; y1: number; x2: number; y2: number }>()
    for (const seg of builderSegments) {
      map.set(seg.id, seg)
    }
    return map
  }, [builderSegments])

  const builder3DVisualization = useMemo(() => {
    if (nodes.length === 0) return null

    const nodeLookup = new Map(nodes.map((node) => [node.id, node]))
    const lineX: Array<number | null> = []
    const lineY: Array<number | null> = []
    const lineZ: Array<number | null> = []

    for (const line of lines) {
      const node1 = nodeLookup.get(line.node1)
      const node2 = nodeLookup.get(line.node2)
      if (!node1 || !node2) continue
      lineX.push(node1.x, node2.x, null)
      lineY.push(node1.y, node2.y, null)
      lineZ.push(node1.z, node2.z, null)
    }

    const forcePosX: number[] = []
    const forcePosY: number[] = []
    const forcePosZ: number[] = []
    const forceU: number[] = []
    const forceV: number[] = []
    const forceW: number[] = []

    const momentPosX: number[] = []
    const momentPosY: number[] = []
    const momentPosZ: number[] = []
    const momentU: number[] = []
    const momentV: number[] = []
    const momentW: number[] = []

    const pushForce = (x: number, y: number, z: number, fx: number, fy: number, fz: number) => {
      if (vectorMagnitude(fx, fy, fz) < 1e-9) return
      forcePosX.push(x)
      forcePosY.push(y)
      forcePosZ.push(z)
      forceU.push(fx)
      forceV.push(fy)
      forceW.push(fz)
    }

    const pushMoment = (x: number, y: number, z: number, mx: number, my: number, mz: number) => {
      if (vectorMagnitude(mx, my, mz) < 1e-9) return
      momentPosX.push(x)
      momentPosY.push(y)
      momentPosZ.push(z)
      momentU.push(mx)
      momentV.push(my)
      momentW.push(mz)
    }

    for (const load of nodalLoads) {
      const node = nodeLookup.get(load.nodeId)
      if (!node) continue
      pushForce(node.x, node.y, node.z, load.fx, load.fy, load.fz)
      pushMoment(node.x, node.y, node.z, load.mx, load.my, load.mz)
    }

    for (const load of lineConcLoads) {
      const line = lines.find((item) => item.id === load.lineId)
      if (!line) continue
      const node1 = nodeLookup.get(line.node1)
      const node2 = nodeLookup.get(line.node2)
      if (!node1 || !node2) continue
      const px = lerp(node1.x, node2.x, load.rel)
      const py = lerp(node1.y, node2.y, load.rel)
      const pz = lerp(node1.z, node2.z, load.rel)
      pushForce(px, py, pz, load.fx, load.fy, load.fz)
      pushMoment(px, py, pz, load.mx, load.my, load.mz)
    }

    for (const load of lineDistLoads) {
      const line = lines.find((item) => item.id === load.lineId)
      if (!line) continue
      const node1 = nodeLookup.get(line.node1)
      const node2 = nodeLookup.get(line.node2)
      if (!node1 || !node2) continue

      const ticks = 5
      for (let idx = 0; idx < ticks; idx += 1) {
        const t01 = idx / (ticks - 1)
        const t = lerp(load.relStart, load.relEnd, t01)
        const px = lerp(node1.x, node2.x, t)
        const py = lerp(node1.y, node2.y, t)
        const pz = lerp(node1.z, node2.z, t)

        const fx = lerp(load.fxS, load.fxE, t01)
        const fy = lerp(load.fyS, load.fyE, t01)
        const fz = lerp(load.fzS, load.fzE, t01)
        const mx = lerp(load.mxS, load.mxE, t01)
        const my = lerp(load.myS, load.myE, t01)
        const mz = lerp(load.mzS, load.mzE, t01)

        pushForce(px, py, pz, fx, fy, fz)
        pushMoment(px, py, pz, mx, my, mz)
      }
    }

    const xs = nodes.map((node) => node.x)
    const ys = nodes.map((node) => node.y)
    const zs = nodes.map((node) => node.z)
    const spanX = Math.max(1e-9, Math.max(...xs) - Math.min(...xs))
    const spanY = Math.max(1e-9, Math.max(...ys) - Math.min(...ys))
    const spanZ = Math.max(1e-9, Math.max(...zs) - Math.min(...zs))
    const modelDiag = Math.max(1, Math.sqrt(spanX * spanX + spanY * spanY + spanZ * spanZ))

    const forceMagnitudes = forceU.map((fx, i) => vectorMagnitude(fx, forceV[i], forceW[i]))
    const momentMagnitudes = momentU.map((mx, i) => vectorMagnitude(mx, momentV[i], momentW[i]))
    const forceMax = Math.max(1e-9, ...forceMagnitudes)
    const momentMax = Math.max(1e-9, ...momentMagnitudes)

    const forceShaftX: Array<number | null> = []
    const forceShaftY: Array<number | null> = []
    const forceShaftZ: Array<number | null> = []
    const forceHeadX: number[] = []
    const forceHeadY: number[] = []
    const forceHeadZ: number[] = []
    const forceHeadU: number[] = []
    const forceHeadV: number[] = []
    const forceHeadW: number[] = []

    const momentShaftX: Array<number | null> = []
    const momentShaftY: Array<number | null> = []
    const momentShaftZ: Array<number | null> = []
    const momentHeadX: number[] = []
    const momentHeadY: number[] = []
    const momentHeadZ: number[] = []
    const momentHeadU: number[] = []
    const momentHeadV: number[] = []
    const momentHeadW: number[] = []

    const appendGlyph = (
      baseX: number,
      baseY: number,
      baseZ: number,
      uxRaw: number,
      vyRaw: number,
      wzRaw: number,
      maxRaw: number,
      shaftX: Array<number | null>,
      shaftY: Array<number | null>,
      shaftZ: Array<number | null>,
      headX: number[],
      headY: number[],
      headZ: number[],
      headU: number[],
      headV: number[],
      headW: number[],
      lengthMinFactor: number,
      lengthMaxFactor: number,
    ) => {
      const mag = vectorMagnitude(uxRaw, vyRaw, wzRaw)
      if (mag < 1e-9 || maxRaw < 1e-9) return

      const dirX = uxRaw / mag
      const dirY = vyRaw / mag
      const dirZ = wzRaw / mag

      const ratio = clamp(mag / maxRaw, 0, 1)
      const fullLen = modelDiag * lerp(lengthMinFactor, lengthMaxFactor, ratio)
      const headLen = fullLen * 0.30
      const shaftLen = fullLen - headLen

      const shaftTipX = baseX + dirX * shaftLen
      const shaftTipY = baseY + dirY * shaftLen
      const shaftTipZ = baseZ + dirZ * shaftLen

      shaftX.push(baseX, shaftTipX, null)
      shaftY.push(baseY, shaftTipY, null)
      shaftZ.push(baseZ, shaftTipZ, null)

      headX.push(shaftTipX)
      headY.push(shaftTipY)
      headZ.push(shaftTipZ)
      headU.push(dirX * headLen)
      headV.push(dirY * headLen)
      headW.push(dirZ * headLen)
    }

    for (let i = 0; i < forcePosX.length; i += 1) {
      appendGlyph(
        forcePosX[i],
        forcePosY[i],
        forcePosZ[i],
        forceU[i],
        forceV[i],
        forceW[i],
        forceMax,
        forceShaftX,
        forceShaftY,
        forceShaftZ,
        forceHeadX,
        forceHeadY,
        forceHeadZ,
        forceHeadU,
        forceHeadV,
        forceHeadW,
        0.08,
        0.24,
      )
    }

    for (let i = 0; i < momentPosX.length; i += 1) {
      appendGlyph(
        momentPosX[i],
        momentPosY[i],
        momentPosZ[i],
        momentU[i],
        momentV[i],
        momentW[i],
        momentMax,
        momentShaftX,
        momentShaftY,
        momentShaftZ,
        momentHeadX,
        momentHeadY,
        momentHeadZ,
        momentHeadU,
        momentHeadV,
        momentHeadW,
        0.07,
        0.20,
      )
    }

    const data: any[] = [
      {
        type: 'scatter3d',
        mode: 'lines',
        x: lineX,
        y: lineY,
        z: lineZ,
        line: { width: 5, color: '#93c5fd' },
        name: 'Structure',
      },
      {
        type: 'scatter3d',
        mode: 'markers+text',
        x: nodes.map((node) => node.x),
        y: nodes.map((node) => node.y),
        z: nodes.map((node) => node.z),
        text: nodes.map((node) => `N${node.id}`),
        textposition: 'top center',
        marker: { size: 4, color: '#38bdf8' },
        name: 'Nodes',
      },
    ]

    if (forceHeadX.length > 0) {
      data.push({
        type: 'scatter3d',
        mode: 'lines',
        x: forceShaftX,
        y: forceShaftY,
        z: forceShaftZ,
        line: { width: 6, color: '#f59e0b' },
        name: 'Forces',
        showlegend: false,
        hoverinfo: 'skip',
      })
      data.push({
        type: 'cone',
        x: forceHeadX,
        y: forceHeadY,
        z: forceHeadZ,
        u: forceHeadU,
        v: forceHeadV,
        w: forceHeadW,
        anchor: 'tail',
        sizemode: 'scaled',
        sizeref: Math.max(modelDiag / 40, 0.05),
        colorscale: [[0, '#f59e0b'], [1, '#f59e0b']],
        showscale: false,
        name: 'Forces',
      })
    }

    if (momentHeadX.length > 0) {
      data.push({
        type: 'scatter3d',
        mode: 'lines',
        x: momentShaftX,
        y: momentShaftY,
        z: momentShaftZ,
        line: { width: 6, color: '#a855f7' },
        name: 'Moments',
        showlegend: false,
        hoverinfo: 'skip',
      })
      data.push({
        type: 'cone',
        x: momentHeadX,
        y: momentHeadY,
        z: momentHeadZ,
        u: momentHeadU,
        v: momentHeadV,
        w: momentHeadW,
        anchor: 'tail',
        sizemode: 'scaled',
        sizeref: Math.max(modelDiag / 45, 0.05),
        colorscale: [[0, '#a855f7'], [1, '#a855f7']],
        showscale: false,
        name: 'Moments',
      })
    }

    const layout: Partial<Layout> = {
      paper_bgcolor: '#050b16',
      plot_bgcolor: '#050b16',
      margin: { l: 0, r: 0, t: 0, b: 0 },
      showlegend: true,
      legend: { font: { color: '#cbd5e1' } },
      scene: {
        bgcolor: '#050b16',
        aspectmode: 'data',
        xaxis: { title: { text: 'X' }, color: '#94a3b8', gridcolor: '#1f2937', zerolinecolor: '#1f2937' },
        yaxis: { title: { text: 'Y' }, color: '#94a3b8', gridcolor: '#1f2937', zerolinecolor: '#1f2937' },
        zaxis: { title: { text: 'Z' }, color: '#94a3b8', gridcolor: '#1f2937', zerolinecolor: '#1f2937' },
      },
      uirevision: 'builder-3d',
    }

    return { data, layout }
  }, [nodes, lines, nodalLoads, lineConcLoads, lineDistLoads])

  const resultsVisualization = useMemo(() => {
    if (!results || !results.visualization?.nodes?.length) {
      return null
    }

    const scale = asFinite(resultsScale) ?? 120

    const nodeLookup = new Map(results.visualization.nodes.map((node) => [node.id, node]))

    const metricByLine = new Map<number, number>()
    for (const line of results.visualization.lines) {
      const value = resultsMetric === 'stress' ? line.stress : resultsMetric === 'shear' ? line.shear : line.moment
      metricByLine.set(line.id, value)
    }

    const nodeMetricAcc = new Map<number, { sum: number; count: number }>()
    for (const line of results.visualization.lines) {
      const value = metricByLine.get(line.id) ?? 0
      for (const nodeId of [line.node1, line.node2]) {
        const cur = nodeMetricAcc.get(nodeId) ?? { sum: 0, count: 0 }
        cur.sum += value
        cur.count += 1
        nodeMetricAcc.set(nodeId, cur)
      }
    }

    const nodeMetric = new Map<number, number>()
    for (const [nodeId, acc] of nodeMetricAcc.entries()) {
      nodeMetric.set(nodeId, acc.count > 0 ? acc.sum / acc.count : 0)
    }

    const allMetricValues = results.visualization.lines.flatMap((line) => {
      const node1Metric = nodeMetric.get(line.node1) ?? (metricByLine.get(line.id) ?? 0)
      const node2Metric = nodeMetric.get(line.node2) ?? (metricByLine.get(line.id) ?? 0)
      return [node1Metric, node2Metric, metricByLine.get(line.id) ?? 0]
    })
    const metricMin = Math.min(...allMetricValues)
    const metricMax = Math.max(...allMetricValues)

    const undeformedX: Array<number | null> = []
    const undeformedY: Array<number | null> = []
    const undeformedZ: Array<number | null> = []
    const deformedTraces: any[] = []

    for (const line of results.visualization.lines) {
      const node1 = nodeLookup.get(line.node1)
      const node2 = nodeLookup.get(line.node2)
      if (!node1 || !node2) continue

      undeformedX.push(node1.x, node2.x, null)
      undeformedY.push(node1.y, node2.y, null)
      undeformedZ.push(node1.z, node2.z, null)

      const metricA = nodeMetric.get(line.node1) ?? (metricByLine.get(line.id) ?? 0)
      const metricB = nodeMetric.get(line.node2) ?? (metricByLine.get(line.id) ?? 0)
      const segmentCount = 16
      for (let idx = 0; idx < segmentCount; idx += 1) {
        const t0 = idx / segmentCount
        const t1 = (idx + 1) / segmentCount
        const tm = 0.5 * (t0 + t1)

        const p0x = lerp(node1.x + node1.ux * scale, node2.x + node2.ux * scale, t0)
        const p0y = lerp(node1.y + node1.uy * scale, node2.y + node2.uy * scale, t0)
        const p0z = lerp(node1.z + node1.uz * scale, node2.z + node2.uz * scale, t0)

        const p1x = lerp(node1.x + node1.ux * scale, node2.x + node2.ux * scale, t1)
        const p1y = lerp(node1.y + node1.uy * scale, node2.y + node2.uy * scale, t1)
        const p1z = lerp(node1.z + node1.uz * scale, node2.z + node2.uz * scale, t1)

        const metricMid = lerp(metricA, metricB, tm)

        deformedTraces.push({
          type: 'scatter3d',
          mode: 'lines',
          x: [p0x, p1x],
          y: [p0y, p1y],
          z: [p0z, p1z],
          line: { width: 7, color: metricColor(metricMid, metricMin, metricMax) },
          name: `Def L${line.id}`,
          hovertemplate: `Line ${line.id}<br>${resultsMetric}: ${metricMid.toExponential(3)}<extra></extra>`,
          showlegend: false,
        })
      }
    }

    const baseNodes = {
      type: 'scatter3d',
      mode: 'markers+text',
      x: results.visualization.nodes.map((node) => node.x),
      y: results.visualization.nodes.map((node) => node.y),
      z: results.visualization.nodes.map((node) => node.z),
      text: results.visualization.nodes.map((node) => `N${node.id}`),
      textposition: 'top center',
      marker: { size: 4, color: '#94a3b8' },
      name: 'Nodes',
      hovertemplate: 'Node %{text}<extra></extra>',
      showlegend: false,
    }

    const undeformedTrace = {
      type: 'scatter3d',
      mode: 'lines',
      x: undeformedX,
      y: undeformedY,
      z: undeformedZ,
      line: { width: 4, color: '#475569', dash: 'dash' },
      name: 'Undeformed',
      hoverinfo: 'skip',
      showlegend: false,
    }

    const layout = {
      paper_bgcolor: '#050b16',
      plot_bgcolor: '#050b16',
      margin: { l: 0, r: 0, t: 0, b: 0 },
      scene: {
        bgcolor: '#050b16',
        aspectmode: 'data',
        xaxis: { title: { text: 'X' }, color: '#94a3b8', gridcolor: '#1f2937', zerolinecolor: '#1f2937' },
        yaxis: { title: { text: 'Y' }, color: '#94a3b8', gridcolor: '#1f2937', zerolinecolor: '#1f2937' },
        zaxis: { title: { text: 'Z' }, color: '#94a3b8', gridcolor: '#1f2937', zerolinecolor: '#1f2937' },
      },
      uirevision: 'results-3d',
    }

    return {
      data: [undeformedTrace, ...deformedTraces, baseNodes],
      layout,
      metricMin,
      metricMax,
    }
  }, [results, resultsMetric, resultsScale])

  const resultsGraphVisualization = useMemo(() => {
    if (!results) return null

    const lineIds = Array.from(
      new Set([
        ...results.charts.stressByLine.map((point) => point.lineId),
        ...results.charts.shearByLine.map((point) => point.lineId),
        ...results.charts.momentByLine.map((point) => point.lineId),
      ]),
    ).sort((a, b) => a - b)

    const stressMap = new Map(results.charts.stressByLine.map((point) => [point.lineId, point.value]))
    const shearMap = new Map(results.charts.shearByLine.map((point) => [point.lineId, point.value]))
    const momentMap = new Map(results.charts.momentByLine.map((point) => [point.lineId, point.value]))

    const labels = lineIds.map((id) => `L${id}`)
    const stressValues = lineIds.map((id) => stressMap.get(id) ?? 0)
    const shearValues = lineIds.map((id) => shearMap.get(id) ?? 0)
    const momentValues = lineIds.map((id) => momentMap.get(id) ?? 0)

    return {
      data: [
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Stress (Pa)',
          x: labels,
          y: stressValues,
          marker: { color: '#22d3ee' },
          line: { color: '#22d3ee', width: 2.4 },
        },
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Shear (N)',
          x: labels,
          y: shearValues,
          marker: { color: '#f59e0b' },
          line: { color: '#f59e0b', width: 2.4 },
        },
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Moment (N·m)',
          x: labels,
          y: momentValues,
          marker: { color: '#a855f7' },
          line: { color: '#a855f7', width: 2.4 },
        },
      ],
      layout: {
        paper_bgcolor: '#050b16',
        plot_bgcolor: '#050b16',
        margin: { l: 56, r: 18, t: 20, b: 50 },
        legend: { orientation: 'h', x: 0, y: 1.14, font: { color: '#cbd5e1' } },
        xaxis: { title: { text: 'Line' }, color: '#94a3b8', gridcolor: '#1f2937' },
        yaxis: { title: { text: 'Value' }, color: '#94a3b8', gridcolor: '#1f2937', zerolinecolor: '#1f2937' },
        uirevision: 'results-graph',
      } as Partial<Layout>,
    }
  }, [results])

  const generatedModelText = useMemo(() => {
    const text: string[] = []
    text.push('# Generated by V0.3 visual builder')
    text.push('# NODE key x y z')
    text.push('# LINE key node1 node2')
    text.push('# SUPPORT_DEF name FIXED|PINNED|ROLLER')
    text.push('# SUPPORT node supportName')
    text.push('# SECTION_RECT name width height')
    text.push('# MATERIAL name E G')
    text.push('# ASSIGN_SECTION line sectionName')
    text.push('# ASSIGN_MATERIAL line materialName')
    text.push('# LOAD_CASE key name')
    text.push('# NODAL_LOAD lc node Fx Fy Fz Mx My Mz')
    text.push('# LINE_CONC_LOAD lc line rel Fx Fy Fz Mx My Mz')
    text.push('# LINE_DIST_LOAD lc line rel_start rel_end FxS FyS FzS MxS MyS MzS FxE FyE FzE MxE MyE MzE')
    text.push('')

    for (const node of nodes) text.push(`NODE ${node.id} ${node.x} ${node.y} ${node.z}`)

    text.push('')
    for (const line of lines) text.push(`LINE ${line.id} ${line.node1} ${line.node2}`)

    text.push('')
    text.push('SUPPORT_DEF FIXED FIXED')
    text.push('SUPPORT_DEF PINNED PINNED')
    text.push('SUPPORT_DEF ROLLER ROLLER')
    for (const node of nodes.filter((item) => item.support !== 'FREE')) {
      text.push(`SUPPORT ${node.id} ${node.support}`)
    }

    text.push('')
    text.push('SECTION_RECT R300x500 0.30 0.50')
    for (const material of materials) {
      text.push(`MATERIAL ${material.name} ${material.e} ${material.g}`)
    }
    const activeMaterial = materials.find((material) => material.name === defaultMaterialName)?.name ?? materials[0].name
    for (const line of lines) {
      text.push(`ASSIGN_SECTION ${line.id} R300x500`)
      text.push(`ASSIGN_MATERIAL ${line.id} ${activeMaterial}`)
    }

    text.push('')
    text.push('LOAD_CASE 1 BUILDER')
    text.push('')

    for (const load of nodalLoads) {
      text.push(`NODAL_LOAD 1 ${load.nodeId} ${load.fx} ${load.fy} ${load.fz} ${load.mx} ${load.my} ${load.mz}`)
    }
    for (const load of lineConcLoads) {
      text.push(`LINE_CONC_LOAD 1 ${load.lineId} ${load.rel} ${load.fx} ${load.fy} ${load.fz} ${load.mx} ${load.my} ${load.mz}`)
    }
    for (const load of lineDistLoads) {
      text.push(
        `LINE_DIST_LOAD 1 ${load.lineId} ${load.relStart} ${load.relEnd} ${load.fxS} ${load.fyS} ${load.fzS} ${load.mxS} ${load.myS} ${load.mzS} ${load.fxE} ${load.fyE} ${load.fzE} ${load.mxE} ${load.myE} ${load.mzE}`,
      )
    }

    return text.join('\n')
  }, [nodes, lines, nodalLoads, lineConcLoads, lineDistLoads, materials, defaultMaterialName])

  async function loadResults(loadCaseId?: number, outputDirOverride?: string) {
    setLoadingResults(true)
    try {
      const targetOutputDir = outputDirOverride ?? activeResultsDir
      const response = await fetch(apiUrl('/api/results'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputDir: targetOutputDir, loadCaseId: loadCaseId ?? selectedLoadCaseId }),
      })

      const data = (await parseApiResponse(response)) as ResultsResponse
      if (!response.ok || !data.ok) {
        setLog(`Results load failed\n${data.error ?? 'Unknown error'}`)
        setResults(null)
        return
      }

      setResults(data)
      setSelectedLoadCaseId(data.selectedLoadCaseId)
      setActiveResultsDir(data.outputDir)
    } catch (error) {
      setLog(`Results load failed\n${error instanceof Error ? error.message : String(error)}`)
      setResults(null)
    } finally {
      setLoadingResults(false)
    }
  }

  async function runSolve() {
    setBusy(true)
    setFiles([])
    setResults(null)
    setLog('Running solver...')
    try {
      const response = await fetch(apiUrl('/api/solve'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executablePath, modelPath, outputDir, isolateRun: true }),
      })
      const data = (await parseApiResponse(response)) as SolveResponse
      if (!response.ok || !data.ok) {
        setLog(`Solve failed (code ${data.code ?? 'n/a'})\n${data.error ?? data.stderr ?? 'Unknown error'}`)
      } else {
        setActiveResultsDir(data.outputDir)
        setLog(`Solve success (code ${data.code})\n\nSTDOUT:\n${data.stdout || '(empty)'}`)
        await loadResults(selectedLoadCaseId, data.outputDir)
      }
      setFiles(data.outputFiles ?? [])
    } catch (error) {
      setLog(`Bridge error\n${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  async function runBuilderSolve() {
    if (nodes.length < 2 || lines.length < 1) {
      setLog('Builder error\nBuilder needs at least 2 nodes and 1 line before solve.')
      return
    }

    setBusy(true)
    setFiles([])
    setResults(null)
    setLog('Running solver using builder model...')
    try {
      const response = await fetch(apiUrl('/api/solve-text'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executablePath,
          outputDir,
          isolateRun: true,
          modelText: generatedModelText,
          modelFileName: 'builder_model_v03.fea',
        }),
      })
      const data = (await parseApiResponse(response)) as SolveResponse
      if (!response.ok || !data.ok) {
        setLog(`Solve failed (code ${data.code ?? 'n/a'})\n${data.error ?? data.stderr ?? 'Unknown error'}`)
      } else {
        setModelPath(data.modelPath)
        setActiveResultsDir(data.outputDir)
        setLog(`Solve success (code ${data.code})\n\nSTDOUT:\n${data.stdout || '(empty)'}`)
        await loadResults(1, data.outputDir)
      }
      setFiles(data.outputFiles ?? [])
    } catch (error) {
      setLog(`Bridge error\n${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  async function getPlotPng(plotDiv: any, width: number, height: number) {
    return (Plotly as any).toImage(plotDiv, {
      format: 'png',
      width,
      height,
      scale: 2,
    }) as Promise<string>
  }

  async function exportStructurePng() {
    if (!resultsStructurePlotDiv || !results) {
      setLog('Export failed\nStructure plot is not ready yet.')
      return
    }

    setExportingReport(true)
    try {
      const image = await getPlotPng(resultsStructurePlotDiv, 1400, 850)
      downloadDataUrl(image, `report_lc${results.selectedLoadCaseId}_structure.png`)
      setLog(`Export success\nSaved structure PNG for LC${results.selectedLoadCaseId}.`)
    } catch (error) {
      setLog(`Export failed\n${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setExportingReport(false)
    }
  }

  async function exportGraphPng() {
    if (!resultsGraphPlotDiv || !results) {
      setLog('Export failed\nResult graph is not ready yet.')
      return
    }

    setExportingReport(true)
    try {
      const image = await getPlotPng(resultsGraphPlotDiv, 1400, 700)
      downloadDataUrl(image, `report_lc${results.selectedLoadCaseId}_graph.png`)
      setLog(`Export success\nSaved graph PNG for LC${results.selectedLoadCaseId}.`)
    } catch (error) {
      setLog(`Export failed\n${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setExportingReport(false)
    }
  }

  async function exportReportPdf() {
    if (!results) {
      setLog('Export failed\nNo results loaded.')
      return
    }

    setExportingReport(true)
    try {
      const [structureImage, graphImage] = await Promise.all([
        resultsStructurePlotDiv ? getPlotPng(resultsStructurePlotDiv, 1400, 850) : Promise.resolve<string | null>(null),
        resultsGraphPlotDiv ? getPlotPng(resultsGraphPlotDiv, 1400, 700) : Promise.resolve<string | null>(null),
      ])

      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const margin = 36
      const contentWidth = pageWidth - margin * 2

      let y = 44
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text(`FEA Report · LC${results.selectedLoadCaseId} (${results.selectedLoadCaseName})`, margin, y)
      y += 22

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Run folder: ${activeResultsDir}`, margin, y)
      y += 18

      pdf.setFontSize(11)
      pdf.text(`Max displacement: ${results.summary.maxDisp.value.toExponential(3)} m (Node ${results.summary.maxDisp.nodeId ?? '-'})`, margin, y)
      y += 14
      pdf.text(`Max stress: ${results.summary.maxStress.value.toExponential(3)} Pa (Line ${results.summary.maxStress.lineId ?? '-'})`, margin, y)
      y += 14
      pdf.text(`Max shear: ${results.summary.maxShear.value.toExponential(3)} N (Line ${results.summary.maxShear.lineId ?? '-'})`, margin, y)
      y += 14
      pdf.text(`Max moment: ${results.summary.maxMoment.value.toExponential(3)} N·m (Line ${results.summary.maxMoment.lineId ?? '-'})`, margin, y)
      y += 18

      if (structureImage) {
        const imgHeight = contentWidth * (850 / 1400)
        pdf.addImage(structureImage, 'PNG', margin, y, contentWidth, imgHeight)
        y += imgHeight + 14
      }

      if (graphImage) {
        const imgHeight = contentWidth * (700 / 1400)
        const pageHeight = pdf.internal.pageSize.getHeight()
        if (y + imgHeight + 20 > pageHeight) {
          pdf.addPage()
          y = 40
        }
        pdf.addImage(graphImage, 'PNG', margin, y, contentWidth, imgHeight)
      }

      pdf.save(`report_lc${results.selectedLoadCaseId}.pdf`)
      setLog(`Export success\nSaved PDF report for LC${results.selectedLoadCaseId}.`)
    } catch (error) {
      setLog(`Export failed\n${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setExportingReport(false)
    }
  }

  function addNode() {
    const x = asFinite(nodeX)
    const y = asFinite(nodeY)
    const z = asFinite(nodeZ)
    if (x === null || y === null || z === null) {
      setLog('Builder error\nNode coordinates must be valid numbers.')
      return
    }

    const id = nextId(nodes)
    const newNode: BuilderNode = { id, x, y, z, support: nodeSupport }
    const nodeLookup = new Map(nodes.map((node) => [node.id, node]))

    let updatedLines = [...lines]
    let updatedConcLoads = [...lineConcLoads]
    let updatedDistLoads = [...lineDistLoads]

    let nextLineId = nextId(updatedLines)
    let nextConcId = nextId(updatedConcLoads)
    let nextDistId = nextId(updatedDistLoads)

    let splitCount = 0

    for (const line of lines) {
      const node1 = nodeLookup.get(line.node1)
      const node2 = nodeLookup.get(line.node2)
      if (!node1 || !node2) continue

      if (!isPointOnSegment3D(newNode, node1, node2)) continue

      const totalLen = distance3D(node1, node2)
      if (totalLen < 1e-12) continue

      const relSplit = clamp(distance3D(node1, newNode) / totalLen, 1e-6, 1 - 1e-6)
      const firstLineId = nextLineId++
      const secondLineId = nextLineId++
      splitCount += 1

      updatedLines = updatedLines
        .filter((item) => item.id !== line.id)
        .concat([
          { id: firstLineId, node1: line.node1, node2: id },
          { id: secondLineId, node1: id, node2: line.node2 },
        ])

      const lineConc = updatedConcLoads.filter((load) => load.lineId === line.id)
      updatedConcLoads = updatedConcLoads.filter((load) => load.lineId !== line.id)
      for (const load of lineConc) {
        if (load.rel <= relSplit) {
          updatedConcLoads.push({
            ...load,
            id: nextConcId++,
            lineId: firstLineId,
            rel: clamp(load.rel / relSplit, 0, 1),
          })
        } else {
          updatedConcLoads.push({
            ...load,
            id: nextConcId++,
            lineId: secondLineId,
            rel: clamp((load.rel - relSplit) / (1 - relSplit), 0, 1),
          })
        }
      }

      const lineDist = updatedDistLoads.filter((load) => load.lineId === line.id)
      updatedDistLoads = updatedDistLoads.filter((load) => load.lineId !== line.id)
      for (const load of lineDist) {
        const start = load.relStart
        const end = load.relEnd

        if (end <= relSplit) {
          updatedDistLoads.push({
            ...load,
            id: nextDistId++,
            lineId: firstLineId,
            relStart: clamp(start / relSplit, 0, 1),
            relEnd: clamp(end / relSplit, 0, 1),
          })
          continue
        }

        if (start >= relSplit) {
          updatedDistLoads.push({
            ...load,
            id: nextDistId++,
            lineId: secondLineId,
            relStart: clamp((start - relSplit) / (1 - relSplit), 0, 1),
            relEnd: clamp((end - relSplit) / (1 - relSplit), 0, 1),
          })
          continue
        }

        const denom = Math.max(1e-12, end - start)
        const tSplit = clamp((relSplit - start) / denom, 0, 1)
        const fxMid = lerp(load.fxS, load.fxE, tSplit)
        const fyMid = lerp(load.fyS, load.fyE, tSplit)
        const fzMid = lerp(load.fzS, load.fzE, tSplit)
        const mxMid = lerp(load.mxS, load.mxE, tSplit)
        const myMid = lerp(load.myS, load.myE, tSplit)
        const mzMid = lerp(load.mzS, load.mzE, tSplit)

        updatedDistLoads.push({
          ...load,
          id: nextDistId++,
          lineId: firstLineId,
          relStart: clamp(start / relSplit, 0, 1),
          relEnd: 1,
          fxE: fxMid,
          fyE: fyMid,
          fzE: fzMid,
          mxE: mxMid,
          myE: myMid,
          mzE: mzMid,
        })

        updatedDistLoads.push({
          ...load,
          id: nextDistId++,
          lineId: secondLineId,
          relStart: 0,
          relEnd: clamp((end - relSplit) / (1 - relSplit), 0, 1),
          fxS: fxMid,
          fyS: fyMid,
          fzS: fzMid,
          mxS: mxMid,
          myS: myMid,
          mzS: mzMid,
        })
      }
    }

    setNodes((prev) => [...prev, newNode])
    setLines(updatedLines)
    setLineConcLoads(updatedConcLoads)
    setLineDistLoads(updatedDistLoads)

    if (splitCount > 0) {
      setLog(`Builder info\nNode ${id} was inserted on ${splitCount} line(s); connectivity and line loads were remapped.`)
    }
  }

  function removeNode(id: number) {
    const removedLineIds = lines.filter((line) => line.node1 === id || line.node2 === id).map((line) => line.id)
    const removedLineSet = new Set(removedLineIds)

    setNodes((prev) => prev.filter((node) => node.id !== id))
    setLines((prev) => prev.filter((line) => line.node1 !== id && line.node2 !== id))
    setNodalLoads((prev) => prev.filter((load) => load.nodeId !== id))
    setLineConcLoads((prev) => prev.filter((load) => !removedLineSet.has(load.lineId)))
    setLineDistLoads((prev) => prev.filter((load) => !removedLineSet.has(load.lineId)))
    setSelectedNodes((prev) => prev.filter((nodeId) => nodeId !== id))
  }

  function addLine() {
    if (lineNode1 === lineNode2) {
      setLog('Builder error\nLine endpoints must be different nodes.')
      return
    }

    if (!nodes.some((node) => node.id === lineNode1) || !nodes.some((node) => node.id === lineNode2)) {
      setLog('Builder error\nSelected nodes for line are not valid.')
      return
    }

    const exists = lines.some((line) => {
      const sameOrder = line.node1 === lineNode1 && line.node2 === lineNode2
      const reverseOrder = line.node1 === lineNode2 && line.node2 === lineNode1
      return sameOrder || reverseOrder
    })
    if (exists) {
      setLog('Builder info\nLine already exists for this node pair.')
      return
    }

    setLines((prev) => [...prev, { id: nextId(prev), node1: lineNode1, node2: lineNode2 }])
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((line) => line.id !== id))
    setLineConcLoads((prev) => prev.filter((load) => load.lineId !== id))
    setLineDistLoads((prev) => prev.filter((load) => load.lineId !== id))
  }

  function addLineFromSelection() {
    if (selectedNodes.length !== 2) {
      setLog('Builder info\nSelect exactly two nodes on the canvas to create a line.')
      return
    }

    const [node1, node2] = selectedNodes
    setLineNode1(node1)
    setLineNode2(node2)

    const exists = lines.some((line) => {
      const sameOrder = line.node1 === node1 && line.node2 === node2
      const reverseOrder = line.node1 === node2 && line.node2 === node1
      return sameOrder || reverseOrder
    })
    if (exists) {
      setLog('Builder info\nLine already exists for selected nodes.')
      return
    }

    setLines((prev) => [...prev, { id: nextId(prev), node1, node2 }])
  }

  function addNodalLoad() {
    const fx = asFinite(loadFx)
    const fy = asFinite(loadFy)
    const fz = asFinite(loadFz)
    const mx = asFinite(loadMx)
    const my = asFinite(loadMy)
    const mz = asFinite(loadMz)
    if ([fx, fy, fz, mx, my, mz].some((value) => value === null)) {
      setLog('Builder error\nNodal load values must be valid numbers.')
      return
    }

    setNodalLoads((prev) => [
      ...prev,
      {
        id: nextId(prev),
        nodeId: loadNode,
        fx: fx as number,
        fy: fy as number,
        fz: fz as number,
        mx: mx as number,
        my: my as number,
        mz: mz as number,
      },
    ])
  }

  function addLineConcLoad() {
    const rel = asFinite(concRel)
    const fx = asFinite(concFx)
    const fy = asFinite(concFy)
    const fz = asFinite(concFz)
    const mx = asFinite(concMx)
    const my = asFinite(concMy)
    const mz = asFinite(concMz)

    if ([rel, fx, fy, fz, mx, my, mz].some((value) => value === null)) {
      setLog('Builder error\nConcentrated line load values must be valid numbers.')
      return
    }
    const relNum = rel as number
    if (relNum < 0 || relNum > 1) {
      setLog('Builder error\nConcentrated load relative position must be between 0 and 1.')
      return
    }

    setLineConcLoads((prev) => [
      ...prev,
      {
        id: nextId(prev),
        lineId: concLineId,
        rel: relNum,
        fx: fx as number,
        fy: fy as number,
        fz: fz as number,
        mx: mx as number,
        my: my as number,
        mz: mz as number,
      },
    ])
  }

  function addLineDistLoad() {
    const relStart = asFinite(distRelStart)
    const relEnd = asFinite(distRelEnd)
    const fxS = asFinite(distFxS)
    const fyS = asFinite(distFyS)
    const fzS = asFinite(distFzS)
    const mxS = asFinite(distMxS)
    const myS = asFinite(distMyS)
    const mzS = asFinite(distMzS)
    const fxE = asFinite(distFxE)
    const fyE = asFinite(distFyE)
    const fzE = asFinite(distFzE)
    const mxE = asFinite(distMxE)
    const myE = asFinite(distMyE)
    const mzE = asFinite(distMzE)

    if ([relStart, relEnd, fxS, fyS, fzS, mxS, myS, mzS, fxE, fyE, fzE, mxE, myE, mzE].some((value) => value === null)) {
      setLog('Builder error\nDistributed line load values must be valid numbers.')
      return
    }

    const startNum = relStart as number
    const endNum = relEnd as number
    if (startNum < 0 || startNum > 1 || endNum < 0 || endNum > 1 || endNum <= startNum) {
      setLog('Builder error\nDistributed load range must satisfy 0 <= start < end <= 1.')
      return
    }

    setLineDistLoads((prev) => [
      ...prev,
      {
        id: nextId(prev),
        lineId: distLineId,
        relStart: startNum,
        relEnd: endNum,
        fxS: fxS as number,
        fyS: fyS as number,
        fzS: fzS as number,
        mxS: mxS as number,
        myS: myS as number,
        mzS: mzS as number,
        fxE: fxE as number,
        fyE: fyE as number,
        fzE: fzE as number,
        mxE: mxE as number,
        myE: myE as number,
        mzE: mzE as number,
      },
    ])
  }

  function setNodeSupportType(nodeId: number, support: 'FREE' | 'FIXED' | 'PINNED' | 'ROLLER') {
    setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, support } : node)))
  }

  function onCanvasNodeClick(nodeId: number) {
    setSelectedNodes((prev) => {
      if (prev.includes(nodeId)) return prev.filter((id) => id !== nodeId)
      if (prev.length >= 2) return [prev[1], nodeId]
      return [...prev, nodeId]
    })
  }

  function removeNodalLoad(id: number) {
    setNodalLoads((prev) => prev.filter((item) => item.id !== id))
  }

  function removeConcLoad(id: number) {
    setLineConcLoads((prev) => prev.filter((item) => item.id !== id))
  }

  function removeDistLoad(id: number) {
    setLineDistLoads((prev) => prev.filter((item) => item.id !== id))
  }

  function addMaterial() {
    const name = matNameInput.trim().toUpperCase()
    const e = asFinite(matEInput)
    const g = asFinite(matGInput)
    if (!name) {
      setLog('Builder error\nMaterial name is required.')
      return
    }
    if (e === null || g === null || e <= 0 || g <= 0) {
      setLog('Builder error\nMaterial E and G must be positive numbers.')
      return
    }
    if (materials.some((material) => material.name === name)) {
      setLog(`Builder info\nMaterial ${name} already exists.`)
      return
    }

    setMaterials((prev) => [...prev, { name, e, g }])
    setDefaultMaterialName(name)
  }

  function removeMaterial(name: string) {
    if (materials.length <= 1) {
      setLog('Builder info\nAt least one material is required.')
      return
    }

    const next = materials.filter((material) => material.name !== name)
    setMaterials(next)
    if (defaultMaterialName === name) {
      setDefaultMaterialName(next[0].name)
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="pill">FEA Solver · Web UI (V0.3)</p>
        <h1>Dedicated React UI</h1>
        <p className="subtitle">
          Builder now supports visual editing with full delete actions and structure/load overlays, plus an upgraded result structure viewer.
        </p>
      </header>

      <section className="app-shell">
        <div className="app-toolbar">
          <button
            className={sidebarOpen ? 'sidebar-toggle sidebar-toggle-floating active' : 'sidebar-toggle sidebar-toggle-floating'}
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-pressed={sidebarOpen}
            title="Toggle controls sidebar"
          >
            Controls
          </button>
        </div>

        <div className={sidebarOpen ? 'sidebar-overlay open' : 'sidebar-overlay'} onClick={() => setSidebarOpen(false)} />

        <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
          <div className="sidebar-header">
            <strong>Controls</strong>
            <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>Close</button>
          </div>

          <details open={solvePanelOpen} onToggle={(event) => setSolvePanelOpen((event.target as HTMLDetailsElement).open)} className="card sidebar-card foldable-panel">
            <summary>Solve</summary>
            <div className="form">
              <label>
                Solver executable
                <input value={executablePath} onChange={(event) => setExecutablePath(event.target.value)} />
              </label>
              <label>
                Model file selector
                <div className="path-picker">
                  <select value={modelPath} onChange={(event) => setModelPath(event.target.value)}>
                    {modelOptions.map((item) => (
                      <option key={`model-opt-${item}`} value={item}>{pathLabel(item)}</option>
                    ))}
                  </select>
                  <input value={modelPath} onChange={(event) => setModelPath(event.target.value)} placeholder="or type custom model path" />
                </div>
              </label>
              <label>
                Output directory selector
                <div className="path-picker">
                  <select value={outputDir} onChange={(event) => setOutputDir(event.target.value)}>
                    {outputDirOptions.map((item) => (
                      <option key={`output-opt-${item}`} value={item}>{item}</option>
                    ))}
                  </select>
                  <input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} placeholder="or type custom output directory" />
                </div>
              </label>
              <button onClick={runSolve} disabled={busy}>{busy ? 'Running...' : 'Run Solve (Path)'}</button>
              <button onClick={runBuilderSolve} disabled={busy || nodes.length < 2 || lines.length < 1}>Run Solve (Builder)</button>
            </div>
            <p className={statusClass}>{busy ? 'Working...' : 'Idle'}</p>
          </details>

          <details open={bridgeLogOpen} onToggle={(event) => setBridgeLogOpen((event.target as HTMLDetailsElement).open)} className="card sidebar-card foldable-panel">
            <summary>Bridge Log</summary>
            <pre><code>{log}</code></pre>
          </details>

          <details open={outputFilesOpen} onToggle={(event) => setOutputFilesOpen((event.target as HTMLDetailsElement).open)} className="card sidebar-card foldable-panel">
            <summary>Output Files</summary>
            {files.length === 0 ? (
              <p>No output files yet.</p>
            ) : (
              <ul>
                {files.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            )}
          </details>
        </aside>

        <main className="main-content">
          <article className="card">
          <h2>V0.3 Model Builder</h2>
          <div className="builder-layout">
            <div className="builder-controls">
              <div className="builder-block">
                <h3>Add Node</h3>
                <div className="row-3">
                  <input value={nodeX} onChange={(event) => setNodeX(event.target.value)} placeholder="x" />
                  <input value={nodeY} onChange={(event) => setNodeY(event.target.value)} placeholder="y" />
                  <input value={nodeZ} onChange={(event) => setNodeZ(event.target.value)} placeholder="z" />
                </div>
                <select value={nodeSupport} onChange={(event) => setNodeSupport(event.target.value as 'FREE' | 'FIXED' | 'PINNED' | 'ROLLER')}>
                  <option value="FREE">FREE</option>
                  <option value="FIXED">FIXED</option>
                  <option value="PINNED">PINNED</option>
                  <option value="ROLLER">ROLLER</option>
                </select>
                <button onClick={addNode}>Add Node</button>
              </div>

              <div className="builder-block">
                <h3>Add Line</h3>
                <div className="row-2">
                  <select value={lineNode1} onChange={(event) => setLineNode1(Number(event.target.value))}>
                    {nodes.map((node) => (
                      <option key={`a-${node.id}`} value={node.id}>Node {node.id}</option>
                    ))}
                  </select>
                  <select value={lineNode2} onChange={(event) => setLineNode2(Number(event.target.value))}>
                    {nodes.map((node) => (
                      <option key={`b-${node.id}`} value={node.id}>Node {node.id}</option>
                    ))}
                  </select>
                </div>
                <div className="row-2">
                  <button onClick={addLine}>Add Line by Select</button>
                  <button onClick={addLineFromSelection}>Add Line from Canvas Pick</button>
                </div>
                <small>Canvas selected nodes: {selectedNodes.length > 0 ? selectedNodes.join(', ') : 'none'}</small>
              </div>

              <div className="builder-block">
                <h3>Add Nodal Load (LC1)</h3>
                <select value={loadNode} onChange={(event) => setLoadNode(Number(event.target.value))}>
                  {nodes.map((node) => (
                    <option key={`ln-${node.id}`} value={node.id}>Node {node.id}</option>
                  ))}
                </select>
                <div className="row-3">
                  <input value={loadFx} onChange={(event) => setLoadFx(event.target.value)} placeholder="Fx" />
                  <input value={loadFy} onChange={(event) => setLoadFy(event.target.value)} placeholder="Fy" />
                  <input value={loadFz} onChange={(event) => setLoadFz(event.target.value)} placeholder="Fz" />
                </div>
                <div className="row-3">
                  <input value={loadMx} onChange={(event) => setLoadMx(event.target.value)} placeholder="Mx" />
                  <input value={loadMy} onChange={(event) => setLoadMy(event.target.value)} placeholder="My" />
                  <input value={loadMz} onChange={(event) => setLoadMz(event.target.value)} placeholder="Mz" />
                </div>
                <button onClick={addNodalLoad}>Add Nodal Load</button>
              </div>

              <div className="builder-block">
                <h3>Add Line Concentrated Load (LC1)</h3>
                <div className="row-2">
                  <select value={concLineId} onChange={(event) => setConcLineId(Number(event.target.value))}>
                    {lines.map((line) => (
                      <option key={`cl-${line.id}`} value={line.id}>Line {line.id}</option>
                    ))}
                  </select>
                  <input value={concRel} onChange={(event) => setConcRel(event.target.value)} placeholder="rel (0..1)" />
                </div>
                <div className="row-3">
                  <input value={concFx} onChange={(event) => setConcFx(event.target.value)} placeholder="Fx" />
                  <input value={concFy} onChange={(event) => setConcFy(event.target.value)} placeholder="Fy" />
                  <input value={concFz} onChange={(event) => setConcFz(event.target.value)} placeholder="Fz" />
                </div>
                <div className="row-3">
                  <input value={concMx} onChange={(event) => setConcMx(event.target.value)} placeholder="Mx" />
                  <input value={concMy} onChange={(event) => setConcMy(event.target.value)} placeholder="My" />
                  <input value={concMz} onChange={(event) => setConcMz(event.target.value)} placeholder="Mz" />
                </div>
                <button onClick={addLineConcLoad} disabled={lines.length === 0}>Add Concentrated Line Load</button>
              </div>

              <div className="builder-block">
                <h3>Add Line Distributed Load (LC1)</h3>
                <div className="row-3">
                  <select value={distLineId} onChange={(event) => setDistLineId(Number(event.target.value))}>
                    {lines.map((line) => (
                      <option key={`dl-${line.id}`} value={line.id}>Line {line.id}</option>
                    ))}
                  </select>
                  <input value={distRelStart} onChange={(event) => setDistRelStart(event.target.value)} placeholder="rel start" />
                  <input value={distRelEnd} onChange={(event) => setDistRelEnd(event.target.value)} placeholder="rel end" />
                </div>
                <div className="row-3">
                  <input value={distFxS} onChange={(event) => setDistFxS(event.target.value)} placeholder="FxS" />
                  <input value={distFyS} onChange={(event) => setDistFyS(event.target.value)} placeholder="FyS" />
                  <input value={distFzS} onChange={(event) => setDistFzS(event.target.value)} placeholder="FzS" />
                </div>
                <div className="row-3">
                  <input value={distMxS} onChange={(event) => setDistMxS(event.target.value)} placeholder="MxS" />
                  <input value={distMyS} onChange={(event) => setDistMyS(event.target.value)} placeholder="MyS" />
                  <input value={distMzS} onChange={(event) => setDistMzS(event.target.value)} placeholder="MzS" />
                </div>
                <div className="row-3">
                  <input value={distFxE} onChange={(event) => setDistFxE(event.target.value)} placeholder="FxE" />
                  <input value={distFyE} onChange={(event) => setDistFyE(event.target.value)} placeholder="FyE" />
                  <input value={distFzE} onChange={(event) => setDistFzE(event.target.value)} placeholder="FzE" />
                </div>
                <div className="row-3">
                  <input value={distMxE} onChange={(event) => setDistMxE(event.target.value)} placeholder="MxE" />
                  <input value={distMyE} onChange={(event) => setDistMyE(event.target.value)} placeholder="MyE" />
                  <input value={distMzE} onChange={(event) => setDistMzE(event.target.value)} placeholder="MzE" />
                </div>
                <button onClick={addLineDistLoad} disabled={lines.length === 0}>Add Distributed Line Load</button>
              </div>

              <div className="builder-block">
                <h3>Material</h3>
                <select value={defaultMaterialName} onChange={(event) => setDefaultMaterialName(event.target.value)}>
                  {materials.map((material) => (
                    <option key={`mat-default-${material.name}`} value={material.name}>{material.name}</option>
                  ))}
                </select>
                <small>Default material applied to all lines.</small>
                <div className="row-3">
                  <input value={matNameInput} onChange={(event) => setMatNameInput(event.target.value)} placeholder="Name" />
                  <input value={matEInput} onChange={(event) => setMatEInput(event.target.value)} placeholder="E" />
                  <input value={matGInput} onChange={(event) => setMatGInput(event.target.value)} placeholder="G" />
                </div>
                <button onClick={addMaterial}>Add Material</button>
              </div>
            </div>

            <div className="builder-canvas-wrap">
              <svg viewBox={`0 0 ${builderProjection.width} ${builderProjection.height}`} className="builder-canvas" role="img" aria-label="Model canvas">
                <rect x="0" y="0" width={builderProjection.width} height={builderProjection.height} className="canvas-bg" />

                {builderSegments.map((segment) => (
                  <line key={`line-${segment.id}`} x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2} className="canvas-line" />
                ))}

                {lineDistLoads.map((load) => {
                  const seg = builderLineLookup.get(load.lineId)
                  if (!seg) return null
                  const ticks = 5
                  const arrows = Array.from({ length: ticks }, (_, idx) => {
                    const t01 = idx / (ticks - 1)
                    const t = lerp(load.relStart, load.relEnd, t01)
                    const x = lerp(seg.x1, seg.x2, t)
                    const y = lerp(seg.y1, seg.y2, t)
                    const intensity = Math.abs(lerp(load.fyS, load.fyE, t01))
                    const len = 10 + 14 * clamp(intensity / 3000, 0, 1)
                    const y2 = y + (load.fyS + load.fyE <= 0 ? len : -len)
                    const head = arrowGeometry(x, y, x, y2, 5)
                    return { x, y, y2, head }
                  })

                  const avgMx = 0.5 * (load.mxS + load.mxE)
                  const avgMy = 0.5 * (load.myS + load.myE)
                  const avgMz = 0.5 * (load.mzS + load.mzE)
                  const momentMag = vectorMagnitude(avgMx, avgMy, avgMz)
                  const signRef = Math.abs(avgMz) > 1e-9 ? avgMz : (Math.abs(avgMy) > 1e-9 ? avgMy : avgMx)
                  const centerT = 0.5 * (load.relStart + load.relEnd)
                  const centerX = lerp(seg.x1, seg.x2, centerT)
                  const centerY = lerp(seg.y1, seg.y2, centerT)
                  const momentSymbol = momentSymbolGeometry(centerX, centerY, momentMag, signRef, 8)

                  return (
                    <g key={`dist-${load.id}`}>
                      {arrows.map((item, idx) => (
                        <g key={`dist-${load.id}-${idx}`}>
                          <line x1={item.x} y1={item.y} x2={item.x} y2={item.y2} className="canvas-load dist" />
                          <polygon points={`${item.head.leftX},${item.head.leftY} ${item.head.tipX},${item.head.tipY} ${item.head.rightX},${item.head.rightY}`} className="canvas-load-head dist" />
                        </g>
                      ))}
                      {momentSymbol ? (
                        <g>
                          <circle cx={centerX} cy={centerY} r={momentSymbol.radius} className="canvas-moment-ring dist" />
                          <polygon points={`${momentSymbol.leftX},${momentSymbol.leftY} ${momentSymbol.tipX},${momentSymbol.tipY} ${momentSymbol.rightX},${momentSymbol.rightY}`} className="canvas-moment-head dist" />
                        </g>
                      ) : null}
                    </g>
                  )
                })}

                {lineConcLoads.map((load) => {
                  const seg = builderLineLookup.get(load.lineId)
                  if (!seg) return null
                  const x = lerp(seg.x1, seg.x2, load.rel)
                  const y = lerp(seg.y1, seg.y2, load.rel)
                  const len = 14 + 14 * clamp(Math.abs(load.fy) / 3000, 0, 1)
                  const y2 = y + (load.fy <= 0 ? len : -len)
                  const head = arrowGeometry(x, y, x, y2, 6)
                  const momentMag = vectorMagnitude(load.mx, load.my, load.mz)
                  const signRef = Math.abs(load.mz) > 1e-9 ? load.mz : (Math.abs(load.my) > 1e-9 ? load.my : load.mx)
                  const momentSymbol = momentSymbolGeometry(x, y, momentMag, signRef, 8)
                  return (
                    <g key={`conc-${load.id}`}>
                      <circle cx={x} cy={y} r={4} className="canvas-load-point" />
                      <line x1={x} y1={y} x2={x} y2={y2} className="canvas-load conc" />
                      <polygon points={`${head.leftX},${head.leftY} ${head.tipX},${head.tipY} ${head.rightX},${head.rightY}`} className="canvas-load-head conc" />
                      {momentSymbol ? (
                        <g>
                          <circle cx={x} cy={y} r={momentSymbol.radius} className="canvas-moment-ring conc" />
                          <polygon points={`${momentSymbol.leftX},${momentSymbol.leftY} ${momentSymbol.tipX},${momentSymbol.tipY} ${momentSymbol.rightX},${momentSymbol.rightY}`} className="canvas-moment-head conc" />
                        </g>
                      ) : null}
                    </g>
                  )
                })}

                {nodalLoads.map((load) => {
                  const point = builderLookup.get(load.nodeId)
                  if (!point) return null
                  const vx = load.fx
                  const vy = -(Math.abs(load.fz) > 1e-9 ? load.fz : load.fy)
                  const mag = Math.sqrt(vx * vx + vy * vy) || 1
                  const ux = vx / mag
                  const uy = vy / mag
                  const len = 16 + 16 * clamp(mag / 4000, 0, 1)
                  const x1 = point.cx - ux * len * 0.2
                  const y1 = point.cy - uy * len * 0.2
                  const x2 = point.cx + ux * len
                  const y2 = point.cy + uy * len
                  const head = arrowGeometry(x1, y1, x2, y2, 6)
                  const momentMag = vectorMagnitude(load.mx, load.my, load.mz)
                  const signRef = Math.abs(load.mz) > 1e-9 ? load.mz : (Math.abs(load.my) > 1e-9 ? load.my : load.mx)
                  const momentSymbol = momentSymbolGeometry(point.cx, point.cy, momentMag, signRef, 8)
                  return (
                    <g key={`nload-${load.id}`}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} className="canvas-load nodal" />
                      <polygon points={`${head.leftX},${head.leftY} ${head.tipX},${head.tipY} ${head.rightX},${head.rightY}`} className="canvas-load-head nodal" />
                      {momentSymbol ? (
                        <g>
                          <circle cx={point.cx} cy={point.cy} r={momentSymbol.radius} className="canvas-moment-ring nodal" />
                          <polygon points={`${momentSymbol.leftX},${momentSymbol.leftY} ${momentSymbol.tipX},${momentSymbol.tipY} ${momentSymbol.rightX},${momentSymbol.rightY}`} className="canvas-moment-head nodal" />
                        </g>
                      ) : null}
                    </g>
                  )
                })}

                {builderProjection.points.map((point) => (
                  <g key={`node-${point.id}`} onClick={() => onCanvasNodeClick(point.id)} className="canvas-node-group">
                    <circle
                      cx={point.cx}
                      cy={point.cy}
                      r={selectedNodes.includes(point.id) ? 7 : 6}
                      className={selectedNodes.includes(point.id) ? 'canvas-node selected' : 'canvas-node'}
                    />
                    <text x={point.cx + 9} y={point.cy - 9} className="canvas-text">N{point.id}</text>
                    {nodes.find((node) => node.id === point.id)?.support !== 'FREE' ? (
                      <text x={point.cx + 9} y={point.cy + 12} className="canvas-text muted">{nodes.find((node) => node.id === point.id)?.support}</text>
                    ) : null}
                  </g>
                ))}
              </svg>

              <div className="result-plot-wrap" style={{ marginTop: 12 }}>
                {builder3DVisualization ? (
                  <Plot
                    data={builder3DVisualization.data}
                    layout={builder3DVisualization.layout}
                    style={{ width: '100%', height: '340px' }}
                    config={{ responsive: true, displaylogo: false }}
                    useResizeHandler
                  />
                ) : null}
              </div>

              <div className="builder-list-wrap">
                <div>
                  <h3>Nodes</h3>
                  <ul>
                    {nodes.map((node) => (
                      <li key={`node-row-${node.id}`}>
                        <span>N{node.id} ({node.x}, {node.y}, {node.z}) · {node.support}</span>
                        <div className="row-inline">
                          <select value={node.support} onChange={(event) => setNodeSupportType(node.id, event.target.value as 'FREE' | 'FIXED' | 'PINNED' | 'ROLLER')}>
                            <option value="FREE">FREE</option>
                            <option value="FIXED">FIXED</option>
                            <option value="PINNED">PINNED</option>
                            <option value="ROLLER">ROLLER</option>
                          </select>
                          <button onClick={() => removeNode(node.id)} className="danger">Delete</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Lines</h3>
                  <ul>
                    {lines.map((line) => (
                      <li key={`line-row-${line.id}`}>
                        <span>L{line.id}: N{line.node1} → N{line.node2}</span>
                        <button onClick={() => removeLine(line.id)} className="danger">Delete</button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Nodal Loads (LC1)</h3>
                  <ul>
                    {nodalLoads.map((load) => (
                      <li key={`load-row-${load.id}`}>
                        <span>Node {load.nodeId}: F({load.fx}, {load.fy}, {load.fz})</span>
                        <button onClick={() => removeNodalLoad(load.id)} className="danger">Delete</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="builder-list-wrap builder-list-wrap-2">
                <div>
                  <h3>Line Concentrated Loads (LC1)</h3>
                  <ul>
                    {lineConcLoads.map((load) => (
                      <li key={`conc-load-row-${load.id}`}>
                        <span>L{load.lineId} @ {load.rel}: F({load.fx}, {load.fy}, {load.fz})</span>
                        <button onClick={() => removeConcLoad(load.id)} className="danger">Delete</button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Line Distributed Loads (LC1)</h3>
                  <ul>
                    {lineDistLoads.map((load) => (
                      <li key={`dist-load-row-${load.id}`}>
                        <span>L{load.lineId} [{load.relStart}, {load.relEnd}] Fy({load.fyS} → {load.fyE})</span>
                        <button onClick={() => removeDistLoad(load.id)} className="danger">Delete</button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Materials</h3>
                  <ul>
                    {materials.map((material) => (
                      <li key={`material-row-${material.name}`}>
                        <span>{material.name} (E={material.e}, G={material.g}){material.name === defaultMaterialName ? ' · DEFAULT' : ''}</span>
                        <div className="row-inline">
                          {material.name !== defaultMaterialName ? (
                            <button onClick={() => setDefaultMaterialName(material.name)}>Set Default</button>
                          ) : null}
                          <button onClick={() => removeMaterial(material.name)} className="danger">Delete</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <details open={feapreviewOpen} onToggle={(event) => setFeaPreviewOpen((event.target as HTMLDetailsElement).open)} className="fea-details">
            <summary>Generated .fea Preview</summary>
            <pre><code>{generatedModelText}</code></pre>
          </details>
          </article>

          <article className="card">
          <div className="results-head">
            <h2>Results Viewer</h2>
            <div className="results-actions">
              <label>
                Load case
                <select
                  value={selectedLoadCaseId}
                  onChange={(event) => {
                    const nextId = Number(event.target.value)
                    setSelectedLoadCaseId(nextId)
                    void loadResults(nextId)
                  }}
                  disabled={loadingResults || (results?.loadCases.length ?? 0) === 0}
                >
                  {(results?.loadCases ?? []).map((item) => (
                    <option key={item.id} value={item.id}>{item.id} · {item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Metric
                <select value={resultsMetric} onChange={(event) => setResultsMetric(event.target.value as 'stress' | 'shear' | 'moment')}>
                  <option value="stress">Stress</option>
                  <option value="shear">Shear</option>
                  <option value="moment">Moment</option>
                </select>
              </label>
              <label>
                Deform scale
                <input value={resultsScale} onChange={(event) => setResultsScale(event.target.value)} />
              </label>
              <button onClick={() => void loadResults(selectedLoadCaseId)} disabled={loadingResults}>
                {loadingResults ? 'Refreshing...' : 'Refresh Results'}
              </button>
              <button onClick={() => void exportStructurePng()} disabled={!results || exportingReport}>
                Export Structure PNG
              </button>
              <button onClick={() => void exportGraphPng()} disabled={!results || exportingReport}>
                Export Graph PNG
              </button>
              <button onClick={() => void exportReportPdf()} disabled={!results || exportingReport}>
                {exportingReport ? 'Exporting...' : 'Export PDF Report'}
              </button>
            </div>
          </div>

          {!results ? (
            <p>No results loaded. Run solve first, or click Refresh Results if outputs already exist.</p>
          ) : (
            <>
              <p className="subtitle">Showing LC{results.selectedLoadCaseId}: {results.selectedLoadCaseName}</p>
              <p className="subtitle">Run folder: {activeResultsDir}</p>

              <div className="kpis">
                <div className="kpi">
                  <span className="kpi-label">Max displacement</span>
                  <strong>{results.summary.maxDisp.value.toExponential(3)} m</strong>
                  <small>Node {results.summary.maxDisp.nodeId ?? '-'}</small>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Max axial stress</span>
                  <strong>{results.summary.maxStress.value.toExponential(3)} Pa</strong>
                  <small>Line {results.summary.maxStress.lineId ?? '-'}</small>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Max shear</span>
                  <strong>{results.summary.maxShear.value.toExponential(3)} N</strong>
                  <small>Line {results.summary.maxShear.lineId ?? '-'}</small>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Max bending moment</span>
                  <strong>{results.summary.maxMoment.value.toExponential(3)} N·m</strong>
                  <small>Line {results.summary.maxMoment.lineId ?? '-'}</small>
                </div>
              </div>

              <article className="card structure-card">
                <h2>Structure Visualization</h2>
                {resultsVisualization ? (
                  <div className="result-plot-wrap">
                    <Plot
                      data={resultsVisualization.data as any}
                      layout={resultsVisualization.layout as any}
                      config={{ responsive: true, displaylogo: false, scrollZoom: true }}
                      style={{ width: '100%', height: '430px' }}
                      onInitialized={(_, graphDiv) => setResultsStructurePlotDiv(graphDiv)}
                      onUpdate={(_, graphDiv) => setResultsStructurePlotDiv(graphDiv)}
                      useResizeHandler
                    />
                  </div>
                ) : (
                  <p>No structure geometry available in results.</p>
                )}
                <p className="legend">Gray dashed: undeformed · Colored: deformed (colored by {resultsMetric}) · Full-scene orbit/pan/zoom enabled</p>
                {resultsVisualization ? (
                  <div className="stress-legend-wrap">
                    <span>{resultsMetric.toUpperCase()} contour legend</span>
                    <div className="stress-legend-bar" />
                    <div className="stress-legend-range">
                      <small>{resultsVisualization.metricMin.toExponential(3)}</small>
                      <small>{resultsVisualization.metricMax.toExponential(3)}</small>
                    </div>
                  </div>
                ) : null}
              </article>

              <article className="card structure-card">
                <h2>Result Graph</h2>
                {resultsGraphVisualization ? (
                  <div className="result-plot-wrap">
                    <Plot
                      data={resultsGraphVisualization.data as any}
                      layout={resultsGraphVisualization.layout as any}
                      config={{ responsive: true, displaylogo: false }}
                      style={{ width: '100%', height: '320px' }}
                      onInitialized={(_, graphDiv) => setResultsGraphPlotDiv(graphDiv)}
                      onUpdate={(_, graphDiv) => setResultsGraphPlotDiv(graphDiv)}
                      useResizeHandler
                    />
                  </div>
                ) : (
                  <p>No chart data available.</p>
                )}
                <p className="legend">Legend: cyan = stress · amber = shear · purple = moment</p>
              </article>

              <div className="grid results-grid">
                <ChartBlock title="Stress by line" points={results.charts.stressByLine} unit="Pa" />
                <ChartBlock title="Shear by line" points={results.charts.shearByLine} unit="N" />
                <ChartBlock title="Moment by line" points={results.charts.momentByLine} unit="N·m" />
              </div>
            </>
          )}
          </article>
        </main>
      </section>
    </div>
  )
}

export default App
