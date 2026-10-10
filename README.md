# Bebo ♥ — nostalgia-style social website

**Production custom domain:** https://bebo.nz/ (hosted on GitHub Pages; previous address https://frymastercheese.github.io/Bebo/).

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
3. In Supabase Authentication, leave email verification enabled, configure the SMTP provider for production email delivery, and set **Site URL** to `https://bebo.nz/`; allow both `https://bebo.nz/` and the previous `https://frymastercheese.github.io/Bebo/` under **Redirect URLs** during the transition.
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

- Set **Site URL** to exactly `https://bebo.nz/`.
- Under **Redirect URLs**, add `https://bebo.nz/` (exact URL). Temporarily keep `https://frymastercheese.github.io/Bebo/` so old email links are not unnecessarily rejected. No wildcards are required.
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
- **Pilot limits:** MP4 or WebM up to **40 MiB (~41.9 MB)** (storage and database enforced), with **60-second browser duration checks**, at most **3 video records per member**, **2 new records per hour**, and **15 across the pilot** to protect free storage capacity. The backend cannot independently verify true video duration without server-side transcoding/inspection; do not describe the 60-second limit as server-enforced.
- **Moderation before public playback:** Metadata is created as `pending`; uploads are not shown publicly until a pre-existing authenticated owner/moderator approves through `#/videos-review`. Private signed video URLs expire after 10 minutes.
- **Social features:** Public videos feed, member galleries, mobile native playback, hearts, comments, abuse reporting, member deletion and moderator hide/review controls. Member contributions are escaped before HTML rendering.
- **Member account deletion:** The already-deployed `bebo-delete-account` Edge Function **v3** now purges the video bucket alongside avatars, banners and photos before account removal.
- **Database protection:** Four new RLS-enabled tables (`bebo_videos`, `bebo_video_comments`, `bebo_video_reactions`, `bebo_video_reports`). Rate-limit triggers, owner-folder matching storage policies, immutable video owner/path, and private-until-approved review. Applied migrations are captured in `supabase/bebo_videos_v1.sql`.
- **Testing:** `tests/videos-smoke.mjs` uses only synthetic data, and browser smoke includes Videos and profile video routes on mobile/desktop.

**Before broad launch:** Test at least one disposable registered member uploading and deleting an actual MP4, a different owner account approving the upload, public/guest playback, comments/hearts, reports and moderation. Review storage usage and abuse response. Uploads do not currently transcode or scan video content and are not a guarantee of free unlimited hosting.

## Bebo phone video upload compatibility — 10 October 2026

The first real Android video reported **35,507,185 bytes (35.5 MB), 10.944 seconds**, in MP4 with HEVC video, which exceeded the old 25 MiB pilot cap. The error did not mean the file was corrupt. The live `bebo-videos` storage bucket and `bebo_videos` constraint were safely raised to **40 MiB** and the global pilot cap reduced to **15 video records** (~600 MiB maximum at the upload limit). The deployed schema change is recorded in `supabase/bebo_video_mobile_upload_40mib_v2.sql`.

The Videos upload interface now displays the selected video's size before submitting, gives a clear file-size message for clips over the limit, and accepts `.mp4`/`.webm` file extensions from Android when the browser reports an empty or generic MIME type. It does not silently override a known nonvideo MIME type. The upload stays private until an owner/moderator approves it.

Important: Some browsers cannot play **HEVC/H.265 MP4** even when the upload itself succeeds. For broader playback compatibility, use H.264/AAC MP4; high-resolution phone footage may be compressed before upload. Supabase's global file limit must also be at least 40 MiB (the Free plan allows up to 50 MB); a project-specific lower global setting would still block larger files. Real authenticated upload and playback remain to be verified separately.


## Organic Bebo video stats and home ranking — 10 October 2026

