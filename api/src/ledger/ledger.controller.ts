import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { Role } from '../../generated/prisma/enums';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { ReverseLedgerEntryDto } from './dto/reverse-ledger-entry.dto';
import { LedgerService } from './ledger.service';

@UseGuards(JwtAuthGuard, TenantMembershipGuard)
@Controller('tenants/:tenantId/ledger-entries')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Roles(Role.owner, Role.accountant, Role.staff)
  @Post()
  create(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateLedgerEntryDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ledgerService.createEntry(tenantId, user.sub, dto, idempotencyKey);
  }

  @Roles(Role.owner, Role.accountant)
  @Get()
  list(
    @Param('tenantId') tenantId: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.ledgerService.listEntries(tenantId, cursor, take ? Number(take) : undefined);
  }

  @Roles(Role.owner, Role.accountant)
  @Post(':entryId/reverse')
  reverse(
    @Param('tenantId') tenantId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReverseLedgerEntryDto,
  ) {
    return this.ledgerService.reverseEntry(tenantId, user.sub, entryId, dto);
  }
}
