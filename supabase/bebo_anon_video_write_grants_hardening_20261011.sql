-- Applied to the existing Bebo Supabase production project on 11 October 2026 NZ.
-- This is a provenance copy of the successful additive permissions hardening.
-- Do not blindly replay migration bundles on production.
-- Public video feed remains readable only according to its approved-only RLS policy.
-- Members retain authenticated video upload; moderators retain authorized update via RLS.
revoke insert, update, delete on table public.bebo_videos from anon;
