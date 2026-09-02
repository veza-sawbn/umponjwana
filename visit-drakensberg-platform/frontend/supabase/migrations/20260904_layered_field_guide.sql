-- ============================================================================
-- Visit Drakensberg — Layered Field Guide
--
-- An admin-managed, layered-scroll natural-history page. Three tables plus a
-- published-snapshot column, mirroring the shape the rest of this schema
-- already uses (vd_* prefix, is_admin() RLS, SECURITY DEFINER read functions
-- for the anonymous public path).
--
--   vd_field_guide_pages     one layered page (slug, SEO, paper background)
--   vd_field_guide_chapters  one specimen chapter within a page
--   vd_field_guide_layers    one independently animated layer within a chapter
--
-- Publishing model
-- ----------------
-- The public site NEVER reads the working rows. Publishing runs
-- vd_publish_field_guide_page(), which flattens the enabled chapters and
-- enabled layers into vd_field_guide_pages.published_snapshot; the public
-- route reads only that snapshot, through vd_field_guide_public(). So:
--
--   * editing a draft cannot change the live page,
--   * a disabled chapter/layer is absent from the snapshot entirely — it is
--     not hidden client-side, it is never sent,
--   * the previously published composition stays live, byte for byte, until
--     someone publishes again.
--
-- This is the smallest draft/publish design that fits the platform: there is
-- no generic revision system here (blog_posts is a plain status column), and
-- a status column alone cannot preserve "last published" while a draft is
-- being edited in place, which is what a multi-row composition needs.
--
-- Access
-- ------
-- The three tables are admin-only at the row level and carry no anonymous
-- policy at all. Public reads go exclusively through two SECURITY DEFINER
-- functions that return already-published JSON, the same shape as
-- vd_invoice_public() in 20260810. Default anon/authenticated table grants
-- are revoked explicitly rather than left to RLS alone — see the header of
-- 20260817_view_security_invoker.sql for why that default matters here.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Tables
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists vd_field_guide_pages (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  title               text not null,
  intro               text,
  -- Paper texture. background_color is the fallback painted underneath it,
  -- so the chapter still reads as paper before/if the texture never loads.
  background_url      text,
  background_color    text not null default '#F2EDE3',
  seo_title           text,
  seo_description     text,
  status              text not null default 'draft'
                      check (status in ('draft', 'published')),
  -- The live composition. Written only by vd_publish_field_guide_page().
  published_snapshot  jsonb,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists vd_field_guide_pages_status_idx on vd_field_guide_pages (status);

create table if not exists vd_field_guide_chapters (
  id                      uuid primary key default gen_random_uuid(),
  page_id                 uuid not null references vd_field_guide_pages(id) on delete cascade,
  common_name             text not null,
  scientific_name         text,
  category                text,
  description             text,
  habitat                 text,
  elevation               text,
  season                  text,
  locality                text,
  -- Read to screen readers in place of the artwork, which is decorative and
  -- carries no text of its own. Not the same thing as main_media_alt.
  accessible_description  text,
  main_media_url          text,
  main_media_alt          text,
  -- Stored so the public page can reserve the box before the file arrives —
  -- an isolated specimen is the largest asset in the chapter and the one
  -- most able to shift the layout under the reader.
  main_media_width        integer,
  main_media_height       integer,
  -- Percent of viewport height the pinned stage stays pinned for. 100 = the
  -- stage is released immediately; 300 = three screens of scroll to reveal.
  scroll_length           integer not null default 260 check (scroll_length between 120 and 600),
  chapter_order           integer not null default 0,
  is_enabled              boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists vd_field_guide_chapters_page_idx on vd_field_guide_chapters (page_id, chapter_order);

create table if not exists vd_field_guide_layers (
  id              uuid primary key default gen_random_uuid(),
  chapter_id      uuid not null references vd_field_guide_chapters(id) on delete cascade,
  layer_type      text not null default 'image'
                  check (layer_type in ('image', 'text', 'annotation', 'card')),
  name            text not null default 'Layer',
  media_url       text,
  media_width     integer,
  media_height    integer,
  -- Card heading / text-layer heading. Body copy lives in text_content.
  heading         text,
  text_content    text,
  alt_text        text,
  -- Everything positional is a PERCENTAGE of the pinned stage, never a pixel,
  -- so one composition holds together from 360px to 2560px wide.
  x               numeric not null default 50,
  y               numeric not null default 50,
  mobile_x        numeric not null default 50,
  mobile_y        numeric not null default 50,
  width           numeric not null default 24,
  mobile_width    numeric not null default 40,
  z_index         integer not null default 10,
  -- Reveal order within the chapter; also drives the entrance stagger.
  entrance_order  integer not null default 0,
  -- Fraction of the chapter's pinned scroll at which this layer starts to
  -- appear. 0 = with the specimen, 1 = at the very end of the chapter.
  scroll_trigger  numeric not null default 0.2 check (scroll_trigger between 0 and 1),
  -- Pixels the layer floats up through as it fades in.
  float_distance  integer not null default 55 check (float_distance between 0 and 200),
  fade_duration   integer not null default 700 check (fade_duration between 100 and 3000),
  rotation        numeric not null default 0,
  opacity         numeric not null default 1 check (opacity between 0 and 1),
  -- Pencil marginalia and rules that say nothing a sighted reader could not
  -- get elsewhere: hidden from assistive tech rather than read out as noise.
  is_decorative   boolean not null default false,
  is_enabled      boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists vd_field_guide_layers_chapter_idx on vd_field_guide_layers (chapter_id, entrance_order);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS — admin-only working rows, no anonymous surface whatsoever
-- ────────────────────────────────────────────────────────────────────────────

alter table vd_field_guide_pages    enable row level security;
alter table vd_field_guide_chapters enable row level security;
alter table vd_field_guide_layers   enable row level security;

drop policy if exists "Admins manage field guide pages"    on vd_field_guide_pages;
drop policy if exists "Admins manage field guide chapters" on vd_field_guide_chapters;
drop policy if exists "Admins manage field guide layers"   on vd_field_guide_layers;

create policy "Admins manage field guide pages" on vd_field_guide_pages
  for all using (is_admin()) with check (is_admin());
create policy "Admins manage field guide chapters" on vd_field_guide_chapters
  for all using (is_admin()) with check (is_admin());
create policy "Admins manage field guide layers" on vd_field_guide_layers
  for all using (is_admin()) with check (is_admin());

-- Supabase grants SELECT on new public-schema objects to anon by default.
-- RLS would deny it anyway (there is no anon policy), but an unpublished
-- specimen is exactly the kind of thing that must not depend on a single
-- layer of defence.
revoke all on vd_field_guide_pages    from anon;
revoke all on vd_field_guide_chapters from anon;
revoke all on vd_field_guide_layers   from anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Snapshot builder
--
--    Not granted to anyone: it reads working rows, including unpublished
--    ones. Callable only by the publish function below (SECURITY DEFINER,
--    so it runs as the owner) and by this migration's own seed.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.vd_field_guide_build_snapshot(p_page_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'version', 1,
    'page', jsonb_build_object(
      'id',              p.id,
      'slug',            p.slug,
      'title',           p.title,
      'intro',           p.intro,
      'seoTitle',        p.seo_title,
      'seoDescription',  p.seo_description,
      'backgroundUrl',   p.background_url,
      'backgroundColor', p.background_color
    ),
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                    c.id,
        'order',                 c.chapter_order,
        'commonName',            c.common_name,
        'scientificName',        c.scientific_name,
        'category',              c.category,
        'description',           c.description,
        'habitat',               c.habitat,
        'elevation',             c.elevation,
        'season',                c.season,
        'locality',              c.locality,
        'accessibleDescription', c.accessible_description,
        'mainMediaUrl',          c.main_media_url,
        'mainMediaAlt',          c.main_media_alt,
        'mainMediaWidth',        c.main_media_width,
        'mainMediaHeight',       c.main_media_height,
        'scrollLength',          c.scroll_length,
        'layers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',             l.id,
            'type',           l.layer_type,
            'name',           l.name,
            'mediaUrl',       l.media_url,
            'mediaWidth',     l.media_width,
            'mediaHeight',    l.media_height,
            'heading',        l.heading,
            'text',           l.text_content,
            'alt',            l.alt_text,
            'x',              l.x,
            'y',              l.y,
            'mobileX',        l.mobile_x,
            'mobileY',        l.mobile_y,
            'width',          l.width,
            'mobileWidth',    l.mobile_width,
            'zIndex',         l.z_index,
            'entranceOrder',  l.entrance_order,
            'scrollTrigger',  l.scroll_trigger,
            'floatDistance',  l.float_distance,
            'fadeDuration',   l.fade_duration,
            'rotation',       l.rotation,
            'opacity',        l.opacity,
            'decorative',     l.is_decorative
          ) order by l.entrance_order, l.created_at)
          from vd_field_guide_layers l
          where l.chapter_id = c.id and l.is_enabled
        ), '[]'::jsonb)
      ) order by c.chapter_order, c.created_at)
      from vd_field_guide_chapters c
      where c.page_id = p.id and c.is_enabled
    ), '[]'::jsonb)
  )
  from vd_field_guide_pages p
  where p.id = p_page_id;
