import { Injectable } from '@nestjs/common';
import { ContentRepository } from '../content/content.repository';
import { ListQueryDto } from '../../common/dto/list-query.dto';

@Injectable()
export class EventsService {
  constructor(private readonly repository: ContentRepository) {}
  list(query: ListQueryDto) {
    return this.repository.list('events', query);
  }
}
