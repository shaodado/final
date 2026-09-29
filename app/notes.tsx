import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

/* 預設 7 筆公告，方便即時驗證一頁 5 筆的翻頁效果 */
const defaultFeeds = [
  {
    icon: "megaphone-outline",
    title: "期中提案延期",
    content:
      "使用者經驗設計：期中提案繳交期限延至週五，請同學於繳交前確認原型連結與權限設定完整。",
    time: "10 分鐘前",
    course_name: "使用者經驗設計",
  },
  {
    icon: "calendar-outline",
    title: "上課方式異動",
    content:
      "資料視覺化：因應校外專家演講，下週課程改為線上同步授課，會議連結已寄發至校園信箱。",
    time: "昨天",
    course_name: "資料視覺化",
  },
  {
    icon: "document-text-outline",
    title: "課堂資料更新",
    content:
      "數位文化研究：本週閱讀補充資料已上傳至教學平台，請同學提早下載並準備課堂小組討論要點。",
    time: "週一",
    course_name: "數位文化研究",
  },
  {
    icon: "alert-circle-outline",
    title: "分組名單確認",
    content:
      "互動媒體程式設計：期末專案分組名單已截止登記，請各組組長確認成員名冊與題目提案。",
    time: "3 天前",
    course_name: "互動媒體程式設計",
  },
  {
    icon: "clipboard-outline",
    title: "作業繳交格式規範",
    content:
      "社群媒體與文化：作業二請一律轉為 PDF 檔案上傳，檔名請依「學號_姓名_作業2」命名。",
    time: "4 天前",
    course_name: "社群媒體與文化",
  },
  {
    icon: "time-outline",
    title: "助教課輔諮詢時段調整",
    content:
      "使用者經驗設計：本週四助教 Office Hour 調整至 15:30~17:30，地點在系館 302 研討室。",
    time: "上週",
    course_name: "使用者經驗設計",
  },
  {
    icon: "checkmark-done-outline",
    title: "期中平時成績公佈",
    content:
      "資料視覺化：前半學期平時作業與出缺席分數已登錄於成績系統，請同學於週日前複查。",
    time: "上週",
    course_name: "資料視覺化",
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

  // 當前點選查看詳情的公告索引（null 代表關閉彈窗）
  const [selectedFeedIndex, setSelectedFeedIndex] = useState<number | null>(
    null
  );

  // Modal 彈窗內的前後公告判斷
  const hasPrevFeed = selectedFeedIndex !== null && selectedFeedIndex > 0;
  const hasNextFeed =
    selectedFeedIndex !== null && selectedFeedIndex < feedList.length - 1;

  const handlePrevFeed = () => {
    if (hasPrevFeed && selectedFeedIndex !== null) {
      setSelectedFeedIndex(selectedFeedIndex - 1);
    }
  };

  const handleNextFeed = () => {
    if (hasNextFeed && selectedFeedIndex !== null) {
      setSelectedFeedIndex(selectedFeedIndex + 1);
    }
  };

  const currentSelectedFeed =
    selectedFeedIndex !== null ? feedList[selectedFeedIndex] : null;

  // 使用者手動點擊或重新整理時呼叫
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

  // 背景預載（符合 ESLint 規範，杜絕串聯渲染警告）
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
        // 預設保持 defaultFeeds
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
            <View>
              <Action
                title="查看動態聯絡簿"
                detail="掌握最新課堂公告與異動"
                icon="chatbubbles-outline"
                color="#9AD8ED"
                expanded={panel === "feed"}
                onPress={() => {
                  if (panel === "feed") {
                    setPanel(null);
                    return;
                  }
                  setPanel("feed");
                  fetchStudentFeed();
                }}
              />
              {panel === "feed" && (
                <PanelView
                  panel={panel}
                  close={() => setPanel(null)}
                  completed={completed}
                  toggleAssignment={toggleAssignment}
                  smartReminder={smartReminder}
                  setSmartReminder={setSmartReminder}
                  feedList={feedList}
                  loadingFeed={loadingFeed}
                  onSelectFeedIndex={(idx) => setSelectedFeedIndex(idx)}
                />
              )}
            </View>
            <View>
              <Action
                title="標記作業完成狀態"
                detail={`${completed.length} / ${defaultAssignments.length} 項作業已完成`}
                icon="checkbox-outline"
                color="#B6E3C2"
                expanded={panel === "assignments"}
                onPress={() =>
                  setPanel(panel === "assignments" ? null : "assignments")
                }
              />
              {panel === "assignments" && (
                <PanelView
                  panel={panel}
                  close={() => setPanel(null)}
                  completed={completed}
                  toggleAssignment={toggleAssignment}
                  smartReminder={smartReminder}
                  setSmartReminder={setSmartReminder}
                  feedList={feedList}
                  loadingFeed={loadingFeed}
                  onSelectFeedIndex={(idx) => setSelectedFeedIndex(idx)}
                />
              )}
            </View>
            <View>
              <Action
                title="匯出個人課業時程"
                detail="查看並分享今天的課表"
                icon="calendar-outline"
                color="#F2C14E"
                expanded={panel === "schedule"}
                onPress={() =>
                  setPanel(panel === "schedule" ? null : "schedule")
                }
              />
              {panel === "schedule" && (
                <PanelView
                  panel={panel}
                  close={() => setPanel(null)}
                  completed={completed}
                  toggleAssignment={toggleAssignment}
                  smartReminder={smartReminder}
                  setSmartReminder={setSmartReminder}
                  feedList={feedList}
                  loadingFeed={loadingFeed}
                  onSelectFeedIndex={(idx) => setSelectedFeedIndex(idx)}
                />
              )}
            </View>
            <View>
              <Action
                title="自訂提醒規則"
                detail={
                  smartReminder ? "智慧催繳提醒已開啟" : "依截止時間安排提醒"
                }
                icon="notifications-outline"
                color="#EAB0D3"
                active={smartReminder}
                expanded={panel === "reminder"}
                onPress={() =>
                  setPanel(panel === "reminder" ? null : "reminder")
                }
              />
              {panel === "reminder" && (
                <PanelView
                  panel={panel}
                  close={() => setPanel(null)}
                  completed={completed}
                  toggleAssignment={toggleAssignment}
                  smartReminder={smartReminder}
                  setSmartReminder={setSmartReminder}
                  feedList={feedList}
                  loadingFeed={loadingFeed}
                  onSelectFeedIndex={(idx) => setSelectedFeedIndex(idx)}
                />
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* 結構化公告詳情彈窗（具備上一頁／下一頁導航） */}
      <Modal
        visible={selectedFeedIndex !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedFeedIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* 彈窗頂部列 */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={styles.modalTagRow}>
                  <View style={styles.detailTag}>
                    <Text style={styles.detailTagText}>
                      {currentSelectedFeed?.course_name ||
                        currentSelectedFeed?.type ||
                        "課堂公告"}
                    </Text>
                  </View>
                  <Text style={styles.modalMetaDate}>
                    {currentSelectedFeed?.time ||
                      currentSelectedFeed?.publishedAt ||
                      "最新通知"}
                  </Text>
                </View>
                <Text style={styles.modalFullTitle}>
                  {currentSelectedFeed?.title || "公告詳情"}
                </Text>
              </View>

              <Pressable
                onPress={() => setSelectedFeedIndex(null)}
                hitSlop={12}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#F0FFF9" />
              </Pressable>
            </View>

            {/* 內文滾動區域 */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollBody}
            >
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>公告內容</Text>
                <Text style={styles.modalFullContent}>
                  {currentSelectedFeed?.content ||
                    currentSelectedFeed?.text ||
                    "無詳細內容"}
                </Text>
              </View>

              {/* 截止期限資訊（若有） */}
              {(currentSelectedFeed?.due_date ||
                currentSelectedFeed?.expiresAt) && (
                <View style={styles.deadlineCard}>
                  <Ionicons name="time-outline" size={16} color="#F28C8C" />
                  <Text style={styles.deadlineText}>
                    截止期限：
                    {currentSelectedFeed.due_date ||
                      currentSelectedFeed.expiresAt}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* 彈窗底部「上一頁 / 下一頁」分頁導航列 */}
            <View style={styles.paginationFooter}>
              <Pressable
                disabled={!hasPrevFeed}
                onPress={handlePrevFeed}
                style={({ pressed }) => [
                  styles.pageButton,
                  !hasPrevFeed && styles.pageButtonDisabled,
                  pressed && hasPrevFeed && styles.pageButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="上一則公告"
              >
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={hasPrevFeed ? "#F0FFF9" : "rgba(240,255,249,0.3)"}
                />
                <Text
                  style={[
                    styles.pageButtonText,
                    !hasPrevFeed && styles.pageButtonTextDisabled,
                  ]}
                >
                  上一頁
                </Text>
              </Pressable>

              <Text style={styles.pageIndicator}>
                {selectedFeedIndex !== null
                  ? `${selectedFeedIndex + 1} / ${feedList.length}`
                  : ""}
              </Text>

              <Pressable
                disabled={!hasNextFeed}
                onPress={handleNextFeed}
                style={({ pressed }) => [
                  styles.pageButton,
                  !hasNextFeed && styles.pageButtonDisabled,
                  pressed && hasNextFeed && styles.pageButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="下一則公告"
              >
                <Text
                  style={[
                    styles.pageButtonText,
                    !hasNextFeed && styles.pageButtonTextDisabled,
                  ]}
                >
                  下一頁
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={hasNextFeed ? "#F0FFF9" : "rgba(240,255,249,0.3)"}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Action({
  title,
  detail,
  icon,
  color,
  active,
  expanded,
  onPress,
}: {
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  active?: boolean;
  expanded?: boolean;
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
          name={
            expanded
              ? "chevron-down"
              : active
                ? "checkmark-circle"
                : "chevron-forward"
          }
          size={21}
          color={expanded || active ? color : "#8EB5AA"}
        />
      </LinearGradient>
    </Pressable>
  );
}

function PanelView({
  panel,
  completed,
  toggleAssignment,
  smartReminder,
  setSmartReminder,
  feedList,
  loadingFeed,
  onSelectFeedIndex,
}: {
  panel: Exclude<Panel, null>;
  close: () => void;
  completed: string[];
  toggleAssignment: (title: string) => void;
  smartReminder: boolean;
  setSmartReminder: (value: boolean) => void;
  feedList: any[];
  loadingFeed: boolean;
  onSelectFeedIndex: (idx: number) => void;
}) {
  const title =
    panel === "feed"
      ? "動態聯絡簿"
      : panel === "assignments"
        ? "作業完成狀態"
        : panel === "schedule"
          ? "個人課業時程"
          : "自訂提醒規則";

  // 動態聯絡簿分頁設定：每頁固定 5 筆
  const PAGE_SIZE = 5;
  const [feedPage, setFeedPage] = useState<number>(1);
  const totalPages = Math.ceil(feedList.length / PAGE_SIZE) || 1;

  // 計算當前頁要渲染的子陣列與起始全域索引
  const startIndex = (feedPage - 1) * PAGE_SIZE;
  const displayedFeeds = feedList.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
      </View>

      {panel === "feed" && (
        <View style={{ marginTop: 6 }}>
          {loadingFeed ? (
            <ActivityIndicator
              color="#F2C14E"
              style={{ paddingVertical: 20 }}
            />
          ) : feedList.length > 0 ? (
            <>
              {displayedFeeds.map((item, idx) => {
                // 將分頁內的局部索引換算為全域索引，確保 Modal 彈窗連動正確
                const globalIndex = startIndex + idx;
                return (
                  <Feed
                    key={item.id || globalIndex}
                    icon={item.icon || "megaphone-outline"}
                    title={item.title || "課堂公告"}
                    content={item.content || item.text || ""}
                    time={item.time || "最新通知"}
                    onPress={() => onSelectFeedIndex(globalIndex)}
                  />
                );
              })}

              {/* 公告列表「上一頁 / 下一頁」分頁導航列 */}
              <View style={styles.paginationFooter}>
                <Pressable
                  disabled={feedPage <= 1}
                  onPress={() => setFeedPage((p) => Math.max(1, p - 1))}
                  style={({ pressed }) => [
                    styles.pageButton,
                    feedPage <= 1 && styles.pageButtonDisabled,
                    pressed && feedPage > 1 && styles.pageButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="列表上一頁"
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={feedPage > 1 ? "#F0FFF9" : "rgba(240,255,249,0.3)"}
                  />
                  <Text
                    style={[
                      styles.pageButtonText,
                      feedPage <= 1 && styles.pageButtonTextDisabled,
                    ]}
                  >
                    上一頁
                  </Text>
                </Pressable>

                <Text style={styles.pageIndicator}>
                  {feedPage} / {totalPages}
                </Text>

                <Pressable
                  disabled={feedPage >= totalPages}
                  onPress={() =>
                    setFeedPage((p) => Math.min(totalPages, p + 1))
                  }
                  style={({ pressed }) => [
                    styles.pageButton,
                    feedPage >= totalPages && styles.pageButtonDisabled,
                    pressed &&
                      feedPage < totalPages &&
                      styles.pageButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="列表下一頁"
                >
                  <Text
                    style={[
                      styles.pageButtonText,
                      feedPage >= totalPages && styles.pageButtonTextDisabled,
                    ]}
                  >
                    下一頁
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={
                      feedPage < totalPages
                        ? "#F0FFF9"
                        : "rgba(240,255,249,0.3)"
                    }
                  />
                </Pressable>
              </View>
            </>
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
  title,
  content,
  time,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  content: string;
  time: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.feed, pressed && styles.feedPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`查看公告：${title}`}
    >
      <View style={styles.feedIcon}>
        <Ionicons name={icon} size={18} color="#9AD8ED" />
      </View>
      <View style={styles.itemCopy}>
        {/* 主題單行截斷 */}
        <Text
          style={styles.feedTitleText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {/* 內文單行截斷 */}
        {content ? (
          <Text
            style={styles.feedContentText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {content}
          </Text>
        ) : null}
        <Text style={styles.itemMeta}>{time}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color="rgba(142,181,170,0.6)"
      />
    </Pressable>
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
    marginTop: 8,
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

  /* 動態聯絡簿卡片按鈕樣式 */
  feed: {
    flexDirection: "row",
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: "rgba(236,255,248,0.14)",
    alignItems: "center",
    borderRadius: 12,
  },
  feedPressed: {
    backgroundColor: "rgba(255,255,255,0.06)",
    transform: [{ scale: 0.985 }],
  },
  feedIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(154,216,237,0.14)",
  },
  itemCopy: { flex: 1, marginLeft: 12, marginRight: 8 },
  feedTitleText: {
    color: "#F0FFF9",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 3,
  },
  feedContentText: {
    color: "#D7EFE7",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 3,
  },
  itemTitle: { color: "#F0FFF9", fontSize: 13, fontWeight: "700" },
  itemMeta: { color: "#A9CEC3", fontSize: 11 },
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

  /* 結構化詳情 Modal 樣式 */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.68)",
  },
  modalContent: {
    height: "72%",
    backgroundColor: "#123A4E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 25,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(236,255,248,0.15)",
    paddingBottom: 15,
    marginBottom: 14,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  detailTag: {
    backgroundColor: "rgba(154,216,237,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detailTagText: {
    color: "#9AD8ED",
    fontSize: 11,
    fontWeight: "700",
  },
  modalMetaDate: {
    color: "#8FB8AE",
    fontSize: 11,
  },
  modalFullTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  modalScrollBody: {
    paddingVertical: 10,
  },
  detailBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.12)",
    marginBottom: 14,
  },
  detailLabel: {
    color: "#8FB8AE",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalFullContent: {
    color: "#E2F5EE",
    fontSize: 14.5,
    lineHeight: 23,
  },
  deadlineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(242,140,140,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(242,140,140,0.25)",
  },
  deadlineText: {
    color: "#F28C8C",
    fontSize: 12,
    fontWeight: "700",
  },

  /* 底部上一頁/下一頁分頁導航列（適用於列表與彈窗） */
  paginationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(236,255,248,0.15)",
    marginTop: 8,
  },
  pageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.22)",
  },
  pageButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(236,255,248,0.08)",
  },
  pageButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  pageButtonText: {
    color: "#F0FFF9",
    fontSize: 13,
    fontWeight: "700",
  },
  pageButtonTextDisabled: {
    color: "rgba(240,255,249,0.3)",
  },
  pageIndicator: {
    color: "#A9CEC3",
    fontSize: 13,
    fontWeight: "700",
  },
});
