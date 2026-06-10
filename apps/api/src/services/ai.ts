import OpenAI from 'openai'

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

export async function generateTitle(text: string): Promise<string | null> {
  const ai = getClient()
  if (!ai) return null

  try {
    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini',  // Cheaper than Anthropic, great for titles
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Tu es un éditeur. Génère un titre court (max 10 mots) en français pour ce document. Réponds UNIQUEMENT avec le titre, rien d'autre.\n\nExtrait du document:\n${text.slice(0, 2000)}`
      }]
    })
    return response.choices[0]?.message?.content?.trim() || null
  } catch (error) {
    console.error('OpenAI title generation error:', error)
    return null
  }
}

export async function generateSummary(text: string): Promise<string | null> {
  const ai = getClient()
  if (!ai) return null

  try {
    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Tu es un éditeur. Génère un résumé factuel en français, 2-4 phrases maximum, sans invention, pour ce document. Réponds UNIQUEMENT avec le résumé.\n\nDocument:\n${text.slice(0, 3000)}`
      }]
    })
    return response.choices[0]?.message?.content?.trim() || null
  } catch (error) {
    console.error('OpenAI summary generation error:', error)
    return null
  }
}

// detectLanguage stays the same - it doesn't use AI
export async function detectLanguage(text: string): Promise<string> {
  try {
    const { franc } = await import('franc')
    const detected = franc(text.slice(0, 1000), { minLength: 10 })
    if (!detected || detected === 'und') return 'other'
    return detected === 'fra' ? 'fr' : detected
  } catch {
    return 'other'
  }
}