'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadPanel } from '@/components/qa/UploadPanel'
import { TestSuiteEditor } from '@/components/qa/TestSuiteEditor'
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

export function UploadAndEditPage({
  projectId,
  projectSlug,
  userTypes,
}: {
  projectId: string
  projectSlug: string
  userTypes: string[]
}) {
  const router = useRouter()
  const [userType, setUserType] = useState(userTypes[0] ?? '')
  const [customUserType, setCustomUserType] = useState('')
  const [stage, setStage] = useState<'upload' | 'review'>('upload')
  const [pendingItems, setPendingItems] = useState<QATestItem[]>([])

  const activeUserType = userTypes.length > 0 ? userType : customUserType.trim()

  function handleItemsReady(items: UploadedItem[]) {
    setPendingItems(items.map((item, i) => toEditorItem(item, projectId, i)))
    setStage('review')
  }

  return (
    <div>
      {stage === 'upload' ? (
        <div className="max-w-xl space-y-6">
          {/* User type selector */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">User type for this CSV</label>
            {userTypes.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {userTypes.map((ut) => (
                  <button
                    key={ut}
                    type="button"
                    onClick={() => setUserType(ut)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                      userType === ut
                        ? 'bg-ink text-white border-ink'
                        : 'bg-canvas border-warm-border text-ink hover:border-ink-2'
                    }`}
                  >
                    {ut}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={customUserType}
                onChange={(e) => setCustomUserType(e.target.value)}
                placeholder="e.g. Dedicated Office Member"
                className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
              />
            )}
            <p className="text-xs text-ink-3 mt-1.5">
              All rows in the CSV will be assigned this user type.
            </p>
          </div>

          {/* Upload panel */}
          <div className="bg-surface border border-warm-border rounded-[14px] p-6">
            <UploadPanel
              projectId={projectId}
              userType={activeUserType}
              onItemsReady={handleItemsReady}
            />
          </div>

          <p className="text-xs text-ink-3 text-center">
            Or{' '}
            <a
              href={`/qa/admin/${projectSlug}/suite`}
              className="underline hover:opacity-70 transition-opacity"
            >
              go to the test suite editor
            </a>{' '}
            to edit or add items manually.
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-ink">
                {pendingItems.length} test items found
                {activeUserType && <span className="text-ink-2 font-normal"> · {activeUserType}</span>}
              </p>
              <p className="text-xs text-ink-3 mt-0.5">
                Review and edit below. When you&apos;re happy, click &ldquo;Save suite&rdquo; to publish.
              </p>
            </div>
            <button
              onClick={() => setStage('upload')}
              className="text-xs text-ink-3 hover:text-ink transition-colors underline"
            >
              ← Upload different file
            </button>
          </div>
          <TestSuiteEditor
            projectId={projectId}
            initialItems={pendingItems}
            onSaved={() => router.push(`/qa/admin/${projectSlug}/suite`)}
          />
        </div>
      )}
    </div>
  )
}
