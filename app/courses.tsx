// app/courses.tsx
import { Ionicons } from "@expo/vector-icons";
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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";

const DEFAULT_STUDENT_ID = process.env.EXPO_PUBLIC_DEFAULT_USER_ID || "";

type CourseDetail = {
  course_name: string;
  credits: number;
  score: number | null;
  is_passed: boolean;
};

type Requirement = {
  name: string;
  required: number;
  earned: number;
  courses: CourseDetail[];
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type CompetencyThreshold = {
  name: string;
  status: "passed" | "pending";
  requirement: string;
};

const defaultCompetencies: CompetencyThreshold[] = [
  {
    name: "英語能力檢定",
    status: "passed",
    requirement: "TOEIC 550 分或同等檢定通過",
  },
  {
    name: "資訊能力檢定",
    status: "passed",
    requirement: "程式設計基礎與系專業檢定",
  },
  {
    name: "運動能力檢定",
    status: "passed",
    requirement: "大一至大三體育必修修習通過",
  },
  {
    name: "專業核心能力",
    status: "pending",
    requirement: "大四專題研究（二）完成發表",
  },
];

const CATEGORY_STYLES: {
  [key: string]: {
    color: string;
    icon: keyof typeof Ionicons.glyphMap;
    defaultReq: number;
  };
} = {
  "校定必修-英文": {
    color: "#9AD8ED",
    icon: "language-outline",
    defaultReq: 8,
  },
  "校定必修-文學賞作": {
    color: "#EAB0D3",
    icon: "book-outline",
    defaultReq: 4,
  },
  "校定必修-電腦": { color: "#F2C14E", icon: "laptop-outline", defaultReq: 2 },
  "校定必修-體育": { color: "#A7F3D0", icon: "fitness-outline", defaultReq: 0 },
  通識課程: { color: "#F472B6", icon: "color-palette-outline", defaultReq: 12 },
  專業必修: { color: "#F28C8C", icon: "school-outline", defaultReq: 60 },
  "專業選修-人工智慧應用組": {
    color: "#C8B6F2",
    icon: "hardware-chip-outline",
    defaultReq: 15,
  },
  "專業選修-巨量資料管理組": {
    color: "#F6C98A",
    icon: "server-outline",
    defaultReq: 12,
  },
  "專業選修-電子商務管理組": {
    color: "#93C5FD",
    icon: "cart-outline",
    defaultReq: 9,
  },
  "專業選修-其他": { color: "#FCA5A5", icon: "apps-outline", defaultReq: 10 },
};

function CreditProgressChart({ percent }: { percent: number }) {
  const size = 220;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(percent, 0), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={styles.chartContainer}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F2C14E"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.chartCenter}>
        <Text style={styles.chartPercent}>{progress}%</Text>
        <Text style={styles.chartLabel}>達成度</Text>
      </View>
    </View>
  );
}

