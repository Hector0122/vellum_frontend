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
  progress_percent
  progress_cfi
  last_opened_at
  created_at
}
```

### Features

- Search local by title/author
- Filters: All / Reading / Unread
- Sort: Recent, A—Z, Progress, Added
- Long-press to delete
- Pull-to-refresh

---

# 📖 Reader

## EPUB

- epub.js v0.3.93 en WebView
- JSZip para archivos comprimidos
- PanGestureHandler para swipe
- Proxy backend → R2 para descarga
- CFI persistence (restaura última página)

## Features

- Open instantly
- Resume last page (CFI)
- Swipe to turn pages (PanGestureHandler + Reanimated)
- Tap to show/hide overlay
- Progress tracking
- Font customization (A-/A+ size, System/Serif/Sans/Mono family)
- Local EPUB cache for offline reading
- Animated highlights and color picker (Reanimated)

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
App → tap book → GET /api/books/:id/file?token= → stream EPUB
App → epub.js renders in WebView
App → PATCH /api/books/:id → save progress + CFI
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
- filter chips (All / Reading / Unread)
- sort dropdown (Recent, A—Z, Progress, Added)
- uploaded books list
- upload button
- long-press delete
- pull-to-refresh

## Reader

- reading view (WebView + epub.js)
- swipe navigation
- overlay (tap to show/hide back + title)
- progress tracking

## Profile (modal)

- user info (name, email)
- logout

## Highlight/Notes (pendiente)

- select text and save highlight
- add note to highlight
- list notes

---

# 🚀 MVP Roadmap

## ✅ Phase 1 — Done

- authentication
- upload books
- library (search, filters, sort, delete)
- reader (EPUB, swipe, progress, CFI, font, cache)
- highlights & notes (create, list, delete, notes per highlight)
- animations (Reanimated: FAB spring, fade-in items, color picker)

## 🔄 Phase 2 — In progress

- lazy loading & performance optimizations
- analytics & haptic feedback

---

# 🌱 Future

Later:

- OCR
- AI summaries
- semantic search
- flashcards
- export notes

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
