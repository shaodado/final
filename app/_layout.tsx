import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { createContext, useContext, useState } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export type UserRole = "admin" | "teacher" | "student";

type AuthContextValue = {
  role: UserRole | null;
  userId: number | null;
  userName: string | null;
  isSignedIn: boolean;
  signIn: (role: UserRole, userId: number, userName: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside RootLayout");
  return auth;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [role, setRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const signIn = (
    nextRole: UserRole,
    nextUserId: number,
    nextUserName: string
  ) => {
    setRole(nextRole);
    setUserId(nextUserId);
    setUserName(nextUserName);
    setIsSignedIn(true);
  };

  const signOut = () => {
    setRole(null);
    setUserId(null);
    setUserName(null);
    setIsSignedIn(false);
  };

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthContext.Provider
        value={{ role, userId, userName, isSignedIn, signIn, signOut }}
      >
        <Stack>
          <Stack.Protected guard={!isSignedIn}>
            <Stack.Screen
              name="login"
              options={{ headerShown: false, animation: "fade" }}
            />
          </Stack.Protected>

          {/* 學生或管理員皆可存取學生專區 */}
          <Stack.Protected
            guard={isSignedIn && (role === "admin" || role === "student")}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="mood" options={{ headerShown: false }} />
            <Stack.Screen name="notes" options={{ headerShown: false }} />
            <Stack.Screen name="courses" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack.Protected>

          {/* 教師專區 */}
          <Stack.Protected guard={isSignedIn && role === "teacher"}>
            <Stack.Screen name="teacher" options={{ headerShown: false }} />
            <Stack.Screen
              name="teacher-courses"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="teacher-course-detail"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="teacher-announcements"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="teacher-assign-ta"
              options={{ headerShown: false }}
            />
          </Stack.Protected>
        </Stack>
        <StatusBar style="light" />
      </AuthContext.Provider>
    </ThemeProvider>
  );
}
