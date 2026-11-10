-- Isolated fixture assertions for 002, including legacy permissive policies.
BEGIN;
INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('draft-media','admin/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000081.png','{"mimetype":"image/png"}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE n integer; BEGIN
 IF public.sacute_admin_writes_enabled() THEN RAISE EXCEPTION 'DB gate is not false by default'; END IF;
 BEGIN
  PERFORM public.admin_save_post(NULL,'{}',NULL); RAISE EXCEPTION 'RPC bypassed disabled DB gate';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.posts(slug,kind,title,summary,content,category,content_format,status) VALUES('bypass','information','x','x','x','x','plain-text','draft'); RAISE EXCEPTION 'REST insert bypass';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.posts SET title='bypass'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'REST update bypass'; END IF;
 DELETE FROM public.posts; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'REST delete bypass'; END IF;
 BEGIN
  INSERT INTO storage.objects(bucket_id,name) VALUES('draft-media','admin/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000082.png'); RAISE EXCEPTION 'Upload bypass';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 DELETE FROM storage.objects WHERE bucket_id='draft-media'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Delete bypass'; END IF;
 BEGIN UPDATE public.admin_cms_settings SET writes_enabled=true; RAISE EXCEPTION 'Admin enabled own DB gate'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='draft-media') THEN RAISE EXCEPTION 'Anonymous private metadata leak'; END IF;
 IF has_function_privilege(current_user,'public.admin_save_post(uuid,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous RPC EXECUTE'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='draft-media') THEN RAISE EXCEPTION 'Non-admin private metadata leak'; END IF;
END $$;
RESET ROLE;
UPDATE public.admin_cms_settings SET writes_enabled=true;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE payload jsonb; v_id uuid; n integer; BEGIN
 UPDATE storage.buckets SET public=true WHERE id='draft-media'; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Admin changed staging visibility'; END IF;
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES('post-media','admin/00000000-0000-4000-8000-000000000082.png'); RAISE EXCEPTION 'Public upload allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 payload:='{"post":{"title":"Private","slug":"private-media-test","summary":"Summary","content":"Content","category":"Notice","kind":"information","content_format":"plain-text","tags":[],"status":"draft","published_on":"2026-11-10","published_at":null,"published_at_precision":"date","visible_from":null,"source_url":null,"event_name":null},"scholarship":null,"event":null,"media":[{"bucket":"draft-media","storage_path":"admin/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000081.png","alt_text":"Private","width":2,"height":2,"is_cover":true}]}'::jsonb;
 v_id:=public.admin_save_post(NULL,payload,NULL);
 IF NOT EXISTS(SELECT 1 FROM public.post_media WHERE post_id=v_id AND bucket='draft-media') THEN RAISE EXCEPTION 'Private draft association failed'; END IF;
 BEGIN
  UPDATE public.posts SET status='published' WHERE id=v_id;
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE EXCEPTION 'Direct REST published private media';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SET CONSTRAINTS ALL DEFERRED;
 payload:=jsonb_set(payload,'{post,status}','"published"');
 payload:=jsonb_set(payload,'{post,slug}','"private-publish-blocked"');
 BEGIN PERFORM public.admin_save_post(NULL,payload,NULL); RAISE EXCEPTION 'RPC published private media'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 payload:=jsonb_set(payload,'{post,status}','"draft"');
 BEGIN PERFORM public.admin_save_post(NULL,payload-'media',NULL); RAISE EXCEPTION 'Missing media accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 -- A failure after post and scholarship INSERTs must roll back all changes.
 payload:=jsonb_set(payload,'{post,slug}','"late-rollback"');
 payload:=jsonb_set(payload,'{post,kind}','"scholarship"');
 payload:=jsonb_set(payload,'{scholarship}','{"provider":"Test","lifecycle_status":"open"}');
 payload:=jsonb_set(payload,'{media,0,width}','"invalid-int"');
 BEGIN PERFORM public.admin_save_post(NULL,payload,NULL); RAISE EXCEPTION 'Late invalid media accepted'; EXCEPTION WHEN invalid_text_representation THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.posts WHERE slug='late-rollback') THEN RAISE EXCEPTION 'Partial post persisted'; END IF;
 IF EXISTS(SELECT 1 FROM public.scholarship_details WHERE provider='Test') THEN RAISE EXCEPTION 'Partial detail persisted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('sacute_is_admin','sacute_admin_writes_enabled','admin_save_post','sacute_protect_referenced_media','sacute_validate_media_publication','sacute_lock_content_parent') AND p.prosecdef) THEN RAISE EXCEPTION 'CMS function elevated privileges'; END IF;
 IF has_function_privilege('anon','public.sacute_lock_content_parent()','EXECUTE') OR has_function_privilege('authenticated','public.sacute_protect_referenced_media()','EXECUTE') THEN RAISE EXCEPTION 'Trigger helper exposed as RPC'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='draft-media' AND public) THEN RAISE EXCEPTION 'Private bucket public'; END IF; END $$;
ROLLBACK;
