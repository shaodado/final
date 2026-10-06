import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
  const [showConsentModal, setShowConsentModal] = useState(false);

  useEffect(() => {
    const checkConsent = async () => {
      try {
        const agreed = await AsyncStorage.getItem("hasAgreedConsent");
        if (agreed !== "true") {
          setShowConsentModal(true);
        }
      } catch (error) {
        setShowConsentModal(true);
      }
    };
    checkConsent();
  }, []);

  const handleAcceptConsent = async () => {
    try {
      await AsyncStorage.setItem("hasAgreedConsent", "true");
    } catch (error) {
      console.error(error);
    }
    setShowConsentModal(false);
  };

  const login = async () => {
    const trimmedAccount = account.trim();

    if (!trimmedAccount || !password.trim()) {
      Alert.alert("請填寫完整", "請輸入帳號與密碼。");
      return;
    }

    try {
      setLoading(true);
      // 支援 EXPO_PUBLIC_API_BASE_URL 或 EXPO_PUBLIC_API_URL
      const baseUrl =
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        process.env.EXPO_PUBLIC_API_URL ||
        "http://127.0.0.1:8000";

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
        // 🌟 將當前登入者的學號寫入手機本機快取
        if (data.userId) {
          await AsyncStorage.setItem("current_user_id", String(data.userId));
        }

        // role 可能是 "student" / "teacher" / "admin"
        // signIn 會把角色存入 context，由 _layout 依角色導向對應頁面
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

  const [isRegistering, setIsRegistering] = useState(false);
  const [regAccount, setRegAccount] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotStep, setForgotStep] = useState(1);

  const handleRegister = async () => {
    const trimmedAccount = regAccount.trim();
    const trimmedPassword = regPassword.trim();

    if (!trimmedAccount || !trimmedPassword) {
      Alert.alert("請填寫完整", "請輸入註冊信箱與密碼。");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@me\.mcu\.edu\.tw$/;
    if (!emailRegex.test(trimmedAccount)) {
      Alert.alert(
        "信箱格式錯誤",
        "註冊信箱必須為學校發的 email，後綴須為 @me.mcu.edu.tw。"
      );
      return;
    }

    const pwdRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{1,10}$/;
    if (!pwdRegex.test(trimmedPassword)) {
      Alert.alert(
        "密碼格式錯誤",
        "密碼必須是英文與數字混合，且最多 10 碼（不可包含特殊符號）。"
      );
      return;
    }

    try {
      setLoading(true);
      const baseUrl =
        process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const res = await fetch(`${baseUrl}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: trimmedAccount,
          password: trimmedPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        Alert.alert("註冊成功", "您的帳號已成功建立，請使用新帳號登入。", [
          {
            text: "確定",
            onPress: () => {
              setIsRegistering(false);
              setAccount(trimmedAccount);
              setPassword("");
            },
          },
        ]);
      } else {
        Alert.alert("註冊失敗", data.message || "請稍後再試。");
      }
    } catch (error) {
      console.error("註冊錯誤:", error);
      Alert.alert("註冊失敗", "無法連線至伺服器，請確認電腦後端是否已啟動。");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert("請填寫完整", "請輸入您註冊時使用的學校信箱。");
      return;
    }
    try {
      setLoading(true);
      const baseUrl =
        process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${baseUrl}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("驗證碼已寄出", data.message);
        setForgotStep(2);
      } else {
        Alert.alert("錯誤", data.message || "無法寄送驗證碼");
      }
    } catch (error) {
      Alert.alert("連線失敗", "系統發生錯誤。");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotCode.trim() || !newPassword.trim()) {
      Alert.alert("請填寫完整", "請輸入驗證碼與新密碼。");
      return;
    }
    const pwdRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{1,10}$/;
    if (!pwdRegex.test(newPassword.trim())) {
      Alert.alert("密碼格式錯誤", "新密碼必須是英文與數字混合，且最多 10 碼。");
      return;
    }
    try {
      setLoading(true);
      const baseUrl =
        process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${baseUrl}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          code: forgotCode.trim(),
          new_password: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("成功", data.message, [
          {
            text: "確定",
            onPress: () => {
              setShowForgotModal(false);
              setForgotStep(1);
              setForgotCode("");
              setNewPassword("");
              setAccount(forgotEmail.trim());
            },
          },
        ]);
      } else {
        Alert.alert("錯誤", data.message || "密碼重設失敗");
      }
    } catch (error) {
      Alert.alert("連線失敗", "系統發生錯誤。");
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

                <LinearGradient
                  colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.1)"]}
                  style={styles.card}
                >
                  <Text style={styles.cardTitle}>
                    {isRegistering ? "註冊學生帳號" : "登入帳號"}
                  </Text>

                  {isRegistering ? (
                    <>
                      <Text style={styles.label}>
                        學校信箱 (@me.mcu.edu.tw)
                      </Text>
                      <View style={styles.inputWrap}>
                        <Ionicons
                          name="mail-outline"
                          size={19}
                          color="#A9CEC3"
                        />
                        <TextInput
                          value={regAccount}
                          onChangeText={setRegAccount}
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholder="請輸入學校信箱"
                          placeholderTextColor="#7BA79C"
                          style={styles.input}
                          returnKeyType="next"
                        />
                        {!regAccount.includes("@") && regAccount.length > 0 && (
                          <Pressable
                            onPress={() =>
                              setRegAccount(regAccount + "@me.mcu.edu.tw")
                            }
                            style={styles.appendSuffixBtn}
                          >
                            <Text style={styles.appendSuffixText}>
                              補全信箱
                            </Text>
                          </Pressable>
                        )}
                      </View>

                      <Text style={styles.label}>
                        密碼 (英數混合，最多10碼)
                      </Text>
                      <View style={styles.inputWrap}>
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color="#A9CEC3"
                        />
                        <TextInput
                          value={regPassword}
                          onChangeText={setRegPassword}
                          secureTextEntry={!showPassword}
                          placeholder="請設定密碼"
                          placeholderTextColor="#7BA79C"
                          style={styles.input}
                          returnKeyType="done"
                          onSubmitEditing={handleRegister}
                        />
                        <Pressable
                          onPress={() => setShowPassword(!showPassword)}
                          hitSlop={10}
                        >
                          <Ionicons
                            name={
                              showPassword ? "eye-off-outline" : "eye-outline"
                            }
                            size={20}
                            color="#A9CEC3"
                          />
                        </Pressable>
                      </View>

                      <Pressable
                        style={[
                          styles.loginButton,
                          loading && { opacity: 0.7 },
                        ]}
                        onPress={handleRegister}
                        disabled={loading}
                        accessibilityRole="button"
                      >
                        {loading ? (
                          <ActivityIndicator color="#16445A" />
                        ) : (
                          <>
                            <Text style={styles.loginText}>立即註冊</Text>
                            <Ionicons
                              name="person-add-outline"
                              size={18}
                              color="#16445A"
                              style={{ marginLeft: 4 }}
                            />
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => setIsRegistering(false)}
                        style={{ marginTop: 16 }}
                      >
                        <Text
                          style={[
                            styles.hint,
                            { color: "#F2C14E", fontSize: 13 },
                          ]}
                        >
                          已有帳號？點此登入
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>帳號</Text>
                      <View style={styles.inputWrap}>
                        <Ionicons
                          name="person-outline"
                          size={19}
                          color="#A9CEC3"
                        />
                        <TextInput
                          value={account}
                          onChangeText={setAccount}
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholder="學號、工號或管理員帳號"
                          placeholderTextColor="#7BA79C"
                          style={styles.input}
                          returnKeyType="next"
                        />
                        {!account.includes("@") && account.length > 0 && (
                          <Pressable
                            onPress={() =>
                              setAccount(account + "@me.mcu.edu.tw")
                            }
                            style={styles.appendSuffixBtn}
                          >
                            <Text style={styles.appendSuffixText}>
                              補全信箱
                            </Text>
                          </Pressable>
                        )}
                      </View>

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
                            name={
                              showPassword ? "eye-off-outline" : "eye-outline"
                            }
                            size={20}
                            color="#A9CEC3"
                          />
                        </Pressable>
                      </View>

                      <Pressable
                        style={[
                          styles.loginButton,
                          loading && { opacity: 0.7 },
                        ]}
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

                      <Pressable
                        onPress={() => setIsRegistering(true)}
                        style={{ marginTop: 12 }}
                      >
                        <Text
                          style={[
                            styles.hint,
                            { color: "#F2C14E", fontSize: 13 },
                          ]}
                        >
                          還沒有帳號？立即註冊
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setShowForgotModal(true);
                          setForgotStep(1);
                          setForgotEmail("");
                          setForgotCode("");
                          setNewPassword("");
                        }}
                        style={{ marginTop: 8 }}
                      >
                        <Text
                          style={[
                            styles.hint,
                            { color: "#C3E0D8", fontSize: 12 },
                          ]}
                        >
                          忘記密碼？
                        </Text>
                      </Pressable>

                      <Text style={styles.hint}>
                        測試帳號：學生 3001 (密碼 123) · 老師 1001 (密碼 321) ·
                        管理員 2001 (密碼 123)
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* 權限徵求同意書 Modal */}
      <Modal visible={showConsentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>權限徵求同意書</Text>
            <ScrollView style={{ marginTop: 12, marginBottom: 20 }}>
              <Text style={styles.modalText}>
                為了提供完整的選課與學習管理體驗，本應用程式需要您提供「學生資訊系統」以及「Moodle」的帳號與密碼。
              </Text>
              <Text style={styles.modalText}>
                我們將使用這些資訊，反向從校務系統中為您自動獲取課表、成績與作業等相關資料。
              </Text>
              <Text style={styles.modalText}>
                請確認您同意我們使用您的帳號資訊進行資料同步。若您不同意，將無法使用本應用程式的各項功能。
              </Text>
              <Text
                style={[
                  styles.modalText,
                  { color: "#F28C8C", fontWeight: "700", marginTop: 10 },
                ]}
              >
                注意：請妥善保管個人密碼，我們承諾僅將資料用於本應用程式之資料同步用途。
              </Text>
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnDecline]}
                onPress={() =>
                  Alert.alert("提示", "您必須同意才能繼續使用本程式。")
                }
              >
                <Text style={styles.modalBtnDeclineText}>不同意</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnAccept]}
                onPress={handleAcceptConsent}
              >
                <Text style={styles.modalBtnAcceptText}>我同意</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 忘記密碼 Modal */}
      <Modal visible={showForgotModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "60%" }]}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={styles.modalTitle}>忘記密碼</Text>
              <Pressable onPress={() => setShowForgotModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#F0FFF9" />
              </Pressable>
            </View>

            {forgotStep === 1 ? (
              <View>
                <Text style={styles.label}>請輸入註冊信箱</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={19} color="#A9CEC3" />
                  <TextInput
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    autoCapitalize="none"
                    placeholder="請輸入學校信箱"
                    placeholderTextColor="#7BA79C"
                    style={styles.input}
                  />
                  {!forgotEmail.includes("@") && forgotEmail.length > 0 && (
                    <Pressable
                      onPress={() =>
                        setForgotEmail(forgotEmail + "@me.mcu.edu.tw")
                      }
                      style={styles.appendSuffixBtn}
                    >
                      <Text style={styles.appendSuffixText}>補全信箱</Text>
                    </Pressable>
                  )}
                </View>
                <Pressable
                  style={[
                    styles.loginButton,
                    loading && { opacity: 0.7 },
                    { marginTop: 20 },
                  ]}
                  onPress={handleRequestCode}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#16445A" />
                  ) : (
                    <Text style={styles.loginText}>發送驗證碼</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={styles.label}>驗證碼</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="keypad-outline" size={19} color="#A9CEC3" />
                  <TextInput
                    value={forgotCode}
                    onChangeText={setForgotCode}
                    keyboardType="number-pad"
                    placeholder="請輸入6位數驗證碼"
                    placeholderTextColor="#7BA79C"
                    style={styles.input}
                    maxLength={6}
                  />
                </View>

                <Text style={styles.label}>新密碼</Text>
                <View style={styles.inputWrap}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#A9CEC3"
                  />
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    placeholder="請設定新密碼"
                    placeholderTextColor="#7BA79C"
                    style={styles.input}
                  />
                </View>

                <Pressable
                  style={[
                    styles.loginButton,
                    loading && { opacity: 0.7 },
                    { marginTop: 20 },
                  ]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#16445A" />
                  ) : (
                    <Text style={styles.loginText}>重設密碼</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#16445A" },
  safeArea: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 30,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#123A4E",
    borderRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalTitle: {
    color: "#F0FFF9",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  modalText: {
    color: "#C3E0D8",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnDecline: {
    backgroundColor: "rgba(239,255,249,0.1)",
  },
  modalBtnAccept: {
    backgroundColor: "#F2C14E",
  },
  modalBtnDeclineText: {
    color: "#A9CEC3",
    fontSize: 15,
    fontWeight: "700",
  },
  modalBtnAcceptText: {
    color: "#16445A",
    fontSize: 15,
    fontWeight: "800",
  },
  appendSuffixBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(242,193,78,0.15)",
    borderRadius: 8,
    marginLeft: 6,
  },
  appendSuffixText: {
    color: "#F2C14E",
    fontSize: 12,
    fontWeight: "700",
  },
});
