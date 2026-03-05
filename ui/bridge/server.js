import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const app = express()
app.use(cors())
app.use(express.json())

const UI_ROOT = path.resolve(process.cwd())
const REPO_ROOT = path.resolve(UI_ROOT, '..')

function resolveEnvPath(envValue, fallbackPath) {
  if (!envValue || !envValue.trim()) return fallbackPath
  return path.isAbsolute(envValue) ? envValue : path.resolve(REPO_ROOT, envValue)
}


const DEFAULT_EXECUTABLE = resolveEnvPath(process.env.FEA_EXECUTABLE_PATH, path.resolve(REPO_ROOT, 'build-linux', 'MyProject'))
const DEFAULT_MODEL = resolveEnvPath(process.env.FEA_MODEL_PATH, path.resolve(REPO_ROOT, 'models', 'sample_frame.fea'))
const DEFAULT_OUTPUT = resolveEnvPath(process.env.FEA_OUTPUT_DIR, path.resolve(REPO_ROOT, 'output'))
const PORT = Number(process.env.PORT || process.env.FEA_BRIDGE_PORT || 8787)

function getLoadCaseFiles(outputDir) {
  if (!fs.existsSync(outputDir)) {
    return []
  }

  return fs
    .readdirSync(outputDir)
    .map((name) => {
      const match = /^results_lc(\d+)\.json$/i.exec(name)
      if (!match) {
        return null
      }
      return {
        id: Number(match[1]),
        fileName: name,
        filePath: path.join(outputDir, name),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id)
}

function safeNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
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
    if (mag > maxDisp.value) {
      maxDisp = { nodeId: node?.id ?? null, value: mag }
    }
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

    if (sigma > maxStress.value) {
      maxStress = { lineId, value: sigma }
    }
    if (shear > maxShear.value) {
      maxShear = { lineId, value: shear }
    }
    if (moment > maxMoment.value) {
      maxMoment = { lineId, value: moment }
    }
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

function resolveSafe(inputPath, fallbackPath) {
  const candidate = inputPath && inputPath.trim() ? inputPath.trim() : fallbackPath
  if (path.isAbsolute(candidate)) {
    return candidate
  }
  return path.resolve(REPO_ROOT, candidate)
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
      cwd: REPO_ROOT,
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

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    bridge: 'v0.1',
    repoRoot: REPO_ROOT,
    defaultExecutable: DEFAULT_EXECUTABLE,
    defaultModel: DEFAULT_MODEL,
    defaultOutput: DEFAULT_OUTPUT,
  })
})

app.post('/api/solve', async (req, res) => {
  const executablePath = resolveSafe(req.body?.executablePath, DEFAULT_EXECUTABLE)
  const modelPath = resolveSafe(req.body?.modelPath, DEFAULT_MODEL)
  const requestedOutputDir = resolveSafe(req.body?.outputDir, DEFAULT_OUTPUT)
  const isolateRun = req.body?.isolateRun === true
  const outputDir = prepareOutputDir(requestedOutputDir, isolateRun)

  if (!fs.existsSync(executablePath)) {
    return res.status(400).json({ ok: false, error: `Executable not found: ${executablePath}` })
  }

  if (!fs.existsSync(modelPath)) {
    return res.status(400).json({ ok: false, error: `Model not found: ${modelPath}` })
  }

  const result = await runSolver({ executablePath, modelPath, outputDir })

  const outputFiles = fs.existsSync(outputDir)
    ? fs.readdirSync(outputDir).sort()
    : []

  return res.json({
    ok: result.code === 0,
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    executablePath,
    modelPath,
    outputDir,
    outputFiles,
  })
})

app.post('/api/solve-text', async (req, res) => {
  const executablePath = resolveSafe(req.body?.executablePath, DEFAULT_EXECUTABLE)
  const requestedOutputDir = resolveSafe(req.body?.outputDir, DEFAULT_OUTPUT)
  const isolateRun = req.body?.isolateRun !== false
  const outputDir = prepareOutputDir(requestedOutputDir, isolateRun)
  const modelText = typeof req.body?.modelText === 'string' ? req.body.modelText : ''
  const modelFileNameRaw = typeof req.body?.modelFileName === 'string' ? req.body.modelFileName : 'ui_model.fea'
  const modelFileName = modelFileNameRaw.endsWith('.fea') ? modelFileNameRaw : `${modelFileNameRaw}.fea`

  if (!modelText.trim()) {
    return res.status(400).json({ ok: false, error: 'modelText is required.' })
  }

  if (!fs.existsSync(executablePath)) {
    return res.status(400).json({ ok: false, error: `Executable not found: ${executablePath}` })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safeName = modelFileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const generatedModelPath = path.join(outputDir, `${timestamp}_${safeName}`)
  fs.writeFileSync(generatedModelPath, modelText, 'utf-8')

  const result = await runSolver({
    executablePath,
    modelPath: generatedModelPath,
    outputDir,
  })

  const outputFiles = fs.existsSync(outputDir)
    ? fs.readdirSync(outputDir).sort()
    : []

  return res.json({
    ok: result.code === 0,
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    executablePath,
    modelPath: generatedModelPath,
    outputDir,
    outputFiles,
  })
})

app.post('/api/results', (req, res) => {
  const outputDir = resolveSafe(req.body?.outputDir, DEFAULT_OUTPUT)
  const requestedLoadCaseId = Number(req.body?.loadCaseId)

  if (!fs.existsSync(outputDir)) {
    return res.status(400).json({ ok: false, error: `Output directory not found: ${outputDir}` })
  }

  const loadCaseFiles = getLoadCaseFiles(outputDir)
  if (loadCaseFiles.length === 0) {
    return res.status(404).json({ ok: false, error: `No results_lc*.json files found in: ${outputDir}` })
  }

  const selected = Number.isFinite(requestedLoadCaseId)
    ? loadCaseFiles.find((item) => item.id === requestedLoadCaseId) ?? loadCaseFiles[0]
    : loadCaseFiles[0]

  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(selected.filePath, 'utf-8'))
  } catch (error) {
    return res.status(500).json({ ok: false, error: `Failed to parse ${selected.fileName}: ${error.message}` })
  }

  const payload = buildResultsPayload(parsed)

  const loadCases = loadCaseFiles.map((item) => readLoadCaseMeta(item.filePath, item.id))

  return res.json({
    ok: true,
    outputDir,
    selectedLoadCaseId: selected.id,
    selectedLoadCaseName: parsed?.load_case?.name ?? `LC${selected.id}`,
    loadCases,
    ...payload,
  })
})

app.listen(PORT, () => {
  console.log(`FEA bridge v0.1 listening on http://127.0.0.1:${PORT}`)
})
