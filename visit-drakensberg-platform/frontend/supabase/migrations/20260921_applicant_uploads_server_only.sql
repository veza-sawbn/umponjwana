-- ============================================================================
-- Applicant uploads: server-only, on a signed grant
--
-- The second half of the warning 20260807_listing_applications.sql wrote about
-- itself. Its sibling migration 20260921_listing_applications_server_only.sql
-- closed the table; this closes the three write endpoints that went with it:
--
--   1. storage.objects  media/listing-applications/…        (20260807)
--   2. storage.objects  compliance/applications/…           (20260905)
--   3. vd_compliance_documents  insert                      (20260905)
--
-- All three were reachable by anything holding the anon key, which ships in
-- every page of the site, without ever loading the form.
--
-- WHAT EACH ONE ALLOWED
--
--   (1) checked `(storage.foldername(name))[1] = 'listing-applications'` and
--       nothing else. The bucket is public-read, so an object written here is
--       world-readable, and the browser chose the whole filename.
--
--   (2) checked `(storage.foldername(name))[1] = 'applications'`. The bucket
--       is private and no select policy covers anon, so this was write-only —
--       but the browser still chose which application's folder to write into.
--
--   (3) was the careful one: it pinned review_status to 'pending', supplier_id
--       to null and the review columns to null, so an applicant could not
--       self-verify or attach a document to somebody's account. What it could
--       not check is that storage_path named an object this applicant had
--       uploaded. A caller could lodge a row pointing at ANOTHER application's
--       certificate — and the verification office finds an application's
--       evidence by that path prefix (getDocumentsForApplication), so that is
--       how an operator gets assessed against someone else's papers.
--
-- WHAT REPLACES THEM
--   The applicant solves one Turnstile challenge on step 1 of the wizard and
--   the server trades it for a two-hour grant scoped to that application
--   reference (lib/upload-grant.ts, an HMAC in an httpOnly cookie). Uploads
--   then ask /api/listing-applications/upload-url for a signed URL for ONE
--   object at a path the SERVER picks, and certificates are registered through
--   /api/listing-applications/compliance-document, which requires the same
--   grant and refuses any storage_path outside applications/<reference>/.
--
--   The bytes still go browser-to-storage and never through a function: a
--   serverless body on Vercel is about 4.5 MB and these files run to 15 MB.
--   What moved to the server is the decision, not the payload.
--
-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ DEPLOY THE FRONTEND FIRST, as with its sibling migration. A build that  │
-- │ still uploads directly will start failing the moment these policies go. │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- NOT CHANGED: suppliers. An approved supplier is signed in and writes only
-- into suppliers/<their own uid>/…, which auth.uid() already pins exactly.
-- RLS is the right control there and the direct upload stays.
-- ============================================================================
-- @rollback: drop policy if exists "Applicant uploads are server-side only" on storage.objects; drop policy if exists "Applicant compliance rows are server-side only" on vd_compliance_documents; create policy "Applicants upload listing photos" on storage.objects for insert with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'listing-applications'); create policy "Applicants upload compliance docs" on storage.objects for insert with check (bucket_id = 'compliance' and (storage.foldername(name))[1] = 'applications'); create policy "Applicants lodge compliance docs" on vd_compliance_documents for insert with check (review_status = 'pending' and supplier_id is null and application_ref is not null and reviewed_by is null and reviewed_at is null);

drop policy if exists "Applicants upload listing photos"  on storage.objects;
drop policy if exists "Applicants upload compliance docs" on storage.objects;
drop policy if exists "Applicants lodge compliance docs"  on vd_compliance_documents;

-- Documentary, exactly as in the sibling migration: permissive policies are
-- OR'd, so `with check (false)` adds nothing to enforcement — the denial comes
-- from there being no policy that permits the write. What it buys is that the
-- rule is legible in \d+ and in the Supabase policy list instead of being an
-- absence somebody has to notice and correctly interpret. The supplier and
-- admin policies still allow their own writes, because OR.
create policy "Applicant uploads are server-side only" on storage.objects
  for insert with check (false);

create policy "Applicant compliance rows are server-side only" on vd_compliance_documents
  for insert with check (false);
