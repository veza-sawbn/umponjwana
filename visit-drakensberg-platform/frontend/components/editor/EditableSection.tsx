'use client'
import { useEditMode } from '@/lib/edit-mode-context'
import { useSiteSection } from '@/lib/use-site-section'
import { LayoutPanelTop, EyeOff } from 'lucide-react'

interface EditableSectionProps {
  id: string
  label: string
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

/**
 * Section-level wrapper: applies admin style overrides (background, vertical
 * padding) and visibility from `home_layout`, and inside the visual editor
 * makes the whole section selectable with hover chrome and a DOM anchor the
 * navigator can scroll to.
 */
export default function EditableSection({ id, label, className = '', style, children }: EditableSectionProps) {
  const editMode = useEditMode()
  const layout = useSiteSection('home_layout')
  const overrides = layout.styles?.[id] ?? {}
  const hidden = (layout.hidden ?? []).includes(id)

  const mergedStyle: React.CSSProperties = { ...style }
  if (overrides.background) mergedStyle.backgroundColor = overrides.background
  if (typeof overrides.paddingY === 'number') {
    mergedStyle.paddingTop = overrides.paddingY
    mergedStyle.paddingBottom = overrides.paddingY
  }

  if (!editMode) {
    if (hidden) return null
    return <section id={`vd-sec-${id}`} className={className} style={mergedStyle}>{children}</section>
  }

  return (
    <section
      id={`vd-sec-${id}`}
      className={`group/sec relative ${className} ${hidden ? 'opacity-40' : ''}`}
      style={mergedStyle}
      onClick={() => editMode.openSection({ sectionId: id, label })}
    >
      {children}
      {/* hover ring */}
      <span className="pointer-events-none absolute inset-0 hidden group-hover/sec:block outline outline-2 -outline-offset-2 outline-forest/70 z-[190]" />
      {/* section chip */}
      <span className="pointer-events-none absolute top-2 left-2 hidden group-hover/sec:flex items-center gap-1.5 bg-forest text-white text-[10px] font-sans font-semibold px-2 py-1 z-[191] whitespace-nowrap">
        <LayoutPanelTop className="w-2.5 h-2.5" />
        {label}
      </span>
      {hidden && (
        <span className="pointer-events-none absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 text-white text-[10px] font-sans font-semibold px-2 py-1 z-[191]">
          <EyeOff className="w-2.5 h-2.5" /> Hidden on live site
        </span>
      )}
    </section>
  )
}
