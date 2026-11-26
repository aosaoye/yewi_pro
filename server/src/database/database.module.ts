import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES, Category } from './entities';
import { CategoryType } from './enums';

const DEFAULT_CATEGORIES = [
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

@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  exports: [TypeOrmModule],
})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    if (!this.dataSource?.isInitialized) return;
    try {
      await this.dataSource.query(
        `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "replies" jsonb NOT NULL DEFAULT '[]'::jsonb`,
      );
      await this.dataSource.query(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "expo_push_token" text`,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo verificar columnas al iniciar: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    try {
      const categoryRepo = this.dataSource.getRepository(Category);
      const count = await categoryRepo.count();
      if (count === 0) {
        await categoryRepo.save(
          DEFAULT_CATEGORIES.map((c) =>
            categoryRepo.create({ ...c, isActive: true }),
          ),
        );
        this.logger.log(
          `Categorías base inicializadas (${DEFAULT_CATEGORIES.length})`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `No se pudieron inicializar las categorías base: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
