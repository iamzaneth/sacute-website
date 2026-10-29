import { Module } from '@nestjs/common';
import {
  ContentRepository,
  LocalContentRepository,
} from './content.repository';

@Module({
  providers: [{ provide: ContentRepository, useClass: LocalContentRepository }],
  exports: [ContentRepository],
})
export class ContentDataModule {}