**What is measured:** Live video cards show counted member views, unique signed-in viewers, hearts, comments and interactions per counted view. The private creator page \`#/videos-insights\` shows per-video metrics and totals (including last-seven-day member views). The new homepage contains actual playable approved videos ranked using organic signals, plus a community spotlight for recent public wall comments, blogs and polls. This is **not** artificial view generation or a guarantee of visibility.

**Measurement rule:** A video view is recorded only when a signed-in member plays an approved Bebo video long enough for the client to estimate a meaningful watch (at least 3 seconds, typically half of short clips, capped at 10 seconds). Refreshing or replaying on the same UTC date does not add another counted view for that member/video. Signed-out guests and historical plays are **not** counted. The browser's watch-duration signal is not cryptographically verifiable; the database can enforce actor identity and daily deduplication, but cannot prove attention or stop coordinated fake accounts.

**Privacy:** Individual viewer identities are stored solely in the private, RLS-protected \`bebo_video_view_events\` table with no direct client SELECT/INSERT grants. Aggregate counts are exposed by \`public.bebo_video_stats(uuid[])\` (approved videos or the uploader's own video). Client-side playback submits an authenticated \`public.bebo_record_video_view(uuid,numeric)\` request. Deletion of videos/accounts cascades associated event records. The new deployed migrations are tracked in \`supabase/bebo_video_organic_analytics_v1.sql\`.

**Ranking formula for approved videos (visible on the home page):** \`2 × member views in the last 7 UTC days + 4 × hearts + 6 × comments + freshness\` where freshness decreases linearly from 7 to 0 over a week. The ranking recomputes from database totals; nothing is guaranteed to go viral. Hearts/comments are lifetime totals and are subject to Bebo's normal RLS and comment rate limits.

**Community spotlight:** Recently published public blogs, polls and wall comments are included. Blogs receive 5 points for each observed recent comment, polls receive 3 per recent vote, and all content gets a small, seven-day freshness boost. Wall comments rank by recency only, since they do not yet have separate reactions/views. To keep reads bounded, the home page samples the most recent 400 blog comments and 400 poll votes; counts explicitly say **recent** rather than claiming full historical totals.

**Owner validation still needed:** Open Bebo as a second, real signed-in member, play an approved video for five or more seconds, then refresh the video card and creator insights to verify the event recorded. Verify guest plays don't increment tracked member views and the same member can't increment it twice in a day. No live accounts or view counts are fabricated by the automated tests.

## Bebo Skin Studio — 10 October 2026

The 56 original built-in skins remain compatible. The authenticated Skin Studio now adds original member-designed skins with custom primary, secondary and accent colours, profile panel placement, optional gentle animation (respects reduced motion), optional custom header and full-page background photo, a real-time design preview, draggable photo placement plus mobile-friendly layout selection, private drafts, publication, member-only edit/delete, and safe JSON import/export.

Design JSON never contains storage file paths, image bytes, private account IDs, or executable HTML/CSS/JS. Re-upload your own image after importing. Uploaded images still use the per-member `bebo-skin-banners` storage bucket and the 5 MiB PNG/JPG/WebP limit. Hiding a shared design removes it from the gallery but does not undo the design already applied to profiles. Deleting a shared design does not delete previously applied profile images; orphan image cleanup remains an administrative storage task.

Database: `bebo_skin_studio_profiles_drafts_and_gallery_v1` and `bebo_skin_studio_background_pattern_correction_v1` were applied to the dedicated Bebo Supabase project. Drafts are visible only to their author or the site owner. Member edits and deletes are scoped by RLS; a trigger blocks non-admin members from reversing moderator hidden status or transferring skin authorship.

Read-only CI tests confirm design JSON/HTML security and the guest gallery; actual signed-in save, image upload, profile appearance and delete workflows still require testing with two genuine disposable accounts before production-level completion can be claimed.

## Member Suggestions → Private Owner Admin Inbox — 10 October 2026

The main menu and footer now link to `#/suggestions`. A signed-in Bebo member with a profile can submit a category (new feature, bug, design, accessibility, other), title and detailed suggestion. It is saved to `public.bebo_suggestions` for the owner-only `👑 Owner Control Centre → 💡 Suggestions` tab. That tab shows the **new suggestion count**, member profile, status and priority, with a private response field and status filters. Members can check their own suggestions and responses on the same page. Guests see the information page and a sign-in prompt but cannot submit feedback.

Backend: migration `bebo_private_member_suggestions_admin_inbox_v1` applied to the dedicated Bebo Supabase project. Table has owner-only UPDATE, authenticated-author-only INSERT, owner-or-author SELECT, no anonymous grants, noneditable submitted content, 5 submissions per 24h and 60-second spacing enforced in a DB trigger. No third-party email inbox, service role key or notification service needed. Account deletion cascades suggestions to protect deleted members. Owner-review response is available only to the submitter and the owner.

Automated browser testing exercises guest form privacy and navigation; synthetic mock account tests check member submissions, escaping and owner review. A genuine two-account end-to-end submission and owner status update should still be performed before declaring live production acceptance.

## Bebo custom-domain auth migration — 10 October 2026

