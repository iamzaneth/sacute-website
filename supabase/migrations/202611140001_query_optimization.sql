-- Additive read-only helpers after lifecycle migration 003.
-- Review/apply on staging first, then enable SACUTE_QUERY_RPC_ENABLED=true.
-- Only an explicit opaque-revision column grant; no write-gate changes or RLS bypass.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE OR REPLACE FUNCTION public.sacute_public_revision()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'revision', md5(coalesce(string_agg(p.id::text || ':' || p.lifecycle_revision::text, ',' ORDER BY p.id), '')),
    'now', public.sacute_content_time()
  ) FROM public.posts p
  WHERE p.status='published' AND p.deleted_at IS NULL
    AND (p.visible_from IS NULL OR p.visible_from<=public.sacute_content_time());
$$;
-- Only returns a digest of the rows the caller can read. Child-table mutations
-- touch lifecycle_revision via 003; scheduled posts enter the digest at DB time.
CREATE OR REPLACE FUNCTION public.sacute_admin_revision()
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT md5(coalesce(string_agg(p.id::text || ':' || p.lifecycle_revision::text || ':' ||
    public.sacute_lifecycle_state(p.status::text,p.deleted_at,p.visible_from,public.sacute_content_time()), ',' ORDER BY p.id), ''))
  FROM public.posts p WHERE public.sacute_is_admin();
$$;
CREATE OR REPLACE FUNCTION public.sacute_admin_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_object_agg(state,total), '{}'::jsonb) FROM (
    SELECT public.sacute_lifecycle_state(p.status::text,p.deleted_at,p.visible_from,public.sacute_content_time()) AS state,
      count(*) AS total FROM public.posts p WHERE public.sacute_is_admin() GROUP BY 1
  ) totals;
$$;
CREATE OR REPLACE FUNCTION public.sacute_event_categories()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(name ORDER BY name), '[]'::jsonb) FROM (
    SELECT DISTINCT coalesce(p.event_name,p.category) AS name FROM public.posts p
    WHERE p.kind='event' AND p.status='published' AND p.deleted_at IS NULL
      AND (p.visible_from IS NULL OR p.visible_from<=public.sacute_content_time())
      AND coalesce(p.event_name,p.category)<>''
  ) names;
$$;
REVOKE ALL ON FUNCTION public.sacute_public_revision(), public.sacute_admin_revision(), public.sacute_admin_counts(), public.sacute_event_categories() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sacute_public_revision(), public.sacute_event_categories() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sacute_admin_revision(), public.sacute_admin_counts() TO authenticated;
-- Grant only opaque revision metadata for the anonymous invoker under RLS;
-- do not expose editor-only columns.
GRANT SELECT(lifecycle_revision) ON public.posts TO anon;
COMMIT;
