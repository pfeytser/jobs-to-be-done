'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { CompanyOffDay, Engineer, Initiative, PtoEntry, QuarterSetting, Theme } from '@/lib/roadmap/types'
import { QUARTERS, formatHours, formatRevenue, themeKey } from '@/lib/roadmap/types'
import { computeCapacity, computeSchedule, roundWeeks } from '@/lib/roadmap/capacity'
import type { RoadmapData, ScenarioMeta } from '@/lib/db/roadmap'
import { CapacityRibbon } from './CapacityRibbon'
import { RoadmapGrid, type GroupBy, type Orientation } from './RoadmapGrid'
import { TeamPanel } from './TeamPanel'
import { CalendarsPanel } from './CalendarsPanel'
import { InitiativeEditor, type InitiativeDraft } from './InitiativeEditor'
import { ToastStack, type ToastItem } from './Toast'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function currentQuarterKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
}

function tempId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

// Friendly labels for the auto-save toast, keyed by the engineer field being edited.
const ENGINEER_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  country: 'Country',
  capacity_fraction: 'Capacity',
  start_date: 'Start date',
  end_date: 'End date',
  active: 'Active',
}

export function RoadmapClient({ initial }: { initial: RoadmapData }) {
  const [engineers, setEngineers] = useState<Engineer[]>(initial.engineers)
  const [pto, setPto] = useState<PtoEntry[]>(initial.pto)
  const [settings, setSettings] = useState<QuarterSetting[]>(initial.settings)
  const [initiatives, setInitiatives] = useState<Initiative[]>(initial.initiatives)
  const [companyOffDays, setCompanyOffDays] = useState<CompanyOffDay[]>(initial.companyOffDays)
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>(initial.scenarios)

  const [scenarioMode, setScenarioMode] = useState(false)
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [scenarioName, setScenarioName] = useState('')

  const [tab, setTab] = useState<'roadmap' | 'team' | 'calendars'>('roadmap')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [orientation, setOrientation] = useState<Orientation>('quarters-rows')
  const [editing, setEditing] = useState<{ draft: InitiativeDraft; isNew: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Toasts ──────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastId = useRef(0)
  const pushToast = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    const id = ++toastId.current
    setToasts((prev) => [...prev, { id, msg, kind }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2000)
  }, [])

  const capacity = useMemo(
    () => computeCapacity({ engineers, pto, settings, initiatives, quarters: QUARTERS, companyOffDays }),
    [engineers, pto, settings, initiatives, companyOffDays]
  )

  // Multi-quarter straddle: how each committed initiative's effort flows across quarters.
  const schedule = useMemo(() => computeSchedule(initiatives, capacity, QUARTERS), [initiatives, capacity])

  const totals = useMemo(() => {
    const feature = capacity.reduce((a, c) => a + c.featureWeeks, 0)
    const committed = capacity.reduce((a, c) => a + c.committedWeeks, 0)
    const proposed = initiatives
      .filter((i) => i.committed === 0 && i.unscheduled !== 1)
      .reduce((a, i) => a + (i.effort_weeks ?? 0), 0)
    // Portfolio outcomes across scheduled work (mirrors the source roadmap summary).
    const revenue = capacity.reduce((a, c) => a + c.revenue, 0)
    const hours = capacity.reduce((a, c) => a + c.hours, 0)
    return { feature, committed, proposed, headroom: feature - committed, revenue, hours }
  }, [capacity, initiatives])

  // ── Persistence (debounced, skipped in scenario mode, with save toast) ───────
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const persist = useCallback(
    (key: string, label: string, fn: () => Promise<Response>, immediate = false) => {
      if (scenarioMode) return
      const run = async () => {
        try {
          const res = await fn()
          if (res.ok) pushToast(`${label} · Saved`)
          else pushToast(`${label} — save failed`, 'error')
        } catch {
          pushToast(`${label} — save failed`, 'error')
        }
      }
      if (immediate) {
        void run()
        return
      }
      clearTimeout(timers.current[key])
      timers.current[key] = setTimeout(run, 400)
    },
    [scenarioMode, pushToast]
  )

  const applyData = (data: Partial<RoadmapData>) => {
    setEngineers(data.engineers ?? [])
    setPto(data.pto ?? [])
    setSettings(data.settings ?? [])
    setInitiatives(data.initiatives ?? [])
    setCompanyOffDays(data.companyOffDays ?? [])
  }

  const reload = useCallback(async () => {
    const res = await fetch('/api/roadmap/data')
    if (!res.ok) return
    const data: RoadmapData = await res.json()
    applyData(data)
    setScenarios(data.scenarios)
  }, [])

  // ── Scenario management ──────────────────────────────────────────────────────
  const snapshot = () => ({ engineers, pto, settings, initiatives, companyOffDays })

  const enterScenario = () => {
    // Start from a clone of the live data currently on screen.
    setScenarioMode(true)
    setActiveScenarioId(null)
    setScenarioName('')
  }

  const exitScenario = useCallback(async () => {
    setScenarioMode(false)
    setActiveScenarioId(null)
    setScenarioName('')
    await reload()
  }, [reload])

  const newFromLive = useCallback(async () => {
    setActiveScenarioId(null)
    setScenarioName('')
    await reload()
    setScenarioMode(true)
  }, [reload])

  const saveScenario = async () => {
    const name = scenarioName.trim() || (activeScenarioId ? '' : 'Untitled scenario')
    if (activeScenarioId) {
      const body: { data: unknown; name?: string } = { data: snapshot() }
      if (scenarioName.trim()) body.name = scenarioName.trim()
      const res = await fetch(`/api/roadmap/scenarios/${activeScenarioId}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setScenarios((prev) =>
          prev.map((s) => (s.id === activeScenarioId ? { ...s, name: body.name ?? s.name } : s))
        )
        pushToast('Scenario saved')
      } else pushToast('Scenario — save failed', 'error')
    } else {
      const res = await fetch('/api/roadmap/scenarios', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name, data: snapshot() }),
      })
      if (res.ok) {
        const { scenario } = await res.json()
        setScenarios((prev) => [scenario, ...prev])
        setActiveScenarioId(scenario.id)
        setScenarioName(scenario.name)
        pushToast('Scenario saved')
      } else pushToast('Scenario — save failed', 'error')
    }
  }

  const loadScenario = async (id: string) => {
    const res = await fetch(`/api/roadmap/scenarios/${id}`)
    if (!res.ok) return
    const { scenario } = await res.json()
    applyData(scenario.data as Partial<RoadmapData>)
    setScenarioMode(true)
    setActiveScenarioId(id)
    setScenarioName(scenario.name)
  }

  const removeScenario = async (id: string) => {
    const res = await fetch(`/api/roadmap/scenarios/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setScenarios((prev) => prev.filter((s) => s.id !== id))
      if (id === activeScenarioId) {
        setActiveScenarioId(null)
        setScenarioName('')
      }
      pushToast('Scenario deleted')
    }
  }

  // ── Engineer handlers ───────────────────────────────────────────────────────
  const onEngineerChange = (id: string, patch: Partial<Engineer>) => {
    setEngineers((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    const label = ENGINEER_FIELD_LABELS[Object.keys(patch)[0]] ?? 'Engineer'
    persist(`eng:${id}`, label, () =>
      fetch(`/api/roadmap/engineers/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(patch) })
    )
  }

  const onEngineerAdd = async () => {
    const draft = { name: 'New engineer', country: 'US', capacity_fraction: 1, start_date: null, end_date: null, active: 1 as const }
    if (scenarioMode) {
      setEngineers((prev) => [...prev, { id: tempId('eng'), sort_order: prev.length, ...draft }])
      return
    }
    const res = await fetch('/api/roadmap/engineers', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(draft) })
    if (res.ok) {
      const { engineer } = await res.json()
      setEngineers((prev) => [...prev, engineer])
      pushToast('Engineer added')
    }
  }

  const onEngineerDelete = (id: string) => {
    setEngineers((prev) => prev.filter((e) => e.id !== id))
    setPto((prev) => prev.filter((p) => p.engineer_id !== id))
    if (id.startsWith('eng-')) return // scenario-only temp row
    persist(`eng-del:${id}`, 'Engineer removed', () => fetch(`/api/roadmap/engineers/${id}`, { method: 'DELETE' }), true)
  }

  const onPtoChange = (engineerId: string, year: number, quarter: number, days: number) => {
    setPto((prev) => {
      const rest = prev.filter((p) => !(p.engineer_id === engineerId && p.year === year && p.quarter === quarter))
      return days > 0 ? [...rest, { engineer_id: engineerId, year, quarter, days }] : rest
    })
    persist(`pto:${engineerId}:${year}-${quarter}`, 'PTO', () =>
      fetch('/api/roadmap/pto', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ engineer_id: engineerId, year, quarter, days }) })
    )
  }

  const onBauChange = (year: number, quarter: number, pct: number) => {
    setSettings((prev) => [...prev.filter((s) => !(s.year === year && s.quarter === quarter)), { year, quarter, bau_pct: pct }])
    persist(`bau:${year}-${quarter}`, 'BAU %', () =>
      fetch('/api/roadmap/settings', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ year, quarter, bau_pct: pct }) })
    )
  }

  // ── Company off-day handlers ────────────────────────────────────────────────
  const onAddOffDay = async (date: string, label: string) => {
    setCompanyOffDays((prev) => [...prev.filter((o) => o.date !== date), { id: tempId('off'), date, label }])
    if (scenarioMode) return
    const res = await fetch('/api/roadmap/offdays', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ date, label }) })
    if (res.ok) {
      const { offDay } = await res.json()
      setCompanyOffDays((prev) => [...prev.filter((o) => o.date !== date), offDay])
      pushToast('Off-day added')
    }
  }

  const onDeleteOffDay = (id: string) => {
    setCompanyOffDays((prev) => prev.filter((o) => o.id !== id))
    if (!scenarioMode && !id.startsWith('off-')) {
      void fetch(`/api/roadmap/offdays/${id}`, { method: 'DELETE' }).then((r) => r.ok && pushToast('Off-day removed'))
    }
  }

  // ── Initiative handlers ─────────────────────────────────────────────────────
  const openNew = (year: number, quarter: number) => {
    setEditing({
      isNew: true,
      draft: {
        title: '', summary: '', status: 'proposed', priority: 'medium', theme: 'revenue', year, quarter,
        effort_weeks: null, impact_value: null, impact_unit: null, impact_revenue: null, impact_hours: null,
        impact_kind: 'increase', owner_name: null, objective: null,
        is_bau: 0, is_required: 0, committed: 0, unscheduled: 0,
      },
    })
  }

  const saveInitiative = async (d: InitiativeDraft) => {
    setSaving(true)
    const { id, ...body } = d
    if (!id) {
      if (scenarioMode) {
        setInitiatives((prev) => [...prev, { id: tempId('init'), sort_order: prev.length, ...(body as Omit<Initiative, 'id' | 'sort_order'>) }])
      } else {
        const res = await fetch('/api/roadmap/initiatives', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
        if (res.ok) {
          const { initiative } = await res.json()
          setInitiatives((prev) => [...prev, initiative])
          pushToast('Initiative created')
        }
      }
    } else {
      setInitiatives((prev) => prev.map((i) => (i.id === id ? ({ ...i, ...(body as object) } as Initiative) : i)))
      if (!scenarioMode) {
        const res = await fetch(`/api/roadmap/initiatives/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) })
        if (res.ok) pushToast('Initiative saved')
      }
    }
    setSaving(false)
    setEditing(null)
  }

  const deleteInitiative = () => {
    const id = editing?.draft.id
    if (!id) return
    setInitiatives((prev) => prev.filter((i) => i.id !== id))
    if (!scenarioMode && !id.startsWith('init-')) {
      void fetch(`/api/roadmap/initiatives/${id}`, { method: 'DELETE' }).then((r) => r.ok && pushToast('Initiative deleted'))
    }
    setEditing(null)
  }

  // ── Drag-and-drop move (across quarters / bands, and reordering) ─────────────
  const groupKeyOf = (i: Initiative) =>
    groupBy === 'theme' ? themeKey(i.theme) : groupBy === 'objective' ? i.objective ?? '—' : 'all'

  const onMoveInitiative = (
    id: string,
    target: { year: number; quarter: number; groupKey: string; unscheduled?: boolean },
    beforeId?: string
  ) => {
    const moved = initiatives.find((i) => i.id === id)
    if (!moved) return

    // Dropping into the To-Be-Prioritized bucket only flips `unscheduled`; dropping
    // into a quarter cell schedules it there (and re-themes it to match the band).
    const patch: Partial<Initiative> = {}
    if (target.unscheduled) {
      patch.unscheduled = 1
    } else {
      patch.year = target.year
      patch.quarter = target.quarter
      patch.unscheduled = 0
      if (groupBy === 'theme') patch.theme = target.groupKey === '_none' ? null : (target.groupKey as Theme)
      else if (groupBy === 'objective') patch.objective = target.groupKey === '—' ? null : target.groupKey
    }
    const updatedMoved = { ...moved, ...patch }

    const inTarget = (i: Initiative) =>
      target.unscheduled
        ? i.unscheduled === 1
        : i.unscheduled !== 1 &&
          i.year === target.year &&
          i.quarter === target.quarter &&
          groupKeyOf(i) === target.groupKey

    const others = initiatives
      .filter((i) => i.id !== id && inTarget(i))
      .sort((a, b) => a.sort_order - b.sort_order)

    let ordered: Initiative[]
    if (beforeId) {
      const idx = others.findIndex((o) => o.id === beforeId)
      ordered = idx < 0 ? [...others, updatedMoved] : [...others.slice(0, idx), updatedMoved, ...others.slice(idx)]
    } else {
      ordered = [...others, updatedMoved]
    }
    const orderMap = new Map(ordered.map((o, idx) => [o.id, idx]))

    setInitiatives((prev) =>
      prev.map((i) => {
        if (i.id === id) return { ...i, ...patch, sort_order: orderMap.get(id)! }
        if (orderMap.has(i.id)) return { ...i, sort_order: orderMap.get(i.id)! }
        return i
      })
    )

    if (scenarioMode) return

    const body: Record<string, unknown> = { ...patch, sort_order: orderMap.get(id)! }
    persist(`move:${id}`, 'Moved', () => fetch(`/api/roadmap/initiatives/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) }), true)
    // Silently persist the re-ordered neighbours (no toast each).
    for (const o of others) {
      const ns = orderMap.get(o.id)!
      if (ns !== o.sort_order && !o.id.startsWith('init-')) {
        void fetch(`/api/roadmap/initiatives/${o.id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ sort_order: ns }) })
      }
    }
  }

  // Button reordering within a cell — resolves to a before-id and reuses the move path.
  const onReorderInitiative = (id: string, dir: 'top' | 'up' | 'down' | 'bottom') => {
    const item = initiatives.find((i) => i.id === id)
    if (!item) return
    const target =
      item.unscheduled === 1
        ? { year: QUARTERS[0].year, quarter: QUARTERS[0].quarter, groupKey: 'all', unscheduled: true }
        : { year: item.year, quarter: item.quarter, groupKey: groupKeyOf(item) }
    const peers = initiatives
      .filter((i) =>
        item.unscheduled === 1
          ? i.unscheduled === 1
          : i.unscheduled !== 1 && i.year === item.year && i.quarter === item.quarter && groupKeyOf(i) === groupKeyOf(item)
      )
      .sort((a, b) => a.sort_order - b.sort_order)
    const idx = peers.findIndex((p) => p.id === id)
    if (idx < 0) return
    if ((dir === 'up' || dir === 'top') && idx === 0) return
    if ((dir === 'down' || dir === 'bottom') && idx === peers.length - 1) return

    let beforeId: string | undefined
    if (dir === 'top') beforeId = peers[0].id
    else if (dir === 'up') beforeId = peers[idx - 1].id
    else if (dir === 'down') beforeId = peers[idx + 2]?.id // undefined → append past the next one
    else beforeId = undefined // bottom → append
    onMoveInitiative(id, target, beforeId)
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
              {totals.revenue > 0 && <span className="tabular-nums font-semibold text-ink">{formatRevenue(totals.revenue)} unlocked</span>}
              {totals.hours > 0 && <span className="tabular-nums font-semibold text-ink">{formatHours(totals.hours)}</span>}
            </div>

            <button
              onClick={() => (scenarioMode ? exitScenario() : enterScenario())}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                scenarioMode ? 'border-accent bg-accent text-ink' : 'border-line bg-surface text-ink-soft hover:border-ink'
              }`}
              title="Scenario mode is a sandbox: edits aren't saved to the live plan. You can save named scenarios to revisit."
            >
              {scenarioMode ? '● Exit scenario' : 'Scenario mode'}
            </button>
          </div>
        </div>

        {scenarioMode && (
          <div className="border-t border-accent bg-accent-wash">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-6 py-2 text-xs">
              <span className="font-bold text-ink">● Scenario</span>
              <span className="text-ink-soft">
                {activeScenarioId ? 'editing a saved scenario' : 'unsaved working draft'} — not part of the live plan
              </span>

              {scenarios.length > 0 && (
                <select
                  value={activeScenarioId ?? ''}
                  onChange={(e) => (e.target.value ? loadScenario(e.target.value) : newFromLive())}
                  className="rounded-md border border-line bg-surface px-2 py-1 text-ink focus:border-ink focus:outline-none"
                >
                  <option value="">Working draft (from live)</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}

              <input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Name this scenario"
                className="min-w-[150px] rounded-md border border-line bg-surface px-2 py-1 text-ink focus:border-ink focus:outline-none"
              />
              <button
                onClick={saveScenario}
                className="rounded-md bg-ink px-3 py-1 font-semibold text-surface hover:opacity-90"
              >
                {activeScenarioId ? 'Update' : 'Save'} scenario
              </button>
              {activeScenarioId && (
                <button
                  onClick={() => removeScenario(activeScenarioId)}
                  className="rounded-md border border-line px-2.5 py-1 font-semibold text-fail hover:border-fail"
                >
                  Delete
                </button>
              )}
              <button
                onClick={exitScenario}
                className="ml-auto rounded-md border border-line px-2.5 py-1 font-semibold text-ink-soft hover:border-ink"
              >
                Exit to live
              </button>
            </div>
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
                  tab === key ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink-soft'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'roadmap' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOrientation((o) => (o === 'quarters-cols' ? 'quarters-rows' : 'quarters-cols'))}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-ink"
                title="Swap whether quarters run across the columns or down the rows"
              >
                {orientation === 'quarters-cols' ? 'Time: columns ⇄' : 'Time: rows ⇄'}
              </button>
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
            </div>
          )}
        </div>

        {/* Tab content */}
        {tab === 'roadmap' && (
          <RoadmapGrid
            initiatives={initiatives}
            capacity={capacity}
            schedule={schedule}
            groupBy={groupBy}
            orientation={orientation}
            onOpen={(i) => setEditing({ draft: i, isNew: false })}
            onAdd={openNew}
            onMove={onMoveInitiative}
            onReorder={onReorderInitiative}
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
            <CalendarsPanel companyOffDays={companyOffDays} onAddOffDay={onAddOffDay} onDeleteOffDay={onDeleteOffDay} />
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

      <ToastStack toasts={toasts} />
    </main>
  )
}
