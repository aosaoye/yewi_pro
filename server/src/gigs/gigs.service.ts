import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { PaginatedResult } from '../common/dto/pagination.dto';
import {
  Category,
  Gig,
  GigExtra,
  GigPackage,
  ProfessionalProfile,
} from '../database/entities';
import { GigStatus, PackageTier } from '../database/enums';
import { CreateGigDto } from './dto/create-gig.dto';
import { FilterGigsDto, UpdateGigDto } from './dto/filter-gigs.dto';

@Injectable()
export class GigsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Gig)
    private readonly gigRepo: Repository<Gig>,
    @InjectRepository(GigPackage)
    private readonly packageRepo: Repository<GigPackage>,
    @InjectRepository(GigExtra)
    private readonly extraRepo: Repository<GigExtra>,
    @InjectRepository(ProfessionalProfile)
    private readonly proRepo: Repository<ProfessionalProfile>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  private buildSlug(title: string): string {
    const base = title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const suffix = Math.random().toString(36).slice(2, 7);
    return `${base || 'servicio'}-${suffix}`;
  }

  async findAll(filter: FilterGigsDto): Promise<PaginatedResult<Gig>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.gigRepo
      .createQueryBuilder('gig')
      .leftJoinAndSelect('gig.category', 'category')
      .leftJoinAndSelect('gig.packages', 'pkg')
      .leftJoinAndSelect('gig.professionalProfile', 'pro')
      .leftJoinAndSelect('pro.user', 'user')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('gig.status = :status', { status: GigStatus.ACTIVE })
      .andWhere('gig.deletedAt IS NULL');

    if (filter.search && filter.search.trim()) {
      const term = `%${filter.search.trim()}%`;
      qb.andWhere(
        `(gig.title ILIKE :term OR gig.description ILIKE :term OR array_to_string(gig.searchTags, ' ') ILIKE :term OR pro.businessName ILIKE :term)`,
        { term },
      );
    }

    const catFilter = filter.categoryId || filter.category;
    if (catFilter && catFilter.trim()) {
      const cat = catFilter.trim();
      qb.andWhere(
        '(category.id = :cat OR category.slug = :cat OR category.name ILIKE :catLike)',
        { cat, catLike: `%${cat}%` },
      );
    }

    if (filter.minPrice !== undefined) {
      qb.andWhere('pkg.price >= :minPrice', { minPrice: filter.minPrice });
    }
    if (filter.maxPrice !== undefined) {
      qb.andWhere('pkg.price <= :maxPrice', { maxPrice: filter.maxPrice });
    }
    if (filter.deliveryDays !== undefined) {
      qb.andWhere('pkg.deliveryDays <= :deliveryDays', {
        deliveryDays: filter.deliveryDays,
      });
    }
    if (filter.minRating !== undefined) {
      qb.andWhere('gig.avgRating >= :minRating', {
        minRating: filter.minRating,
      });
    }
    if (filter.isFeatured !== undefined) {
      qb.andWhere('gig.isFeatured = :isFeatured', {
        isFeatured:
          typeof filter.isFeatured === 'string'
            ? filter.isFeatured === 'true'
            : Boolean(filter.isFeatured),
      });
    }

    const orderDir =
      filter.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    if (filter.sortBy === 'rating') {
      qb.orderBy('gig.avgRating', orderDir);
    } else if (filter.sortBy === 'orders') {
      qb.orderBy('gig.ordersCount', orderDir);
    } else {
      qb.orderBy('gig.isFeatured', 'DESC').addOrderBy('gig.createdAt', orderDir);
    }

    qb.skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getMyGigs(userId: string) {
    const pro = await this.proRepo.findOne({ where: { userId } });
    if (!pro) {
      throw new ForbiddenException('Necesitas un perfil profesional activo');
    }

    return this.gigRepo.find({
      where: { professionalProfileId: pro.id, deletedAt: IsNull() },
      relations: { category: true, packages: true, extras: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findBySlug(slugOrId: string) {
    const gig = await this.gigRepo.findOne({
      where: [
        { slug: slugOrId, deletedAt: IsNull() },
        { id: slugOrId, deletedAt: IsNull() },
      ],
      relations: {
        category: true,
        packages: true,
        extras: true,
        professionalProfile: {
          user: { profile: true },
        },
        reviews: {
          author: { profile: true },
        },
      },
    });

    if (!gig) {
      throw new NotFoundException('Servicio (Gig) no encontrado');
    }

    return gig;
  }

  async create(userId: string, dto: CreateGigDto) {
    const pro = await this.proRepo.findOne({ where: { userId } });
    if (!pro) {
      throw new ForbiddenException(
        'Debes crear tu perfil profesional antes de publicar un servicio',
      );
    }

    let category: Category | null = null;
    if (dto.categoryId) {
      category = await this.categoryRepo.findOne({
        where: { id: dto.categoryId },
      });
    } else if (dto.category) {
      category = await this.categoryRepo
        .createQueryBuilder('cat')
        .where('cat.slug = :val OR cat.name ILIKE :valLike', {
          val: dto.category.trim().toLowerCase(),
          valLike: `%${dto.category.trim()}%`,
        })
        .getOne();
    }

    if (!category) {
      category = await this.categoryRepo.findOne({
        where: { isActive: true },
        order: { sortOrder: 'ASC' },
      });
    }
    if (!category) {
      throw new BadRequestException(
        'No se encontró una categoría válida para el servicio',
      );
    }

    if (!dto.packages?.length && (dto.price === undefined || dto.price < 5)) {
      throw new BadRequestException(
        'Debes configurar al menos un paquete o precio para tu servicio',
      );
    }

    const packagesInput =
      dto.packages && dto.packages.length > 0
        ? dto.packages
        : [
            {
              tier: PackageTier.BASIC,
              name: dto.title.trim(),
              description: dto.description.trim().slice(0, 200),
              price: dto.price!,
              deliveryDays: Math.max(1, Number(dto.deliveryDays) || 1),
              revisions: 0,
              isPopular: true,
            },
          ];

    const slug = dto.slug?.trim() || this.buildSlug(dto.title);

    const createdId = await this.dataSource.transaction(async (manager) => {
      const normalizedTitle = dto.title.trim();
      const recentDuplicate = await manager.findOne(Gig, {
        where: {
          professionalProfileId: pro.id,
          title: normalizedTitle,
          deletedAt: IsNull(),
          createdAt: MoreThanOrEqual(new Date(Date.now() - 15_000)),
        },
        order: { createdAt: 'DESC' },
      });
      if (recentDuplicate) {
        return recentDuplicate.id;
      }

      const gig = await manager.save(
        Gig,
        manager.create(Gig, {
          professionalProfileId: pro.id,
          categoryId: category.id,
          title: normalizedTitle,
          slug,
          description: dto.description.trim(),
          searchTags: dto.searchTags ?? [],
          coverImages: dto.coverImages ?? [],
          videoUrl: dto.videoUrl ?? null,
          faqs: dto.faqs ?? null,
          requirements: dto.requirements ?? [],
          status: GigStatus.ACTIVE,
        }),
      );

      for (const pkg of packagesInput) {
        await manager.save(
          GigPackage,
          manager.create(GigPackage, {
            gigId: gig.id,
            tier: pkg.tier,
            name: pkg.name.trim(),
            description: pkg.description.trim(),
            price: pkg.price,
            deliveryDays: pkg.deliveryDays,
            revisions: pkg.revisions ?? 0,
            features: pkg.features ?? null,
            isPopular: pkg.isPopular ?? false,
          }),
        );
      }

      if (dto.extras && dto.extras.length > 0) {
        for (const extra of dto.extras) {
          await manager.save(
            GigExtra,
            manager.create(GigExtra, {
              gigId: gig.id,
              title: extra.title,
              description: extra.description ?? null,
              price: extra.price,
              additionalDeliveryDays: extra.additionalDeliveryDays ?? 0,
            }),
          );
        }
      }

      return gig.id;
    });

    return this.findBySlug(createdId);
  }

  async update(userId: string, gigId: string, dto: UpdateGigDto) {
    const gig = await this.gigRepo.findOne({
      where: { id: gigId, deletedAt: IsNull() },
      relations: { professionalProfile: true },
    });

    if (!gig) {
      throw new NotFoundException('Gig no encontrado');
    }
    if (gig.professionalProfile?.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para modificar este Gig',
      );
    }

    let resolvedCategoryId = dto.categoryId;
    if (resolvedCategoryId === undefined && dto.category?.trim()) {
      const cat = await this.categoryRepo
        .createQueryBuilder('cat')
        .where('cat.slug = :val OR cat.name ILIKE :valLike', {
          val: dto.category.trim().toLowerCase(),
          valLike: `%${dto.category.trim()}%`,
        })
        .getOne();
      if (cat) {
        resolvedCategoryId = cat.id;
      }
    }

    await this.dataSource.transaction(async (manager) => {
      if (dto.title !== undefined) gig.title = dto.title.trim();
      if (resolvedCategoryId !== undefined) gig.categoryId = resolvedCategoryId;
      if (dto.description !== undefined) gig.description = dto.description.trim();
      if (dto.searchTags !== undefined) gig.searchTags = dto.searchTags;
      if (dto.coverImages !== undefined) gig.coverImages = dto.coverImages;
      if (dto.videoUrl !== undefined) gig.videoUrl = dto.videoUrl;
      if (dto.faqs !== undefined) gig.faqs = dto.faqs;
      if (dto.requirements !== undefined) gig.requirements = dto.requirements;
      if (dto.status !== undefined) gig.status = dto.status;
      await manager.save(Gig, gig);

      if (dto.packages !== undefined) {
        await manager.delete(GigPackage, { gigId: gig.id });
        for (const pkg of dto.packages) {
          await manager.save(
            GigPackage,
            manager.create(GigPackage, {
              gigId: gig.id,
              tier: pkg.tier,
              name: pkg.name.trim(),
              description: pkg.description.trim(),
              price: pkg.price,
              deliveryDays: pkg.deliveryDays,
              revisions: pkg.revisions ?? 0,
              features: pkg.features ?? null,
              isPopular: pkg.isPopular ?? false,
            }),
          );
        }
      }

      if (dto.extras !== undefined) {
        await manager.delete(GigExtra, { gigId: gig.id });
        for (const extra of dto.extras) {
          await manager.save(
            GigExtra,
            manager.create(GigExtra, {
              gigId: gig.id,
              title: extra.title,
              description: extra.description ?? null,
              price: extra.price,
              additionalDeliveryDays: extra.additionalDeliveryDays ?? 0,
            }),
          );
        }
      }
    });

    return this.findBySlug(gigId);
  }

  async delete(userId: string, gigId: string) {
    const gig = await this.gigRepo.findOne({
      where: { id: gigId, deletedAt: IsNull() },
      relations: { professionalProfile: true },
    });

    if (!gig) {
      throw new NotFoundException('Gig no encontrado');
    }
    if (gig.professionalProfile?.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para eliminar este Gig',
      );
    }

    gig.status = GigStatus.PAUSED;
    gig.deletedAt = new Date();
    await this.gigRepo.save(gig);

    return { success: true, message: 'Servicio eliminado correctamente' };
  }
}
