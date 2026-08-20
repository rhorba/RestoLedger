import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [CommonModule],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
