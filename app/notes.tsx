// app/notes.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

const DEFAULT_STUDENT_ID = process.env.EXPO_PUBLIC_DEFAULT_USER_ID || "";

const defaultAgenda = [
  "09:10 互動媒體程式設計",
  "13:10 資料視覺化",
  "15:10 社群媒體與文化",
];

type Panel = "feed" | "assignments" | "schedule" | "reminder" | null;

export default function NotesScreen() {
  const router = useRouter();
  const { userId, userName } = useAuth();

  // 🌟 核心：支援本機快取學號，預設 0
  const [currentUserId, setCurrentUserId] = useState<number>(
    DEFAULT_STUDENT_ID ? Number(DEFAULT_STUDENT_ID) : 0
  );
  const currentUserName = userName || "同學";

  const [panel, setPanel] = useState<Panel>(null);
  const [smartReminder, setSmartReminder] = useState(false);

  // 動態聯絡簿公告狀態
  const [feedList, setFeedList] = useState<any[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  // 當前點選查看詳情的公告索引
  const [selectedFeedIndex, setSelectedFeedIndex] = useState<number | null>(
    null
  );

  // 作業清單動態狀態
  const [assignmentList, setAssignmentList] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Moodle 同步彈窗狀態
  const [moodleModalVisible, setMoodleModalVisible] = useState(false);
  const [moodleAccount, setMoodleAccount] = useState(
    DEFAULT_STUDENT_ID ? String(DEFAULT_STUDENT_ID) : ""
  );
  const [moodlePassword, setMoodlePassword] = useState("");
  const [syncingMoodle, setSyncingMoodle] = useState(false);

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

  // 讀取真實作業清單
  const fetchAssignments = useCallback(
    async (targetId?: number) => {
      const uid = targetId !== undefined ? targetId : currentUserId;
      if (!uid || uid === 0) return;

      try {
        setLoadingAssignments(true);
        // @ts-ignore
        const baseUrl =
          process.env.EXPO_PUBLIC_API_URL ||
          process.env.EXPO_PUBLIC_API_BASE_URL ||
          "http://127.0.0.1:8000";
        const res = await fetch(
          `${baseUrl}/api/student/assignments?user_id=${uid}`
        );
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAssignmentList(json.data);
        } else {
          setAssignmentList([]);
        }
      } catch (e) {
        console.warn("載入作業清單失敗:", e);
        setAssignmentList([]);
      } finally {
        setLoadingAssignments(false);
      }
    },
    [currentUserId]
  );

  // 取得聯絡簿公告
  const fetchStudentFeed = useCallback(
    async (targetId?: number) => {
      const uid = targetId !== undefined ? targetId : currentUserId;
      if (!uid || uid === 0) return;

      try {
        setLoadingFeed(true);
        // @ts-ignore
        const baseUrl =
          process.env.EXPO_PUBLIC_API_URL ||
          process.env.EXPO_PUBLIC_API_BASE_URL ||
          "http://127.0.0.1:8000";
        const res = await fetch(`${baseUrl}/api/student/feed?user_id=${uid}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
          setFeedList(data.data);
        } else {
          setFeedList([]);
        }
      } catch (e) {
        console.warn("抓取專屬聯絡簿失敗:", e);
        setFeedList([]);
      } finally {
        setLoadingFeed(false);
      }
    },
    [currentUserId]
  );

  // 🌟 初次進入頁面：優先從 AsyncStorage 讀取與 courses.tsx 相同的已登入學號
  useEffect(() => {
    const initUserData = async () => {
      try {
        const storedId = await AsyncStorage.getItem("current_user_id");
        const activeId = storedId
          ? Number(storedId)
          : DEFAULT_STUDENT_ID
            ? Number(DEFAULT_STUDENT_ID)
            : userId
              ? Number(userId)
              : 0;

        if (activeId > 0) {
          setCurrentUserId(activeId);
          setMoodleAccount(String(activeId));
          fetchAssignments(activeId);
          fetchStudentFeed(activeId);
        }
      } catch (e) {
        console.warn("讀取本機登入學號失敗:", e);
      }
    };

    initUserData();
  }, [userId, fetchAssignments, fetchStudentFeed]);

  // 切換作業打勾狀態並同步寫回 MongoDB
  const toggleAssignmentStatus = async (assignId: string) => {
    setAssignmentList((prev) =>
      prev.map((item) =>
        item.assignment_id === assignId || item.title === assignId
          ? { ...item, is_done: !Boolean(item.is_done ?? item.done) }
          : item
      )
    );

    try {
      // @ts-ignore
      const baseUrl =
        process.env.EXPO_PUBLIC_API_URL ||
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:8000";
      await fetch(`${baseUrl}/api/student/assignments/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          assignment_id: assignId,
        }),
      });
    } catch (e) {
      console.warn("更新作業完成狀態失敗:", e);
    }
  };

  // 同步 Moodle 資料
  const handleSyncMoodle = async () => {
    if (!moodleAccount.trim() || !moodlePassword) {
      Alert.alert("請填寫完整", "請輸入 Moodle 帳號與密碼。");
      return;
    }

    const targetUserId = Number(moodleAccount.trim());
    if (isNaN(targetUserId) || targetUserId <= 0) {
      Alert.alert("格式錯誤", "學號必須為有效的數字。");
      return;
    }

    Keyboard.dismiss();
    setSyncingMoodle(true);

    try {
      // @ts-ignore
      const baseUrl =
        process.env.EXPO_PUBLIC_API_URL ||
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:8000";
      const res = await fetch(`${baseUrl}/api/student/sync-moodle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: targetUserId,
          moodle_account: moodleAccount.trim(),
          moodle_password: moodlePassword,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        Alert.alert("同步成功", json.message);
        setCurrentUserId(targetUserId);
        setMoodleModalVisible(false);
        setMoodlePassword("");
        fetchAssignments(targetUserId);
        fetchStudentFeed(targetUserId);
      } else {
        Alert.alert(
          "同步失敗",
          json.detail || "帳號密碼錯誤或伺服器連線異常。"
        );
      }
    } catch {
      Alert.alert("連線失敗", "無法連線至後端伺服器。");
    } finally {
      setSyncingMoodle(false);
    }
  };

  const completedCount = assignmentList.filter((item) =>
    Boolean(item.is_done ?? item.done)
  ).length;

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />
      <SafeAreaView style={styles.safeArea}>
        {/* 頂部 Header */}
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="返回大廳"
          >
            <Ionicons name="arrow-back" size={20} color="#E9FFF7" />
            <Text style={styles.backText}>大廳</Text>
          </Pressable>

          <Pressable
            style={styles.syncButton}
            onPress={() => setMoodleModalVisible(true)}
            accessibilityRole="button"
          >
            <Ionicons name="sync-outline" size={14} color="#F2C14E" />
            <Text style={styles.syncButtonText}>同步 Moodle</Text>
          </Pressable>
        </View>

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
            {/* 1. 動態聯絡簿 */}
            <View>
              <Action
                title="查看動態聯絡簿"
                detail={
                  feedList.length > 0
                    ? `掌握 ${feedList.length} 則最新課堂公告`
                    : "尚未同步課堂公告"
                }
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
                  smartReminder={smartReminder}
                  setSmartReminder={setSmartReminder}
                  feedList={feedList}
                  loadingFeed={loadingFeed}
                  onSelectFeedIndex={(idx) => setSelectedFeedIndex(idx)}
                  assignmentList={assignmentList}
                  loadingAssignments={loadingAssignments}
                  toggleAssignment={toggleAssignmentStatus}
                  onOpenSyncModal={() => setMoodleModalVisible(true)}
                />
              )}
            </View>

            {/* 2. 作業完成狀態 */}
            <View>
              <Action
                title="標記作業完成狀態"
                detail={
                  assignmentList.length > 0
                    ? `${completedCount} / ${assignmentList.length} 項作業已完成`
                    : "尚未同步 Moodle 作業"
                }
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
                  smartReminder={smartReminder}
                  setSmartReminder={setSmartReminder}
                  feedList={feedList}
                  loadingFeed={loadingFeed}
                  onSelectFeedIndex={(idx) => setSelectedFeedIndex(idx)}
                  assignmentList={assignmentList}
                  loadingAssignments={loadingAssignments}
                  toggleAssignment={toggleAssignmentStatus}
                  onOpenSyncModal={() => setMoodleModalVisible(true)}
                />
              )}
            </View>

            {/* 3. 個人課業時程 */}
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
                  smartReminder={smartReminder}
                  setSmartReminder={setSmartReminder}
                  feedList={feedList}
                  loadingFeed={loadingFeed}
                  onSelectFeedIndex={(idx) => setSelectedFeedIndex(idx)}
                  assignmentList={assignmentList}
                  loadingAssignments={loadingAssignments}
                  toggleAssignment={toggleAssignmentStatus}
                  onOpenSyncModal={() => setMoodleModalVisible(true)}
                />
              )}
            </View>

            {/* 4. 自訂提醒規則 */}
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
                  smartReminder={smartReminder}
                  setSmartReminder={setSmartReminder}
                  feedList={feedList}
                  loadingFeed={loadingFeed}
                  onSelectFeedIndex={(idx) => setSelectedFeedIndex(idx)}
                  assignmentList={assignmentList}
                  loadingAssignments={loadingAssignments}
                  toggleAssignment={toggleAssignmentStatus}
                  onOpenSyncModal={() => setMoodleModalVisible(true)}
                />
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* 公告詳情彈窗 */}
      <Modal
        visible={selectedFeedIndex !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedFeedIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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

      {/* Moodle 同步彈窗 */}
      <Modal
        visible={moodleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          setMoodleModalVisible(false);
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.syncModalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.keyboardAvoidContainer}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.syncModalCard}>
                  <Text style={styles.syncModalTitle}>
                    同步 Moodle 作業與通知
                  </Text>
                  <Text style={styles.syncModalSubtitle}>
                    輸入 Moodle
                    帳密以取得最新課堂作業截止日與催繳通知。密碼僅於記憶體中驗證，遵循數據不落地原則。
                  </Text>

                  <TextInput
                    style={styles.syncModalInput}
                    placeholder="Moodle 學號帳號"
                    placeholderTextColor="rgba(240,255,249,0.4)"
                    value={moodleAccount}
                    onChangeText={setMoodleAccount}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                  <TextInput
                    style={styles.syncModalInput}
                    placeholder="Moodle 密碼"
                    placeholderTextColor="rgba(240,255,249,0.4)"
                    value={moodlePassword}
                    onChangeText={setMoodlePassword}
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  <View style={styles.syncModalBtnRow}>
                    <Pressable
                      style={[styles.syncModalBtn, styles.syncModalCancelBtn]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setMoodleModalVisible(false);
                      }}
                      disabled={syncingMoodle}
                    >
                      <Text style={styles.syncModalCancelText}>取消</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.syncModalBtn, styles.syncModalConfirmBtn]}
                      onPress={() => {
                        Keyboard.dismiss();
                        handleSyncMoodle();
                      }}
                      disabled={syncingMoodle}
                    >
                      {syncingMoodle ? (
                        <ActivityIndicator size="small" color="#16445A" />
                      ) : (
                        <Text style={styles.syncModalConfirmText}>
                          開始同步
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
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
  smartReminder,
  setSmartReminder,
  feedList,
  loadingFeed,
  onSelectFeedIndex,
  assignmentList,
  loadingAssignments,
  toggleAssignment,
  onOpenSyncModal,
}: {
  panel: Exclude<Panel, null>;
  close: () => void;
  smartReminder: boolean;
  setSmartReminder: (value: boolean) => void;
  feedList: any[];
  loadingFeed: boolean;
  onSelectFeedIndex: (idx: number) => void;
  assignmentList: any[];
  loadingAssignments?: boolean;
  toggleAssignment: (id: string) => void;
  onOpenSyncModal: () => void;
}) {
  const title =
    panel === "feed"
      ? "動態聯絡簿"
      : panel === "assignments"
        ? "作業完成狀態"
        : panel === "schedule"
          ? "個人課業時程"
          : "自訂提醒規則";

  const PAGE_SIZE = 5;
  const [feedPage, setFeedPage] = useState<number>(1);
  const totalPages = Math.ceil(feedList.length / PAGE_SIZE) || 1;

  const startIndex = (feedPage - 1) * PAGE_SIZE;
  const displayedFeeds = feedList.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
      </View>

      {/* 1. 動態聯絡簿 */}
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
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={26}
                  color="#F2C14E"
                />
              </View>
              <Text style={styles.emptyTitle}>尚未同步課堂聯絡簿</Text>
              <Text style={styles.emptyDesc}>
                目前資料庫中尚未建立您的 Moodle 課堂通知與異動公告。{"\n"}
                請點擊下方按鈕進行同步以取得最新資訊。
              </Text>
              <Pressable
                style={styles.emptySyncBtn}
                onPress={onOpenSyncModal}
                accessibilityRole="button"
              >
                <Ionicons name="sync-outline" size={15} color="#16445A" />
                <Text style={styles.emptySyncBtnText}>立即同步 Moodle</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* 2. 作業完成清單 */}
      {panel === "assignments" && (
        <View style={styles.itemList}>
          {loadingAssignments ? (
            <ActivityIndicator
              color="#F2C14E"
              style={{ paddingVertical: 20 }}
            />
          ) : assignmentList && assignmentList.length > 0 ? (
            assignmentList.map((item) => {
              const isDone = Boolean(item.is_done ?? item.done);
              const assignId = item.assignment_id || item.title;
              return (
                <Pressable
                  key={assignId}
                  onPress={() => toggleAssignment(assignId)}
                  style={styles.assignment}
                >
                  <Ionicons
                    name={isDone ? "checkmark-circle" : "ellipse-outline"}
                    size={23}
                    color={isDone ? "#9EF2BE" : "#B9D7CF"}
                  />
                  <View style={styles.itemCopy}>
                    <Text style={[styles.itemTitle, isDone && styles.done]}>
                      {item.title}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {item.course} · {item.due}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="clipboard-outline" size={26} color="#F2C14E" />
              </View>
              <Text style={styles.emptyTitle}>尚未同步 Moodle 作業清單</Text>
              <Text style={styles.emptyDesc}>
                目前資料庫中尚未有任何待繳作業紀錄。{"\n"}
                請點擊下方按鈕同步最新的作業截止日與繳交狀態。
              </Text>
              <Pressable
                style={styles.emptySyncBtn}
                onPress={onOpenSyncModal}
                accessibilityRole="button"
              >
                <Ionicons name="sync-outline" size={15} color="#16445A" />
                <Text style={styles.emptySyncBtnText}>立即同步 Moodle</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* 3. 課業時程 */}
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

      {/* 4. 提醒規則 */}
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
        <Text
          style={styles.feedTitleText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingRight: 14,
  },
  backText: { color: "#E9FFF7", fontSize: 14, fontWeight: "700" },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(242,193,78,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(242,193,78,0.4)",
  },
  syncButtonText: { color: "#F2C14E", fontSize: 13, fontWeight: "700" },
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
    backgroundColor: "rgba(239,255,249,0.12)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
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
  modalCloseButton: { padding: 4 },
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
  detailTagText: { color: "#9AD8ED", fontSize: 11, fontWeight: "700" },
  modalMetaDate: { color: "#8FB8AE", fontSize: 11 },
  modalFullTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  modalScrollBody: { paddingVertical: 10 },
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
  deadlineText: { color: "#F28C8C", fontSize: 12, fontWeight: "700" },

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
  pageButtonText: { color: "#F0FFF9", fontSize: 13, fontWeight: "700" },
  pageButtonTextDisabled: { color: "rgba(240,255,249,0.3)" },
  pageIndicator: { color: "#A9CEC3", fontSize: 13, fontWeight: "700" },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.15)",
    marginTop: 6,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(242,193,78,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(242,193,78,0.3)",
  },
  emptyTitle: {
    color: "#F0FFF9",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyDesc: {
    color: "rgba(240,255,249,0.65)",
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  emptySyncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F2C14E",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 14,
  },
  emptySyncBtnText: {
    color: "#16445A",
    fontSize: 13,
    fontWeight: "800",
  },

  syncModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  keyboardAvoidContainer: {
    width: "100%",
    alignItems: "center",
  },
  syncModalCard: {
    width: "100%",
    backgroundColor: "#16445A",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.3)",
    padding: 24,
  },
  syncModalTitle: {
    color: "#F0FFF9",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  syncModalSubtitle: {
    color: "rgba(240,255,249,0.65)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  syncModalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.25)",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    color: "#F0FFF9",
    fontSize: 15,
    marginBottom: 12,
  },
  syncModalBtnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  syncModalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  syncModalCancelBtn: { backgroundColor: "rgba(255,255,255,0.12)" },
  syncModalCancelText: { color: "#F0FFF9", fontWeight: "700" },
  syncModalConfirmBtn: { backgroundColor: "#F2C14E" },
  syncModalConfirmText: { color: "#16445A", fontWeight: "800" },
});
