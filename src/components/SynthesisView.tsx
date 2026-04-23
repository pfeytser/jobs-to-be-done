'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'

interface FinalJTBDJob {
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

interface JTBDSynthesisTheme {
  name: string
  description: string
  strength: 'high' | 'medium' | 'low'
  implication: string
}

interface JTBDSynthesisTension {
  concept1: string
  concept2: string
  implication: string
}

interface JTBDSynthesis {
  executiveSummary: string
  finalJobs: FinalJTBDJob[]
  themes: JTBDSynthesisTheme[]
  tensions: JTBDSynthesisTension[]
  nextSteps: string[]
}

interface Exercise {
  id: string
  name: string
}

interface SynthesisViewProps {
  exercise: Exercise
  isAdmin?: boolean
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

const JOB_TYPE_LABELS: Record<FinalJTBDJob['jobType'], string> = {
  functional: 'Functional',
  emotional: 'Emotional',
  social: 'Social',
  supporting: 'Supporting',
}

const JOB_TYPE_COLORS: Record<FinalJTBDJob['jobType'], string> = {
  functional: 'bg-mist text-ink border-warm-border',
  emotional: 'bg-sand text-ink border-warm-border',
  social: 'bg-canvas text-ink border-warm-border',
  supporting: 'bg-canvas text-ink-3 border-warm-border',
}

const TIER_LABELS: Record<FinalJTBDJob['priorityTier'], string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  niche: 'Niche',
}

const CONFIDENCE_LABELS: Record<FinalJTBDJob['confidence'], string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

const STRENGTH_COLORS: Record<JTBDSynthesisTheme['strength'], string> = {
  high: 'text-ink font-semibold',
  medium: 'text-ink-2 font-medium',
  low: 'text-ink-3 font-medium',
}

function buildMarkdown(exercise: Exercise, synthesis: JTBDSynthesis): string {
  const tiers: FinalJTBDJob['priorityTier'][] = ['primary', 'secondary', 'niche']
  const tierLabels = { primary: 'Primary Jobs', secondary: 'Secondary Jobs', niche: 'Niche / Edge Jobs' }

  const jobsByTier = tiers
    .map((tier) => {
      const jobs = synthesis.finalJobs.filter((j) => j.priorityTier === tier)
      if (jobs.length === 0) return ''
      const jobLines = jobs.map((job, i) => {
        const ideas = job.ideas.length > 0
          ? `\n**Ideas from the session:**\n${job.ideas.map((idea) => `- ${idea}`).join('\n')}`
          : ''
        const flags = job.qualityFlags.length > 0
          ? `\n> Note: ${job.qualityFlags.join(', ')}`
          : ''
        return `### ${i + 1}. ${job.title}
${job.statement}

- **Type:** ${JOB_TYPE_LABELS[job.jobType]}
- **Evidence:** ${job.voteCount} vote${job.voteCount !== 1 ? 's' : ''}, ${job.contributorCount} contributor${job.contributorCount !== 1 ? 's' : ''}
- **Confidence:** ${job.confidence}
- **Opportunity:** ${job.opportunityStatement}${job.keyTension ? `\n- **Key tension:** ${job.keyTension}` : ''}${ideas}${flags}`
      }).join('\n\n')
      return `## ${tierLabels[tier]}\n\n${jobLines}`
    })
    .filter(Boolean)
    .join('\n\n---\n\n')

  const themesSection = synthesis.themes.length > 0
    ? `## Key Themes\n\n${synthesis.themes.map((t) => `**${t.name}** · ${t.strength} signal\n${t.description}\n→ ${t.implication}`).join('\n\n')}`
    : ''

  const tensionsSection = synthesis.tensions.length > 0
    ? `## Strategic Tensions\n\n${synthesis.tensions.map((t) => `**${t.concept1} vs. ${t.concept2}**\n${t.implication}`).join('\n\n')}`
    : ''

  const nextStepsSection = synthesis.nextSteps.length > 0
    ? `## Recommended Next Steps\n\n${synthesis.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : ''

  return [
    `# ${exercise.name} — JTBD Synthesis`,
    `## Executive Summary\n\n${synthesis.executiveSummary}`,
    jobsByTier,
    themesSection,
    tensionsSection,
    nextStepsSection,
  ].filter(Boolean).join('\n\n---\n\n')
}

