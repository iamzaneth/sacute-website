-- Assertions for disposable fixture database after the proposed migration.
-- Run with psql -v ON_ERROR_STOP=1. Every assertion raises on failure.
BEGIN;
-- Isolated fixture only; rollback restores the gate to false.
UPDATE public.admin_cms_settings SET writes_enabled=true;
 INSERT INTO storage.objects(bucket_id,name,metadata) VALUES
 ('post-media','admin/00000000-0000-4000-8000-000000000001.png','{"mimetype":"image/png"}'),
 ('post-media','admin/00000000-0000-4000-8000-000000000002.png','{"mimetype":"image/png"}');
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.posts)<>1 THEN RAISE EXCEPTION 'anon can see private posts'; END IF;
 IF public.sacute_is_admin() THEN RAISE EXCEPTION 'anon admin escalation'; END IF;
 IF (SELECT count(*) FROM public.admin_profiles)<>0 THEN RAISE EXCEPTION 'anon membership leak'; END IF;
 BEGIN
  PERFORM created_by FROM public.posts; RAISE EXCEPTION 'internal editor UUID leaked';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   INSERT INTO public.posts(slug,kind,title,summary,content,category,content_format,status) VALUES('attack','information','x','x','x','x','plain-text','draft');
   RAISE EXCEPTION 'anon insert succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.admin_save_post(NULL,'{}',NULL); RAISE EXCEPTION 'anon RPC succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF public.sacute_is_admin() THEN RAISE EXCEPTION 'non-admin escalation'; END IF;
 IF (SELECT count(*) FROM public.posts)<>1 THEN RAISE EXCEPTION 'non-admin sees drafts'; END IF;
 BEGIN
  UPDATE public.admin_profiles SET role='admin'; RAISE EXCEPTION 'self-promotion succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.admin_save_post(NULL,'{}',NULL); RAISE EXCEPTION 'non-admin RPC succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO storage.objects(bucket_id,name) VALUES('post-media','admin/00000000-0000-4000-8000-000000000001.png'); RAISE EXCEPTION 'non-admin upload succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE payload jsonb; v_post_id uuid; shared_id uuid; snapshot jsonb; before_title text;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.sacute_is_admin()'::regprocedure AND prosecdef) THEN RAISE EXCEPTION 'role helper elevated'; END IF;
 IF NOT public.sacute_is_admin() OR (SELECT count(*) FROM public.posts)<>2 THEN RAISE EXCEPTION 'admin cannot read drafts'; END IF;

 payload := '{"post":{"title":"New title","slug":"new-post","summary":"Summary","content":"Content","category":"Notice","kind":"information","content_format":"plain-text","tags":[],"status":"published","published_on":"2026-11-10","published_at":null,"published_at_precision":"date","visible_from":null,"source_url":null,"event_name":null},"scholarship":null,"event":null,"media":[{"storage_path":"admin/00000000-0000-4000-8000-000000000001.png","alt_text":"One","width":1,"height":1,"is_cover":true},{"storage_path":"admin/00000000-0000-4000-8000-000000000002.png","alt_text":"Two","width":1,"height":1,"is_cover":false}]}'::jsonb;
 v_post_id := public.admin_save_post(NULL,payload,NULL);
 IF (SELECT count(*) FROM public.post_media WHERE post_media.post_id=v_post_id)<>2 THEN RAISE EXCEPTION 'media save failed'; END IF;
 -- Snapshot matching the SSR query projection, then reverse gallery order/cover.
 SELECT jsonb_build_object('post', jsonb_build_object('title',p.title,'slug',p.slug,'summary',p.summary,'content',p.content,'category',p.category,'kind',p.kind,'tags',p.tags,'status',p.status,'published_on',p.published_on,'published_at',p.published_at,'published_at_precision',p.published_at_precision,'visible_from',p.visible_from,'source_url',p.source_url,'event_name',p.event_name,'content_format',p.content_format), 'scholarship',NULL,'event',NULL,'media',(SELECT jsonb_agg(jsonb_build_object('id',m.id,'bucket',m.bucket,'storage_path',m.storage_path,'alt_text',m.alt_text,'width',m.width,'height',m.height,'sort_order',m.sort_order,'is_cover',m.is_cover) ORDER BY m.id) FROM public.post_media m WHERE m.post_id=p.id)) INTO snapshot FROM public.posts p WHERE p.id=v_post_id;
 payload:=jsonb_set(payload,'{media}',jsonb_build_array(jsonb_set(payload->'media'->1,'{is_cover}','true'),jsonb_set(payload->'media'->0,'{is_cover}','false')));
 PERFORM public.admin_save_post(v_post_id,payload,snapshot);
 IF NOT EXISTS(SELECT 1 FROM public.post_media m WHERE m.post_id=v_post_id AND m.sort_order=0 AND m.is_cover AND m.alt_text='Two') THEN RAISE EXCEPTION 'ordering/cover failed'; END IF;
 BEGIN
  PERFORM public.admin_save_post(v_post_id,payload,snapshot); RAISE EXCEPTION 'stale snapshot accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  UPDATE storage.objects SET name='changed.png' WHERE name='admin/00000000-0000-4000-8000-000000000001.png'; RAISE EXCEPTION 'overwrite allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- Shared existing object across two posts must work.
 payload:=jsonb_set(payload,'{post,slug}','"shared-image-post"');
 shared_id:=public.admin_save_post(NULL,payload,NULL);
 IF shared_id=v_post_id THEN RAISE EXCEPTION 'create reused id'; END IF;
 DELETE FROM storage.objects WHERE bucket_id='post-media' AND name='admin/00000000-0000-4000-8000-000000000001.png';
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE name='admin/00000000-0000-4000-8000-000000000001.png') THEN RAISE EXCEPTION 'used image deleted'; END IF;
 -- Failure late in a save must roll back post and details together.
 payload:=jsonb_set(payload,'{post,slug}','"failed-post"');
 payload:=jsonb_set(payload,'{media,0,storage_path}','"missing.png"');
 BEGIN
  PERFORM public.admin_save_post(NULL,payload,NULL); RAISE EXCEPTION 'missing image accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.posts WHERE slug='failed-post') THEN RAISE EXCEPTION 'failed transaction leaked a post'; END IF;
END $$;
ROLLBACK;
