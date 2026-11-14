import { Controller, Get, Query } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { InformationService } from './information.service';

@Controller('information')
export class InformationController {
  constructor(private readonly service: InformationService) {}
  @Get()
  list(@Query() query: ListQueryDto) {
    return this.service.list(query);
  }
}
