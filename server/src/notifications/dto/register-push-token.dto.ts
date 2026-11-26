import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @ApiProperty({
    description: 'Token de notificaciones push de Expo (ExponentPushToken[...])',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;
}
