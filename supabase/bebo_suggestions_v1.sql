-- Applied 2026-10-10 to the dedicated Bebo Supabase project.
-- Reusable migration record, not meant to be rerun on an already configured project.
-- Creates a private owner-review suggestion inbox with row-level access.
CREATE TABLE IF NOT EXISTS public.bebo_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('feature','bug','design','accessibility','other')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 8 AND 110),
  details text NOT NULL CHECK (char_length(btrim(details)) BETWEEN 20 AND 2000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','planned','in_progress','done','declined')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  admin_note text NOT NULL DEFAULT '' CHECK (char_length(admin_note) <= 1200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bebo_suggestions_author_recent_idx
 ON public.bebo_suggestions (author_id,created_at DESC);
CREATE INDEX IF NOT EXISTS bebo_suggestions_status_recent_idx
 ON public.bebo_suggestions (status,created_at DESC);
ALTER TABLE public.bebo_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bebo_suggestions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.bebo_suggestions TO authenticated;
DROP POLICY IF EXISTS "member reads own suggestions or owner reads all" ON public.bebo_suggestions;
CREATE POLICY "member reads own suggestions or owner reads all"
 ON public.bebo_suggestions FOR SELECT TO authenticated
 USING (author_id = (SELECT auth.uid()) OR (SELECT bebo_private.is_bebo_owner()));
DROP POLICY IF EXISTS "member can submit new suggestion" ON public.bebo_suggestions;
CREATE POLICY "member can submit new suggestion"
 ON public.bebo_suggestions FOR INSERT TO authenticated
 WITH CHECK (author_id=(SELECT auth.uid()) AND status='new'
 AND priority='normal' AND admin_note='');
DROP POLICY IF EXISTS "only owner reviews suggestions" ON public.bebo_suggestions;
CREATE POLICY "only owner reviews suggestions"
 ON public.bebo_suggestions FOR UPDATE TO authenticated
 USING ((SELECT bebo_private.is_bebo_owner()))
 WITH CHECK ((SELECT bebo_private.is_bebo_owner()));
CREATE OR REPLACE FUNCTION public.bebo_suggestion_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $body$
DECLARE recent_count integer;
DECLARE latest timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.author_id::text));
    SELECT count(*),max(created_at) INTO recent_count,latest
      FROM public.bebo_suggestions
      WHERE author_id=NEW.author_id AND created_at>pg_catalog.now()-interval '24 hours';
    IF recent_count>=5 THEN
      RAISE EXCEPTION 'You have reached the five suggestions per day limit.';
    END IF;
    IF latest IS NOT NULL AND latest>pg_catalog.now()-interval '60 seconds' THEN
      RAISE EXCEPTION 'Please wait one minute before sending another suggestion.';
    END IF;
    NEW.created_at=pg_catalog.now();
    NEW.updated_at=NEW.created_at;
    NEW.status='new';
    NEW.priority='normal';
    NEW.admin_note='';
  ELSE
    IF NEW.author_id IS DISTINCT FROM OLD.author_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.details IS DISTINCT FROM OLD.details
      OR NEW.category IS DISTINCT FROM OLD.category
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Submitted suggestions cannot be rewritten.';
    END IF;
    NEW.updated_at=pg_catalog.now();
  END IF;
  RETURN NEW;
END;
$body$;
DROP TRIGGER IF EXISTS bebo_suggestion_integrity_trigger ON public.bebo_suggestions;
CREATE TRIGGER bebo_suggestion_integrity_trigger
 BEFORE INSERT OR UPDATE ON public.bebo_suggestions
 FOR EACH ROW EXECUTE FUNCTION public.bebo_suggestion_integrity();
