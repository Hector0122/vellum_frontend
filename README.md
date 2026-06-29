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

Users can upload EPUB books.

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
  file_type
  status        // unread | reading | read (auto-read at 100%)
  genres        // string[] extracted by AI
  progress_percent
  progress_cfi
  last_opened_at
  created_at
}
```

### Features

- Search local by title/author
- Filters: All / Reading / Unread / Read
- Auto-mark as read at 100% progress
- Genre tags visible on each book (AI-extracted, normalized catalog)
- Sort: Recent, A—Z, Progress, Added
- Long-press to delete
- Pull-to-refresh

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

---

# ✍️ Highlights

Users can select text and save highlights.

```ts
Highlight {
  id
  user_id
  book_id
  text
  location
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

- Extract chapter text automatically
- Groq (Llama 3.1) as primary provider
- Gemini 2.0 Flash as fallback
- Results cached per chapter in database
- Displayed as bullet points in reader overlay

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
progress_cfi
last_opened_at
created_at
```

## highlights

```sql
id
user_id
book_id
text
location
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

## EPUB Reader Migration (epub.js → react-native-readium)

- **Highlights, bookmarks, and reading progress stored before this migration use the old epub.js CFI format.**
- These legacy items will appear in lists but **will not render or navigate in the new reader**, as `react-native-readium` uses Readium Locator JSON instead of CFI strings.
- New highlights, bookmarks, and progress saved after this migration will work correctly.
- If you encounter "Invalid bookmark location" or missing highlights, the item was created before the migration and is now obsolete.

## Backend Changes Required

The backend currently treats location fields as opaque strings, so it will store Readium Locator JSON without modification. However, the following updates are needed for correctness and to prevent future issues:

### 1. Fix Zod Validation Schema (`src/lib/validation.ts`)

The `updateBookSchema` is missing `current_page` and `total_pages`, which the frontend sends on every progress update. If this schema is ever enforced in the controller, progress sync will break.

**Add to `updateBookSchema`:**
```ts
current_page: z.number().int().min(0).optional(),
total_pages: z.number().int().min(1).optional(),
```

### 2. Rename Location Fields (Recommended)

The fields `progress_cfi`, `cfi`, and `location` imply the old CFI format. Renaming them makes the schema format-agnostic:

| Current Name | Recommended Name |
|--------------|------------------|
| `books.progress_cfi` | `books.progress_locator` |
| `highlights.location` | `highlights.locator` |
| `bookmarks.cfi` | `bookmarks.locator` |

This requires:
- A new Prisma migration to rename columns.
- Updating `schema.prisma`, types, validation, services, and controllers.
- Updating the frontend to use the new API field names.

### 3. Consider JSONB for Structured Locators (Optional)

If you plan to query highlights by chapter (`href`) or location range in the future, migrate the locator fields from `TEXT` to `JSONB` (Prisma `Json`). This enables database-level filtering and indexing with PostgreSQL GIN.

### 4. Legacy Data Handling

The backend **cannot** convert old `epub.js` CFI strings to Readium Locator JSON. The frontend must handle legacy data gracefully:
- Catch `JSON.parse` errors when reading `progress_cfi`.
- Fall back to `undefined` (start of book) if parsing fails.
- Filter out or mark obsolete highlights/bookmarks that fail to parse.

---

adb install -r app/build/outputs/apk/release/app-release.apk