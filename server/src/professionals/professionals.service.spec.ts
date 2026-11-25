import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { KycStatus, SubscriptionStatus } from '../database/enums';
import { ProfessionalsService } from './professionals.service';

describe('ProfessionalsService (TypeORM)', () => {
  const proRepo = {
    findOne: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  const userRepo = { findOne: vi.fn() };
  const categoryRepo = { find: vi.fn() };
  const portfolioRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn(), remove: vi.fn() };
  const gigRepo = { find: vi.fn() };
  const reviewRepo = { find: vi.fn() };
  const dataSource = { transaction: vi.fn() };
  const configService = { get: vi.fn() } as unknown as ConfigService;

  let service: ProfessionalsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProfessionalsService(
      dataSource as any,
      configService,
      proRepo as any,
      userRepo as any,
      categoryRepo as any,
      portfolioRepo as any,
      gigRepo as any,
      reviewRepo as any,
    );
  });

  it('sanitizes private fields like taxId and phoneNumber in public profiles', async () => {
    proRepo.findOne.mockResolvedValue({
      id: 'pro-1',
      userId: 'user-1',
      businessName: 'Reformas Carlos',
      taxId: '12345678Z',
      bio: '15 años de experiencia',
      isPro: true,
      kycStatus: KycStatus.VERIFIED,
      user: {
        id: 'user-1',
        isPro: true,
        profile: {
          firstName: 'Carlos',
          lastName: 'Ruiz',
          displayName: 'Carlos Ruiz',
          avatarUrl: null,
          phoneNumber: '+34611223344',
          city: 'Madrid',
          province: 'Madrid',
        },
        subscription: { status: SubscriptionStatus.ACTIVE },
      },
      categories: [],
      portfolioItems: [],
    });
    gigRepo.find.mockResolvedValue([]);
    reviewRepo.find.mockResolvedValue([]);

    const result = await service.getPublicProfile('pro-1');
    expect(result.id).toBe('pro-1');
    expect((result as Record<string, unknown>).taxId).toBeUndefined();
    expect(
      (result.user?.profile as Record<string, unknown> | undefined)?.phoneNumber,
    ).toBeUndefined();
  });

  it('throws NotFoundException when authenticated user has no pro profile', async () => {
    proRepo.findOne.mockResolvedValue(null);
    await expect(service.getMyProfile('missing-user')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('requires bio when creating a professional profile for the first time', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      roles: ['CLIENT'],
      professionalProfile: null,
    });

    await expect(
      service.updateMyProfile('user-1', { businessName: 'Sin Bio' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces Yewi Pro paywall on budget benchmark tool', async () => {
    proRepo.findOne.mockResolvedValue({
      id: 'pro-1',
      isPro: false,
      user: { isPro: false, subscription: { status: SubscriptionStatus.CANCELED } },
    });

    await expect(
      service.getBudgetBenchmark('user-1', { templateKey: 'reforma_bano' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns calibrated benchmark template when Yewi Pro is active', async () => {
    proRepo.findOne.mockResolvedValue({
      id: 'pro-1',
      isPro: true,
      user: { isPro: true, subscription: { status: SubscriptionStatus.ACTIVE } },
    });

    const result = await service.getBudgetBenchmark('user-1', {
      templateKey: 'reforma_bano',
      province: 'Madrid',
    });

    expect(result.mode).toBe('template');
    expect(result.provinceFactor).toBe(1.12);
    expect(result.template?.items.length).toBeGreaterThan(0);
  });
});
