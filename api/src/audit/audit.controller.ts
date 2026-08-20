import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { Role } from '../../generated/prisma/enums';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard, TenantMembershipGuard)
@Controller('tenants/:tenantId/audit-log')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Roles(Role.owner, Role.accountant)
  @Get()
  list(
    @Param('tenantId') tenantId: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.auditService.list(tenantId, cursor, take ? Number(take) : undefined);
  }
}
