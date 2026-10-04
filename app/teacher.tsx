import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "./_layout";

// 泡泡大小：想跟學生頁完全一樣可改成 154
const BUBBLE_SIZE = 190;

type SchoolAnnouncement = {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
};

const LAST_READ_STORAGE_KEY = "@teacher_last_read_school_announcement";

/* 預設備援公告（若完全斷網或資料庫無資料時呈現） */
const defaultSchoolAnnouncements: SchoolAnnouncement[] = [
  {
    id: "school-001",
    title: "114學年度第一學期開學公告",
    content:
      "114學年度第一學期即將開始，請全校師生留意選課、加退選及校務系統維護日程。",
    publishedAt: "2026年08月20日",
  },
  {
    id: "school-002",
    title: "校園安全宣導",
    content:
      "請全校教職員與同學注意校園安全，離開研究室與教室時請確認門窗及電源是否關閉。",
    publishedAt: "2026年08月18日",
  },
  {
    id: "school-003",
    title: "學校系統維護通知",
    content:
      "全校核心校務系統將於近期進行伺服器升級與資安檢測，維護期間部分服務可能暫時中斷。",
    publishedAt: "2026年08月15日",
  },
];

export default function TeacherScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  // @ts-ignore
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const [schoolAnnouncements, setSchoolAnnouncements] = useState<
    SchoolAnnouncement[]
  >(defaultSchoolAnnouncements);
  const [showSchoolModal, setShowSchoolModal] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [hasUnread, setHasUnread] = useState<boolean>(false);

  // 進入畫面時向後端查詢最新校級公告，並比對未讀紅點
  useEffect(() => {
    let isMounted = true;

    const checkSchoolAnnouncements = async () => {
      try {
        let currentList = defaultSchoolAnnouncements;

        // 向後端請求真實校級公告
        const res = await fetch(`${baseUrl}/api/announcements/school`);
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          currentList = json.data;
          if (isMounted) setSchoolAnnouncements(json.data);
        }

        // 取出最新一則公告的 ID (資料庫真實 ObjectId)
        const latestId = currentList[0]?.id;
        const lastReadId = await AsyncStorage.getItem(LAST_READ_STORAGE_KEY);

        // 比對最新公告與手機本地已讀紀錄
        if (isMounted) {
          if (latestId && latestId !== lastReadId) {
            setHasUnread(true);
          } else {
            setHasUnread(false);
          }
        }
      } catch (error) {
        console.warn("無法取得最新校級公告，使用本地備份比對:", error);
      }
    };

    checkSchoolAnnouncements();

    return () => {
      isMounted = false;
    };
  }, [baseUrl]);

  // 點開鈴鐺：顯示 Modal 並消除紅點（寫入已讀）
  const handleOpenSchoolAnnouncements = async (): Promise<void> => {
    setShowSchoolModal(true);

    if (hasUnread) {
      setHasUnread(false);
      const latestId = schoolAnnouncements[0]?.id;
      if (latestId) {
        await AsyncStorage.setItem(LAST_READ_STORAGE_KEY, latestId);
      }
    }
  };

  // 按「登出」：先跳出確認視窗
  const handleLogout = (): void => {
    setShowLogoutConfirm(true);
  };

  // 確認視窗按下「登出」：才真的登出
  // 確認視窗不是 Modal，所以不會有「關閉動畫吃掉登出」的問題
  const handleConfirmLogout = (): void => {
    setShowLogoutConfirm(false);
    signOut();
  };

  const handleCoursePress = (): void => {
    router.push("/teacher-courses" as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* 背景 Glow */}
        <View style={styles.pinkGlow} />
        <View style={styles.yellowGlow} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ========================= */}
          {/* 標題列：左邊標題，右邊鈴鐺＋登出 */}
          {/* ========================= */}
          <View style={styles.topBar}>
            <View style={styles.topBarText}>
              <Text style={styles.smallTitle}>TEACHER PORTAL</Text>
              <Text style={styles.title}>老師專區</Text>
            </View>

            <View style={styles.topBarActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="校級公告"
                onPress={handleOpenSchoolAnnouncements}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color="#FFFFFF"
                />
                {/* 有新公告時才渲染紅點 */}
                {hasUnread && <View style={styles.unreadDot} />}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="登出"
                onPress={handleLogout}
                style={({ pressed }) => [
                  styles.logoutButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.logoutText}>登出</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.description}>
            選擇課程，管理課程資訊與相關事項
          </Text>

          {/* ========================= */}
          {/* 中央區域：只放泡泡，垂直置中 */}
          {/* ========================= */}
          <View style={styles.centerArea}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="進入課程專區"
              onPress={handleCoursePress}
              style={({ pressed }) => [
                styles.bubble,
                pressed && styles.bubblePressed,
              ]}
            >
              <LinearGradient
                colors={[
                  "rgba(245,255,252,0.72)",
                  "rgba(166,221,207,0.25)",
                  "rgba(117,181,169,0.10)",
                ]}
                locations={[0, 0.55, 1]}
                style={styles.bubbleGradient}
              >
                <View style={styles.bubbleShine} />
                <View style={styles.bubbleGlow} />

                <Text style={styles.bubbleLabel}>課程專區</Text>
                <Text style={styles.bubbleSubtitle}>查看與管理課程</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* ========================= */}
          {/* 功能說明（只保留這一張） */}
          {/* ========================= */}
          <View style={styles.featureBox}>
            <Text style={styles.featureTitle}>課程專區</Text>
            <Text style={styles.featureDescription}>
              課程資訊 ・ 指派助教 ・ 發布公告
            </Text>
          </View>

          {/* ========================= */}
          {/* 底部文字 */}
          {/* ========================= */}
          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerTitle}>TEACHER • COURSE • MANAGEMENT</Text>
            <Text style={styles.footerText}>校園智慧助手</Text>
          </View>
        </ScrollView>
      </View>

      {/* ========================= */}
      {/* 校級公告獨立彈窗 (Modal) */}
      {/* ========================= */}
      <Modal
        visible={showSchoolModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSchoolModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowSchoolModal(false)}
          />

          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconWrap}>
                  <Ionicons
                    name="megaphone-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                </View>
                <View>
                  <Text style={styles.modalTitle}>校級公告</Text>
                  <Text style={styles.modalSubtitle}>由學校發布之全校通知</Text>
                </View>
              </View>

              <Pressable
                accessibilityLabel="關閉"
                onPress={() => setShowSchoolModal(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color="#F0FFF9" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalScroll}
            >
              {schoolAnnouncements.map((item) => (
                <LinearGradient
                  key={item.id}
                  colors={["rgba(239,255,249,0.22)", "rgba(172,224,208,0.08)"]}
                  style={styles.schoolCard}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.schoolTag}>
                      <Text style={styles.schoolTagText}>全校公告</Text>
                    </View>
                    <Text style={styles.metaTimeText}>{item.publishedAt}</Text>
                  </View>
                  <Text style={styles.announcementTitle}>{item.title}</Text>
                  <Text style={styles.announcementContent}>{item.content}</Text>
                </LinearGradient>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================= */}
      {/* 登出確認（覆蓋層，不使用 Modal） */}
      {/* ========================= */}
      {showLogoutConfirm && (
        <View style={styles.dialogBackdrop} accessibilityViewIsModal>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowLogoutConfirm(false)}
          />

          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>要登出嗎？</Text>
            <Text style={styles.dialogText}>
              登出後需要重新輸入帳號密碼才能進入老師專區。
            </Text>

            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setShowLogoutConfirm(false)}
                style={[styles.dialogButton, styles.dialogCancel]}
              >
                <Text style={styles.dialogCancelText}>取消</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmLogout}
                style={[styles.dialogButton, styles.dialogConfirm]}
              >
                <Text style={styles.dialogConfirmText}>登出</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ==================================
  // 整體
  // ==================================
  safeArea: {
    flex: 1,
    backgroundColor: "#16445A",
  },

  container: {
    flex: 1,
    backgroundColor: "#16445A",
    overflow: "hidden",
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // ==================================
  // Glow
  // ==================================
  pinkGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#F28C8C",
    opacity: 0.18,
    top: -120,
    right: -80,
  },

  yellowGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#F2C14E",
    opacity: 0.16,
    bottom: -100,
    left: -100,
  },

  // ==================================
  // 標題列
  // ==================================
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
  },

  topBarText: {
    flexShrink: 1,
  },

  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  smallTitle: {
    fontSize: 11,
    letterSpacing: 3,
    color: "#F2C14E",
    fontWeight: "700",
    marginBottom: 6,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#F0FFF9",
  },

  description: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(240,255,249,0.72)",
    marginTop: 14,
    marginBottom: 10,
  },

  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  unreadDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F28C8C",
    borderWidth: 1,
    borderColor: "#16445A",
  },

  logoutButton: {
    minWidth: 58,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  logoutText: {
    color: "#F0FFF9",
    fontSize: 13,
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.95 }],
  },

  // ==================================
  // 中央區域（只放泡泡，垂直置中）
  // paddingTop 可以微調：數字越大，泡泡越往下
  // ==================================
  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 50,
    paddingBottom: 10,
  },

  // ==================================
  // 泡泡（與學生頁相同的玻璃質感）
  // ==================================
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    shadowColor: "#020D0D",
    shadowOffset: { width: 6, height: 9 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },

  bubblePressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },

  bubbleGradient: {
    flex: 1,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(224,255,245,0.72)",
    overflow: "hidden",
  },

  bubbleShine: {
    position: "absolute",
    width: 105,
    height: 43,
    top: 10,
    left: 23,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.30)",
    transform: [{ rotate: "-25deg" }],
  },

  bubbleGlow: {
    position: "absolute",
    width: 75,
    height: 75,
    right: -20,
    bottom: -18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  bubbleLabel: {
    color: "#F0EEE9",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 29,
    textAlign: "center",
    paddingHorizontal: 18,
  },

  bubbleSubtitle: {
    color: "#E0D8D0",
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 7,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  // ==================================
  // 功能說明
  // ==================================
  featureBox: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 28,
    backgroundColor: "rgba(240,255,249,0.10)",
    borderWidth: 1,
    borderColor: "rgba(240,255,249,0.14)",
  },

  featureTitle: {
    color: "#F0FFF9",
    fontSize: 16,
    fontWeight: "800",
  },

  featureDescription: {
    color: "rgba(240,255,249,0.72)",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },

  // ==================================
  // Footer
  // ==================================
  footer: {
    marginTop: "auto",
    paddingTop: 40,
    alignItems: "center",
  },

  footerLine: {
    width: 38,
    height: 1,
    backgroundColor: "rgba(180,216,210,0.25)",
    marginBottom: 10,
  },

  footerTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: "rgba(240,255,249,0.45)",
    marginBottom: 5,
  },

  footerText: {
    fontSize: 12,
    color: "rgba(240,255,249,0.35)",
  },

  // ==================================
  // 公告 Modal
  // ==================================
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },

  modalContent: {
    height: "75%",
    backgroundColor: "#123A4E",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  modalIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  modalTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "800",
  },

  modalSubtitle: {
    color: "#9AD8ED",
    fontSize: 11,
    marginTop: 2,
  },

  modalScroll: {
    flex: 1,
  },

  schoolCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.22)",
    padding: 15,
    marginBottom: 12,
  },

  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  schoolTag: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  schoolTagText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  metaTimeText: {
    color: "#A9CEC3",
    fontSize: 11,
  },

  announcementTitle: {
    color: "#F0FFF9",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },

  announcementContent: {
    color: "#DDEFE7",
    fontSize: 13,
    lineHeight: 19,
  },

  // ==================================
  // 登出確認（覆蓋層）
  // ==================================
  dialogBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    elevation: 50,
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  dialog: {
    backgroundColor: "#F0FFF9",
    borderRadius: 32,
    padding: 24,
  },

  dialogTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#16445A",
    marginBottom: 8,
  },

  dialogText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#426875",
  },

  dialogActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },

  dialogButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  dialogCancel: {
    backgroundColor: "rgba(22,68,90,0.10)",
  },

  dialogCancelText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#16445A",
  },

  dialogConfirm: {
    backgroundColor: "#F2C14E",
  },

  dialogConfirmText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#16445A",
  },
});