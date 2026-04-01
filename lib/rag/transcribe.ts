import OpenAI from 'openai'
import { Readable } from 'stream'

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured — voice transcription is unavailable')
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

function getAudioMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const mimes: Record<string, string> = {
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    webm: 'audio/webm',
    flac: 'audio/flac',
    opus: 'audio/opus',
  }
  return mimes[ext] ?? 'audio/mpeg'
}

/**
 * Transcribes an audio buffer using OpenAI Whisper.
 * @param audioBuffer - Raw audio bytes
 * @param filename    - Original filename (used to infer MIME type)
 * @returns Transcribed text
 */
export async function transcribeVoice(audioBuffer: Buffer, filename: string): Promise<string> {
  const openai = getOpenAI()
  const mimeType = getAudioMimeType(filename)

  // OpenAI SDK accepts a File-like object — use Uint8Array to avoid Buffer type mismatch
  const file = new File([new Uint8Array(audioBuffer)], filename, { type: mimeType })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'text',
  })

  return (transcription as unknown as string).trim()
}

/**
 * Downloads audio from a URL and transcribes it.
 * The URL must be publicly accessible (no auth required).
 */
export async function transcribeFromUrl(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl)
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  // Infer filename from URL for MIME detection
  const urlPath = new URL(audioUrl).pathname
  const filename = urlPath.split('/').pop() ?? 'voice.ogg'

  return transcribeVoice(buffer, filename)
}
