import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateRedsysBizumCheckoutDto {
  @ApiProperty({
    enum: ['GIG_ORDER', 'LEAD_PROPOSAL'],
    example: 'GIG_ORDER',
  })
  @IsIn(['GIG_ORDER', 'LEAD_PROPOSAL'])
  purchaseType!: 'GIG_ORDER' | 'LEAD_PROPOSAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gigId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gigPackageId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proposalId?: string;
}

export class RedsysNotificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  Ds_SignatureVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  Ds_MerchantParameters?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  Ds_Signature?: string;
}
