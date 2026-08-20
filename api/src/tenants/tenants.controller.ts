import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Role } from '../../generated/prisma/enums';
import { AddMembershipDto } from './dto/add-membership.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  createTenant(@CurrentUser() user: JwtPayload, @Body() dto: CreateTenantDto) {
    return this.tenantsService.createTenant(user.sub, dto.name);
  }

  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.listMyTenants(user.sub);
  }

  @UseGuards(TenantMembershipGuard)
  @Roles(Role.owner)
  @Post(':tenantId/memberships')
  addMembership(
    @Param('tenantId') tenantId: string,
    @Body() dto: AddMembershipDto,
  ) {
    return this.tenantsService.addMembership(tenantId, dto);
  }
}
