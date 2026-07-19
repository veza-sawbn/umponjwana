'use client'
import { Fragment, useRef, useState } from 'react'
import { useEditMode, FieldType } from '@/lib/edit-mode-context'
import { Pencil } from 'lucide-react'

interface EditableProps {
  section: string
  fieldKey: string
  value: any
  label: string
  type?: FieldType
  min?: number
  max?: number
  children: React.ReactNode
  as?: 'div' | 'span'
}

const INLINE_TYPES: FieldType[] = ['text', 'textarea']

/**
 * Field-level editing wrapper. In the visual editor, text fields are edited
 * inline (contentEditable, Elementor-style); all field types also open the
 * inspector panel so styles/media can be edited there.
 */
export default function Editable({
  section, fieldKey, value, label, type = 'text', min, max, children, as: Tag = 'div',
}: EditableProps) {
  const editMode = useEditMode()
  const [editing, setEditing] = useState(false)
  // Bumped after each inline-editing session: remounts the children so any
  // stray DOM nodes the browser injected during contentEditable are discarded.
  const [session, setSession] = useState(0)
  const ref = useRef<HTMLElement | null>(null)
  if (!editMode) return <>{children}</>

  const inline = INLINE_TYPES.includes(type)
  const currentValue = editMode.getValue(section, fieldKey, value)

  function startEditing(e: React.MouseEvent) {
    e.stopPropagation()
    editMode!.openField({ section, fieldKey, value: currentValue, label, type, min, max })
    if (!inline || editing) return
    setEditing(true)
    // Focus after React applies contentEditable
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
  }

  function readText(): string {
    return (ref.current?.innerText ?? '').replace(/\n+$/, '')
  }

  function finishEditing() {
    if (!editing) return
    const value = readText()
    setEditing(false)
    setSession(s => s + 1)
    editMode!.commitInline(section, fieldKey, value)
  }

  return (
    <Tag
      ref={ref as any}
      className="group/ed relative cursor-pointer"
      onClick={startEditing}
      contentEditable={editing}
      suppressContentEditableWarning
      onInput={() => editing && editMode.inlineInput(section, fieldKey, readText())}
      onBlur={finishEditing}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!editing) return
        if (e.key === 'Escape') { e.preventDefault(); (ref.current as HTMLElement)?.blur() }
        if (e.key === 'Enter' && type === 'text') { e.preventDefault(); (ref.current as HTMLElement)?.blur() }
      }}
    >
      <Fragment key={session}>{children}</Fragment>
      {!editing && (
        <>
          {/* hover ring */}
          <span data-vd-chrome className="pointer-events-none absolute inset-0 hidden group-hover/ed:block outline outline-2 outline-gold/80 z-[200]" contentEditable={false} />
          {/* label chip */}
          <span data-vd-chrome className="pointer-events-none absolute -top-7 left-0 hidden group-hover/ed:flex items-center gap-1 bg-gold text-forest text-[10px] font-sans font-semibold px-2 py-1 z-[201] whitespace-nowrap" contentEditable={false}>
            <Pencil className="w-2.5 h-2.5" />
            {label}
          </span>
        </>
      )}
    </Tag>
  )
}
