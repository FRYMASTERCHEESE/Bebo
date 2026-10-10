# Bebo ♥ — nostalgia-style social website

**GitHub Pages:** https://frymastercheese.github.io/Bebo/

Bebo is an **independent, unofficial** project inspired by social-profile websites of the 2000s. Not affiliated with the original Bebo business. The "Bebo" name and visual branding may have trademark implications: obtain the relevant rights before marketing it as the original service.

## What's built

- **Real-user frontend**: email sign-up and login, profiles, avatar upload, searchable-by-navigation members list, friend requests/accept/decline, public profile walls, post deletion and abuse-report submissions, preset skins, colour skin maker and community skin gallery.
- **Secure backend database schema** in `supabase/schema.sql`, including row-level security (RLS), foreign-key constraints and user-scoped image-storage permissions.
- **Classic interactive prototype** preserved separately at `classic.html` (local browser-only version).

## Current deployment state

**The Bebo frontend is deployed and configured with a dedicated Supabase URL and public publishable key.** On 10 October 2026 (NZ), anonymous read-only requests to `bebo_profiles`, `bebo_skins`, and `bebo_wall_posts` returned HTTP 200. The public homepage displays sign-up/login forms. **Email sign-up, email delivery, writes, friendship flows, and account security have not yet been end-to-end tested**; do not announce a full public launch until these pass.

## Backend setup and verification

1. Use the existing **dedicated Bebo Supabase project** referenced by `config.js`. Do NOT use or alter the play-to-earn database.
2. The public Bebo profile, skin and wall tables already respond to read-only requests; verify the remaining schema, RLS policies and storage bucket against `supabase/schema.sql` before attempting migrations. Never rerun unreviewed schema SQL in an existing project.
3. In Supabase Authentication, leave email verification enabled, configure the SMTP provider for production email delivery, and set **Site URL** to `https://frymastercheese.github.io/Bebo/`; add that address to **Redirect URLs**.
4. `config.js` now contains the Bebo project API URL and **public publishable key**. Never put a `service_role` key, secret key, password, or database connection string in public GitHub files.
5. Confirm registration → email verification → sign in → create profile → add friend → post comment → save skin → upload avatar across two separate user accounts. Review database security advisors and test unauthorized modifications before welcoming users.

## Safety & launch requirements

This is a **working social website codebase**, **not yet a production-ready public community**. Before announcing a public launch, implement account self-deletion, admin moderation tools for `bebo_reports`, blocking/muting, content takedown, spam/rate limits and bot protection, user privacy and safety policies, age-appropriate safeguards, image moderation, secure email delivery, and backup/restore. GitHub Pages hosts only the static frontend; Supabase handles the multi-user data.

The `bebo_reports` table is deliberately write-only for ordinary members. Build a secure administrator dashboard in a trusted server context before relying on reports for safety.

## Files

- `index.html` — real-account website, responsive UI
- `social.js` — browser frontend and Supabase API operations
- `config.js` — configured public backend URL and publishable key
- `supabase/schema.sql` — social database, RLS and avatar bucket
- `classic.html` — preserved 2007-like demo


## Classic 2000s Bebo features added (10 October 2026 NZ)

The production site's browser code now supports:
- **Top 16:** a public 16-slot grid using accepted friendships, with add/remove and up/down ranking. Changes are made atomically via `bebo_set_top_friends`.
- **Daily Luv:** a publicly visible received counter, and 3 gifts per account per UTC day, enforced transactionally in Postgres via `bebo_give_luv` (not client-side counters).
- **Whiteboard:** mouse and touch drawing saved to the profile with author attribution and removal by the author or profile owner.
- **Skins:** preset colour themes and shared community themes, optional custom photo banners uploaded to the per-user `bebo-skin-banners` storage bucket. Skins style the profile header and modules.
- **Music and Flashbox:** direct HTTPS audio file player and YouTube video ID validated for a privacy-enhanced YouTube embed. **Autoplay is not guaranteed** (modern browsers often block audible autoplay); executable Flash and arbitrary HTML skins are not supported due to security risks.
- **Quizzes and polls:** create and vote on public single-question activities; server enforces one answer per account.
- **Bebo Bands & Authors:** publish short stories and musician profiles with optional HTTPS links.
- Guest-readable public quizzes, polls and creators pages.