function RequirementCard({
  requirement,
  selected,
  onPress,
}: {
  requirement: Requirement;
  selected: boolean;
  onPress: () => void;
}) {
  const isPhysicalEdu = requirement.name.includes("體育");
  const progress = isPhysicalEdu
    ? 100
    : requirement.required > 0
      ? Math.min(
          Math.round((requirement.earned / requirement.required) * 100),
          100
        )
      : 100;

  const remaining = isPhysicalEdu
    ? 0
    : Math.max(requirement.required - requirement.earned, 0);
  const isIncomplete = remaining > 0;

  return (
    <Pressable
      style={[
        styles.requirementCard,
        isIncomplete && styles.requirementCardIncomplete,
        selected && styles.requirementCardSelected,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`查看${requirement.name}學分`}
    >
      <View style={styles.requirementHeader}>
        <View
          style={[styles.iconContainer, { backgroundColor: requirement.color }]}
        >
          <Ionicons name={requirement.icon} size={22} color="#16445A" />
        </View>

        <View style={styles.requirementTitleContainer}>
          <Text style={styles.requirementName}>{requirement.name}</Text>
          <Text style={styles.requirementCredits}>
            {isPhysicalEdu
              ? "已修得體育必修 (及格)"
              : `${requirement.earned} / ${requirement.required} 學分`}
          </Text>
        </View>

        <View style={styles.headerRightArea}>
          <Text style={styles.requirementPercent}>{progress}%</Text>
          <Ionicons
            name={selected ? "chevron-up" : "chevron-down"}
            size={16}
            color="rgba(240,255,249,0.5)"
          />
        </View>
      </View>

      <View style={styles.progressBackground}>
        <View
          style={[
            styles.progressBar,
            { width: `${progress}%`, backgroundColor: requirement.color },
          ]}
        />
      </View>

      <Text
        style={[
          styles.remainingText,
          isIncomplete ? { color: "#F6C98A" } : { color: "#A7F3D0" },
        ]}
      >
        {isPhysicalEdu
          ? "✓ 已完成必修門檻"
          : remaining > 0
            ? `還需要 ${remaining} 學分`
            : "✓ 已完成領域要求"}
      </Text>

      {selected && (
        <View style={styles.courseList}>
          <Text style={styles.courseListTitle}>
            已修課程明細 ({requirement.courses.length} 門)
          </Text>

          {requirement.courses.length > 0 ? (
            requirement.courses.map((course, idx) => (
              <View
                key={`${course.course_name}-${idx}`}
                style={styles.courseItem}
              >
                <Ionicons
                  name={
                    course.is_passed
                      ? "checkmark-circle-outline"
                      : "close-circle-outline"
                  }
                  size={17}
                  color={course.is_passed ? requirement.color : "#F87171"}
                />

                <Text style={styles.courseText} numberOfLines={1}>
                  {course.course_name}
                </Text>

                <View style={styles.courseMeta}>
                  <Text style={styles.courseCreditTag}>
                    {course.credits} 學分
                  </Text>
                  <Text
                    style={[
                      styles.courseScoreTag,
                      course.is_passed
                        ? { color: "#A7F3D0" }
                        : { color: "#F87171" },
                    ]}
                  >
                    {course.score !== null
                      ? `${course.score}分`
                      : course.is_passed
                        ? "通過"
                        : "未過"}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.courseEmptyText}>本領域尚未有修課紀錄</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function CoursesScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  const [earnedCredits, setEarnedCredits] = useState<number>(0);
  const [requiredThreshold, setRequiredThreshold] = useState<number>(128);
  const [remainingCredits, setRemainingCredits] = useState<number>(0);
  const [completionPercent, setCompletionPercent] = useState<number>(0);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // 同步彈窗狀態
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [mcuAccount, setMcuAccount] = useState<string>(DEFAULT_STUDENT_ID);
  const [mcuPassword, setMcuPassword] = useState<string>("");
  const [syncing, setSyncing] = useState<boolean>(false);

  const [currentUserId, setCurrentUserId] = useState<number>(
    DEFAULT_STUDENT_ID ? Number(DEFAULT_STUDENT_ID) : 0
  );

  const fetchProgress = useCallback(
    async (targetId?: number) => {
      const uid = targetId !== undefined ? targetId : currentUserId;
      if (!uid || uid === 0) {
        setLoading(false);
        setHasData(false);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/student/graduation-progress?user_id=${uid}&required_threshold=128`
        );
        const json = await res.json();

        if (json.success && json.has_data) {
          setHasData(true);
          setEarnedCredits(json.earned_credits);
          setRequiredThreshold(json.required_threshold);
          setRemainingCredits(json.remaining_credits);
          setCompletionPercent(json.progress_percentage);

          const coursesByCategory = json.courses_by_category || {};
          const items: Requirement[] = Object.entries(
            json.category_breakdown || {}
          ).map(([catName, earnedVal]) => {
            const styleConfig = CATEGORY_STYLES[catName] || {
              color: "#C8B6F2",
              icon: "book-outline" as keyof typeof Ionicons.glyphMap,
              defaultReq: 10,
            };
            return {
              name: catName,
              earned: Number(earnedVal),
              required: Math.max(Number(earnedVal), styleConfig.defaultReq),
              courses: coursesByCategory[catName] || [],
              color: styleConfig.color,
              icon: styleConfig.icon,
            };
          });
          setRequirements(items);
        } else {
          setHasData(false);
        }
      } catch (error) {
        console.warn("無法取得學分進度:", error);
        setHasData(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProgress();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProgress]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProgress();
  };

  const handleSelectRequirement = (name: string): void => {
    setSelectedName((currentName) => (currentName === name ? null : name));
  };

  const handleSyncTranscript = async () => {
    if (!mcuAccount.trim() || !mcuPassword) {
      Alert.alert("請填寫完整", "請輸入學生資訊系統帳號與密碼。");
      return;
    }

    const targetUserId = Number(mcuAccount.trim());
    if (isNaN(targetUserId) || targetUserId <= 0) {
      Alert.alert("格式錯誤", "學號必須為有效的數字。");
      return;
    }

    Keyboard.dismiss();
    setSyncing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/student/sync-transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: targetUserId,
          mcu_account: mcuAccount.trim(),
          mcu_password: mcuPassword,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        Alert.alert("同步成功", `已成功同步 ${json.synced_count} 筆課程紀錄！`);
        setCurrentUserId(targetUserId);
        setModalVisible(false);
        setMcuPassword("");
        fetchProgress(targetUserId);
      } else {
        Alert.alert(
          "同步失敗",
          json.detail || "學校帳號密碼錯誤或伺服器連線異常。"
        );
      }
    } catch {
      Alert.alert(
        "連線異常",
        "無法連線至後端伺服器，請確認電腦 IP 與連線狀態。"
      );
    } finally {
      setSyncing(false);
    }
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

          <Text style={styles.title}>學分進度</Text>

          <Pressable
            style={styles.syncButton}
            onPress={() => setModalVisible(true)}
            accessibilityRole="button"
          >
            <Ionicons name="sync-outline" size={14} color="#F2C14E" />
            <Text style={styles.syncButtonText}>同步</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#F2C14E" />
            <Text style={styles.loadingText}>讀取學分資料中...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#F2C14E"
              />
            }
          >
            {!hasData ? (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons
                    name="cloud-download-outline"
                    size={48}
                    color="#F2C14E"
                  />
                </View>
                <Text style={styles.emptyStateTitle}>尚未同步校務學分資料</Text>
                <Text style={styles.emptyStateDesc}>
                  目前資料庫中尚未建立您的歷年修課與畢業審查紀錄。{"\n"}
                  請點擊下方按鈕，輸入學生資訊系統帳密進行首次同步。
                </Text>
                <Pressable
                  style={styles.emptySyncLargeBtn}
                  onPress={() => setModalVisible(true)}
                  accessibilityRole="button"
                >
                  <Ionicons name="sync-outline" size={18} color="#16445A" />
                  <Text style={styles.emptySyncLargeBtnText}>
                    立即同步校務成績
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.progressCard}>
                  <Text style={styles.sectionTitle}>畢業學分進度</Text>
                  <Text style={styles.sectionDescription}>
                    追蹤目前畢業學分完成狀況
                  </Text>

                  <CreditProgressChart percent={completionPercent} />

                  <View style={styles.creditSummary}>
                    <View style={styles.creditSummaryItem}>
                      <View style={styles.summaryDotCompleted} />
                      <Text style={styles.summaryLabel}>已修學分</Text>
                      <Text style={styles.summaryValue}>{earnedCredits}</Text>
                    </View>

                    <View style={styles.creditSummaryDivider} />

                    <View style={styles.creditSummaryItem}>
                      <View style={styles.summaryDotRemaining} />
                      <Text style={styles.summaryLabel}>缺口學分</Text>
                      <Text style={styles.summaryValue}>
                        {remainingCredits}
                      </Text>
                    </View>

                    <View style={styles.creditSummaryDivider} />

                    <View style={styles.creditSummaryItem}>
                      <Text style={styles.summaryLabel}>畢業要求</Text>
                      <Text style={styles.summaryValue}>
                        {requiredThreshold}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressMessage}>
                    <Ionicons name="school-outline" size={20} color="#F2C14E" />
                    <Text style={styles.progressMessageText}>
                      {remainingCredits === 0
                        ? "恭喜！您已修滿所有畢業學分要求！"
                        : `還需要完成 ${remainingCredits} 學分即可達到畢業學分要求`}
                    </Text>
                  </View>
                </View>

                {/* 各類學分進度手風琴列表 */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>各類學分進度</Text>
                  <Text style={styles.sectionDescription}>
                    點擊類別展開查看相關課程與成績
                  </Text>
                </View>

                {requirements.map((requirement) => (
                  <RequirementCard
                    key={requirement.name}
                    requirement={requirement}
                    selected={selectedName === requirement.name}
                    onPress={() => handleSelectRequirement(requirement.name)}
                  />
                ))}

                {/* 能力門檻 */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>能力門檻</Text>
                  <Text style={styles.sectionDescription}>
                    畢業前需要完成的能力要求
                  </Text>
                </View>

                {defaultCompetencies.map((item) => {
                  const isPassed = item.status === "passed";
                  return (
                    <View key={item.name} style={styles.competencyCard}>
                      <View style={styles.competencyIcon}>
                        <Ionicons
                          name={isPassed ? "checkmark-circle" : "time-outline"}
                          size={24}
                          color={isPassed ? "#9AD8ED" : "#F6C98A"}
                        />
                      </View>
                      <View style={styles.competencyContent}>
                        <View style={styles.competencyTitleRow}>
                          <Text style={styles.competencyName}>{item.name}</Text>
                          <Text
                            style={[
                              styles.competencyStatus,
                              { color: isPassed ? "#9AD8ED" : "#F6C98A" },
                            ]}
                          >
                            {isPassed ? "已通過" : "待完成"}
                          </Text>
                        </View>
                        <Text style={styles.competencyRequirement}>
                          {item.requirement}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* 彈窗（點擊空白自動收起鍵盤） */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.keyboardAvoidContainer}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>同步校務成績單</Text>
                  <Text style={styles.modalSubtitle}>
                    輸入學校資訊系統帳密以更新最新學分。密碼僅在記憶體中處理，遵循數據不落地原則。
                  </Text>

                  <TextInput
                    style={styles.modalInput}
                    placeholder="學號"
                    placeholderTextColor="rgba(240,255,249,0.4)"
                    value={mcuAccount}
                    onChangeText={setMcuAccount}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="校務密碼"
                    placeholderTextColor="rgba(240,255,249,0.4)"
                    value={mcuPassword}
                    onChangeText={setMcuPassword}
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  <View style={styles.modalBtnRow}>
                    <Pressable
                      style={[styles.modalBtn, styles.modalCancelBtn]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setModalVisible(false);
                      }}
                      disabled={syncing}
                    >
                      <Text style={styles.modalCancelText}>取消</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.modalBtn, styles.modalConfirmBtn]}
                      onPress={handleSyncTranscript}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <ActivityIndicator size="small" color="#16445A" />
                      ) : (
                        <Text style={styles.modalConfirmText}>開始同步</Text>
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
    paddingBottom: 10,
  },
  backText: { color: "#F0FFF9", fontSize: 15, fontWeight: "700" },
  title: { color: "#F0FFF9", fontSize: 24, fontWeight: "800" },
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
  centerLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#F0FFF9", marginTop: 12, fontSize: 14 },
  content: { paddingTop: 18, paddingBottom: 40 },

  progressCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    backgroundColor: "rgba(239,255,249,0.12)",
    padding: 20,
    marginBottom: 30,
  },
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { color: "#F0FFF9", fontSize: 21, fontWeight: "800" },
  sectionDescription: {
    color: "rgba(240,255,249,0.65)",
    fontSize: 13,
    marginTop: 5,
  },
  chartContainer: {
    width: 220,
    height: 220,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  chartCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  chartPercent: { color: "#F0FFF9", fontSize: 38, fontWeight: "900" },
  chartLabel: { color: "rgba(240,255,249,0.65)", fontSize: 14, marginTop: 2 },
  creditSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  creditSummaryItem: { flex: 1, alignItems: "center" },
  creditSummaryDivider: {
    width: 1,
    height: 38,
    backgroundColor: "rgba(240,255,249,0.15)",
  },
  summaryDotCompleted: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#F2C14E",
    marginBottom: 5,
  },
  summaryDotRemaining: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 5,
  },
  summaryLabel: {
    color: "rgba(240,255,249,0.6)",
    fontSize: 12,
    marginBottom: 3,
  },
  summaryValue: { color: "#F0FFF9", fontSize: 18, fontWeight: "800" },
  progressMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(242,193,78,0.1)",
  },
  progressMessageText: {
    flex: 1,
    color: "rgba(240,255,249,0.8)",
    fontSize: 13,
    lineHeight: 19,
  },

  requirementCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.25)",
    backgroundColor: "rgba(239,255,249,0.10)",
    padding: 17,
    marginBottom: 14,
  },
  requirementCardIncomplete: {
    borderColor: "rgba(242,193,78,0.45)",
  },
  requirementCardSelected: {
    borderColor: "rgba(242,193,78,0.8)",
    backgroundColor: "rgba(239,255,249,0.16)",
  },
  requirementHeader: { flexDirection: "row", alignItems: "center" },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  requirementTitleContainer: { flex: 1 },
  requirementName: { color: "#F0FFF9", fontSize: 16, fontWeight: "800" },
  requirementCredits: {
    color: "rgba(240,255,249,0.6)",
    fontSize: 13,
    marginTop: 4,
  },
  headerRightArea: { alignItems: "flex-end", gap: 2 },
  requirementPercent: { color: "#F0FFF9", fontSize: 17, fontWeight: "800" },
  progressBackground: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
    marginTop: 15,
  },
  progressBar: { height: "100%", borderRadius: 999 },
  remainingText: { fontSize: 12, marginTop: 8, fontWeight: "600" },

  courseList: {
    borderTopWidth: 1,
    borderTopColor: "rgba(236,255,248,0.15)",
    marginTop: 14,
    paddingTop: 14,
  },
  courseListTitle: {
    color: "#F0FFF9",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },
  courseItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  courseText: { flex: 1, color: "rgba(240,255,249,0.85)", fontSize: 13 },
  courseMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  courseCreditTag: { color: "rgba(240,255,249,0.5)", fontSize: 12 },
  courseScoreTag: { fontSize: 12, fontWeight: "700" },
  courseEmptyText: {
    color: "rgba(240,255,249,0.45)",
    fontSize: 13,
    fontStyle: "italic",
  },

  competencyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.22)",
    backgroundColor: "rgba(239,255,249,0.08)",
    padding: 15,
    marginBottom: 12,
  },
  competencyIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  competencyContent: { flex: 1 },
  competencyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  competencyName: {
    flex: 1,
    color: "#F0FFF9",
    fontSize: 15,
    fontWeight: "800",
  },
  competencyStatus: { fontSize: 12, fontWeight: "800", marginLeft: 8 },
  competencyRequirement: {
    color: "rgba(240,255,249,0.58)",
    fontSize: 12,
    lineHeight: 17,
  },

  emptyStateContainer: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.3)",
    backgroundColor: "rgba(239,255,249,0.10)",
    padding: 30,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(242,193,78,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(242,193,78,0.3)",
  },
  emptyStateTitle: {
    color: "#F0FFF9",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyStateDesc: {
    color: "rgba(240,255,249,0.7)",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 26,
  },
  emptySyncLargeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F2C14E",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 20,
  },
  emptySyncLargeBtnText: { color: "#16445A", fontSize: 16, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  keyboardAvoidContainer: { width: "100%", alignItems: "center" },
  modalCard: {
    width: "100%",
    backgroundColor: "#16445A",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.3)",
    padding: 24,
  },
  modalTitle: {
    color: "#F0FFF9",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: "rgba(240,255,249,0.65)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  modalInput: {
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
  modalBtnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelBtn: { backgroundColor: "rgba(255,255,255,0.12)" },
  modalCancelText: { color: "#F0FFF9", fontWeight: "700" },
  modalConfirmBtn: { backgroundColor: "#F2C14E" },
  modalConfirmText: { color: "#16445A", fontWeight: "800" },
});
