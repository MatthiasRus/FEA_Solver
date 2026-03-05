import { allowCors, healthPayload } from './_lib.js'

export default async function handler(req, res) {
  if (allowCors(req, res)) return
  res.status(200).json(healthPayload())
}