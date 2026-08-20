import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let prisma: any;
  let jwt: any;
  let config: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };
    config = {
      getOrThrow: jest.fn((key: string) => `secret-${key}`),
      get: jest.fn((_key: string, fallback: string) => fallback),
    };
    service = new AuthService(prisma, jwt, config);
  });

  describe('register', () => {
    it('rejects a duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'a@b.com',
          password: 'password123',
          fullName: 'A',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates the user and issues tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'a@b.com',
      });

      const result = await service.register({
        email: 'a@b.com',
        password: 'password123',
        fullName: 'A',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });
  });

  describe('login', () => {
    it('gives the same error for unknown email and wrong password (no user enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      let unknownEmailError: unknown;
      try {
        await service.login({ email: 'ghost@b.com', password: 'x' });
      } catch (e) {
        unknownEmailError = e;
      }

      const passwordHash = await bcrypt.hash('correct-password', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      let wrongPasswordError: unknown;
      try {
        await service.login({ email: 'a@b.com', password: 'wrong-password' });
      } catch (e) {
        wrongPasswordError = e;
      }

      expect(unknownEmailError).toBeInstanceOf(UnauthorizedException);
      expect(wrongPasswordError).toBeInstanceOf(UnauthorizedException);
      expect((unknownEmailError as UnauthorizedException).message).toBe(
        (wrongPasswordError as UnauthorizedException).message,
      );
    });

    it('locks the account after 5 failed attempts', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
        failedLoginAttempts: 4,
        lockedUntil: null,
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('rejects login while locked, even with the correct password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 60_000),
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'correct-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('succeeds and resets failed attempts on correct password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
        failedLoginAttempts: 2,
        lockedUntil: null,
      });

      const result = await service.login({
        email: 'a@b.com',
        password: 'correct-password',
      });

      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { failedLoginAttempts: 0, lockedUntil: null },
        }),
      );
    });
  });

  describe('refresh', () => {
    it('issues new tokens for a valid refresh token', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'a@b.com' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      const result = await service.refresh('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });

    it('rejects an invalid or expired refresh token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('expired'));

      await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token for a user that no longer exists', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'deleted-user',
        email: 'gone@b.com',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.refresh('valid-but-orphaned'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
