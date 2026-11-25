import type { TransactionItem } from '@/api/types';

export interface MonthlyFinancialPoint {
  key: string;
  shortLabel: string;
  capLabel: string;
  income: number;
  outflow: number;
  net: number;
}

export interface PeriodComparison {
  hasPrevious: boolean;
  deltaPercent: number;
  direction: 'up' | 'down' | 'flat';
  referenceLabel: string;
  formattedPercent: string;
}

const MONTH_SHORT_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

const MONTH_CAP_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

const POSITIVE_TX_TYPES = new Set([
  'DEPOSIT',
  'ESCROW_RELEASE',
  'ORDER_REFUND',
  'LEAD_REFUND',
]);

export function isPositiveTransaction(type?: string | null): boolean {
  return Boolean(type && POSITIVE_TX_TYPES.has(type));
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }
  return `rgba(0, 180, 216, ${safeAlpha})`;
}

export function buildMonthlyFinancialSeries(
  transactions: TransactionItem[],
  monthsCount = 6,
  now = new Date(),
): MonthlyFinancialPoint[] {
  const count = Math.max(2, monthsCount);
  const buckets = new Map<string, MonthlyFinancialPoint>();
  const orderedKeys: string[] = [];

  for (let offset = count - 1; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    orderedKeys.push(key);
    buckets.set(key, {
      key,
      shortLabel: MONTH_SHORT_ES[month],
      capLabel: MONTH_CAP_ES[month],
      income: 0,
      outflow: 0,
      net: 0,
    });
  }

  for (const tx of transactions) {
    if (tx.status === 'FAILED' || tx.status === 'CANCELLED') continue;
    const date = new Date(tx.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;

    const amount = Math.abs(Number(tx.amount || 0));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (isPositiveTransaction(tx.type)) {
      bucket.income += amount;
      bucket.net += amount;
    } else {
      bucket.outflow += amount;
      bucket.net -= amount;
    }
  }

  return orderedKeys.map((k) => buckets.get(k)!);
}

export function computePeriodComparison(
  values: number[],
  capLabels: string[],
  activeIndex: number,
): PeriodComparison {
  if (activeIndex <= 0 || activeIndex >= values.length) {
    return {
      hasPrevious: false,
      deltaPercent: 0,
      direction: 'flat',
      referenceLabel: capLabels[activeIndex] ?? 'Periodo inicial',
      formattedPercent: '0,0 %',
    };
  }

  const current = values[activeIndex] ?? 0;
  const prev = values[activeIndex - 1] ?? 0;
  const currentLabel = capLabels[activeIndex] ?? '';
  const prevLabel = capLabels[activeIndex - 1] ?? '';
  const ref = prevLabel ? `${currentLabel} vs ${prevLabel}` : currentLabel;

  let deltaPercent = 0;
  if (Math.abs(prev) < 0.005) {
    if (current > 0.005) deltaPercent = 100;
    else if (current < -0.005) deltaPercent = -100;
    else deltaPercent = 0;
  } else {
    deltaPercent = ((current - prev) / Math.abs(prev)) * 100;
  }

  const direction: PeriodComparison['direction'] =
    deltaPercent > 0.05 ? 'up' : deltaPercent < -0.05 ? 'down' : 'flat';

  const prefix = deltaPercent > 0.05 ? '+' : '';
  const formattedPercent = `${prefix}${deltaPercent.toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;

  return {
    hasPrevious: true,
    deltaPercent,
    direction,
    referenceLabel: ref,
    formattedPercent,
  };
}
