-- ============================================================================
-- Visit Drakensberg — no active content in the public media bucket
--
-- Run AFTER 20260913_notification_provenance_and_seat_authorization.sql.
--
-- Audit finding M2.
--
-- 20260719_media_storage.sql created the `media` bucket with public = true and
-- this allow-list:
--
--   array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
--         'image/avif','video/mp4','video/webm','video/quicktime',
--         'application/pdf']
--
-- …under a header comment that says "images + video only", which two of those
-- entries are not.
--
-- image/svg+xml is the problem. An SVG is not a picture, it is a document: it
-- carries <script>, and that script runs when the file is opened directly at
-- its public URL. 20260726_supplier_media.sql extended write access to every
-- approved supplier under supplier/<uid>/, so any approved operator could put
-- an executing document on infrastructure carrying our name.
--
-- The bound on the damage, stated plainly: the bucket is served from
-- *.supabase.co, a different origin from the app, so such a script cannot read
-- the application's cookies or act as a signed-in user. What it can do is host
-- convincing phishing and malware on a URL that looks like ours — which is
-- reason enough, and costs nothing to close because nothing uploads an SVG:
-- every upload path in the app is image/* or video/* (lib/supplier-media.ts,
-- lib/admin-supabase.ts, lib/listing-applications.ts, and the accept= on every
-- file input). Compliance PDFs live in their own bucket, not this one.
--
-- WHAT THIS DOES NOT DO
-- Changing allowed_mime_types governs NEW uploads. Any SVG already in the
-- bucket stays where it is and stays public. Check before considering this
-- closed:
--
--   select name, created_at from storage.objects
--    where bucket_id = 'media'
--      and (name ilike '%.svg' or metadata->>'mimetype' = 'image/svg+xml')
--    order by created_at desc;
--
-- and delete anything you did not put there yourself. The query is left here
-- rather than run automatically: deleting storage objects is not something a
-- migration should do to a production bucket on its own judgement.
-- ============================================================================

update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
         'video/mp4', 'video/webm', 'video/quicktime'
       ]
 where id = 'media';
