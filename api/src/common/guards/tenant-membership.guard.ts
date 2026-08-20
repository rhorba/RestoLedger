import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../../auth/jwt-payload.interface';
import { Role } from '../../../generated/prisma/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';

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
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.params?.tenantId;
    const user: JwtPayload | undefined = request.user;

    if (!tenantId || !user) {
      throw new ForbiddenException('Tenant membership required');
    }

    const membership = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.sub } },
      }),
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this tenant');
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles?.length && !requiredRoles.includes(membership.role as Role)) {
      throw new ForbiddenException('Your role does not permit this action');
    }

    request.tenantId = tenantId;
    request.tenantRole = membership.role;
    return true;
  }
}
