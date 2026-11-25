import type { CollageMediaItem } from '@/components/MediaCollage';

export interface PortfolioGalleryState {
  title: string;
  description?: string;
  items: CollageMediaItem[];
  initialIndex: number;
}

let activeGalleryState: PortfolioGalleryState = {
  title: '',
  description: '',
  items: [],
  initialIndex: 0,
};

export function openPortfolioGallery(payload: {
  title: string;
  description?: string;
  items: readonly CollageMediaItem[];
  initialIndex?: number;
}) {
  const safeIndex = Math.max(
    0,
    Math.min(payload.initialIndex ?? 0, Math.max(0, payload.items.length - 1)),
  );
  activeGalleryState = {
    title: payload.title,
    description: payload.description,
    items: [...payload.items],
    initialIndex: safeIndex,
  };
}

export function getPortfolioGalleryState(): PortfolioGalleryState {
  return activeGalleryState;
}
