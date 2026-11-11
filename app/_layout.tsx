import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import "react-native-reanimated";

if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = (
    title?: string,
    message?: string,
    buttons?: Array<{ text?: string; onPress?: () => void; style?: string }>
  ) => {
    const text = [title, message].filter(Boolean).join("\n\n");
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
      return;
    }
    if (window.confirm(text)) {
      const confirmBtn =
        buttons.find((b) => b.style !== "cancel") || buttons[buttons.length - 1];
      confirmBtn?.onPress?.();
    } else {
      const cancelBtn = buttons.find((b) => b.style === "cancel");
      cancelBtn?.onPress?.();
    }
  };
}

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export type UserRole = "manager" | "teacher" | "student";

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
  const router = useRouter();

  const [role, setRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const signIn = (
    nextRole: UserRole,
    nextUserId: number,
    nextUserName: string
  ) => {
    // 後端回傳的是 "Manager"（大寫），統一轉成小寫再比對守衛
    const normalizedRole = String(nextRole).toLowerCase() as UserRole;

    // 確認沒問題後可以刪掉這行
    console.log("signIn role:", nextRole, "→", normalizedRole);

    setRole(normalizedRole);
    setUserId(nextUserId);
    setUserName(nextUserName);
    setIsSignedIn(true);

    // 登入後立即導向對應角色主頁
    if (normalizedRole === "teacher") {
      router.replace("/teacher" as never);
    } else if (normalizedRole === "manager") {
      router.replace("/manager" as never);
    } else {
      router.replace("/(tabs)" as never);
    }
  };

  const signOut = () => {
    setRole(null);
    setUserId(null);
    setUserName(null);
    setIsSignedIn(false);
  };

  // 保險：登入狀態改變時進行導向
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (wasSignedIn.current && !isSignedIn) {
      router.replace("/login" as never);
    } else if (Platform.OS === "web" && !wasSignedIn.current && isSignedIn && role) {
      if (role === "teacher") {
        router.replace("/teacher" as never);
      } else if (role === "manager") {
        router.replace("/manager" as never);
      } else {
        router.replace("/(tabs)" as never);
      }
    }
    wasSignedIn.current = isSignedIn;
  }, [isSignedIn, role, router]);

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

          {/* 學生專區（僅學生） */}
          <Stack.Protected guard={isSignedIn && role === "student"}>
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

          {/* 管理員專區（名稱必須和檔名完全一致：小寫） */}
          <Stack.Protected guard={isSignedIn && role === "manager"}>
            <Stack.Screen name="manager" options={{ headerShown: false }} />
            <Stack.Screen
              name="manager-announcements"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="manager-accounts"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="manager-evaluations"
              options={{ headerShown: false }}
            />
          </Stack.Protected>
        </Stack>
        <StatusBar style="light" />
      </AuthContext.Provider>
    </ThemeProvider>
  );
}