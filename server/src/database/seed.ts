import 'reflect-metadata';
import * as argon2 from 'argon2';
import { AppDataSource } from './data-source';
import {
  Category,
  Gig,
  GigExtra,
  GigPackage,
  LedgerTransaction,
  Order,
  PortfolioItem,
  ProfessionalProfile,
  Profile,
  Promotion,
  QuoteProposal,
  Review,
  ServiceRequest,
  Status,
  User,
  Wallet,
} from './entities/index';
import {
  CategoryType,
  EscrowStatus,
  GigStatus,
  KycStatus,
  LeadStatus,
  OrderStatus,
  OrderType,
  PackageTier,
  ProposalStatus,
  StatusMediaType,
  TransactionStatus,
  TransactionType,
  UserRole,
} from './enums';

interface CategorySeed {
  name: string;
  slug: string;
  description: string;
  icon: string;
  type: CategoryType;
  baseLeadCreditCost: number;
  sortOrder: number;
}

const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: 'Electricidad',
    slug: 'electricidad',
    description: 'Instalaciones eléctricas, boletines CIE, cuadros y averías urgentes.',
    icon: 'zap',
    type: CategoryType.HYBRID,
    baseLeadCreditCost: 8,
    sortOrder: 1,
  },
  {
    name: 'Fontanería',
    slug: 'fontaneria',
    description: 'Reparación de fugas, desatascos, grifería, termos y calderas.',
    icon: 'droplet',
    type: CategoryType.HYBRID,
    baseLeadCreditCost: 8,
    sortOrder: 2,
  },
  {
    name: 'Baños',
    slug: 'banos',
    description: 'Reformas de baño, cambio de bañera por ducha y mamparas.',
    icon: 'grid',
    type: CategoryType.HYBRID,
    baseLeadCreditCost: 12,
    sortOrder: 3,
  },
  {
    name: 'Cocina',
    slug: 'cocina',
    description: 'Diseño y montaje de cocinas a medida, encimeras y mobiliario.',
    icon: 'layers',
    type: CategoryType.HYBRID,
    baseLeadCreditCost: 14,
    sortOrder: 4,
  },
  {
    name: 'Pladur',
    slug: 'pladur',
    description: 'Tabiquería seca, techos continuos y aislamiento acústico.',
    icon: 'columns',
    type: CategoryType.HYBRID,
    baseLeadCreditCost: 9,
    sortOrder: 5,
  },
  {
    name: 'Pintura',
    slug: 'pintura',
    description: 'Pintores profesionales para alisado de gotelé e interiores.',
    icon: 'edit-3',
    type: CategoryType.HYBRID,
    baseLeadCreditCost: 8,
    sortOrder: 6,
  },
  {
    name: 'Manitas',
    slug: 'manitas',
    description: 'Pequeñas reparaciones del hogar, muebles, lámparas y cortinas.',
    icon: 'tool',
    type: CategoryType.HYBRID,
    baseLeadCreditCost: 6,
    sortOrder: 7,
  },
  {
    name: 'Suelos',
    slug: 'suelos',
    description: 'Instalación de tarima flotante, parquet, microcemento y gres.',
    icon: 'square',
    type: CategoryType.HYBRID,
    baseLeadCreditCost: 10,
    sortOrder: 8,
  },
  {
    name: 'Reformas Integrales',
    slug: 'reformas',
    description: 'Reformas completas de viviendas, locales comerciales y albañilería.',
    icon: 'home',
    type: CategoryType.HYBRID,
    baseLeadCreditCost: 15,
    sortOrder: 9,
  },
  {
    name: 'Climatización',
    slug: 'climatizacion',
    description: 'Instalación de aire acondicionado, calderas y aerotermia.',
    icon: 'wind',
    type: CategoryType.HYBRID,
    baseLeadCreditCost: 12,
    sortOrder: 10,
  },
  {
    name: 'Cerrajería',
    slug: 'cerrajeria',
    description: 'Apertura de puertas, cerraduras antibumping y bombines.',
    icon: 'key',
    type: CategoryType.LEAD,
    baseLeadCreditCost: 10,
    sortOrder: 11,
  },
  {
    name: 'Diseño Web & Digital',
    slug: 'diseno-web',
    description: 'Páginas web, tiendas online, branding y posicionamiento SEO.',
    icon: 'monitor',
    type: CategoryType.GIG,
    baseLeadCreditCost: 9,
    sortOrder: 12,
  },
];

function monthsAgoDate(monthsAgo: number, day = 14): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 11, 30, 0);
}

