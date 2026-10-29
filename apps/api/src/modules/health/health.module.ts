import { Controller, Get, Module } from '@nestjs/common';

@Controller('health')
class HealthController {
  @Get()
  getHealth() {
    return { data: { status: 'ok', service: 'sacute-api' } };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
