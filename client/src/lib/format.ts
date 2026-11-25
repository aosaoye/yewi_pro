export type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

export function formatEur(
  value: number | string | null | undefined,
  decimals = 2,
): string {
  const num =
    typeof value === 'number'
      ? value
      : parseFloat(String(value ?? 0).replace(',', '.'));
  const safe = Number.isFinite(num) ? num : 0;
  return `${safe.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} €`;
}

export function formatRelativeDate(input?: string | Date | null): string {
  if (!input) return '';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

export function formatShortDate(input?: string | Date | null): string {
  if (!input) return '';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLastSeen(input?: string | Date | null): string {
  if (!input) return '';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Últ. vez hace un momento';
  if (mins < 60) return `Últ. vez hace ${mins} min`;

  const hhmm = date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const dateStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();

  if (dateStart === todayStart) {
    return `Últ. vez hoy a las ${hhmm}`;
  }
  if (todayStart - dateStart === 86_400_000) {
    return `Últ. vez ayer a las ${hhmm}`;
  }

  const ddMmm = date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
  return `Últ. vez el ${ddMmm}`;
}

export function hasValidRating(
  avgRating?: number | null,
  totalReviews?: number | null,
): boolean {
  const rating = Number(avgRating ?? 0);
  const count = Number(totalReviews ?? 0);
  return rating > 0 && count > 0;
}

export function initialsOf(name?: string | null): string {
  const clean = (name || '').trim();
  if (!clean) return 'YW';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function formatOrderStatus(status?: string): {
  label: string;
  tone: 'neutral' | 'accent' | 'success' | 'danger';
} {
  switch (status) {
    case 'PENDING_REQUIREMENTS':
      return { label: 'Esperando datos', tone: 'neutral' };
    case 'IN_PROGRESS':
      return { label: 'En curso', tone: 'accent' };
    case 'DELIVERED':
      return { label: 'Entregado', tone: 'accent' };
    case 'REVISION_REQUESTED':
      return { label: 'En revisión', tone: 'neutral' };
    case 'COMPLETED':
      return { label: 'Completado', tone: 'success' };
    case 'CANCELLED':
      return { label: 'Cancelado', tone: 'danger' };
    case 'DISPUTED':
      return { label: 'En disputa', tone: 'danger' };
    default:
      return { label: status || 'Pendiente', tone: 'neutral' };
  }
}

export function formatLeadStatus(status?: string): {
  label: string;
  tone: 'neutral' | 'accent' | 'success' | 'danger';
} {
  switch (status) {
    case 'OPEN':
      return { label: 'Abierta', tone: 'success' };
    case 'FULFILLED':
      return { label: 'Adjudicada', tone: 'accent' };
    case 'EXPIRED':
      return { label: 'Expirada', tone: 'neutral' };
    case 'CANCELLED':
      return { label: 'Cancelada', tone: 'danger' };
    default:
      return { label: status || 'Abierta', tone: 'neutral' };
  }
}

export function formatKycStatus(status?: string): {
  label: string;
  tone: 'neutral' | 'accent' | 'success' | 'danger';
} {
  switch (status) {
    case 'VERIFIED':
      return { label: 'Verificado', tone: 'success' };
    case 'PENDING_REVIEW':
    case 'PENDING':
      return { label: 'En revisión', tone: 'accent' };
    case 'REJECTED':
      return { label: 'Rechazado', tone: 'danger' };
    default:
      return { label: 'Sin verificar', tone: 'neutral' };
  }
}

export function formatTransactionType(type?: string): string {
  switch (type) {
    case 'DEPOSIT':
      return 'Recarga de saldo';
    case 'CREDIT_PURCHASE':
      return 'Compra de créditos';
    case 'LEAD_UNLOCK':
      return 'Desbloqueo de solicitud';
    case 'ORDER_PAYMENT':
      return 'Pago en Escrow';
    case 'ESCROW_RELEASE':
      return 'Cobro liberado';
    case 'ORDER_REFUND':
      return 'Reembolso Escrow';
    case 'PAYOUT_WITHDRAWAL':
      return 'Retiro bancario';
    default:
      return type || 'Movimiento';
  }
}

export function isOwnProfessional(
  pro?: { id?: string; userId?: string | null; user?: { id?: string | null } | null } | null,
  me?: { id?: string | null; professionalProfile?: { id?: string | null } | null } | null,
): boolean {
  if (!pro || !me) return false;
  if (me.professionalProfile?.id && pro.id === me.professionalProfile.id) {
    return true;
  }
  const proUserId = pro.userId ?? pro.user?.id;
  return Boolean(me.id && proUserId && proUserId === me.id);
}
