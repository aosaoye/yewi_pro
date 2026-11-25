import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../database/enums';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
    description: 'Google ID Token o Clerk Session Token verificado criptográficamente',
  })
  @IsNotEmpty({ message: 'El idToken es obligatorio para iniciar sesión con Google' })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({
    example: 'Amalio Osa',
    description: 'Nombre completo',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'https://lh3.googleusercontent.com/a/...',
    description: 'URL del avatar de Google',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    isArray: true,
    default: [UserRole.CLIENT],
    description: 'Roles del usuario',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];
}

export class ClerkRedirectUrlDto {
  @ApiProperty({
    example: 'exp://172.22.28.179:8081/--/sso-callback',
    description: 'URL de retorno OAuth para registrar en Clerk redirect_urls',
  })
  @IsNotEmpty({ message: 'redirectUrl es obligatorio' })
  @IsString()
  redirectUrl: string;

  @ApiPropertyOptional({
    example: 'exp://192.168.1.14:8081/--/sso-callback',
    description: 'URL de deep link de la app móvil para el salto HTML',
  })
  @IsOptional()
  @IsString()
  appRedirectUrl?: string;

  @ApiPropertyOptional({
    example: 'http://192.168.1.14:3000/api/v1/auth/clerk/oauth-callback',
    description: 'URL HTTP bounce registrada para el navegador',
  })
  @IsOptional()
  @IsString()
  bounceUrl?: string;
}

export class ClerkWatchOAuthDto {
  @ApiProperty({
    example: 'client_3MIYVpVmNIQhT51l24ebBe3ONJl',
    description: 'ID del cliente Clerk que inició el flujo OAuth',
  })
  @IsNotEmpty({ message: 'clientId es obligatorio' })
  @IsString()
  clientId: string;

  @ApiPropertyOptional({
    example: 'sia_3MIYVmiCSCZ8QBGaB2tBRAbASYn',
    description: 'ID del intento SignIn en curso',
  })
  @IsOptional()
  @IsString()
  signInId?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    isArray: true,
    default: [UserRole.CLIENT],
    description: 'Roles del usuario',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];
}
