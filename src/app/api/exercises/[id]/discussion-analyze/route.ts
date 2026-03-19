import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import Anthropic from '@anthropic-ai/sdk'
import {
  getExerciseById,
  updateDiscussionAnalysis,
  type JTBDDiscussionAnalysis,
} from '@/lib/db/exercises'
import { getEntriesByExercise } from '@/lib/db/entries'
import { getVoteTotalsForExercise } from '@/lib/db/votes'
import { z } from 'zod'

export const maxDuration = 60

const client = new Anthropic()

const TensionSchema = z.object({
  concept1: z.string().min(1),
  concept2: z.string().min(1),
  description: z.string().min(1),
})

const DiscussionAnalysisSchema = z.object({
  commonalities: z.array(z.string().min(1)).min(1).max(3),
  tensions: z.array(TensionSchema),
})

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  const jsonObject = text.match(/\{[\s\S]*\}/)
  if (jsonObject) return jsonObject[0]
  return text.trim()
}

function buildPrompt(
  entries: { sentence: string; votes: number }[],
  mainPrompt: string | null
): string {
  const list = entries
    .map((e, i) => `${i + 1}. [${e.votes} vote${e.votes !== 1 ? 's' : ''}] "${e.sentence}"`)
    .join('\n')
  const context = mainPrompt ? `The workshop question was: "${mainPrompt}"\n\n` : ''
  return `You are analyzing Jobs-to-be-Done statements collected during a product strategy workshop.

${context}Participants submitted the following statements. Each statement is preceded by the number of votes it received — votes represent the group's collective judgment of what matters most.

${list}

Your task is to produce two things, weighted by votes:

1. COMMONALITIES — Identify the 2–3 most important shared themes. Heavily-voted statements should drive this analysis; low or zero-voted statements are minor signals only. Each bullet must be a single concise sentence grounded in the actual language of the high-voted statements. Surface what the group most strongly agrees on — not every theme, just the most important ones.

2. TENSIONS — Identify places where the group's needs pull in opposite directions, prioritizing tensions that show up in heavily-voted statements. Name the two competing concepts and write one sentence explaining the tradeoff using language from the actual statements. Only include genuine tensions you can point to — if there are none, return an empty array.

Rules:
- Vote count is the primary signal — weight your analysis accordingly
- Return exactly 2–3 commonalities, no more
- Be specific and grounded in the statements, not generic
- Tensions must name concrete competing values, not vague opposites
- Return ONLY valid JSON — no markdown, no explanation, nothing outside the JSON object

Required JSON structure:
{
  "commonalities": [
    "The highest-voted statements consistently show X...",
    "Participants who prioritized Y want Z..."
  ],
  "tensions": [
    {
      "concept1": "Speed",
      "concept2": "Safety",
      "description": "The top-voted statements split between wanting fast booking and wanting thorough vetting — the two goals directly compete."
    }
  ]
}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: exerciseId } = await params

  try {
    const exercise = await getExerciseById(exerciseId)
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    return NextResponse.json({ analysis: exercise.jtbdDiscussionAnalysis ?? null })
  } catch (error) {
    console.error('[discussion-analyze GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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
      return NextResponse.json({ error: 'Not a JTBD exercise' }, { status: 400 })
    }

    const allEntries = await getEntriesByExercise(exerciseId)
    if (allEntries.length === 0) {
      return NextResponse.json({ error: 'No entries to analyze' }, { status: 400 })
    }

    // Use only canonical entries if deduplication has run
    const canonicalIds = exercise.jtbdDeduplication
      ? new Set(exercise.jtbdDeduplication.groups.map((g) => g.canonicalId))
      : null
    const entries = canonicalIds
      ? allEntries.filter((e) => canonicalIds.has(e.id))
      : allEntries

    // Fetch vote totals and pair with entries, sorted by votes descending
    const voteTotals = await getVoteTotalsForExercise(exerciseId)
    const voteMap = new Map(voteTotals.map((v) => [v.entryId, v.total]))
    const weightedEntries = entries
      .map((e) => ({ sentence: e.fullSentence, votes: voteMap.get(e.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(weightedEntries, exercise.mainPrompt ?? null) }],
    })

    const rawText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    let analysis: JTBDDiscussionAnalysis
    try {
      const jsonStr = extractJSON(rawText)
      const parsed = DiscussionAnalysisSchema.safeParse(JSON.parse(jsonStr))
      if (!parsed.success) {
        console.error('[discussion-analyze] Schema validation failed:', parsed.error.issues)
        return NextResponse.json(
          { error: 'Analysis returned an unexpected format. Please try again.' },
          { status: 502 }
        )
      }
      analysis = parsed.data
    } catch (parseError) {
      console.error('[discussion-analyze] JSON parse error:', parseError, 'raw:', rawText)
      return NextResponse.json(
        { error: 'Analysis could not be parsed. Please try again.' },
        { status: 502 }
      )
    }

    await updateDiscussionAnalysis(exerciseId, analysis)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('[discussion-analyze POST]', error)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
