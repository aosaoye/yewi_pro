import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  useMe,
  useMyProposals,
  useMyRequests,
  useOpportunities,
  useOrders,
} from '@/api/hooks';
import { AppHeader } from '@/components/AppHeader';
import { LeadOpportunityCard, OrderRowCard } from '@/components/YewiCards';
import { formatEur } from '@/lib/format';
import { getAccessToken, onSessionChange } from '@/lib/session';
import {
  AppIcon,
  EmptyState,
  ErrorState,
  gutter,
  type IconName,
  ListGroup,
  ListRow,
  Screen,
  SkeletonRows,
  space,
  Text,
  useTheme,
} from '@/ui';

function proposalStatusMeta(status?: string): {
  icon: IconName;
  label: string;
} {
  switch (status) {
    case 'ACCEPTED':
      return { icon: 'check-circle', label: 'Aceptado' };
    case 'REJECTED':
      return { icon: 'x-circle', label: 'Rechazado' };
    default:
      return { icon: 'clock', label: 'Pendiente' };
  }
}

export default function RequestsScreen() {
  const { colors } = useTheme();
  const [hasSession, setHasSession] = useState(false);
  const [subTab, setSubTab] = useState<'requests' | 'orders'>('requests');

  useEffect(() => {
    void getAccessToken().then((t) => setHasSession(Boolean(t)));
    return onSessionChange((loggedIn) => setHasSession(loggedIn));
  }, []);

  const meQuery = useMe(hasSession);
  const user = meQuery.data;
  const isProMode = Boolean(
    user?.roles?.includes('PROFESSIONAL') || user?.professionalProfile,
  );

  const myRequestsQuery = useMyRequests(hasSession && !isProMode);
  const opportunitiesQuery = useOpportunities({}, hasSession && isProMode);
  const myProposalsQuery = useMyProposals(hasSession && isProMode);
  const ordersQuery = useOrders(
    isProMode ? 'pro' : 'client',
    hasSession && subTab === 'orders',
  );

  const userName =
    user?.profile?.displayName ||
    [user?.profile?.firstName, user?.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Yewi';

  if (!hasSession) {
    return (
      <Screen edges={['bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <AppHeader userName="Yewi" title="Encargos" />
          <View style={s.emptyWrap}>
            <EmptyState
              icon="clipboard"
              title="Tus encargos"
              message="Inicia sesión para continuar."
              actionLabel="Iniciar sesión"
              onAction={() => router.push('/(auth)/login' as never)}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const refreshing =
    myRequestsQuery.isRefetching ||
    opportunitiesQuery.isRefetching ||
    ordersQuery.isRefetching;

  const handleRefresh = () => {
    if (subTab === 'orders') {
      void ordersQuery.refetch();
    } else if (isProMode) {
      void opportunitiesQuery.refetch();
      void myProposalsQuery.refetch();
    } else {
      void myRequestsQuery.refetch();
    }
  };

  return (
    <Screen edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <AppHeader
          userName={userName}
          avatarUrl={user?.profile?.avatarUrl}
          title={isProMode ? 'Oportunidades' : 'Encargos'}
          tabs={[
            {
              key: 'requests',
              label: isProMode ? 'Oportunidades' : 'Solicitudes',
              icon: isProMode ? 'compass' : 'clipboard',
            },
            {
              key: 'orders',
              label: 'Pedidos',
              icon: 'shield',
            },
          ]}
          activeTab={subTab}
          onSelectTab={(k) => setSubTab(k as 'requests' | 'orders')}
          onPressAdd={() =>
            router.push(
              (isProMode ? '/publish-gig' : '/create-request') as never,
            )
          }
          addLabel={isProMode ? 'Publicar servicio' : 'Pedir presupuesto'}
        />

        <View style={s.list}>
          {subTab === 'orders' ? (
            ordersQuery.isLoading ? (
              <SkeletonRows count={3} />
            ) : ordersQuery.isError ? (
              <ErrorState
                error={ordersQuery.error}
                onRetry={() => void ordersQuery.refetch()}
              />
            ) : (ordersQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon="shopping-bag"
                title="Sin pedidos"
                message="Tus contrataciones aparecerán aquí."
              />
            ) : (
              <ListGroup>
                {(ordersQuery.data ?? []).map((ord) => (
                  <OrderRowCard
                    key={ord.id}
                    order={ord}
                    onPress={() =>
                      router.push(
                        `/conversation?orderId=${encodeURIComponent(ord.id)}` as never,
                      )
                    }
                  />
                ))}
              </ListGroup>
            )
          ) : isProMode ? (
            <>
              {opportunitiesQuery.isLoading ? (
                <SkeletonRows count={3} />
              ) : opportunitiesQuery.isError ? (
                <ErrorState
                  error={opportunitiesQuery.error}
                  onRetry={() => void opportunitiesQuery.refetch()}
                />
              ) : (opportunitiesQuery.data ?? []).length === 0 ? (
                <EmptyState
                  icon="compass"
                  title="Sin oportunidades"
                  message="Vuelve más tarde."
                />
              ) : (
                <ListGroup>
                  {(opportunitiesQuery.data ?? []).map((lead) => (
                    <LeadOpportunityCard
                      key={lead.id}
                      lead={lead}
                      onPress={() =>
                        router.push(
                          `/request-detail?id=${encodeURIComponent(lead.id)}` as never,
                        )
                      }
                    />
                  ))}
                </ListGroup>
              )}

              {(myProposalsQuery.data?.length ?? 0) > 0 ? (
                <View style={{ paddingTop: space.sm }}>
                  <ListGroup title="Presupuestos enviados">
                    {(myProposalsQuery.data ?? []).map((prop) => {
                      const statusMeta = proposalStatusMeta(prop.status);
                      return (
                        <ListRow
                          key={prop.id}
                          icon="file-text"
                          plainIcon
                          title={prop.serviceRequest?.title || 'Solicitud'}
                          subtitle={`${formatEur(prop.price)} · ${prop.estimatedDays} días`}
                          right={
                            <View style={s.proposalStatus}>
                              <AppIcon
                                name={statusMeta.icon}
                                size={14}
                                color={colors.textSecondary}
                              />
                              <Text
                                variant="caption"
                                style={{ color: colors.textSecondary }}
                              >
                                {statusMeta.label}
                              </Text>
                            </View>
                          }
                        />
                      );
                    })}
                  </ListGroup>
                </View>
              ) : null}
            </>
          ) : myRequestsQuery.isLoading ? (
            <SkeletonRows count={3} />
          ) : myRequestsQuery.isError ? (
            <ErrorState
              error={myRequestsQuery.error}
              onRetry={() => void myRequestsQuery.refetch()}
            />
          ) : (myRequestsQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon="file-text"
                title="Sin solicitudes"
                message="Crea tu primera solicitud."
                actionLabel="Crear solicitud"
                onAction={() => router.push('/create-request' as never)}
              />
          ) : (
            <ListGroup>
              {(myRequestsQuery.data ?? []).map((reqItem) => (
                <LeadOpportunityCard
                  key={reqItem.id}
                  lead={reqItem}
                  onPress={() =>
                    router.push(
                      `/request-detail?id=${encodeURIComponent(reqItem.id)}` as never,
                    )
                  }
                />
              ))}
            </ListGroup>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: gutter,
  },
  scrollContent: {
    paddingBottom: space.xxl,
  },
  list: {
    paddingTop: space.xs,
  },
  proposalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
