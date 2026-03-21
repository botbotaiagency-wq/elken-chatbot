import crypto from 'crypto'

export function generateApiKey() {
  const raw = `ethan_live_${crypto.randomBytes(12).toString('hex')}`
  const prefix = raw.slice(11, 19) // first 8 chars after "ethan_live_"
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash, prefix }
}
