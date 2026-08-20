import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { Role } from '../../generated/prisma/enums';
import { ReportingService } from './reporting.service';

@UseGuards(JwtAuthGuard, TenantMembershipGuard)
@Controller('tenants/:tenantId/dashboard')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Roles(Role.owner, Role.accountant)
  @Get()
  getDashboard(@Param('tenantId') tenantId: string) {
    return this.reportingService.getDashboardSummary(tenantId);
  }
}
