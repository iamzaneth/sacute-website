import type { Config } from '@react-router/dev/config';
import { publicRoutes } from '@sacute/shared';

export default { ssr: false, prerender: [...publicRoutes] } satisfies Config;
