-- ============================================================================
-- Visit Drakensberg — a lightweight read path for trail listings
--
-- Every list-view consumer of trails — the homepage, the "What's on" reel,
-- Top Attractions — reads `site_content` where key='trails' in full. That
-- row is a single jsonb blob holding all 15 trails, and each trail carries
-- two fields no listing ever renders: `analytics` (a full-resolution
-- elevation/GPS point array, per-section profiles, and a pre-rendered SVG
-- route silhouette) and `gpx` (the raw track file). Together they are
-- routinely 95-99%+ of a trail's size — one trail alone (Southern Caves
-- Traverse) carries 2.38MB of it. Summed across all 15, the row is 10.2MB.
--
-- PostgREST does not comfortably serve that: production logs show
-- `GET .../site_content?select=value&key=eq.trails` failing with
-- "Warp server error: Thread killed by timeout manager" — a real timeout,
-- not a permissions issue (which would be 401/403). Every getTrails() caller
-- catches the failure and silently falls back to DEFAULT_TRAILS, the
-- hardcoded sample array — which is how a site with 15 real trails ended up
-- showing "Tugela Falls Circuit" and "Drakensberg Grand Traverse" (mock
-- entries, not in the live catalogue) on the homepage, and showing no image
-- at all for a genuine upcoming departure (its real trail record never
-- loaded, so nothing could be looked up by id).
--
-- This function returns the same 15 trails minus those two fields — 65KB
-- instead of 10.2MB, a 157x reduction, comfortably inside the timeout that
-- every other (much smaller) site_content key already clears. It changes
-- nothing for a trail's own detail page, which still reads the full row via
-- getTrails() for its elevation chart and route artwork.
-- ============================================================================

create or replace function public.vd_trail_summaries()
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(item - 'analytics' - 'gpx'),
    '[]'::jsonb
  )
  from site_content sc,
       lateral jsonb_array_elements(sc.value->'items') item
  where sc.key = 'trails'
$$;

comment on function public.vd_trail_summaries() is
  'Trails from site_content.trails with the analytics/gpx fields stripped — for list views (homepage, "What''s on") that never render a route chart or artwork. See 20260913_trail_summaries_rpc.sql.';

-- Same audience as the row it reads: site_content already grants public
-- SELECT ("Site content is public"), so this exposes nothing new — it's a
-- narrower view of data anonymous visitors can already read in full.
grant execute on function public.vd_trail_summaries() to anon, authenticated;
