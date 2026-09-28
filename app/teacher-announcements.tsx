import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "./_layout";

type Announcement = {
  id: string;
  title: string;
  content: string;
  expiresAt: string;
  publishedAt: string;
  course_id?: number;
};

type SchoolAnnouncement = {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
};

type AnnouncementTab = "school" | "my";

/* =========================
   校級公告（靜態全校廣播）
   ========================= */
const schoolAnnouncements: SchoolAnnouncement[] = [
  {
    id: "school-001",
    title: "114學年度第一學期開學公告",
    content:
      "114學年度第一學期即將開始，請同學留意選課、加退選及課程相關公告。",
    publishedAt: "2026年08月20日",
  },
  {
    id: "school-002",
    title: "校園安全宣導",
    content: "請同學注意校園安全，離開教室時請確認門窗及電源是否關閉。",
    publishedAt: "2026年08月18日",
  },
  {
    id: "school-003",
    title: "學校系統維護通知",
    content: "學校相關系統將於近期進行維護，維護期間部分服務可能暫時無法使用。",
    publishedAt: "2026年08月15日",
  },
];

export default function TeacherAnnouncementsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const currentTeacherId = userId || 1001;

  // @ts-ignore
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeTab, setActiveTab] = useState<AnnouncementTab>("school");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 初次載入公告：封裝於 useEffect 內，無同步 setState，杜絕 ESLint 錯誤
  useEffect(() => {
    let isMounted = true;

    const fetchInitialAnnouncements = async () => {
      try {
        const res = await fetch(
          `${baseUrl}/api/teacher/announcements?teacher_id=${currentTeacherId}`
        );
        const json = await res.json();
        if (isMounted && json.success) {
          setAnnouncements(json.data);
        }
      } catch (error) {
        console.error("載入雲端公告失敗：", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialAnnouncements();

    return () => {
      isMounted = false;
    };
  }, [baseUrl, currentTeacherId]);

  // 手動重新載入（供發布或刪除後呼叫）
  const reloadAnnouncements = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const res = await fetch(
        `${baseUrl}/api/teacher/announcements?teacher_id=${currentTeacherId}`
      );
      const json = await res.json();
      if (json.success) {
        setAnnouncements(json.data);
      }
    } catch (error) {
      console.error("載入雲端公告失敗：", error);
      Alert.alert("連線提醒", "無法從資料庫同步公告，請確認後端運行中。");
    } finally {
      setIsLoading(false);
    }
  };

  const isExpired = (expiryStr: string): boolean => {
    if (!expiryStr || expiryStr === "未設定") return false;
    const match = expiryStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (match) {
      const expDate = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        23,
        59,
        59
      );
      return expDate.getTime() < new Date().getTime();
    }
    const d = new Date(expiryStr);
    return !isNaN(d.getTime()) && d.getTime() < new Date().getTime();
  };

  const totalAnnouncements = useMemo(
    () => announcements.length,
    [announcements]
  );

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  };

  const handleOpenDatePicker = (): void => setShowDatePicker(true);

  const handleDateChange = (event: DateTimePickerEvent, date?: Date): void => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (event.type === "dismissed") return;

    if (date) {
      setSelectedDate(date);
      setExpiresAt(formatDate(date));
      if (Platform.OS === "ios") setShowDatePicker(false);
    }
  };

  // 雲端發布公告（寫入 MongoDB NOTIFY 集合）
  const handlePublish = async (): Promise<void> => {
    if (!title.trim()) {
      Alert.alert("提醒", "請輸入公告主題。");
      return;
    }
    if (!content.trim()) {
      Alert.alert("提醒", "請輸入公告內容。");
      return;
    }
    if (!selectedDate) {
      Alert.alert("提醒", "請選擇公告失效日期。");
      return;
    }

    try {
      const res = await fetch(`${baseUrl}/api/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          expires_at: expiresAt,
          course_id: 101, // 預設發布至 101 資料庫管理
          teacher_id: currentTeacherId,
          type: "課堂公告",
        }),
      });

      const json = await res.json();
      if (json.success) {
        setTitle("");
        setContent("");
        setExpiresAt("");
        setSelectedDate(null);
        setShowDatePicker(false);
        setShowForm(false);
        setActiveTab("my");
        Alert.alert(
          "發布成功",
          "公告已成功同步至資料庫，修課學生已可即時查閱！"
        );
        reloadAnnouncements();
      } else {
        Alert.alert("發布失敗", json.message || "伺服器未接受該請求。");
      }
    } catch (err) {
      console.error("發布公告錯誤:", err);
      Alert.alert("連線錯誤", "無法連線至後端伺服器。");
    }
  };

  // 雲端刪除公告
  const handleDelete = (announcement: Announcement): void => {
    Alert.alert("刪除公告", `確定要刪除「${announcement.title}」嗎？`, [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(
              `${baseUrl}/api/announcements/${announcement.id}`,
              {
                method: "DELETE",
              }
            );
            const json = await res.json();
            if (json.success) {
              setAnnouncements((prev) =>
                prev.filter((item) => item.id !== announcement.id)
              );
              Alert.alert("已刪除", "該則公告已自雲端資料庫移除。");
            } else {
              Alert.alert("刪除失敗", json.message);
            }
          } catch {
            Alert.alert("連線失敗", "伺服器暫無回應。");
          }
        },
      },
    ]);
  };

  const handleCloseForm = (): void => {
    setTitle("");
    setContent("");
    setExpiresAt("");
    setSelectedDate(null);
    setShowDatePicker(false);
    setShowForm(false);
  };

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>課程公告管理</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => setShowForm((curr) => !curr)}
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>{showForm ? "×" : "＋"}</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* 公告統計 */}
          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>我的公告</Text>
              <Text style={styles.summaryValue}>{totalAnnouncements}</Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>校級公告</Text>
              <Text style={styles.summaryValue}>
                {schoolAnnouncements.length}
              </Text>
            </View>
          </View>

          {/* Tab 切換 */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[
                styles.tabButton,
                activeTab === "school" && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab("school")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "school" && styles.tabTextActive,
                ]}
              >
                校級公告
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tabButton,
                activeTab === "my" && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab("my")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "my" && styles.tabTextActive,
                ]}
              >
                歷史公告
              </Text>
            </Pressable>
          </View>

          {/* 發布公告表單 */}
          {showForm && (
            <LinearGradient
              colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.10)"]}
              style={styles.formCard}
            >
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>發布課程公告</Text>
                <Pressable onPress={handleCloseForm}>
                  <Text style={styles.closeText}>關閉</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>公告主題</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="例如：期中專案繳交時程提醒"
                placeholderTextColor="#9BC8BC"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>公告內容</Text>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="請輸入詳細公告說明..."
                placeholderTextColor="#9BC8BC"
                multiline
                numberOfLines={5}
                style={[styles.input, styles.textArea]}
              />

              <Text style={styles.fieldLabel}>公告失效日期</Text>
              <Pressable
                onPress={handleOpenDatePicker}
                style={({ pressed }) => [
                  styles.dateButton,
                  pressed && styles.dateButtonPressed,
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.dateButtonText,
                      !expiresAt && styles.datePlaceholder,
                    ]}
                  >
                    {expiresAt || "請選擇公告失效日期"}
                  </Text>
                  {expiresAt && (
                    <Text style={styles.dateHint}>已選擇失效日期</Text>
                  )}
                </View>
                <Text style={styles.dateArrow}>▼</Text>
              </Pressable>

              {showDatePicker && (
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={selectedDate || new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    themeVariant={Platform.OS === "ios" ? "dark" : undefined}
                  />
                </View>
              )}

              <Pressable style={styles.publishButton} onPress={handlePublish}>
                <Text style={styles.publishButtonText}>立即同步發布</Text>
              </Pressable>
            </LinearGradient>
          )}

          {isLoading && (
            <Text style={styles.emptyText}>正在同步雲端公告...</Text>
          )}

          {/* 校級公告清單 */}
          {!isLoading &&
            activeTab === "school" &&
            schoolAnnouncements.map((announcement) => (
              <LinearGradient
                key={announcement.id}
                colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.10)"]}
                style={styles.announcementCard}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.schoolTag}>
                    <Text style={styles.schoolTagText}>校級</Text>
                  </View>
                  <Text style={styles.metaText}>
                    {announcement.publishedAt}
                  </Text>
                </View>
                <Text style={styles.announcementTitle}>
                  {announcement.title}
                </Text>
                <Text style={styles.announcementContent}>
                  {announcement.content}
                </Text>
              </LinearGradient>
            ))}

          {/* 老師發布的歷史公告清單（從 MongoDB NOTIFY 讀出） */}
          {!isLoading &&
            activeTab === "my" &&
            announcements.map((announcement) => {
              const expired = isExpired(announcement.expiresAt);
              return (
                <LinearGradient
                  key={announcement.id}
                  colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.10)"]}
                  style={styles.announcementCard}
                >
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.statusTag,
                        expired ? styles.expiredTag : styles.activeTag,
                      ]}
                    >
                      <Text style={styles.statusTagText}>
                        {expired ? "已過期" : "進行中"}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleDelete(announcement)}>
                      <Text style={styles.deleteText}>刪除</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.announcementTitle}>
                    {announcement.title}
                  </Text>
                  <Text style={styles.announcementContent}>
                    {announcement.content}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      發布：{announcement.publishedAt}
                    </Text>
                    <Text style={styles.metaText}>
                      到期：{announcement.expiresAt}
                    </Text>
                  </View>
                </LinearGradient>
              );
            })}

          {!isLoading && activeTab === "my" && announcements.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>尚無歷史公告</Text>
              <Text style={styles.emptyText}>
                點擊右上角「＋」發布第一則同步公告。
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 22,
  },
  backText: { color: "#F0FFF9", fontSize: 15, fontWeight: "700" },
  title: { color: "#F0FFF9", fontSize: 22, fontWeight: "800" },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2C14E",
  },
  addButtonText: {
    color: "#16445A",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 28,
  },
  content: { paddingTop: 18, paddingBottom: 40 },
  summaryCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.25)",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 18,
  },
  summaryLabel: {
    color: "#C3E0D8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  summaryValue: {
    color: "#F0FFF9",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: { backgroundColor: "#F2C14E" },
  tabText: { color: "#D6EEE7", fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: "#16445A", fontWeight: "800" },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    padding: 18,
    marginBottom: 18,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  formTitle: { color: "#F0FFF9", fontSize: 20, fontWeight: "800" },
  closeText: { color: "#F28C8C", fontSize: 14, fontWeight: "700" },
  fieldLabel: {
    color: "#D5EEE7",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: "rgba(8,47,61,0.38)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#F0FFF9",
    fontSize: 15,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  dateButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(8,47,61,0.42)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.38)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateButtonPressed: { opacity: 0.7 },
  dateButtonText: { color: "#F5FFFC", fontSize: 15, fontWeight: "700" },
  datePlaceholder: { color: "#A8D2C7", fontWeight: "500" },
  dateHint: { color: "#8FB8AE", fontSize: 9, marginTop: 3 },
  dateArrow: { color: "#F2C14E", fontSize: 11, fontWeight: "800" },
  datePickerContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(5,35,47,0.72)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.20)",
  },
  publishButton: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: "#F2C14E",
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  publishButtonText: { color: "#16445A", fontSize: 15, fontWeight: "800" },
  announcementCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  schoolTag: {
    backgroundColor: "rgba(242,193,78,0.2)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  schoolTagText: { color: "#F2C14E", fontSize: 11, fontWeight: "800" },
  statusTag: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  activeTag: { backgroundColor: "rgba(172,224,208,0.2)" },
  expiredTag: { backgroundColor: "rgba(242,140,140,0.2)" },
  statusTagText: { color: "#F0FFF9", fontSize: 11, fontWeight: "800" },
  deleteText: { color: "#F28C8C", fontSize: 13, fontWeight: "700" },
  announcementTitle: {
    color: "#F0FFF9",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  announcementContent: { color: "#DDEFE7", fontSize: 14, lineHeight: 20 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 12,
  },
  metaText: { color: "#A9CEC3", fontSize: 11 },
  emptyContainer: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: {
    color: "#F0FFF9",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyText: { color: "#A9CEC3", fontSize: 14, textAlign: "center" },
});
