# Destination Graph — Phase J: Overview readability

Requested: improve the region page's readability, allow paragraphs. `npm run build` passes.

## 1. Overview paragraph breaks

- **`region.overview`** was the one remaining region text field with the same problem
  "Getting There" had before Phase H: the admin textarea (`app/admin/regions/page.tsx`)
  is 5 rows and lets an admin type blank lines between paragraphs, but the public page
  (`app/regions/[slug]/page.tsx`) dumped the whole field into a single `<p>` — any
  paragraph breaks collapsed into one run-on block.
- Fixed with the same technique as `gettingThere`: split on blank lines
  (`split(/\n\s*\n/)`), trim and drop empty entries, render each as its own `<p>` inside
  a `space-y-4` wrapper. Falls back to `region.seoDescription` exactly as before when
  `overview` is empty. Works retroactively on whatever's already stored — no admin
  action or data migration required.
- **Admin textarea** now carries a placeholder ("Blank lines between paragraphs are
  preserved on the public page.") so admins editing Overview get the same guidance the
  Getting There field already gives.
- `bestTime` and the short blurb fields (highlight/attraction/subregion descriptions)
  were left as single-paragraph — they're short, narrow-column callouts (`max-w-2xl`,
  card blurbs), not long-form copy, so multi-paragraph rendering isn't the same class of
  problem `gettingThere`/`overview` had.

## Verified

`npm run build` passes, including `/regions/[slug]`.
