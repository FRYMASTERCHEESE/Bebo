# Bebo.nz — operating and launch-readiness checklist

This independent fan-made social community is **already publicly announced**. Keep the site running. Do not wipe user accounts, rerun schema.sql, rotate auth signing keys, or change custom DNS while carrying out this checklist.

## Verified on 11 October 2026 (NZ)

- GitHub Pages serves `https://bebo.nz/`, with HTTPS, automated browser tests and an independent project disclaimer.
- The Supabase project `rnxiggzyqqzjtgdbpedb` reports `ACTIVE_HEALTHY`; relevant public and private member tables use RLS.
- Database inspection confirmed private mail, member reports, member controls, moderator assignments and admin actions are **not selectable by the `anon` role at table-grant level**. This is only an anonymous-role review, not a full multi-user penetration test.
- **Applied and verified:** Removed unnecessary `anon` INSERT/UPDATE/DELETE table grants on `public.bebo_videos`; preserved anonymous public SELECT and signed-in INSERT/UPDATE. No rows or videos were altered.
- **Further least-privilege migration applied and verified:** Removed redundant `anon` INSERT/UPDATE/DELETE table grants from twenty other social tables (including profiles, friendships, mail-adjacent social content, blogs, albums, Luv, skins, quiz/poll interactions and video comments/reactions/reports). The verification query returned **0 of 35 Bebo tables with any anonymous write grant**, while signed-in member table grants remain available. The existing RLS policies already blocked anonymous writes. No rows or content were changed.
- Anonymous public video statistics RPC `bebo_video_stats(uuid[])` is `SECURITY DEFINER`, but its returned fields are aggregated; its selection includes only approved videos or the caller's own. It is intentionally public for video viewing stats; do **not** revoke it blindly. Review input and abuse limits before significant traffic.
- Bebo's view-events table intentionally has RLS enabled **with no direct read policies** and no anon/authenticated SELECT grants: it is accessed through a constrained aggregate function. Do not add a public policy merely to clear an informational advisor.
- GitHub Actions `Bebo Daily Site and Privacy Watch` checks HTTPS pages and anonymous access to private tables with no member login and no writes. The workflow provides monitoring evidence, **not** automated repairs or a guaranteed notification delivery mechanism.

## Free-tier backup limitation

The connected Supabase organization currently reports **Free** plan. Supabase documents that accessible scheduled daily backups are a paid-plan capability; Free users should export encrypted backups separately. **No off-site database or uploaded-file backup was created during this audit.** This is a real remaining blocker to a fully recoverable production launch.

## Owner-only security action still required

Supabase Security Advisor reported **Leaked Password Protection Disabled**. The current connected Supabase management actions do not expose Auth password-security settings.

Visit [Bebo Supabase Auth password security](https://supabase.com/dashboard/project/rnxiggzyqqzjtgdbpedb/auth/providers?provider=Email) and enable leaked-password screening if offered on your plan. Verify password minimum length is >=8 and keep email confirmation enabled. Do not enter or share a real password in chat. After changing, rerun Supabase Security Advisor and review the result.

## Data backups and recovery: *not yet verified*

Supabase's [database backup guide](https://supabase.com/docs/guides/platform/backups) says paid Pro/Team/Enterprise plans have accessible daily backups and Free tier operators should make protected off-site exports. Database backups **do not include Storage file objects**: you need a plan for images and uploaded videos as well.

- [ ] Confirm Supabase project plan and open **Database > Backups**. Record the latest available backup date. Do not claim a recoverable backup without seeing one.
- [ ] Arrange encrypted, access-restricted, **off-GitHub-public-repo** database exports as supported by your plan. Include Auth and storage-object export/recovery requirements; never upload member emails, messages, passwords or backups to the public GitHub repo.
- [ ] In a separate disposable project, practice restoring a backup; do not restore over the live Bebo database.
- [ ] Record how to reach the site owner if a moderation issue, security alert or outage occurs. Enable GitHub Actions failure notifications for the production watch.
- [ ] Check quotas/limits and SMTP deliverability as signup volumes rise; pause marketing if critical authentication or privacy failures occur.

## Real two-account testing still required

Use **two consenting disposable accounts with separate email inboxes**, not existing members or the owner account. Verify registration -> email confirmation -> sign-in -> profile creation -> friend request and acceptance -> Luv and Top 16 -> comments -> messaging privacy -> album upload and visibility -> block/report -> owner moderation review -> password recovery -> logout. Test video upload using a small rights-cleared test clip and verify review is required before public playback.

Never paste private reset URLs, email confirmation tokens, session tokens or passwords into chat. When test data must be deleted, verify ownership and the specific account before performing account deletion. Deleting a real member or the owner account is **not** authorized merely to prove the feature works.

## Moderation and legal operation

- [ ] Confirm reports from an ordinary test account reach the owner-only Admin Panel and that moderators can mark them reviewed without exposing private data.
- [ ] Define rules for takedown time, appeals, harassment, and copyright complaints, and make a public support channel available before inviting large numbers of strangers.
- [ ] Verify your 18+ rule complies with applicable laws; a checkbox is not proof of age.
- [ ] Have a qualified NZ professional review privacy terms, personal-data handling, brand/trademark permissions and the statement **"Bebo Is Officially Back"**. Buying `bebo.nz` is not proof of trademark ownership or authorization from original Bebo owners.
- [ ] Check bot/rate limits and file moderation before increasing traffic. A clean browser test suite does not certify capacity for thousands of people.

## Current release verdict

**Public beta / soft launch, not independently certified 100% production ready.** Automated tests and anonymous privacy checks cover known paths only; outstanding real-user, backup-restore, owner-only Auth and legal items should be tracked separately. Protect continuity: deploy incremental reviewed changes and never erase real member content to make test counters green.
