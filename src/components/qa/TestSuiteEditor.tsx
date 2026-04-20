'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { QATestItem } from '@/lib/db/qa-test-items'

interface EditableItem extends Omit<QATestItem, 'created_at' | 'updated_at'> {
  _isNew?: boolean
}

function newItem(projectId: string, sortOrder: number): EditableItem {
  return {
    id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    project_id: projectId,
    tc_number: '',
    part: '',
    section: '',
    feature_area: '',
    platform: '',
    viewport: '',
    user_type: '',
    test_description: '',
    steps: '',
    expected_result: '',
    jira_reference: '',
    needs_review: false,
    sort_order: sortOrder,
    _isNew: true,
  }
}

function SortableRow({
  item,
  onChange,
  onDelete,
  onResolve,
}: {
  item: EditableItem
  onChange: (id: string, field: keyof EditableItem, value: unknown) => void
  onDelete: (id: string) => void
  onResolve: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const cellClass = 'px-2 py-1.5 border border-warm-border rounded-[6px] text-xs text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink w-full resize-none'

  return (
    <tr ref={setNodeRef} style={style} className={item.needs_review ? 'bg-status-blocked/40' : 'bg-surface'}>
      {/* Drag handle */}
      <td className="px-1 py-2 text-center">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink-2 touch-none"
          aria-label="Drag to reorder"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>
      </td>

      {/* needs_review indicator */}
      <td className="px-1 py-2 text-center">
        {item.needs_review && (
          <button
            onClick={() => onResolve(item.id)}
            title="Needs review — click to resolve"
            className="text-status-blocked-text hover:opacity-70 transition-opacity"
          >
            ⚠️
          </button>
        )}
      </td>

      <td className="px-2 py-1 overflow-hidden">
        <input value={item.section} onChange={(e) => onChange(item.id, 'section', e.target.value)} className={cellClass} placeholder="1.1 Overview" />
      </td>
      <td className="px-2 py-1 overflow-hidden">
        <input value={item.feature_area} onChange={(e) => onChange(item.id, 'feature_area', e.target.value)} className={cellClass} placeholder="Feature area" />
      </td>
      <td className="px-2 py-1 overflow-hidden">
        <input value={item.platform} onChange={(e) => onChange(item.id, 'platform', e.target.value)} className={cellClass} placeholder="Desktop" />
      </td>
      <td className="px-2 py-1">
        <textarea value={item.test_description} onChange={(e) => onChange(item.id, 'test_description', e.target.value)} className={cellClass} rows={2} placeholder="Describe the test…" />
      </td>
      <td className="px-2 py-1">
        <textarea value={item.expected_result} onChange={(e) => onChange(item.id, 'expected_result', e.target.value)} className={cellClass} rows={2} placeholder="Expected result…" />
      </td>
      <td className="px-2 py-1 overflow-hidden">
        <input value={item.jira_reference} onChange={(e) => onChange(item.id, 'jira_reference', e.target.value)} className={cellClass} placeholder="TEC-123" />
      </td>

      {/* Delete */}
      <td className="px-1 py-2 text-center">
        <button
          onClick={() => onDelete(item.id)}
          className="text-ink-3 hover:text-status-fail-text transition-colors"
          aria-label="Delete row"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

interface TestSuiteEditorProps {
  projectId: string
  userType?: string
  initialItems: QATestItem[]
  onSaved?: () => void
  saveOnMount?: boolean
}

export function TestSuiteEditor({ projectId, userType, initialItems, onSaved, saveOnMount }: TestSuiteEditorProps) {
  const [items, setItems] = useState<EditableItem[]>(initialItems)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemsRef = useRef<EditableItem[]>(initialItems)

  // Save immediately when mounted after a CSV upload
  useEffect(() => {
    if (saveOnMount && initialItems.length > 0) {
      handleSave(initialItems)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function scheduleSave() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => handleSave(), 1500)
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const next = arrayMove(prev, prev.findIndex((i) => i.id === active.id), prev.findIndex((i) => i.id === over.id))
        itemsRef.current = next
        return next
      })
      scheduleSave()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = useCallback((id: string, field: keyof EditableItem, value: unknown) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      itemsRef.current = next
      return next
    })
    scheduleSave()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id)
      itemsRef.current = next
      return next
    })
    scheduleSave()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleResolve = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, needs_review: false } : item))
      itemsRef.current = next
      return next
    })
    scheduleSave()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddRow = () => {
    setItems((prev) => {
      const next = [...prev, newItem(projectId, prev.length)]
      itemsRef.current = next
      return next
    })
    scheduleSave()
  }

  const handleDeleteAll = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/qa/projects/${projectId}/test-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [], replace: true }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      itemsRef.current = []
      setItems([])
      setDeleteConfirm(false)
    } catch {
      setError('Failed to delete. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const pendingReviewCount = items.filter((i) => i.needs_review).length

  async function handleSave(currentItems?: EditableItem[]) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    const itemsToSave = currentItems ?? itemsRef.current
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/qa/projects/${projectId}/test-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(userType ? { user_type: userType } : {}),
          items: itemsToSave.map((item, i) => ({
            tc_number: item.tc_number,
            part: item.part,
            section: item.section,
            feature_area: item.feature_area,
            platform: item.platform,
            viewport: item.viewport,
            user_type: item.user_type,
            test_description: item.test_description,
            steps: item.steps,
            expected_result: item.expected_result,
            jira_reference: item.jira_reference,
            needs_review: item.needs_review,
            sort_order: i,
          })),
          replace: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to save')
      }
      const data = await res.json()
      itemsRef.current = data.items
      setItems(data.items)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { header: '',               width: 'w-[3%]'  }, // drag
    { header: '',               width: 'w-[2%]'  }, // needs_review
    { header: 'Section',        width: 'w-[10%]' },
    { header: 'Feature Area',   width: 'w-[9%]'  },
    { header: 'Platform',       width: 'w-[7%]'  },
    { header: 'Test Description', width: 'w-[30%]' },
    { header: 'Expected Result',  width: 'w-[30%]' },
    { header: 'Jira Ref',       width: 'w-[6%]'  },
    { header: '',               width: 'w-[3%]'  }, // delete
  ]

  return (
    <div
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          handleSave()
        }
      }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-2">{items.length} test items</span>
          {pendingReviewCount > 0 && (
            <span className="text-xs px-2.5 py-0.5 bg-status-blocked border border-status-blocked-border text-status-blocked-text rounded-full font-medium">
              ⚠️ {pendingReviewCount} need{pendingReviewCount === 1 ? 's' : ''} review
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {saving && (
            <span className="flex items-center gap-1 text-xs text-ink-3">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </span>
          )}
          {saved && <span className="text-xs text-status-pass-text">✓ Saved</span>}
          {items.length > 0 && (
            <>
              {deleteConfirm && (
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="px-3 py-2 bg-canvas border border-warm-border text-ink-3 text-sm font-medium rounded-[8px] hover:border-ink transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className={`px-3 py-2 text-sm font-medium rounded-[8px] border transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  !deleteConfirm
                    ? 'bg-canvas border-warm-border text-status-fail-text hover:border-status-fail-border'
                    : 'bg-status-fail border-status-fail-border text-status-fail-text hover:opacity-80'
                }`}
              >
                {deleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting…
                  </>
                ) : !deleteConfirm
                  ? 'Delete all'
                  : `Delete all ${items.length} items?`}
              </button>
            </>
          )}
          <button
            onClick={handleAddRow}
            className="px-3 py-2 bg-canvas border border-warm-border text-ink text-sm font-medium rounded-[8px] hover:border-ink transition-colors"
          >
            + Add row
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-status-fail border border-status-fail-border rounded-[10px] text-status-fail-text text-sm">
          {error}
        </div>
      )}

      {pendingReviewCount > 0 && (
        <div className="mb-4 p-3 bg-status-blocked border border-status-blocked-border rounded-[10px] text-status-blocked-text text-sm">
          <strong>{pendingReviewCount} item{pendingReviewCount === 1 ? '' : 's'} need{pendingReviewCount === 1 ? 's' : ''} your review.</strong>{' '}
          These were flagged by the AI as ambiguous or technical. Review and edit them, then click ⚠️ to clear the flag.
        </div>
      )}

      <div className="overflow-x-auto rounded-[12px] border border-warm-border">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full text-xs border-collapse table-fixed">
            <thead>
              <tr className="bg-canvas border-b border-warm-border">
                {columns.map((col, i) => (
                  <th key={i} className={`px-2 py-2 text-left text-xs font-semibold text-ink-3 whitespace-nowrap ${col.width}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {items.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    onChange={handleChange}
                    onDelete={handleDelete}
                    onResolve={handleResolve}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
        {items.length === 0 && (
          <div className="text-center py-12 text-ink-3 text-sm">
            No test items yet. Upload a document or add a row manually.
          </div>
        )}
      </div>
    </div>
  )
}
