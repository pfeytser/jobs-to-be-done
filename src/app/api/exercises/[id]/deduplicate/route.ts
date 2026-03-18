import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import {
  getExerciseById,
  updateExerciseDeduplication,
  type JTBDDeduplicationResult,
} from '@/lib/db/exercises'
import { getEntriesByExercise } from '@/lib/db/entries'

export const maxDuration = 60

const client = new Anthropic()

const DedupeGroupSchema = z.object({
  canonicalId: z.string().min(1),
  supportingIds: z.array(z.string()),
})

const DedupeSchema = z.object({
  groups: z.array(DedupeGroupSchema).min(1),
})

const PatchDedupeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('break-out'), entryId: z.string().min(1) }),
  z.object({
    action: z.literal('move'),
    entryId: z.string().min(1),
    targetCanonicalId: z.string().min(1),
  }),
])

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  const jsonObject = text.match(/\{[\s\S]*\}/)
  if (jsonObject) return jsonObject[0]
  return text.trim()
}

function buildPrompt(
  entries: { id: string; fullSentence: string }[],
  mode: 'classic' | 'hiring'
): string {
  const modeLabel =
    mode === 'hiring' ? 'hiring job stories' : 'classic job stories'
  const entryList = entries
    .map((e, i) => `${i + 1}. [ID: ${e.id}]\n   ${e.fullSentence}`)
    .join('\n\n')

  return `You are helping facilitate a Jobs to Be Done workshop. Participants have submitted ${modeLabel}.

Your task is to identify entries that express the same underlying job or need — even if worded differently — and consolidate them into groups.

Entries:
${entryList}

Rules:
- Group entries only when they express meaningfully the same core job, not just superficially similar wording
- Each group must have exactly one canonical entry: the one that is clearest, most specific, and best articulated
- All remaining entries in a group become "supporting" entries
- Entries that are unique and do not meaningfully overlap with any other entry form a group of one (supportingIds is empty)
- Every entry ID must appear exactly once across all groups — either as a canonicalId or in supportingIds
- Do not rewrite or alter any entry text — use IDs only
- Return ONLY valid JSON — no markdown, no explanation, nothing outside the JSON object

Required JSON structure:
{
  "groups": [
    {
      "canonicalId": "the-best-entry-id",
      "supportingIds": ["similar-entry-id-1", "similar-entry-id-2"]
    },
    {
      "canonicalId": "unique-entry-id",
      "supportingIds": []
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
    if (exercise.type !== 'jtbd') {
      return NextResponse.json({ error: 'Not a JTBD exercise' }, { status: 400 })
    }

    const entries = await getEntriesByExercise(exerciseId)
    if (entries.length === 0) {
      return NextResponse.json({ error: 'No entries to deduplicate' }, { status: 400 })
    }

    // Single entry — trivially no duplicates
    if (entries.length === 1) {
      const deduplication: JTBDDeduplicationResult = {
        groups: [{ canonicalId: entries[0].id, supportingIds: [] }],
      }
      await updateExerciseDeduplication(exerciseId, deduplication)
      return NextResponse.json({ deduplication })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: buildPrompt(
            entries.map((e) => ({ id: e.id, fullSentence: e.fullSentence })),
            exercise.jtbdMode
          ),
        },
      ],
    })

    const rawText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    let deduplication: JTBDDeduplicationResult
    try {
      const jsonStr = extractJSON(rawText)
      const parsed = DedupeSchema.safeParse(JSON.parse(jsonStr))
      if (!parsed.success) {
        console.error('[deduplicate] Schema validation failed:', parsed.error.issues)
        return NextResponse.json(
          { error: 'Deduplication returned an unexpected format. Please try again.' },
          { status: 502 }
        )
      }

      // Ensure every entry ID is accounted for — add any missing as solo groups
      const allIds = new Set(entries.map((e) => e.id))
      const seenIds = new Set<string>()
      for (const group of parsed.data.groups) {
        seenIds.add(group.canonicalId)
        for (const id of group.supportingIds) seenIds.add(id)
      }
      const groups = [...parsed.data.groups]
      for (const id of allIds) {
        if (!seenIds.has(id)) groups.push({ canonicalId: id, supportingIds: [] })
      }
      deduplication = { groups }
    } catch (parseError) {
      console.error('[deduplicate] JSON parse error:', parseError, 'raw:', rawText)
      return NextResponse.json(
        { error: 'Deduplication could not be parsed. Please try again.' },
        { status: 502 }
      )
    }

    await updateExerciseDeduplication(exerciseId, deduplication)
    return NextResponse.json({ deduplication })
  } catch (error) {
    console.error('[deduplicate POST]', error)
    return NextResponse.json({ error: 'Deduplication failed. Please try again.' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: exerciseId } = await params

  try {
    const body = await req.json()
    const parsed = PatchDedupeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const exercise = await getExerciseById(exerciseId)
    if (!exercise || !exercise.jtbdDeduplication) {
      return NextResponse.json({ error: 'No deduplication data found' }, { status: 400 })
    }

    // Deep-copy groups so we can mutate safely
    const groups = exercise.jtbdDeduplication.groups.map((g) => ({
      canonicalId: g.canonicalId,
      supportingIds: [...g.supportingIds],
    }))

    if (parsed.data.action === 'break-out') {
      const { entryId } = parsed.data
      let found = false
      for (const group of groups) {
        const idx = group.supportingIds.indexOf(entryId)
        if (idx !== -1) {
          group.supportingIds.splice(idx, 1)
          found = true
          break
        }
      }
      if (!found) {
        return NextResponse.json({ error: 'Entry is not a supporting entry' }, { status: 400 })
      }
      groups.push({ canonicalId: entryId, supportingIds: [] })
    } else {
      const { entryId, targetCanonicalId } = parsed.data
      const targetGroup = groups.find((g) => g.canonicalId === targetCanonicalId)
      if (!targetGroup) {
        return NextResponse.json({ error: 'Target group not found' }, { status: 400 })
      }
      let found = false
      for (const group of groups) {
        const idx = group.supportingIds.indexOf(entryId)
        if (idx !== -1) {
          group.supportingIds.splice(idx, 1)
          found = true
          break
        }
      }
      if (!found) {
        return NextResponse.json({ error: 'Entry is not a supporting entry' }, { status: 400 })
      }
      targetGroup.supportingIds.push(entryId)
    }

    const deduplication: JTBDDeduplicationResult = { groups }
    await updateExerciseDeduplication(exerciseId, deduplication)
    return NextResponse.json({ deduplication })
  } catch (error) {
    console.error('[deduplicate PATCH]', error)
    return NextResponse.json({ error: 'Update failed. Please try again.' }, { status: 500 })
  }
}
