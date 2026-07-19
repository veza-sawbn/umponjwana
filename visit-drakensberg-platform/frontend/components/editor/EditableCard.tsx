'use client'
import { useEditMode } from '@/lib/edit-mode-context'
import { Layers } from 'lucide-react'

interface EditableCardProps {
  contentKey: string
  fieldKey: string
  index: number
  label: string
  children: React.ReactNode
}

/**
 * Card-level wrapper for repeating collections (category / region / story
 * cards…). Clicking a card in the visual editor opens it in the inspector,
 * where it can be edited, duplicated, reordered, hidden or deleted.
 */
export default function EditableCard({ contentKey, fieldKey, index, label, children }: EditableCardProps) {
  const editMode = useEditMode()
  if (!editMode) return <>{children}</>

  return (
    <div
      className="group/card relative cursor-pointer"
      onClick={e => {
        e.stopPropagation()
        e.preventDefault()
        editMode.openCard({ contentKey, fieldKey, index, label })
      }}
    >
      {children}
      <span className="pointer-events-none absolute inset-0 hidden group-hover/card:block outline outline-2 outline-sky-500/80 z-[195]" />
      <span className="pointer-events-none absolute -top-7 right-0 hidden group-hover/card:flex items-center gap-1 bg-sky-600 text-white text-[10px] font-sans font-semibold px-2 py-1 z-[196] whitespace-nowrap">
        <Layers className="w-2.5 h-2.5" />
        {label}
      </span>
    </div>
  )
}