The SQL defining the new schema is in `supabase/nostalgia-features.sql`, and the atomic Top 16 function in `supabase/top16-rpc.sql`; **both migrations have already been applied to the existing dedicated Bebo project**. Do not reapply blindly. Client features are in `nostalgia.js` and integrated into `social.js`.

**Security:** all new public-data tables have RLS enabled. Authenticated-only privileged RPCs validate `auth.uid()`, user ownership and limits, use an empty function search path and revoke function EXECUTE from public/anonymous roles. Supabase security advisors flag the two callable SECURITY DEFINER RPCs as warnings; they are intentionally callable by logged-in users and should still be reviewed before high-traffic public launch.

**Launch readiness remains limited:** a genuine two-account registration / email verification / friend acceptance / Luv / Whiteboard / storage upload test is still required. Abuse moderation, blocking, spam protection, self-delete, and image/content review require production hardening. Do not imply affiliation with Bebo's original trademark owners just because the top-page slogan reads "Bebo Is Officially Back".

## Member safety update — 10 October 2026 (NZ)

### Implemented
- `safety.js` adds **Block / Unblock**, **Report Profile**, a blocked-members list, and **Delete My Account** controls. The website has a public **Safety & Privacy** information section.
- `supabase/member-safety.sql` adds server-enforced bidirectional block checks on wall posts, whiteboards, friendship requests and daily Luv. Blocking also severs mutual friendship / Top 16 relationships. Server-side rate limits apply to wall posts (5/min and 120/day), whiteboards (5/min and 60/day), friend requests (4/min and 30/day) and reports (10/day). These are per-user safeguards, not a full bot defence.
- `supabase/report-deletion-integrity.sql` preserves report referential integrity when a user or wall post is deleted.
- `supabase/block-privilege-hardening.sql` prevents anonymous visitors from querying the block list; authenticated users are limited to **their own blocks** via RLS.
- `supabase/moderation-admin.sql` creates a database-only moderator whitelist and adds report status fields. Ordinary members cannot read or resolve reports. There is **no web moderation dashboard deployed yet**. The site owner with Supabase project access can review reports privately in the Supabase Table Editor under `public.bebo_reports`.
- `supabase/functions/bebo-delete-account/index.ts` was deployed as Edge Function `bebo-delete-account`, with JWT verification enabled. The client requires the current password and explicit deletion phrase. The server checks a recently issued, verified user token, removes member uploads from both Bebo buckets, and requests permanent Auth user deletion so related records cascade. **The destructive flow has NOT been tested on a genuine account**.
- Sign-up now has a required **18+ self-declaration** linked to Safety & Privacy information. This checkbox is **not verified age assurance**.

### Still required before a broad public launch
1. Test two genuine accounts end-to-end: registration and email confirmation, mutual friendship, comment posting, blocking, report submission, moderation, Luv, skins, whiteboard and avatar upload.
2. Carefully test account deletion with a disposable test account after backing up anything valuable; verify images and database references disappear. Do not test against a user's real primary account.
3. Add a working administrator moderation interface, a trusted moderator assignment procedure, appeal/recovery procedures, support contact and rapid takedown process. The moderator whitelist is intentionally empty until an owner account is deliberately assigned; report review currently requires the Supabase dashboard.
4. Improve spam/bot protection, storage-content screening, backups, retention/deletion policy, jurisdiction-appropriate legal/privacy terms and meaningful safeguards if minors are ever permitted.
5. Review Supabase security advisor warnings for the intentionally authenticated `bebo_give_luv` and `bebo_set_top_friends` SECURITY DEFINER RPCs before handling high traffic. See <https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable>.

**The Bebo revival is still an independent community project.** Using the slogan “Bebo Is Officially Back” does not establish affiliation with the historical Bebo owners.

## 2006–2008 Bebo experience expansion — 10 October 2026

The modern frontend uses original (newly authored) CSS and modules to evoke Bebo's familiar profile experience without claiming rights to the historical Bebo brand or recovered accounts.

