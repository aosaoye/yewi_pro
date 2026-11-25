import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, PillBadge, radius, space, Text, useTheme } from '@/ui';

export interface CollageMediaItem {
  uri: string;
  type?: 'image' | 'video';
  width?: number;
  height?: number;
}

export function isVideoUri(uri: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(uri) || uri.includes('/video/');
}

function CollageCell({
  item,
  index,
  style,
  extraCount,
  onPressItem,
  onRemove,
  onMeasured,
}: {
  item: CollageMediaItem;
  index: number;
  style?: object;
  extraCount?: number;
  onPressItem?: (index: number) => void;
  onRemove?: (uri: string) => void;
  onMeasured: (uri: string, w: number, h: number) => void;
}) {
  const { colors } = useTheme();
  const isVideo = item.type === 'video' || isVideoUri(item.uri);

  const inner = (
    <>
      <Image
        source={{ uri: item.uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onLoad={(e) => {
          const w = e.source?.width;
          const h = e.source?.height;
          if (w && h) onMeasured(item.uri, w, h);
        }}
      />

      {isVideo ? (
        <View style={s.videoBadge}>
          <PillBadge label="Video" tone="contrast" size="xs" />
        </View>
      ) : null}

      {onRemove ? (
        <Pressable
          onPress={(e) => {
            e?.stopPropagation?.();
            onRemove(item.uri);
          }}
          accessibilityRole="button"
          accessibilityLabel="Quitar archivo"
          style={[s.removeBtn, { backgroundColor: colors.overlay }]}
        >
          <AppIcon name="x" size={14} color="#FFFFFF" />
        </Pressable>
      ) : null}

      {extraCount && extraCount > 0 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            s.extraOverlay,
            { backgroundColor: colors.overlay },
          ]}
        >
          <Text variant="title" style={{ color: '#FFFFFF' }}>
            +{extraCount}
          </Text>
        </View>
      ) : null}
    </>
  );

  if (onPressItem) {
    return (
      <Pressable
        onPress={() => onPressItem(index)}
        accessibilityRole="button"
        accessibilityLabel={`Ver archivo ${index + 1} en galería`}
        style={({ pressed }) => [
          s.cell,
          { backgroundColor: colors.surfaceSubtle },
          style,
          pressed && { opacity: 0.88 },
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        s.cell,
        { backgroundColor: colors.surfaceSubtle },
        style,
      ]}
    >
      {inner}
    </View>
  );
}

/**
 * Collage adaptable según la cantidad y dimensiones de las fotos/videos del portafolio.
 */
