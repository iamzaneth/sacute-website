import { Module } from '@nestjs/common';
import { ContentDataModule } from '../content/content-data.module';
import { InformationController } from './information.controller';
import { InformationService } from './information.service';

@Module({
  imports: [ContentDataModule],
  controllers: [InformationController],
  providers: [InformationService],
})
export class InformationModule {}
