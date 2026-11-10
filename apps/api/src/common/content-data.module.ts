import { Module } from '@nestjs/common';
import {
  ContentRepository,
  CloudContentRepository,
} from './content.repository';
import { PostsController } from './posts.controller';
@Module({
  providers: [{ provide: ContentRepository, useClass: CloudContentRepository }],
  controllers: [PostsController],
  exports: [ContentRepository],
})
export class ContentDataModule {}
