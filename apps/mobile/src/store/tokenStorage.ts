import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser } from '../types';

const TOKEN_KEY = 'xinban.access_token';
const REFRESH_KEY = 'xinban.refresh_token';
const USER_KEY = 'xinban.user';

export interface StoredSession {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
}

export async function loadSession(): Promise<StoredSession> {
  try {
    const [accessToken, refreshToken, userJson] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(REFRESH_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]);
    return {
      accessToken,
      refreshToken,
      user: userJson ? (JSON.parse(userJson) as AuthUser) : null,
    };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

export async function persistSession(session: StoredSession): Promise<void> {
  const ops: Promise<void>[] = [];
  if (session.accessToken) ops.push(AsyncStorage.setItem(TOKEN_KEY, session.accessToken));
  if (session.refreshToken) ops.push(AsyncStorage.setItem(REFRESH_KEY, session.refreshToken));
  if (session.user) ops.push(AsyncStorage.setItem(USER_KEY, JSON.stringify(session.user)));
  await Promise.all(ops);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(TOKEN_KEY),
    AsyncStorage.removeItem(REFRESH_KEY),
    AsyncStorage.removeItem(USER_KEY),
  ]);
}
