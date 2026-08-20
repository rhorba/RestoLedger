import { Module } from '@nestjs/common';
import { TenantMembershipGuard } from './guards/tenant-membership.guard';

@Module({
  providers: [TenantMembershipGuard],
  exports: [TenantMembershipGuard],
})
export class CommonModule {}
