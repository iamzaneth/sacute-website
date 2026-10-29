export function validateEnvironment(input: Record<string, unknown>) {
  const port = Number(input.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer from 1 to 65535');
  const mode = String(input.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(mode))
    throw new Error('Invalid NODE_ENV');
  const rawOrigins = String(
    input.CORS_ORIGINS ??
      (mode === 'production'
        ? ''
        : 'http://localhost:5173,http://localhost:4173'),
  );
  const origins = rawOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (mode === 'production' && !origins.length)
    throw new Error('CORS_ORIGINS is required in production');
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin)
      throw new Error('CORS_ORIGINS must contain exact HTTP origins');
  }
  return { ...input, PORT: port, CORS_ORIGINS: origins, NODE_ENV: mode };
}
