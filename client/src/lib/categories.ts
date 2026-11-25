export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
}

export const CATEGORIES_LIST: CategoryItem[] = [
  {
    id: 'cat-1',
    name: 'Electricidad',
    slug: 'electricidad',
    icon: 'zap',
    description: 'Instalaciones eléctricas, boletines, cuadro de luces y averías.',
  },
  {
    id: 'cat-2',
    name: 'Fontanería',
    slug: 'fontaneria',
    icon: 'droplet',
    description: 'Reparación de fugas, desatascos, grifería, termos y tuberías.',
  },
  {
    id: 'cat-3',
    name: 'Baños',
    slug: 'banos',
    icon: 'grid',
    description: 'Reformas de baño, cambio de bañera por ducha y mamparas.',
  },
  {
    id: 'cat-4',
    name: 'Cocina',
    slug: 'cocina',
    icon: 'layers',
    description: 'Diseño y montaje de cocinas a medida, encimeras y electrodomésticos.',
  },
  {
    id: 'cat-5',
    name: 'Pladur',
    slug: 'pladur',
    icon: 'columns',
    description: 'Tabiquería seca, techos continuos y aislamiento acústico.',
  },
  {
    id: 'cat-6',
    name: 'Pintura',
    slug: 'pintura',
    icon: 'edit-3',
    description: 'Pintores profesionales para alisado de gotelé e interiores.',
  },
  {
    id: 'cat-7',
    name: 'Manitas',
    slug: 'manitas',
    icon: 'tool',
    description: 'Pequeñas reparaciones del hogar, muebles, lámparas y cortinas.',
  },
  {
    id: 'cat-8',
    name: 'Suelos',
    slug: 'suelos',
    icon: 'square',
    description: 'Instalación de tarima flotante, parquet, microcemento y gres.',
  },
  {
    id: 'cat-9',
    name: 'Reformas Integrales',
    slug: 'reformas',
    icon: 'home',
    description: 'Reformas completas de viviendas, locales comerciales y albañilería.',
  },
  {
    id: 'cat-10',
    name: 'Climatización',
    slug: 'climatizacion',
    icon: 'wind',
    description: 'Instalación de aire acondicionado, calderas y aerotermia.',
  },
  {
    id: 'cat-11',
    name: 'Cerrajería',
    slug: 'cerrajeria',
    icon: 'key',
    description: 'Apertura de puertas, cerraduras antibumping y bombines.',
  },
  {
    id: 'cat-12',
    name: 'Diseño Web & Digital',
    slug: 'diseno-web',
    icon: 'monitor',
    description: 'Páginas web, tiendas online y posicionamiento digital.',
  },
];

export const CATEGORIES = ['Todos', ...CATEGORIES_LIST.map((c) => c.name)] as const;
export type CategoryName = (typeof CATEGORIES)[number];
