import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { authApi, usersApi } from '@/api/services';
import type { UserMe } from '@/api/types';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveCachedUser,
  saveTokens,
} from './session';

const BIOMETRIC_VAULT_KEY = 'yewi_biometric_vault_v1';

export interface BiometricVault {
  userId: string;
  email: string;
  accessToken?: string;
  refreshToken?: string;
  updatedAt: number;
}

class BiometricService {
  async isAvailable(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const [hw, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      return Boolean(hw && enrolled);
    } catch {
      return false;
    }
  }

  async getBiometricLabel(): Promise<string> {
    if (Platform.OS === 'web') return 'Biometría';
    try {
      const types =
        await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (
        types.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        )
      ) {
        return Platform.OS === 'ios' ? 'Face ID' : 'Reconocimiento facial';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'Huella digital';
      }
      return 'Biometría';
    } catch {
      return 'Biometría';
    }
  }

  async hasSavedCredentials(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const raw = await SecureStore.getItemAsync(BIOMETRIC_VAULT_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<BiometricVault>;
      return Boolean(parsed?.accessToken || parsed?.refreshToken);
    } catch {
      return false;
    }
  }

  private async writeVault(
    userId: string,
    email: string,
    accessToken?: string | null,
    refreshToken?: string | null,
  ): Promise<void> {
    if (Platform.OS === 'web') return;
    const vault: BiometricVault = {
      userId,
      email,
      accessToken: accessToken ?? undefined,
      refreshToken: refreshToken ?? undefined,
      updatedAt: Date.now(),
    };
    await SecureStore.setItemAsync(BIOMETRIC_VAULT_KEY, JSON.stringify(vault));
  }

  async enableWithCurrentSession(user: UserMe): Promise<boolean> {
    if (!(await this.isAvailable())) return false;
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirma tu identidad para activar el acceso biométrico',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    if (!auth.success) return false;

    const [accessToken, refreshToken] = await Promise.all([
      getAccessToken(),
      getRefreshToken(),
    ]);
    if (!accessToken && !refreshToken) return false;

    await this.writeVault(user.id, user.email, accessToken, refreshToken);
    return true;
  }

  async syncCurrentSessionIfEnabled(user: UserMe): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const hasVault = await this.hasSavedCredentials();
      if (!hasVault) return;
      const [accessToken, refreshToken] = await Promise.all([
        getAccessToken(),
        getRefreshToken(),
      ]);
      if (!accessToken && !refreshToken) return;
      await this.writeVault(user.id, user.email, accessToken, refreshToken);
    } catch {
      // noop
    }
  }

  async disable(): Promise<void> {
    if (Platform.OS === 'web') return;
    await SecureStore.deleteItemAsync(BIOMETRIC_VAULT_KEY).catch(() => undefined);
  }

  async unlockWithBiometrics(): Promise<UserMe | null> {
    if (!(await this.isAvailable())) return null;
    const raw = await SecureStore.getItemAsync(BIOMETRIC_VAULT_KEY);
    if (!raw) return null;

    let vault: BiometricVault;
    try {
      vault = JSON.parse(raw) as BiometricVault;
    } catch {
      return null;
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: `Inicia sesión en Yewi (${vault.email})`,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    if (!auth.success) return null;

    if (vault.accessToken) {
      await saveTokens(vault.accessToken, vault.refreshToken ?? null);
      try {
        const me = await usersApi.getMe();
        await saveCachedUser(me);
        return me;
      } catch {
        // Access token expirado: intentamos rotación con refreshToken
      }
    }

    if (vault.refreshToken) {
      try {
        const refreshed = await authApi.refresh(vault.refreshToken);
        await saveTokens(refreshed.accessToken, refreshed.refreshToken);
        await saveCachedUser(refreshed.user);
        await this.writeVault(
          refreshed.user.id,
          refreshed.user.email,
          refreshed.accessToken,
          refreshed.refreshToken,
        );
        return refreshed.user;
      } catch {
        // Refresh inválido/revocado
      }
    }

    await clearSession();
    return null;
  }
}

export const biometricService = new BiometricService();
