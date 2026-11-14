import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  route('admin/login', 'routes/admin-login.tsx'),
  route('admin', 'routes/admin-layout.tsx', [
    index('routes/admin-dashboard.tsx'),
    route('posts', 'routes/admin-posts.tsx'),
    route('posts/new', 'routes/admin-post-new.tsx'),
    route('posts/:id/edit', 'routes/admin-post-edit.tsx'),
    route('media', 'routes/admin-media.tsx'),
    route('media/file', 'routes/admin-media-file.ts'),
    route('media/choices', 'routes/admin-media-choices.ts'),
  ]),
  route('media/posts/:id/:mediaId', 'routes/public-media.ts'),
  route('resources/content', 'routes/public-content.ts'),
  index('routes/home.tsx'),
  route('information', 'routes/information.tsx'),
  route('scholarships', 'routes/scholarships.tsx'),
  route('events', 'routes/events.tsx'),
  route('posts/:slug', 'routes/post.tsx'),
  route('contact', 'routes/contact.tsx'),
  route('recruitment', 'routes/recruitment.tsx'),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