export function MediaCollage({
  items,
  onPressItem,
  onRemove,
}: {
  items: readonly CollageMediaItem[];
  onPressItem?: (index: number) => void;
  onRemove?: (uri: string) => void;
}) {
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({});

  if (items.length === 0) return null;

  const handleMeasured = (uri: string, w: number, h: number) => {
    setDims((prev) => {
      const curr = prev[uri];
      if (curr && curr.w === w && curr.h === h) return prev;
      return { ...prev, [uri]: { w, h } };
    });
  };

  const getRatio = (item: CollageMediaItem): number => {
    const d = dims[item.uri];
    const w = item.width || d?.w || 0;
    const h = item.height || d?.h || 0;
    if (w > 0 && h > 0) return w / h;
    return 1.2;
  };

  const visible = items.slice(0, 4);
  const extraCount = items.length > 4 ? items.length - 4 : 0;

  if (visible.length === 1) {
    const r = Math.min(1.75, Math.max(0.8, getRatio(visible[0])));
    return (
      <CollageCell
        item={visible[0]}
        index={0}
        style={{ width: '100%', aspectRatio: r }}
        onPressItem={onPressItem}
        onRemove={onRemove}
        onMeasured={handleMeasured}
      />
    );
  }

  if (visible.length === 2) {
    const bothLandscape =
      getRatio(visible[0]) > 1.2 && getRatio(visible[1]) > 1.2;

    if (bothLandscape) {
      return (
        <View style={s.colGap}>
          <CollageCell
            item={visible[0]}
            index={0}
            style={{ width: '100%', height: 150 }}
            onPressItem={onPressItem}
            onRemove={onRemove}
            onMeasured={handleMeasured}
          />
          <CollageCell
            item={visible[1]}
            index={1}
            style={{ width: '100%', height: 150 }}
            onPressItem={onPressItem}
            onRemove={onRemove}
            onMeasured={handleMeasured}
          />
        </View>
      );
    }

    return (
      <View style={s.rowGap}>
        <CollageCell
          item={visible[0]}
          index={0}
          style={{ flex: 1, height: 220 }}
          onPressItem={onPressItem}
          onRemove={onRemove}
          onMeasured={handleMeasured}
        />
        <CollageCell
          item={visible[1]}
          index={1}
          style={{ flex: 1, height: 220 }}
          onPressItem={onPressItem}
          onRemove={onRemove}
          onMeasured={handleMeasured}
        />
      </View>
    );
  }

  if (visible.length === 3) {
    const firstIsLandscape = getRatio(visible[0]) > 1.25;

    if (firstIsLandscape) {
      return (
        <View style={s.colGap}>
          <CollageCell
            item={visible[0]}
            index={0}
            style={{ width: '100%', height: 165 }}
            onPressItem={onPressItem}
            onRemove={onRemove}
            onMeasured={handleMeasured}
          />
          <View style={s.rowGap}>
            <CollageCell
              item={visible[1]}
              index={1}
              style={{ flex: 1, height: 140 }}
              onPressItem={onPressItem}
              onRemove={onRemove}
              onMeasured={handleMeasured}
            />
            <CollageCell
              item={visible[2]}
              index={2}
              style={{ flex: 1, height: 140 }}
              onPressItem={onPressItem}
              onRemove={onRemove}
              onMeasured={handleMeasured}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={[s.rowGap, { height: 250 }]}>
        <CollageCell
          item={visible[0]}
          index={0}
          style={{ flex: 1.08, height: '100%' }}
          onPressItem={onPressItem}
          onRemove={onRemove}
          onMeasured={handleMeasured}
        />
        <View style={[s.colGap, { flex: 1, height: '100%' }]}>
          <CollageCell
            item={visible[1]}
            index={1}
            style={{ flex: 1 }}
            onPressItem={onPressItem}
            onRemove={onRemove}
            onMeasured={handleMeasured}
          />
          <CollageCell
            item={visible[2]}
            index={2}
            style={{ flex: 1 }}
            onPressItem={onPressItem}
            onRemove={onRemove}
            onMeasured={handleMeasured}
          />
        </View>
      </View>
    );
  }

  // 4+ elementos: collage asimétrico de 2 columnas proporcionales (estilo imagen 1)
  const leftTopFlex = getRatio(visible[0]) > 1.1 ? 0.92 : 1.05;
  const rightTopFlex = getRatio(visible[1]) > 1.1 ? 0.78 : 0.95;

  return (
    <View style={[s.rowGap, { height: 280 }]}>
      <View style={[s.colGap, { flex: 1, height: '100%' }]}>
        <CollageCell
          item={visible[0]}
          index={0}
          style={{ flex: leftTopFlex }}
          onPressItem={onPressItem}
          onRemove={onRemove}
          onMeasured={handleMeasured}
        />
        <CollageCell
          item={visible[2]}
          index={2}
          style={{ flex: 1.12 }}
          onPressItem={onPressItem}
          onRemove={onRemove}
          onMeasured={handleMeasured}
        />
      </View>
      <View style={[s.colGap, { flex: 1, height: '100%' }]}>
        <CollageCell
          item={visible[1]}
          index={1}
          style={{ flex: rightTopFlex }}
          onPressItem={onPressItem}
          onRemove={onRemove}
          onMeasured={handleMeasured}
        />
        <CollageCell
          item={visible[3]}
          index={3}
          style={{ flex: 1.25 }}
          extraCount={extraCount}
          onPressItem={onPressItem}
          onRemove={onRemove}
          onMeasured={handleMeasured}
        />
      </View>
    </View>
  );
}

const GAP = space.xs;

const s = StyleSheet.create({
  rowGap: {
    flexDirection: 'row',
    gap: GAP,
  },
  colGap: {
    gap: GAP,
  },
  cell: {
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
