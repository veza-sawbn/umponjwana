import type { SiteContentKey } from './site-content'

/* ────────────────────────────────────────────────────────────────────────────
 * Visual editor schema
 *
 * Every editable page is described as a tree of sections; every section
 * exposes its editable fields (content), an optional repeating card
 * collection, and whether it can be reordered/hidden. The admin editor's
 * navigator, inspector and canvas chrome are all driven from this registry,
 * so adding a new editable component is a matter of:
 *   1. adding its defaults to SITE_CONTENT_DEFAULTS (lib/site-content.ts)
 *   2. wrapping its markup in <EditableSection>/<Editable>/<EditableCard>
 *   3. registering it here.
 * ──────────────────────────────────────────────────────────────────────────── */

export type EditorFieldType = 'text' | 'textarea' | 'image' | 'number' | 'range' | 'color' | 'link'

export interface EditorField {
  key: string
  label: string
  type: EditorFieldType
  min?: number
  max?: number
}

export interface EditorCardCollection {
  /** site_content key holding the collection object (e.g. `home_cards`). */
  contentKey: SiteContentKey
  /** field inside that key holding the array (e.g. `categories`). */
  fieldKey: string
  label: string
  /** card property used as the display name in lists. */
  itemLabelKey: string
  fields: EditorField[]
  /** template for newly created cards. */
  blank: Record<string, string | boolean>
}

export interface EditorSection {
  /** DOM anchor (`vd-sec-<id>`) + style-override key. */
  id: string
  label: string
  /** site_content key holding this section's text/media fields. */
  contentKey?: SiteContentKey
  fields?: EditorField[]
  cards?: EditorCardCollection
  /** included in home_layout.section_order drag-reordering. */
  reorderable?: boolean
  /** can be hidden from the live site. */
  hideable?: boolean
  note?: string
}

export interface EditorPage {
  label: string
  path: string
  sections: EditorSection[]
}

const text = (key: string, label: string): EditorField => ({ key, label, type: 'text' })
const textarea = (key: string, label: string): EditorField => ({ key, label, type: 'textarea' })
const image = (key: string, label: string): EditorField => ({ key, label, type: 'image' })
const link = (key: string, label: string): EditorField => ({ key, label, type: 'link' })

const FOOTER_SECTION: EditorSection = {
  id: 'footer',
  label: 'Footer',
  contentKey: 'footer',
  fields: [
    text('tagline', 'Tagline'),
    text('copyright', 'Copyright'),
    text('address', 'Address'),
    text('contact_email', 'Contact Email'),
    link('instagram', 'Instagram URL'),
    link('facebook', 'Facebook URL'),
    link('youtube', 'YouTube URL'),
  ],
}

const pageHeader = (id: string, contentKey: SiteContentKey): EditorSection => ({
  id,
  label: 'Page Header',
  contentKey,
  fields: [text('eyebrow', 'Eyebrow'), text('heading', 'Heading'), textarea('subheading', 'Subheading')],
})

