import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { publicMediaHeaders } from '@sacute/shared/content';
import { ContentRepository } from './content.repository';

@Controller('media/posts')
export class MediaController {
  constructor(private readonly repository: ContentRepository) {}
  @Get(':id/:mediaId')
  async get(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @Res({ passthrough: true })
    response: { set(headers: Record<string, string>): void },
  ) {
    response.set(publicMediaHeaders);
    const blob = await this.repository.readPublicMedia(id, mediaId);
    if (!blob) throw new NotFoundException('Không tìm thấy ảnh');
    return new StreamableFile(Buffer.from(await blob.arrayBuffer()), {
      type: blob.type,
    });
  }
}
