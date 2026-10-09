# Bebo ♥ — nostalgia-style social website

**GitHub Pages:** https://frymastercheese.github.io/Bebo/

Bebo is an **independent, unofficial** project inspired by social-profile websites of the 2000s. Not affiliated with the original Bebo business. The "Bebo" name and visual branding may have trademark implications: obtain the relevant rights before marketing it as the original service.

## What's built

- **Real-user frontend**: email sign-up and login, profiles, avatar upload, searchable-by-navigation members list, friend requests/accept/decline, public profile walls, post deletion and abuse-report submissions, preset skins, colour skin maker and community skin gallery.
- **Secure backend database schema** in `supabase/schema.sql`, including row-level security (RLS), foreign-key constraints and user-scoped image-storage permissions.
- **Classic interactive prototype** preserved separately at `classic.html` (local browser-only version).

## Current deployment state

**The frontend is deployed, but live account sign-up is disabled until a dedicated Supabase project is connected.** The homepage intentionally shows a setup notice until then. This avoids directing people to a fake account flow or putting user information in the wrong database.

## One-time backend setup

1. Create a **new, dedicated Supabase project** called `Bebo` in your chosen organization (do NOT use or alter the existing play-to-earn database).
2. In the Bebo project SQL editor, run `supabase/schema.sql` once. The script creates Bebo-prefixed social tables, policies and an avatar storage bucket.
3. In Supabase Authentication, leave email verification enabled, configure the SMTP provider for production email delivery, and set **Site URL** to `https://frymastercheese.github.io/Bebo/`; add that address to **Redirect URLs**.
4. Edit `config.js` with only your new Supabase project API URL and **public publishable key** (normally `sb_publishable_...`). Never put a `service_role` key, secret key, password, or database connection string in any public GitHub file.
5. Confirm registration → email verification → sign in → create profile → add friend → post comment → save skin → upload avatar across two separate user accounts. Review database security advisors and test unauthorized modifications before welcoming users.

## Safety & launch requirements

This is a **working social website codebase**, **not yet a production-ready public community**. Before announcing a public launch, implement account self-deletion, admin moderation tools for `bebo_reports`, blocking/muting, content takedown, spam/rate limits and bot protection, user privacy and safety policies, age-appropriate safeguards, image moderation, secure email delivery, and backup/restore. GitHub Pages hosts only the static frontend; Supabase handles the multi-user data.

The `bebo_reports` table is deliberately write-only for ordinary members. Build a secure administrator dashboard in a trusted server context before relying on reports for safety.

## Files

- `index.html` — real-account website, responsive UI
- `social.js` — browser frontend and Supabase API operations
- `config.js` — public backend URL and publishable key (unconfigured)
- `supabase/schema.sql` — social database, RLS and avatar bucket
- `classic.html` — preserved 2007-like demo
