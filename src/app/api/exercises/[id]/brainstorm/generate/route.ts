import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import Anthropic from '@anthropic-ai/sdk'
import { getExerciseById } from '@/lib/db/exercises'
import { getEntriesByExercise } from '@/lib/db/entries'
import { upsertProblemStatement } from '@/lib/db/brainstorm'
import { z } from 'zod'

export const maxDuration = 60

const client = new Anthropic()

const EntrySchema = z.object({
  entryId: z.string(),
  problemStatement: z.string().min(1),
})
const ResponseSchema = z.array(EntrySchema)

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  const arr = text.match(/\[[\s\S]*\]/)
  if (arr) return arr[0]
  return text.trim()
}

// Recover partial results from a truncated JSON array by extracting complete objects
function extractPartialResults(text: string): { entryId: string; problemStatement: string }[] {
  const results: { entryId: string; problemStatement: string }[] = []
  const objectPattern = /\{\s*"entryId"\s*:\s*"([^"]+)"\s*,\s*"problemStatement"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g
  let match
  while ((match = objectPattern.exec(text)) !== null) {
    results.push({ entryId: match[1], problemStatement: match[2].replace(/\\"/g, '"').replace(/\\n/g, ' ') })
  }
  return results
}

function buildPrompt(entries: { id: string; fullSentence: string }[]): string {
  const list = entries.map((e) => `- entryId: "${e.id}" — "${e.fullSentence}"`).join('\n')
  return `You are helping a product team identify underlying problems behind user statements.

For each statement below, write a concise problem statement (1 sentence) that captures the core frustration or unmet need. Be specific and grounded in the statement. Focus on the problem, not the solution.

Return ONLY a valid JSON array — no markdown, no explanation, nothing outside the JSON.

Format:
[
  { "entryId": "...", "problemStatement": "..." }
]

Statements:
${list}`
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
    if (exercise.type !== 'jtbd') {
      return NextResponse.json({ error: 'Brainstorming is only available for JTBD exercises' }, { status: 400 })
    }

    const allEntries = await getEntriesByExercise(exerciseId)
    if (allEntries.length === 0) {
      return NextResponse.json({ error: 'No entries to generate problem statements for' }, { status: 400 })
    }

    // If deduplication exists, only generate problem statements for canonical entries
    const canonicalIds = exercise.jtbdDeduplication
      ? new Set(exercise.jtbdDeduplication.groups.map((g) => g.canonicalId))
      : null
    const entries = canonicalIds
      ? allEntries.filter((e) => canonicalIds.has(e.id))
      : allEntries

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: buildPrompt(entries) }],
    })

    const rawText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    let results: { entryId: string; problemStatement: string }[]
    try {
      const jsonStr = extractJSON(rawText)
      const parsed = ResponseSchema.safeParse(JSON.parse(jsonStr))
      if (!parsed.success) {
        console.error('[brainstorm/generate] Schema error:', parsed.error.issues)
        return NextResponse.json({ error: 'Unexpected response format. Please try again.' }, { status: 502 })
      }
      results = parsed.data
    } catch (parseError) {
      // Response was truncated — recover whatever complete objects we can
      console.warn('[brainstorm/generate] Parse error, attempting partial recovery:', parseError)
      results = extractPartialResults(rawText)
      if (results.length === 0) {
        console.error('[brainstorm/generate] No results recovered from partial response')
        return NextResponse.json({ error: 'Could not parse response. Please try again.' }, { status: 502 })
      }
      console.log(`[brainstorm/generate] Recovered ${results.length} results from partial response`)
    }

    // Store all problem statements
    await Promise.all(
      results.map((r) =>
        upsertProblemStatement({
          exerciseId,
          entryId: r.entryId,
          problemStatement: r.problemStatement,
        })
      )
    )

    return NextResponse.json({ generated: results.length })
  } catch (error) {
    console.error('[brainstorm/generate POST]', error)
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
