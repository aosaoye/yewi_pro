import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RawResponse } from '../common/decorators/raw-response.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationType } from '../database/enums';
import { DeleteNotificationsDto } from './dto/delete-notifications.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications (Notificaciones & Alertas)')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RawResponse()
  @ApiOperation({ summary: 'Obtener mis notificaciones' })
  @ApiResponse({
    status: 200,
    description: 'Lista de notificaciones recibidas',
  })
  async getMyNotifications(@CurrentUser('id') userId: string) {
    return this.notificationsService.getMyNotifications(userId);
  }

  @Get('unread-count')
  @RawResponse()
  @ApiOperation({ summary: 'Obtener número de notificaciones no leídas' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  async markAsRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Post('push-token')
  @ApiOperation({ summary: 'Registrar token de notificaciones push de Expo' })
  async registerPushToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationsService.registerPushToken(userId, dto.token);
  }

  @Delete('push-token')
  @ApiOperation({ summary: 'Eliminar token de notificaciones push del usuario' })
  async unregisterPushToken(@CurrentUser('id') userId: string) {
    return this.notificationsService.unregisterPushToken(userId);
  }

  @Post('test-push')
  @ApiOperation({ summary: 'Enviar una notificación push de prueba al usuario actual' })
  async sendTestPush(@CurrentUser('id') userId: string) {
    return this.notificationsService.createNotification({
      userId,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Prueba de notificación Yewi',
      message: 'Si ves esto con la app cerrada, las push remotas funcionan.',
      link: '/notifications',
    });
  }

  @Delete('batch')
  @ApiOperation({ summary: 'Eliminar múltiples notificaciones por lote' })
  async deleteBatch(
    @CurrentUser('id') userId: string,
    @Body() dto: DeleteNotificationsDto,
  ) {
    return this.notificationsService.deleteNotifications(userId, dto.ids);
  }

  @Delete('clear-all')
  @ApiOperation({ summary: 'Eliminar todas las notificaciones' })
  async clearAll(@CurrentUser('id') userId: string) {
    return this.notificationsService.deleteNotifications(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una notificación individual' })
  async deleteNotification(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.deleteNotification(userId, id);
  }
}

