import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './modules/health/health.module';
import { InformationModule } from './modules/information/information.module';
import { ScholarshipsModule } from './modules/scholarships/scholarships.module';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    HealthModule,
    InformationModule,
    ScholarshipsModule,
    EventsModule,
  ],
})
export class AppModule {}
