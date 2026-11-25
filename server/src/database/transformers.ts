import { ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to: (value?: number | string | null): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  },
  from: (value?: string | number | null): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  },
};
