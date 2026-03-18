import { turso } from './client'
import { runMigrations } from './migrations'

export interface SentimentCluster {
  label: string
  count: number
  terms: string[]
}

export interface SentimentAnalysisResult {
  brandFeelingStatement: string
  brandFeelingExplanation: string
  clusters: SentimentCluster[]
}

export interface JTBDDeduplicationGroup {
  canonicalId: string
  supportingIds: string[]
}

export interface JTBDDeduplicationResult {
  groups: JTBDDeduplicationGroup[]
}

export interface JTBDDiscussionTension {
  concept1: string
  concept2: string
  description: string
}

export interface JTBDDiscussionAnalysis {
  commonalities: string[]
  tensions: JTBDDiscussionTension[]
}

export interface FinalJTBDJob {
  id: string
  title: string
  statement: string
  jobType: 'functional' | 'emotional' | 'social' | 'supporting'
  priorityTier: 'primary' | 'secondary' | 'niche'
  voteCount: number
  contributorCount: number
  confidence: 'high' | 'medium' | 'low'
  opportunityStatement: string
  keyTension: string | null
  qualityFlags: string[]
  canonicalEntryId: string
  ideas: string[]
}

export interface JTBDSynthesisTheme {
  name: string
  description: string
  strength: 'high' | 'medium' | 'low'
  implication: string
}

export interface JTBDSynthesisTension {
  concept1: string
  concept2: string
  implication: string
}

export interface JTBDSynthesis {
  executiveSummary: string
  finalJobs: FinalJTBDJob[]
  themes: JTBDSynthesisTheme[]
  tensions: JTBDSynthesisTension[]
  nextSteps: string[]
}

export interface Exercise {
  id: string
  name: string
  mainPrompt?: string | null
  isActive: boolean
  isArchived: boolean
  currentPhase: 1 | 2 | 3 | 4 | 5
  timerEndsAt?: string | null
  createdAt: string
  type: 'jtbd' | 'sentiment'
  jtbdMode: 'classic' | 'hiring'
  sentimentAnalysis?: SentimentAnalysisResult | null
  jtbdDeduplication?: JTBDDeduplicationResult | null
  jtbdDiscussionAnalysis?: JTBDDiscussionAnalysis | null
  jtbdSynthesis?: JTBDSynthesis | null
}

function rowToExercise(row: Record<string, unknown>): Exercise {
  let sentimentAnalysis: SentimentAnalysisResult | null = null
  if (row.sentimentAnalysis && typeof row.sentimentAnalysis === 'string') {
    try {
      sentimentAnalysis = JSON.parse(row.sentimentAnalysis)
    } catch {
      sentimentAnalysis = null
    }
  }
  let jtbdDeduplication: JTBDDeduplicationResult | null = null
  if (row.jtbdDeduplication && typeof row.jtbdDeduplication === 'string') {
    try {
      jtbdDeduplication = JSON.parse(row.jtbdDeduplication)
    } catch {
      jtbdDeduplication = null
    }
  }
  let jtbdDiscussionAnalysis: JTBDDiscussionAnalysis | null = null
  if (row.jtbdDiscussionAnalysis && typeof row.jtbdDiscussionAnalysis === 'string') {
    try {
      jtbdDiscussionAnalysis = JSON.parse(row.jtbdDiscussionAnalysis)
    } catch {
      jtbdDiscussionAnalysis = null
    }
  }
  let jtbdSynthesis: JTBDSynthesis | null = null
  if (row.jtbdSynthesis && typeof row.jtbdSynthesis === 'string') {
    try {
      jtbdSynthesis = JSON.parse(row.jtbdSynthesis)
    } catch {
      jtbdSynthesis = null
    }
  }
  return {
    id: row.id as string,
    name: row.name as string,
    mainPrompt: row.mainPrompt as string | null,
    isActive: row.isActive === 1 || row.isActive === true,
    isArchived: row.isArchived === 1 || row.isArchived === true,
    currentPhase: (row.currentPhase as 1 | 2 | 3 | 4 | 5) ?? 1,
    timerEndsAt: row.timerEndsAt as string | null,
    createdAt: row.createdAt as string,
    type: ((row.type as string) === 'sentiment' ? 'sentiment' : 'jtbd'),
    jtbdMode: ((row.jtbdMode as string) === 'hiring' ? 'hiring' : 'classic'),
    sentimentAnalysis,
    jtbdDeduplication,
    jtbdDiscussionAnalysis,
    jtbdSynthesis,
  }
}

