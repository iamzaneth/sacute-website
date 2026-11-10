-- Disposable PostgreSQL fixture only. NEVER apply to a Supabase project.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
CREATE TABLE public.admin_profiles(user_id uuid PRIMARY KEY, role text NOT NULL CHECK (role IN ('admin','editor')));
CREATE TABLE public.posts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, kind text NOT NULL,
 title text NOT NULL, summary text NOT NULL, content text NOT NULL, category text NOT NULL,
 content_format text NOT NULL, original_title text, event_name text, tags text[], author_name text,
 author_url text, source_url text, status text NOT NULL, visible_from timestamptz, published_on date,
 published_at timestamptz, published_at_precision text, created_by uuid, updated_by uuid
);
CREATE TABLE public.scholarship_details(post_id uuid PRIMARY KEY REFERENCES public.posts, provider text, eligibility text, opens_at timestamptz, closes_at timestamptz, application_url text, lifecycle_status text);
CREATE TABLE public.event_details(post_id uuid PRIMARY KEY REFERENCES public.posts, starts_at timestamptz, ends_at timestamptz, starts_on date, ends_on date, location text, registration_url text, lifecycle_status text);
CREATE TABLE public.post_media(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid NOT NULL REFERENCES public.posts,bucket text NOT NULL,storage_path text NOT NULL UNIQUE,alt_text text,width int,height int,sort_order int CHECK(sort_order>=0),is_cover boolean,source_metadata jsonb);
CREATE UNIQUE INDEX fixture_media_order ON public.post_media(post_id,sort_order);
CREATE UNIQUE INDEX fixture_media_cover ON public.post_media(post_id) WHERE is_cover;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,UNIQUE(bucket_id,name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.buckets TO anon,authenticated;
CREATE POLICY fixture_legacy_buckets ON storage.buckets FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
-- Deliberately insecure legacy grants/policies; migration guards must constrain them.
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;
GRANT UPDATE(role) ON public.admin_profiles TO authenticated;
CREATE POLICY fixture_legacy_all ON public.posts FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
CREATE POLICY fixture_legacy_profiles ON public.admin_profiles FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
CREATE POLICY fixture_legacy_storage ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
INSERT INTO storage.buckets VALUES('post-media','post-media',true,10485760,ARRAY['image/png','image/jpeg','image/webp','image/avif']);
INSERT INTO public.admin_profiles VALUES('00000000-0000-4000-8000-000000000001','admin'),('00000000-0000-4000-8000-000000000002','editor');
INSERT INTO public.posts(slug,kind,title,summary,content,category,content_format,status,published_on,published_at_precision)
VALUES('public-post','information','Public','Summary','Content','Notice','plain-text','published','2026-01-01','date'),('draft-post','information','Private','Summary','Content','Notice','plain-text','draft',NULL,NULL);
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users(id) VALUES('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
