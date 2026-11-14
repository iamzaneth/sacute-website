import { Module } from '@nestjs/common';
import { ContentDataModule } from '../content/content-data.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [ContentDataModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
