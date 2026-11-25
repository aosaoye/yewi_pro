import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type CollageMediaItem,
  isVideoUri,
} from '@/components/MediaCollage';
import { getPortfolioGalleryState } from '@/lib/portfolioViewer';
import {
  EmptyState,
  fonts,
  gutter,
  IconButton,
  PillBadge,
  radius,
  Screen,
  space,
  Text,
  useTheme,
} from '@/ui';

export default function PortfolioDetailScreen() {
  const gallery = getPortfolioGalleryState();
  const { width, height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const { colors } = useTheme();
  const listRef = useRef<FlatList<CollageMediaItem>>(null);
  const [activeIndex, setActiveIndex] = useState(gallery.initialIndex);

  const items = gallery.items;

  if (items.length === 0) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={s.emptyHeader}>
          <IconButton
            name="x"
            label="Cerrar galería"
            tone="plain"
            onPress={() => router.back()}
          />
        </View>
        <EmptyState
          icon="image"
          title="Galería vacía"
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIdx = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (nextIdx >= 0 && nextIdx < items.length) {
      setActiveIndex(nextIdx);
    }
  };

  const handleSelectThumb = (index: number) => {
    setActiveIndex(index);
    listRef.current?.scrollToIndex({ index, animated: true });
  };

  return (
    <View style={s.root}>
      {/* Cabecera flotante sobre fondo oscuro */}
      <View
        style={[
          s.headerBar,
          { paddingTop: Math.max(top, space.sm) + space.xs },
        ]}
      >
        <IconButton
          name="x"
          label="Cerrar galería"
          tone="onImage"
          onPress={() => router.back()}
        />
        {items.length > 1 ? (
          <View style={s.counterPill}>
            <Text variant="caption" tabular style={s.counterText}>
              {activeIndex + 1} / {items.length}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Carrusel principal a pantalla completa */}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, idx) => `${item.uri}-${idx}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={gallery.initialIndex}
        getItemLayout={(_d, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item }) => {
          const isVideo = item.type === 'video' || isVideoUri(item.uri);
          return (
            <View style={[s.slide, { width }]}>
              <Image
                source={{ uri: item.uri }}
                style={{ width, height: height * 0.62 }}
                contentFit="contain"
              />
              {isVideo ? (
                <View style={s.videoTag}>
                  <PillBadge label="Video" tone="contrast" size="sm" />
                </View>
              ) : null}
            </View>
          );
        }}
      />

      {/* Pie inferior con miniaturas y detalle del trabajo */}
      <View
        style={[
          s.footer,
          { paddingBottom: Math.max(bottom, space.lg) },
        ]}
      >
        {items.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.thumbStrip}
          >
            {items.map((item, idx) => {
              const selected = idx === activeIndex;
              return (
                <Pressable
                  key={`${item.uri}-${idx}`}
                  onPress={() => handleSelectThumb(idx)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver imagen ${idx + 1}`}
                  style={[
                    s.thumbWrap,
                    selected && {
                      borderWidth: 2,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={s.thumbImg}
                    contentFit="cover"
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {gallery.title ? (
          <Text variant="heading" style={s.footerTitle}>
            {gallery.title}
          </Text>
        ) : null}
        {gallery.description ? (
          <Text variant="body" style={s.footerDesc}>
            {gallery.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  emptyHeader: {
    paddingHorizontal: gutter,
    paddingVertical: space.sm,
    alignItems: 'flex-start',
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  counterText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  videoTag: {
    position: 'absolute',
    bottom: space.lg,
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: gutter,
    paddingTop: space.md,
    gap: space.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  thumbStrip: {
    gap: space.xs,
    paddingBottom: space.xs,
  },
  thumbWrap: {
    width: 54,
    height: 54,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  footerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
  },
  footerDesc: {
    color: 'rgba(255, 255, 255, 0.78)',
    lineHeight: 20,
  },
});
