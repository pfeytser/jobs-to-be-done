'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { CompanyOffDay, Engineer, Initiative, PtoEntry, QuarterSetting } from '@/lib/roadmap/types'
import { QUARTERS } from '@/lib/roadmap/types'
import { computeCapacity, roundWeeks } from '@/lib/roadmap/capacity'
import type { RoadmapData } from '@/lib/db/roadmap'
import { CapacityRibbon } from './CapacityRibbon'
import { RoadmapGrid } from './RoadmapGrid'
import { TeamPanel } from './TeamPanel'
import { CalendarsPanel } from './CalendarsPanel'
import { InitiativeEditor, type InitiativeDraft } from './InitiativeEditor'

// Current quarter (for the "Now" marker). Client-side Date is fine here.
function currentQuarterKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
}

function tempId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function RoadmapClient({ initial }: { initial: RoadmapData }) {
  const [engineers, setEngineers] = useState<Engineer[]>(initial.engineers)
  const [pto, setPto] = useState<PtoEntry[]>(initial.pto)
  const [settings, setSettings] = useState<QuarterSetting[]>(initial.settings)
  const [initiatives, setInitiatives] = useState<Initiative[]>(initial.initiatives)
  const [companyOffDays, setCompanyOffDays] = useState<CompanyOffDay[]>(initial.companyOffDays)

  const [scenario, setScenario] = useState(false)
  const [tab, setTab] = useState<'roadmap' | 'team' | 'calendars'>('roadmap')
  const [groupBy, setGroupBy] = useState<'theme' | 'objective' | 'none'>('theme')
  const [editing, setEditing] = useState<{ draft: InitiativeDraft; isNew: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  const capacity = useMemo(
    () => computeCapacity({ engineers, pto, settings, initiatives, quarters: QUARTERS, companyOffDays }),
    [engineers, pto, settings, initiatives, companyOffDays]
  )

  const totals = useMemo(() => {
    const feature = capacity.reduce((a, c) => a + c.featureWeeks, 0)
    const committed = capacity.reduce((a, c) => a + c.committedWeeks, 0)
    const proposed = initiatives
      .filter((i) => i.committed === 0)
      .reduce((a, i) => a + (i.effort_weeks ?? 0), 0)
    return { feature, committed, proposed, headroom: feature - committed }
  }, [capacity, initiatives])

  // ── Persistence (debounced, skipped in scenario mode) ──────────────────────
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const persist = useCallback(
    (key: string, fn: () => Promise<Response>, immediate = false) => {
      if (scenario) return
      const run = async () => {
        try {
          const res = await fn()
          if (!res.ok) console.error('[roadmap] persist failed', key, res.status)
        } catch (err) {
          console.error('[roadmap] persist error', key, err)
        }
      }
      if (immediate) {
        void run()
        return
      }
      clearTimeout(timers.current[key])
      timers.current[key] = setTimeout(run, 400)
    },
    [scenario]
  )

  const reload = useCallback(async () => {
    const res = await fetch('/api/roadmap/data')
    if (!res.ok) return
    const data: RoadmapData = await res.json()
    setEngineers(data.engineers)
    setPto(data.pto)
    setSettings(data.settings)
    setInitiatives(data.initiatives)
    setCompanyOffDays(data.companyOffDays)
  }, [])

  const toggleScenario = useCallback(async () => {
    if (scenario) {
      // Leaving scenario: discard experiments, reload the saved truth.
      setScenario(false)
      await reload()
    } else {
      setScenario(true)
    }
  }, [scenario, reload])

  // ── Engineer handlers ───────────────────────────────────────────────────────
  const onEngineerChange = (id: string, patch: Partial<Engineer>) => {
    setEngineers((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    persist(`eng:${id}`, () =>
      fetch(`/api/roadmap/engineers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    )
  }

  const onEngineerAdd = async () => {
    const draft = {
      name: 'New engineer',
      country: 'US',
      capacity_fraction: 1,
      start_date: null,
      end_date: null,
      active: 1 as const,
    }
    if (scenario) {
      setEngineers((prev) => [
        ...prev,
        { id: tempId('eng'), sort_order: prev.length, ...draft },
      ])
      return
    }
    const res = await fetch('/api/roadmap/engineers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    if (res.ok) {
      const { engineer } = await res.json()
      setEngineers((prev) => [...prev, engineer])
    }
  }

  const onEngineerDelete = (id: string) => {
    setEngineers((prev) => prev.filter((e) => e.id !== id))
    setPto((prev) => prev.filter((p) => p.engineer_id !== id))
    persist(`eng-del:${id}`, () => fetch(`/api/roadmap/engineers/${id}`, { method: 'DELETE' }), true)
  }

  const onPtoChange = (engineerId: string, year: number, quarter: number, days: number) => {
    setPto((prev) => {
      const rest = prev.filter((p) => !(p.engineer_id === engineerId && p.year === year && p.quarter === quarter))
      return days > 0 ? [...rest, { engineer_id: engineerId, year, quarter, days }] : rest
    })
    persist(`pto:${engineerId}:${year}-${quarter}`, () =>
      fetch('/api/roadmap/pto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineer_id: engineerId, year, quarter, days }),
      })
    )
  }

  const onBauChange = (year: number, quarter: number, pct: number) => {
    setSettings((prev) => {
      const rest = prev.filter((s) => !(s.year === year && s.quarter === quarter))
      return [...rest, { year, quarter, bau_pct: pct }]
    })
    persist(`bau:${year}-${quarter}`, () =>
      fetch('/api/roadmap/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, quarter, bau_pct: pct }),
      })
    )
  }

  // ── Company off-day handlers ────────────────────────────────────────────────
  const onAddOffDay = async (date: string, label: string) => {
    // Replace any existing entry for the same date (the date column is unique).
    setCompanyOffDays((prev) => [...prev.filter((o) => o.date !== date), { id: tempId('off'), date, label }])
    if (scenario) return
    const res = await fetch('/api/roadmap/offdays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, label }),
    })
    if (res.ok) {
      const { offDay } = await res.json()
      setCompanyOffDays((prev) => [...prev.filter((o) => o.date !== date), offDay])
    }
  }

  const onDeleteOffDay = (id: string) => {
    setCompanyOffDays((prev) => prev.filter((o) => o.id !== id))
    if (!scenario && !id.startsWith('off-')) {
      void fetch(`/api/roadmap/offdays/${id}`, { method: 'DELETE' })
    }
  }

  // ── Initiative handlers ─────────────────────────────────────────────────────
  const openNew = (year: number, quarter: number) => {
    setEditing({
      isNew: true,
      draft: {
        title: '',
        summary: '',
        status: 'proposed',
        priority: 'medium',
        theme: 'revenue',
        year,
        quarter,
        effort_weeks: null,
        impact_value: null,
        impact_unit: null,
        impact_kind: 'increase',
        owner_name: null,
        objective: null,
        is_bau: 0,
        is_required: 0,
        committed: 0,
      },
    })
  }

  const saveInitiative = async (d: InitiativeDraft) => {
    setSaving(true)
    const { id, ...body } = d
    if (!id) {
      // create
      if (scenario) {
        setInitiatives((prev) => [...prev, { id: tempId('init'), sort_order: prev.length, ...(body as Omit<Initiative, 'id' | 'sort_order'>) }])
      } else {
        const res = await fetch('/api/roadmap/initiatives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          const { initiative } = await res.json()
          setInitiatives((prev) => [...prev, initiative])
        }
      }
    } else {
      setInitiatives((prev) => prev.map((i) => (i.id === id ? { ...i, ...(body as object) } as Initiative : i)))
      if (!scenario) {
        await fetch(`/api/roadmap/initiatives/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
    }
    setSaving(false)
    setEditing(null)
  }

  const deleteInitiative = () => {
    const id = editing?.draft.id
    if (!id) return
    setInitiatives((prev) => prev.filter((i) => i.id !== id))
    if (!scenario) void fetch(`/api/roadmap/initiatives/${id}`, { method: 'DELETE' })
    setEditing(null)
  }

  const nowKey = currentQuarterKey()

  return (
    <main className="min-h-screen bg-canvas">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-6 py-3">
          <Link href="/" className="text-ink-muted hover:text-ink" title="Home">
            ←
          </Link>
          <div>
            <h1 className="font-display text-lg font-semibold leading-none text-ink">Roadmap &amp; Capacity</h1>
            <p className="text-[11px] text-ink-muted">Growth · Q3 2026 → Q2 2027</p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs sm:flex">
              <span className="tabular-nums text-ink">
                <strong>{roundWeeks(totals.committed)}</strong>
                <span className="text-ink-muted"> / {roundWeeks(totals.feature)}w committed</span>
              </span>
              <span className={`tabular-nums font-semibold ${totals.headroom < 0 ? 'text-fail' : 'text-pass'}`}>
                {totals.headroom >= 0 ? `${roundWeeks(totals.headroom)}w free` : `${roundWeeks(-totals.headroom)}w over`}
              </span>
              <span className="tabular-nums text-ink-muted">{roundWeeks(totals.proposed)}w proposed</span>
            </div>

            <button
              onClick={toggleScenario}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                scenario ? 'border-accent bg-accent text-ink' : 'border-line bg-surface text-ink-soft hover:border-ink'
              }`}
              title="In scenario mode, edits are not saved — experiment freely, then exit to discard."
            >
              {scenario ? '● Scenario (unsaved)' : 'Scenario mode'}
            </button>
          </div>
        </div>

        {scenario && (
          <div className="border-t border-accent bg-accent-wash px-6 py-1.5 text-center text-xs font-semibold text-ink">
            Scenario mode — changes are not saved. Exit scenario mode to discard them.
          </div>
        )}
      </div>

      <div className="mx-auto max-w-[1600px] space-y-4 px-6 py-5">
        <CapacityRibbon capacity={capacity} currentQuarterKey={nowKey} />

        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
          <div className="flex gap-1">
            {(
              [
                ['roadmap', 'Roadmap'],
                ['team', 'Team & Capacity'],
                ['calendars', 'Calendars'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === key
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink-soft'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'roadmap' && (
            <div className="flex overflow-hidden rounded-lg border border-line text-xs font-semibold">
              {(
                [
                  ['theme', 'Theme'],
                  ['objective', 'Objective'],
                  ['none', 'List'],
                ] as const
              ).map(([key, label], idx) => (
                <button
                  key={key}
                  onClick={() => setGroupBy(key)}
                  className={`${idx > 0 ? 'border-l border-line ' : ''}px-3 py-1.5 ${
                    groupBy === key ? 'bg-ink text-surface' : 'bg-surface text-ink-soft'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab content */}
        {tab === 'roadmap' && (
          <RoadmapGrid
            initiatives={initiatives}
            capacity={capacity}
            groupBy={groupBy}
            onOpen={(i) => setEditing({ draft: i, isNew: false })}
            onAdd={openNew}
          />
        )}

        {tab === 'team' && (
          <div className="rounded-xl border border-line bg-canvas p-5">
            <TeamPanel
              engineers={engineers}
              pto={pto}
              capacity={capacity}
              onEngineerChange={onEngineerChange}
              onEngineerAdd={onEngineerAdd}
              onEngineerDelete={onEngineerDelete}
              onPtoChange={onPtoChange}
              onBauChange={onBauChange}
            />
          </div>
        )}

        {tab === 'calendars' && (
          <div className="rounded-xl border border-line bg-canvas p-5">
            <CalendarsPanel
              companyOffDays={companyOffDays}
              onAddOffDay={onAddOffDay}
              onDeleteOffDay={onDeleteOffDay}
            />
          </div>
        )}
      </div>

      {editing && (
        <InitiativeEditor
          draft={editing.draft}
          isNew={editing.isNew}
          onSave={saveInitiative}
          onDelete={editing.isNew ? undefined : deleteInitiative}
          onClose={() => !saving && setEditing(null)}
        />
      )}
    </main>
  )
}
