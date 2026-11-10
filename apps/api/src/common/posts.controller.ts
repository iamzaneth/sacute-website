import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ContentRepository } from './content.repository';
@Controller('posts')
export class PostsController {
  constructor(private readonly repository: ContentRepository) {}
  @Get(':slug')
  async get(@Param('slug') slug: string) {
    const item = await this.repository.getPostBySlug(slug);
    if (!item) throw new NotFoundException('Không tìm thấy bài viết');
    return { data: item, meta: { source: 'supabase' } };
  }
}
