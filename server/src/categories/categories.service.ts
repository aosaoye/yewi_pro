import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RedisCacheService } from '../common/cache/redis.service';
import { Category } from '../database/entities';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  private readonly TREE_CACHE_KEY = 'categories:tree';

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  async getCategoryTree() {
    if (this.redisCache) {
      const cached = await this.redisCache.get<Category[]>(this.TREE_CACHE_KEY);
      if (cached) {
        return cached;
      }
    }

    const roots = await this.categoryRepo.find({
      where: { parentId: IsNull(), isActive: true },
      relations: { children: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    const filtered = roots.map((root) => ({
      ...root,
      children: (root.children ?? [])
        .filter((c) => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    }));

    if (this.redisCache) {
      await this.redisCache.set(this.TREE_CACHE_KEY, filtered, 3600);
    }

    return filtered;
  }

  async getBySlugOrId(identifier: string) {
    const category = await this.categoryRepo.findOne({
      where: [{ slug: identifier }, { id: identifier }],
      relations: { children: true, parent: true },
    });

    if (!category) {
      throw new NotFoundException(`Categoría "${identifier}" no encontrada`);
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    const existingSlug = await this.categoryRepo.findOne({
      where: { slug: dto.slug.trim().toLowerCase() },
    });
    if (existingSlug) {
      throw new ConflictException(
        `Ya existe una categoría con el slug "${dto.slug}"`,
      );
    }

    if (dto.parentId) {
      const parent = await this.categoryRepo.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new BadRequestException('La categoría padre no existe');
      }
    }

    const created = await this.categoryRepo.save(
      this.categoryRepo.create({
        ...dto,
        slug: dto.slug.trim().toLowerCase(),
      }),
    );

    if (this.redisCache) {
      await this.redisCache.delPattern('categories:*');
    }
    return created;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (dto.slug && dto.slug.trim().toLowerCase() !== category.slug) {
      const conflict = await this.categoryRepo.findOne({
        where: { slug: dto.slug.trim().toLowerCase() },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          `El slug "${dto.slug}" ya está asignado a otra categoría`,
        );
      }
    }

    this.categoryRepo.merge(category, {
      ...dto,
      slug: dto.slug ? dto.slug.trim().toLowerCase() : category.slug,
    });
    const updated = await this.categoryRepo.save(category);

    if (this.redisCache) {
      await this.redisCache.delPattern('categories:*');
    }
    return updated;
  }

  async delete(id: string) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    await this.categoryRepo.remove(category);

    if (this.redisCache) {
      await this.redisCache.delPattern('categories:*');
    }
    return { success: true, message: 'Categoría eliminada correctamente' };
  }
}
