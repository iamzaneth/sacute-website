import { Controller, Get, Query } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { ScholarshipsService } from './scholarships.service';

@Controller('scholarships')
export class ScholarshipsController {
  constructor(private readonly service: ScholarshipsService) {}
  @Get()
  list(@Query() query: ListQueryDto) {
    return this.service.list(query);
  }
}
