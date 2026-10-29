import { ConfigService } from '@nestjs/config';
import { createApplication } from './application';

async function bootstrap() {
  const app = await createApplication();
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}
bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
