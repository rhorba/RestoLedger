import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../../auth/jwt-payload.interface';
import { Role } from '../../../generated/prisma/enums';
import type { TenantMembership } from '../../../generated/prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface TenantScopedRequest extends Request {
  user?: JwtPayload;
  tenantId?: string;
  tenantRole?: Role;
}

/**
 * Enforces PRD FR-2 / ADR-2: every tenant-scoped endpoint requires the caller to be a member
 * of the `:tenantId` route param, with a role in the endpoint's @Roles() list. Runs the
 * membership lookup itself through PrismaService.withTenant so it is subject to the same
 * RLS-backed tenant scoping as every other query — this guard cannot be bypassed by a route
 * that "forgets" to check it manually, because there is no other way to safely read
 * tenant_membership.
 *
 * Attaches `request.tenantId` and `request.tenantRole` for controllers/services to use.
 */
@Injectable()
export class TenantMembershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantScopedRequest>();
    const rawTenantId = request.params?.tenantId;
    const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
    const user = request.user;

    if (!tenantId || !user) {
      throw new ForbiddenException('Tenant membership required');
    }

    const membership: TenantMembership | null = await this.prisma.withTenant(
      tenantId,
      (tx) =>
        tx.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId, userId: user.sub } },
        }),
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this tenant');
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Your role does not permit this action');
    }

    request.tenantId = tenantId;
    request.tenantRole = membership.role;
    return true;
  }
}
