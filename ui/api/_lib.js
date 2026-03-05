import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue
    if (fs.existsSync(candidate)) return candidate
  }
  return candidates.find(Boolean) ?? ''
}

function inferRoots() {
  const cwd = process.cwd()
  const uiRoot = firstExistingPath([
    process.env.FEA_UI_ROOT,
    cwd,
    path.resolve(cwd, 'ui'),
  ])

  const repoRoot = firstExistingPath([
    process.env.FEA_REPO_ROOT,
    uiRoot ? path.resolve(uiRoot, '..') : '',
    cwd,
  ])

  return {
    uiRoot,
    repoRoot,
  }
}

const { repoRoot } = inferRoots()
const isVercel = process.env.VERCEL === '1'

const defaultExecutable = firstExistingPath([
  process.env.FEA_EXECUTABLE_PATH,
  path.resolve(repoRoot, 'build-linux', 'MyProject'),
  path.resolve(process.cwd(), 'build-linux', 'MyProject'),
])

const defaultModel = firstExistingPath([
  process.env.FEA_MODEL_PATH,
  path.resolve(repoRoot, 'models', 'sample_frame.fea'),
  path.resolve(process.cwd(), 'models', 'sample_frame.fea'),
])

const defaultOutput = firstExistingPath([
  process.env.FEA_OUTPUT_DIR,
  isVercel ? path.resolve(os.tmpdir(), 'fea-output') : '',
  path.resolve(repoRoot, 'output'),
])

function parseBody(req) {
  if (!req) return {}
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return {}
}

export function allowCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

function safeNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function resolveSafe(inputPath, fallbackPath) {
  const candidate = inputPath && String(inputPath).trim() ? String(inputPath).trim() : fallbackPath
  if (path.isAbsolute(candidate)) return candidate
  return path.resolve(repoRoot, candidate)
}

function getLoadCaseFiles(outputDir) {
  if (!fs.existsSync(outputDir)) return []

  return fs
    .readdirSync(outputDir)
    .map((name) => {
      const match = /^results_lc(\d+)\.json$/i.exec(name)
      if (!match) return null
      return {
        id: Number(match[1]),
        fileName: name,
        filePath: path.join(outputDir, name),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id)
}

function readLoadCaseMeta(filePath, fallbackId) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const id = Number(parsed?.load_case?.id)
    const name = parsed?.load_case?.name
    return {
      id: Number.isFinite(id) ? id : fallbackId,
      name: name ? String(name) : `LC${fallbackId}`,
    }
  } catch {
    return { id: fallbackId, name: `LC${fallbackId}` }
  }
}

