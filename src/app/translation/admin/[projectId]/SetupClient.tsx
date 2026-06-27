'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { TranslationProject, DatasetMeta } from '@/lib/translation/types'
import { SourcesPanel } from './SourcesPanel'

// Owner-only source setup for one project. Holds the dataset list and refreshes it
// whenever a source is added or removed.
export function SetupClient({
  project,
  initialDatasets,
}: {
  project: TranslationProject
  initialDatasets: DatasetMeta[]
}) {
  const [datasets, setDatasets] = useState(initialDatasets)

  async function refresh() {
    const res = await fetch(`/api/translation/projects/${project.id}`)
    if (res.ok) {
      const data = await res.json()
      setDatasets(
        data.datasets.map((d: DatasetMeta) => ({ id: d.id, kind: d.kind, name: d.name, config: d.config })),
      )
    }
  }

  return (
    <div>
      <div className="mb-5">
        <Link href="/translation/admin" className="text-sm text-ink-muted hover:text-ink transition-colors">
          ← Setup &amp; projects
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="font-display leading-tight tracking-tight text-2xl font-light text-ink">{project.name} — sources</h1>
          <Link
            href={`/translation/${project.id}`}
            className="px-4 py-2 text-sm font-medium border border-line rounded-md bg-surface hover:border-ink transition-colors"
          >
            Open editor →
          </Link>
        </div>
        <p className="text-sm text-ink-muted mt-1">
          Load the English UI JSON with its target files, or a database CSV. Exports rebuild from these.
        </p>
      </div>

      <SourcesPanel projectId={project.id} datasets={datasets} onChanged={refresh} />
    </div>
  )
}
