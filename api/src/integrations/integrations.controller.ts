import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { Role } from '../../generated/prisma/enums';
import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { IntegrationsService } from './integrations.service';

@Controller()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  @Roles(Role.owner, Role.accountant)
  @Post('tenants/:tenantId/integrations')
  connect(
    @Param('tenantId') tenantId: string,
    @Body() dto: ConnectIntegrationDto,
  ) {
    return this.integrationsService.connect(tenantId, dto);
  }

  // No JwtAuthGuard — this endpoint is authenticated by the webhook signature, not a user
  // session (architecture-restoledger.md §5 API design table).
  @Post('webhooks/pos/:provider/:connectionId')
  handleWebhook(
    @Param('provider') provider: string,
    @Param('connectionId') connectionId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature?: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body);
    return this.integrationsService.handleWebhook(
      connectionId,
      provider,
      rawBody,
      signature,
    );
  }
}
