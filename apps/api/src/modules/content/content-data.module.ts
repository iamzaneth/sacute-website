import { Module } from '@nestjs/common';
import {
  ContentRepository,
  CloudContentRepository,
} from './content.repository';
import { PostsController } from './posts.controller';
import { MediaController } from './media.controller';
@Module({
  providers: [{ provide: ContentRepository, useClass: CloudContentRepository }],
  controllers: [PostsController, MediaController],
  exports: [ContentRepository],
})
export class ContentDataModule {}
