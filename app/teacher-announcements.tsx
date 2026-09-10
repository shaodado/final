import AsyncStorage from "@react-native-async-storage/async-storage";
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

type Announcement = {
  id: string;
  title: string;
  content: string;
  expiresAt: string;
  publishedAt: string;
};

type SchoolAnnouncement = {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
};

type AnnouncementTab = "school" | "my";

const ANNOUNCEMENT_STORAGE_KEY = "@teacher_announcements";

/* =========================
   校級公告
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
    content:
      "請同學注意校園安全，離開教室時請確認門窗及電源是否關閉。",
    publishedAt: "2026年08月18日",
  },
  {
    id: "school-003",
    title: "學校系統維護通知",
    content:
      "學校相關系統將於近期進行維護，維護期間部分服務可能暫時無法使用。",
    publishedAt: "2026年08月15日",
  },
];

/* =========================
   預設老師公告
   ========================= */

const initialAnnouncements: Announcement[] = [
  {
    id: "teacher-001",
    title: "期中考提醒",
    content:
      "期中考將於 2026/09/15 舉行，請同學準時到場並攜帶證件。",
    expiresAt: "2026年09月15日",
    publishedAt: "2026年08月20日",
  },
  {
    id: "teacher-002",
    title: "作業繳交注意事項",
    content:
      "請將報告繳交至 LMS，並確認檔名格式正確，逾期將扣分。",
    expiresAt: "2026年09月10日",
    publishedAt: "2026年08月18日",
  },
];

