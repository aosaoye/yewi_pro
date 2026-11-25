import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  useAddPortfolioItem,
  useDeletePortfolioItem,
  useMe,
  useMyProProfile,
  useSubscription,
} from '@/api/hooks';
import { professionalsApi } from '@/api/services';
import {
  type CollageMediaItem,
  MediaCollage,
} from '@/components/MediaCollage';
import { openPortfolioGallery } from '@/lib/portfolioViewer';
import {
  Button,
  Divider,
  EmptyState,
  Field,
  FormScroll,
  gutter,
  NavHeader,
  PillButton,
  radius,
  Screen,
  Section,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

interface DraftMedia extends CollageMediaItem {
  base64?: string | null;
}

export default function PortfolioManageScreen() {
  const { colors } = useTheme();
  const meQuery = useMe();
  const proQuery = useMyProProfile();
  const subQuery = useSubscription();
  const addPortfolio = useAddPortfolioItem();
  const deletePortfolio = useDeletePortfolioItem();

  const isPro = Boolean(
    meQuery.data?.isPro || proQuery.data?.isPro || subQuery.data?.isPro,
  );

  const [projTitle, setProjTitle] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [mediaList, setMediaList] = useState<DraftMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const handlePickPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      toast.error('Permiso de galería requerido');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.75,
      base64: true,
    });
    if (res.canceled || !res.assets?.length) return;
    setMediaList((prev) => [
      ...prev,
      ...res.assets.map((asset) => ({
        uri: asset.uri,
        type: 'image' as const,
        width: asset.width,
        height: asset.height,
        base64: asset.base64,
      })),
    ]);
  };

  const handlePickVideo = async () => {
    if (!isPro) {
      toast.info('Los videos en el portafolio requieren suscripción Yewi Pro');
      router.push('/subscription' as never);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      toast.error('Permiso de galería requerido');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.length) return;
    setMediaList((prev) => [
      ...prev,
      ...res.assets.map((asset) => ({
        uri: asset.uri,
        type: 'video' as const,
        width: asset.width,
        height: asset.height,
      })),
    ]);
  };

  const handleRemoveMedia = (uri: string) => {
    setMediaList((prev) => prev.filter((item) => item.uri !== uri));
  };

  const handleSaveProject = async () => {
    if (savingRef.current) return;
    if (!projTitle.trim() || !projDesc.trim()) {
      toast.error('Completa título y descripción del trabajo');
      return;
    }
    if (mediaList.length === 0) {
      toast.error('Añade al menos una foto para previsualizar el portafolio');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const uploadedUrls: string[] = [];
      for (const item of mediaList) {
        if (item.type === 'image') {
          const payload = item.base64
            ? `data:image/jpeg;base64,${item.base64}`
            : item.uri;
          try {
            const uploaded = await professionalsApi.uploadPortfolioImage(payload);
            uploadedUrls.push(uploaded.url);
          } catch {
            uploadedUrls.push(item.uri);
          }
        } else {
          uploadedUrls.push(item.uri);
        }
      }

      await addPortfolio.mutateAsync({
        title: projTitle.trim(),
        description: projDesc.trim(),
        imageUrls: uploadedUrls,
      });
      setProjTitle('');
      setProjDesc('');
      setMediaList([]);
      toast.success('Trabajo añadido al portafolio');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo añadir el proyecto',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const portfolioItems = proQuery.data?.portfolioItems ?? [];

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Portafolio de trabajos" solidSurface />

      <FormScroll>
        <Field
          icon="edit-3"
          label="Título del trabajo"
          placeholder="Reforma baño completo"
          value={projTitle}
          onChangeText={setProjTitle}
        />
        <Field
          icon="file-text"
          label="Descripción"
          placeholder="Plato de ducha resina y alicatado porcelánico..."
          multiline
          numberOfLines={3}
          value={projDesc}
          onChangeText={setProjDesc}
        />

        <View style={s.mediaActions}>
          <PillButton
            icon="image"
            label="Añadir fotos"
            variant="soft"
            tone="primary"
            size="md"
            onPress={() => void handlePickPhotos()}
          />
          <PillButton
            icon={isPro ? 'upload' : 'lock'}
            label={isPro ? 'Añadir video' : 'Video (Solo Pro)'}
            variant="outline"
            tone={isPro ? 'contrast' : 'neutral'}
            size="md"
            onPress={() => void handlePickVideo()}
          />
        </View>

        {mediaList.length > 0 ? (
          <View style={s.previewBox}>
            <Text variant="label" tone="secondary">
              Vista previa
            </Text>
            <MediaCollage
              items={mediaList}
              onPressItem={(idx) => {
                openPortfolioGallery({
                  title: projTitle.trim() || 'Vista previa',
                  description: projDesc.trim() || undefined,
                  items: mediaList,
                  initialIndex: idx,
                });
                router.push('/portfolio-detail' as never);
              }}
              onRemove={handleRemoveMedia}
            />

            {projTitle.trim() || projDesc.trim() ? (
              <View
                style={[
                  s.liveCard,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text variant="caption" tone="muted">
                  Previsualización en tu perfil
                </Text>
                <Text variant="heading" style={{ color: colors.text }}>
                  {projTitle.trim() || 'Título del trabajo'}
                </Text>
                <Text variant="body" tone="secondary">
                  {projDesc.trim() || 'Descripción del trabajo...'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Button
          icon="plus"
          title="Publicar en portafolio"
          loading={saving || addPortfolio.isPending}
          disabled={saving || addPortfolio.isPending}
          onPress={handleSaveProject}
        />

        <Divider />

        <Section title="Publicados">
          {portfolioItems.length === 0 ? (
            <EmptyState
              icon="image"
              title="Sin trabajos aún"
              message="Sube fotos de tus trabajos para mostrarlos en tu perfil."
            />
          ) : (
            portfolioItems.map((item, idx) => (
              <React.Fragment key={item.id}>
                {idx > 0 ? <Divider /> : null}
                <View style={s.savedItem}>
                  {(item.imageUrls?.length ?? 0) > 0 ? (
                    <MediaCollage
                      items={item.imageUrls.map((url) => ({ uri: url }))}
                      onPressItem={(mediaIdx) => {
                        openPortfolioGallery({
                          title: item.title,
                          description: item.description,
                          items: item.imageUrls.map((url) => ({ uri: url })),
                          initialIndex: mediaIdx,
                        });
                        router.push('/portfolio-detail' as never);
                      }}
                    />
                  ) : null}
                  <View style={s.portRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="heading" style={{ color: colors.text }}>
                        {item.title}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {item.description}
                      </Text>
                    </View>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Eliminar"
                      loading={deletePortfolio.isPending}
                      onPress={() => void deletePortfolio.mutateAsync(item.id)}
                    />
                  </View>
                </View>
              </React.Fragment>
            ))
          )}
        </Section>
      </FormScroll>
    </Screen>
  );
}

const s = StyleSheet.create({
  mediaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.md,
  },
  previewBox: {
    gap: space.sm,
    marginBottom: space.md,
  },
  liveCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: gutter,
    gap: 4,
  },
  savedItem: {
    gap: space.sm,
    paddingVertical: space.xs,
  },
  portRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
});
