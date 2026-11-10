-- PROPOSED base migration. Follow-up 002 is mandatory before enabling either write gate. Never run automatically. Review audit + docs/admin-cms.md first.
-- No content import, table recreation, bucket deletion, service key, or RLS bypass.
-- PostgreSQL transaction: any precondition failure rolls the entire migration back.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE t text;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('storage.objects'::regclass,'storage.buckets'::regclass) AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'Storage RLS is disabled; review before applying CMS migrations';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Application role has elevated RLS privileges; owner review required';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
    WHERE r.rolname IN ('anon','authenticated') AND ((n.nspname='public' AND c.relname IN ('posts','post_media','scholarship_details','event_details','admin_profiles','admin_cms_settings')) OR (n.nspname='storage' AND c.relname IN ('objects','buckets')))) THEN
    RAISE EXCEPTION 'Application role owns a protected table; owner review required';
  END IF;
  FOREACH t IN ARRAY ARRAY['posts','post_media','scholarship_details','event_details','admin_profiles'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN RAISE EXCEPTION 'Missing table: %; inspect audit first', t; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_profiles' AND column_name='user_id' AND udt_name='uuid')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_profiles' AND column_name='role') THEN
    RAISE EXCEPTION 'Expected admin_profiles(user_id uuid, role). Adapt to audited schema; do not guess.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_profiles GROUP BY user_id HAVING count(*) > 1) THEN RAISE EXCEPTION 'Duplicate admin membership; review without deleting data'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='post-media' AND public) THEN RAISE EXCEPTION 'Expected existing public post-media bucket; do not recreate it'; END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS sacute_admin_profiles_user_id ON public.admin_profiles(user_id);

CREATE OR REPLACE FUNCTION public.sacute_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = (SELECT auth.uid()) AND role = 'admin');
$$;
REVOKE ALL ON FUNCTION public.sacute_is_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sacute_is_admin() TO anon, authenticated;
COMMENT ON FUNCTION public.sacute_is_admin() IS 'Checks database-controlled membership under caller RLS. No user_metadata or elevated privileges. Fixed search_path.';

-- Fresh installation must stay fail-closed even before follow-up 002 commits.
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
 -- Placeholder: base policies cannot activate before mandatory hardening 002.
 SELECT false;
$$;
REVOKE ALL ON FUNCTION public.sacute_admin_writes_enabled() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sacute_admin_writes_enabled() TO anon,authenticated;

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_profiles FROM PUBLIC, anon, authenticated;
-- Remove legacy column grants as table-level REVOKE does not remove them.
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_profiles' LOOP
    EXECUTE format('REVOKE ALL (%I) ON public.admin_profiles FROM PUBLIC, anon, authenticated', c.column_name);
  END LOOP;
END $$;
-- The invoker helper needs SELECT even for anon. RLS returns no anonymous rows
-- and only the caller membership for authenticated users. No definer bypass.
GRANT SELECT(user_id, role) ON public.admin_profiles TO anon, authenticated;
DROP POLICY IF EXISTS sacute_profile_self ON public.admin_profiles;
CREATE POLICY sacute_profile_self ON public.admin_profiles FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS sacute_profile_read_guard ON public.admin_profiles;
CREATE POLICY sacute_profile_read_guard ON public.admin_profiles AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (user_id = (SELECT auth.uid()));
DO $$ DECLARE op text; BEGIN
  FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_profiles', 'sacute_profile_no_' || lower(op));
    IF op = 'INSERT' THEN
      EXECUTE 'CREATE POLICY sacute_profile_no_insert ON public.admin_profiles AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false)';
    ELSIF op = 'UPDATE' THEN
      EXECUTE 'CREATE POLICY sacute_profile_no_update ON public.admin_profiles AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false)';
    ELSE
      EXECUTE 'CREATE POLICY sacute_profile_no_delete ON public.admin_profiles AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false)';
    END IF;
  END LOOP;
END $$;

