import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { vi } from 'vitest';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { CategoriesController } from '../src/categories/categories.controller';
import { CategoriesService } from '../src/categories/categories.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { User } from '../src/database/entities';
import { UserRole } from '../src/database/enums';
import { NotificationsController } from '../src/notifications/notifications.controller';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PaymentsController } from '../src/payments/payments.controller';
import { PaymentsService } from '../src/payments/payments.service';

const TEST_JWT_SECRET = 'yewi_e2e_security_test_secret_min_32_bytes_2026';

describe('Security, RBAC & IDOR (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockCategoriesService = {
    getCategoryTree: vi.fn().mockResolvedValue([{ id: 'cat-1', name: 'Electricidad' }]),
    getBySlugOrId: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'Electricidad' }),
    create: vi.fn().mockResolvedValue({ id: 'cat-2', name: 'Nueva' }),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const mockNotificationsService = {
    getMyNotifications: vi.fn().mockResolvedValue([]),
    getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 0, count: 0 }),
    markAllAsRead: vi.fn().mockResolvedValue({ success: true, count: 0 }),
    markAsRead: vi.fn(async (userId: string, id: string) => {
      if (userId !== 'user-b' && id === 'notif-of-user-b') {
        throw new NotFoundException('Notificación no encontrada');
      }
      return { id, userId, isRead: true };
    }),
    registerPushToken: vi.fn().mockResolvedValue({ success: true }),
    unregisterPushToken: vi.fn().mockResolvedValue({ success: true }),
    createNotification: vi.fn().mockResolvedValue({ id: 'n-test' }),
    deleteNotifications: vi.fn().mockResolvedValue({ success: true, count: 0 }),
    deleteNotification: vi.fn().mockResolvedValue({ success: true, count: 1 }),
  };

  const mockPaymentsService = {
    getIapCatalog: vi.fn().mockReturnValue({ products: [] }),
    createStripeCheckoutSession: vi.fn().mockResolvedValue({
      sessionId: 'cs_test_1',
      url: 'https://checkout.stripe.com/test',
      amount: 20,
      currency: 'EUR',
    }),
    confirmStripeCheckoutSession: vi.fn(async (userId: string, sessionId: string) => {
      if (userId !== 'user-b' && sessionId === 'cs_of_user_b') {
        throw new ForbiddenException('No tienes permiso sobre esta sesión de pago');
      }
      return { confirmed: true, duplicate: false };
    }),
  };

  const signToken = (sub: string, email: string, roles: UserRole[]) =>
    jwtService.sign({ sub, email, roles });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [
        CategoriesController,
        NotificationsController,
        PaymentsController,
      ],
      providers: [
        JwtStrategy,
        RolesGuard,
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'jwt.secret' || key === 'JWT_SECRET'
                ? TEST_JWT_SECRET
                : undefined,
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: vi.fn(async ({ where }: { where?: { id?: string } }) => {
              const id = where?.id;
              if (id === 'admin-1') {
                return {
                  id: 'admin-1',
                  email: 'admin@yewi.test',
                  roles: [UserRole.ADMIN],
                  isActive: true,
                };
              }
              if (id === 'user-a' || id === 'user-b') {
                return {
                  id,
                  email: `${id}@yewi.test`,
                  roles: [UserRole.CLIENT],
                  isActive: true,
                };
              }
              return null;
            }),
          },
        },
        { provide: CategoriesService, useValue: mockCategoriesService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('allows public endpoints without authentication', async () => {
    await request(app.getHttpServer()).get('/categories/tree').expect(200);
    await request(app.getHttpServer()).get('/payments/iap/products').expect(200);
  });

  it('blocks protected endpoints when Authorization header is missing (401)', async () => {
    await request(app.getHttpServer()).get('/notifications').expect(401);
    await request(app.getHttpServer())
      .post('/payments/stripe/checkout')
      .send({ purchaseType: 'WALLET_TOPUP', amount: 20 })
      .expect(401);
    await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Test', slug: 'test' })
      .expect(401);
  });

  it('blocks non-admin user from admin endpoints (403)', async () => {
    const clientToken = signToken('user-a', 'a@yewi.test', [UserRole.CLIENT]);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ name: 'Hacked', slug: 'hacked' })
      .expect(403);
  });

  it('allows admin user on admin endpoints (201)', async () => {
    const adminToken = signToken('admin-1', 'admin@yewi.test', [UserRole.ADMIN]);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Jardinería', slug: 'jardineria' })
      .expect(201);
  });

  it('rejects mass-assignment / unexpected fields via ValidationPipe (400)', async () => {
    const clientToken = signToken('user-a', 'a@yewi.test', [UserRole.CLIENT]);

    await request(app.getHttpServer())
      .post('/payments/stripe/checkout')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        purchaseType: 'WALLET_TOPUP',
        amount: 20,
        role: 'ADMIN',
        isPro: true,
      })
      .expect(400);
  });

  it('prevents IDOR when user A tries to access user B resources (403/404)', async () => {
    const userAToken = signToken('user-a', 'a@yewi.test', [UserRole.CLIENT]);

    await request(app.getHttpServer())
      .post('/payments/stripe/confirm/cs_of_user_b')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch('/notifications/notif-of-user-b/read')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(404);
  });
});
