-- Add denormalized author display fields and per-article SEO overrides to
-- blog_posts. Denormalized author fields allow guest contributors who have no
-- platform account; SEO fields give editors control without touching the global
-- site_content table.

alter table blog_posts
  add column if not exists author_name      text,
  add column if not exists author_role      text,
  add column if not exists author_bio       text,
  add column if not exists seo_title        text,
  add column if not exists seo_description  text;
