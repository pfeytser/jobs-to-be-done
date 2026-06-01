import Link from 'next/link'
import { ManageControls, type TtStatus } from './ManageControls'

export interface ManagedSession {
  id: string
  title: string
  author_name: string
  status: TtStatus
  created_at: string
  votes: number
  statements?: { text: string }[]
}

const STATUS_STYLES: Record<TtStatus, string> = {
  draft: 'bg-status-skipped text-status-skipped-text',
  active: 'bg-status-pass text-status-pass-text',
  completed: 'bg-mist text-ink-2',
  archived: 'bg-canvas text-ink-3 border border-warm-border',
}

const STATUS_LABELS: Record<TtStatus, string> = {
  draft: 'Draft',
  active: 'Live',
  completed: 'Revealed',
  archived: 'Archived',
}

/** A management row: status badge, title, meta, optional statement preview,
 * and the lifecycle controls. Shown to whoever can manage the session. */
export function SessionRow({ s }: { s: ManagedSession }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-surface border border-warm-border rounded-xl">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLES[s.status]}`}>
            {STATUS_LABELS[s.status]}
          </span>
          <Link href={`/two-truths/${s.id}`} className="font-bold text-ink truncate hover:underline">
            {s.title}
          </Link>
        </div>
        <p className="text-xs text-ink-3 mt-1">
          by {s.author_name} · {new Date(s.created_at).toLocaleDateString()} ·{' '}
          {s.votes} {s.votes === 1 ? 'vote' : 'votes'}
        </p>
        {s.statements && s.statements.length > 0 && (
          <ul className="mt-2 space-y-1">
            {s.statements.map((st, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="shrink-0 text-ink-3 font-mono">{i + 1}.</span>
                <span className={st.text.trim() ? 'text-ink-2' : 'text-ink-3 italic'}>
                  {st.text.trim() || 'not filled in yet'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="shrink-0">
        <ManageControls sessionId={s.id} status={s.status} />
      </div>
    </div>
  )
}
