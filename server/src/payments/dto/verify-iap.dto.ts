import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class VerifyIapPurchaseDto {
  @ApiProperty({ enum: ['ios', 'android'], example: 'ios' })
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  @ApiProperty({
    enum: ['SUBSCRIPTION', 'WALLET_TOPUP', 'GIG_ORDER', 'LEAD_PROPOSAL'],
    example: 'SUBSCRIPTION',
  })
  @IsIn(['SUBSCRIPTION', 'WALLET_TOPUP', 'GIG_ORDER', 'LEAD_PROPOSAL'])
  purchaseType!:
    | 'SUBSCRIPTION'
    | 'WALLET_TOPUP'
    | 'GIG_ORDER'
    | 'LEAD_PROPOSAL';

  @ApiProperty({ example: 'yewi_pro_monthly' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ example: 'txn_1000000123456' })
  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @ApiProperty({ example: 'base64-receipt-or-purchase-token' })
  @IsString()
  @IsNotEmpty()
  receiptData!: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount?: number;

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

export class RestoreIapPurchasesDto {
  @ApiPropertyOptional({ type: [VerifyIapPurchaseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerifyIapPurchaseDto)
  receipts?: VerifyIapPurchaseDto[];
}
