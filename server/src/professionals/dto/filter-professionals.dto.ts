import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class FilterProfessionalsDto {
  @ApiPropertyOptional({ description: 'Texto de búsqueda libre (nombre, bio, habilidades)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Slug o ID de categoría (ej: electricidad, fontaneria)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Localidad o municipio (ej: Zaragoza, Madrid)' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Provincia (ej: Zaragoza, Barcelona)' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ description: 'Habilidad o especialidad específica' })
  @IsOptional()
  @IsString()
  skill?: string;

  @ApiPropertyOptional({ description: 'Latitud GPS del cliente para filtrar por rango' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud GPS del cliente para filtrar por rango' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lon?: number;

  @ApiPropertyOptional({ description: 'Radio máximo de búsqueda en km', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusKm?: number;

  @ApiPropertyOptional({ description: 'Límite de resultados por página', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Desplazamiento para paginación', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
