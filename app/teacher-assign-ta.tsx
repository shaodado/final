import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "./_layout";

// ================================
// API 位址（自動偵測，也可用 EXPO_PUBLIC_API_URL 手動指定）
// ================================
const API_PORT = 8000;

function getApiBase(): string {
  const manual = process.env.EXPO_PUBLIC_API_URL;
  if (manual) return manual.replace(/\/$/, "");

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `http://${window.location.hostname}:${API_PORT}`;
  }

  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host && !host.includes("exp.direct")) {
    return `http://${host}:${API_PORT}`;
  }

  return Platform.OS === "android"
    ? `http://10.0.2.2:${API_PORT}`
    : `http://localhost:${API_PORT}`;
}

const API_BASE = getApiBase();
const TIMEOUT_MS = 10000;

// ================================
// 型別
// ================================
type Student = {
  user_id: number | string;
  name: string;
  department_id?: number | string | null;
  department_name?: string | null;
  grade?: number | string | null;
};

type DialogType = "assign" | "remove" | null;

// ================================
// API 函式
// ================================
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch (e) {
    if ((e as any)?.name === "AbortError") {
      throw new Error(`連線逾時，請確認後端是否正在執行\n（${API_BASE}）`);
    }
    throw new Error(
      `無法連線到 ${API_BASE}\n` +
        "請確認：1) 後端已啟動，且用 --host 0.0.0.0 執行；2) 手機與電腦在同一個 Wi-Fi。"
    );
  } finally {
    clearTimeout(timer);
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // 沒有 JSON 內容就忽略
  }

  if (!res.ok) {
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join("、")
          : `請求失敗（${res.status}）`;
    throw new Error(message);
  }

  // 後端找不到資料時會回 200 + success:false
  if (body && body.success === false) {
    throw new Error(body.message ?? "操作失敗");
  }

  return body as T;
}

const api = {
  load: (courseId: number) =>
    request<{ data: Student[]; ta: Student | null }>(
      `${API_BASE}/api/teacher/courses/${courseId}/students`
    ),
  assign: (courseId: number, userId: number, teacherId: number) =>
    request(`${API_BASE}/api/teacher/courses/${courseId}/ta`, {
      method: "PUT",
      body: JSON.stringify({ user_id: userId, teacher_id: teacherId }),
    }),
  remove: (courseId: number) =>
    request(`${API_BASE}/api/teacher/courses/${courseId}/ta`, {
      method: "DELETE",
    }),
};

// ================================
// 工具
// ================================
function metaLine(s: Student): string {
  const parts: string[] = [];

  if (s.grade != null && s.grade !== "") parts.push(String(s.grade));

  if (s.department_name) {
    parts.push(s.department_name);
  } else if (s.department_id != null && s.department_id !== "") {
    parts.push(`系所代碼 ${s.department_id}`);
  }

  return parts.join("・");
}

