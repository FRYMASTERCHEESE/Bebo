# Bebo Classic ❤️

**Unofficial fan-made Bebo-inspired website** — a nostalgic 2006–2008-style profile experience. This is not the original Bebo service, is not affiliated with its owners, and does not recover historical Bebo accounts or content.

## Live website

**https://frymastercheese.github.io/Bebo/**

This is a static demo hosted with GitHub Pages. It works on desktop and mobile.

## What's included

- 2000s-era red masthead and blue navigation, with two-column profile pages.
- Eight interchangeable skins plus a custom skin creator with colours and image banners.
- Editable profile, picture, status, bio, Other Half, location and music field.
- Top 16 demo friends and a local Luv counter.
- Wall comments, photos, blog entries, polls, quizzes and a mouse/touch whiteboard.
- Browser-local saving so your changes remain on the *same device and browser*.

## Important limitations

**This is a local interactive preview, NOT yet a working multi-user social network.** There is no real sign-up or login, user accounts, real friend requests, messaging, remote photo storage, public profile persistence or cross-device synchronization. Sample profiles/comments are fictional. Everything the visitor edits is stored in that browser's local storage and can be lost if site data is cleared. Do not treat it as a secure storage service.

## Make it a real public social network

1. Add hosted authentication (for example Supabase Auth) and per-user database rules.
2. Add profiles, friend requests, comments, photos, skins, messages and content storage.
3. Add spam protection, reports, user blocking, content moderation, privacy, data deletion/export, and age-appropriate safeguards.
4. Choose an original brand identity or obtain any necessary rights before public commercial branding as Bebo.

## Deployment

This repository uses a standalone `index.html` containing the CSS and JavaScript. GitHub Pages serves from the `main` branch repository root, so no build pipeline is required. To publish, open **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**.

## Development

Open `index.html` directly in a modern browser. All functionality is client-side and designed for static hosting.
