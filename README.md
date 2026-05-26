# Vellum 📚

A mobile reading app focused on books, notes, and distraction-free reading.

Built with React Native and designed around a simple idea:

**Read anywhere. Save ideas quickly. Continue where you left off.**

Vellum helps users build a personal digital library with EPUB/PDF support, synced reading progress, highlights, and notes across devices.

---

# ✨ MVP Goal

Deliver a stable first version where users can:

- create account
- upload books
- read EPUB/PDF
- sync reading progress
- save highlights
- write notes
- continue across devices

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

- Supabase
- PostgreSQL
- Row Level Security

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
- Reset password
- Verify email

Stored with Supabase Auth.

### Profile

```ts
User {
  id
  email
  display_name
  avatar_url
  created_at
}
```

---

# 📚 Library

Users can upload:

- EPUB
- PDF

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
  last_opened_at
  created_at
}
```

### Storage

Files:

- EPUB
- PDF
- Covers

Saved in Cloudflare R2.

Metadata saved in PostgreSQL.

---

# 📖 Reader

Core reading experience.

## EPUB

Use:

- react-native-epubjs

## PDF

Use:

- react-native-pdf

## Features

- open instantly
- resume last page
- chapter navigation
- reading progress
- search text
- bookmarks

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

Supabase syncs:

- book metadata
- progress
- highlights
- notes

Cloudflare stores files.

## Upload flow

```txt
App → request signed upload URL
Railway → Cloudflare R2
Upload file
Save metadata in Supabase
```

## Read flow

```txt
App → fetch metadata
App → signed R2 URL
Open book
Save progress
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

## Supabase

RLS enabled.

Users only access:

- their books
- their notes
- their highlights

## Cloudflare

Private bucket.

Access with signed URLs.

---

# 📱 MVP Screens

## Auth

- sign in
- sign up
- forgot password

## Library

- recent books
- search
- uploaded books

## Upload

- choose EPUB/PDF
- upload progress

## Reader

- reading view
- chapter list
- bookmarks
- progress

## Highlight modal

- save highlight
- add note

## Notes

- list notes
- edit
- delete

## Profile

- logout
- account settings

---

# 🚀 MVP Roadmap

## Phase 1

- authentication
- upload books
- library
- reader

## Phase 2

- highlights
- notes
- syncing

## Phase 3

- search
- recent books
- UI polish

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