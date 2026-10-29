import { Module } from '@nestjs/common';
import { ContentDataModule } from '../../common/content-data.module';
import { ScholarshipsController } from './scholarships.controller';
import { ScholarshipsService } from './scholarships.service';

@Module({
  imports: [ContentDataModule],
  controllers: [ScholarshipsController],
  providers: [ScholarshipsService],
})
export class ScholarshipsModule {}
