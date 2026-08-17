# Vellum 📚

A mobile reading app focused on books, notes, and distraction-free reading.

Built with React Native and designed around a simple idea:

**Read anywhere. Save ideas quickly. Continue where you left off.**

Vellum helps users build a personal digital library with EPUB/PDF support, synced reading progress, highlights, and notes across devices.

---

# ✨ MVP Goal

Deliver a stable first version where users can:

- create account
- upload EPUB books
- read EPUB
- sync reading progress (CFI)
- save highlights
- write notes

Fast, reliable, and mobile-first.

---

# 🧱 Stack

## Mobile app

- React Native
- TypeScript
- React Navigation
- Zustand
- Reanimated

## Database & auth

- Supabase (PostgreSQL)
- Auth propio (bcrypt + JWT)

## File storage

- Cloudflare R2

## Backend (optional API)

- Railway

## Email

- Mailgun

---

# 👤 Authentication

Users can:

- Sign up
- Sign in
- Forgot password

Auth propio con bcrypt + JWT, perfiles en PostgreSQL (Supabase).

---

# 📚 Library

Users can upload EPUB books, PDFs, and Markdown notes (🔄 in progress — see openspec/changes/add-multi-format-documents; on-device QA and iOS pending).

The library is split into three sections/tabs — **Books** (EPUB), **PDFs**, and **Notes** (Markdown) — that never mix formats together (spec: `openspec/specs/document-format-sections` once archived). Each section has its own independent search/filter/sort state and its own empty state; the last-viewed section is remembered across app restarts (`useLibrarySection`, `AsyncStorage`).

Each book stores:

```ts
Book {
  id
  user_id
  title
  author
  description
  cover_url
  file_url
  file_type     // 'epub' | 'pdf' | 'md'
  status        // unread | reading | read (auto-read at 100%)
  genres        // string[] extracted by AI
  progress_percent
  progress_locator
  last_opened_at
  created_at
}
```

### Features

- Search local by title/author (scoped to the active section)
- Filters: All / Reading / Unread / Read (scoped to the active section)
- Auto-mark as read at 100% progress
- Genre tags visible on each book (AI-extracted, normalized catalog)
- Sort: Recent, A—Z, Progress, Added (scoped to the active section)
- Long-press to delete
- Pull-to-refresh
- Uploading a document auto-switches to the section it lands in

---

# 📖 Reader

## EPUB

- react-native-readium (Readium native toolkit)
- Proxy backend → R2 para descarga
- Locator persistence (restaura última posición)

## Features

- Open instantly
- Resume last position (Locator)
- Native page turn (Readium navigator)
- Floating action button for controls overlay
- Progress tracking
- Font customization (A-/A+ size, System/Serif/Sans/Mono family)
- Local EPUB cache for offline reading
- Native text selection highlights
- Bookmarks with quick navigation

## PDF 🔄

- `react-native-pdf` (native page rendering — Readium/`react-native-readium` doesn't support PDF; confirmed via its own format-support table)
- Page-based navigation, resumes last page (`{ type: 'pdf', page, totalPages }` locator)
- **Highlights are page-level, not text-range** — standard PDF rendering has no selectable text layer without a commercial SDK (Nutrient/PSPDFKit) or a WebView+PDF.js reader; page-level was the deliberate, user-confirmed trade-off. See `openspec/changes/add-multi-format-documents/design.md` Decision 1.
- Bookmarks, notes, and AI section summaries reuse the same stores/endpoints as EPUB, keyed by page number
- Android verified (`yarn android:build` succeeds, autolinks under the New Architecture). **iOS pod install is currently broken in this repo for an unrelated, pre-existing reason** — RN 0.85.3's prebuilt-core tarball step fails with a path-parsing error, reproducible even with `react-native-pdf` fully removed; suspected cause is a space in the repo's parent directory path. Needs a working `pod install` environment to verify on iOS.

## Markdown (Notes) 🔄

- `react-native-markdown-display` (pure JS, no native linking) inside a `ScrollView`, one block per rendered `<Markdown>` instance
- Blocks are split by `splitMarkdownBlocks()` (heading/paragraph-aware, fence-aware); resumes at the nearest block to the last scroll position (`{ type: 'md', blockIndex, scrollOffset }` locator)
- **Highlights are block-level, not text-range** — same underlying reason as PDF: `react-native-markdown-display` renders a tree of native views for rich formatting, which rules out the character-offset selection trick without sacrificing that rich rendering. See design.md's "Revised during implementation" note.
- AI section summaries use the document's heading structure — `splitMarkdownBlocks()`'s section numbering is unit-tested to exactly match the backend's `markdown.ts sectionize()` numbering
- Generated title-card cover (no embedded cover image to extract, unlike EPUB/PDF)

---

# ✍️ Highlights

Users can select text and save highlights.

```ts
Highlight {
  id
  user_id
  book_id
  text
  locator
  color
  created_at
}
```

Use cases:

- save quotes
- mark important sections
- review later

---

# 📝 Notes

Notes attach to:

- book
- highlight

```ts
Note {
  id
  user_id
  book_id
  highlight_id
  content
  created_at
}
```

Use:

- thoughts
- summaries
- study notes

---

# 🔖 Bookmarks

Save specific locations in a book for quick return.

- Add bookmark at current location (CFI)
- Navigate to bookmark from overlay list
- Delete with long-press

---

# 📊 Reading Stats

Track reading habits and streaks.

- Reading sessions (start/end tracking)
- Daily reading streak with flame indicator
- Total reading time per book
- Sessions discarded if under 5 minutes

---

# 🤖 AI Summaries

Generate chapter summaries on demand.

- Frontend sends the current chapter's `href` (from the reader's TOC) — chapter text extraction happens server-side (`epub-parser` against the same EPUB file used for reading), not in the app
- Groq as primary provider
- Gemini 2.0 Flash as fallback
- Summary is generated in the same language as the source chapter (not always English)
- Results cached per chapter in database
- Displayed as bullet points in a scrollable reader overlay panel
- Pages with too little extractable text (cover, title page) return a clear error instead of an empty/useless summary