export default function TeacherAnnouncementsScreen() {
  const router = useRouter();

  /* =========================
     公告資料
     ========================= */

  const [announcements, setAnnouncements] =
    useState<Announcement[]>([]);

  /* =========================
     Tab
     ========================= */

  const [activeTab, setActiveTab] =
    useState<AnnouncementTab>("school");

  /* =========================
     表單
     ========================= */

  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  /* =========================
     日期
     ========================= */

  const [expiresAt, setExpiresAt] = useState("");

  const [selectedDate, setSelectedDate] =
    useState<Date | null>(null);

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  /* =========================
     Loading
     ========================= */

  const [isLoading, setIsLoading] = useState(true);

  /* =========================
     載入公告
     ========================= */

  useEffect(() => {
    const loadAnnouncements = async (): Promise<void> => {
      try {
        const savedAnnouncements =
          await AsyncStorage.getItem(
            ANNOUNCEMENT_STORAGE_KEY
          );

        if (savedAnnouncements) {
          const parsedAnnouncements: Announcement[] =
            JSON.parse(savedAnnouncements);

          setAnnouncements(parsedAnnouncements);
        } else {
          setAnnouncements(initialAnnouncements);

          await AsyncStorage.setItem(
            ANNOUNCEMENT_STORAGE_KEY,
            JSON.stringify(initialAnnouncements)
          );
        }
      } catch (error) {
        console.error("載入公告失敗：", error);

        setAnnouncements(initialAnnouncements);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnnouncements();
  }, []);

  /* =========================
     判斷公告是否過期
     ========================= */

  const isExpired = (expiresAt: string): boolean => {
    const expirationDate = new Date(expiresAt);

    return (
      expirationDate.getTime() <
      new Date().getTime()
    );
  };

  /* =========================
     公告數量
     ========================= */

  const totalAnnouncements = useMemo(
    () => announcements.length,
    [announcements]
  );

  /* =========================
     儲存公告
     ========================= */

  const saveAnnouncements = async (
    newAnnouncements: Announcement[]
  ): Promise<void> => {
    try {
      await AsyncStorage.setItem(
        ANNOUNCEMENT_STORAGE_KEY,
        JSON.stringify(newAnnouncements)
      );
    } catch (error) {
      console.error("儲存公告失敗：", error);

      Alert.alert(
        "儲存失敗",
        "公告無法儲存，請稍後再試。"
      );
    }
  };

  /* =========================
     日期格式化
     
     例如：
     2026年9月9日
     ========================= */

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();

    const month = date.getMonth() + 1;

    const day = date.getDate();

    return `${year}年${month}月${day}日`;
  };

  /* =========================
     開啟日期選擇器
     ========================= */

  const handleOpenDatePicker = (): void => {
    setShowDatePicker(true);
  };

  /* =========================
     日期選擇
     ========================= */

  const handleDateChange = (
    event: DateTimePickerEvent,
    date?: Date
  ): void => {
    /*
     * Android：
     * 選擇完成或取消後，
     * 都要關閉日期選擇器。
     */

    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    /*
     * 使用者取消選擇
     */

    if (event.type === "dismissed") {
      return;
    }

    /*
     * 使用者選擇日期
     */

    if (date) {
      setSelectedDate(date);

      setExpiresAt(
        formatDate(date)
      );

      /*
       * iOS：
       * 選擇完成後手動關閉。
       */

      if (Platform.OS === "ios") {
        setShowDatePicker(false);
      }
    }
  };

  /* =========================
     發布公告
     ========================= */

  const handlePublish = async (): Promise<void> => {
    if (!title.trim()) {
      Alert.alert(
        "提醒",
        "請輸入公告主題。"
      );

      return;
    }

    if (!content.trim()) {
      Alert.alert(
        "提醒",
        "請輸入公告內容。"
      );

      return;
    }

    if (!selectedDate) {
      Alert.alert(
        "提醒",
        "請選擇公告失效日期。"
      );

      return;
    }

    const newAnnouncement: Announcement = {
      id: `teacher-${Date.now()}`,

      title: title.trim(),

      content: content.trim(),

      expiresAt: expiresAt,

      publishedAt: formatDate(
        new Date()
      ),
    };

    const newAnnouncements = [
      newAnnouncement,
      ...announcements,
    ];

    setAnnouncements(
      newAnnouncements
    );

    await saveAnnouncements(
      newAnnouncements
    );

    /* 清除表單 */

    setTitle("");
    setContent("");

    setExpiresAt("");

    setSelectedDate(null);

    setShowDatePicker(false);

    setShowForm(false);

    setActiveTab("my");

    Alert.alert(
      "發布成功",
      "公告已成功發布。"
    );
  };

  /* =========================
     刪除公告
     ========================= */

  const handleDelete = (
    announcement: Announcement
  ): void => {
    Alert.alert(
      "刪除公告",
      `確定要刪除「${announcement.title}」嗎？`,
      [
        {
          text: "取消",
          style: "cancel",
        },

        {
          text: "刪除",
          style: "destructive",

          onPress: async () => {
            const newAnnouncements =
              announcements.filter(
                (item) =>
                  item.id !==
                  announcement.id
              );

            setAnnouncements(
              newAnnouncements
            );

            await saveAnnouncements(
              newAnnouncements
            );
          },
        },
      ]
    );
  };

  /* =========================
     關閉表單
     ========================= */

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
      {/* =========================
          背景裝飾
         ========================= */}

      <View
        style={[
          styles.glow,
          styles.glowTop,
        ]}
      />

      <View
        style={[
          styles.glow,
          styles.glowBottom,
        ]}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* =========================
            Header
           ========================= */}

        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="返回"
          >
            <Text style={styles.backText}>
              ← 返回
            </Text>
          </Pressable>

          <Text style={styles.title}>
            課程公告
          </Text>

          <Pressable
            style={styles.addButton}
            onPress={() =>
              setShowForm(
                (current) => !current
              )
            }
            accessibilityRole="button"
            accessibilityLabel="新增公告"
          >
            <Text style={styles.addButtonText}>
              {showForm ? "×" : "＋"}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.content
          }
        >
          {/* =========================
              公告統計
             ========================= */}

          <View style={styles.summaryCard}>
            <View>
              <Text
                style={
                  styles.summaryLabel
                }
              >
                我的公告
              </Text>

              <Text
                style={
                  styles.summaryValue
                }
              >
                {totalAnnouncements}
              </Text>
            </View>

            <View>
              <Text
                style={
                  styles.summaryLabel
                }
              >
                校級公告
              </Text>

              <Text
                style={
                  styles.summaryValue
                }
              >
                {schoolAnnouncements.length}
              </Text>
            </View>
          </View>

          {/* =========================
              Tab
             ========================= */}

          <View style={styles.tabContainer}>
            <Pressable
              style={[
                styles.tabButton,
                activeTab === "school" &&
                styles.tabButtonActive,
              ]}
              onPress={() =>
                setActiveTab("school")
              }
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "school" &&
                  styles.tabTextActive,
                ]}
              >
                校級公告
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabButton,
                activeTab === "my" &&
                styles.tabButtonActive,
              ]}
              onPress={() =>
                setActiveTab("my")
              }
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "my" &&
                  styles.tabTextActive,
                ]}
              >
                歷史公告
              </Text>
            </Pressable>
          </View>

          {/* =========================
              發布公告表單
             ========================= */}

          {showForm && (
            <LinearGradient
              colors={[
                "rgba(239,255,249,0.28)",
                "rgba(172,224,208,0.10)",
              ]}
              style={styles.formCard}
            >
              {/* 表單標題 */}

              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>
                  發布公告
                </Text>

                <Pressable
                  onPress={
                    handleCloseForm
                  }
                  accessibilityRole="button"
                >
                  <Text
                    style={
                      styles.closeText
                    }
                  >
                    關閉
                  </Text>
                </Pressable>
              </View>

              {/* =========================
                  公告主題
                 ========================= */}

              <Text style={styles.fieldLabel}>
                公告主題
              </Text>

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="請輸入公告主題"
                placeholderTextColor="#9BC8BC"
                style={styles.input}
              />

              {/* =========================
                  公告內容
                 ========================= */}

              <Text style={styles.fieldLabel}>
                公告內容
              </Text>

              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="請輸入公告內容"
                placeholderTextColor="#9BC8BC"
                multiline
                numberOfLines={5}
                style={[
                  styles.input,
                  styles.textArea,
                ]}
              />

              {/* =========================
                  公告失效日期
                 ========================= */}

              <Text style={styles.fieldLabel}>
                公告失效日期
              </Text>

              <Pressable
                onPress={
                  handleOpenDatePicker
                }
                style={({ pressed }) => [
                  styles.dateButton,

                  pressed &&
                  styles.dateButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="選擇公告失效日期"
              >
                <View>
                  <Text
                    style={[
                      styles.dateButtonText,

                      !expiresAt &&
                      styles.datePlaceholder,
                    ]}
                  >
                    {expiresAt ||
                      "請選擇公告失效日期"}
                  </Text>

                  {expiresAt && (
                    <Text
                      style={
                        styles.dateHint
                      }
                    >
                      已選擇失效日期
                    </Text>
                  )}
                </View>

                <Text
                  style={
                    styles.dateArrow
                  }
                >
                  ▼
                </Text>
              </Pressable>

              {/* =========================
                  日期選擇器
                 ========================= */}

              {showDatePicker && (
                <View
                  style={
                    styles.datePickerContainer
                  }
                >
                  <DateTimePicker
                    value={
                      selectedDate ||
                      new Date()
                    }
                    mode="date"
                    display={
                      Platform.OS === "ios"
                        ? "spinner"
                        : "default"
                    }
                    onChange={
                      handleDateChange
                    }

                    /*
                     * 從 1911 年 1 月 1 日開始
                     */

                    minimumDate={
                      new Date(
                        1911,
                        0,
                        1
                      )
                    }

                    /*
                     * iOS 使用深色模式，
                     * 讓日期文字在深色背景上
                     * 更容易閱讀。
                     */

                    themeVariant={
                      Platform.OS === "ios"
                        ? "dark"
                        : undefined
                    }
                  />
                </View>
              )}

              {/* =========================
                  發布按鈕
                 ========================= */}

              <Pressable
                style={styles.publishButton}
                onPress={
                  handlePublish
                }
                accessibilityRole="button"
              >
                <Text
                  style={
                    styles.publishButtonText
                  }
                >
                  發布公告
                </Text>
              </Pressable>
            </LinearGradient>
          )}

          {/* =========================
              Loading
             ========================= */}

          {isLoading && (
            <Text
              style={
                styles.emptyText
              }
            >
              正在載入公告...
            </Text>
          )}

          {/* =========================
              校級公告
             ========================= */}

          {!isLoading &&
            activeTab === "school" &&
            schoolAnnouncements.map(
              (announcement) => (
                <LinearGradient
                  key={announcement.id}
                  colors={[
                    "rgba(239,255,249,0.28)",
                    "rgba(172,224,208,0.10)",
                  ]}
                  style={
                    styles.announcementCard
                  }
                >
                  <View
                    style={
                      styles.cardHeader
                    }
                  >
                    <View
                      style={
                        styles.schoolTag
                      }
                    >
                      <Text
                        style={
                          styles.schoolTagText
                        }
                      >
                        校級
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.metaText
                      }
                    >
                      {
                        announcement.publishedAt
                      }
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.announcementTitle
                    }
                  >
                    {announcement.title}
                  </Text>

                  <Text
                    style={
                      styles.announcementContent
                    }
                  >
                    {announcement.content}
                  </Text>
                </LinearGradient>
              )
            )}

          {/* =========================
              老師自己的歷史公告
             ========================= */}

          {!isLoading &&
            activeTab === "my" &&
            announcements.map(
              (announcement) => {
                const expired =
                  isExpired(
                    announcement.expiresAt
                  );

                return (
                  <LinearGradient
                    key={announcement.id}
                    colors={[
                      "rgba(239,255,249,0.28)",
                      "rgba(172,224,208,0.10)",
                    ]}
                    style={
                      styles.announcementCard
                    }
                  >
                    <View
                      style={
                        styles.cardHeader
                      }
                    >
                      <View
                        style={[
                          styles.statusTag,
                          expired
                            ? styles.expiredTag
                            : styles.activeTag,
                        ]}
                      >
                        <Text
                          style={
                            styles.statusTagText
                          }
                        >
                          {expired
                            ? "已過期"
                            : "進行中"}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() =>
                          handleDelete(
                            announcement
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`刪除${announcement.title}`}
                      >
                        <Text
                          style={
                            styles.deleteText
                          }
                        >
                          刪除
                        </Text>
                      </Pressable>
                    </View>

                    <Text
                      style={
                        styles.announcementTitle
                      }
                    >
                      {announcement.title}
                    </Text>

                    <Text
                      style={
                        styles.announcementContent
                      }
                    >
                      {announcement.content}
                    </Text>

                    <View
                      style={
                        styles.metaRow
                      }
                    >
                      <Text
                        style={
                          styles.metaText
                        }
                      >
                        發布：
                        {
                          announcement.publishedAt
                        }
                      </Text>

                      <Text
                        style={
                          styles.metaText
                        }
                      >
                        到期：
                        {
                          announcement.expiresAt
                        }
                      </Text>
                    </View>
                  </LinearGradient>
                );
              }
            )}

          {/* =========================
              沒有公告
             ========================= */}

          {!isLoading &&
            activeTab === "my" &&
            announcements.length === 0 && (
              <View
                style={
                  styles.emptyContainer
                }
              >
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  尚無歷史公告
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  點擊右上角「＋」發布第一則公告。
                </Text>
              </View>
            )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  /* =========================
     Page
     ========================= */

  page: {
    flex: 1,
    backgroundColor: "#16445A",
  },

  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },

  /* =========================
     Background
     ========================= */

  glow: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.48,
  },

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

  /* =========================
     Header
     ========================= */

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 22,
  },

  backText: {
    color: "#F0FFF9",
    fontSize: 15,
    fontWeight: "700",
  },

  title: {
    color: "#F0FFF9",
    fontSize: 24,
    fontWeight: "800",
  },

  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2C14E",
  },

  addButtonText: {
    color: "#16445A",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 28,
  },

  /* =========================
     Content
     ========================= */

  content: {
    paddingTop: 18,
    paddingBottom: 40,
  },

  /* =========================
     Summary
     ========================= */

  summaryCard: {
    borderRadius: 18,
    backgroundColor:
      "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor:
      "rgba(236,255,248,0.25)",
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

  /* =========================
     Tab
     ========================= */

  tabContainer: {
    flexDirection: "row",
    backgroundColor:
      "rgba(255,255,255,0.08)",
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

  tabButtonActive: {
    backgroundColor: "#F2C14E",
  },

  tabText: {
    color: "#D6EEE7",
    fontSize: 14,
    fontWeight: "700",
  },

  tabTextActive: {
    color: "#16445A",
    fontWeight: "800",
  },

  /* =========================
     Form
     ========================= */

  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor:
      "rgba(236,255,248,0.35)",
    padding: 18,
    marginBottom: 18,
  },

  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  formTitle: {
    color: "#F0FFF9",
    fontSize: 22,
    fontWeight: "800",
  },

  closeText: {
    color: "#F28C8C",
    fontSize: 14,
    fontWeight: "700",
  },

  fieldLabel: {
    color: "#D5EEE7",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 10,
  },

  input: {
    backgroundColor:
      "rgba(8,47,61,0.38)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor:
      "rgba(236,255,248,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#F0FFF9",
    fontSize: 15,
  },

  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  /* =========================
     Date Button
     ========================= */

  dateButton: {
    minHeight: 52,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    backgroundColor:
      "rgba(8,47,61,0.42)",

    borderRadius: 12,

    borderWidth: 1,

    borderColor:
      "rgba(236,255,248,0.38)",

    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  dateButtonPressed: {
    opacity: 0.7,
  },

  dateButtonText: {
    color: "#F5FFFC",
    fontSize: 15,
    fontWeight: "700",
  },

  datePlaceholder: {
    color: "#A8D2C7",
    fontWeight: "500",
  },

  dateHint: {
    color: "#8FB8AE",
    fontSize: 9,
    marginTop: 3,
  },

  dateArrow: {
    color: "#F2C14E",
    fontSize: 11,
    fontWeight: "800",
  },

  /* =========================
     Date Picker
     ========================= */

  datePickerContainer: {
    alignItems: "center",
    justifyContent: "center",

    marginTop: 10,

    paddingVertical: 10,

    borderRadius: 14,

    backgroundColor:
      "rgba(5,35,47,0.72)",

    borderWidth: 1,

    borderColor:
      "rgba(236,255,248,0.20)",
  },

  /* =========================
     Publish Button
     ========================= */

  publishButton: {
    marginTop: 18,

    borderRadius: 14,

    backgroundColor: "#F2C14E",

    paddingVertical: 13,

    alignItems: "center",

    justifyContent: "center",
  },

  publishButtonText: {
    color: "#16445A",
    fontSize: 15,
    fontWeight: "800",
  },

  /* =========================
     Announcement Card
     ========================= */

  announcementCard: {
    borderRadius: 18,

    borderWidth: 1,

    borderColor:
      "rgba(236,255,248,0.35)",

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
    backgroundColor:
      "rgba(242,193,78,0.2)",

    borderRadius: 8,

    paddingHorizontal: 9,

    paddingVertical: 4,
  },

  schoolTagText: {
    color: "#F2C14E",
    fontSize: 11,
    fontWeight: "800",
  },

  statusTag: {
    borderRadius: 8,

    paddingHorizontal: 9,

    paddingVertical: 4,
  },

  activeTag: {
    backgroundColor:
      "rgba(172,224,208,0.2)",
  },

  expiredTag: {
    backgroundColor:
      "rgba(242,140,140,0.2)",
  },

  statusTagText: {
    color: "#F0FFF9",
    fontSize: 11,
    fontWeight: "800",
  },

  deleteText: {
    color: "#F28C8C",
    fontSize: 13,
    fontWeight: "700",
  },

  announcementTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },

  announcementContent: {
    color: "#DDEFE7",
    fontSize: 14,
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: "row",

    justifyContent: "space-between",

    marginTop: 12,

    gap: 12,
  },

  metaText: {
    flex: 1,

    color: "#A9CEC3",

    fontSize: 11,
  },

  /* =========================
     Empty
     ========================= */

  emptyContainer: {
    alignItems: "center",

    paddingVertical: 50,
  },

  emptyTitle: {
    color: "#F0FFF9",

    fontSize: 17,

    fontWeight: "800",

    marginBottom: 8,
  },

  emptyText: {
    color: "#A9CEC3",

    fontSize: 14,

    textAlign: "center",
  },
});