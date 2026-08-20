import { ForbiddenException } from '@nestjs/common';
import { TenantMembershipGuard } from './tenant-membership.guard';

function mockContext(
  params: Record<string, string>,
  user: { sub: string } | undefined,
) {
  const request: any = { params, user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('TenantMembershipGuard', () => {
  let prisma: any;
  let reflector: any;
  let guard: TenantMembershipGuard;

  beforeEach(() => {
    prisma = { withTenant: jest.fn() };
    reflector = { getAllAndOverride: jest.fn() };
    guard = new TenantMembershipGuard(prisma, reflector);
  });

  it('rejects when there is no tenantId param', async () => {
    const ctx = mockContext({}, { sub: 'u1' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects when the user has no membership for this tenant (cross-tenant access)', async () => {
    prisma.withTenant.mockResolvedValue(null);
    const ctx = mockContext({ tenantId: 't1' }, { sub: 'u1' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.withTenant).toHaveBeenCalledWith('t1', expect.any(Function));
  });

  it('rejects when the role is not in the required list', async () => {
    prisma.withTenant.mockResolvedValue({ role: 'staff' });
    reflector.getAllAndOverride.mockReturnValue(['owner', 'accountant']);
    const ctx = mockContext({ tenantId: 't1' }, { sub: 'u1' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows access and attaches tenantId/tenantRole when membership + role match', async () => {
    prisma.withTenant.mockResolvedValue({ role: 'owner' });
    reflector.getAllAndOverride.mockReturnValue(['owner', 'accountant']);
    const request: any = { params: { tenantId: 't1' }, user: { sub: 'u1' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.tenantId).toBe('t1');
    expect(request.tenantRole).toBe('owner');
  });

  it('allows access when no roles are required (any member)', async () => {
    prisma.withTenant.mockResolvedValue({ role: 'staff' });
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = mockContext({ tenantId: 't1' }, { sub: 'u1' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
