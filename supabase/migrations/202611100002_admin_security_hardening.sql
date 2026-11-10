-- PROPOSED SECURITY FOLLOW-UP. Apply ONLY after reviewing live audit and 001.
-- Does not copy/delete any existing asset or enable writes. Both gates stay OFF.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('storage.objects'::regclass,'storage.buckets'::regclass) AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'Storage RLS is disabled; review before applying CMS migrations';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('posts','post_media','scholarship_details','event_details','admin_profiles') AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Content/profile RLS is disabled; review and enable it before hardening';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Application role has elevated RLS privileges; owner review required';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
    WHERE r.rolname IN ('anon','authenticated') AND ((n.nspname='public' AND c.relname IN ('posts','post_media','scholarship_details','event_details','admin_profiles','admin_cms_settings')) OR (n.nspname='storage' AND c.relname IN ('objects','buckets')))) THEN
    RAISE EXCEPTION 'Application role owns a protected table; owner review required';
  END IF;
END $$;
-- NOT EXISTS reference checks are safe only when admins can see every relevant
-- association. Unknown restrictive policies can hide rows; never assume their
-- interaction or drop them automatically. Require an owner review first.
DO $$ DECLARE v_policy record; BEGIN
 FOR v_policy IN
  SELECT n.nspname,c.relname,p.polname FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE NOT p.polpermissive AND ((n.nspname='public' AND c.relname IN ('posts','post_media','scholarship_details','event_details','admin_profiles','admin_cms_settings')) OR (n.nspname='storage' AND c.relname IN ('objects','buckets')))
  AND p.polname <> ALL(ARRAY['sacute_read_guard','sacute_write_guard_insert','sacute_write_guard_update','sacute_write_guard_delete','sacute_profile_read_guard','sacute_profile_no_insert','sacute_profile_no_update','sacute_profile_no_delete','sacute_gate_no_mutation','sacute_gate_no_delete','sacute_database_gate_insert','sacute_database_gate_update','sacute_database_gate_delete','sacute_media_read_guard','sacute_media_insert_guard','sacute_media_update_guard','sacute_media_delete_guard','sacute_private_media_read_guard','sacute_storage_insert_gate','sacute_storage_update_gate','sacute_storage_delete_gate','sacute_bucket_guard_insert','sacute_bucket_guard_update','sacute_bucket_guard_delete']::name[])
 LOOP
  RAISE EXCEPTION 'Unreviewed restrictive policy %.%: %. Keep writes off; review visibility and adapt explicitly.',v_policy.nspname,v_policy.relname,v_policy.polname;
 END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_cms_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  writes_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.admin_cms_settings(singleton,writes_enabled) VALUES(true,false)
ON CONFLICT(singleton) DO UPDATE SET writes_enabled=false;
ALTER TABLE public.admin_cms_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_cms_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL(singleton,writes_enabled) ON public.admin_cms_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT(writes_enabled) ON public.admin_cms_settings TO anon, authenticated;
DROP POLICY IF EXISTS sacute_gate_read ON public.admin_cms_settings;
CREATE POLICY sacute_gate_read ON public.admin_cms_settings FOR SELECT TO anon,authenticated USING(true);
DROP POLICY IF EXISTS sacute_gate_no_mutation ON public.admin_cms_settings;
CREATE POLICY sacute_gate_no_mutation ON public.admin_cms_settings AS RESTRICTIVE FOR ALL TO anon,authenticated USING(true) WITH CHECK(false);
-- DELETE needs its own USING(false); no client may change the gate, even admin.
DROP POLICY IF EXISTS sacute_gate_no_delete ON public.admin_cms_settings;
CREATE POLICY sacute_gate_no_delete ON public.admin_cms_settings AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);

CREATE OR REPLACE FUNCTION public.sacute_admin_writes_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT public.sacute_is_admin() AND coalesce((SELECT writes_enabled FROM public.admin_cms_settings),false);
$$;
REVOKE ALL ON FUNCTION public.sacute_admin_writes_enabled() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sacute_admin_writes_enabled() TO anon,authenticated;
-- Reassert the reviewed invoker helper rather than trusting a previous body.
CREATE OR REPLACE FUNCTION public.sacute_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.admin_profiles WHERE user_id=(SELECT auth.uid()) AND role='admin');
$$;
-- Reset inherited/direct EXECUTE ACLs on the exact helper signature as well.
REVOKE ALL ON FUNCTION public.sacute_is_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sacute_is_admin() TO anon,authenticated;
DO $$ DECLARE t text; op text; clause text; BEGIN
 FOREACH t IN ARRAY ARRAY['posts','post_media','scholarship_details','event_details'] LOOP
  FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
   clause:=CASE op WHEN 'INSERT' THEN 'WITH CHECK(public.sacute_admin_writes_enabled())'
    WHEN 'UPDATE' THEN 'USING(public.sacute_admin_writes_enabled()) WITH CHECK(public.sacute_admin_writes_enabled())'
    ELSE 'USING(public.sacute_admin_writes_enabled())' END;
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','sacute_database_gate_'||lower(op),t);
   EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO anon,authenticated %s','sacute_database_gate_'||lower(op),t,op,clause);
  END LOOP;
 END LOOP;