function prepareOutputDir(baseOutputDir, isolateRun) {
  if (!isolateRun) {
    fs.mkdirSync(baseOutputDir, { recursive: true })
    return baseOutputDir
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runDir = path.join(baseOutputDir, `run_${timestamp}`)
  fs.mkdirSync(runDir, { recursive: true })
  return runDir
}

function runSolver({ executablePath, modelPath, outputDir }) {
  return new Promise((resolve) => {
    const child = spawn(executablePath, ['--model', modelPath, '--output', outputDir], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      resolve({ code: -1, stdout, stderr: `${stderr}\n${error.message}` })
    })

    child.on('close', (code) => {
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}

function buildResultsPayload(resultsJson) {
  const nodes = Array.isArray(resultsJson?.nodes) ? resultsJson.nodes : []
  const lines = Array.isArray(resultsJson?.lines) ? resultsJson.lines : []

  const vizNodes = nodes.map((node) => {
    const def = Array.isArray(node?.deflection) ? node.deflection : []
    return {
      id: node?.id ?? null,
      x: safeNumber(node?.x),
      y: safeNumber(node?.y),
      z: safeNumber(node?.z),
      ux: safeNumber(def[0]),
      uy: safeNumber(def[1]),
      uz: safeNumber(def[2]),
    }
  })

  let maxDisp = { nodeId: null, value: 0 }
  for (const node of nodes) {
    const def = Array.isArray(node?.deflection) ? node.deflection : []
    const ux = safeNumber(def[0])
    const uy = safeNumber(def[1])
    const uz = safeNumber(def[2])
    const mag = Math.sqrt(ux * ux + uy * uy + uz * uz)
    if (mag > maxDisp.value) maxDisp = { nodeId: node?.id ?? null, value: mag }
  }

  let maxStress = { lineId: null, value: 0 }
  let maxShear = { lineId: null, value: 0 }
  let maxMoment = { lineId: null, value: 0 }
  const stressByLine = []
  const shearByLine = []
  const momentByLine = []

  for (const line of lines) {
    const lineId = line?.id ?? null
    const sigma = Math.abs(safeNumber(line?.sigma_axial))
    const shear = Math.abs(safeNumber(line?.max_abs_shear))
    const moment = Math.abs(safeNumber(line?.max_abs_moment))

    stressByLine.push({ lineId, value: sigma })
    shearByLine.push({ lineId, value: shear })
    momentByLine.push({ lineId, value: moment })

    if (sigma > maxStress.value) maxStress = { lineId, value: sigma }
    if (shear > maxShear.value) maxShear = { lineId, value: shear }
    if (moment > maxMoment.value) maxMoment = { lineId, value: moment }
  }

  const vizLines = lines.map((line) => ({
    id: line?.id ?? null,
    node1: line?.node1 ?? null,
    node2: line?.node2 ?? null,
    stress: Math.abs(safeNumber(line?.sigma_axial)),
    shear: Math.abs(safeNumber(line?.max_abs_shear)),
    moment: Math.abs(safeNumber(line?.max_abs_moment)),
  }))

  return {
    summary: {
      nodeCount: nodes.length,
      lineCount: lines.length,
      maxDisp,
      maxStress,
      maxShear,
      maxMoment,
    },
    charts: {
      stressByLine,
      shearByLine,
      momentByLine,
    },
    visualization: {
      nodes: vizNodes,
      lines: vizLines,
    },
  }
}

export function healthPayload() {
  return {
    ok: true,
    bridge: 'v0.2-serverless',
    isVercel,
    repoRoot,
    defaultExecutable,
    defaultModel,
    defaultOutput,
    executableExists: fs.existsSync(defaultExecutable),
    modelExists: fs.existsSync(defaultModel),
  }
}

export async function solveFromRequest(req) {
  const body = parseBody(req)
  const executablePath = resolveSafe(body?.executablePath, defaultExecutable)
  const modelPath = resolveSafe(body?.modelPath, defaultModel)
  const requestedOutputDir = resolveSafe(body?.outputDir, defaultOutput)
  const isolateRun = body?.isolateRun === true
  const outputDir = prepareOutputDir(requestedOutputDir, isolateRun)

  if (!fs.existsSync(executablePath)) {
    return {
      status: 400,
      body: {
        ok: false,
        error: `Executable not found: ${executablePath}. On Vercel, add a Linux solver binary and set FEA_EXECUTABLE_PATH.`,
      },
    }
  }

  if (!fs.existsSync(modelPath)) {
    return {
      status: 400,
      body: { ok: false, error: `Model not found: ${modelPath}` },
    }
  }

  const result = await runSolver({ executablePath, modelPath, outputDir })
  const outputFiles = fs.existsSync(outputDir) ? fs.readdirSync(outputDir).sort() : []

  return {
    status: 200,
    body: {
      ok: result.code === 0,
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      executablePath,
      modelPath,
      outputDir,
      outputFiles,
    },
  }
}

export async function solveTextFromRequest(req) {
  const body = parseBody(req)
  const executablePath = resolveSafe(body?.executablePath, defaultExecutable)
  const requestedOutputDir = resolveSafe(body?.outputDir, defaultOutput)
  const isolateRun = body?.isolateRun !== false
  const outputDir = prepareOutputDir(requestedOutputDir, isolateRun)
  const modelText = typeof body?.modelText === 'string' ? body.modelText : ''
  const modelFileNameRaw = typeof body?.modelFileName === 'string' ? body.modelFileName : 'ui_model.fea'
  const modelFileName = modelFileNameRaw.endsWith('.fea') ? modelFileNameRaw : `${modelFileNameRaw}.fea`

  if (!modelText.trim()) {
    return { status: 400, body: { ok: false, error: 'modelText is required.' } }
  }

  if (!fs.existsSync(executablePath)) {
    return {
      status: 400,
      body: {
        ok: false,
        error: `Executable not found: ${executablePath}. On Vercel, add a Linux solver binary and set FEA_EXECUTABLE_PATH.`,
      },
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safeName = modelFileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const generatedModelPath = path.join(outputDir, `${timestamp}_${safeName}`)
  fs.writeFileSync(generatedModelPath, modelText, 'utf-8')

  const result = await runSolver({ executablePath, modelPath: generatedModelPath, outputDir })
  const outputFiles = fs.existsSync(outputDir) ? fs.readdirSync(outputDir).sort() : []

  return {
    status: 200,
    body: {
      ok: result.code === 0,
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      executablePath,
      modelPath: generatedModelPath,
      outputDir,
      outputFiles,
    },
  }
}

export function resultsFromRequest(req) {
  const body = parseBody(req)
  const outputDir = resolveSafe(body?.outputDir, defaultOutput)
  const requestedLoadCaseId = Number(body?.loadCaseId)

  if (!fs.existsSync(outputDir)) {
    return { status: 400, body: { ok: false, error: `Output directory not found: ${outputDir}` } }
  }

  const loadCaseFiles = getLoadCaseFiles(outputDir)
  if (loadCaseFiles.length === 0) {
    return { status: 404, body: { ok: false, error: `No results_lc*.json files found in: ${outputDir}` } }
  }

  const selected = Number.isFinite(requestedLoadCaseId)
    ? loadCaseFiles.find((item) => item.id === requestedLoadCaseId) ?? loadCaseFiles[0]
    : loadCaseFiles[0]

  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(selected.filePath, 'utf-8'))
  } catch (error) {
    return { status: 500, body: { ok: false, error: `Failed to parse ${selected.fileName}: ${error.message}` } }
  }

  const payload = buildResultsPayload(parsed)
  const loadCases = loadCaseFiles.map((item) => readLoadCaseMeta(item.filePath, item.id))

  return {
    status: 200,
    body: {
      ok: true,
      outputDir,
      selectedLoadCaseId: selected.id,
      selectedLoadCaseName: parsed?.load_case?.name ?? `LC${selected.id}`,
      loadCases,
      ...payload,
    },
  }
}