---

# 📱 Widget (Android)

Home screen widget with book highlights carousel.

- Select book to display
- Auto-rotates highlights every 5 seconds
- Deep link to reader (`vellum://reader/:bookId`)
- Book selection config screen in app

---

# 🔄 Sync

Backend (Express + Railway) syncs:

- book metadata
- progress (percent + CFI)
- highlights
- notes

Cloudflare R2 stores files.

## Upload flow

```
App → pick EPUB file
App → POST /api/upload → presigned R2 URL
App → PUT file to R2
App → POST /api/books → save metadata
Backend → extract cover from EPUB
```

## Read flow

```
App → GET /api/books → list metadata
App → tap book → GET /api/books/:id/file?token= → download EPUB
App → react-native-readium renders natively
App → PATCH /api/books/:id → save progress + Locator
```

## Delete flow

```
App → long-press → confirm → DELETE /api/books/:id
Backend → delete EPUB from R2
Backend → delete cover from R2
Backend → delete DB record + associated highlights, notes, bookmarks
```

---

# 🗄️ Database

## users

```sql
id
email
display_name
avatar_url
created_at
```

## books

```sql
id
user_id
title
author
description
cover_url
file_url
file_type
status       // unread | reading | read
genres       // string[] catálogo controlado
progress_percent
progress_locator
last_opened_at
created_at
```

## highlights

```sql
id
user_id
book_id
text
locator
color
created_at
```

## notes

```sql
id
user_id
book_id
highlight_id
content
created_at
```

## book_suggestions

```sql
id
user_id
title
author
synopsis
reason       // por qué se recomendó
genres       // string[] catálogo controlado
source_books // string[] libros leídos del usuario
status       // suggested | want_to_read | dismissed
expires_at   // TTL 24h
created_at
```

---

# 🔐 Security

## Backend

JWT verification en cada endpoint.
Users only access their own books, highlights, and notes.

## Cloudflare R2

Private bucket. Access via backend proxy with signed URLs.

---

# 📱 MVP Screens

## Auth

- sign in
- sign up
- forgot password

## Library

- search bar
- filter chips (All / Reading / Unread / Read)
- sort dropdown (Recent, A—Z, Progress, Added)
- uploaded books list
- upload button
- long-press delete
- pull-to-refresh
- auto-mark as read at 100% progress
- genre tags on books (AI-extracted)
- duplicate detection on upload
- icons: Widget, Highlights, Discover, Wishlist, Profile

## Reader

- reading view (react-native-readium)
- native page navigation
- overlay panel via FAB
- progress tracking

## Profile (modal)

- user info (name, email)
- logout

## Discover
- AI-generated book recommendations
- button in Library header (compass icon)
- 2-3 recommendations based on all read books
- save as "Want to read" or dismiss
- TTL 24h on suggestions

## Wishlist
- saved "Want to read" books
- accessible from bookmark icon in Library header
- mark as completed or remove