**New working code paths (signed-in writes still require real-account testing):**
- New \`classic-modules.js\`: photo **albums**, up to **96 images per album**, individual images with captions, album/photo deletion.
- Personal **blogs** with public reading, entry creation, comments and owner/author deletion.
- **Private Bebo Mail** inbox, sent items, username-based composition, message sending.
- **Other Half** request/accept/decline and prominently displayed public badge after acceptance (accepted friend required to request).
- Public **Groups** creation, joining, leaving, owner deletion.
- Signed-in **home activity dashboard** with members, recent blogs and photo albums.
- Dedicated nostalgic navigation: Home, Profile, Friends, Photos, Blog, Mail, Groups, Other Half, Skins, Polls, Quizzes, Bands & Authors, Safety.
- Refined classic-style black navigation, red masthead, framed pink modules and skinned two-column profile.

**Database and storage:**
- \`supabase/classic-modules.sql\` applied on the dedicated Bebo Supabase project, including RLS policies, a public **bebo-photos** Storage bucket restricted to user-owned upload folders, and author protections.
- \`supabase/classic-guards.sql\` enforces 96-photo limit and trusted creation timestamps server-side.
- \`supabase/classic-mail-privacy.sql\` ensures guests cannot read private messages.
- \`supabase/classic-identity-hardening.sql\` restricts Other Half identity edits and validates photo upload paths.
- \`bebo-delete-account\` Edge Function updated to version 2, including removal of member photos in addition to profile and skin images.

**Not yet a literal recreation of every historical feature.** Features such as legacy Flash scripts, original music rights, the original Bebo source code and historical member data are not provided. New public uploads remain unmoderated; new user registration, full inbox flows, account deletion and multi-user safety behaviors have **not** been verified using two genuine accounts. Do not represent the service as an authorised relaunch of the original Bebo company.


## 56-skin Classic Bebo Gallery — 10 October 2026

The live Skins page has **56 original, 2000s-inspired CSS designs** in seven categories (Classic, Glitter & Girly, Emo & Scene, Love & Hearts, Summer & Nature, Music & Retro, Dark & Gothic). Every design has a distinct colour palette, mini profile preview, banner decoration, and a responsive Skin Gallery with instant search/filter and a larger selectable preview. Browsing works without signing in; saving a preset requires an authenticated profile. The original eight skin IDs remain valid.

- `skin-library.js` contains the full static safe preset catalog and procedural art styles. No third-party images, scripts, copyrighted artwork, Flash or arbitrary user HTML are embedded.
- `social.js` uses that catalog for both the gallery and saved public profile designs; selecting a skin updates `bebo_profiles.skin` after checking the ID exists.
- `index.html` contains the matching retro profile/gallery CSS with mobile layout and styled module panels.
- `supabase/skin-presets-56.sql` records the new allowed-value CHECK constraint, already applied to the **dedicated Bebo Supabase project**.

These are newly created skins **inspired by the original era**, not original Bebo-owned graphical assets or a pixel-for-pixel reproduction. The existing custom-colour and member-uploaded banner options remain available. Signed-in saving still needs an end-to-end test with a real member account.

## Fix confirmation redirect to localhost:3000 — Bebo production Auth setup

If registration delivers a confirmation email but its link opens `http://localhost:3000` on a phone, **Supabase Auth is redirecting to an old development URL**. Confirming the email can still succeed on the Supabase backend even when the final redirect fails.

