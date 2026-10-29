import { Controller, Get, Query } from '@nestjs/common';
import { ListQueryDto } from '../../common/list-query.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}
  @Get()
  list(@Query() query: ListQueryDto) {
    return this.service.list(query);
  }
}
