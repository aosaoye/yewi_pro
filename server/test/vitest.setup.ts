import 'reflect-metadata';
import { vi } from 'vitest';

if (!(globalThis as Record<string, unknown>).jest) {
  (globalThis as Record<string, unknown>).jest = vi;
}
