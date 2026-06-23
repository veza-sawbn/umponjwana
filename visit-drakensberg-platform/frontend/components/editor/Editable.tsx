'use client'
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

export default function Editable({
  section, fieldKey, value, label, type = 'text', min, max, children, as: Tag = 'div',
}: EditableProps) {
  const editMode = useEditMode()
  if (!editMode) return <>{children}</>

  return (
    <Tag
      className="group/ed relative cursor-pointer"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation()
        editMode.openField({ section, fieldKey, value: editMode.getValue(section, fieldKey, value), label, type, min, max })
      }}
    >
      {children}
      {/* hover ring */}
      <span className="pointer-events-none absolute inset-0 hidden group-hover/ed:block outline outline-2 outline-gold/80 z-[200]" />
      {/* label chip */}
      <span className="pointer-events-none absolute -top-7 left-0 hidden group-hover/ed:flex items-center gap-1 bg-gold text-forest text-[10px] font-sans font-semibold px-2 py-1 z-[201] whitespace-nowrap">
        <Pencil className="w-2.5 h-2.5" />
        {label}
      </span>
    </Tag>
  )
}
