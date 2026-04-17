'use client'

import { useState } from 'react'
import { UploadPanel } from '@/components/qa/UploadPanel'
import { TestSuiteEditor } from '@/components/qa/TestSuiteEditor'
import type { QATestItem } from '@/lib/db/qa-test-items'

interface UploadedItem {
  tc_number: string
  part: string
  section: string
  feature_area: string
  platform: string
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
}: {
  projectId: string
  userType: string
  initialItems: QATestItem[]
}) {
  const [items, setItems] = useState<QATestItem[]>(initialItems)
  const [showUpload, setShowUpload] = useState(false)

  function handleItemsReady(uploaded: UploadedItem[]) {
    setItems(uploaded.map((item, i) => toEditorItem(item, projectId, i)))
    setShowUpload(false)
  }

  return (
    <div>
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

      <TestSuiteEditor projectId={projectId} userType={userType} initialItems={items} />
    </div>
  )
}
