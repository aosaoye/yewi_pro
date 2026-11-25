import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import {
  CreateRedsysBizumCheckoutDto,
  RedsysNotificationDto,
} from './dto/redsys-bizum.dto';
import {
  RestoreIapPurchasesDto,
  VerifyIapPurchaseDto,
} from './dto/verify-iap.dto';
import { PaymentsService } from './payments.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('Payments (Pasarela Stripe, Intenciones de Pago & Webhooks)')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('create-intent')
  @ApiOperation({
    summary: 'Crear PaymentIntent para cobro con tarjeta o checkout de Gig',
  })
  @ApiResponse({
    status: 200,
    description: 'clientSecret generado para el frontend',
  })
  async createPaymentIntent(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.paymentsService.createPaymentIntent(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('subscription')
  @ApiOperation({
    summary: 'Consultar estado actual de suscripción Yewi Pro',
  })
  async getSubscriptionStatus(@CurrentUser('id') userId: string) {
    return this.paymentsService.getSubscriptionStatus(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('subscription/sync')
  @ApiOperation({
    summary: 'Sincronizar y forzar comprobación en tiempo real con Stripe',
  })
  async syncSubscription(@CurrentUser('id') userId: string) {
    return this.paymentsService.syncSubscriptionWithStripe(userId);
  }


  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('subscription/cancel')
  @ApiOperation({
    summary: 'Cancelar renovación automática de suscripción Pro in-app',
  })
  async cancelSubscriptionAutoRenew(@CurrentUser('id') userId: string) {
    return this.paymentsService.cancelSubscriptionAutoRenew(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('subscription/resume')
  @ApiOperation({
    summary: 'Reanudar renovación automática de suscripción Pro in-app',
  })
  async resumeSubscriptionAutoRenew(@CurrentUser('id') userId: string) {
    return this.paymentsService.resumeSubscriptionAutoRenew(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('subscription/checkout')
  @ApiOperation({
    summary:
      'Crear sesión de Stripe Checkout para suscripción mensual Yewi Pro (15,99 €/mes)',
  })
  async createSubscriptionCheckout(@CurrentUser('id') userId: string) {
    return this.paymentsService.createSubscriptionCheckout(userId);
  }


  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('subscription/portal')
  @ApiOperation({
    summary:
      'Crear sesión del Stripe Customer Portal para gestionar/cancelar suscripción',
  })
  async createCustomerPortalSession(@CurrentUser('id') userId: string) {
    return this.paymentsService.createCustomerPortalSession(userId);
  }

  @Public()
  @Get('iap/products')
  @ApiOperation({
    summary: 'Listar catálogo oficial de productos In-App Purchase (App Store / Google Play)',
  })
  getIapCatalog() {
    return this.paymentsService.getIapCatalog();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('iap/verify')
  @ApiOperation({
    summary:
      'Verificar recibo de compra integrada (In-App Purchase) y aplicar suscripción, recarga o pedido',
  })
  async verifyIapPurchase(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyIapPurchaseDto,
  ) {
    return this.paymentsService.verifyAndFulfillIapPurchase(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('iap/restore')
  @ApiOperation({
    summary: 'Restaurar compras integradas activas desde App Store / Google Play',
  })
  async restoreIapPurchases(
    @CurrentUser('id') userId: string,
    @Body() dto: RestoreIapPurchasesDto,
  ) {
    return this.paymentsService.restoreIapPurchases(userId, dto);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook de eventos Stripe (PaymentIntents, suscripciones)',
  })
  handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest,
  ) {
    const payload = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.paymentsService.handleWebhook(signature, payload);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('redsys/bizum/checkout')
  @ApiOperation({
    summary: 'Iniciar pago con Bizum vía Redsys TPV Virtual para servicios o presupuestos',
  })
  async createRedsysBizumCheckout(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRedsysBizumCheckoutDto,
    @Req() req: Request,
  ) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto =
      typeof forwardedProto === 'string'
        ? forwardedProto.split(',')[0].trim()
        : req.protocol || 'https';
    const host = req.get('host') || 'localhost:3000';
    return this.paymentsService.createRedsysBizumCheckout(
      userId,
      dto,
      `${proto}://${host}`,
    );
  }

  @Public()
  @Get('redsys/redirect/:orderRef')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Formulario auto-enviado para abrir Redsys Bizum en navegador in-app',
  })
  getRedsysRedirect(@Param('orderRef') orderRef: string) {
    return this.paymentsService.getRedsysRedirectHtml(orderRef);
  }

  @Public()
  @Post('redsys/notify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook de notificación servidor-a-servidor de Redsys (HMAC_SHA256_V1)',
  })
  handleRedsysNotification(@Body() body: RedsysNotificationDto) {
    return this.paymentsService.handleRedsysNotification(body);
  }

  @Public()
  @Get('redsys/return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Retorno desde Redsys Bizum hacia el esquema deep-link de la app',
  })
  handleRedsysReturn(
    @Query('result') result?: string,
    @Query('order') order?: string,
  ) {
    return this.paymentsService.buildRedsysReturnHtml(result, order);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('redsys/status/:orderRef')
  @ApiOperation({
    summary: 'Consultar el estado de un pago Bizum vía Redsys',
  })
  getRedsysStatus(
    @CurrentUser('id') userId: string,
    @Param('orderRef') orderRef: string,
  ) {
    return this.paymentsService.getRedsysOrderStatus(userId, orderRef);
  }
}
