import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

type AuthContextValue = {
  signIn: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside RootLayout');
  return auth;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isSignedIn, setIsSignedIn] = useState(false);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthContext.Provider value={{ signIn: () => setIsSignedIn(true) }}>
        <Stack>
          <Stack.Protected guard={isSignedIn}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="mood" options={{ headerShown: false }} />
            <Stack.Screen name="notes" options={{ headerShown: false }} />
            <Stack.Screen name="courses" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack.Protected>
          <Stack.Protected guard={!isSignedIn}>
            <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
          </Stack.Protected>
        </Stack>
        <StatusBar style="light" />
      </AuthContext.Provider>
    </ThemeProvider>
  );
}