// ================================
// 畫面
// ================================
export default function TeacherAssignTAScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const currentTeacherId = userId || 1001;

  // 從課程詳情頁傳進來的課程代碼與名稱
  const params = useLocalSearchParams<{
    courseId?: string;
    courseName?: string;
  }>();
  const currentCourseId = params.courseId ? Number(params.courseId) : 101;
  const courseName = params.courseName || "資訊管理";

  const [students, setStudents] = useState<Student[]>([]);
  const [ta, setTa] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 確認視窗
  const [dialog, setDialog] = useState<DialogType>(null);
  const [working, setWorking] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // 成功提示
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  // ------------------------------
  // 讀取修課學生與目前助教
  // ------------------------------
  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const json = await api.load(currentCourseId);
        setStudents(json.data ?? []);
        setTa(json.ta ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "無法連線到伺服器");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentCourseId]
  );

  useEffect(() => {
    load();
  }, [load]);

  // ------------------------------
  // 搜尋與選取
  // ------------------------------
  const trimmedQuery = query.trim().toLowerCase();

  const visibleStudents = useMemo(() => {
    if (!trimmedQuery) return students;
    return students.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(trimmedQuery) ||
        String(s.user_id).toLowerCase().includes(trimmedQuery)
    );
  }, [students, trimmedQuery]);

  const selectedStudent = students.find(
    (s) => String(s.user_id) === selectedId
  );

  const isTa = (s: Student): boolean =>
    ta != null && String(ta.user_id) === String(s.user_id);

  // ------------------------------
  // 指派 / 取消
  // ------------------------------
  const openAssignDialog = (): void => {
    if (!selectedStudent) return;
    setDialogError(null);
    setDialog("assign");
  };

  const openRemoveDialog = (): void => {
    if (!ta) return;
    setDialogError(null);
    setDialog("remove");
  };

  const closeDialog = (): void => {
    if (working) return;
    setDialog(null);
  };

  const confirmAssign = async (): Promise<void> => {
    if (!selectedStudent) {
      setDialog(null);
      return;
    }

    setWorking(true);
    setDialogError(null);
    try {
      await api.assign(
        currentCourseId,
        Number(selectedStudent.user_id),
        Number(currentTeacherId)
      );
      setTa(selectedStudent);
      setSelectedId(null);
      setDialog(null);
      showNotice(`${selectedStudent.name} 已成為助教`);
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "指派失敗，請稍後再試");
    } finally {
      setWorking(false);
    }
  };

  const confirmRemove = async (): Promise<void> => {
    setWorking(true);
    setDialogError(null);
    try {
      await api.remove(currentCourseId);
      setTa(null);
      setSelectedId(null);
      setDialog(null);
      showNotice("已取消助教資格");
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "取消失敗，請稍後再試");
    } finally {
      setWorking(false);
    }
  };

  const countText = loading
    ? ""
    : trimmedQuery
      ? `符合 ${visibleStudents.length} 位`
      : `共 ${students.length} 位學生`;

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* 背景 Glow */}
      <View style={styles.pinkGlow} />
      <View style={styles.yellowGlow} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh")}
              tintColor="#F2C14E"
              colors={["#F2C14E"]}
            />
          }
        >
          {/* ========================= */}
          {/* 標題 */}
          {/* ========================= */}
          <View style={styles.header}>
            <View style={styles.topRow}>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="返回課程"
                hitSlop={12}
              >
                <Text style={styles.backText}>‹ 返回課程</Text>
              </Pressable>

              <Pressable
                onPress={() => load("refresh")}
                disabled={loading || refreshing}
                hitSlop={12}
              >
                <Text style={styles.refreshText}>
                  {refreshing ? "更新中…" : "重新整理"}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.smallTitle}>TEACHING ASSISTANT</Text>
            <Text style={styles.title}>指派助教</Text>
            <Text style={styles.description}>{courseName}</Text>
          </View>

          {/* ========================= */}
          {/* 錯誤 */}
          {/* ========================= */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => load()} hitSlop={8}>
                <Text style={styles.errorRetry}>重新載入</Text>
              </Pressable>
            </View>
          )}

          {/* ========================= */}
          {/* 目前助教 */}
          {/* ========================= */}
          <View style={styles.currentCard}>
            <Text style={styles.currentLabel}>目前助教</Text>

            {loading ? (
              <ActivityIndicator color="#F2C14E" style={{ marginVertical: 8 }} />
            ) : ta ? (
              <View style={styles.assignedContainer}>
                <View style={styles.assignedAvatar}>
                  <Text style={styles.assignedAvatarText}>
                    {(ta.name || "?").charAt(0)}
                  </Text>
                </View>

                <View style={styles.assignedInfo}>
                  <Text style={styles.assignedName}>{ta.name}</Text>
                  <Text style={styles.assignedDetail}>
                    {ta.user_id}
                    {metaLine(ta) ? `・${metaLine(ta)}` : ""}
                  </Text>
                </View>

                <Pressable
                  onPress={openRemoveDialog}
                  accessibilityRole="button"
                  accessibilityLabel="取消助教"
                  style={({ pressed }) => [
                    styles.removeButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.removeButtonText}>取消助教</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.emptyText}>目前尚未指派助教</Text>
            )}
          </View>

          {/* ========================= */}
          {/* 選擇助教 */}
          {/* ========================= */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>選擇助教</Text>
            <Text style={styles.sectionCount}>{countText}</Text>
          </View>

          <Text style={styles.sectionHint}>
            請從修課學生中選擇一位學生擔任本課程助教
          </Text>

          {/* 搜尋 */}
          <View style={styles.searchBox}>
            <Ionicons
              name="search-outline"
              size={18}
              color="rgba(240,255,249,0.6)"
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="搜尋姓名或學號"
              placeholderTextColor="rgba(240,255,249,0.45)"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                accessibilityLabel="清除搜尋"
                hitSlop={10}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color="rgba(240,255,249,0.6)"
                />
              </Pressable>
            )}
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#F2C14E"
              style={{ marginVertical: 30 }}
            />
          ) : visibleStudents.length === 0 ? (
            !error && (
              <View style={styles.listCard}>
                <Text style={styles.emptyInline}>
                  {trimmedQuery
                    ? "找不到符合的學生"
                    : "這門課目前沒有修課學生"}
                </Text>
              </View>
            )
          ) : (
            <View style={styles.listCard}>
              {visibleStudents.map((student, index) => {
                const sid = String(student.user_id);
                const isSelected = selectedId === sid;
                const assigned = isTa(student);
                const isLast = index === visibleStudents.length - 1;
                const meta = metaLine(student);

                return (
                  <Pressable
                    key={sid}
                    onPress={() => setSelectedId(sid)}
                    disabled={assigned}
                    accessibilityRole="button"
                    accessibilityLabel={`選擇${student.name}擔任助教`}
                    style={[
                      styles.studentRow,
                      !isLast && styles.studentRowDivider,
                      isSelected && styles.studentRowSelected,
                      assigned && styles.studentRowAssigned,
                    ]}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(student.name || "?").charAt(0)}
                      </Text>
                    </View>

                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>
                        {student.name || "（未命名）"}
                      </Text>
                      <Text style={styles.studentDetail}>
                        {student.user_id}
                        {meta ? `・${meta}` : ""}
                      </Text>
                    </View>

                    {assigned ? (
                      <View style={styles.assignedBadge}>
                        <Text style={styles.assignedBadgeText}>目前助教</Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.radio,
                          isSelected && styles.radioSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ========================= */}
          {/* 確認指派 */}
          {/* ========================= */}
          <Pressable
            onPress={openAssignDialog}
            disabled={!selectedStudent}
            accessibilityRole="button"
            accessibilityLabel="確認指派助教"
            style={({ pressed }) => [
              styles.assignButton,
              !selectedStudent && styles.assignButtonDisabled,
              pressed && selectedStudent && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.assignButtonText,
                !selectedStudent && styles.assignButtonTextDisabled,
              ]}
            >
              {selectedStudent
                ? `指派 ${selectedStudent.name} 為助教`
                : "請先選擇一位學生"}
            </Text>
          </Pressable>

          {/* ========================= */}
          {/* 底部文字 */}
          {/* ========================= */}
          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerTitle}>TEACHER • ASSIGN • TA</Text>
            <Text style={styles.footerText}>校園智慧助手</Text>
          </View>
        </ScrollView>

        {/* 成功提示 */}
        {!!notice && (
          <View pointerEvents="none" style={styles.noticeWrap}>
            <View style={styles.notice}>
              <Ionicons name="checkmark-circle" size={18} color="#16445A" />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* ========================= */}
      {/* 確認視窗（覆蓋層，網頁版也能用） */}
      {/* ========================= */}
      {dialog !== null && (
        <View style={styles.dialogBackdrop} accessibilityViewIsModal>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDialog} />

          <View style={styles.dialog}>
            {dialog === "assign" ? (
              <>
                <Text style={styles.dialogTitle}>確認指派</Text>
                <Text style={styles.dialogText}>
                  {`確定要將 ${selectedStudent?.name ?? ""} 指派為「${courseName}」的助教嗎？`}
                </Text>
                {!!ta && (
                  <Text style={styles.dialogHint}>
                    目前助教 {ta.name} 會被取代。
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.dialogTitle}>取消助教</Text>
                <Text style={styles.dialogText}>
                  {`確定要取消 ${ta?.name ?? ""} 的助教資格嗎？`}
                </Text>
              </>
            )}

            {!!dialogError && (
              <Text style={styles.dialogErrorText}>{dialogError}</Text>
            )}

            <View style={styles.dialogActions}>
              <Pressable
                onPress={closeDialog}
                disabled={working}
                style={[styles.dialogButton, styles.dialogCancel]}
              >
                <Text style={styles.dialogCancelText}>取消</Text>
              </Pressable>

              <Pressable
                onPress={dialog === "assign" ? confirmAssign : confirmRemove}
                disabled={working}
                style={[
                  styles.dialogButton,
                  dialog === "assign"
                    ? styles.dialogConfirm
                    : styles.dialogDanger,
                ]}
              >
                {working ? (
                  <ActivityIndicator
                    color={dialog === "assign" ? "#16445A" : "#FFFFFF"}
                  />
                ) : (
                  <Text
                    style={
                      dialog === "assign"
                        ? styles.dialogConfirmText
                        : styles.dialogDangerText
                    }
                  >
                    {dialog === "assign" ? "確認指派" : "確認取消"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ==================================
  // 整體
  // ==================================
  page: { flex: 1, backgroundColor: "#16445A" },
  safeArea: { flex: 1 },

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
  // Header
  // ==================================
  header: {
    marginTop: 16,
    marginBottom: 24,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    marginBottom: 14,
  },

  backText: {
    fontSize: 15,
    color: "#F2C14E",
    fontWeight: "700",
  },

  refreshText: {
    fontSize: 14,
    color: "rgba(240,255,249,0.72)",
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.95 }],
  },

  smallTitle: {
    fontSize: 11,
    letterSpacing: 3,
    color: "#F2C14E",
    fontWeight: "700",
    marginBottom: 6,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#F0FFF9",
    marginBottom: 10,
  },

  description: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(240,255,249,0.72)",
  },

  // ==================================
  // 錯誤
  // ==================================
  errorBox: {
    backgroundColor: "rgba(242,140,140,0.18)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },

  errorText: {
    color: "#FFD7D7",
    fontSize: 14,
    lineHeight: 20,
  },

  errorRetry: {
    color: "#F2C14E",
    fontWeight: "800",
    fontSize: 14,
  },

  // ==================================
  // 目前助教
  // ==================================
  currentCard: {
    paddingVertical: 20,
    paddingHorizontal: 22,
    marginBottom: 28,
    borderRadius: 32,
    backgroundColor: "rgba(240,255,249,0.10)",
    borderWidth: 1,
    borderColor: "rgba(240,255,249,0.14)",
  },

  currentLabel: {
    color: "rgba(240,255,249,0.72)",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },

  emptyText: {
    color: "rgba(240,255,249,0.6)",
    fontSize: 16,
  },

  assignedContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  assignedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(242,193,78,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  assignedAvatarText: {
    color: "#F2C14E",
    fontSize: 20,
    fontWeight: "800",
  },

  assignedInfo: {
    flex: 1,
  },

  assignedName: {
    color: "#F0FFF9",
    fontSize: 19,
    fontWeight: "800",
  },

  assignedDetail: {
    color: "rgba(240,255,249,0.72)",
    fontSize: 13,
    marginTop: 3,
  },

  removeButton: {
    backgroundColor: "rgba(242,140,140,0.20)",
    borderWidth: 1,
    borderColor: "rgba(242,140,140,0.5)",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginLeft: 10,
  },

  removeButtonText: {
    color: "#F28C8C",
    fontSize: 13,
    fontWeight: "800",
  },

  // ==================================
  // 選擇助教
  // ==================================
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  sectionTitle: {
    color: "#F0FFF9",
    fontSize: 20,
    fontWeight: "800",
  },

  sectionCount: {
    color: "rgba(240,255,249,0.6)",
    fontSize: 13,
    fontWeight: "600",
  },

  sectionHint: {
    color: "rgba(240,255,249,0.6)",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(240,255,249,0.10)",
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 46,
    marginBottom: 14,
  },

  searchInput: {
    flex: 1,
    color: "#F0FFF9",
    fontSize: 15,
    paddingVertical: 0,
  },

  listCard: {
    backgroundColor: "rgba(240,255,249,0.92)",
    borderRadius: 32,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 20,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 15,

    elevation: 6,
  },

  emptyInline: {
    color: "#6F8F9A",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 28,
  },

  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 22,
  },

  studentRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22,68,90,0.08)",
  },

  studentRowSelected: {
    backgroundColor: "rgba(242,193,78,0.28)",
    borderBottomColor: "transparent",
  },

  studentRowAssigned: {
    opacity: 0.55,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(66,104,117,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  avatarText: {
    color: "#426875",
    fontSize: 18,
    fontWeight: "800",
  },

  studentInfo: {
    flex: 1,
  },

  studentName: {
    color: "#16445A",
    fontSize: 16,
    fontWeight: "800",
  },

  studentDetail: {
    color: "#6F8F9A",
    fontSize: 13,
    marginTop: 3,
  },

  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(22,68,90,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  radioSelected: {
    borderColor: "#16445A",
  },

  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#16445A",
  },

  assignedBadge: {
    backgroundColor: "rgba(66,160,120,0.20)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginLeft: 12,
  },

  assignedBadgeText: {
    color: "#1F6B4C",
    fontSize: 12,
    fontWeight: "700",
  },

  // ==================================
  // 確認指派按鈕
  // ==================================
  assignButton: {
    height: 54,
    borderRadius: 999,
    backgroundColor: "#F2C14E",
    alignItems: "center",
    justifyContent: "center",
  },

  assignButtonDisabled: {
    backgroundColor: "rgba(242,193,78,0.28)",
  },

  assignButtonText: {
    color: "#16445A",
    fontSize: 16,
    fontWeight: "800",
  },

  assignButtonTextDisabled: {
    color: "rgba(240,255,249,0.55)",
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },

  // ==================================
  // 成功提示
  // ==================================
  noticeWrap: {
    position: "absolute",
    top: 10,
    left: 24,
    right: 24,
    alignItems: "center",
  },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FFF9",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,

    elevation: 10,
  },

  noticeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#16445A",
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
  // 確認視窗
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
    backgroundColor: "transparent",
  },

  dialog: {
    backgroundColor: "#123A4E",
    borderRadius: 32,
    padding: 24,
  },

  dialogTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0FFF9",
    marginBottom: 8,
  },

  dialogText: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(240,255,249,0.7)",
  },

  dialogHint: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(240,255,249,0.5)",
    marginTop: 8,
  },

  dialogErrorText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#F28C8C",
    fontWeight: "700",
    marginTop: 12,
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
    backgroundColor: "rgba(240,255,249,0.15)",
  },

  dialogCancelText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#F0FFF9",
  },

  dialogConfirm: {
    backgroundColor: "#F2C14E",
  },

  dialogConfirmText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#16445A",
  },

  dialogDanger: {
    backgroundColor: "#F28C8C",
  },

  dialogDangerText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#16445A",
  },
});