Production URL is now **https://bebo.nz/**. Porkbun apex A records target the four official GitHub Pages IPv4 addresses, and the `www` CNAME targets `frymastercheese.github.io`. GitHub Pages custom domain is `bebo.nz` (see CNAME). Never add a second hosting plan to move the site; Supabase remains the data backend.

The browser's Supabase confirmation and password-reset redirects now use `https://bebo.nz/`; the guest and authenticated reset-password page only allows setting a new password after Supabase raises a genuine `PASSWORD_RECOVERY` event. On success the user is signed out and asked to log in with the new password. No password or recovery token is sent to the server beyond Supabase Auth.

**Owner action in Supabase Auth > URL Configuration:** Verify Site URL is saved as `https://bebo.nz/`; Redirect URLs includes `https://bebo.nz/` and (temporarily) `https://frymastercheese.github.io/Bebo/`. Existing member identities, admin roles, skins and content remain stored in the same Supabase project. Browser sessions stored on the old hostname are not automatically transferred to the new hostname: members can sign in again. End-to-end verification with a genuine disposable account is still required before claiming live signup and recovery have been tested.

## Bebo Show/Hide Password fields — 10 October 2026

All password fields default to hidden with an adjacent **👁 Show password** / **🙈 Hide password** button: registration, sign-in, password recovery (both new and confirmation fields), and account-deletion confirmation. Each button toggles only its adjacent input, does not submit a form, keeps the typed value unchanged, uses a 44px minimum tap target, supports the keyboard, and exposes its active state with `aria-pressed`. Password visibility is deliberately temporary and is not saved between screens. Browser tests cover signed-out registration/login and synthetic recovery callbacks; account deletion is unchanged and never invoked by tests.

## Back / Home footer relocation — 10 October 2026

On user feedback from mobile screenshots, the globally fixed Back / Home box was moved **inside the page footer**, outside the content overlay. This preserves the existing safe in-site Back handling and Home shortcut without covering sign-up buttons, photos, text or profile modules. Navigation remains accessible via the normal top menu; the two footer controls remain touch-friendly and keyboard-accessible. Public mobile and desktop browser smoke checks require footer-only, non-fixed positioning and confirm no overlap or horizontal overflow. No backend or member data was modified.

## Guest top Sign In / Sign Up — 11 October 2026

For signed-out visitors, a compact nonfloating Sign In / Sign Up bar appears under the masthead, above the main menu, in both 2005 and 2007 skins. Each button opens its own login (`#/signin`) or registration (`#/signup`) form. The original combined `#/account` page is preserved. The bar remains hidden until Supabase auth resolves and hides when signed in or validating a recovery link. Mobile/desktop checks cover top positioning, correct forms, no horizontal overflow and authenticated recovery visibility. No backend changes.

## Top Log Out control — 11 October 2026

The account strip directly beneath the masthead now switches after Supabase resolves authentication: guest visitors see Sign In and Sign Up, while authenticated visitors (including the owner/admin) instead see a clearly labelled **↪ Log Out** button above the main navigation on both mobile and desktop. Logging out invokes existing Supabase `auth.signOut()`, checks for errors, clears member and admin state, returns to Home and restores Sign In / Sign Up. Neither control is shown while session detection or recovery verification is in progress. No accounts or content are modified. CI checks visibility and logout using an intercepted synthetic session rather than a real member account.

## Post-announcement first-visit improvements — 11 October 2026 NZ

With the Bebo.nz link already announced, the homepage and member experience are kept live. A new **♥ Start Here** entry in top navigation opens a static, data-read-only, mobile-friendly first-visit guide (`#/start`) for guests and signed-in members. It explains sign-up and email confirmation, profile creation, 2005/2007 styles, skins, finding friends, password recovery, suggestions and safety/reporting. It plainly says old Bebo accounts/data are not restored and the service is independently run and 18+ during early testing. Home shortcuts expose the guide in both themes. The guide makes no new network requests and does not alter member records.

**Risk priority (Supabase security advisors checked on 11 Oct):** Supabase is healthy and tables have RLS, but Auth leaked-password protection is off and a publicly callable `SECURITY DEFINER` aggregate stats RPC is flagged. The video stats RPC is deliberately allowed for public approved-video counts but needs a security review before scaling; do not revoke the endpoint without checking homepage analytics. Enable Auth leaked-password protection through Supabase dashboard (requires owner action), confirm production SMTP/quota, backups and admin moderation response, test two genuine member accounts and account deletion on a disposable test account. No database permissions were modified by this frontend update.