export async function getActiveExercise(): Promise<Exercise | null> {
  await runMigrations()
  const result = await turso.execute(
    'SELECT * FROM exercises WHERE isActive = 1 LIMIT 1'
  )
  if (result.rows.length === 0) return null
  return rowToExercise(result.rows[0] as Record<string, unknown>)
}

export async function getAllExercises(): Promise<Exercise[]> {
  await runMigrations()
  const result = await turso.execute(
    'SELECT * FROM exercises ORDER BY createdAt DESC'
  )
  return result.rows.map((r) => rowToExercise(r as Record<string, unknown>))
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM exercises WHERE id = ?',
    args: [id],
  })
  if (result.rows.length === 0) return null
  return rowToExercise(result.rows[0] as Record<string, unknown>)
}

export async function createExercise(
  name: string,
  mainPrompt?: string | null,
  type: 'jtbd' | 'sentiment' = 'jtbd',
  jtbdMode: 'classic' | 'hiring' = 'classic'
): Promise<Exercise> {
  await runMigrations()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await turso.execute({
    sql: 'INSERT INTO exercises (id, name, mainPrompt, isActive, currentPhase, type, jtbdMode, createdAt) VALUES (?, ?, ?, 0, 1, ?, ?, ?)',
    args: [id, name, mainPrompt ?? null, type, jtbdMode, createdAt],
  })
  return { id, name, mainPrompt, isActive: false, isArchived: false, currentPhase: 1 as 1 | 2 | 3 | 4, createdAt, type, jtbdMode, sentimentAnalysis: null }
}

export async function updateExercisePrompt(
  id: string,
  mainPrompt: string | null
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET mainPrompt = ? WHERE id = ?',
    args: [mainPrompt, id],
  })
}

export async function setActiveExercise(id: string): Promise<void> {
  await runMigrations()
  await turso.executeMultiple(
    `UPDATE exercises SET isActive = 0;
     UPDATE exercises SET isActive = 1 WHERE id = '${id}';`
  )
}

export async function updateExercisePhase(
  id: string,
  phase: 1 | 2 | 3 | 4 | 5
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET currentPhase = ? WHERE id = ?',
    args: [phase, id],
  })
}

export async function updateExerciseTimer(
  id: string,
  timerEndsAt: string | null
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET timerEndsAt = ? WHERE id = ?',
    args: [timerEndsAt, id],
  })
}

export async function updateExerciseAnalysis(
  id: string,
  analysis: SentimentAnalysisResult
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET sentimentAnalysis = ? WHERE id = ?',
    args: [JSON.stringify(analysis), id],
  })
}

export async function updateExerciseDeduplication(
  id: string,
  deduplication: JTBDDeduplicationResult
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET jtbdDeduplication = ? WHERE id = ?',
    args: [JSON.stringify(deduplication), id],
  })
}

export async function archiveExercise(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET isArchived = 1, isActive = 0 WHERE id = ?',
    args: [id],
  })
}

export async function unarchiveExercise(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET isArchived = 0 WHERE id = ?',
    args: [id],
  })
}

export async function deactivateExercise(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET isActive = 0 WHERE id = ?',
    args: [id],
  })
}

export async function updateDiscussionAnalysis(
  id: string,
  analysis: JTBDDiscussionAnalysis
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET jtbdDiscussionAnalysis = ? WHERE id = ?',
    args: [JSON.stringify(analysis), id],
  })
}

export async function updateExerciseSynthesis(
  id: string,
  synthesis: JTBDSynthesis
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET jtbdSynthesis = ? WHERE id = ?',
    args: [JSON.stringify(synthesis), id],
  })
}