$$;
revoke all on function public.vd_field_guide_build_snapshot(uuid) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Publish / unpublish
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.vd_publish_field_guide_page(p_page_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_snapshot jsonb;
begin
  -- Gated on is_admin() alone, deliberately. A claim-based escape hatch
  -- (auth.role() = 'service_role') reads request.jwt.claims, which is set by
  -- whatever opened the connection rather than by the caller's database role
  -- — so under a role-switched session it lets a non-admin straight through
  -- the guard. is_admin() resolves the actual signed-in user, and is the same
  -- predicate the RLS policies on these tables use. Anything holding the
  -- service key bypasses RLS anyway and can write the snapshot directly, as
  -- this migration's own seed does.
  if not is_admin() then
    raise exception 'admin only';
  end if;

  v_snapshot := vd_field_guide_build_snapshot(p_page_id);
  if v_snapshot is null then
    raise exception 'field guide page % not found', p_page_id;
  end if;

  update vd_field_guide_pages
     set published_snapshot = v_snapshot,
         status             = 'published',
         published_at       = now(),
         updated_at         = now()
   where id = p_page_id;

  return v_snapshot;
end;
$$;
-- Postgres grants EXECUTE to PUBLIC on every new function and anon inherits
-- PUBLIC, so granting to `authenticated` narrows nothing on its own — the
-- revoke is what actually closes the door. is_admin() inside still decides.
revoke all on function public.vd_publish_field_guide_page(uuid) from public, anon;
grant execute on function public.vd_publish_field_guide_page(uuid) to authenticated;

-- Takes the page off the public site. The snapshot is deliberately left
-- intact: re-publishing without further edits should restore exactly what
-- was live before, not an empty page.
create or replace function public.vd_unpublish_field_guide_page(p_page_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  update vd_field_guide_pages
     set status = 'draft', updated_at = now()
   where id = p_page_id;
end;
$$;
revoke all on function public.vd_unpublish_field_guide_page(uuid) from public, anon;
grant execute on function public.vd_unpublish_field_guide_page(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Public reads — published snapshots only
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.vd_field_guide_public(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select p.published_snapshot
    from vd_field_guide_pages p
   where p.slug = p_slug
     and p.status = 'published'
     and p.published_snapshot is not null;
$$;
grant execute on function public.vd_field_guide_public(text) to anon, authenticated;

-- Index cards for /field-guide. Built from each page's published snapshot,
-- never from the working rows, so a renamed draft does not leak here either.
create or replace function public.vd_field_guide_index()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug',         p.slug,
           'title',        p.published_snapshot->'page'->>'title',
           'intro',        p.published_snapshot->'page'->>'intro',
           'coverUrl',     p.published_snapshot->'chapters'->0->>'mainMediaUrl',
           'coverAlt',     p.published_snapshot->'chapters'->0->>'mainMediaAlt',
           'chapterCount', jsonb_array_length(coalesce(p.published_snapshot->'chapters', '[]'::jsonb)),
           'publishedAt',  p.published_at
         ) order by p.published_at desc), '[]'::jsonb)
    from vd_field_guide_pages p
   where p.status = 'published' and p.published_snapshot is not null;
$$;
grant execute on function public.vd_field_guide_index() to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Media-in-use guard
--
--    The Media Library must not let an admin delete a file that a published
--    (or draft) composition still points at. One function, so the console
--    can ask before it deletes rather than discovering the hole afterwards.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.vd_field_guide_media_usage(p_url text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(usage), '[]'::jsonb) from (
    select jsonb_build_object('page', p.title, 'slug', p.slug, 'usedAs', 'Paper background') as usage
      from vd_field_guide_pages p where p.background_url = p_url
    union all
    select jsonb_build_object('page', p.title, 'slug', p.slug, 'usedAs', 'Specimen — ' || c.common_name)
      from vd_field_guide_chapters c join vd_field_guide_pages p on p.id = c.page_id
     where c.main_media_url = p_url
    union all
    select jsonb_build_object('page', p.title, 'slug', p.slug, 'usedAs', c.common_name || ' — ' || l.name)
      from vd_field_guide_layers l
      join vd_field_guide_chapters c on c.id = l.chapter_id
      join vd_field_guide_pages p on p.id = c.page_id
     where l.media_url = p_url
  ) uses;
$$;
-- Console-only: it reports which guides reference a file, including drafts.
revoke all on function public.vd_field_guide_media_usage(text) from public, anon;
grant execute on function public.vd_field_guide_media_usage(text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Seed — "A Field Guide to the Drakensberg"
--
--    Three specimen chapters, each an isolated main specimen plus its own
--    stack of independently positioned detail layers. The line-art layers are
--    static assets shipped with the frontend (frontend/public/field-guide/*),
--    so a fresh environment renders a complete composition without anyone
--    having to upload artwork first; every one of them is replaceable from
--    the Media Library like any other layer.
--
--    Idempotent: keyed on the page slug, and skipped entirely if that page
--    already exists, so re-running the migration never overwrites an
--    editor's work.
-- ────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_page uuid;
  v_ch   uuid;
begin
  if exists (select 1 from vd_field_guide_pages where slug = 'drakensberg-field-guide') then
    return;
  end if;

  insert into vd_field_guide_pages (slug, title, intro, background_url, background_color, seo_title, seo_description)
  values (
    'drakensberg-field-guide',
    'A Field Guide to the Drakensberg',
    'Three species of the high escarpment, drawn the way a naturalist would meet them — the animal first, then the detail that explains it, then the ground it lives on.',
    '/field-guide/paper-texture.svg',
    '#F2EDE3',
    'Field Guide to the Drakensberg — Flora & Wildlife | Visit Drakensberg',
    'An illustrated field guide to the Drakensberg escarpment: the Bearded Vulture, the Silver Sugarbush and the Drakensberg Rockjumper, drawn layer by layer.'
  )
  returning id into v_page;

  -- ── Chapter 1 — Bearded Vulture ─────────────────────────────────────────
  insert into vd_field_guide_chapters (
    page_id, common_name, scientific_name, category, description, habitat, elevation,
    season, locality, accessible_description, main_media_url, main_media_alt,
    main_media_width, main_media_height, scroll_length, chapter_order
  ) values (
    v_page, 'Bearded Vulture', 'Gypaetus barbatus', 'Bird',
    'The only bird on earth that lives almost entirely on bone. It carries marrow-bones aloft and drops them onto flat rock until they split — a behaviour taught, not inherited, and lost wherever the population thins below a handful of pairs.',
    'Basalt cliffs and open grassland above the escarpment line',
    '1,800–3,300 m',
    'Resident. Breeding display flights May–July.',
    'Giant''s Castle, Sentinel, Sani Pass',
    'A large rust-coloured vulture with narrow, sharply angled wings and a wedge-shaped tail, photographed in flight against open sky.',
    'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1200&q=85',
    'Bearded Vulture in flight, wings fully spread',
    1200, 900, 300, 0
  ) returning id into v_ch;

  insert into vd_field_guide_layers
    (chapter_id, layer_type, name, media_url, media_width, media_height, heading, text_content, alt_text,
     x, y, mobile_x, mobile_y, width, mobile_width, z_index, entrance_order, scroll_trigger,
     float_distance, fade_duration, rotation, opacity, is_decorative)
  values
    (v_ch, 'image', 'Primary feather study', '/field-guide/feather-study.svg', 300, 760, null, null,
     'Ink study of a single primary flight feather', 16, 52, 20, 30, 11, 20, 20, 1, 0.16, 62, 760, -8, 0.92, false),
    (v_ch, 'image', 'Wing skeleton', '/field-guide/wing-bones.svg', 620, 360, null, null,
     'Skeletal study of the wing, humerus through to the alula', 76, 30, 79, 30, 30, 52, 20, 2, 0.30, 55, 720, 4, 0.9, false),
    (v_ch, 'annotation', 'Wingspan note', null, null, null, null,
     '2.8 m across — narrower and far straighter than any other vulture here.', null,
     70, 60, 52, 60, 20, 62, 40, 3, 0.42, 48, 640, -2, 1, true),
    (v_ch, 'image', 'Escarpment habitat', '/field-guide/escarpment-sketch.svg', 900, 380, null, null,
     'Profile sketch of the basalt escarpment seen from the east', 50, 84, 50, 112, 62, 120, 5, 4, 0.52, 68, 900, 0, 0.68, true),
    (v_ch, 'card', 'Bone-dropping card', null, null, null, 'Ossuary sites',
     'Ezemvelo maps the slabs a pair uses. Keep clear of them between May and September.', null,
     22, 78, 50, 74, 24, 80, 50, 5, 0.62, 58, 760, 0, 1, false),
    (v_ch, 'text', 'Field note', null, null, null, 'In the field',
     'Look for the diamond tail. At range, that shape separates it from the Cape Vulture long before colour does.', null,
     84, 74, 50, 90, 22, 84, 50, 6, 0.74, 52, 720, 0, 1, false);

  -- ── Chapter 2 — Silver Sugarbush ────────────────────────────────────────
  insert into vd_field_guide_chapters (
    page_id, common_name, scientific_name, category, description, habitat, elevation,
    season, locality, accessible_description, main_media_url, main_media_alt,
    main_media_width, main_media_height, scroll_length, chapter_order
  ) values (
    v_page, 'Silver Sugarbush', 'Protea roupelliae', 'Flora',
    'The proteas of the Drakensberg are fire plants. A stand burns to black stumps in a winter grass fire and is back in leaf within a season, because the growth buds sit under thick corky bark that the flames never reach.',
    'Grassland slopes and rocky ridges, often in open stands',
    '1,200–2,300 m',
    'Flowering December–March',
    'Cathedral Peak, Monk''s Cowl, Highmoor',
    'A shrub-sized protea carrying a cup-shaped flower head of stiff pink bracts above narrow silver-green leaves.',
    'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=1200&q=85',
    'Silver Sugarbush flower head in open grassland',
    1200, 900, 280, 1
  ) returning id into v_ch;

  insert into vd_field_guide_layers
    (chapter_id, layer_type, name, media_url, media_width, media_height, heading, text_content, alt_text,
     x, y, mobile_x, mobile_y, width, mobile_width, z_index, entrance_order, scroll_trigger,
     float_distance, fade_duration, rotation, opacity, is_decorative)
  values
    (v_ch, 'image', 'Flower head, longitudinal section', '/field-guide/protea-section.svg', 480, 480, null, null,
     'Cut-through study of the flower head showing the involucral bracts and styles', 78, 34, 79, 30, 26, 48, 20, 1, 0.16, 60, 760, 5, 0.94, false),
    (v_ch, 'image', 'Leaf study', '/field-guide/protea-leaf.svg', 260, 560, null, null,
     'Single leaf with the venation drawn in', 15, 56, 20, 30, 10, 19, 20, 2, 0.28, 58, 720, -6, 0.9, false),
    (v_ch, 'annotation', 'Bract note', null, null, null, null,
     'Bracts, not petals — the flowers are the crowded spikes inside.', null,
     74, 62, 52, 60, 21, 62, 40, 3, 0.40, 46, 640, 2, 1, true),
    (v_ch, 'image', 'Rock and scree', '/field-guide/rock-face-sketch.svg', 640, 480, null, null,
     'Sketch of boulder scree below a rock face', 48, 82, 50, 112, 46, 116, 5, 4, 0.50, 66, 900, 0, 0.6, true),
    (v_ch, 'card', 'Fire card', null, null, null, 'Fire, not frost',
     'Burnt stands regrow from the rootstock. The ones at risk sit in fire-suppressed valleys.', null,
     23, 80, 50, 74, 24, 80, 50, 5, 0.60, 56, 760, 0, 1, false),
    (v_ch, 'text', 'Field note', null, null, null, 'In the field',
     'Sunbirds work these heads at first light. Sit downhill of a stand at sunrise and they will come to you.', null,
     82, 78, 50, 90, 22, 84, 50, 6, 0.72, 50, 720, 0, 1, false);

  -- ── Chapter 3 — Drakensberg Rockjumper ──────────────────────────────────
  insert into vd_field_guide_chapters (
    page_id, common_name, scientific_name, category, description, habitat, elevation,
    season, locality, accessible_description, main_media_url, main_media_alt,
    main_media_width, main_media_height, scroll_length, chapter_order
  ) values (
    v_page, 'Drakensberg Rockjumper', 'Chaetops aurantius', 'Bird',
    'Endemic to this escarpment and nowhere else on earth. It barely flies — it runs and bounds between boulders, and a family group will work a whole scree slope on foot while calling to each other constantly.',
    'High-altitude boulder scree and rank grass',
    '2,000–3,200 m',
    'Resident year-round; most vocal September–December',
    'Sani Pass, Sentinel, Naude''s Nek',
    'A small rock-dwelling bird with a slate-grey head, deep orange underparts and a long dark tail, perched on a lichen-covered boulder.',
    'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=1200&q=85',
    'Drakensberg Rockjumper perched on a boulder',
    1200, 900, 280, 2
  ) returning id into v_ch;

  insert into vd_field_guide_layers
    (chapter_id, layer_type, name, media_url, media_width, media_height, heading, text_content, alt_text,
     x, y, mobile_x, mobile_y, width, mobile_width, z_index, entrance_order, scroll_trigger,
     float_distance, fade_duration, rotation, opacity, is_decorative)
  values
    (v_ch, 'image', 'Tail feathers, spread', '/field-guide/rockjumper-tail.svg', 420, 300, null, null,
     'Study of the spread tail feathers', 18, 40, 20, 30, 20, 38, 20, 1, 0.16, 58, 760, -7, 0.92, false),
    (v_ch, 'image', 'Scree habitat', '/field-guide/rock-face-sketch.svg', 640, 480, null, null,
     'Sketch of the boulder scree the bird forages across', 74, 44, 79, 30, 34, 56, 15, 2, 0.28, 62, 800, 3, 0.72, true),
    (v_ch, 'annotation', 'Gait note', null, null, null, null,
     'Bounds. You will hear the call long before anything takes wing.', null,
     30, 66, 52, 60, 22, 62, 40, 3, 0.40, 48, 640, -3, 1, true),
    (v_ch, 'image', 'Escarpment context', '/field-guide/escarpment-sketch.svg', 900, 380, null, null,
     'Profile sketch of the escarpment behind the scree slope', 50, 86, 50, 112, 66, 120, 5, 4, 0.50, 70, 900, 0, 0.55, true),
    (v_ch, 'card', 'Endemism card', null, null, null, 'Range',
     'The whole world population sits on this escarpment and the Lesotho highlands behind it.', null,
     24, 80, 50, 74, 24, 80, 50, 5, 0.60, 56, 760, 0, 1, false),
    (v_ch, 'text', 'Field note', null, null, null, 'In the field',
     'Stop at the top of a pass and wait. They approach walkers who stay still, and lose interest in anyone who follows them.', null,
     80, 76, 50, 90, 22, 84, 50, 6, 0.72, 50, 720, 0, 1, false);

  -- Live from the first deploy, so /field-guide/drakensberg-field-guide
  -- renders immediately. Done inline rather than through
  -- vd_publish_field_guide_page(), whose guard is is_admin() and a
  -- migration has no signed-in admin behind it.
  update vd_field_guide_pages
     set published_snapshot = vd_field_guide_build_snapshot(v_page),
         status             = 'published',
         published_at       = now(),
         updated_at         = now()
   where id = v_page;
end $$;