For the dedicated Bebo project, in [Supabase Authentication → URL Configuration](https://supabase.com/dashboard/project/rnxiggzyqqzjtgdbpedb/auth/url-configuration):

- Set **Site URL** to exactly `https://frymastercheese.github.io/Bebo/`.
- Under **Redirect URLs**, add `https://frymastercheese.github.io/Bebo/` (exact URL, no wildcard). An optional `https://frymastercheese.github.io/Bebo/**` entry can cover paths if ever needed; prefer the exact URL for production.
- Save. Remove `http://localhost:3000` entries if this project is not used for local development, to avoid accidentally accepting dev redirects.

`social.js` explicitly sets `emailRedirectTo` and password-reset `redirectTo` to the production URL. **However, the Supabase Auth dashboard's Site URL and allowed redirect list must ALSO be configured**; the available Supabase connector currently cannot change those settings.

Do not ask users to paste confirmation links, verification tokens or passwords into chat. If their email is already verified, they can return to Bebo and log in directly; there is no need to register again.

## Bebo Owner Control Centre — October 2026

The private **#/admin** dashboard now provides six owner-only sections on top of the existing reviewable Reports panel:

- **Members:** Search by Bebo username, issue warnings, suspend posting or restore access. Affected members see their private moderation status and reason when they sign in.
- **Analytics:** Counts of profiles, wall comments, blogs, photos, skins and friendships over their stated windows. These are database activity counts, **not visitor tracking or verified monthly active users**.
- **Announcements:** Create drafts, publish/unpublish and remove updates. The latest published announcement displays in a separate banner above public pages when the announcement setting is enabled.
- **Community skins:** Hide and restore member-made skins in the public gallery. This does not automatically strip already-applied skins or remove files.
- **Moderation:** Inspect restricted members, dated owner actions, and existing reports. Report/comment moderation is handled by the previously deployed secure report panel.
- **Website settings:** Owner-only toggles for accepting new wall posts, new custom-skin submissions, new groups, and display of published announcements. Existing content is never deleted by toggling a switch.

Implementation: `admin-advanced.js`, existing `admin.js`, `social.js` (announcement strip and member notices) and `index.html` (responsive UI). The applied migrations are in `supabase/bebo_owner_six_admin_sections_v1.sql` and `supabase/bebo_public_guest_read_role_isolation_v1.sql`. The dedicated database enforces admin rights using verified Supabase Auth identity with a private moderator whitelist. Row-level security, trigger-enforced publishing controls, audit trails and anti-suspension bypass guards are installed; the browser has **no** service-role key. Owner role was assigned to the previously verified member, **not** to whoever types an admin email in the frontend.

Safety limitations: Suspended accounts retain sign-in and public-read ability; their attempts to create/update social records are rejected server-side. The feature switches intentionally do not block registration or private content already stored. Admin actions and two-user account restrictions need supervised end-to-end testing before launching to a wider public audience. Supabase security advisors still warn about the two legacy authenticated SECURITY DEFINER functions and disabled leaked-password protection; these pre-existing issues should be reviewed separately.

## Bebo Videos V1 — 10 October 2026

- **Dedicated real video storage:** Private Supabase bucket `bebo-videos` in the dedicated Bebo project, not simulated browser-local files. Only signed-in members with profiles can upload.
- **Pilot limits:** MP4 or WebM up to **25 MiB** (storage-enforced), with **60-second browser duration checks**, at most **3 video records per member**, **2 new records per hour**, and **20 across the pilot** to protect free storage capacity. The backend cannot independently verify true video duration without server-side transcoding/inspection; do not describe the 60-second limit as server-enforced.
- **Moderation before public playback:** Metadata is created as `pending`; uploads are not shown publicly until a pre-existing authenticated owner/moderator approves through `#/videos-review`. Private signed video URLs expire after 10 minutes.
- **Social features:** Public videos feed, member galleries, mobile native playback, hearts, comments, abuse reporting, member deletion and moderator hide/review controls. Member contributions are escaped before HTML rendering.
- **Member account deletion:** The already-deployed `bebo-delete-account` Edge Function **v3** now purges the video bucket alongside avatars, banners and photos before account removal.
- **Database protection:** Four new RLS-enabled tables (`bebo_videos`, `bebo_video_comments`, `bebo_video_reactions`, `bebo_video_reports`). Rate-limit triggers, owner-folder matching storage policies, immutable video owner/path, and private-until-approved review. Applied migrations are captured in `supabase/bebo_videos_v1.sql`.
- **Testing:** `tests/videos-smoke.mjs` uses only synthetic data, and browser smoke includes Videos and profile video routes on mobile/desktop.

**Before broad launch:** Test at least one disposable registered member uploading and deleting an actual MP4, a different owner account approving the upload, public/guest playback, comments/hearts, reports and moderation. Review storage usage and abuse response. Uploads do not currently transcode or scan video content and are not a guarantee of free unlimited hosting.
