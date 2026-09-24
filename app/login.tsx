import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView, // 👈 1. 引入 ScrollView
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "./_layout";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const login = async () => {
    const trimmedAccount = account.trim();

    if (!trimmedAccount || !password.trim()) {
      Alert.alert("請填寫完整", "請輸入帳號與密碼。");
      return;
    }

    try {
      setLoading(true);
      // @ts-ignore
      const baseUrl =
        process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const res = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: trimmedAccount,
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        signIn(data.role, data.userId, data.name);
      } else {
        Alert.alert("登入失敗", data.message || "帳號或密碼不正確。");
      }
    } catch (error) {
      console.error("登入錯誤:", error);
      Alert.alert("連線失敗", "無法連線至伺服器，請確認電腦後端是否已啟動。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          {/* 👈 2. 加入可捲動容器，並設定點擊空白收合鍵盤 */}
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback
              onPress={Keyboard.dismiss}
              accessible={false}
            >
              <View style={styles.innerContainer}>
                {/* 標題與 Logo */}
                <View style={styles.hero}>
                  <View style={styles.logo}>
                    <Ionicons name="school-outline" size={33} color="#16445A" />
                  </View>
                  <Text style={styles.kicker}>CAMPUS LMS PORTAL</Text>
                  <Text style={styles.title}>歡迎回來</Text>
                  <Text style={styles.copy}>
                    登入後，繼續安排你的學習生活。
                  </Text>
                </View>

                {/* 登入卡片 */}
                <LinearGradient
                  colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.1)"]}
                  style={styles.card}
                >
                  <Text style={styles.cardTitle}>登入帳號</Text>

                  {/* 帳號 */}
                  <Text style={styles.label}>帳號</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="person-outline" size={19} color="#A9CEC3" />
                    <TextInput
                      value={account}
                      onChangeText={setAccount}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="學號 (例: 3001) 或 工號 (例: 1001)"
                      placeholderTextColor="#7BA79C"
                      style={styles.input}
                      returnKeyType="next"
                    />
                  </View>

                  {/* 密碼 */}
                  <Text style={styles.label}>密碼</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color="#A9CEC3"
                    />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholder="請輸入密碼"
                      placeholderTextColor="#7BA79C"
                      style={styles.input}
                      returnKeyType="done"
                      onSubmitEditing={login}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={10}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#A9CEC3"
                      />
                    </Pressable>
                  </View>

                  {/* 登入按鈕 */}
                  <Pressable
                    style={[styles.loginButton, loading && { opacity: 0.7 }]}
                    onPress={login}
                    disabled={loading}
                    accessibilityRole="button"
                  >
                    {loading ? (
                      <ActivityIndicator color="#16445A" />
                    ) : (
                      <>
                        <Text style={styles.loginText}>登入</Text>
                        <Ionicons
                          name="arrow-forward"
                          size={19}
                          color="#16445A"
                        />
                      </>
                    )}
                  </Pressable>

                  <Text style={styles.hint}>
                    測試帳號：學生 3001 (密碼 123) · 老師 1001 (密碼 321)
                  </Text>
                </LinearGradient>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#16445A" },
  safeArea: { flex: 1 },
  scrollContainer: {
    flexGrow: 1, // 讓內容未超過螢幕時自動伸展滿版
    justifyContent: "center", // 平常垂直置中
    paddingHorizontal: 24,
    paddingVertical: 30, // 上下留點彈性，鍵盤彈起時滑到底部不會貼邊
  },
  innerContainer: {
    width: "100%",
  },
  glow: { position: "absolute", borderRadius: 999, opacity: 0.48 },
  glowTop: {
    width: 260,
    height: 260,
    top: -120,
    right: -80,
    backgroundColor: "#F28C8C",
  },
  glowBottom: {
    width: 300,
    height: 300,
    bottom: -110,
    left: -160,
    backgroundColor: "#F2C14E",
  },
  hero: { alignItems: "center", marginBottom: 30 },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DDF8ED",
    marginBottom: 16,
  },
  kicker: {
    color: "#B4D8D2",
    fontSize: 11,
    letterSpacing: 1.7,
    fontWeight: "700",
  },
  title: { color: "#F0FFF9", fontSize: 32, fontWeight: "800", marginTop: 8 },
  copy: { color: "#C3E0D8", fontSize: 13, marginTop: 6 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    padding: 20,
    overflow: "hidden",
  },
  cardTitle: {
    color: "#F0FFF9",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 18,
  },
  label: { color: "#C3E0D8", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    paddingHorizontal: 14,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.28)",
    backgroundColor: "rgba(8,47,61,0.38)",
    marginBottom: 14,
  },
  input: { flex: 1, color: "#F0FFF9", fontSize: 15, height: "100%" },
  loginButton: {
    marginTop: 8,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#F2C14E",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  loginText: { color: "#16445A", fontSize: 15, fontWeight: "800" },
  hint: { color: "#A9CEC3", fontSize: 11, textAlign: "center", marginTop: 16 },
});