## Highlights & Notes

- select text and save highlight
- add note to highlight
- list notes
- 5 highlight colors with visual rendering
- global highlights screen grouped by book

---

# 🚀 MVP Roadmap

## ✅ Phase 1 — Done

- authentication
- upload books
- library (search, filters, sort, delete)
- reader (EPUB, swipe, progress, CFI, font, cache)
- highlights & notes (create, list, delete, notes per highlight)
- animations (Reanimated: FAB spring, fade-in items, color picker)

## ✅ Phase 2 — Done

- lazy loading & performance optimizations
- analytics & haptic feedback
- reading stats & streaks tracking
- estimated reading time (adaptive WPM)
- Android home screen widget with carousel
- AI chapter summaries (Groq + Gemini fallback)

## ✅ Phase 3 — Done

- AI book recommendations (Discover — analyze read books, suggest 2-3 new ones)
- genre extraction per book (normalized catalog of 15 genres)
- "Want to read" wishlist
- auto-mark books as "read" at 100% progress
- duplicate book detection on upload
- R2 file cleanup on book deletion + orphaned objects cleanup endpoint
- app renamed from "VellumFrontend" to "Vellum"

---

# Vision

Vellum is a personal reading space.

A place to:

- keep books
- continue reading
- save ideas
- build knowledge

Simple first.

Powerful over time.




---

# ⚠️ Migration Notes

## Multi-format documents (PDF / Markdown) — 🔄 in progress

Tracked as `openspec/changes/add-multi-format-documents` (see `proposal.md`/`design.md`/`tasks.md` there for the full picture). Status as of implementation:

- **Backend, shared frontend locator support, PDF reader, Markdown reader, upload flow, and library sections UI are all built** and pass `tsc --noEmit`, the Jest suite, and a Metro release bundle.
- **Not yet verified on an actual device/simulator** — no interactive on-device pass has been done (tapping through the PDF/Markdown readers, confirming rendering looks right, confirming cross-device sync). Do that before considering this fully shipped.
- **iOS native build is blocked** by a pre-existing, unrelated environment issue (see the PDF section above) — Android is verified, iOS is pending.
- **PDF and Markdown highlights are page-level / block-level, not text-range**, unlike EPUB — a deliberate, user-confirmed trade-off forced by what's actually achievable with free, native (non-WebView) rendering libraries for those formats. See `design.md` Decision 1 and its "Revised during implementation" note for the reasoning.
- `Book.fileType` grew from `'epub' | 'pdf'` to `'epub' | 'pdf' | 'md'` — `pdf` already existed as a dead branch in the type system before this (the upload presign step accepted it, but nothing downstream — cover extraction, AI summaries — actually handled it). Both `pdf` and `md` are fully wired now.

## EPUB Reader Migration (epub.js → react-native-readium)

- **Highlights, bookmarks, and reading progress stored before this migration use the old epub.js CFI format.**
- These legacy items will appear in lists but **will not render or navigate in the new reader**, as `react-native-readium` uses Readium Locator JSON instead of CFI strings.
- New highlights, bookmarks, and progress saved after this migration will work correctly.
- If you encounter "Invalid bookmark location" or missing highlights, the item was created before the migration and is now obsolete.

## Backend Changes (status)

- ✅ **Zod validation schema fixed** — `updateBookSchema` includes `current_page`/`total_pages` and enforcement is wired in via `validateBody` middleware.
- ✅ **Location fields renamed** — `books.progress_cfi` → `progress_locator`, `highlights.location` → `locator`, `bookmarks.cfi` → `locator`, across `schema.prisma`, types, validation, services, controllers, and the frontend. Existing rows were migrated in place via a data-preserving `RENAME COLUMN` (see `prisma/migrations/0005_locator_field_rename`), not a drop-and-recreate.
- ✅ **Legacy data handling** — the frontend never crashes on a pre-migration CFI string. All parsing goes through a single shared `parseLocator()` helper (`src/features/reader/utils/parseLocator.ts`, unit tested) that returns `null` on anything that isn't valid Locator JSON; callers fall back to "start of book" or a friendly toast rather than throwing.
- ⬜ **JSONB for structured locators (optional, not done)** — if chapter/range queries over locators become needed, migrate the `locator`/`progress_locator` columns from `TEXT` to `JSONB` (Prisma `Json`) for database-level filtering and GIN indexing. Not required for anything currently built.

---

adb install -r app/build/outputs/apk/release/app-release.apk