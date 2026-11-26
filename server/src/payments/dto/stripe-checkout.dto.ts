import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateStripeCheckoutDto {
  @ApiProperty({
    enum: ['WALLET_TOPUP', 'GIG_ORDER', 'LEAD_PROPOSAL'],
    example: 'WALLET_TOPUP',
  })
  @IsIn(['WALLET_TOPUP', 'GIG_ORDER', 'LEAD_PROPOSAL'])
  purchaseType!: 'WALLET_TOPUP' | 'GIG_ORDER' | 'LEAD_PROPOSAL';

  @ApiPropertyOptional({
    description: 'Importe en EUR (solo para WALLET_TOPUP, mínimo 5€)',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  amount?: number;

  @ApiPropertyOptional({ description: 'ID del servicio (para GIG_ORDER)' })
  @IsOptional()
  @IsString()
  gigId?: string;

  @ApiPropertyOptional({ description: 'ID del paquete (para GIG_ORDER)' })
  @IsOptional()
  @IsString()
  gigPackageId?: string;

  @ApiPropertyOptional({ description: 'IDs de extras opcionales (para GIG_ORDER)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraIds?: string[];

  @ApiPropertyOptional({ description: 'ID del presupuesto (para LEAD_PROPOSAL)' })
  @IsOptional()
  @IsString()
  proposalId?: string;
}
