import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import Anthropic from '@anthropic-ai/sdk'
import {
  getExerciseById,
  updateExerciseSynthesis,
  type JTBDSynthesis,
} from '@/lib/db/exercises'
import { getEntriesByExercise } from '@/lib/db/entries'
import { getVoteTotalsForExercise } from '@/lib/db/votes'
import { getProblemStatements, getSolutions } from '@/lib/db/brainstorm'
import { z } from 'zod'

export const maxDuration = 300

const client = new Anthropic()

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  const jsonObject = text.match(/\{[\s\S]*\}/)
  if (jsonObject) return jsonObject[0]
  return text.trim()
}

const FinalJTBDJobSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  statement: z.string().min(1),
  jobType: z.enum(['functional', 'emotional', 'social', 'supporting']),
  priorityTier: z.enum(['primary', 'secondary', 'niche']),
  voteCount: z.number(),
  contributorCount: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
  opportunityStatement: z.string(),
  keyTension: z.string().nullable(),
  qualityFlags: z.array(z.string()),
  canonicalEntryId: z.string(),
  ideas: z.array(z.string()),
})

const JTBDSynthesisSchema = z.object({
  executiveSummary: z.string().min(1),
  finalJobs: z.array(FinalJTBDJobSchema).min(1),
  themes: z.array(z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    strength: z.enum(['high', 'medium', 'low']),
    implication: z.string(),
  })),
  tensions: z.array(z.object({
    concept1: z.string().min(1),
    concept2: z.string().min(1),
    implication: z.string().min(1),
  })),
  nextSteps: z.array(z.string().min(1)),
})