export function SynthesisView({ exercise, isAdmin = false }: SynthesisViewProps) {
  const { data, error, mutate } = useSWR<{ synthesis: JTBDSynthesis | null }>(
    `/api/exercises/${exercise.id}/synthesize`,
    fetcher,
    { refreshInterval: 8000 }
  )

  const [localSynthesis, setLocalSynthesis] = useState<JTBDSynthesis | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // Sync server data to local state when not dirty
  const synthesis = isDirty ? localSynthesis : (data?.synthesis ?? null)
  const isLoading = !data && !error

  const updateJob = useCallback((jobId: string, updates: Partial<FinalJTBDJob>) => {
    setLocalSynthesis((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        finalJobs: prev.finalJobs.map((j) => j.id === jobId ? { ...j, ...updates } : j),
      }
    })
    setIsDirty(true)
  }, [])

  const moveJob = useCallback((jobId: string, direction: 'up' | 'down') => {
    setLocalSynthesis((prev) => {
      if (!prev) return prev
      const jobs = [...prev.finalJobs]
      const idx = jobs.findIndex((j) => j.id === jobId)
      if (idx < 0) return prev
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= jobs.length) return prev
      ;[jobs[idx], jobs[newIdx]] = [jobs[newIdx], jobs[idx]]
      return { ...prev, finalJobs: jobs }
    })
    setIsDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!localSynthesis) return
    setSaving(true)
    try {
      const res = await fetch(`/api/exercises/${exercise.id}/synthesize`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synthesis: localSynthesis }),
      })
      if (!res.ok) throw new Error('Save failed')
      await mutate()
      setIsDirty(false)
    } catch {
      alert('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [localSynthesis, exercise.id, mutate])

  const handleCopyMarkdown = useCallback(() => {
    if (!synthesis) return
    const md = buildMarkdown(exercise, synthesis)
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [synthesis, exercise])

  if (isLoading) {
    return (
      <div className="text-center py-16 text-ink-3">
        <svg className="w-5 h-5 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm">Loading synthesis…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16 text-ink-3">
        <p className="text-sm">Failed to load synthesis.</p>
        <p className="text-xs mt-1 font-mono text-red-500">{String(error)}</p>
      </div>
    )
  }

  if (!synthesis) {
    return (
      <div className="text-center py-16 text-ink-3">
        <p className="text-sm">Synthesis not yet generated.</p>
        {isAdmin && <p className="text-xs mt-1">Use the admin panel to generate it.</p>}
      </div>
    )
  }

  const primaryJobs = synthesis.finalJobs.filter((j) => j.priorityTier === 'primary')
  const secondaryJobs = synthesis.finalJobs.filter((j) => j.priorityTier === 'secondary')
  const nicheJobs = synthesis.finalJobs.filter((j) => j.priorityTier === 'niche')

  return (
    <div className="space-y-6">
      {/* Admin action bar */}
      {isAdmin && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-ink text-white rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-4 py-2 bg-canvas border border-warm-border text-ink-2 rounded-full text-sm font-medium hover:border-ink hover:text-ink transition-all"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy as Markdown
              </>
            )}
          </button>
        </div>
      )}

      {/* Executive Summary */}
      <div className="bg-sand rounded-[14px] border border-warm-border p-5" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-2">Executive Summary</p>
        <p className="text-sm text-ink leading-relaxed">{synthesis.executiveSummary}</p>
      </div>

      {/* Final Jobs */}
      {primaryJobs.length > 0 && (
        <JobTierSection
          label="Primary Jobs"
          jobs={primaryJobs}
          allJobs={synthesis.finalJobs}
          isAdmin={isAdmin}
          editingJobId={editingJobId}
          onEditStart={setEditingJobId}
          onEditEnd={() => setEditingJobId(null)}
          onUpdateJob={updateJob}
          onMoveJob={moveJob}
        />
      )}

      {secondaryJobs.length > 0 && (
        <JobTierSection
          label="Secondary Jobs"
          jobs={secondaryJobs}
          allJobs={synthesis.finalJobs}
          isAdmin={isAdmin}
          editingJobId={editingJobId}
          onEditStart={setEditingJobId}
          onEditEnd={() => setEditingJobId(null)}
          onUpdateJob={updateJob}
          onMoveJob={moveJob}
        />
      )}

      {nicheJobs.length > 0 && (
        <JobTierSection
          label="Niche / Edge Jobs"
          jobs={nicheJobs}
          allJobs={synthesis.finalJobs}
          isAdmin={isAdmin}
          editingJobId={editingJobId}
          onEditStart={setEditingJobId}
          onEditEnd={() => setEditingJobId(null)}
          onUpdateJob={updateJob}
          onMoveJob={moveJob}
        />
      )}

      {/* Themes */}
      {synthesis.themes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-ink mb-3">Key Themes</h3>
          <div className="space-y-3">
            {synthesis.themes.map((theme, i) => (
              <div key={i} className="bg-surface rounded-[14px] border border-warm-border p-4" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <span className={`text-sm ${STRENGTH_COLORS[theme.strength]}`}>{theme.name}</span>
                  <span className="text-xs text-ink-3 shrink-0">{theme.strength} signal</span>
                </div>
                <p className="text-sm text-ink-2 leading-relaxed mb-1.5">{theme.description}</p>
                {theme.implication && (
                  <p className="text-xs text-ink-3 border-t border-warm-border pt-1.5 mt-1.5">
                    → {theme.implication}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hidden: Strategic Tensions — restore by setting showTensions to true */}
      {(false as boolean) && synthesis.tensions.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-ink mb-3">Strategic Tensions</h3>
          <div className="space-y-3">
            {synthesis.tensions.map((tension, i) => (
              <div key={i} className="bg-surface rounded-[14px] border border-warm-border p-4" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-ink">{tension.concept1}</span>
                  <span className="text-xs text-ink-3">vs.</span>
                  <span className="text-sm font-semibold text-ink">{tension.concept2}</span>
                </div>
                <p className="text-sm text-ink-2 leading-relaxed">{tension.implication}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Next Steps */}
      {synthesis.nextSteps.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-ink mb-3">Recommended Next Steps</h3>
          <div className="bg-surface rounded-[14px] border border-warm-border p-4" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
            <ol className="space-y-2">
              {synthesis.nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-ink-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-sand border border-warm-border text-xs font-semibold text-ink flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </div>
  )
}

function JobTierSection({
  label,
  jobs,
  allJobs,
  isAdmin,
  editingJobId,
  onEditStart,
  onEditEnd,
  onUpdateJob,
  onMoveJob,
}: {
  label: string
  jobs: FinalJTBDJob[]
  allJobs: FinalJTBDJob[]
  isAdmin: boolean
  editingJobId: string | null
  onEditStart: (id: string) => void
  onEditEnd: () => void
  onUpdateJob: (id: string, updates: Partial<FinalJTBDJob>) => void
  onMoveJob: (id: string, direction: 'up' | 'down') => void
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink mb-3">{label}</h3>
      <div className="space-y-3">
        {jobs.map((job) => (
          editingJobId === job.id && isAdmin ? (
            <JobEditCard
              key={job.id}
              job={job}
              allJobs={allJobs}
              onUpdate={onUpdateJob}
              onDone={onEditEnd}
              onMove={onMoveJob}
            />
          ) : (
            <JobCard
              key={job.id}
              job={job}
              allJobs={allJobs}
              isAdmin={isAdmin}
              onEdit={() => onEditStart(job.id)}
              onMove={onMoveJob}
            />
          )
        ))}
      </div>
    </section>
  )
}

function JobCard({
  job,
  allJobs,
  isAdmin,
  onEdit,
  onMove,
}: {
  job: FinalJTBDJob
  allJobs: FinalJTBDJob[]
  isAdmin: boolean
  onEdit: () => void
  onMove: (id: string, direction: 'up' | 'down') => void
}) {
  const [showIdeas, setShowIdeas] = useState(false)
  const idx = allJobs.findIndex((j) => j.id === job.id)

  return (
    <div className="bg-surface rounded-[14px] border border-warm-border p-5" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${JOB_TYPE_COLORS[job.jobType]}`}>
            {JOB_TYPE_LABELS[job.jobType]}
          </span>
          <span className="text-xs text-ink-3">{CONFIDENCE_LABELS[job.confidence]}</span>
          {job.qualityFlags.length > 0 && (
            <span className="text-xs text-amber-600 border border-amber-200 bg-amber-50 px-2 py-0.5 rounded-full">
              {job.qualityFlags[0]}{job.qualityFlags.length > 1 ? ` +${job.qualityFlags.length - 1}` : ''}
            </span>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onMove(job.id, 'up')}
              disabled={idx === 0}
              className="p-1 text-ink-3 hover:text-ink disabled:opacity-20 transition-colors"
              title="Move up"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => onMove(job.id, 'down')}
              disabled={idx === allJobs.length - 1}
              className="p-1 text-ink-3 hover:text-ink disabled:opacity-20 transition-colors"
              title="Move down"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={onEdit}
              className="ml-1 p-1.5 text-ink-3 hover:text-ink transition-colors"
              title="Edit job"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <h4 className="text-base font-semibold text-ink mb-1">{job.title}</h4>
      <p className="text-sm text-ink-2 leading-relaxed mb-3">{job.statement}</p>

      <div className="flex items-center gap-3 text-xs text-ink-3 mb-3">
        <span>{job.voteCount} vote{job.voteCount !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{job.contributorCount} contributor{job.contributorCount !== 1 ? 's' : ''}</span>
        {job.keyTension && (
          <>
            <span>·</span>
            <span className="text-ink-3">⚡ {job.keyTension}</span>
          </>
        )}
      </div>

      {job.opportunityStatement && (
        <div className="bg-canvas rounded-[10px] border border-warm-border px-3 py-2.5 mb-3">
          <p className="text-xs font-medium text-ink-3 mb-0.5">Opportunity</p>
          <p className="text-xs text-ink-2 leading-relaxed">{job.opportunityStatement}</p>
        </div>
      )}

      {job.ideas.length > 0 && (
        <div>
          <button
            onClick={() => setShowIdeas((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showIdeas ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {job.ideas.length} idea{job.ideas.length !== 1 ? 's' : ''} from brainstorm
          </button>
          {showIdeas && (
            <ul className="mt-2 space-y-1">
              {job.ideas.map((idea, i) => (
                <li key={i} className="text-xs text-ink-2 flex items-start gap-2">
                  <span className="text-ink-3 shrink-0 mt-0.5">—</span>
                  {idea}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function JobEditCard({
  job,
  allJobs,
  onUpdate,
  onDone,
  onMove,
}: {
  job: FinalJTBDJob
  allJobs: FinalJTBDJob[]
  onUpdate: (id: string, updates: Partial<FinalJTBDJob>) => void
  onDone: () => void
  onMove: (id: string, direction: 'up' | 'down') => void
}) {
  const [title, setTitle] = useState(job.title)
  const [statement, setStatement] = useState(job.statement)
  const [jobType, setJobType] = useState(job.jobType)
  const [priorityTier, setPriorityTier] = useState(job.priorityTier)
  const [opportunityStatement, setOpportunityStatement] = useState(job.opportunityStatement)
  const [qualityFlags, setQualityFlags] = useState<string[]>(job.qualityFlags)
  const idx = allJobs.findIndex((j) => j.id === job.id)

  const FLAG_OPTIONS = ['solution-language', 'too-broad', 'emotional-outcome', 'constraint-not-job', 'low-signal', 'not-a-jtbd']

  function toggleFlag(flag: string) {
    setQualityFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
    )
  }

  function handleDone() {
    onUpdate(job.id, { title, statement, jobType, priorityTier, opportunityStatement, qualityFlags })
    onDone()
  }

  return (
    <div className="bg-surface rounded-[14px] border-2 border-ink p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-ink">Editing job</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(job.id, 'up')}
            disabled={idx === 0}
            className="p-1 text-ink-3 hover:text-ink disabled:opacity-20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => onMove(job.id, 'down')}
            disabled={idx === allJobs.length - 1}
            className="p-1 text-ink-3 hover:text-ink disabled:opacity-20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-2 mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
          placeholder="Short plain-English title"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-2 mb-1">JTBD Statement</label>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
          placeholder="When..., I want to..., so I can..."
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-ink-2 mb-1">Job type</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value as FinalJTBDJob['jobType'])}
            className="w-full px-3 py-2 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink"
          >
            <option value="functional">Functional</option>
            <option value="emotional">Emotional</option>
            <option value="social">Social</option>
            <option value="supporting">Supporting</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-ink-2 mb-1">Priority tier</label>
          <select
            value={priorityTier}
            onChange={(e) => setPriorityTier(e.target.value as FinalJTBDJob['priorityTier'])}
            className="w-full px-3 py-2 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink"
          >
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="niche">Niche</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-2 mb-1">Opportunity statement</label>
        <textarea
          value={opportunityStatement}
          onChange={(e) => setOpportunityStatement(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
          placeholder="Make it easier to..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-2 mb-2">Quality flags</label>
        <div className="flex flex-wrap gap-2">
          {FLAG_OPTIONS.map((flag) => (
            <button
              key={flag}
              type="button"
              onClick={() => toggleFlag(flag)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                qualityFlags.includes(flag)
                  ? 'bg-ink text-white border-ink'
                  : 'bg-canvas text-ink-2 border-warm-border hover:border-ink'
              }`}
            >
              {flag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={handleDone}
          className="px-4 py-2 bg-ink text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Done
        </button>
      </div>
    </div>
  )
}
