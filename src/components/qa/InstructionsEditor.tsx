'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useState, useEffect } from 'react'

interface InstructionsEditorProps {
  projectId: string
  userType: string
  initialHtml: string
}

export function InstructionsEditor({ projectId, userType, initialHtml }: InstructionsEditorProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] px-3 py-2 text-sm text-ink',
      },
    },
  })

  useEffect(() => {
    if (editor && initialHtml !== editor.getHTML()) {
      editor.commands.setContent(initialHtml || '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userType])

  async function handleSave() {
    if (!editor) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const html = editor.getHTML()
      const res = await fetch(`/api/qa/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _merge_instructions: { [userType]: html } }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!editor) return null

  const btnClass = (active: boolean) =>
    `px-2 py-1 text-xs rounded border transition-colors ${active ? 'bg-ink text-white border-ink' : 'bg-canvas border-warm-border text-ink hover:border-ink-2'}`

  return (
    <div className="border border-warm-border rounded-[10px] overflow-hidden bg-canvas">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-warm-border bg-surface flex-wrap">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))}><em>I</em></button>
        <div className="w-px h-4 bg-warm-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))}>1. List</button>
        <div className="w-px h-4 bg-warm-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive('heading', { level: 3 }))}>H3</button>
        <div className="flex-1" />
        {error && <span className="text-xs text-status-fail-text">{error}</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 bg-ink text-white text-xs font-semibold rounded-[6px] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}
