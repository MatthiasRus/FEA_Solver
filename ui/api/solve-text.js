import { allowCors, solveTextFromRequest } from './_lib.js'

export default async function handler(req, res) {
  if (allowCors(req, res)) return
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const { status, body } = await solveTextFromRequest(req)
  res.status(status).json(body)
}