-- Restrictive guards intersect legacy permissive policies; no silent OR widening.
-- Existing restrictive policies may deny legitimate admin operations: audit/review them.
DO $$
DECLARE t text; visible text; op text; clause text;
BEGIN
  FOREACH t IN ARRAY ARRAY['posts','post_media','scholarship_details','event_details'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    -- Also remove legacy grants directly attached to individual columns.
    FOR clause IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=t LOOP
      EXECUTE format('REVOKE ALL (%I) ON public.%I FROM PUBLIC, anon, authenticated', clause, t);
    END LOOP;
    -- Expose only the domain projection, including relationship join keys.
    -- Internal source metadata and editor UUIDs are not readable via REST.
    clause := CASE t
      WHEN 'posts' THEN 'id,slug,kind,category,title,original_title,event_name,summary,content,content_format,tags,author_name,author_url,source_url,status,visible_from,published_on,published_at,published_at_precision'
      WHEN 'post_media' THEN 'id,post_id,bucket,storage_path,alt_text,width,height,sort_order,is_cover'
      WHEN 'scholarship_details' THEN 'post_id,provider,eligibility,opens_at,closes_at,application_url,lifecycle_status'
      ELSE 'post_id,starts_at,ends_at,starts_on,ends_on,location,registration_url,lifecycle_status' END;
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon, authenticated', clause, t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    visible := CASE WHEN t = 'posts' THEN '(status = ''published'' AND (visible_from IS NULL OR visible_from <= now()))'
      ELSE 'EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.status = ''published'' AND (p.visible_from IS NULL OR p.visible_from <= now()))' END;
    EXECUTE format('DROP POLICY IF EXISTS sacute_read ON public.%I', t);
    EXECUTE format('CREATE POLICY sacute_read ON public.%I FOR SELECT TO anon, authenticated USING (public.sacute_is_admin() OR %s)', t, visible);
    EXECUTE format('DROP POLICY IF EXISTS sacute_read_guard ON public.%I', t);
    EXECUTE format('CREATE POLICY sacute_read_guard ON public.%I AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (public.sacute_is_admin() OR %s)', t, visible);
    FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      clause := CASE op WHEN 'INSERT' THEN 'WITH CHECK (public.sacute_admin_writes_enabled())' WHEN 'UPDATE' THEN 'USING (public.sacute_admin_writes_enabled()) WITH CHECK (public.sacute_admin_writes_enabled())' ELSE 'USING (public.sacute_admin_writes_enabled())' END;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'sacute_admin_' || lower(op), t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated %s', 'sacute_admin_' || lower(op), t, op, clause);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'sacute_write_guard_' || lower(op), t);
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO anon, authenticated %s', 'sacute_write_guard_' || lower(op), t, op, clause);
    END LOOP;
  END LOOP;
END $$;

-- Reusing the same image across posts needs per-post uniqueness, not global path
-- uniqueness. Drop ONLY an exact unique(bucket,storage_path) or unique(storage_path)
-- definition; never CASCADE. Existing records and other constraints remain intact.
DO $$ DECLARE i record; BEGIN
  FOR i IN
    SELECT ix.indexrelid, ic.relname AS index_name, con.conname
    FROM pg_index ix JOIN pg_class ic ON ic.oid=ix.indexrelid
    LEFT JOIN pg_constraint con ON con.conindid=ix.indexrelid
    WHERE ix.indrelid='public.post_media'::regclass AND ix.indisunique AND NOT ix.indisprimary
      AND ix.indpred IS NULL AND ix.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(ix.indkey) k JOIN pg_attribute a ON a.attrelid=ix.indrelid AND a.attnum=k)
          IN (ARRAY['bucket','storage_path']::text[], ARRAY['storage_path']::text[])
  LOOP
    IF i.conname IS NOT NULL THEN EXECUTE format('ALTER TABLE public.post_media DROP CONSTRAINT %I', i.conname);
    ELSE EXECUTE format('DROP INDEX public.%I', i.index_name); END IF;
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS sacute_post_media_post_path ON public.post_media(post_id, bucket, storage_path);

-- Only the Storage API changes objects. Existing legacy files are not deletable
-- through CMS policies; new CMS images can be deleted only while unreferenced.
DROP POLICY IF EXISTS sacute_media_read ON storage.objects;
CREATE POLICY sacute_media_read ON storage.objects FOR SELECT TO anon, authenticated USING (
  bucket_id='post-media' AND (public.sacute_is_admin() OR EXISTS (SELECT 1 FROM public.post_media m JOIN public.posts p ON p.id=m.post_id WHERE m.bucket=bucket_id AND m.storage_path=name AND p.status='published' AND (p.visible_from IS NULL OR p.visible_from<=now())))
);
DROP POLICY IF EXISTS sacute_media_read_guard ON storage.objects;
CREATE POLICY sacute_media_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (
  bucket_id<>'post-media' OR public.sacute_is_admin() OR EXISTS (SELECT 1 FROM public.post_media m JOIN public.posts p ON p.id=m.post_id WHERE m.bucket=bucket_id AND m.storage_path=name AND p.status='published' AND (p.visible_from IS NULL OR p.visible_from<=now()))
);
DROP POLICY IF EXISTS sacute_media_upload ON storage.objects;
CREATE POLICY sacute_media_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='post-media' AND public.sacute_admin_writes_enabled() AND name ~ '^admin/[0-9a-f-]{36}\.(png|jpg|webp)$');
DROP POLICY IF EXISTS sacute_media_insert_guard ON storage.objects;
CREATE POLICY sacute_media_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (bucket_id<>'post-media' OR (public.sacute_admin_writes_enabled() AND name ~ '^admin/[0-9a-f-]{36}\.(png|jpg|webp)$'));
DROP POLICY IF EXISTS sacute_media_update_guard ON storage.objects;
-- FOR SHARE requires UPDATE visibility. Allow locking but reject every actual
-- UPDATE to this bucket, including upsert/overwrite and moves to other buckets.
DROP POLICY IF EXISTS sacute_media_lock ON storage.objects;
CREATE POLICY sacute_media_lock ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='post-media' AND public.sacute_admin_writes_enabled()) WITH CHECK (false);
CREATE POLICY sacute_media_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (bucket_id<>'post-media' OR public.sacute_admin_writes_enabled()) WITH CHECK (bucket_id<>'post-media');
DROP POLICY IF EXISTS sacute_media_delete ON storage.objects;
CREATE POLICY sacute_media_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='post-media' AND public.sacute_admin_writes_enabled() AND name ~ '^admin/[0-9a-f-]{36}\.(png|jpg|webp)$' AND NOT EXISTS (SELECT 1 FROM public.post_media m WHERE m.bucket=bucket_id AND m.storage_path=name));
DROP POLICY IF EXISTS sacute_media_delete_guard ON storage.objects;
CREATE POLICY sacute_media_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (bucket_id<>'post-media' OR (public.sacute_admin_writes_enabled() AND name ~ '^admin/[0-9a-f-]{36}\.(png|jpg|webp)$' AND NOT EXISTS (SELECT 1 FROM public.post_media m WHERE m.bucket=bucket_id AND m.storage_path=name)));

