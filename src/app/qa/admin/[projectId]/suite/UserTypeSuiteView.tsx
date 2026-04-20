'use client'

import { useState } from 'react'
import { UploadPanel } from '@/components/qa/UploadPanel'
import { TestSuiteEditor } from '@/components/qa/TestSuiteEditor'
import { InstructionsEditor } from '@/components/qa/InstructionsEditor'
import type { QATestItem } from '@/lib/db/qa-test-items'

interface UploadedItem {
  tc_number: string
  part: string
  section: string
  feature_area: string
  platform: string
  viewport: string
  user_type: string
  test_description: string
  steps: string
  expected_result: string
  jira_reference: string
  needs_review: boolean
}

function toEditorItem(item: UploadedItem, projectId: string, index: number): QATestItem {
  return {
    id: `pending_${index}_${Math.random().toString(36).slice(2, 6)}`,
    project_id: projectId,
    ...item,
    sort_order: index,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function UserTypeSuiteView({
  projectId,
  userType,
  initialItems,
  initialInstructions,
}: {
  projectId: string
  userType: string
  initialItems: QATestItem[]
  initialInstructions: string
}) {
  const [items, setItems] = useState<QATestItem[]>(initialItems)
  const [showUpload, setShowUpload] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const [saveOnMount, setSaveOnMount] = useState(false)

  function handleItemsReady(uploaded: UploadedItem[]) {
    setItems(uploaded.map((item, i) => toEditorItem(item, projectId, i)))
    setShowUpload(false)
    setSaveOnMount(true)
    setEditorKey((k) => k + 1)
  }

  return (
    <div>
      {/* Setup instructions editor */}
      <div className="max-w-3xl mb-8">
        <h2 className="text-sm font-semibold text-ink mb-2">Setup instructions</h2>
        <p className="text-xs text-ink-3 mb-3">Shown to testers at the top of their session page. Use this to describe how to set up the test account or environment.</p>
        <InstructionsEditor projectId={projectId} userType={userType} initialHtml={initialInstructions} />
      </div>

      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <p className="text-sm text-ink-3">
          {items.length} test item{items.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="px-4 py-2 text-sm font-medium bg-canvas border border-warm-border text-ink rounded-[8px] hover:border-ink transition-colors"
        >
          {showUpload ? 'Cancel upload' : 'Upload new CSV'}
        </button>
      </div>

      {showUpload && (
        <div className="mb-6 max-w-lg bg-surface border border-warm-border rounded-[14px] p-5">
          <p className="text-xs text-ink-3 mb-4">
            Uploading will replace all <strong>{userType}</strong> tests with the new CSV.
          </p>
          <UploadPanel projectId={projectId} userType={userType} onItemsReady={handleItemsReady} />
        </div>
      )}

      <TestSuiteEditor key={editorKey} projectId={projectId} userType={userType} initialItems={items} saveOnMount={saveOnMount} onSaved={() => setSaveOnMount(false)} />
    </div>
  )
}