function buildSynthesisPrompt(data: {
  mainPrompt: string | null
  jobs: {
    canonicalId: string
    fullSentence: string
    votes: number
    contributors: number
    supporting: string[]
    problemStatement: string | null
    ideas: string[]
  }[]
  discussionCommonalities: string[]
  discussionTensions: { concept1: string; concept2: string; description: string }[]
}): string {
  const context = data.mainPrompt ? `Workshop question: "${data.mainPrompt}"\n\n` : ''

  const jobsText = data.jobs.map((job, i) => {
    const supporting = job.supporting.length > 0
      ? `\n  Supporting statements:\n${job.supporting.slice(0, 3).map(s => `  - "${s}"`).join('\n')}`
      : ''
    const ps = job.problemStatement ? `\n  Problem statement: "${job.problemStatement}"` : ''
    const ideas = job.ideas.length > 0
      ? `\n  Ideas from brainstorm:\n${job.ideas.slice(0, 5).map(idea => `  - "${idea}"`).join('\n')}`
      : ''
    return `JOB ${i + 1} [entry_id: ${job.canonicalId}] [${job.votes} votes, ${job.contributors} contributor${job.contributors !== 1 ? 's' : ''}]:
  "${job.fullSentence}"${supporting}${ps}${ideas}`
  }).join('\n\n')

  const commonalities = data.discussionCommonalities.length > 0
    ? `\nDiscussion commonalities identified:\n${data.discussionCommonalities.map(c => `- ${c}`).join('\n')}\n`
    : ''

  const tensions = data.discussionTensions.length > 0
    ? `\nDiscussion tensions identified:\n${data.discussionTensions.map(t => `- ${t.concept1} vs ${t.concept2}: ${t.description}`).join('\n')}\n`
    : ''

  return `You are a senior product strategist synthesizing a Jobs-to-Be-Done workshop into a polished strategic deliverable.

${context}The workshop produced ${data.jobs.length} canonical jobs after deduplication and voting:

${jobsText}
${commonalities}${tensions}
Your task is to produce a comprehensive synthesis. Instructions:

1. For each job, write a clean 3–6 word TITLE and rewrite the STATEMENT in consistent JTBD language. Remove solution language. If the job is emotional ("feel confident", "peace of mind"), classify it as emotional.

2. JOBTYPE — classify each job:
   - "functional": practical task to accomplish
   - "emotional": feeling, confidence, or peace of mind
   - "social": identity, status, or how others perceive them
   - "supporting": sub-job, constraint, or edge case (low standalone value)

3. PRIORITYTIER — based on vote count, contributor breadth, and signal strength:
   - "primary": top jobs with strong, broad evidence (typically top 40%)
   - "secondary": recurring needs with moderate signal
   - "niche": low votes but distinct signal worth noting

4. CONFIDENCE — "high" (many votes, many contributors, consistent wording), "medium", or "low"

5. OPPORTUNITYSTATEMENT — one sentence: "Make it easier to [X] without [Y friction]"

6. KEYTENSION — if this job creates a tension with another job, name it briefly (e.g. "Speed vs. clarity of rules"). Otherwise null.

7. QUALITYFLAGS — array of any applicable: "solution-language", "too-broad", "emotional-outcome", "constraint-not-job", "low-signal". Empty array if none.

8. THEMES — 3–5 strategic patterns that cut across multiple jobs. Each theme should name what it means, describe it in 1–2 sentences, rate strength ("high"/"medium"/"low"), and state the implication for product/design.

9. TENSIONS — 2–4 competing values from the data, elevated to strategic level. State concept1, concept2, and a 1–2 sentence implication.

10. EXECUTIVESUMMARY — 3–5 sentences summarizing what the group most strongly needs, what tensions exist, and where product/design should focus.

11. NEXTSTEPS — 3–5 concrete recommended actions (research, design exploration, prototyping, roadmap work).

Return ONLY valid JSON. The "id" field for each job should be a short slug based on the title (e.g. "access-workplace-smoothly"). The "canonicalEntryId" must exactly match the entry_id provided in brackets above.

Required JSON structure:
{
  "executiveSummary": "...",
  "finalJobs": [
    {
      "id": "short-slug",
      "title": "Access my workplace smoothly",
      "statement": "When I'm arriving at a location, I want to quickly access the spaces I'm entitled to use, so I can start working without delay.",
      "jobType": "functional",
      "priorityTier": "primary",
      "voteCount": 18,
      "contributorCount": 7,
      "confidence": "high",
      "opportunityStatement": "Make it easier to enter the right workspace immediately without confusion about access or eligibility.",
      "keyTension": "Speed vs. clarity of rules",
      "qualityFlags": [],
      "canonicalEntryId": "the-exact-entry_id-from-above",
      "ideas": ["idea1", "idea2"]
    }
  ],
  "themes": [
    {
      "name": "Friction-free access",
      "description": "The highest-voted jobs cluster around removing steps, uncertainty, and delays from core workflows.",
      "strength": "high",
      "implication": "Reducing friction at key touchpoints should be the primary design focus."
    }
  ],
  "tensions": [
    {
      "concept1": "Speed",
      "concept2": "Clarity",
      "implication": "Members want faster access but also want to understand what they're entitled to — over-simplifying the flow risks leaving eligibility ambiguous."
    }
  ],
  "nextSteps": [
    "Conduct usability testing on the access and check-in flow",
    "Map the full member entitlement journey to identify where confusion occurs"
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
    return NextResponse.json({ synthesis: exercise.jtbdSynthesis ?? null })
  } catch (error) {
    console.error('[synthesize GET]', error)
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
      return NextResponse.json({ error: 'No entries to synthesize' }, { status: 400 })
    }

    const canonicalGroups = exercise.jtbdDeduplication?.groups ?? []
    const entryMap = new Map(allEntries.map((e) => [e.id, e]))

    // Determine which entries to synthesize
    const groups = canonicalGroups.length > 0
      ? canonicalGroups
      : allEntries.map((e) => ({ canonicalId: e.id, supportingIds: [] }))

    const [voteTotals, problemStatements, solutions] = await Promise.all([
      getVoteTotalsForExercise(exerciseId),
      getProblemStatements(exerciseId),
      getSolutions(exerciseId),
    ])

    const voteMap = new Map(voteTotals.map((v) => [v.entryId, v.total]))
    const psMap = new Map(problemStatements.map((p) => [p.entryId, p.problemStatement]))
    const solutionsMap = new Map<string, string[]>()
    for (const s of solutions) {
      if (!solutionsMap.has(s.entryId)) solutionsMap.set(s.entryId, [])
      solutionsMap.get(s.entryId)!.push(s.text)
    }

    // Build job data for prompt, sorted by votes descending, capped at 20
    const jobs = groups
      .map((group) => {
        const canonical = entryMap.get(group.canonicalId)
        if (!canonical) return null
        const supporting = group.supportingIds
          .map((id) => entryMap.get(id)?.fullSentence)
          .filter((s): s is string => !!s)
        // Count unique contributors across canonical + supporting entries
        const contributorIds = new Set<string>()
        contributorIds.add(canonical.userId)
        for (const id of group.supportingIds) {
          const e = entryMap.get(id)
          if (e) contributorIds.add(e.userId)
        }
        return {
          canonicalId: canonical.id,
          fullSentence: canonical.fullSentence,
          votes: voteMap.get(canonical.id) ?? 0,
          contributors: contributorIds.size,
          supporting: supporting.slice(0, 2),
          problemStatement: psMap.get(canonical.id) ?? null,
          ideas: (solutionsMap.get(canonical.id) ?? []).slice(0, 4),
        }
      })
      .filter((j): j is NonNullable<typeof j> => j !== null)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 20)

    console.log(`[synthesize POST] exercise=${exerciseId} jobs=${jobs.length}`)

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: buildSynthesisPrompt({
          mainPrompt: exercise.mainPrompt ?? null,
          jobs,
          discussionCommonalities: exercise.jtbdDiscussionAnalysis?.commonalities ?? [],
          discussionTensions: exercise.jtbdDiscussionAnalysis?.tensions ?? [],
        }),
      }],
    })

    const rawText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    console.log(`[synthesize POST] Claude response length: ${rawText.length} chars`)

    let synthesis: JTBDSynthesis
    try {
      const jsonStr = extractJSON(rawText)
      const parsed = JTBDSynthesisSchema.safeParse(JSON.parse(jsonStr))
      if (!parsed.success) {
        console.error('[synthesize] Schema validation failed:', JSON.stringify(parsed.error.issues))
        return NextResponse.json(
          { error: `Synthesis format error: ${parsed.error.issues[0]?.message ?? 'unknown'}` },
          { status: 502 }
        )
      }
      synthesis = parsed.data
    } catch (parseError) {
      console.error('[synthesize] JSON parse error:', parseError, 'raw (first 500):', rawText.slice(0, 500))
      return NextResponse.json(
        { error: 'Synthesis could not be parsed. Please try again.' },
        { status: 502 }
      )
    }

    await updateExerciseSynthesis(exerciseId, synthesis)
    return NextResponse.json({ synthesis })
  } catch (error) {
    console.error('[synthesize POST]', error)
    return NextResponse.json({ error: 'Synthesis failed. Please try again.' }, { status: 500 })
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
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: exerciseId } = await params

  try {
    const body = await req.json()
    const parsed = JTBDSynthesisSchema.safeParse(body.synthesis)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid synthesis data', details: parsed.error.issues },
        { status: 400 }
      )
    }

    await updateExerciseSynthesis(exerciseId, parsed.data)
    return NextResponse.json({ synthesis: parsed.data })
  } catch (error) {
    console.error('[synthesize PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