END $$;

-- Staging must actually be private. Never silently change an existing public
-- bucket's visibility/configuration or its files: abort and ask owner to review.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='draft-media' AND public) THEN
  RAISE EXCEPTION 'draft-media exists as PUBLIC; owner review required, do not upload';
 END IF;
 IF EXISTS(SELECT 1 FROM public.post_media m JOIN public.posts p ON p.id=m.post_id WHERE p.status='published' AND m.bucket='draft-media') THEN
  RAISE EXCEPTION 'Existing published post has private associations; review without deleting data';
 END IF;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('draft-media','draft-media',false,3145728,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT(id) DO NOTHING;

-- An authenticated caller must not turn the staging bucket public, rename it,
-- or remove it through a legacy bucket-management policy.
DO $$ DECLARE op text; clause text; BEGIN
 FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
  clause:=CASE op WHEN 'INSERT' THEN 'WITH CHECK(id NOT IN (''draft-media'',''post-media''))'
    WHEN 'UPDATE' THEN 'USING(id NOT IN (''draft-media'',''post-media'')) WITH CHECK(id NOT IN (''draft-media'',''post-media''))'
    ELSE 'USING(id NOT IN (''draft-media'',''post-media''))' END;
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.buckets','sacute_bucket_guard_'||lower(op));
  EXECUTE format('CREATE POLICY %I ON storage.buckets AS RESTRICTIVE FOR %s TO anon,authenticated %s','sacute_bucket_guard_'||lower(op),op,clause);
 END LOOP;
END $$;

DROP POLICY IF EXISTS sacute_private_media_read ON storage.objects;
CREATE POLICY sacute_private_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='draft-media' AND public.sacute_is_admin());
DROP POLICY IF EXISTS sacute_private_media_read_guard ON storage.objects;
CREATE POLICY sacute_private_media_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(bucket_id<>'draft-media' OR public.sacute_is_admin());
DROP POLICY IF EXISTS sacute_private_media_upload ON storage.objects;
CREATE POLICY sacute_private_media_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='draft-media' AND public.sacute_admin_writes_enabled()
 AND name ~ ('^admin/'||auth.uid()::text||'/[0-9a-f-]{36}\.(png|jpg|webp)$')
);
-- No app public upload/copy endpoint exists. Fail closed until explicit owner
-- release after the post is public. Old permissive INSERT policies cannot bypass.
DROP POLICY IF EXISTS sacute_storage_insert_gate ON storage.objects;
CREATE POLICY sacute_storage_insert_gate ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(
 bucket_id NOT IN ('draft-media','post-media') OR (bucket_id='draft-media' AND public.sacute_admin_writes_enabled()
 AND name ~ ('^admin/'||auth.uid()::text||'/[0-9a-f-]{36}\.(png|jpg|webp)$'))
);
-- Locking existing objects is necessary for RPC FOR SHARE; WITH CHECK(false)
-- rejects all real overwrites/moves in either managed bucket.
DROP POLICY IF EXISTS sacute_private_media_lock ON storage.objects;
CREATE POLICY sacute_private_media_lock ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='draft-media' AND public.sacute_admin_writes_enabled()) WITH CHECK(false);
DROP POLICY IF EXISTS sacute_storage_update_gate ON storage.objects;
CREATE POLICY sacute_storage_update_gate ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id NOT IN ('draft-media','post-media') OR public.sacute_admin_writes_enabled())
 WITH CHECK(bucket_id NOT IN ('draft-media','post-media'));
