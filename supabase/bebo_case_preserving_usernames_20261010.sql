-- Applied to the live Bebo Supabase project on 2026-10-10.
-- Preserve case in @usernames, while preventing case-insensitive duplicates.
-- Names such as Rose_red, Rose.Red and Rose-Red are now valid. Existing usernames remain unchanged.
-- Spaces in chosen usernames are converted to underscores by the frontend.
-- Display names allow arbitrary human-readable text (including emoji) up to 60 characters.
ALTER TABLE public.bebo_profiles
  DROP CONSTRAINT IF EXISTS bebo_profiles_username_check;
ALTER TABLE public.bebo_profiles
  ADD CONSTRAINT bebo_profiles_username_check
  CHECK (username ~ '^[A-Za-z0-9_.-]{3,25}$');
CREATE UNIQUE INDEX IF NOT EXISTS bebo_profiles_username_casefold_unique
  ON public.bebo_profiles (lower(username));