export const EDITOR_PAGES: EditorPage[] = [
  {
    label: 'Home',
    path: '/',
    sections: [
      {
        id: 'hero',
        label: 'Hero',
        contentKey: 'hero',
        fields: [
          textarea('headline', 'Headline'),
          textarea('subheadline', 'Subheadline'),
          text('location_label', 'Location Label'),
          image('image_url', 'Background Image'),
          link('video_url', 'Background Video URL'),
          { key: 'overlay_opacity', label: 'Overlay Opacity', type: 'range', min: 0, max: 100 },
          text('cta_label', 'CTA Label'),
          link('cta_link', 'CTA Link'),
        ],
      },
      {
        id: 'stats',
        label: 'Stats Strip',
        contentKey: 'home_sections',
        reorderable: true,
        hideable: true,
        fields: [
          text('stat_1_value', 'Stat 1 Value'), text('stat_1_label', 'Stat 1 Label'),
          text('stat_2_value', 'Stat 2 Value'), text('stat_2_label', 'Stat 2 Label'),
          text('stat_3_value', 'Stat 3 Value'), text('stat_3_label', 'Stat 3 Label'),
          text('stat_4_value', 'Stat 4 Value'), text('stat_4_label', 'Stat 4 Label'),
        ],
      },
      {
        id: 'categories',
        label: 'Categories',
        contentKey: 'home_sections',
        reorderable: true,
        hideable: true,
        fields: [text('categories_eyebrow', 'Eyebrow'), text('categories_heading', 'Heading')],
        cards: {
          contentKey: 'home_cards',
          fieldKey: 'categories',
          label: 'Category Cards',
          itemLabelKey: 'label',
          fields: [text('label', 'Label'), image('img', 'Image'), link('href', 'Destination')],
          blank: { label: 'New Category', href: '/', img: '', visible: true },
        },
      },
      {
        id: 'regions',
        label: 'Regions',
        contentKey: 'home_sections',
        reorderable: true,
        hideable: true,
        fields: [text('regions_eyebrow', 'Eyebrow'), text('regions_heading', 'Heading')],
        cards: {
          contentKey: 'home_cards',
          fieldKey: 'regions',
          label: 'Region Cards',
          itemLabelKey: 'name',
          fields: [
            text('name', 'Name'), text('subtitle', 'Subtitle'), textarea('desc', 'Description'),
            image('img', 'Image'), link('href', 'Destination'),
          ],
          blank: { name: 'New Region', subtitle: '', desc: '', img: '', href: '/regions', visible: true },
        },
      },
      {
        id: 'stories',
        label: 'Stories',
        contentKey: 'home_sections',
        reorderable: true,
        hideable: true,
        fields: [text('stories_eyebrow', 'Eyebrow'), text('stories_heading', 'Heading')],
        note: 'Story cards show the 3 most recent published posts — edit them under Admin → Blog & Content.',
      },
      {
        id: 'trails',
        label: 'Top Trails',
        contentKey: 'home_sections',
        reorderable: true,
        hideable: true,
        fields: [text('trails_eyebrow', 'Eyebrow'), text('trails_heading', 'Heading')],
        note: 'Trail rows are live data from published trails — edit them under Admin → Hiking Trails.',
      },
      {
        id: 'journeys',
        label: 'Curated Journeys',
        contentKey: 'home_sections',
        reorderable: true,
        hideable: true,
        fields: [text('journeys_eyebrow', 'Eyebrow'), text('journeys_heading', 'Heading')],
        note: 'Journey cards are live data from published packages — edit them under Admin → Package Builder.',
      },
      {
        id: 'newsletter',
        label: 'Newsletter',
        contentKey: 'home_sections',
        reorderable: true,
        hideable: true,
        fields: [
          text('newsletter_eyebrow', 'Eyebrow'),
          text('newsletter_heading', 'Heading'),
          textarea('newsletter_body', 'Body'),
        ],
      },
      {
        id: 'promotions',
        label: 'Promo Banner',
        contentKey: 'promotions',
        fields: [
          text('banner_text', 'Banner Text'),
          link('banner_link', 'Banner Link'),
          { key: 'banner_color', label: 'Banner Colour', type: 'color' },
        ],
        note: 'Shown at the very top of the homepage when enabled under Admin → Website Settings.',
      },
      FOOTER_SECTION,
    ],
  },
  {
    label: 'Stays',
    path: '/stays',
    sections: [
      pageHeader('stays_page', 'stays_page'),
      { id: 'stays-listings', label: 'Stay Listings', note: 'Listings are live data from supplier properties and rooms.' },
      FOOTER_SECTION,
    ],
  },
  {
    label: 'Hikes',
    path: '/hikes',
    sections: [
      {
        ...pageHeader('hikes_page', 'hikes_page'),
        fields: [
          text('trail_count_label', 'Trail Count (e.g. "+160")'),
          text('eyebrow', 'Eyebrow'), text('heading', 'Heading'), textarea('subheading', 'Subheading'),
        ],
      },
      { id: 'hikes-listings', label: 'Trails & Hikes', note: 'Trails are live data — edit them under Admin → Hiking Trails.' },
      FOOTER_SECTION,
    ],
  },
  {
    label: 'Activities',
    path: '/activities',
    sections: [
      pageHeader('activities_page', 'activities_page'),
      { id: 'activities-listings', label: 'Activity Listings', note: 'Activities are live data from supplier listings.' },
      FOOTER_SECTION,
    ],
  },
  {
    label: 'Reserves',
    path: '/nature-reserves',
    sections: [
      pageHeader('reserves_page', 'reserves_page'),
      { id: 'reserves-content', label: 'Reserve Guide', note: 'Reserves are managed under Admin → Regions → Nature Reserves, filed by region.' },
      FOOTER_SECTION,
    ],
  },
  {
    label: 'Towns',
    path: '/towns',
    sections: [
      pageHeader('towns_page', 'towns_page'),
      { id: 'towns-content', label: 'Towns & Cities', note: 'Towns are managed under Admin → Regions → Towns & Cities, filed by region.' },
      FOOTER_SECTION,
    ],
  },
  {
    label: 'Regions',
    path: '/regions',
    sections: [
      {
        id: 'regions_page',
        label: 'Page Header',
        contentKey: 'regions_page',
        fields: [text('eyebrow', 'Eyebrow'), text('heading', 'Heading'), textarea('subheading', 'Subheading')],
      },
      {
        id: 'regions-towns',
        label: 'Towns & Villages',
        contentKey: 'regions_page',
        fields: [
          text('towns_eyebrow', 'Towns Eyebrow'),
          text('towns_heading', 'Towns Heading'),
          textarea('towns_subheading', 'Towns Subheading'),
        ],
      },
      { id: 'regions-list', label: 'Region Sections', note: 'Region content is managed under Admin → Regions.' },
      FOOTER_SECTION,
    ],
  },
  {
    label: 'Stories',
    path: '/mydrakensberg',
    sections: [
      pageHeader('stories_page', 'stories_page'),
      { id: 'stories-list', label: 'Story Grid', note: 'Stories are managed under Admin → Blog & Content.' },
      FOOTER_SECTION,
    ],
  },
  {
    label: 'Plan',
    path: '/plan',
    sections: [
      pageHeader('plan_page', 'plan_page'),
      {
        id: 'plan-guide',
        label: 'Planning Guide',
        contentKey: 'plan_page',
        fields: [
          text('seasons_eyebrow', 'Seasons Eyebrow'), text('seasons_heading', 'Seasons Heading'),
          text('itineraries_eyebrow', 'Itineraries Eyebrow'), text('itineraries_heading', 'Itineraries Heading'),
          text('essentials_eyebrow', 'Essentials Eyebrow'), text('essentials_heading', 'Essentials Heading'),
          text('essential_1_title', 'Essential 1 Title'), textarea('essential_1_body', 'Essential 1 Body'),
          text('essential_2_title', 'Essential 2 Title'), textarea('essential_2_body', 'Essential 2 Body'),
          text('essential_3_title', 'Essential 3 Title'), textarea('essential_3_body', 'Essential 3 Body'),
          text('essential_4_title', 'Essential 4 Title'), textarea('essential_4_body', 'Essential 4 Body'),
        ],
      },
      FOOTER_SECTION,
    ],
  },
  {
    label: 'About',
    path: '/about',
    sections: [
      {
        id: 'about_page',
        label: 'About Content',
        contentKey: 'about_page',
        fields: [
          text('eyebrow', 'Eyebrow'), text('heading', 'Heading'),
          textarea('body_1', 'Body Paragraph 1'), textarea('body_2', 'Body Paragraph 2'),
          text('suppliers_heading', 'Suppliers Heading'), textarea('suppliers_body', 'Suppliers Body'),
          text('suppliers_cta', 'Suppliers CTA'),
          text('contact_heading', 'Contact Heading'), text('contact_email', 'Contact Email'),
        ],
      },
      FOOTER_SECTION,
    ],
  },
]

export function findEditorPage(path: string): EditorPage | undefined {
  return EDITOR_PAGES.find(p => p.path === path)
}

export function findSection(page: EditorPage, sectionId: string): EditorSection | undefined {
  return page.sections.find(s => s.id === sectionId)
}