DROP POLICY IF EXISTS sacute_private_media_delete ON storage.objects;
CREATE POLICY sacute_private_media_delete ON storage.objects FOR DELETE TO authenticated USING(
 bucket_id='draft-media' AND public.sacute_admin_writes_enabled()
 AND name ~ ('^admin/'||auth.uid()::text||'/[0-9a-f-]{36}\.(png|jpg|webp)$')
 AND NOT EXISTS(SELECT 1 FROM public.post_media m WHERE m.bucket=bucket_id AND m.storage_path=name)
);
DROP POLICY IF EXISTS sacute_storage_delete_gate ON storage.objects;
CREATE POLICY sacute_storage_delete_gate ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(
 bucket_id NOT IN ('draft-media','post-media') OR (bucket_id='draft-media' AND public.sacute_admin_writes_enabled()
 AND name ~ ('^admin/'||auth.uid()::text||'/[0-9a-f-]{36}\.(png|jpg|webp)$')
 AND NOT EXISTS(SELECT 1 FROM public.post_media m WHERE m.bucket=bucket_id AND m.storage_path=name))
);

-- Recheck references AFTER the DELETE acquires its row lock. RLS NOT EXISTS by
-- itself has a check/use race against an uncommitted attachment transaction.
CREATE OR REPLACE FUNCTION public.sacute_protect_referenced_media()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.bucket_id IN ('draft-media','post-media') THEN
  IF EXISTS(SELECT 1 FROM public.post_media m WHERE m.bucket=OLD.bucket_id AND m.storage_path=OLD.name) THEN
   RAISE EXCEPTION 'Referenced media cannot be deleted' USING ERRCODE='23503';
  END IF;
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.sacute_protect_referenced_media() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sacute_protect_referenced_media ON storage.objects;
CREATE TRIGGER sacute_protect_referenced_media BEFORE DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.sacute_protect_referenced_media();

-- A direct REST update/insert must not publish private attachments either.
CREATE OR REPLACE FUNCTION public.sacute_validate_media_publication()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF TG_TABLE_NAME='posts' THEN v_id:=NEW.id; ELSE v_id:=NEW.post_id; END IF;
 IF EXISTS(SELECT 1 FROM public.posts p JOIN public.post_media m ON m.post_id=p.id WHERE p.id=v_id AND p.status='published' AND m.bucket='draft-media') THEN
  RAISE EXCEPTION 'Private media must be reviewed and released before publication' USING ERRCODE='22023';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sacute_validate_media_publication() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sacute_post_publication_guard ON public.posts;
CREATE CONSTRAINT TRIGGER sacute_post_publication_guard AFTER INSERT OR UPDATE ON public.posts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.sacute_validate_media_publication();
DROP TRIGGER IF EXISTS sacute_media_publication_guard ON public.post_media;
CREATE CONSTRAINT TRIGGER sacute_media_publication_guard AFTER INSERT OR UPDATE ON public.post_media DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.sacute_validate_media_publication();

