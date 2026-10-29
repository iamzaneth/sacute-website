import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('information', 'routes/information.tsx'),
  route('scholarships', 'routes/scholarships.tsx'),
  route('events', 'routes/events.tsx'),
  route('contact', 'routes/contact.tsx'),
  route('recruitment', 'routes/recruitment.tsx'),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
