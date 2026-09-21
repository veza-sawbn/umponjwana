-- ============================================================================
-- Visit Drakensberg — Email template hero image
--
-- Purely additive: two nullable columns on vd_email_templates, no existing
-- column or policy touched, no data migrated.
--
-- WHY:
--   lib/email-layout.ts's shell gained an image band between the masthead and
--   the body — the one structural thing a destination newsletter needs that a
--   transactional receipt does not. A campaign that opens on type alone reads
--   like an invoice, which is the wrong first impression for a mountain range.
--
--   The hero is stored as its own two columns rather than left to the editor
--   to hand-write an <img> into html_body, because the band is full-bleed
--   (it sits outside the body cell's 44px padding, edge to edge across the
--   640px card) and there is no way to express that from inside html_body.
--
-- WHY hero_image_alt IS A COLUMN AND NOT AN AFTERTHOUGHT:
--   Outlook blocks images by default, and so does Gmail for a sender the
--   reader has not written to. For a meaningful share of any campaign's
--   audience the alt text IS the hero. Storing it beside the URL is what makes
--   it possible for the admin form to ask for it every time rather than
--   offering it as an optional extra nobody fills in.
--
-- No hero on an existing template renders exactly as it does today: the shell
-- omits the band entirely when the URL is empty.
-- ============================================================================

alter table vd_email_templates
  add column if not exists hero_image_url text not null default '',
  add column if not exists hero_image_alt text not null default '';

comment on column vd_email_templates.hero_image_url is
  'Full-bleed image shown between the masthead and the body. Empty = no hero band.';
comment on column vd_email_templates.hero_image_alt is
  'Alt text for the hero. Required whenever hero_image_url is set — images are blocked by default in Outlook and in Gmail for unknown senders.';