CREATE OR REPLACE FUNCTION public.admin_save_post(p_id uuid, p_input jsonb, p_expected jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid; v_old public.posts%ROWTYPE; v_new public.posts%ROWTYPE;
  v_post jsonb; v_current jsonb; v_scholarship jsonb; v_event jsonb; v_media jsonb;
  v_item jsonb; v_path text; v_position integer := 0; v_existing uuid;
BEGIN
  IF NOT public.sacute_admin_writes_enabled() THEN RAISE EXCEPTION 'Admin writes disabled or unauthorized' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_input)<>'object' OR jsonb_typeof(p_input->'post')<>'object' OR jsonb_typeof(p_input->'media')<>'array' THEN RAISE EXCEPTION 'Invalid payload' USING ERRCODE='22023'; END IF;
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
    v_path := v_item->>'storage_path';
    IF v_path IS NULL OR length(v_path) NOT BETWEEN 1 AND 512 OR v_path ~ '(^/|(^|/)\.\.?(/|$)|[\\?#%]|[[:cntrl:]])' OR v_path ~ '//' OR right(v_path,1)='/'
       OR length(coalesce(v_item->>'alt_text',''))>500 OR (v_item->>'is_cover') IS NULL THEN RAISE EXCEPTION 'Invalid media' USING ERRCODE='22023'; END IF;
    PERFORM id FROM storage.objects WHERE bucket_id='post-media' AND name=v_path AND lower(coalesce(metadata->>'mimetype','')) IN ('image/jpeg','image/png','image/webp','image/avif') FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Image missing or unsupported' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'storage_path') FROM jsonb_array_elements(p_input->'media')) <> jsonb_array_length(p_input->'media')
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
  DELETE FROM public.post_media WHERE post_id=v_id AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_input->'media') m WHERE m->>'storage_path'=storage_path);
  UPDATE public.post_media SET is_cover=false WHERE post_id=v_id AND is_cover;
  -- Temporary negative positions avoid clashes with normal nonnegative ordering
  -- only when no nonnegative CHECK exists. Instead use a high temporary offset.
  UPDATE public.post_media SET sort_order=sort_order+1000000 WHERE post_id=v_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_input->'media') LOOP
    SELECT id INTO v_existing FROM public.post_media WHERE post_id=v_id AND bucket='post-media' AND storage_path=v_item->>'storage_path';
    IF FOUND THEN
      UPDATE public.post_media SET alt_text=v_item->>'alt_text', width=(v_item->>'width')::integer, height=(v_item->>'height')::integer, sort_order=v_position, is_cover=(v_item->>'is_cover')::boolean WHERE id=v_existing;
    ELSE
      INSERT INTO public.post_media(post_id,bucket,storage_path,alt_text,width,height,sort_order,is_cover)
      VALUES(v_id,'post-media',v_item->>'storage_path',v_item->>'alt_text',(v_item->>'width')::integer,(v_item->>'height')::integer,v_position,(v_item->>'is_cover')::boolean);
    END IF;
    v_position:=v_position+1;
  END LOOP;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_post(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_post(uuid,jsonb,jsonb) TO authenticated;
COMMENT ON FUNCTION public.admin_save_post(uuid,jsonb,jsonb) IS 'Atomic CMS save. SECURITY INVOKER, admin check, RLS, immutable existing slug, optimistic snapshot. No service-role bypass.';
COMMIT;
