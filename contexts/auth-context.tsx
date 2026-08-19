import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

type Account = {
  username: string;
  password: string;
};

type AuthContextValue = {
  isLoading: boolean;
  isSignedIn: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const ACCOUNTS_KEY = 'quiet-space.accounts';
const SESSION_KEY = 'quiet-space.session';
const DEFAULT_ACCOUNT: Account = { username: 'adm', password: '123' };

async function getStoredValue(key: string) {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function setStoredValue(key: string, value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteStoredValue(key: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

async function readAccounts(): Promise<Account[]> {
  const stored = await getStoredValue(ACCOUNTS_KEY);
  if (!stored) {
    await setStoredValue(ACCOUNTS_KEY, JSON.stringify([DEFAULT_ACCOUNT]));
    return [DEFAULT_ACCOUNT];
  }

  try {
    const accounts = JSON.parse(stored) as Account[];
    return accounts.some((account) => account.username === DEFAULT_ACCOUNT.username)
      ? accounts
      : [...accounts, DEFAULT_ACCOUNT];
  } catch {
    await setStoredValue(ACCOUNTS_KEY, JSON.stringify([DEFAULT_ACCOUNT]));
    return [DEFAULT_ACCOUNT];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getStoredValue(SESSION_KEY)
      .then((session) => setUsername(session))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (nextUsername: string, password: string) => {
    const accounts = await readAccounts();
    const account = accounts.find((item) => item.username === nextUsername && item.password === password);
    if (!account) return false;

    await setStoredValue(SESSION_KEY, account.username);
    setUsername(account.username);
    return true;
  };

  const register = async (nextUsername: string, password: string) => {
    const trimmedUsername = nextUsername.trim();
    if (trimmedUsername.length < 2) return { ok: false, message: '帳號至少需要 2 個字元' };
    if (password.length < 3) return { ok: false, message: '密碼至少需要 3 個字元' };

    const accounts = await readAccounts();
    if (accounts.some((account) => account.username === trimmedUsername)) {
      return { ok: false, message: '這個帳號已經存在' };
    }

    await setStoredValue(ACCOUNTS_KEY, JSON.stringify([...accounts, { username: trimmedUsername, password }]));
    await setStoredValue(SESSION_KEY, trimmedUsername);
    setUsername(trimmedUsername);
    return { ok: true };
  };

  const logout = async () => {
    await deleteStoredValue(SESSION_KEY);
    setUsername(null);
  };

  return (
    <AuthContext.Provider value={{ isLoading, isSignedIn: username !== null, username, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
