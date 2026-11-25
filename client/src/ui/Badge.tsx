// src/ui/Badge.tsx
import React from 'react';
import type { Tone } from '@/lib/format';
import { PillBadge, type PillTone } from './Pill';

const TONE_MAP: Record<Tone, PillTone> = {
  neutral: 'neutral',
  accent: 'accent',
  success: 'success',
  warn: 'warn',
  danger: 'danger',
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return <PillBadge label={label} tone={TONE_MAP[tone] ?? 'neutral'} />;
}
