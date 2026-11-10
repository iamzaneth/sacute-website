-- PROPOSED, manually reviewed migration after 001 + 002. No production execution.
-- Additive lifecycle metadata. No content/media deletion, reimport or write enable.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
UPDATE public.admin_cms_settings SET writes_enabled=false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS deleted_by uuid;
-- Nullable for existing rows: do not invent or rewrite historical update times.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.posts ALTER COLUMN updated_at SET DEFAULT statement_timestamp();
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS lifecycle_revision uuid NOT NULL DEFAULT gen_random_uuid();
-- NULL denotes legacy provenance. Existing date metadata is treated as historical.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS publication_recorded boolean;
ALTER TABLE public.posts ALTER COLUMN publication_recorded SET DEFAULT false;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND ((column_name IN ('deleted_at','updated_at') AND udt_name<>'timestamptz') OR (column_name IN ('deleted_by','lifecycle_revision') AND udt_name<>'uuid') OR (column_name='publication_recorded' AND udt_name<>'bool'))) THEN
  RAISE EXCEPTION 'Lifecycle column types differ from proposal; owner review required';
 END IF;
 IF EXISTS(SELECT 1 FROM public.posts WHERE lifecycle_revision IS NULL) THEN RAISE EXCEPTION 'Existing lifecycle revisions are null; owner review required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.posts'::regclass AND c.conname='sacute_posts_deleted_by_fkey') THEN
  ALTER TABLE public.posts ADD CONSTRAINT sacute_posts_deleted_by_fkey FOREIGN KEY(deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS sacute_lifecycle_slug_guard ON public.posts(slug);
CREATE INDEX IF NOT EXISTS sacute_media_reference_lookup ON public.post_media(bucket,storage_path,post_id);
CREATE INDEX IF NOT EXISTS sacute_posts_live_visibility ON public.posts(status,visible_from,id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sacute_posts_trash ON public.posts(deleted_at DESC,id) WHERE deleted_at IS NOT NULL;
GRANT SELECT(deleted_at) ON public.posts TO anon,authenticated;
GRANT SELECT(deleted_by,updated_at,lifecycle_revision,publication_recorded) ON public.posts TO authenticated;

CREATE OR REPLACE FUNCTION public.sacute_content_time()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT statement_timestamp(); $$;
REVOKE ALL ON FUNCTION public.sacute_content_time() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sacute_content_time() TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.sacute_lifecycle_state(p_status text,p_deleted timestamptz,p_visible timestamptz,p_now timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN p_deleted IS NOT NULL THEN 'trashed' WHEN p_status='published' AND p_visible>p_now THEN 'scheduled' ELSE p_status END;
$$;
REVOKE ALL ON FUNCTION public.sacute_lifecycle_state(text,timestamptz,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sacute_lifecycle_state(text,timestamptz,timestamptz,timestamptz) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.sacute_schedule_instant(p_local text,p_timezone text)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_local timestamp; v_at timestamptz;
BEGIN
 IF p_timezone IS NULL OR p_timezone NOT IN ('Asia/Ho_Chi_Minh','UTC') OR p_local IS NULL OR p_local !~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Invalid scheduling fields' USING ERRCODE='22023'; END IF;
 BEGIN v_local:=p_local::timestamp; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Invalid calendar date' USING ERRCODE='22023'; END;
 IF to_char(v_local,'YYYY-MM-DD"T"HH24:MI')<>p_local THEN RAISE EXCEPTION 'Invalid calendar date' USING ERRCODE='22023'; END IF;
 v_at:=v_local AT TIME ZONE p_timezone;
 IF v_at<=public.sacute_content_time() THEN RAISE EXCEPTION 'Schedule must be in the future' USING ERRCODE='22023'; END IF;
 RETURN v_at;
END $$;
REVOKE ALL ON FUNCTION public.sacute_schedule_instant(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sacute_schedule_instant(text,text) TO authenticated;

-- Intersect existing policies; do not assume/remove unknown production policies.
DO $$ DECLARE t text; pred text; BEGIN
 FOREACH t IN ARRAY ARRAY['posts','post_media','scholarship_details','event_details'] LOOP
  pred:=CASE WHEN t='posts' THEN '(status=''published'' AND deleted_at IS NULL AND (visible_from IS NULL OR visible_from<=public.sacute_content_time()))'
   ELSE 'EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id AND p.status=''published'' AND p.deleted_at IS NULL AND (p.visible_from IS NULL OR p.visible_from<=public.sacute_content_time()))' END;
  -- Replace only the reviewed CMS read policy names. Both permissive and guard
  -- use the same DB clock, including deterministic isolated test clocks.
  EXECUTE format('DROP POLICY IF EXISTS sacute_read ON public.%I',t);
  EXECUTE format('CREATE POLICY sacute_read ON public.%I FOR SELECT TO anon,authenticated USING(public.sacute_is_admin() OR %s)',t,pred);
  EXECUTE format('DROP POLICY IF EXISTS sacute_read_guard ON public.%I',t);
  EXECUTE format('CREATE POLICY sacute_read_guard ON public.%I AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(public.sacute_is_admin() OR %s)',t,pred);
 END LOOP;
END $$;
DROP POLICY IF EXISTS sacute_media_read ON storage.objects;
CREATE POLICY sacute_media_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='post-media' AND (public.sacute_is_admin() OR EXISTS(SELECT 1 FROM public.post_media m JOIN public.posts p ON p.id=m.post_id WHERE m.bucket=bucket_id AND m.storage_path=name AND p.status='published' AND p.deleted_at IS NULL AND (p.visible_from IS NULL OR p.visible_from<=public.sacute_content_time()))));
DROP POLICY IF EXISTS sacute_media_read_guard ON storage.objects;
CREATE POLICY sacute_media_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(bucket_id<>'post-media' OR public.sacute_is_admin() OR EXISTS(SELECT 1 FROM public.post_media m JOIN public.posts p ON p.id=m.post_id WHERE m.bucket=bucket_id AND m.storage_path=name AND p.status='published' AND p.deleted_at IS NULL AND (p.visible_from IS NULL OR p.visible_from<=public.sacute_content_time())));

-- Keep the bucket private. Publication changes row-level byte access, not the
-- object's location. No cross-service copy, public URL or signed URL is needed.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='draft-media' AND NOT public) THEN
  RAISE EXCEPTION 'Private draft-media bucket required before lifecycle publishing';
 END IF;
END $$;
DROP POLICY IF EXISTS sacute_private_media_read ON storage.objects;
CREATE POLICY sacute_private_media_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='draft-media' AND (public.sacute_is_admin() OR EXISTS(SELECT 1 FROM public.post_media m JOIN public.posts p ON p.id=m.post_id WHERE m.bucket=bucket_id AND m.storage_path=name AND p.status='published' AND p.deleted_at IS NULL AND (p.visible_from IS NULL OR p.visible_from<=public.sacute_content_time()))));
DROP POLICY IF EXISTS sacute_private_media_read_guard ON storage.objects;
CREATE POLICY sacute_private_media_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(bucket_id<>'draft-media' OR public.sacute_is_admin() OR EXISTS(SELECT 1 FROM public.post_media m JOIN public.posts p ON p.id=m.post_id WHERE m.bucket=bucket_id AND m.storage_path=name AND p.status='published' AND p.deleted_at IS NULL AND (p.visible_from IS NULL OR p.visible_from<=public.sacute_content_time())));
-- Supersede only the reviewed 002 publication guard. Direct REST writes remain
-- covered: it must never be possible to serve staging bytes from a public bucket.
CREATE OR REPLACE FUNCTION public.sacute_validate_media_publication()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='draft-media' AND public) THEN
  RAISE EXCEPTION 'draft-media must stay private' USING ERRCODE='22023';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sacute_validate_media_publication() FROM PUBLIC,anon,authenticated;

-- A trashed/archived post is restored before content/association edits. SELECT
-- remains available to admins, including retained media in Trash and Archive.
DO $$ DECLARE t text; op text; pred text; clause text; BEGIN
 pred:='EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id AND p.deleted_at IS NULL AND p.status IN (''draft'',''published''))';
 FOREACH t IN ARRAY ARRAY['post_media','scholarship_details','event_details'] LOOP
  FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
   clause:=CASE op WHEN 'INSERT' THEN 'WITH CHECK('||pred||')' WHEN 'UPDATE' THEN 'USING('||pred||') WITH CHECK('||pred||')' ELSE 'USING('||pred||')' END;
   EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO anon,authenticated %s','sacute_active_parent_'||lower(op),t,op,clause);
  END LOOP;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.sacute_touch_post()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND (NEW.status::text<>'draft' OR NEW.visible_from IS NOT NULL) THEN RAISE EXCEPTION 'Restoration must return to draft' USING ERRCODE='22023'; END IF;
 END IF;
 -- Deletion audit identity/time cannot be supplied by the client.
 IF NEW.deleted_at IS NOT NULL THEN
  IF TG_OP='INSERT' OR OLD.deleted_at IS NULL THEN NEW.deleted_at:=public.sacute_content_time(); NEW.deleted_by:=auth.uid();
  ELSE NEW.deleted_at:=OLD.deleted_at;
   -- Allow FK ON DELETE SET NULL when the original Auth user is removed.
   IF NEW.deleted_by IS NOT NULL THEN NEW.deleted_by:=OLD.deleted_by; END IF;
  END IF;
 ELSE NEW.deleted_by:=NULL; END IF;
 NEW.lifecycle_revision:=gen_random_uuid(); NEW.updated_at:=public.sacute_content_time(); IF auth.uid() IS NOT NULL THEN NEW.updated_by:=auth.uid(); END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.sacute_touch_post() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sacute_touch_post BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.sacute_touch_post();
CREATE OR REPLACE FUNCTION public.sacute_touch_parent()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN UPDATE public.posts SET lifecycle_revision=gen_random_uuid() WHERE id=OLD.post_id; END IF;
 IF TG_OP='INSERT' THEN UPDATE public.posts SET lifecycle_revision=gen_random_uuid() WHERE id=NEW.post_id;
 ELSIF TG_OP='UPDATE' AND NEW.post_id IS DISTINCT FROM OLD.post_id THEN UPDATE public.posts SET lifecycle_revision=gen_random_uuid() WHERE id=NEW.post_id; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sacute_touch_parent() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['post_media','scholarship_details','event_details'] LOOP
  EXECUTE format('CREATE TRIGGER sacute_touch_parent AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sacute_touch_parent()',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_transition_post(p_id uuid,p_action text,p_revision uuid,p_schedule_local text DEFAULT NULL,p_timezone text DEFAULT 'Asia/Ho_Chi_Minh')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_status text; v_deleted timestamptz; v_visible timestamptz; v_revision uuid; v_state text; v_now timestamptz:=public.sacute_content_time(); v_at timestamptz; v_recorded boolean; v_on date; v_published timestamptz;
BEGIN
 IF NOT public.sacute_admin_writes_enabled() THEN RAISE EXCEPTION 'Admin writes disabled or unauthorized' USING ERRCODE='42501'; END IF;
 IF p_action='permanent_delete' THEN RAISE EXCEPTION 'Permanent deletion is disabled pending FK/Storage review' USING ERRCODE='42501'; END IF;
 SELECT status::text,deleted_at,visible_from,lifecycle_revision,coalesce(publication_recorded,published_on IS NOT NULL OR published_at IS NOT NULL),published_on,published_at
 INTO v_status,v_deleted,v_visible,v_revision,v_recorded,v_on,v_published FROM public.posts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p_revision IS DISTINCT FROM v_revision THEN RAISE EXCEPTION 'Stale lifecycle revision; reload' USING ERRCODE='40001'; END IF;
 v_state:=public.sacute_lifecycle_state(v_status,v_deleted,v_visible,v_now);
 IF p_action IS NULL OR NOT ((p_action='publish' AND v_state IN ('draft','scheduled')) OR (p_action='schedule' AND v_state='draft') OR (p_action IN ('reschedule','cancel_schedule') AND v_state='scheduled') OR (p_action='hide' AND v_state='published') OR (p_action='archive' AND v_state IN ('draft','published')) OR (p_action='restore_archive' AND v_state='archived') OR (p_action='trash' AND v_state IN ('draft','scheduled','published','archived')) OR (p_action='restore_trash' AND v_state='trashed')) THEN RAISE EXCEPTION 'Lifecycle transition no longer valid' USING ERRCODE='40001'; END IF;
 IF p_action IN ('restore_trash','restore_archive') AND EXISTS(SELECT 1 FROM public.posts a JOIN public.posts b ON b.slug=a.slug AND b.id<>a.id WHERE a.id=p_id) THEN RAISE EXCEPTION 'Slug already reserved by another post' USING ERRCODE='23505'; END IF;
 IF p_action IN ('schedule','reschedule') THEN v_at:=public.sacute_schedule_instant(p_schedule_local,p_timezone); END IF;
 UPDATE public.posts SET
 status=CASE WHEN p_action IN ('publish','schedule','reschedule') THEN 'published' WHEN p_action='archive' THEN 'archived' WHEN p_action IN ('cancel_schedule','hide','restore_archive','trash','restore_trash') THEN 'draft' ELSE status END,
 visible_from=CASE WHEN p_action IN ('schedule','reschedule') THEN v_at ELSE NULL END,
 deleted_at=CASE WHEN p_action='trash' THEN v_now ELSE NULL END,
 deleted_by=CASE WHEN p_action='trash' THEN auth.uid() ELSE NULL END,
 publication_recorded=v_recorded OR v_state='published' OR p_action='publish',
 published_at=CASE WHEN NOT v_recorded AND p_action='publish' THEN v_now WHEN NOT v_recorded AND p_action IN ('schedule','reschedule') THEN v_at ELSE published_at END,
 published_on=CASE WHEN NOT v_recorded AND p_action='publish' THEN (v_now AT TIME ZONE 'Asia/Ho_Chi_Minh')::date WHEN NOT v_recorded AND p_action IN ('schedule','reschedule') THEN (v_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date ELSE published_on END,
 published_at_precision=CASE WHEN NOT v_recorded AND p_action IN ('publish','schedule','reschedule') THEN 'datetime' ELSE published_at_precision END
 WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle write denied' USING ERRCODE='42501'; END IF;
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_transition_post(uuid,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_post(uuid,text,uuid,text,text) TO authenticated;
-- Permanent deletion is not safe to enable without a verified FK/Storage cleanup
-- workflow. Block direct REST DELETE too; no hidden hard-delete shortcut.
REVOKE DELETE ON public.posts FROM PUBLIC,anon,authenticated;
CREATE POLICY sacute_no_hard_delete ON public.posts AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);

CREATE OR REPLACE FUNCTION public.admin_save_post(p_id uuid, p_input jsonb, p_expected jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid; v_old public.posts%ROWTYPE; v_new public.posts%ROWTYPE;
  v_post jsonb; v_current jsonb; v_scholarship jsonb; v_event jsonb; v_media jsonb;
  v_intent text; v_state text; v_now timestamptz:=public.sacute_content_time(); v_at timestamptz; v_recorded boolean:=false;
  v_item jsonb; v_bucket text; v_path text; v_position integer := 0; v_existing uuid;
BEGIN
  IF NOT public.sacute_admin_writes_enabled() THEN RAISE EXCEPTION 'Admin writes disabled or unauthorized' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR jsonb_typeof(p_input->'post') IS DISTINCT FROM 'object' OR jsonb_typeof(p_input->'media') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid payload' USING ERRCODE='22023'; END IF;
  v_post := p_input->'post';
  v_new := jsonb_populate_record(NULL::public.posts, v_post);

  IF p_id IS NOT NULL THEN
    SELECT jsonb_build_object('title',title,'slug',slug,'summary',summary,'content',content,'category',category,'kind',kind,'tags',tags,'status',status,'published_on',published_on,'published_at',published_at,'published_at_precision',published_at_precision,'visible_from',visible_from,'source_url',source_url,'event_name',event_name,'content_format',content_format)
    INTO v_current FROM public.posts WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Post no longer exists' USING ERRCODE='40001'; END IF;
    v_old := jsonb_populate_record(NULL::public.posts,v_current);
    SELECT deleted_at,lifecycle_revision,publication_recorded INTO v_old.deleted_at,v_old.lifecycle_revision,v_old.publication_recorded FROM public.posts WHERE id=p_id;
    IF p_input->>'revision' IS DISTINCT FROM v_old.lifecycle_revision::text THEN RAISE EXCEPTION 'Stale editor revision; reload' USING ERRCODE='40001'; END IF;
    SELECT jsonb_build_object('provider',provider,'eligibility',eligibility,'opens_at',opens_at,'closes_at',closes_at,'application_url',application_url,'lifecycle_status',lifecycle_status) INTO v_scholarship FROM public.scholarship_details WHERE post_id=p_id;
    SELECT jsonb_build_object('starts_at',starts_at,'ends_at',ends_at,'starts_on',starts_on,'ends_on',ends_on,'location',location,'registration_url',registration_url,'lifecycle_status',lifecycle_status) INTO v_event FROM public.event_details WHERE post_id=p_id;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket',bucket,'storage_path',storage_path,'alt_text',alt_text,'width',width,'height',height,'sort_order',sort_order,'is_cover',is_cover) ORDER BY id), '[]'::jsonb) INTO v_media FROM public.post_media WHERE post_id=p_id;
    -- Compare JSONB timestamps normalized by PostgreSQL/PostgREST. Both are emitted
    -- by PostgreSQL with the session timezone (Supabase defaults UTC).
    IF p_expected IS NULL OR v_current IS DISTINCT FROM p_expected->'post'
      OR coalesce(v_scholarship,'null'::jsonb) IS DISTINCT FROM p_expected->'scholarship'
      OR coalesce(v_event,'null'::jsonb) IS DISTINCT FROM p_expected->'event'
      OR v_media IS DISTINCT FROM p_expected->'media' THEN RAISE EXCEPTION 'Concurrent edit; reload' USING ERRCODE='40001'; END IF;
    IF v_old.slug IS DISTINCT FROM v_new.slug THEN RAISE EXCEPTION 'Existing URL is immutable' USING ERRCODE='22023'; END IF;
  END IF;

  v_intent:=p_input->>'intent';
  v_state:=CASE WHEN p_id IS NULL THEN 'draft' ELSE public.sacute_lifecycle_state(v_old.status::text,v_old.deleted_at,v_old.visible_from,v_now) END;
  IF v_intent IS NULL OR v_intent NOT IN ('save','draft','publish','schedule','reschedule') OR v_state IN ('archived','trashed') OR (v_intent='publish' AND v_state NOT IN ('draft','scheduled')) OR (v_intent='schedule' AND v_state<>'draft') OR (v_intent='reschedule' AND v_state<>'scheduled') THEN RAISE EXCEPTION 'Editor transition no longer valid' USING ERRCODE='40001'; END IF;
  v_recorded:=CASE WHEN p_id IS NULL THEN false ELSE coalesce(v_old.publication_recorded,v_old.published_on IS NOT NULL OR v_old.published_at IS NOT NULL) OR v_state='published' END;
  IF p_id IS NOT NULL THEN
    -- Schedule/status cannot be mass-assigned by editing hidden fields.
    v_new.status:=v_old.status; v_new.visible_from:=v_old.visible_from;
    IF coalesce((p_input->>'edit_publication_date')::boolean,false)=false THEN
      v_new.published_on:=v_old.published_on; v_new.published_at:=v_old.published_at; v_new.published_at_precision:=v_old.published_at_precision;
    ELSE v_recorded:=true; END IF;
  ELSE v_new.status:='draft'; v_new.visible_from:=NULL;
    IF coalesce((p_input->>'edit_publication_date')::boolean,false) THEN v_recorded:=true; END IF;
  END IF;
  IF v_intent='draft' THEN v_new.status:='draft'; v_new.visible_from:=NULL;
  ELSIF v_intent='publish' THEN
    v_new.status:='published'; v_new.visible_from:=NULL;
    IF NOT v_recorded THEN v_new.published_at:=v_now; v_new.published_on:=(v_now AT TIME ZONE 'Asia/Ho_Chi_Minh')::date; v_new.published_at_precision:='datetime'; END IF;
    v_recorded:=true;
  ELSIF v_intent IN ('schedule','reschedule') THEN
    v_at:=public.sacute_schedule_instant(p_input->>'schedule_local',p_input->>'timezone');
    v_new.status:='published'; v_new.visible_from:=v_at;
    IF NOT v_recorded THEN v_new.published_at:=v_at; v_new.published_on:=(v_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date; v_new.published_at_precision:='datetime'; END IF;
  END IF;

  IF v_new.title IS NULL OR length(trim(v_new.title)) NOT BETWEEN 1 AND 300
    OR v_new.summary IS NULL OR length(trim(v_new.summary)) NOT BETWEEN 1 AND 2000
    OR v_new.content IS NULL OR length(trim(v_new.content)) NOT BETWEEN 1 AND 120000
    OR v_new.category IS NULL OR length(trim(v_new.category)) NOT BETWEEN 1 AND 100
    OR v_new.slug IS NULL OR length(v_new.slug)>180 OR v_new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    OR v_new.kind IS NULL OR v_new.kind NOT IN ('information','scholarship','event')
    OR v_new.status IS NULL OR v_new.status NOT IN ('draft','published','archived')
    OR v_new.content_format IS NULL OR v_new.content_format NOT IN ('plain-text','markdown')
    OR (coalesce((p_input->>'edit_publication_date')::boolean,false) AND v_new.published_on IS NULL)
    OR (v_new.status='published' AND v_new.published_on IS NULL)
    OR (v_new.published_on IS NOT NULL AND v_new.published_at_precision IS NULL)
    OR (v_new.published_at_precision IS NOT NULL AND v_new.published_at_precision NOT IN ('date','datetime'))
    OR (v_new.published_at_precision='date' AND (v_new.published_on IS NULL OR v_new.published_at IS NOT NULL))
    OR (v_new.published_at_precision='datetime' AND (v_new.published_at IS NULL OR v_new.published_on IS DISTINCT FROM (v_new.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))
    OR cardinality(v_new.tags)>30 OR length(coalesce(v_new.source_url,''))>2048
    OR (v_new.source_url IS NOT NULL AND v_new.source_url !~ '^https?://')
    OR jsonb_array_length(p_input->'media')>100 THEN RAISE EXCEPTION 'Invalid post fields' USING ERRCODE='22023'; END IF;
  IF v_new.kind='scholarship' AND (coalesce(p_input->'scholarship'->>'lifecycle_status','') NOT IN ('upcoming','open','closed') OR jsonb_typeof(p_input->'scholarship')<>'object') THEN RAISE EXCEPTION 'Invalid scholarship' USING ERRCODE='22023'; END IF;
  IF v_new.kind='event' AND (coalesce(p_input->'event'->>'lifecycle_status','') NOT IN ('upcoming','ongoing','ended') OR jsonb_typeof(p_input->'event')<>'object') THEN RAISE EXCEPTION 'Invalid event' USING ERRCODE='22023'; END IF;

  -- Validate all object paths before changing any association. Shared row locks
  -- keep Storage object deletion from racing a normal CMS save transaction.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_input->'media') LOOP
    v_bucket := coalesce(v_item->>'bucket','post-media');
    IF v_bucket NOT IN ('post-media','draft-media') THEN RAISE EXCEPTION 'Unsupported media bucket' USING ERRCODE='22023'; END IF;
    v_path := v_item->>'storage_path';
    IF v_path IS NULL OR length(v_path) NOT BETWEEN 1 AND 512 OR v_path ~ '(^/|(^|/)\.\.?(/|$)|[\\?#%]|[[:cntrl:]])' OR v_path ~ '//' OR right(v_path,1)='/'
       OR length(coalesce(v_item->>'alt_text',''))>500 OR (v_item->>'is_cover') IS NULL THEN RAISE EXCEPTION 'Invalid media' USING ERRCODE='22023'; END IF;
    PERFORM id FROM storage.objects WHERE bucket_id=v_bucket AND name=v_path AND lower(coalesce(metadata->>'mimetype','')) IN ('image/jpeg','image/png','image/webp','image/avif') FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Image missing or unsupported' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT (coalesce(value->>'bucket','post-media') || '/' || (value->>'storage_path'))) FROM jsonb_array_elements(p_input->'media')) <> jsonb_array_length(p_input->'media')
     OR (jsonb_array_length(p_input->'media')>0 AND (SELECT count(*) FROM jsonb_array_elements(p_input->'media') WHERE (value->>'is_cover')::boolean)<>1) THEN RAISE EXCEPTION 'Invalid media order/cover' USING ERRCODE='22023'; END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.posts(title,slug,summary,content,category,kind,tags,status,published_on,published_at,published_at_precision,visible_from,source_url,event_name,content_format,created_by,updated_by,publication_recorded)
    VALUES (v_new.title,v_new.slug,v_new.summary,v_new.content,v_new.category,v_new.kind,coalesce(v_new.tags,ARRAY[]::text[]),v_new.status,v_new.published_on,v_new.published_at,v_new.published_at_precision,v_new.visible_from,v_new.source_url,v_new.event_name,v_new.content_format,auth.uid(),auth.uid(),v_recorded) RETURNING id INTO v_id;
  ELSE
    v_id := p_id;
    UPDATE public.posts SET title=v_new.title, summary=v_new.summary, content=v_new.content, category=v_new.category, kind=v_new.kind, tags=coalesce(v_new.tags,ARRAY[]::text[]), status=v_new.status, published_on=v_new.published_on, published_at=v_new.published_at, published_at_precision=v_new.published_at_precision, visible_from=v_new.visible_from, source_url=v_new.source_url, event_name=v_new.event_name, content_format=v_new.content_format, updated_by=auth.uid(),publication_recorded=v_recorded WHERE id=v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Editor write denied' USING ERRCODE='42501'; END IF;
  END IF;
  IF v_new.kind='scholarship' THEN
    INSERT INTO public.scholarship_details(post_id,provider,eligibility,opens_at,closes_at,application_url,lifecycle_status)
    SELECT v_id,d.provider,d.eligibility,d.opens_at,d.closes_at,d.application_url,d.lifecycle_status FROM jsonb_populate_record(NULL::public.scholarship_details,p_input->'scholarship') d
    ON CONFLICT(post_id) DO UPDATE SET provider=excluded.provider,eligibility=excluded.eligibility,opens_at=excluded.opens_at,closes_at=excluded.closes_at,application_url=excluded.application_url,lifecycle_status=excluded.lifecycle_status;
  ELSE DELETE FROM public.scholarship_details WHERE post_id=v_id; END IF;
  IF v_new.kind='event' THEN
    INSERT INTO public.event_details(post_id,starts_at,ends_at,starts_on,ends_on,location,registration_url,lifecycle_status)
    SELECT v_id,d.starts_at,d.ends_at,d.starts_on,d.ends_on,d.location,d.registration_url,d.lifecycle_status FROM jsonb_populate_record(NULL::public.event_details,p_input->'event') d
    ON CONFLICT(post_id) DO UPDATE SET starts_at=excluded.starts_at,ends_at=excluded.ends_at,starts_on=excluded.starts_on,ends_on=excluded.ends_on,location=excluded.location,registration_url=excluded.registration_url,lifecycle_status=excluded.lifecycle_status;
  ELSE DELETE FROM public.event_details WHERE post_id=v_id; END IF;

  -- Keep IDs, source_metadata and dimensions for retained images. Reordering can
  -- encounter legacy unique sort/cover indexes; defer only if audit marks them
  -- DEFERRABLE. Otherwise review/adapt those indexes before applying migration.
  DELETE FROM public.post_media WHERE post_id=v_id AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_input->'media') m WHERE m->>'storage_path'=storage_path AND coalesce(m->>'bucket','post-media')=bucket);
  UPDATE public.post_media SET is_cover=false WHERE post_id=v_id AND is_cover;
  -- Temporary negative positions avoid clashes with normal nonnegative ordering
  -- only when no nonnegative CHECK exists. Instead use a high temporary offset.
  UPDATE public.post_media SET sort_order=sort_order+1000000 WHERE post_id=v_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_input->'media') LOOP
    v_bucket := coalesce(v_item->>'bucket','post-media');
    SELECT id INTO v_existing FROM public.post_media WHERE post_id=v_id AND bucket=v_bucket AND storage_path=v_item->>'storage_path';
    IF FOUND THEN
      UPDATE public.post_media SET alt_text=v_item->>'alt_text', width=(v_item->>'width')::integer, height=(v_item->>'height')::integer, sort_order=v_position, is_cover=(v_item->>'is_cover')::boolean WHERE id=v_existing;
    ELSE
      INSERT INTO public.post_media(post_id,bucket,storage_path,alt_text,width,height,sort_order,is_cover)
      VALUES(v_id,v_bucket,v_item->>'storage_path',v_item->>'alt_text',(v_item->>'width')::integer,(v_item->>'height')::integer,v_position,(v_item->>'is_cover')::boolean);
    END IF;
    v_position:=v_position+1;
  END LOOP;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_post(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_post(uuid,jsonb,jsonb) TO authenticated;
COMMENT ON FUNCTION public.admin_save_post(uuid,jsonb,jsonb) IS 'Atomic CMS save. SECURITY INVOKER, admin check, RLS, immutable existing slug, optimistic snapshot. No service-role bypass.';


COMMIT;
