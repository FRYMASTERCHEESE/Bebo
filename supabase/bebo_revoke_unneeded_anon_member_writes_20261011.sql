-- APPLIED on 11 October 2026 NZ using Supabase migration bebo_revoke_unneeded_anon_member_writes_20261011
-- Existing RLS had no anonymous INSERT/UPDATE/DELETE policies for these tables.
-- Removing redundant table grants adds least privilege without changing row data.
-- Do not blindly re-run the whole Bebo schema on production.
revoke insert, update, delete on table
  public.bebo_albums,
  public.bebo_blog_comments,
  public.bebo_blogs,
  public.bebo_creations,
  public.bebo_friendships,
  public.bebo_group_members,
  public.bebo_groups,
  public.bebo_luv,
  public.bebo_photos,
  public.bebo_poll_votes,
  public.bebo_polls,
  public.bebo_profiles,
  public.bebo_quiz_answers,
  public.bebo_quizzes,
  public.bebo_skins,
  public.bebo_top_friends,
  public.bebo_video_comments,
  public.bebo_video_reactions,
  public.bebo_video_reports,
  public.bebo_whiteboards
from anon;
