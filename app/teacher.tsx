import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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

  const handleLogout = (): void => {
    signOut();
  };

  const handleCoursePress = (): void => {
    router.push("/teacher-courses" as never);
  };

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TEACHER PORTAL</Text>
            <Text style={styles.title}>老師專區</Text>
          </View>

          {/* 右上方控制區：白色鈴鐺按鈕 + 登出按鈕 */}
          <View style={styles.headerRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="校級公告"
              onPress={handleOpenSchoolAnnouncements}
              style={({ pressed }) => [
                styles.bellButton,
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

        {/* Welcome */}
        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>歡迎回到老師專區</Text>
          <Text style={styles.welcomeDescription}>
            選擇課程，管理課程資訊與相關事項
          </Text>
        </View>

        {/* Main Area */}
        <View style={styles.mainArea}>
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
                "rgba(250,255,253,0.78)",
                "rgba(178,225,212,0.30)",
                "rgba(120,185,173,0.10)",
              ]}
              locations={[0, 0.52, 1]}
              style={styles.bubbleGradient}
            >
              <View style={styles.bubbleShine} />
              <View style={styles.bubbleGlow} />

              <View style={styles.bubbleContent}>
                <Text style={styles.bubbleSmallText}>COURSE</Text>
                <Text style={styles.bubbleTitle}>課程專區</Text>
                <Text style={styles.bubbleDescription}>查看與管理課程</Text>
              </View>
            </LinearGradient>
          </Pressable>

          <View style={styles.featureBox}>
            <Text style={styles.featureTitle}>課程專區</Text>
            <Text style={styles.featureDescription}>
              課程資訊 ・ 指派助教 ・ 發布公告
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>TEACHER COURSE MANAGEMENT</Text>
        </View>
      </SafeAreaView>

      {/* 校級公告獨立彈窗 (Modal) */}
      <Modal visible={showSchoolModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
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

              <Pressable onPress={() => setShowSchoolModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#F0FFF9" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#16445A" },
  safeArea: { flex: 1, paddingHorizontal: 24 },
  glow: { position: "absolute", borderRadius: 999 },
  glowTop: {
    width: 280,
    height: 280,
    top: -135,
    right: -90,
    backgroundColor: "#F28C8C",
    opacity: 0.34,
  },
  glowBottom: {
    width: 320,
    height: 320,
    bottom: -145,
    left: -175,
    backgroundColor: "#F2C14E",
    opacity: 0.25,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 22,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: {
    color: "#8FB8AE",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  title: { color: "#F0FFF9", fontSize: 27, fontWeight: "700", marginTop: 5 },

  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#F28C8C",
  },

  logoutButton: {
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  buttonPressed: { opacity: 0.65, transform: [{ scale: 0.95 }] },
  logoutText: { color: "#F0FFF9", fontSize: 12, fontWeight: "700" },

  welcome: { alignItems: "center", marginTop: 55 },
  welcomeTitle: {
    color: "#F1FFF9",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  welcomeDescription: {
    color: "#9EC3B8",
    fontSize: 12,
    marginTop: 9,
    textAlign: "center",
  },

  mainArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubble: {
    width: 205,
    height: 205,
    borderRadius: 105,
    shadowColor: "#020D0D",
    shadowOffset: { width: 8, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 12,
  },
  bubblePressed: { opacity: 0.9, transform: [{ scale: 0.94 }] },
  bubbleGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 105,
    borderWidth: 1.5,
    borderColor: "rgba(229,255,247,0.76)",
    overflow: "hidden",
  },
  bubbleShine: {
    position: "absolute",
    width: 135,
    height: 46,
    top: 12,
    left: 30,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.32)",
    transform: [{ rotate: "-25deg" }],
  },
  bubbleGlow: {
    position: "absolute",
    width: 105,
    height: 105,
    right: -35,
    bottom: -35,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  bubbleContent: { alignItems: "center" },
  bubbleSmallText: {
    color: "#4B756D",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  bubbleTitle: { color: "#173F3B", fontSize: 25, fontWeight: "800" },
  bubbleDescription: { color: "#35655D", fontSize: 11, marginTop: 8 },

  featureBox: {
    alignItems: "center",
    marginTop: 34,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  featureTitle: { color: "#C5E7DC", fontSize: 12, fontWeight: "700" },
  featureDescription: {
    color: "#86AAA1",
    fontSize: 10,
    marginTop: 6,
    textAlign: "center",
  },

  footer: { alignItems: "center", paddingBottom: 17 },
  footerLine: {
    width: 38,
    height: 1,
    backgroundColor: "rgba(180,216,210,0.25)",
    marginBottom: 9,
  },
  footerText: {
    color: "#668F87",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modalContent: {
    height: "75%",
    backgroundColor: "#123A4E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { color: "#F0FFF9", fontSize: 18, fontWeight: "800" },
  modalSubtitle: { color: "#9AD8ED", fontSize: 11, marginTop: 2 },

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
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  schoolTagText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  metaTimeText: { color: "#A9CEC3", fontSize: 11 },
  announcementTitle: {
    color: "#F0FFF9",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  announcementContent: { color: "#DDEFE7", fontSize: 13, lineHeight: 19 },
});
