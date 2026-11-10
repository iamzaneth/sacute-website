-- READ ONLY. Run manually in the Supabase SQL editor as the project owner.
-- Contains no credentials, auth.users payloads, mutations, or row content.
BEGIN TRANSACTION READ ONLY;
SELECT current_database(), current_user, version();
SELECT n.nspname AS schema_name, c.relname, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls, pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname = 'public' AND c.relname IN ('posts','post_media','scholarship_details','event_details','admin_profiles','admin_cms_settings'))
   OR (n.nspname = 'storage' AND c.relname IN ('objects','buckets'));
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname, tablename, policyname;
SELECT table_schema, table_name, grantee, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE table_schema IN ('public','storage') ORDER BY table_schema, table_name, grantee;
SELECT nspname, pg_get_userbyid(nspowner) AS owner, nspacl
FROM pg_namespace WHERE nspname IN ('public','storage','auth');
SELECT table_schema, table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema IN ('public','storage') ORDER BY table_schema, table_name, column_name;
SELECT table_schema, table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE (table_schema = 'public' AND table_name IN ('posts','post_media','scholarship_details','event_details','admin_profiles','admin_cms_settings'))
   OR (table_schema = 'storage' AND table_name IN ('objects','buckets'))
ORDER BY table_schema, table_name, ordinal_position;
SELECT conrelid::regclass AS relation, conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('public.posts'::regclass,'public.post_media'::regclass,'public.scholarship_details'::regclass,'public.event_details'::regclass,'public.admin_profiles'::regclass)
ORDER BY conrelid::regclass::text, conname;
SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('posts','post_media','scholarship_details','event_details','admin_profiles','admin_cms_settings');
-- Only counts and allowed role values, never email/password/token data.
SELECT role, count(*) FROM public.admin_profiles GROUP BY role;
SELECT count(*) AS duplicate_memberships FROM (
  SELECT coalesce(to_jsonb(p)->>'user_id',to_jsonb(p)->>'id') AS membership_key FROM public.admin_profiles p GROUP BY 1 HAVING count(*) > 1
) duplicates;
SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;
SELECT bucket_id, count(*) AS object_count FROM storage.objects GROUP BY bucket_id;
-- Inspect triggers including Auth provisioning: metadata must never grant admin.
SELECT n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid) AS definition,
       t.tgfoid::regprocedure AS function_name
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname IN ('public','storage','auth');
-- Review SECURITY DEFINER functions, callable RPCs, owners, grants and bodies.
-- Existing elevated RPCs can bypass RLS: restrictive policies alone cannot fix them.
SELECT n.nspname, p.oid::regprocedure AS function_name, p.prosecdef AS security_definer,
       p.provolatile, pg_get_userbyid(p.proowner) AS owner, p.proacl, p.proconfig,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind = 'f' AND n.nspname IN ('public')
   OR (p.prokind = 'f' AND p.oid IN (
      SELECT tgfoid FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('storage.objects'::regclass,'auth.users'::regclass)
   ));
SELECT defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl FROM pg_default_acl;
SELECT r.rolname, r.rolsuper, r.rolbypassrls, r.rolinherit, m.roleid::regrole AS member_of
FROM pg_roles r LEFT JOIN pg_auth_members m ON m.member = r.oid
WHERE r.rolname IN ('anon','authenticated','authenticator');
-- Effective EXECUTE includes PUBLIC defaults and inherited grants; proacl alone
-- does not prove an RPC is inaccessible. Inspect overloads, not just base names.
SELECT r.rolname,n.nspname,p.oid::regprocedure AS function_name,p.prosecdef,
 has_function_privilege(r.oid,p.oid,'EXECUTE') AS can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator')
 AND p.prokind='f' AND (n.nspname='public' OR (p.prosecdef AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'))
ORDER BY n.nspname,p.oid::regprocedure::text,r.rolname;
SELECT r.rolname,n.nspname,c.relname,
 has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
 has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,
 has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete,
 has_table_privilege(r.oid,c.oid,'TRUNCATE') AS can_truncate
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','storage') AND r.rolname IN ('anon','authenticated');
-- Review non-public trigger functions too, including content/audit triggers.
SELECT p.oid::regprocedure,p.prosecdef,p.proacl,p.proconfig,pg_get_functiondef(p.oid)
FROM pg_proc p WHERE p.prokind='f' AND p.oid IN (
 SELECT t.tgfoid FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND n.nspname IN ('public','storage','auth')
);
SELECT p.status,m.bucket,count(*) FROM public.posts p JOIN public.post_media m ON m.post_id=p.id GROUP BY p.status,m.bucket;
-- Legacy CMS paths may already be public and unattached; do not delete them.
SELECT o.bucket_id,count(*) AS legacy_cms_objects,
 count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM public.post_media m WHERE m.bucket=o.bucket_id AND m.storage_path=o.name)) AS unattached
FROM storage.objects o WHERE o.bucket_id='post-media' AND o.name LIKE 'admin/%' GROUP BY o.bucket_id;
SELECT to_regclass('public.admin_cms_settings') AS database_gate_table;
-- Full FK dependency graph (including inbound references outside known tables).
-- Required before any future hard deletion/cleanup; no CASCADE is authorized.
SELECT c.conrelid::regclass AS referencing_table,c.confrelid::regclass AS referenced_table,
 c.conname,c.convalidated,pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c WHERE c.contype='f' AND (
 c.confrelid IN ('public.posts'::regclass,'public.post_media'::regclass,'public.scholarship_details'::regclass,'public.event_details'::regclass)
 OR c.conrelid IN ('public.posts'::regclass,'public.post_media'::regclass,'public.scholarship_details'::regclass,'public.event_details'::regclass));
-- Schema-compatible lifecycle inventory, including pre-migration databases.
SELECT status,count(*) AS records,
 count(*) FILTER(WHERE to_jsonb(p)->>'deleted_at' IS NOT NULL) AS trashed,
 count(*) FILTER(WHERE status='published' AND visible_from>statement_timestamp()) AS future
FROM public.posts p GROUP BY status;
ROLLBACK;
