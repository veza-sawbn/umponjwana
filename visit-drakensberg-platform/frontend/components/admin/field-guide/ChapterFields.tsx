'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { MediaPicker } from '@/components/media/MediaPicker'
import { adminMediaSource } from '@/lib/admin-supabase'
import type { FieldGuideChapter } from '@/lib/field-guide'
import { Label, NumberField, SectionHeading, TextArea, TextField } from './Field'

// The specimen's record — the written half of the chapter. Everything here is
// content, not layout; the composition itself is edited in the layer studio.

function measureImage(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    if (!url) return resolve(null)
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export default function ChapterFields({
  chapter,
  onPatch,
}: {
  chapter: FieldGuideChapter
  onPatch: (patch: Partial<FieldGuideChapter>) => void
}) {
  const [measuring, setMeasuring] = useState(false)

  async function pickSpecimen(url: string) {
    setMeasuring(true)
    const size = url ? await measureImage(url) : null
    onPatch({
      main_media_url: url || null,
      main_media_width: size?.width ?? null,
      main_media_height: size?.height ?? null,
    })
    setMeasuring(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
      <div className="space-y-4">
        <SectionHeading>Specimen record</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Common name" value={chapter.common_name} onChange={v => onPatch({ common_name: v })} placeholder="Bearded Vulture" />
          <TextField label="Scientific name" value={chapter.scientific_name ?? ''} onChange={v => onPatch({ scientific_name: v })} placeholder="Gypaetus barbatus" />
          <TextField label="Category" value={chapter.category ?? ''} onChange={v => onPatch({ category: v })} placeholder="Bird, Flora, Insect…" />
          <TextField label="Locality" value={chapter.locality ?? ''} onChange={v => onPatch({ locality: v })} placeholder="Giant's Castle, Sani Pass" />
          <TextField label="Habitat" value={chapter.habitat ?? ''} onChange={v => onPatch({ habitat: v })} placeholder="Basalt cliffs above the escarpment" />
          <TextField label="Elevation" value={chapter.elevation ?? ''} onChange={v => onPatch({ elevation: v })} placeholder="1,800–3,300 m" />
          <TextField label="Season / viewing period" value={chapter.season ?? ''} onChange={v => onPatch({ season: v })} placeholder="Resident. Display flights May–July." />
        </div>
        <TextArea
          label="Short description"
          value={chapter.description ?? ''}
          onChange={v => onPatch({ description: v })}
          rows={4}
          hint="the prose set beneath the plate"
        />
        <TextArea
          label="Accessibility description"
          value={chapter.accessible_description ?? ''}
          onChange={v => onPatch({ accessible_description: v })}
          rows={3}
          hint="what the finished plate shows, for screen readers"
          placeholder="A large rust-coloured vulture with narrow, sharply angled wings…"
        />
      </div>

      <div className="space-y-4">
        <SectionHeading>Main specimen</SectionHeading>
        <div>
          <Label>Isolated specimen image</Label>
          <MediaPicker value={chapter.main_media_url ?? ''} onChange={pickSpecimen} source={adminMediaSource} />
          <p className="mt-1.5 font-sans text-[11px] text-gray-400 leading-relaxed">
            {measuring ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 size={10} className="animate-spin" /> Reading dimensions…</span>
            ) : chapter.main_media_width && chapter.main_media_height ? (
              `${chapter.main_media_width}×${chapter.main_media_height} px — box reserved, no layout shift.`
            ) : (
              'A transparent PNG or WebP cut out from its background reads best against the paper.'
            )}
          </p>
        </div>
        <TextField
          label="Image alternative text"
          value={chapter.main_media_alt ?? ''}
          onChange={v => onPatch({ main_media_alt: v })}
          placeholder="Bearded Vulture in flight"
        />
        <div className="pt-4 border-t border-gray-100 space-y-4">
          <SectionHeading>Chapter</SectionHeading>
          <NumberField
            label="Scroll length"
            value={chapter.scroll_length}
            onChange={v => onPatch({ scroll_length: Math.round(v) })}
            min={120}
            max={600}
            step={10}
            suffix="vh"
            hint="how long the plate stays pinned"
          />
          <NumberField
            label="Display order"
            value={chapter.chapter_order}
            onChange={v => onPatch({ chapter_order: Math.round(v) })}
            min={0}
            max={99}
            slider={false}
          />
        </div>
      </div>
    </div>
  )
}
