import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60
import { getExerciseById, updateExerciseAnalysis, type SentimentAnalysisResult } from '@/lib/db/exercises'
import { getSentimentEntries } from '@/lib/db/sentiment-entries'
import { z } from 'zod'

const client = new Anthropic()

const ClusterSchema = z.object({
  label: z.string().min(1),
  count: z.number().int().positive(),
  terms: z.array(z.string()).min(1),
})

const AnalysisSchema = z.object({
  brandFeelingStatement: z.string().min(1),
  brandFeelingExplanation: z.string().min(1),
  clusters: z.array(ClusterSchema).min(1),
})

function extractJSON(text: string): string {
  // Strip markdown code fences if present
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  // Fall back to finding the outermost JSON object
  const jsonObject = text.match(/\{[\s\S]*\}/)
  if (jsonObject) return jsonObject[0]
  return text.trim()
}

function buildPrompt(prompt: string, terms: string[]): string {
  const termList = terms.map((t, i) => `${i + 1}. ${t}`).join('\n')
  return `You are analyzing workshop responses for a sentiment design exercise.

The facilitator asked participants: "${prompt}"

Participants submitted the following words and phrases:
${termList}

Your task:
1. Group semantically similar responses into 3–6 meaningful theme clusters
2. Assign each cluster a short, evocative label (e.g. "Joy & Delight", "Trust & Safety", "Ease")
3. Place every submitted term into exactly one cluster — use the exact original text in the "terms" array
4. Count how many terms are in each cluster
5. Write a single Brand Feeling Statement (one polished sentence) based on the strongest 2–3 clusters
6. Write a one-sentence explanation of how the statement was derived from the clusters

Rules:
- Every term must appear in exactly one cluster
- Do not invent concepts not present in the responses
- Use the original submitted text in the "terms" array
- Sort clusters by count descending
- Return ONLY valid JSON — no markdown, no explanation, nothing outside the JSON object

Required JSON structure:
{
  "brandFeelingStatement": "Members should feel [feeling], [feeling], and [feeling].",
  "brandFeelingExplanation": "One sentence explaining how this was derived from the clusters.",
  "clusters": [
    {
      "label": "Theme Name",
      "count": 5,
      "terms": ["original word 1", "original phrase 2"]
    }
  ]
}`
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: exerciseId } = await params

  try {
    const exercise = await getExerciseById(exerciseId)
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }
    if (exercise.type !== 'sentiment') {
      return NextResponse.json({ error: 'Not a sentiment exercise' }, { status: 400 })
    }

    const entries = await getSentimentEntries(exerciseId)
    if (entries.length === 0) {
      return NextResponse.json({ error: 'No responses to analyze' }, { status: 400 })
    }

    const terms = entries.map((e) => e.term)
    const prompt = exercise.mainPrompt || 'What feeling do you want to evoke in our members when they are using our app?'

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(prompt, terms) }],
    })

    const rawText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    let analysis: SentimentAnalysisResult
    try {
      const jsonStr = extractJSON(rawText)
      const parsed = AnalysisSchema.safeParse(JSON.parse(jsonStr))
      if (!parsed.success) {
        console.error('[analyze] Schema validation failed:', parsed.error.issues)
        return NextResponse.json(
          { error: 'Analysis returned an unexpected format. Please try again.' },
          { status: 502 }
        )
      }
      analysis = parsed.data
    } catch (parseError) {
      console.error('[analyze] JSON parse error:', parseError, 'raw:', rawText)
      return NextResponse.json(
        { error: 'Analysis could not be parsed. Please try again.' },
        { status: 502 }
      )
    }

    await updateExerciseAnalysis(exerciseId, analysis)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('[analyze POST]', error)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
