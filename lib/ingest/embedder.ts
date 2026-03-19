import { VoyageAIClient } from 'voyageai'

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! })

export async function embedDocumentChunks(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  // Voyage batch limit is 128 inputs per call — batch if needed
  const allEmbeddings: number[][] = []
  for (let i = 0; i < texts.length; i += 128) {
    const batch = texts.slice(i, i + 128)
    const result = await voyage.embed({
      input: batch,
      model: 'voyage-3-large',
      inputType: 'document',
      outputDimension: 1024,
    })
    allEmbeddings.push(...(result.data?.map(d => d.embedding ?? []) ?? []))
  }

  return allEmbeddings
}

export async function embedQuery(query: string): Promise<number[]> {
  const result = await voyage.embed({
    input: [query],
    model: 'voyage-3-large',
    inputType: 'query',
    outputDimension: 1024,
  })
  return result.data?.[0]?.embedding ?? []
}
