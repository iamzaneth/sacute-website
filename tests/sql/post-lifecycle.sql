-- Disposable fixture ONLY. Roll back clock override, test rows and gate changes.
BEGIN;
CREATE OR REPLACE FUNCTION public.sacute_content_time()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(nullif(current_setting('sacute.fixture_now',true),'')::timestamptz,statement_timestamp()); $$;
SELECT set_config('sacute.fixture_now','2030-11-10T00:00:00Z',true);
UPDATE public.admin_cms_settings SET writes_enabled=true;
CREATE FUNCTION public.fixture_lifecycle_snapshot(v_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
 SELECT jsonb_build_object('post',jsonb_build_object('title',p.title,'slug',p.slug,'summary',p.summary,'content',p.content,'category',p.category,'kind',p.kind,'tags',p.tags,'status',p.status,'published_on',p.published_on,'published_at',p.published_at,'published_at_precision',p.published_at_precision,'visible_from',p.visible_from,'source_url',p.source_url,'event_name',p.event_name,'content_format',p.content_format),'scholarship',(SELECT jsonb_build_object('provider',provider,'eligibility',eligibility,'opens_at',opens_at,'closes_at',closes_at,'application_url',application_url,'lifecycle_status',lifecycle_status) FROM public.scholarship_details WHERE post_id=p.id),'event',NULL,'media',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'bucket',m.bucket,'storage_path',m.storage_path,'alt_text',m.alt_text,'width',m.width,'height',m.height,'sort_order',m.sort_order,'is_cover',m.is_cover) ORDER BY m.id) FROM public.post_media m WHERE m.post_id=p.id),'[]'::jsonb)) FROM public.posts p WHERE p.id=v_id;
