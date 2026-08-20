import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/enums';
import { AddMembershipDto } from './dto/add-membership.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Self-serve tenant creation: any authenticated user can create a tenant and becomes its
   * owner. There is no separate firm_admin bootstrap step in v1 — deviates slightly from the
   * firm_admin-creates-tenants model sketched in security-restoledger.md §4, logged as a
   * deliberate Sprint 1 simplification in .logs/corrections.md (avoids a chicken-and-egg
   * bootstrap problem with no code cost — firm_admin-mediated onboarding is a Sprint 2+ concern
   * once there's an actual multi-accountant-firm workflow to support).
   */
  async createTenant(ownerId: string, name: string) {
    const tenant = await this.prisma.tenant.create({ data: { name } });

    await this.prisma.withTenant(tenant.id, (tx) =>
      tx.tenantMembership.create({
        data: { tenantId: tenant.id, userId: ownerId, role: Role.owner },
      }),
    );

    return tenant;
  }

  async listMyTenants(userId: string) {
    return this.prisma.withUser(userId, (tx) =>
      tx.tenantMembership.findMany({
        where: { userId },
        include: { tenant: true },
      }),
    );
  }

  async addMembership(tenantId: string, dto: AddMembershipDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const user = await tx.user.findUnique({ where: { email: dto.email } });
      if (!user) {
        throw new NotFoundException('No account exists for this email — they must register first');
      }

      return tx.tenantMembership.create({
        data: { tenantId, userId: user.id, role: dto.role },
      });
    });
  }
}
