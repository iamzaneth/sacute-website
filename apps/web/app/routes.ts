import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  route('admin/login', 'routes/admin/auth/login.tsx'),
  route('admin', 'routes/admin/layout.tsx', [
    index('routes/admin/dashboard.tsx'),
    route('posts', 'routes/admin/posts/index.tsx'),
    route('posts/new', 'routes/admin/posts/new.tsx'),
    route('posts/:id/edit', 'routes/admin/posts/edit.tsx'),
    route('media', 'routes/admin/media/index.tsx'),
    route('media/file', 'routes/admin/media/file.ts'),
    route('media/choices', 'routes/admin/media/choices.ts'),
  ]),
  route('media/posts/:id/:mediaId', 'routes/resources/public-media.ts'),
  route('resources/content', 'routes/resources/public-content.ts'),
  index('routes/public/home.tsx'),
  route('information', 'routes/public/content/information.tsx'),
  route('scholarships', 'routes/public/content/scholarships.tsx'),
  route('events', 'routes/public/content/events.tsx'),
  route('posts/:slug', 'routes/public/content/post.tsx'),
  route('contact', 'routes/public/contact.tsx'),
  route('recruitment', 'routes/public/recruitment.tsx'),
  route('*', 'routes/public/not-found.tsx'),
] satisfies RouteConfig;