$$;
INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('post-media','lifecycle/shared.png','{"mimetype":"image/png"}');
INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('draft-media','admin/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000084.png','{"mimetype":"image/png"}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE id_a uuid; r uuid; old_r uuid; payload jsonb; snapshot jsonb; historic date; img uuid; BEGIN
 payload:='{"intent":"draft","post":{"title":"Lifecycle","slug":"lifecycle-complete","summary":"Summary","content":"Body","kind":"scholarship","category":"Scholarship","content_format":"plain-text","status":"published","visible_from":"2999-01-01T00:00:00Z","published_on":null,"published_at":null,"published_at_precision":null,"tags":[],"source_url":null,"event_name":null},"media":[{"bucket":"post-media","storage_path":"lifecycle/shared.png","alt_text":"Keep","width":2,"height":2,"is_cover":true},{"bucket":"draft-media","storage_path":"admin/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000084.png","alt_text":"Private scheduled","width":2,"height":2,"is_cover":false}],"scholarship":{"provider":"Retained provider","eligibility":"Retained eligibility","lifecycle_status":"open"},"event":null}'::jsonb;
 id_a:=public.admin_save_post(NULL,payload,NULL);
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND status='draft' AND visible_from IS NULL) THEN RAISE EXCEPTION 'Draft/status mass assignment failed'; END IF;
 SELECT id INTO img FROM public.post_media WHERE post_id=id_a AND bucket='post-media';
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a;
 BEGIN PERFORM public.admin_transition_post(id_a,NULL,r); RAISE EXCEPTION 'NULL action accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM public.admin_transition_post(id_a,'schedule',r,'2030-11-15T07:00','Asia/Ho_Chi_Minh');
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND visible_from='2030-11-15T00:00:00Z'::timestamptz AND published_at=visible_from AND status='published') THEN RAISE EXCEPTION 'VN schedule conversion or initial publication metadata failed'; END IF;
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a;
 old_r:=r;
 PERFORM public.admin_transition_post(id_a,'reschedule',r,'2030-11-16T09:30','Asia/Ho_Chi_Minh');
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND visible_from='2030-11-16T02:30:00Z'::timestamptz AND published_at=visible_from) THEN RAISE EXCEPTION 'Reschedule failed'; END IF;
 BEGIN PERFORM public.admin_transition_post(id_a,'cancel_schedule',old_r); RAISE EXCEPTION 'Stale transition accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a;
 PERFORM public.admin_transition_post(id_a,'cancel_schedule',r);
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND status='draft' AND visible_from IS NULL) THEN RAISE EXCEPTION 'Cancel schedule failed'; END IF;
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a;
 BEGIN PERFORM public.admin_transition_post(id_a,'schedule',r,'2030-11-09T07:00','Asia/Ho_Chi_Minh'); RAISE EXCEPTION 'Past schedule accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.admin_transition_post(id_a,'schedule',r,'2030-02-30T07:00','Asia/Ho_Chi_Minh'); RAISE EXCEPTION 'Invalid date accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.admin_transition_post(id_a,'schedule',r,'2030-11-15T07:00','UTC');
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND visible_from='2030-11-15T07:00:00Z'::timestamptz) THEN RAISE EXCEPTION 'UTC schedule failed'; END IF;
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a;
 PERFORM public.admin_transition_post(id_a,'publish',r);
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND visible_from IS NULL AND published_at='2030-11-10T00:00:00Z'::timestamptz AND publication_recorded) THEN RAISE EXCEPTION 'Publish now failed to clear schedule or use database clock'; END IF;
 SELECT published_on,lifecycle_revision INTO historic,r FROM public.posts WHERE id=id_a;
 PERFORM public.admin_transition_post(id_a,'hide',r);
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND status='draft' AND visible_from IS NULL AND published_on=historic) THEN RAISE EXCEPTION 'Hide failed'; END IF;
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a; PERFORM public.admin_transition_post(id_a,'publish',r);
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a; PERFORM public.admin_transition_post(id_a,'archive',r);
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a; PERFORM public.admin_transition_post(id_a,'restore_archive',r);
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND status='draft' AND visible_from IS NULL) THEN RAISE EXCEPTION 'Archive restoration auto-published'; END IF;
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a; PERFORM public.admin_transition_post(id_a,'trash',r);
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND deleted_at IS NOT NULL AND deleted_by=auth.uid() AND slug='lifecycle-complete' AND published_on=historic) THEN RAISE EXCEPTION 'Trash audit or preservation failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.post_media WHERE post_id=id_a AND id=img) OR NOT EXISTS(SELECT 1 FROM public.scholarship_details WHERE post_id=id_a AND provider='Retained provider' AND eligibility='Retained eligibility') THEN RAISE EXCEPTION 'Trash lost associations'; END IF;
 BEGIN DELETE FROM public.posts WHERE id=id_a; RAISE EXCEPTION 'Permanent delete permission granted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_transition_post(id_a,'permanent_delete',r); RAISE EXCEPTION 'Permanent delete RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.posts SET deleted_at=NULL,status='published' WHERE id=id_a; RAISE EXCEPTION 'Raw restore republished'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a; PERFORM public.admin_transition_post(id_a,'restore_trash',r);
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND deleted_at IS NULL AND deleted_by IS NULL AND status='draft' AND visible_from IS NULL) THEN RAISE EXCEPTION 'Trash restoration failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='post-media' AND name='lifecycle/shared.png') THEN RAISE EXCEPTION 'Lifecycle removed Storage object'; END IF;
 -- Editing a scheduled post preserves schedule unless reschedule is explicit.
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a; PERFORM public.admin_transition_post(id_a,'schedule',r,'2030-11-15T07:00','Asia/Ho_Chi_Minh');
 SELECT lifecycle_revision INTO r FROM public.posts WHERE id=id_a;
 snapshot:=public.fixture_lifecycle_snapshot(id_a);
 payload:=jsonb_set(payload,'{post,title}','"Edited scheduled"');payload:=jsonb_set(payload,'{post,slug}','"lifecycle-complete"');payload:=jsonb_set(payload,'{intent}','"save"');payload:=jsonb_set(payload,'{revision}',to_jsonb(r::text));
 PERFORM public.admin_save_post(id_a,payload,snapshot);
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND title='Edited scheduled' AND visible_from='2030-11-15T00:00:00Z'::timestamptz AND published_on=historic) THEN RAISE EXCEPTION 'Edit changed schedule or historical publication date'; END IF;
 -- Direct child updates invalidate editor revisions too.
 SELECT lifecycle_revision INTO old_r FROM public.posts WHERE id=id_a;
 UPDATE public.scholarship_details SET provider='Edited provider' WHERE post_id=id_a;
 IF EXISTS(SELECT 1 FROM public.posts WHERE id=id_a AND lifecycle_revision=old_r) THEN RAISE EXCEPTION 'Child edit did not advance revision'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.posts WHERE slug='lifecycle-complete') THEN RAISE EXCEPTION 'Scheduled detail exposed before time'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='draft-media' AND name LIKE '%000000000084.png') THEN RAISE EXCEPTION 'Scheduled private bytes accessible'; END IF;
 IF EXISTS(SELECT 1 FROM public.post_media WHERE storage_path='lifecycle/shared.png') THEN RAISE EXCEPTION 'Scheduled association exposed'; END IF;
