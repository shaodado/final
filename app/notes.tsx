import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "./_layout";

const defaultAssignments = [
  {
    title: "互動原型期中提案",
    course: "使用者經驗設計",
    due: "明天 23:59",
    done: false,
  },
  {
    title: "資料故事草稿",
    course: "資料視覺化",
    due: "週四 18:00",
    done: false,
  },
  { title: "閱讀心得 #3", course: "數位文化研究", due: "下週一", done: true },
];

const defaultAgenda = [
  "09:10 互動媒體程式設計",
  "13:10 資料視覺化",
  "15:10 社群媒體與文化",
];

const defaultFeeds = [
  {
    icon: "megaphone-outline",
    text: "使用者經驗設計：期中提案繳交期限延至週五。",
    time: "10 分鐘前",
  },
  {
    icon: "calendar-outline",
    text: "資料視覺化：下週課程改為線上同步授課。",
    time: "昨天",
  },
  {
    icon: "document-text-outline",
    text: "數位文化研究：本週閱讀資料已上傳。",
    time: "週一",
  },
];

type Panel = "feed" | "assignments" | "schedule" | "reminder" | null;

export default function NotesScreen() {
  const router = useRouter();
  const { userId, userName } = useAuth();
  const currentUserId = userId || 3001;
  const currentUserName = userName || "同學";

  const [panel, setPanel] = useState<Panel>(null);
  const [completed, setCompleted] = useState<string[]>(
    defaultAssignments.filter((item) => item.done).map((item) => item.title)
  );
  const [smartReminder, setSmartReminder] = useState(false);

  // 動態聯絡簿公告狀態
  const [feedList, setFeedList] = useState<any[]>(defaultFeeds);
  const [loadingFeed, setLoadingFeed] = useState(false);

  // 使用者點擊按鈕或重新整理時呼叫（事件觸發，允許顯示 Loading 動畫）
  const fetchStudentFeed = async () => {
    try {
      setLoadingFeed(true);
      // @ts-ignore
      const baseUrl =
        process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(
        `${baseUrl}/api/student/feed?user_id=${currentUserId}`
      );
      const data = await res.json();

      if (data.success && data.data && data.data.length > 0) {
        setFeedList(data.data);
      } else {
        setFeedList(defaultFeeds);
      }
    } catch (e) {
      console.warn("抓取專屬聯絡簿失敗，切換為離線資料:", e);
      setFeedList(defaultFeeds);
    } finally {
      setLoadingFeed(false);
    }
  };

  // 元件載入時在背景非同步預抓資料（不觸發同步 setState，符合 React 19 與 ESLint 規範）
  useEffect(() => {
    let isMounted = true;

    const loadInitialFeed = async () => {
      try {
        // @ts-ignore
        const baseUrl =
          process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(
          `${baseUrl}/api/student/feed?user_id=${currentUserId}`
        );
        const data = await res.json();

        if (isMounted && data.success && data.data && data.data.length > 0) {
          setFeedList(data.data);
        }
      } catch {
        // 背景預載失敗時保持 defaultFeeds
      }
    };

    loadInitialFeed();

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  const toggleAssignment = (title: string) =>
    setCompleted((old) =>
      old.includes(title)
        ? old.filter((item) => item !== title)
        : [...old, title]
    );

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="返回大廳"
        >
          <Ionicons name="arrow-back" size={20} color="#E9FFF7" />
          <Text style={styles.backText}>大廳</Text>
        </Pressable>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>
            STUDY ORGANIZER · {currentUserName.toUpperCase()}
          </Text>
          <Text style={styles.title}>課表與作業管理</Text>
          <Text style={styles.description}>
            把今天的行程、待辦與課堂訊息放在同一個清楚的位置。
          </Text>

          <Text style={styles.sectionTitle}>管理工具</Text>
          <View style={styles.actions}>
            <Action
              title="查看動態聯絡簿"
              detail="掌握最新課堂公告與異動"
              icon="chatbubbles-outline"
              color="#9AD8ED"
              onPress={() => {
                setPanel("feed");
                fetchStudentFeed();
              }}
            />
            <Action
              title="標記作業完成狀態"
              detail={`${completed.length} / ${defaultAssignments.length} 項作業已完成`}
              icon="checkbox-outline"
              color="#B6E3C2"
              onPress={() => setPanel("assignments")}
            />
            <Action
              title="匯出個人課業時程"
              detail="查看並分享今天的課表"
              icon="calendar-outline"
              color="#F2C14E"
              onPress={() => setPanel("schedule")}
            />
            <Action
              title="自訂提醒規則"
              detail={
                smartReminder ? "智慧催繳提醒已開啟" : "依截止時間安排提醒"
              }
              icon="notifications-outline"
              color="#EAB0D3"
              active={smartReminder}
              onPress={() => setPanel("reminder")}
            />
          </View>

          {panel && (
            <PanelView
              panel={panel}
              close={() => setPanel(null)}
              completed={completed}
              toggleAssignment={toggleAssignment}
              smartReminder={smartReminder}
              setSmartReminder={setSmartReminder}
              feedList={feedList}
              loadingFeed={loadingFeed}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Action({
  title,
  detail,
  icon,
  color,
  active,
  onPress,
}: {
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.action}
      onPress={onPress}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={["rgba(239,255,249,0.34)", "rgba(172,224,208,0.09)"]}
        style={styles.actionGradient}
      >
        <View
          style={[
            styles.actionIcon,
            { backgroundColor: `${color}35`, borderColor: `${color}75` },
          ]}
        >
          <Ionicons name={icon} size={21} color={color} />
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionDetail}>{detail}</Text>
        </View>
        <Ionicons
          name={active ? "checkmark-circle" : "chevron-forward"}
          size={21}
          color={active ? color : "#8EB5AA"}
        />
      </LinearGradient>
    </Pressable>
  );
}

function PanelView({
  panel,
  close,
  completed,
  toggleAssignment,
  smartReminder,
  setSmartReminder,
  feedList,
  loadingFeed,
}: {
  panel: Exclude<Panel, null>;
  close: () => void;
  completed: string[];
  toggleAssignment: (title: string) => void;
  smartReminder: boolean;
  setSmartReminder: (value: boolean) => void;
  feedList: any[];
  loadingFeed: boolean;
}) {
  const title =
    panel === "feed"
      ? "動態聯絡簿"
      : panel === "assignments"
        ? "作業完成狀態"
        : panel === "schedule"
          ? "個人課業時程"
          : "自訂提醒規則";

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Pressable onPress={close} accessibilityLabel="關閉">
          <Ionicons name="close" size={22} color="#D7F0E8" />
        </Pressable>
      </View>

      {panel === "feed" && (
        <View style={{ marginTop: 6 }}>
          {loadingFeed ? (
            <ActivityIndicator
              color="#F2C14E"
              style={{ paddingVertical: 20 }}
            />
          ) : feedList.length > 0 ? (
            feedList.map((item, idx) => (
              <Feed
                key={idx}
                icon={item.icon || "megaphone-outline"}
                text={item.text || item.title || item.content}
                time={item.time || "最新通知"}
              />
            ))
          ) : (
            <Text style={styles.panelCopy}>目前沒有專屬的課堂異動公告。</Text>
          )}
        </View>
      )}

      {panel === "assignments" && (
        <View style={styles.itemList}>
          {defaultAssignments.map((item) => {
            const done = completed.includes(item.title);
            return (
              <Pressable
                key={item.title}
                onPress={() => toggleAssignment(item.title)}
                style={styles.assignment}
              >
                <Ionicons
                  name={done ? "checkmark-circle" : "ellipse-outline"}
                  size={23}
                  color={done ? "#9EF2BE" : "#B9D7CF"}
                />
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemTitle, done && styles.done]}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {item.course} · {item.due}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {panel === "schedule" && (
        <>
          <Text style={styles.panelCopy}>今天 · 課業時程總覽</Text>
          <View style={styles.itemList}>
            {defaultAgenda.map((item) => (
              <View key={item} style={styles.scheduleRow}>
                <Ionicons name="time-outline" size={18} color="#F2C14E" />
                <Text style={styles.itemTitle}>{item}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              Alert.alert(
                "課表已準備完成",
                "你可以從系統分享選單儲存或傳送時程。"
              )
            }
          >
            <Ionicons name="share-outline" size={18} color="#16445A" />
            <Text style={styles.primaryText}>匯出課業時程</Text>
          </Pressable>
        </>
      )}

      {panel === "reminder" && (
        <>
          <Text style={styles.panelCopy}>
            開啟智慧催繳後，系統將依作業截止日與你的完成狀態發送提醒。
          </Text>
          <Pressable
            style={[styles.reminder, smartReminder && styles.reminderOn]}
            onPress={() => setSmartReminder(!smartReminder)}
          >
            <View>
              <Text style={styles.itemTitle}>智慧催繳提醒</Text>
              <Text style={styles.itemMeta}>
                {smartReminder ? "已開啟 · 截止前 24 小時提醒" : "點擊開啟"}
              </Text>
            </View>
            <Ionicons
              name={smartReminder ? "notifications" : "notifications-outline"}
              size={23}
              color={smartReminder ? "#F2C14E" : "#C3E0D8"}
            />
          </Pressable>
        </>
      )}
    </View>
  );
}

function Feed({
  icon,
  text,
  time,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  time: string;
}) {
  return (
    <View style={styles.feed}>
      <View style={styles.feedIcon}>
        <Ionicons name={icon} size={17} color="#9AD8ED" />
      </View>
      <View style={styles.itemCopy}>
        <Text style={styles.feedText}>{text}</Text>
        <Text style={styles.itemMeta}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#16445A" },
  safeArea: { flex: 1, paddingHorizontal: 24 },
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingRight: 14,
  },
  backText: { color: "#E9FFF7", fontSize: 14, fontWeight: "700" },
  content: { paddingTop: 20, paddingBottom: 38 },
  kicker: {
    color: "#B4D8D2",
    fontSize: 11,
    letterSpacing: 1.7,
    fontWeight: "700",
  },
  title: { color: "#F0FFF9", fontSize: 32, fontWeight: "800", marginTop: 10 },
  description: {
    color: "#C3E0D8",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 340,
  },
  sectionTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 32,
    marginBottom: 13,
  },
  actions: { gap: 11 },
  action: { borderRadius: 20, overflow: "hidden" },
  actionGradient: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.3)",
    borderRadius: 20,
  },
  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1, marginHorizontal: 13 },
  actionTitle: { color: "#F0FFF9", fontSize: 15, fontWeight: "800" },
  actionDetail: { color: "#A9CEC3", fontSize: 12, marginTop: 4 },
  panel: {
    marginTop: 28,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "rgba(11,49,63,0.75)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.3)",
  },
  panelHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: { color: "#F0FFF9", fontSize: 18, fontWeight: "800" },
  panelCopy: { color: "#B8D8D0", fontSize: 13, lineHeight: 20, marginTop: 13 },
  itemList: { gap: 9, marginTop: 16 },
  feed: {
    flexDirection: "row",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: "rgba(236,255,248,0.14)",
  },
  feedIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(154,216,237,0.14)",
  },
  itemCopy: { flex: 1, marginLeft: 10 },
  feedText: {
    color: "#F0FFF9",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  itemTitle: { color: "#F0FFF9", fontSize: 13, fontWeight: "700" },
  itemMeta: { color: "#A9CEC3", fontSize: 11, marginTop: 4 },
  assignment: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 13,
    backgroundColor: "rgba(239,255,249,0.08)",
  },
  done: { textDecorationLine: "line-through", color: "#A9CEC3" },
  scheduleRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 13,
    borderRadius: 13,
    backgroundColor: "rgba(239,255,249,0.08)",
  },
  primaryButton: {
    marginTop: 17,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F2C14E",
    borderRadius: 13,
    paddingVertical: 13,
  },
  primaryText: { color: "#16445A", fontWeight: "800" },
  reminder: {
    marginTop: 19,
    padding: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(239,255,249,0.08)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.2)",
  },
  reminderOn: {
    borderColor: "rgba(242,193,78,0.75)",
    backgroundColor: "rgba(242,193,78,0.13)",
  },
});