function hoursFromNowDate(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function seed(): Promise<void> {
  await AppDataSource.initialize();

  const categoryRepo = AppDataSource.getRepository(Category);
  const userRepo = AppDataSource.getRepository(User);
  const profileRepo = AppDataSource.getRepository(Profile);
  const proRepo = AppDataSource.getRepository(ProfessionalProfile);
  const walletRepo = AppDataSource.getRepository(Wallet);
  const ledgerRepo = AppDataSource.getRepository(LedgerTransaction);
  const portfolioRepo = AppDataSource.getRepository(PortfolioItem);
  const gigRepo = AppDataSource.getRepository(Gig);
  const gigPkgRepo = AppDataSource.getRepository(GigPackage);
  const gigExtraRepo = AppDataSource.getRepository(GigExtra);
  const promoRepo = AppDataSource.getRepository(Promotion);
  const reqRepo = AppDataSource.getRepository(ServiceRequest);
  const proposalRepo = AppDataSource.getRepository(QuoteProposal);
  const orderRepo = AppDataSource.getRepository(Order);
  const reviewRepo = AppDataSource.getRepository(Review);
  const statusRepo = AppDataSource.getRepository(Status);

  // 1. Categorías sincronizadas con client/src/lib/categories.ts
  const validSlugs = new Set(DEFAULT_CATEGORIES.map((c) => c.slug));
  const categoryBySlug = new Map<string, Category>();

  for (const item of DEFAULT_CATEGORIES) {
    let existing = await categoryRepo.findOne({ where: { slug: item.slug } });
    if (!existing) {
      existing = categoryRepo.create({ ...item, isActive: true });
    } else {
      categoryRepo.merge(existing, { ...item, isActive: true });
    }
    const saved = await categoryRepo.save(existing);
    categoryBySlug.set(saved.slug, saved);
  }

  // Ocultar categorías antiguas heredadas sin romper relaciones existentes
  const allExistingCategories = await categoryRepo.find();
  for (const cat of allExistingCategories) {
    if (!validSlugs.has(cat.slug) && cat.isActive) {
      cat.isActive = false;
      await categoryRepo.save(cat);
    }
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'Password123!#';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'AdminPassword123!#';

  const ensureUser = async (params: {
    email: string;
    password: string;
    roles: UserRole[];
    firstName: string;
    lastName: string;
    displayName: string;
    phone?: string;
    avatarUrl?: string;
    isPro?: boolean;
    city?: string;
    province?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    businessName?: string;
    bio?: string;
    hourlyRate?: number;
    avgRating?: number;
    totalReviews?: number;
    completedOrdersCount?: number;
    badges?: string[];
    skills?: string[];
    categorySlugs?: string[];
    creditBalance?: number;
    fiatAvailableBalance?: number;
    fiatPendingBalance?: number;
  }): Promise<{
    user: User;
    wallet: Wallet;
    pro: ProfessionalProfile | null;
  }> => {
    let user = await userRepo.findOne({ where: { email: params.email } });
    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          email: params.email,
          passwordHash: await argon2.hash(params.password),
          roles: params.roles,
          isActive: true,
          isEmailVerified: true,
          isPro: Boolean(params.isPro),
        }),
      );
    } else if (params.isPro !== undefined && user.isPro !== Boolean(params.isPro)) {
      user.isPro = Boolean(params.isPro);
      user.roles = params.roles;
      await userRepo.save(user);
    }

    let profile = await profileRepo.findOne({ where: { userId: user.id } });
    if (!profile) {
      profile = await profileRepo.save(
        profileRepo.create({
          userId: user.id,
          firstName: params.firstName,
          lastName: params.lastName,
          displayName: params.displayName,
          phoneNumber: params.phone ?? null,
          phoneVerified: Boolean(params.phone),
          avatarUrl: params.avatarUrl ?? null,
          city: params.city ?? 'Madrid',
          province: params.province ?? params.city ?? 'Madrid',
          postalCode: params.postalCode ?? '28001',
          country: 'ES',
          preferredLanguage: 'es',
        }),
      );
    }

    let wallet = await walletRepo.findOne({ where: { userId: user.id } });
    if (!wallet) {
      wallet = await walletRepo.save(
        walletRepo.create({
          userId: user.id,
          creditBalance:
            params.creditBalance ??
            (params.roles.includes(UserRole.PROFESSIONAL) ? 60 : 20),
          fiatPendingBalance: params.fiatPendingBalance ?? 0,
          fiatAvailableBalance: params.fiatAvailableBalance ?? 0,
          currency: 'EUR',
        }),
      );
    } else if (
      wallet.creditBalance === 0 &&
      wallet.fiatAvailableBalance === 0 &&
      ((params.creditBalance ?? 0) > 0 || (params.fiatAvailableBalance ?? 0) > 0)
    ) {
      wallet.creditBalance = params.creditBalance ?? wallet.creditBalance;
      wallet.fiatAvailableBalance =
        params.fiatAvailableBalance ?? wallet.fiatAvailableBalance;
      wallet.fiatPendingBalance =
        params.fiatPendingBalance ?? wallet.fiatPendingBalance;
      wallet = await walletRepo.save(wallet);
    }

    let pro: ProfessionalProfile | null = null;
    if (params.roles.includes(UserRole.PROFESSIONAL)) {
      const cats = (params.categorySlugs ?? [])
        .map((s) => categoryBySlug.get(s))
        .filter((c): c is Category => Boolean(c));

      pro = await proRepo.findOne({
        where: { userId: user.id },
        relations: { categories: true },
      });
      if (!pro) {
        pro = await proRepo.save(
          proRepo.create({
            userId: user.id,
            businessName: params.businessName ?? params.displayName,
            bio:
              params.bio ??
              `Profesional verificado en Yewi (${params.city ?? 'Madrid'}).`,
            isPro: Boolean(params.isPro),
            hourlyRate: params.hourlyRate ?? 42,
            kycStatus: KycStatus.VERIFIED,
            city: params.city ?? 'Madrid',
            province: params.province ?? params.city ?? 'Madrid',
            postalCode: params.postalCode ?? '28001',
            country: 'ES',
            latitude: params.latitude ?? 40.4168,
            longitude: params.longitude ?? -3.7038,
            serviceRadiusKm: 50,
            avgRating: params.avgRating ?? 4.9,
            totalReviews: params.totalReviews ?? 12,
            completedOrdersCount: params.completedOrdersCount ?? 20,
            responseTimeHours: 1,
            responseRatePercent: 99,
            badges: params.badges ?? ['Identidad verificada', 'Garantía Yewi'],
            skills: params.skills ?? [],
            categories: cats,
          }),
        );
      } else {
        pro.isPro = Boolean(params.isPro);
        pro.categories = cats.length > 0 ? cats : pro.categories;
        pro.badges = params.badges ?? pro.badges;
        pro.skills = params.skills ?? pro.skills;
        if (pro.avgRating === 0 && params.avgRating) {
          pro.avgRating = params.avgRating;
          pro.totalReviews = params.totalReviews ?? pro.totalReviews;
          pro.completedOrdersCount =
            params.completedOrdersCount ?? pro.completedOrdersCount;
        }
        pro = await proRepo.save(pro);
      }
    }

    return { user, wallet, pro };
  };

  // 2. Usuarios base + 5 profesionales verificados
  await ensureUser({
    email: 'admin@yewi.com',
    password: adminPassword,
    roles: [UserRole.ADMIN, UserRole.CLIENT],
    firstName: 'Admin',
    lastName: 'Yewi',
    displayName: 'Admin Yewi',
  });

  const laura = await ensureUser({
    email: 'laura.cliente@ejemplo.com',
    password: demoPassword,
    roles: [UserRole.CLIENT],
    firstName: 'Laura',
    lastName: 'Martínez',
    displayName: 'Laura Martínez',
    phone: '+34612345678',
    city: 'Madrid',
    postalCode: '28004',
    creditBalance: 25,
    fiatAvailableBalance: 480,
  });

  const diego = await ensureUser({
    email: 'diego.cliente@ejemplo.com',
    password: demoPassword,
    roles: [UserRole.CLIENT],
    firstName: 'Diego',
    lastName: 'Fernández',
    displayName: 'Diego Fernández',
    phone: '+34622445566',
    city: 'Barcelona',
    province: 'Barcelona',
    postalCode: '08008',
    creditBalance: 15,
    fiatAvailableBalance: 320,
  });

  const carlos = await ensureUser({
    email: 'carlos.fontanero@ejemplo.com',
    password: demoPassword,
    roles: [UserRole.CLIENT, UserRole.PROFESSIONAL],
    firstName: 'Carlos',
    lastName: 'Ruiz',
    displayName: 'Carlos Ruiz',
    phone: '+34633112233',
    isPro: true,
    businessName: 'Fontanería y Reformas Carlos',
    bio: 'Especialista en fontanería urgente, cambio de calderas, reforma integral de baños y boletines sanitarios en Madrid.',
    hourlyRate: 45,
    avgRating: 4.9,
    totalReviews: 24,
    completedOrdersCount: 41,
    city: 'Madrid',
    postalCode: '28010',
    badges: ['Yewi Pro', 'Respuesta rápida', 'Seguro RC'],
    skills: ['Fontanería', 'Calderas', 'Baños', 'Detección de fugas'],
    categorySlugs: ['fontaneria', 'banos', 'reformas'],
    creditBalance: 85,
    fiatAvailableBalance: 1840,
    fiatPendingBalance: 340,
  });

  const elena = await ensureUser({
    email: 'elena.electricista@ejemplo.com',
    password: demoPassword,
    roles: [UserRole.CLIENT, UserRole.PROFESSIONAL],
    firstName: 'Elena',
    lastName: 'Navarro',
    displayName: 'Elena Navarro',
    phone: '+34644223344',
    isPro: true,
    businessName: 'Voltaje Seguro Madrid',
    bio: 'Ingeniera electricista autorizada. Boletines CIE, cuadros diferenciales, cargadores VE y climatización inverter.',
    hourlyRate: 48,
    avgRating: 4.9,
    totalReviews: 18,
    completedOrdersCount: 33,
    city: 'Madrid',
    postalCode: '28006',
    latitude: 40.4312,
    longitude: -3.6815,
    badges: ['Yewi Pro', 'Instalador autorizado', 'Urgencias 24h'],
    skills: ['Boletín CIE', 'Cuadro eléctrico', 'Domótica', 'Aerotermia'],
    categorySlugs: ['electricidad', 'climatizacion'],
    creditBalance: 70,
    fiatAvailableBalance: 1420,
    fiatPendingBalance: 220,
  });

  const mateo = await ensureUser({
    email: 'mateo.pintor@ejemplo.com',
    password: demoPassword,
    roles: [UserRole.CLIENT, UserRole.PROFESSIONAL],
    firstName: 'Mateo',
    lastName: 'Serrano',
    displayName: 'Mateo Serrano',
    phone: '+34655334455',
    isPro: false,
    businessName: 'Acabados y Pladur Serrano',
    bio: 'Alisado de paredes sin polvo, pintura decorativa mate, techos de pladur y tarimas flotantes AC5.',
    hourlyRate: 36,
    avgRating: 4.8,
    totalReviews: 15,
    completedOrdersCount: 22,
    city: 'Madrid',
    postalCode: '28015',
    latitude: 40.4285,
    longitude: -3.7112,
    badges: ['Identidad verificada', 'Presupuesto cerrado'],
    skills: ['Quitar gotelé', 'Pladur acústico', 'Tarima AC5', 'Microcemento'],
    categorySlugs: ['pintura', 'pladur', 'suelos'],
    creditBalance: 55,
    fiatAvailableBalance: 890,
    fiatPendingBalance: 150,
  });

  const sofia = await ensureUser({
    email: 'sofia.cocinas@ejemplo.com',
    password: demoPassword,
    roles: [UserRole.CLIENT, UserRole.PROFESSIONAL],
    firstName: 'Sofía',
    lastName: 'Morales',
    displayName: 'Sofía Morales',
    phone: '+34666445577',
    isPro: true,
    businessName: 'Estudio Cocinas & Baños Sofía',
    bio: 'Interiorista y jefa de obra especializada en cocinas a medida, encimeras porcelánicas y reforma llave en mano.',
    hourlyRate: 52,
    avgRating: 5.0,
    totalReviews: 12,
    completedOrdersCount: 19,
    city: 'Valencia',
    province: 'Valencia',
    postalCode: '46004',
    latitude: 39.4699,
    longitude: -0.3763,
    badges: ['Yewi Pro', '5 estrellas', 'Diseño 3D incluido'],
    skills: ['Cocinas a medida', 'Porcelánico', 'Reformas integrales', 'Baños'],
    categorySlugs: ['cocina', 'banos', 'reformas'],
    creditBalance: 90,
    fiatAvailableBalance: 2240,
    fiatPendingBalance: 560,
  });

  const javier = await ensureUser({
    email: 'javier.digital@ejemplo.com',
    password: demoPassword,
    roles: [UserRole.CLIENT, UserRole.PROFESSIONAL],
    firstName: 'Javier',
    lastName: 'Ortega',
    displayName: 'Javier Ortega',
    phone: '+34677556688',
    isPro: true,
    businessName: 'Órbita Digital & Manitas Express',
    bio: 'Diseño web corporativo para pymes y reformas en Barcelona, además de servicio técnico y montaje de smart home.',
    hourlyRate: 50,
    avgRating: 4.9,
    totalReviews: 14,
    completedOrdersCount: 27,
    city: 'Barcelona',
    province: 'Barcelona',
    postalCode: '08007',
    latitude: 41.3874,
    longitude: 2.1686,
    badges: ['Yewi Pro', 'Entrega puntual'],
    skills: ['Diseño Web', 'SEO Local', 'Smart Home', 'Manitas'],
    categorySlugs: ['diseno-web', 'manitas', 'cerrajeria'],
    creditBalance: 65,
    fiatAvailableBalance: 1310,
    fiatPendingBalance: 180,
  });

  // 3. Portfolio Items
  const ensurePortfolio = async (params: {
    pro: ProfessionalProfile;
    title: string;
    description: string;
    imageUrls: string[];
    tags: string[];
  }) => {
    const exists = await portfolioRepo.findOne({
      where: { professionalProfileId: params.pro.id, title: params.title },
    });
    if (!exists) {
      await portfolioRepo.save(
        portfolioRepo.create({
          professionalProfileId: params.pro.id,
          title: params.title,
          description: params.description,
          imageUrls: params.imageUrls,
          tags: params.tags,
        }),
      );
    }
  };

  if (carlos.pro) {
    await ensurePortfolio({
      pro: carlos.pro,
      title: 'Reforma integral baño en Chamberí',
      description: 'Sustitución de bañera por plato de ducha de resina antideslizante, grifería empotrada termostática y revestimiento porcelánico.',
      imageUrls: ['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80'],
      tags: ['Baños', 'Fontanería', 'Ducha'],
    });
  }
  if (elena.pro) {
    await ensurePortfolio({
      pro: elena.pro,
      title: 'Cuadro eléctrico completo y domótica KNX',
      description: 'Renovación de acometida, protecciones contra sobretensiones y certificado CIE registrado en Industria.',
      imageUrls: ['https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=900&q=80'],
      tags: ['Electricidad', 'Boletín CIE', 'Madrid'],
    });
  }
  if (sofia.pro) {
    await ensurePortfolio({
      pro: sofia.pro,
      title: 'Cocina abierta con isla de cuarzo mate',
      description: 'Diseño 3D, fontanería oculta para isla, iluminación LED lineal y muebles lacados antihuella.',
      imageUrls: ['https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80'],
      tags: ['Cocina', 'Reforma', 'Interiorismo'],
    });
  }

  // 4. Gigs + Paquetes + Extras
  const ensureGig = async (params: {
    slug: string;
    pro: ProfessionalProfile;
    categorySlug: string;
    title: string;
    description: string;
    coverImages: string[];
    searchTags: string[];
    requirements: string[];
    avgRating: number;
    totalReviews: number;
    ordersCount: number;
    isFeatured: boolean;
    packages: Array<{
      tier: PackageTier;
      name: string;
      description: string;
      price: number;
      deliveryDays: number;
      revisions: number;
      features: string[];
      isPopular?: boolean;
    }>;
    extras: Array<{
      title: string;
      description: string;
      price: number;
      additionalDeliveryDays: number;
    }>;
  }): Promise<Gig> => {
    let gig = await gigRepo.findOne({ where: { slug: params.slug } });
    const category = categoryBySlug.get(params.categorySlug)!;
    if (!gig) {
      gig = await gigRepo.save(
        gigRepo.create({
          professionalProfileId: params.pro.id,
          categoryId: category.id,
          title: params.title,
          slug: params.slug,
          description: params.description,
          coverImages: params.coverImages,
          searchTags: params.searchTags,
          pdfDocuments: [],
          requirements: params.requirements,
          status: GigStatus.ACTIVE,
          avgRating: params.avgRating,
          totalReviews: params.totalReviews,
          ordersCount: params.ordersCount,
          isFeatured: params.isFeatured,
        }),
      );
      for (const pkg of params.packages) {
        await gigPkgRepo.save(
          gigPkgRepo.create({
            gigId: gig.id,
            tier: pkg.tier,
            name: pkg.name,
            description: pkg.description,
            price: pkg.price,
            deliveryDays: pkg.deliveryDays,
            revisions: pkg.revisions,
            features: pkg.features,
            isPopular: Boolean(pkg.isPopular),
          }),
        );
      }
      for (const extra of params.extras) {
        await gigExtraRepo.save(
          gigExtraRepo.create({
            gigId: gig.id,
            title: extra.title,
            description: extra.description,
            price: extra.price,
            additionalDeliveryDays: extra.additionalDeliveryDays,
          }),
        );
      }
    }
    return gig;
  };

  const savedGigs: Gig[] = [];

  if (carlos.pro) {
    savedGigs.push(
      await ensureGig({
        slug: 'reparacion-urgente-fugas-griferia-y-termos-madrid',
        pro: carlos.pro,
        categorySlug: 'fontaneria',
        title: 'Reparación urgente de fugas, grifería y termos en el día',
        description:
          'Diagnóstico acústico de fugas ocultas, sustitución de llaves de paso, instalación de grifería termostática y revisión de termos eléctricos o calderas con garantía de 1 año.',
        coverImages: [
          'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1000&q=80',
        ],
        searchTags: ['fontanero', 'fuga', 'grifo', 'termo', 'urgencia'],
        requirements: [
          'Fotos del punto afectado o llave de paso',
          'Código postal y disponibilidad horaria',
        ],
        avgRating: 4.9,
        totalReviews: 14,
        ordersCount: 28,
        isFeatured: true,
        packages: [
          {
            tier: PackageTier.BASIC,
            name: 'Revisión y ajuste',
            description: 'Diagnóstico en domicilio y pequeña reparación de grifo o sifón.',
            price: 69,
            deliveryDays: 1,
            revisions: 1,
            features: ['Desplazamiento incluido', 'Prueba de presión', 'Garantía 12 meses'],
          },
          {
            tier: PackageTier.STANDARD,
            name: 'Sustitución completa',
            description: 'Cambio de grifería, latiguillos, mecanismo de cisterna o sellado.',
            price: 135,
            deliveryDays: 1,
            revisions: 2,
            isPopular: true,
            features: ['Material estándar incluido', 'Desmontaje y retirada', 'Garantía 24 meses'],
          },
          {
            tier: PackageTier.PREMIUM,
            name: 'Instalación termo / caldera',
            description: 'Montaje completo de termo eléctrico o revisión integral circuito.',
            price: 290,
            deliveryDays: 2,
            revisions: 2,
            features: ['Válvula de seguridad nueva', 'Purgado completo', 'Certificado puesta en marcha'],
          },
        ],
        extras: [
          {
            title: 'Atención urgente en menos de 2h',
            description: 'Prioridad inmediata en Madrid capital.',
            price: 35,
            additionalDeliveryDays: 0,
          },
          {
            title: 'Grifería monomando gama alta',
            description: 'Suministro de grifo latón cromado certificado.',
            price: 75,
            additionalDeliveryDays: 0,
          },
        ],
      }),
    );

    savedGigs.push(
      await ensureGig({
        slug: 'cambio-banera-por-plato-de-ducha-antideslizante',
        pro: carlos.pro,
        categorySlug: 'banos',
        title: 'Cambio de bañera por plato de ducha y mampara en 48h',
        description:
          'Transforma tu baño sin obra molesta en dos días. Incluye retirada de bañera antigua, nivelación, plato de resina mineral pizarra antideslizante y mampara templada 6mm.',
        coverImages: [
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
        ],
        searchTags: ['baño', 'ducha', 'mampara', 'reforma baño'],
        requirements: ['Medidas aproximadas de la bañera actual', 'Foto frontal del baño'],
        avgRating: 5.0,
        totalReviews: 10,
        ordersCount: 15,
        isFeatured: true,
        packages: [
          {
            tier: PackageTier.BASIC,
            name: 'Plato + instalación',
            description: 'Retirada de bañera y montaje de plato resina hasta 120cm.',
            price: 690,
            deliveryDays: 2,
            revisions: 1,
            features: ['Plato antideslizante C3', 'Válvula extraplana', 'Contenedor escombros'],
          },
          {
            tier: PackageTier.STANDARD,
            name: 'Plato + alicatado + grifo',
            description: 'Incluye franja cerámica porcelánica y columna termostática.',
            price: 1180,
            deliveryDays: 2,
            revisions: 1,
            isPopular: true,
            features: ['Cerámica hasta 6m²', 'Grifería termostática', 'Sellado antimoho'],
          },
          {
            tier: PackageTier.PREMIUM,
            name: 'Pack completo + mampara',
            description: 'Todo incluido con mampara fija/corredera antical y muebles.',
            price: 1650,
            deliveryDays: 3,
            revisions: 2,
            features: ['Mampara templada antical', 'Garantía estanqueidad 5 años', 'Limpieza final'],
          },
        ],
        extras: [
          {
            title: 'Asiento abatible y asidero inox',
            description: 'Accesibilidad completa para personas mayores.',
            price: 140,
            additionalDeliveryDays: 0,
          },
        ],
      }),
    );
  }

  if (elena.pro) {
    savedGigs.push(
      await ensureGig({
        slug: 'boletin-electrico-cie-y-renovacion-cuadro-luces',
        pro: elena.pro,
        categorySlug: 'electricidad',
        title: 'Boletín eléctrico oficial CIE y renovación de cuadro de luces',
        description:
          'Instaladora autorizada por Industria en Comunidad de Madrid. Emisión y tramitación telemática de Certificado de Instalación Eléctrica (CIE) más actualización de diferenciales e ICP.',
        coverImages: [
          'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1000&q=80',
        ],
        searchTags: ['electricista', 'boletin', 'cie', 'cuadro', 'diferencial'],
        requirements: ['Foto del cuadro eléctrico actual', 'Potencia contratada deseada'],
        avgRating: 4.9,
        totalReviews: 18,
        ordersCount: 33,
        isFeatured: true,
        packages: [
          {
            tier: PackageTier.BASIC,
            name: 'Inspección y diagnóstico',
            description: 'Medición de toma de tierra, aislamientos y revisión de cuadro.',
            price: 75,
            deliveryDays: 1,
            revisions: 1,
            features: ['Medición homologada', 'Informe de seguridad', 'Asesoría potencia'],
          },
          {
            tier: PackageTier.STANDARD,
            name: 'Boletín CIE completo',
            description: 'Certificado registrado en Industria listo para tu comercializadora.',
            price: 165,
            deliveryDays: 2,
            revisions: 1,
            isPopular: true,
            features: ['Tasas autonómicas tramitadas', 'Copia PDF digital 48h', 'Visado técnico'],
          },
          {
            tier: PackageTier.PREMIUM,
            name: 'Cuadro nuevo + CIE',
            description: 'Sustitución completa de magnetotérmicos, protector sobretensiones y CIE.',
            price: 420,
            deliveryDays: 2,
            revisions: 2,
            features: ['Material Schneider/ABB', 'Protector sobretensiones', 'Boletín incluido'],
          },
        ],
        extras: [
          {
            title: 'Tramitación urgente en 24h',
            description: 'Prioridad máxima de registro en sede electrónica.',
            price: 45,
            additionalDeliveryDays: 0,
          },
        ],
      }),
    );

    savedGigs.push(
      await ensureGig({
        slug: 'instalacion-aire-acondicionado-split-inverter',
        pro: elena.pro,
        categorySlug: 'climatizacion',
        title: 'Instalación de aire acondicionado Split Inverter + carga gas',
        description:
          'Montaje certificado de equipos split 1x1 y multisplit con bomba de vacío, prueba de estanqueidad con nitrógeno y canaleta estética interior/exterior.',
        coverImages: [
          'https://images.unsplash.com/photo-1631545806609-35d4ae440431?auto=format&fit=crop&w=1000&q=80',
        ],
        searchTags: ['aire acondicionado', 'split', 'climatizacion', 'r32'],
        requirements: ['Frigorías del equipo', 'Distancia entre unidad interior y exterior'],
        avgRating: 4.8,
        totalReviews: 9,
        ordersCount: 16,
        isFeatured: false,
        packages: [
          {
            tier: PackageTier.BASIC,
            name: 'Mantenimiento y limpieza',
            description: 'Limpieza antibacteriana de filtros, turbina y comprobación presiones.',
            price: 79,
            deliveryDays: 1,
            revisions: 1,
            features: ['Higienización', 'Control condensados', 'Informe estado'],
          },
          {
            tier: PackageTier.STANDARD,
            name: 'Instalación Split 1x1',
            description: 'Hasta 3 metros de tubería frigorífica aislada y desagüe.',
            price: 265,
            deliveryDays: 2,
            revisions: 1,
            isPopular: true,
            features: ['Soportes silentblock', 'Vacío certificado', 'Garantía instalación 2 años'],
          },
          {
            tier: PackageTier.PREMIUM,
            name: 'Multisplit 2x1 completo',
            description: 'Instalación doble unidad interior + exterior hasta 8m tubería.',
            price: 480,
            deliveryDays: 2,
            revisions: 2,
            features: ['Doble línea frigorífica', 'Acometida eléctrica independiente', 'Puesta a punto'],
          },
        ],
        extras: [
          {
            title: 'Metro adicional de tubería',
            description: 'Línea bitubo de cobre aislado + cable manguera.',
            price: 38,
            additionalDeliveryDays: 0,
          },
        ],
      }),
    );
  }

  if (mateo.pro) {
    savedGigs.push(
      await ensureGig({
        slug: 'alisado-paredes-quitar-gotele-y-pintura-mate',
        pro: mateo.pro,
        categorySlug: 'pintura',
        title: 'Alisado de paredes sin gotelé y pintura plástica mate lavable',
        description:
          'Lijado aspirado sin polvo, plastecido con aguaplast en 3 capas finas, imprimación selladora y dos manos de pintura plástica ecológica lavable color a elegir.',
        coverImages: [
          'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1000&q=80',
        ],
        searchTags: ['pintor', 'gotele', 'alisar', 'pintura', 'paredes'],
        requirements: ['Metros cuadrados aproximados de vivienda o habitación', 'Estado actual (liso o gotelé)'],
        avgRating: 4.8,
        totalReviews: 15,
        ordersCount: 22,
        isFeatured: true,
        packages: [
          {
            tier: PackageTier.BASIC,
            name: '1 Habitación / Salón (liso)',
            description: 'Protección completa y 2 manos de pintura plástica mate hasta 20m² suelo.',
            price: 240,
            deliveryDays: 2,
            revisions: 1,
            features: ['Pintura Valentine/Bruguer', 'Tapado de grietas', 'Protección mobiliario'],
          },
          {
            tier: PackageTier.STANDARD,
            name: 'Piso completo hasta 75m²',
            description: 'Repaso completo de techos en blanco y paredes en tono a elección.',
            price: 790,
            deliveryDays: 3,
            revisions: 1,
            isPopular: true,
            features: ['Material primera marca incluido', 'Lijado aspirado', 'Limpieza de obra'],
          },
          {
            tier: PackageTier.PREMIUM,
            name: 'Quitar gotelé + pintar (75m²)',
            description: 'Alisado completo con llana, lijado rotoorbital y acabado liso seda.',
            price: 1750,
            deliveryDays: 5,
            revisions: 2,
            features: ['3 capas masilla renovación', 'Imprimación fijadora', 'Acabado foco rasante'],
          },
        ],
        extras: [
          {
            title: 'Lacado de puertas paso unidad',
            description: 'Lijado y esmaltado satinado blanco.',
            price: 85,
            additionalDeliveryDays: 1,
          },
        ],
      }),
    );
  }

  if (sofia.pro) {
    savedGigs.push(
      await ensureGig({
        slug: 'diseno-y-montaje-de-cocina-moderna-a-medida',
        pro: sofia.pro,
        categorySlug: 'cocina',
        title: 'Diseño 3D, encimera porcelánica y montaje de cocina a medida',
        description:
          'Proyecto completo de cocina ergonómica con muebles altos/bajos con cierre amortiguado Blum, toma de medidas láser y coordinación integral de fontanería y electricidad.',
        coverImages: [
          'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1000&q=80',
        ],
        searchTags: ['cocina', 'encimera', 'reforma cocina', 'muebles'],
        requirements: ['Plano acotado o fotos de la cocina', 'Estilo preferido (madera, blanco mate, antracita)'],
        avgRating: 5.0,
        totalReviews: 12,
        ordersCount: 19,
        isFeatured: true,
        packages: [
          {
            tier: PackageTier.BASIC,
            name: 'Proyecto 3D + mediciones',
            description: 'Visita técnica, planos de instalaciones y renders 3D fotorrealistas.',
            price: 190,
            deliveryDays: 4,
            revisions: 2,
            features: ['Plano fontanería/enchufes', '3 propuestas de distribución', 'Presupuesto desglosado'],
          },
          {
            tier: PackageTier.STANDARD,
            name: 'Montaje mobiliario cocina',
            description: 'Instalación profesional de muebles, zócalos, bisagras e integración electrodomésticos.',
            price: 890,
            deliveryDays: 4,
            revisions: 1,
            isPopular: true,
            features: ['Nivelación láser', 'Sellado encimera', 'Montaje electrodomésticos'],
          },
          {
            tier: PackageTier.PREMIUM,
            name: 'Reforma integral llave mano',
            description: 'Demolición, instalaciones nuevas, suelo porcelánico, mobiliario e iluminación LED.',
            price: 4950,
            deliveryDays: 12,
            revisions: 2,
            features: ['Dirección de obra', 'Garantía integral 3 años', 'Desescombro autorizado'],
          },
        ],
        extras: [
          {
            title: 'Tira LED bajo mueble alto con sensor',
            description: 'Perfil aluminio empotrado con encendido sin contacto.',
            price: 135,
            additionalDeliveryDays: 1,
          },
        ],
      }),
    );
  }

  if (javier.pro) {
    savedGigs.push(
      await ensureGig({
        slug: 'diseno-web-profesional-seo-local-para-pymes',
        pro: javier.pro,
        categorySlug: 'diseno-web',
        title: 'Web profesional optimizada para SEO Local + reservas WhatsApp',
        description:
          'Web rápida en React/Next.js diseñada para captar clientes locales en Google Maps y buscadores. Diseño móvil nativo, formularios de presupuesto y Google Analytics.',
        coverImages: [
          'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1000&q=80',
        ],
        searchTags: ['diseño web', 'seo', 'pagina web', 'digital'],
        requirements: ['Nombre del negocio y servicios', 'Logotipo o colores de marca'],
        avgRating: 4.9,
        totalReviews: 14,
        ordersCount: 27,
        isFeatured: true,
        packages: [
          {
            tier: PackageTier.BASIC,
            name: 'Landing Page Express',
            description: 'Página única optimizada para conversión con formulario y WhatsApp.',
            price: 340,
            deliveryDays: 5,
            revisions: 2,
            features: ['Adaptada 100% a móvil', 'Certificado SSL', 'Velocidad >95 PageSpeed'],
          },
          {
            tier: PackageTier.STANDARD,
            name: 'Web Corporativa + SEO',
            description: 'Hasta 5 páginas internas, Google Business Profile y posicionamiento local.',
            price: 680,
            deliveryDays: 8,
            revisions: 3,
            isPopular: true,
            features: ['5 secciones a medida', 'SEO técnico on-page', 'Copywriting comercial'],
          },
          {
            tier: PackageTier.PREMIUM,
            name: 'Tienda Online + Reservas',
            description: 'E-commerce completo con pasarela Stripe/Redsys y calendario automático.',
            price: 1290,
            deliveryDays: 14,
            revisions: 3,
            features: ['Catálogo autogestionable', 'Pagos con tarjeta', 'Soporte técnico 60 días'],
          },
        ],
        extras: [
          {
            title: 'Identidad visual y logotipo vectorial',
            description: 'Manual básico de marca + formatos SVG/PNG.',
            price: 160,
            additionalDeliveryDays: 2,
          },
        ],
      }),
    );

    savedGigs.push(
      await ensureGig({
        slug: 'apertura-puertas-urgente-y-bombin-antibumping',
        pro: javier.pro,
        categorySlug: 'cerrajeria',
        title: 'Instalación de bombín antibumping alta seguridad y cerraduras',
        description:
          'Actualiza la seguridad de tu puerta blindada o acorazada con cilindros anti-bumping, anti-ganzúa y anti-extracción con 5 llaves incopiables.',
        coverImages: [
          'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1000&q=80',
        ],
        searchTags: ['cerrajero', 'bombin', 'antibumping', 'cerradura'],
        requirements: ['Foto canto de puerta y escudo exterior'],
        avgRating: 4.9,
        totalReviews: 8,
        ordersCount: 19,
        isFeatured: false,
        packages: [
          {
            tier: PackageTier.BASIC,
            name: 'Ajuste o apertura sin daños',
            description: 'Apertura limpia de puerta cerrada de golpe o ajuste de resbalón.',
            price: 85,
            deliveryDays: 1,
            revisions: 1,
            features: ['Sin rotura de puerta', 'Llegada 45 min', 'Factura aseguradora'],
          },
          {
            tier: PackageTier.STANDARD,
            name: 'Bombín Antibumping + Montaje',
            description: 'Cilindro de seguridad grado máximo con 5 llaves patentadas.',
            price: 175,
            deliveryDays: 1,
            revisions: 1,
            isPopular: true,
            features: ['5 llaves selladas', 'Tarjeta propiedad', 'Garantía 3 años'],
          },
          {
            tier: PackageTier.PREMIUM,
            name: 'Bombín + Escudo Acorazado',
            description: 'Doble protección con escudo macizo rotatorio antimordaza.',
            price: 310,
            deliveryDays: 1,
            revisions: 1,
            features: ['Escudo acero manganeso', 'Doble embrague', 'Certificación UNE'],
          },
        ],
        extras: [
          {
            title: 'Cerrojo adicional alta seguridad',
            description: 'Instalación de cerrojo interior tipo Lince C6.',
            price: 120,
            additionalDeliveryDays: 0,
          },
        ],
      }),
    );
  }

  // 5. Promociones activas
  const ensurePromotion = async (params: {
    pro: ProfessionalProfile;
    title: string;
    description: string;
    discountPercent: number;
    promoCode: string;
    category: string;
    badge: string;
  }) => {
    const exists = await promoRepo.findOne({
      where: {
        professionalProfileId: params.pro.id,
        promoCode: params.promoCode,
      },
    });
    if (!exists) {
      await promoRepo.save(
        promoRepo.create({
          professionalProfileId: params.pro.id,
          title: params.title,
          description: params.description,
          discountPercent: params.discountPercent,
          promoCode: params.promoCode,
          category: params.category,
          badge: params.badge,
          expiresAt: hoursFromNowDate(24 * 30),
          isActive: true,
        }),
      );
    }
  };

  if (carlos.pro) {
    await ensurePromotion({
      pro: carlos.pro,
      title: '15% DTO en cambio de bañera por plato de ducha',
      description: 'Descuento directo sobre cualquier paquete completo reservado esta semana en Madrid.',
      discountPercent: 15,
      promoCode: 'DUCHA15',
      category: 'Baños',
      badge: '-15% Hoy',
    });
  }
  if (elena.pro) {
    await ensurePromotion({
      pro: elena.pro,
      title: 'Boletín eléctrico CIE + revisión gratuita de cuadro',
      description: 'Incluye diagnóstico termográfico y verificación de tierra sin coste adicional.',
      discountPercent: 20,
      promoCode: 'LUZ20',
      category: 'Electricidad',
      badge: 'Recomendado',
    });
  }
  if (sofia.pro) {
    await ensurePromotion({
      pro: sofia.pro,
      title: 'Proyecto 3D gratuito al contratar montaje de cocina',
      description: 'Ahorra 190 € descontando el diseño en tu proyecto de cocina.',
      discountPercent: 10,
      promoCode: 'COCINA10',
      category: 'Cocina',
      badge: 'Diseño 3D',
    });
  }
  if (javier.pro) {
    await ensurePromotion({
      pro: javier.pro,
      title: '25% DTO en Landing Web Express para autónomos',
      description: 'Lanza la presencia digital de tu negocio en 5 días con dominio SSL.',
      discountPercent: 25,
      promoCode: 'WEB25',
      category: 'Diseño Web & Digital',
      badge: 'Flash -25%',
    });
  }

  // 6. Solicitudes de servicio (Leads) + Propuestas
  const ensureServiceRequest = async (params: {
    client: User;
    categorySlug: string;
    title: string;
    description: string;
    budgetMin: number;
    budgetMax: number;
    isUrgent: boolean;
    city: string;
    postalCode: string;
    creditCost: number;
  }): Promise<ServiceRequest> => {
    let req = await reqRepo.findOne({
      where: { clientId: params.client.id, title: params.title },
    });
    const category = categoryBySlug.get(params.categorySlug)!;
    if (!req) {
      req = await reqRepo.save(
        reqRepo.create({
          clientId: params.client.id,
          categoryId: category.id,
          title: params.title,
          description: params.description,
          questionnaireAnswers: {
            vivienda: 'Piso en planta',
            acceso: 'Con ascensor',
            disponibilidad: 'Mañanas o primera hora de la tarde',
          },
          budgetMin: params.budgetMin,
          budgetMax: params.budgetMax,
          isUrgent: params.isUrgent,
          preferredDate: hoursFromNowDate(72),
          city: params.city,
          postalCode: params.postalCode,
          country: 'ES',
          address: `Zona centro, ${params.city}`,
          latitude: 40.421,
          longitude: -3.702,
          isRemote: params.categorySlug === 'diseno-web',
          creditCost: params.creditCost,
          maxUnlocks: 5,
          unlocksCount: 1,
          status: LeadStatus.OPEN,
          expiresAt: hoursFromNowDate(24 * 14),
        }),
      );
    }
    return req;
  };

  const reqFontaneria = await ensureServiceRequest({
    client: laura.user,
    categorySlug: 'fontaneria',
    title: 'Cambio completo de caldera estanca y purgado de 6 radiadores',
    description:
      'Necesitamos retirar caldera antigua Junkers de 24kW e instalar nueva de condensación dejando todo certificado.',
    budgetMin: 750,
    budgetMax: 1150,
    isUrgent: true,
    city: 'Madrid',
    postalCode: '28004',
    creditCost: 8,
  });

  const reqBano = await ensureServiceRequest({
    client: laura.user,
    categorySlug: 'banos',
    title: 'Reforma integral de baño secundario con ducha de resina',
    description:
      'Baño de 4,5m². Queremos quitar bañera, cambiar sanitarios suspendidos y alicatar zona húmeda en blanco mate.',
    budgetMin: 2400,
    budgetMax: 3600,
    isUrgent: false,
    city: 'Madrid',
    postalCode: '28004',
    creditCost: 12,
  });

  const reqElectricidad = await ensureServiceRequest({
    client: diego.user,
    categorySlug: 'electricidad',
    title: 'Boletín eléctrico CIE y toma dedicada para placa de inducción',
    description:
      'Subimos potencia a 5,75kW y necesitamos actualizar diferencial + tirar línea de 6mm hasta cocina.',
    budgetMin: 220,
    budgetMax: 360,
    isUrgent: true,
    city: 'Madrid',
    postalCode: '28010',
    creditCost: 8,
  });

  await ensureServiceRequest({
    client: diego.user,
    categorySlug: 'pintura',
    title: 'Alisado de salón y pasillo (38m²) y pintura blanco rotura',
    description:
      'Tiene gotelé fino de hace años. Queremos dejar paredes lisas antes de mudarnos el próximo mes.',
    budgetMin: 850,
    budgetMax: 1300,
    isUrgent: false,
    city: 'Madrid',
    postalCode: '28015',
    creditCost: 8,
  });

  const ensureProposal = async (params: {
    req: ServiceRequest;
    pro: ProfessionalProfile;
    price: number;
    estimatedDays: number;
    message: string;
  }) => {
    const exists = await proposalRepo.findOne({
      where: {
        serviceRequestId: params.req.id,
        professionalProfileId: params.pro.id,
      },
    });
    if (!exists) {
      await proposalRepo.save(
        proposalRepo.create({
          serviceRequestId: params.req.id,
          professionalProfileId: params.pro.id,
          price: params.price,
          estimatedDays: params.estimatedDays,
          message: params.message,
          status: ProposalStatus.PENDING,
          expiresAt: hoursFromNowDate(24 * 7),
        }),
      );
    }
  };

  if (carlos.pro) {
    await ensureProposal({
      req: reqFontaneria,
      pro: carlos.pro,
      price: 890,
      estimatedDays: 1,
      message:
        'Incluye desmontaje de caldera antigua, montaje de nueva condensación, ajuste de evacuación y purgado de todos los radiadores con garantía por escrito.',
    });
    await ensureProposal({
      req: reqBano,
      pro: carlos.pro,
      price: 2850,
      estimatedDays: 5,
      message:
        'Reforma llave en mano con fontanería nueva en multicapa, plato de resina C3 antideslizante y colocación de mueble y mampara.',
    });
  }
  if (elena.pro) {
    await ensureProposal({
      req: reqElectricidad,
      pro: elena.pro,
      price: 285,
      estimatedDays: 1,
      message:
        'Instalamos diferencial superinmunizado 40A 30mA, línea dedicada 25A 6mm y registramos el boletín CIE telemático en el mismo día.',
    });
  }

  // 7. Pedidos completados y Reseñas verificadas
  const ensureCompletedOrderWithReview = async (params: {
    orderNumber: string;
    client: User;
    pro: ProfessionalProfile;
    gig: Gig;
    subtotal: number;
    rating: number;
    comment: string;
    reply: string;
  }) => {
    let order = await orderRepo.findOne({
      where: { orderNumber: params.orderNumber },
    });
    if (!order) {
      const fee = Number((params.subtotal * 0.1).toFixed(2));
      order = await orderRepo.save(
        orderRepo.create({
          orderNumber: params.orderNumber,
          clientId: params.client.id,
          professionalProfileId: params.pro.id,
          orderType: OrderType.GIG_PURCHASE,
          gigId: params.gig.id,
          status: OrderStatus.COMPLETED,
          subtotal: params.subtotal,
          platformFee: fee,
          totalAmount: params.subtotal + fee,
          proEarnings: params.subtotal - fee,
          escrowStatus: EscrowStatus.RELEASED_TO_PRO,
          deliveryDeadline: monthsAgoDate(0, 10),
          autoCompletedAt: monthsAgoDate(0, 11),
        }),
      );

      await reviewRepo.save(
        reviewRepo.create({
          orderId: order.id,
          professionalProfileId: params.pro.id,
          gigId: params.gig.id,
          authorId: params.client.id,
          targetUserId: params.pro.userId,
          rating: params.rating,
          qualityRating: params.rating,
          communicationRating: 5,
          deliveryRating: 5,
          comment: params.comment,
          sellerReply: params.reply,
          sellerRepliedAt: new Date(),
        }),
      );
    }
  };

  if (carlos.pro && savedGigs[0]) {
    await ensureCompletedOrderWithReview({
      orderNumber: 'YW-SEED-1001',
      client: laura.user,
      pro: carlos.pro,
      gig: savedGigs[0],
      subtotal: 135,
      rating: 5,
      comment:
        'Carlos llegó puntualísimo, localizó la fuga bajo el fregadero en diez minutos y lo dejó todo impecable y sin manchas.',
      reply: '¡Muchas gracias Laura! Un placer ayudaros en casa.',
    });
  }
  if (elena.pro && savedGigs[2]) {
    await ensureCompletedOrderWithReview({
      orderNumber: 'YW-SEED-1002',
      client: diego.user,
      pro: elena.pro,
      gig: savedGigs[2],
      subtotal: 165,
      rating: 5,
      comment:
        'Tramitó el boletín eléctrico en 24 horas exactas y nos explicó cada circuito del cuadro nuevo.',
      reply: 'Gracias Diego, ya sabéis dónde encontrarnos para cualquier ampliación.',
    });
  }

  // 8. Estados 24h (Stories visibles en portada)
  const ensureStatus = async (params: {
    author: User;
    caption: string;
    backgroundColor: string;
    mediaUrl?: string;
    mediaType: StatusMediaType;
    viewCount: number;
  }) => {
    const exists = await statusRepo.findOne({
      where: { authorId: params.author.id, caption: params.caption },
    });
    if (!exists) {
      await statusRepo.save(
        statusRepo.create({
          authorId: params.author.id,
          caption: params.caption,
          backgroundColor: params.backgroundColor,
          mediaUrl: params.mediaUrl ?? null,
          mediaType: params.mediaType,
          viewCount: params.viewCount,
          expiresAt: hoursFromNowDate(23),
        }),
      );
    }
  };

  await ensureStatus({
    author: carlos.user,
    caption: 'Hoy disponible en Madrid centro para urgencias de fontanería y cambio de grifería 🔧',
    backgroundColor: '#00B4D8',
    mediaType: StatusMediaType.IMAGE,
    mediaUrl:
      'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=900&q=80',
    viewCount: 34,
  });
  await ensureStatus({
    author: elena.user,
    caption: 'Último cuadro eléctrico terminado en Salamanca con protecciones ABB ⚡',
    backgroundColor: '#0284C7',
    mediaType: StatusMediaType.IMAGE,
    mediaUrl:
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=900&q=80',
    viewCount: 27,
  });
  await ensureStatus({
    author: sofia.user,
    caption: '¡Nueva cocina entregada en Valencia! Encimera porcelánica Calacatta 🏡',
    backgroundColor: '#0EA5E9',
    mediaType: StatusMediaType.IMAGE,
    mediaUrl:
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80',
    viewCount: 41,
  });
  await ensureStatus({
    author: mateo.user,
    caption: 'Alisado de piso de 80m² finalizado antes de plazo ✨ Pintura mate ecológica.',
    backgroundColor: '#0369A1',
    mediaType: StatusMediaType.TEXT,
    viewCount: 19,
  });

  // 9. Transacciones financieras de los últimos 6 meses (para gráficas Analytics / Portada)
  const ensureLedgerSeries = async (
    wallet: Wallet,
    prefix: string,
    series: Array<{
      monthsAgo: number;
      type: TransactionType;
      amount: number;
      creditAmount?: number;
      concept: string;
    }>,
  ) => {
    for (let i = 0; i < series.length; i++) {
      const entry = series[i];
      const ref = `${prefix}-${i + 1}`;
      const existing = await ledgerRepo.findOne({
        where: { walletId: wallet.id, referenceId: ref },
      });
      if (!existing) {
        const createdAt = monthsAgoDate(entry.monthsAgo, 8 + i * 2);
        const created = await ledgerRepo.save(
          ledgerRepo.create({
            walletId: wallet.id,
            type: entry.type,
            amount: entry.amount,
            creditAmount: entry.creditAmount ?? 0,
            currency: 'EUR',
            status: TransactionStatus.COMPLETED,
            referenceId: ref,
            metadata: { concept: entry.concept, seeded: true },
          }),
        );
        await ledgerRepo.update(created.id, { createdAt });
      }
    }
  };

  await ensureLedgerSeries(carlos.wallet, 'SEED-CARLOS', [
    {
      monthsAgo: 5,
      type: TransactionType.ESCROW_RELEASE,
      amount: 640,
      concept: 'Reforma baño Retiro',
    },
    {
      monthsAgo: 4,
      type: TransactionType.ESCROW_RELEASE,
      amount: 820,
      concept: 'Cambio caldera y circuitos',
    },
    {
      monthsAgo: 4,
      type: TransactionType.CREDIT_PURCHASE,
      amount: 45,
      creditAmount: 50,
      concept: 'Pack 50 créditos Pro',
    },
    {
      monthsAgo: 3,
      type: TransactionType.ESCROW_RELEASE,
      amount: 950,
      concept: 'Instalación plato ducha Chamberí',
    },
    {
      monthsAgo: 2,
      type: TransactionType.ESCROW_RELEASE,
      amount: 1120,
      concept: 'Reforma fontanería cocina',
    },
    {
      monthsAgo: 2,
      type: TransactionType.PAYOUT_WITHDRAWAL,
      amount: 400,
      concept: 'Transferencia a cuenta bancaria',
    },
    {
      monthsAgo: 1,
      type: TransactionType.ESCROW_RELEASE,
      amount: 1380,
      concept: 'Boletín y cambio grifería x3',
    },
    {
      monthsAgo: 0,
      type: TransactionType.ESCROW_RELEASE,
      amount: 1640,
      concept: 'Servicios completados mes actual',
    },
    {
      monthsAgo: 0,
      type: TransactionType.CREDIT_PURCHASE,
      amount: 45,
      creditAmount: 50,
      concept: 'Recarga créditos leads',
    },
  ]);

  await ensureLedgerSeries(laura.wallet, 'SEED-LAURA', [
    {
      monthsAgo: 5,
      type: TransactionType.DEPOSIT,
      amount: 250,
      concept: 'Recarga saldo Yewi',
    },
    {
      monthsAgo: 4,
      type: TransactionType.ORDER_PAYMENT,
      amount: 120,
      concept: 'Revisión calefacción',
    },
    {
      monthsAgo: 3,
      type: TransactionType.DEPOSIT,
      amount: 400,
      concept: 'Ingreso para reforma baño',
    },
    {
      monthsAgo: 2,
      type: TransactionType.ORDER_PAYMENT,
      amount: 165,
      concept: 'Certificado boletín eléctrico',
    },
    {
      monthsAgo: 1,
      type: TransactionType.DEPOSIT,
      amount: 300,
      concept: 'Recarga saldo cliente',
    },
    {
      monthsAgo: 0,
      type: TransactionType.ORDER_PAYMENT,
      amount: 135,
      concept: 'Sustitución grifería cocina',
    },
  ]);

  console.log(
    `[Seed] Completo: ${DEFAULT_CATEGORIES.length} categorías, 8 servicios Gig, 4 promociones, 4 solicitudes, 4 estados y series históricas sincronizadas.`,
  );
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('[Seed] Error ejecutando seed:', error);
  process.exit(1);
});