END $$;
SELECT set_config('sacute.fixture_now','2030-11-15T00:00:00Z',true);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='draft-media' AND name LIKE '%000000000084.png') THEN RAISE EXCEPTION 'Private image not readable at due time'; END IF; IF NOT EXISTS(SELECT 1 FROM public.posts WHERE slug='lifecycle-complete') THEN RAISE EXCEPTION 'Scheduled post not visible at exact instant'; END IF; END $$;
RESET ROLE;
UPDATE public.posts SET deleted_at=public.sacute_content_time(),deleted_by='00000000-0000-4000-8000-000000000001' WHERE slug='lifecycle-complete';
SET LOCAL ROLE anon;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='draft-media' AND name LIKE '%000000000084.png') THEN RAISE EXCEPTION 'Trashed private bytes still readable'; END IF; IF EXISTS(SELECT 1 FROM public.posts WHERE slug='lifecycle-complete') THEN RAISE EXCEPTION 'Published trashed row leaked'; END IF; END $$;
RESET ROLE;
-- Trash/restoration also retains event-specific data and reserves the slug.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE v_id uuid; rev uuid; BEGIN
 INSERT INTO public.posts(title,slug,summary,content,kind,category,status,content_format)
 VALUES('Event retained','lifecycle-event','Summary','Body','event','Event','draft','plain-text') RETURNING id INTO v_id;
 INSERT INTO public.event_details(post_id,starts_on,ends_on,location,lifecycle_status) VALUES(v_id,'2030-12-01','2030-12-02','Retained location','upcoming');
 SELECT lifecycle_revision INTO rev FROM public.posts WHERE id=v_id; PERFORM public.admin_transition_post(v_id,'trash',rev);
 BEGIN INSERT INTO public.posts(title,slug,summary,content,kind,category,status,content_format) VALUES('Conflict','lifecycle-event','Summary','Body','information','Info','draft','plain-text'); RAISE EXCEPTION 'Trash slug not reserved'; EXCEPTION WHEN unique_violation THEN NULL; END;
 SELECT lifecycle_revision INTO rev FROM public.posts WHERE id=v_id; PERFORM public.admin_transition_post(v_id,'restore_trash',rev);
 IF NOT EXISTS(SELECT 1 FROM public.event_details WHERE post_id=v_id AND location='Retained location' AND starts_on='2030-12-01') THEN RAISE EXCEPTION 'Event details lost'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 BEGIN PERFORM public.admin_transition_post(gen_random_uuid(),'publish',gen_random_uuid()); RAISE EXCEPTION 'Non-admin transition allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.admin_cms_settings SET writes_enabled=false;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 BEGIN PERFORM public.admin_transition_post(gen_random_uuid(),'trash',gen_random_uuid()); RAISE EXCEPTION 'Lifecycle DB gate bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Deleting an Auth user must preserve Trash and allow its audit FK to null.
SELECT set_config('request.jwt.claim.sub','',true);
DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000001';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.posts WHERE deleted_by='00000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Deletion audit FK failed to null'; END IF; END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN IF has_function_privilege(current_user,'public.admin_transition_post(uuid,text,uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous lifecycle EXECUTE'; END IF; END $$;
ROLLBACK;