-- Direct child-table edits must take the same parent lock as the save RPC.
CREATE OR REPLACE FUNCTION public.sacute_lock_content_parent()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_old uuid; v_new uuid;
BEGIN
 IF TG_OP <> 'INSERT' THEN v_old:=OLD.post_id; END IF;
 IF TG_OP <> 'DELETE' THEN v_new:=NEW.post_id; END IF;
 PERFORM id FROM public.posts WHERE id IN (v_old,v_new) ORDER BY id FOR UPDATE;
 -- Direct REST association changes need the same object lock as the save RPC.
 IF TG_TABLE_NAME='post_media' AND TG_OP<>'DELETE' THEN
  IF NEW.bucket NOT IN ('post-media','draft-media') THEN RAISE EXCEPTION 'Unsupported media bucket' USING ERRCODE='22023'; END IF;
  PERFORM id FROM storage.objects WHERE bucket_id=NEW.bucket AND name=NEW.storage_path FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Media object missing' USING ERRCODE='22023'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sacute_lock_content_parent() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['post_media','scholarship_details','event_details'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS sacute_lock_content_parent ON public.%I',t);
  EXECUTE format('CREATE TRIGGER sacute_lock_content_parent BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sacute_lock_content_parent()',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_save_post(p_id uuid, p_input jsonb, p_expected jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid; v_old public.posts%ROWTYPE; v_new public.posts%ROWTYPE;
  v_post jsonb; v_current jsonb; v_scholarship jsonb; v_event jsonb; v_media jsonb;
  v_item jsonb; v_bucket text; v_path text; v_position integer := 0; v_existing uuid;
BEGIN
  IF NOT public.sacute_admin_writes_enabled() THEN RAISE EXCEPTION 'Admin writes disabled or unauthorized' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR jsonb_typeof(p_input->'post') IS DISTINCT FROM 'object' OR jsonb_typeof(p_input->'media') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid payload' USING ERRCODE='22023'; END IF;
  v_post := p_input->'post';
  v_new := jsonb_populate_record(NULL::public.posts, v_post);
  IF v_new.title IS NULL OR length(trim(v_new.title)) NOT BETWEEN 1 AND 300
    OR v_new.summary IS NULL OR length(trim(v_new.summary)) NOT BETWEEN 1 AND 2000
    OR v_new.content IS NULL OR length(trim(v_new.content)) NOT BETWEEN 1 AND 120000
    OR v_new.category IS NULL OR length(trim(v_new.category)) NOT BETWEEN 1 AND 100
    OR v_new.slug IS NULL OR length(v_new.slug)>180 OR v_new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    OR v_new.kind IS NULL OR v_new.kind NOT IN ('information','scholarship','event')
    OR v_new.status IS NULL OR v_new.status NOT IN ('draft','published','archived')
    OR v_new.content_format IS NULL OR v_new.content_format NOT IN ('plain-text','markdown')
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

  IF p_id IS NOT NULL THEN
    SELECT jsonb_build_object('title',title,'slug',slug,'summary',summary,'content',content,'category',category,'kind',kind,'tags',tags,'status',status,'published_on',published_on,'published_at',published_at,'published_at_precision',published_at_precision,'visible_from',visible_from,'source_url',source_url,'event_name',event_name,'content_format',content_format)
    INTO v_current FROM public.posts WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Post no longer exists' USING ERRCODE='40001'; END IF;
    v_old := jsonb_populate_record(NULL::public.posts,v_current);
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

  -- Validate all object paths before changing any association. Shared row locks
  -- keep Storage object deletion from racing a normal CMS save transaction.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_input->'media') LOOP
    v_bucket := coalesce(v_item->>'bucket','post-media');
    IF v_bucket NOT IN ('post-media','draft-media') OR (v_new.status='published' AND v_bucket='draft-media') THEN RAISE EXCEPTION 'Private media cannot be published' USING ERRCODE='22023'; END IF;
    v_path := v_item->>'storage_path';
    IF v_path IS NULL OR length(v_path) NOT BETWEEN 1 AND 512 OR v_path ~ '(^/|(^|/)\.\.?(/|$)|[\\?#%]|[[:cntrl:]])' OR v_path ~ '//' OR right(v_path,1)='/'
       OR length(coalesce(v_item->>'alt_text',''))>500 OR (v_item->>'is_cover') IS NULL THEN RAISE EXCEPTION 'Invalid media' USING ERRCODE='22023'; END IF;
    PERFORM id FROM storage.objects WHERE bucket_id=v_bucket AND name=v_path AND lower(coalesce(metadata->>'mimetype','')) IN ('image/jpeg','image/png','image/webp','image/avif') FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Image missing or unsupported' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT (coalesce(value->>'bucket','post-media') || '/' || (value->>'storage_path'))) FROM jsonb_array_elements(p_input->'media')) <> jsonb_array_length(p_input->'media')
     OR (jsonb_array_length(p_input->'media')>0 AND (SELECT count(*) FROM jsonb_array_elements(p_input->'media') WHERE (value->>'is_cover')::boolean)<>1) THEN RAISE EXCEPTION 'Invalid media order/cover' USING ERRCODE='22023'; END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.posts(title,slug,summary,content,category,kind,tags,status,published_on,published_at,published_at_precision,visible_from,source_url,event_name,content_format,created_by,updated_by)
    VALUES (v_new.title,v_new.slug,v_new.summary,v_new.content,v_new.category,v_new.kind,coalesce(v_new.tags,ARRAY[]::text[]),v_new.status,v_new.published_on,v_new.published_at,v_new.published_at_precision,v_new.visible_from,v_new.source_url,v_new.event_name,v_new.content_format,auth.uid(),auth.uid()) RETURNING id INTO v_id;
  ELSE
    v_id := p_id;
    UPDATE public.posts SET title=v_new.title, summary=v_new.summary, content=v_new.content, category=v_new.category, kind=v_new.kind, tags=coalesce(v_new.tags,ARRAY[]::text[]), status=v_new.status, published_on=v_new.published_on, published_at=v_new.published_at, published_at_precision=v_new.published_at_precision, visible_from=v_new.visible_from, source_url=v_new.source_url, event_name=v_new.event_name, content_format=v_new.content_format, updated_by=auth.uid() WHERE id=v_id;
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
