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
import { useAuth } from "../_layout";

type BubblePosition = "right" | "left" | "center";

type Bubble = {
  label: string;
  subtitle: string;
  route: string;
  position: BubblePosition;
};

type SchoolAnnouncement = {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
};

// 學生專屬已讀快取 Key
const STUDENT_LAST_READ_KEY = "@student_last_read_school_announcement";

const bubbles: Bubble[] = [
  {
    label: "選課模組",
    subtitle: "探索適合你的課程",
    route: "/mood",
    position: "right",
  },
  {
    label: "課表與作業管理",
    subtitle: "掌握課程與作業進度",
    route: "/notes",
    position: "left",
  },
  {
    label: "學分進度管理",
    subtitle: "查看畢業學分進度",
    route: "/courses",
    position: "center",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, userName } = useAuth();

  // @ts-ignore
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const [schoolAnnouncements, setSchoolAnnouncements] = useState<
    SchoolAnnouncement[]
  >([]);
  const [showSchoolModal, setShowSchoolModal] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [hasUnread, setHasUnread] = useState<boolean>(false);

  // 進入畫面時向後端查詢最新校級公告，並比對學生端未讀紅點
  useEffect(() => {
    let isMounted = true;

    const checkSchoolAnnouncements = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/announcements/school`);
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          if (isMounted) setSchoolAnnouncements(json.data);

          const latestId = json.data[0]?.id;
          const lastReadId = await AsyncStorage.getItem(STUDENT_LAST_READ_KEY);

          if (isMounted) {
            setHasUnread(Boolean(latestId && latestId !== lastReadId));
          }
        }
      } catch (error) {
        console.warn("無法取得最新校級公告:", error);
      }
    };

    checkSchoolAnnouncements();

    return () => {
      isMounted = false;
    };
  }, [baseUrl]);

  // 點開鈴鐺：顯示 Modal 並消除紅點（寫入學生本地已讀）
  const handleOpenSchoolAnnouncements = async (): Promise<void> => {
    setShowSchoolModal(true);

    if (hasUnread) {
      setHasUnread(false);
      const latestId = schoolAnnouncements[0]?.id;
      if (latestId) {
        await AsyncStorage.setItem(STUDENT_LAST_READ_KEY, latestId);
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

  const handleBubblePress = (route: string): void => {
    router.push(route as never);
  };

  return (
    <View style={styles.page}>
      {/* 背景光暈 */}
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        {/* 頁首 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>A QUIET PLACE FOR YOU</Text>
            <Text style={styles.headerTitle}>
              {userName ? `${userName}的空間` : "我的空間"}
            </Text>
          </View>

          {/* 右上方控制區：白色鈴鐺 + 登出按鈕 */}
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
              {/* 有新公告時才顯示未讀紅點 */}
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

        {/* 頁面介紹 */}
        <View style={styles.intro}>
          <Text style={styles.introTitle}>今天想去哪裡？</Text>
          <Text style={styles.introCopy}>選一顆泡泡，進入你的專屬空間</Text>
        </View>

        {/* 功能泡泡 */}
        <View style={styles.bubbleField}>
          {bubbles.map((bubble) => (
            <BubbleButton
              key={bubble.label}
              bubble={bubble}
              onPress={() => handleBubblePress(bubble.route)}
            />
          ))}
        </View>

        {/* 底部提示 */}
        <Text style={styles.footerNote}>
          每一次選擇，都讓你的校園生活更有方向
        </Text>
      </SafeAreaView>

      {/* 校級公告獨立彈窗 (Modal) */}
      <Modal
        visible={showSchoolModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSchoolModal(false)}
      >
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

      {/* 登出確認（覆蓋層，不使用 Modal） */}
      {showLogoutConfirm && (
        <View style={styles.dialogBackdrop} accessibilityViewIsModal>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowLogoutConfirm(false)}
          />

          <LinearGradient
            colors={[
              "rgba(239,255,249,0.28)",
              "rgba(172,224,208,0.1)",
            ]}
            style={[styles.dialog, { backgroundColor: "#16445A", borderWidth: 1, borderColor: "rgba(236,255,248,0.35)", borderRadius: 24 }]}
          >
            <Text style={[styles.dialogTitle, { color: "#F0FFF9", fontSize: 19, marginBottom: 10 }]}>要登出嗎？</Text>
            <Text style={[styles.dialogText, { color: "#C3E0D8", marginBottom: 6 }]}>
              登出後需要重新輸入帳號密碼才能進入你的專屬空間。
            </Text>

            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setShowLogoutConfirm(false)}
                style={[styles.dialogButton, styles.dialogCancel, { backgroundColor: "rgba(8,47,61,0.38)", borderWidth: 1, borderColor: "rgba(236,255,248,0.28)", borderRadius: 14 }]}
              >
                <Text style={[styles.dialogCancelText, { color: "#F0FFF9" }]}>取消</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmLogout}
                style={[styles.dialogButton, styles.dialogConfirm, { backgroundColor: "#F2C14E", borderRadius: 14 }]}
              >
                <Text style={[styles.dialogConfirmText, { color: "#16445A" }]}>登出</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

type BubbleButtonProps = {
  bubble: Bubble;
  onPress: () => void;
};

function BubbleButton({ bubble, onPress }: BubbleButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`前往${bubble.label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bubble,
        getBubblePositionStyle(bubble.position),
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

        <Text
          style={[
            styles.bubbleLabel,
            bubble.label.length > 6 && styles.bubbleLabelLong,
          ]}
        >
          {bubble.label}
        </Text>

        <Text style={styles.bubbleSubtitle}>{bubble.subtitle}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function getBubblePositionStyle(position: BubblePosition) {
  switch (position) {
    case "right":
      return styles.bubbleRight;
    case "left":
      return styles.bubbleLeft;
    case "center":
      return styles.bubbleCenter;
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#16445A",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  glow: {
    position: "absolute",
    borderRadius: 999,
  },
  glowTop: {
    width: 280,
    height: 280,
    top: -135,
    right: -90,
    backgroundColor: "#F28C8C",
    opacity: 0.42,
  },
  glowBottom: {
    width: 320,
    height: 320,
    bottom: -135,
    left: -175,
    backgroundColor: "#F2C14E",
    opacity: 0.32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 22,
  },
  eyebrow: {
    color: "#8FB8AE",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
  },
  headerTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  buttonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.95 }],
  },
  logoutText: {
    color: "#F0FFF9",
    fontSize: 12,
    fontWeight: "700",
  },
  intro: {
    alignItems: "center",
    marginTop: 48,
  },
  introTitle: {
    color: "#F1FFF9",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  introCopy: {
    color: "#9EC3B8",
    fontSize: 13,
    marginTop: 9,
  },
  bubbleField: {
    flex: 1,
    minHeight: 460,
    justifyContent: "space-evenly",
    paddingVertical: 18,
  },
  bubble: {
    width: 154,
    height: 154,
    borderRadius: 100,
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
  bubbleRight: {
    alignSelf: "flex-end",
    marginRight: 4,
  },
  bubbleLeft: {
    alignSelf: "flex-start",
    marginLeft: 0,
  },
  bubbleCenter: {
    alignSelf: "center",
    marginLeft: 28,
  },
  bubbleGradient: {
    flex: 1,
    borderRadius: 100,
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
    color: "#F0EEE9", // 淺色（香檳白）
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 27,
    textAlign: "center",
    paddingHorizontal: 18,
  },
  bubbleLabelLong: {
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 17,
  },
  bubbleSubtitle: {
    color: "#E0D8D0", // 淺色（淺大地金）
    fontSize: 10.5,
    lineHeight: 16,
    marginTop: 7,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  footerNote: {
    textAlign: "center",
    color: "#86AAA1",
    fontSize: 11,
    paddingBottom: 17,
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
  schoolTagText: {
    color: "#ffffff",
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

  // 登出確認（覆蓋層）
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