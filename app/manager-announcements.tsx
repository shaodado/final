import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
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

// ================================
// API 位址（自動偵測）
// 想手動指定時，在專案根目錄 .env 寫：
// EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
// ================================
const API_PORT = 8000;

function getApiBase(): string {
    // 1. 手動指定
    const manual = process.env.EXPO_PUBLIC_API_URL;
    if (manual) return manual.replace(/\/$/, "");

    // 2. 網頁版：跟著目前網址的主機
    if (Platform.OS === "web" && typeof window !== "undefined") {
        return `http://${window.location.hostname}:${API_PORT}`;
    }

    // 3. Expo Go / 開發版：用 Metro 開發伺服器所在電腦的 IP
    const hostUri = Constants.expoConfig?.hostUri;
    const host = hostUri?.split(":")[0];
    if (host && !host.includes("exp.direct")) {
        return `http://${host}:${API_PORT}`;
    }

    // 4. 最後備案
    return Platform.OS === "android"
        ? `http://10.0.2.2:${API_PORT}`
        : `http://localhost:${API_PORT}`;
}

const API_BASE = getApiBase();
const API_URL = `${API_BASE}/api/manager/announcements`;
const TIMEOUT_MS = 10000;

// ================================
// 型別
// ================================
type Announcement = {
    id: string;
    title: string;
    content: string;
    course_id: number | null;
    type: string;
    due_date: string | null;
    update_time: string | null;
};

type Filter = "全部" | "校級公告" | "課堂公告";
const FILTERS: Filter[] = ["全部", "校級公告", "課堂公告"];

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
                "請確認：1) 後端已啟動，且用 --host 0.0.0.0 執行；2) 手機與電腦在同一個 Wi-Fi。",
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
    list: async (): Promise<Announcement[]> => {
        const json = await request<{ data: Announcement[] }>(API_URL);
        return json.data ?? [];
    },
    create: (payload: { title: string; content: string; due_date?: string }) =>
        request(API_URL, {
            method: "POST",
            body: JSON.stringify({ ...payload, type: "校級公告" }),
        }),
    update: (
        id: string,
        payload: { title: string; content: string; type: string; due_date?: string },
    ) =>
        request(`${API_URL}/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
    remove: (id: string) => request(`${API_URL}/${id}`, { method: "DELETE" }),
};

// ================================
// 日期工具（資料庫有 ISO 和「2026年11月29日」兩種格式）
// ================================
function toDateInput(value: string | null): string {
    if (!value) return "";
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const zh = value.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (zh) return `${zh[1]}-${zh[2].padStart(2, "0")}-${zh[3].padStart(2, "0")}`;
    return "";
}

function formatDate(value: string | null): string {
    const d = toDateInput(value);
    return d ? d.replace(/-/g, "/") : "";
}

function formatTime(value: string | null): string {
    if (!value) return "";
    return value.replace("T", " ").slice(0, 16).replace(/-/g, "/");
}

// ================================
// 畫面
// ================================
export default function ManagerAnnouncementsScreen() {
    const router = useRouter();

    const [items, setItems] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>("全部");

    // 新增 / 編輯表單
    const [formVisible, setFormVisible] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // 刪除確認
    const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
    const [deleting, setDeleting] = useState(false);

    // ------------------------------
    // 讀取
    // ------------------------------
    const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
        if (mode === "refresh") setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            setItems(await api.list());
        } catch (e) {
            setError(e instanceof Error ? e.message : "無法連線到伺服器");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const visibleItems = useMemo(
        () => (filter === "全部" ? items : items.filter((i) => i.type === filter)),
        [items, filter],
    );

    const countOf = (f: Filter) =>
        f === "全部" ? items.length : items.filter((i) => i.type === f).length;

    // ------------------------------
    // 導覽
    // ------------------------------
    const handleBack = (): void => {
        if (router.canGoBack()) router.back();
        else router.replace("/manager" as never);
    };

    // ------------------------------
    // 表單
    // ------------------------------
    const openCreate = (): void => {
        setEditing(null);
        setTitle("");
        setContent("");
        setDueDate("");
        setFormError(null);
        setFormVisible(true);
    };

    const openEdit = (item: Announcement): void => {
        setEditing(item);
        setTitle(item.title);
        setContent(item.content ?? "");
        setDueDate(toDateInput(item.due_date));
        setFormError(null);
        setFormVisible(true);
    };

    const closeForm = (): void => {
        if (saving) return;
        setFormVisible(false);
    };

    const handleSave = async (): Promise<void> => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setFormError("請輸入公告標題");
            return;
        }
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            setFormError("截止日期格式為 YYYY-MM-DD，例如 2026-11-30");
            return;
        }

        setSaving(true);
        setFormError(null);
        try {
            if (editing) {
                // 日期沒改就不送，避免動到原本的格式
                const dateChanged = dueDate !== toDateInput(editing.due_date);
                await api.update(editing.id, {
                    title: trimmedTitle,
                    content: content.trim(),
                    type: editing.type,
                    ...(dateChanged && dueDate ? { due_date: dueDate } : {}),
                });
            } else {
                await api.create({
                    title: trimmedTitle,
                    content: content.trim(),
                    ...(dueDate ? { due_date: dueDate } : {}),
                });
            }
            setFormVisible(false);
            await load("refresh");
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "儲存失敗，請稍後再試");
        } finally {
            setSaving(false);
        }
    };

    // ------------------------------
    // 刪除
    // ------------------------------
    const handleDelete = async (): Promise<void> => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.remove(deleteTarget.id);
            setDeleteTarget(null);
            await load("refresh");
        } catch (e) {
            setDeleteTarget(null);
            setError(e instanceof Error ? e.message : "刪除失敗，請稍後再試");
        } finally {
            setDeleting(false);
        }
    };

    // ------------------------------
    // 畫面
    // ------------------------------
    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.container}>
                <View style={styles.pinkGlow} />
                <View style={styles.yellowGlow} />

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => load("refresh")}
                            tintColor="#F2C14E"
                            colors={["#F2C14E"]}
                        />
                    }
                >
                    {/* 標題 */}
                    <View style={styles.header}>
                        <View style={styles.topRow}>
                            <Pressable onPress={handleBack} hitSlop={12}>
                                <Text style={styles.backText}>‹ 管理員專區</Text>
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

                        <Text style={styles.title}>管理公告</Text>
                        <Text style={styles.description}>
                            {loading ? "載入中…" : `目前共有 ${items.length} 則公告`}
                        </Text>
                    </View>

                    {/* 新增按鈕 */}
                    <Pressable
                        onPress={openCreate}
                        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
                    >
                        <Text style={styles.addButtonText}>＋ 發布校級公告</Text>
                    </Pressable>

                    {/* 篩選 */}
                    <View style={styles.filterRow}>
                        {FILTERS.map((f) => {
                            const active = f === filter;
                            return (
                                <Pressable
                                    key={f}
                                    onPress={() => setFilter(f)}
                                    style={[styles.chip, active && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                        {f} {countOf(f)}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* 錯誤 */}
                    {error && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                            <Pressable onPress={() => load()} hitSlop={8}>
                                <Text style={styles.errorRetry}>重新載入</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* 載入中 */}
                    {loading && !error && (
                        <ActivityIndicator
                            size="large"
                            color="#F2C14E"
                            style={{ marginTop: 40 }}
                        />
                    )}

                    {/* 空狀態 */}
                    {!loading && !error && visibleItems.length === 0 && (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyIcon}>📢</Text>
                            <Text style={styles.emptyTitle}>
                                {filter === "全部" ? "還沒有任何公告" : `沒有${filter}`}
                            </Text>
                            <Text style={styles.emptyText}>
                                點上方的「發布校級公告」建立第一則
                            </Text>
                        </View>
                    )}

                    {/* 公告列表 */}
                    {visibleItems.map((item) => {
                        const isSchool = item.type === "校級公告";
                        const due = formatDate(item.due_date);
                        return (
                            <View key={item.id} style={styles.card}>
                                <View style={styles.cardTop}>
                                    <View
                                        style={[
                                            styles.badge,
                                            isSchool ? styles.badgeSchool : styles.badgeCourse,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.badgeText,
                                                isSchool
                                                    ? styles.badgeTextSchool
                                                    : styles.badgeTextCourse,
                                            ]}
                                        >
                                            {item.type}
                                            {item.course_id != null ? `・課程 ${item.course_id}` : ""}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.cardTitle}>{item.title}</Text>

                                {!!item.content && (
                                    <Text style={styles.cardContent} numberOfLines={3}>
                                        {item.content}
                                    </Text>
                                )}

                                <View style={styles.metaRow}>
                                    {!!due && <Text style={styles.metaText}>截止 {due}</Text>}
                                    {!!item.update_time && (
                                        <Text style={styles.metaText}>
                                            更新 {formatTime(item.update_time)}
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.actionRow}>
                                    <Pressable
                                        onPress={() => openEdit(item)}
                                        style={({ pressed }) => [
                                            styles.actionButton,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <Text style={styles.actionText}>編輯</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setDeleteTarget(item)}
                                        style={({ pressed }) => [
                                            styles.actionButton,
                                            styles.actionDanger,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <Text style={[styles.actionText, styles.actionDangerText]}>
                                            刪除
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ========================= */}
            {/* 新增 / 編輯 Modal */}
            {/* ========================= */}
            <Modal
                visible={formVisible}
                transparent
                animationType="slide"
                onRequestClose={closeForm}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.modalBackdrop}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeForm} />
                    <View style={styles.sheet}>
                        <Text style={styles.sheetTitle}>
                            {editing ? "編輯公告" : "發布校級公告"}
                        </Text>

                        <ScrollView keyboardShouldPersistTaps="handled">
                            <Text style={styles.label}>標題</Text>
                            <TextInput
                                value={title}
                                onChangeText={setTitle}
                                placeholder="例如：期中考週作息調整通知"
                                placeholderTextColor="#8AA6AF"
                                style={styles.input}
                            />

                            <Text style={styles.label}>內容</Text>
                            <TextInput
                                value={content}
                                onChangeText={setContent}
                                placeholder="輸入公告內容"
                                placeholderTextColor="#8AA6AF"
                                multiline
                                textAlignVertical="top"
                                style={[styles.input, styles.inputMultiline]}
                            />

                            <Text style={styles.label}>截止日期（選填）</Text>
                            <TextInput
                                value={dueDate}
                                onChangeText={setDueDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#8AA6AF"
                                autoCapitalize="none"
                                keyboardType="numbers-and-punctuation"
                                style={styles.input}
                            />

                            {!!formError && <Text style={styles.formError}>{formError}</Text>}
                        </ScrollView>

                        <View style={styles.sheetActions}>
                            <Pressable
                                onPress={closeForm}
                                disabled={saving}
                                style={[styles.sheetButton, styles.sheetCancel]}
                            >
                                <Text style={styles.sheetCancelText}>取消</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSave}
                                disabled={saving}
                                style={[styles.sheetButton, styles.sheetSave]}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#16445A" />
                                ) : (
                                    <Text style={styles.sheetSaveText}>
                                        {editing ? "儲存變更" : "發布"}
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ========================= */}
            {/* 刪除確認 Modal（網頁版 Alert 不支援按鈕，所以自己做） */}
            {/* ========================= */}
            <Modal
                visible={!!deleteTarget}
                transparent
                animationType="fade"
                onRequestClose={() => !deleting && setDeleteTarget(null)}
            >
                <View style={styles.dialogBackdrop}>
                    <View style={styles.dialog}>
                        <Text style={styles.dialogTitle}>刪除這則公告？</Text>
                        <Text style={styles.dialogText} numberOfLines={3}>
                            「{deleteTarget?.title}」刪除後無法復原。
                        </Text>
                        <View style={styles.sheetActions}>
                            <Pressable
                                onPress={() => setDeleteTarget(null)}
                                disabled={deleting}
                                style={[styles.sheetButton, styles.sheetCancel]}
                            >
                                <Text style={styles.sheetCancelText}>取消</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleDelete}
                                disabled={deleting}
                                style={[styles.sheetButton, styles.deleteConfirm]}
                            >
                                {deleting ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.deleteConfirmText}>刪除</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // 整體
    safeArea: { flex: 1, backgroundColor: "#16445A" },
    container: { flex: 1, backgroundColor: "#16445A", overflow: "hidden" },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },

    // Glow
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

    // Header
    header: { marginTop: 16, marginBottom: 22 },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
        marginBottom: 10,
    },
    backText: { fontSize: 15, color: "#F2C14E", fontWeight: "700" },
    refreshText: { fontSize: 14, color: "rgba(240,255,249,0.72)", fontWeight: "700" },
    title: { fontSize: 32, fontWeight: "800", color: "#F0FFF9", marginBottom: 8 },
    description: { fontSize: 15, color: "rgba(240,255,249,0.72)" },

    // 新增按鈕
    addButton: {
        backgroundColor: "#F2C14E",
        borderRadius: 999,
        paddingVertical: 15,
        alignItems: "center",
        marginBottom: 18,
    },
    addButtonText: { fontSize: 16, fontWeight: "800", color: "#16445A" },

    // 篩選
    filterRow: { flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "rgba(240,255,249,0.10)",
    },
    chipActive: { backgroundColor: "rgba(240,255,249,0.92)" },
    chipText: { fontSize: 14, fontWeight: "700", color: "rgba(240,255,249,0.78)" },
    chipTextActive: { color: "#16445A" },

    // 錯誤 / 空狀態
    errorBox: {
        backgroundColor: "rgba(242,140,140,0.18)",
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        gap: 8,
    },
    errorText: { color: "#FFD7D7", fontSize: 14, lineHeight: 20 },
    errorRetry: { color: "#F2C14E", fontWeight: "800", fontSize: 14 },
    emptyBox: { alignItems: "center", paddingVertical: 48 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: "800", color: "#F0FFF9", marginBottom: 6 },
    emptyText: { fontSize: 14, color: "rgba(240,255,249,0.6)" },

    // 公告卡片
    card: {
        backgroundColor: "rgba(239,255,249,0.12)",
        borderColor: "rgba(236,255,248,0.35)",
        borderWidth: 1,
        borderRadius: 24,
        padding: 20,
        marginBottom: 14,
    },
    cardTop: { flexDirection: "row", marginBottom: 10 },
    badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
    badgeSchool: { backgroundColor: "rgba(242,193,78,0.25)" },
    badgeCourse: { backgroundColor: "rgba(154,216,237,0.2)" },
    badgeText: { fontSize: 12, fontWeight: "700" },
    badgeTextSchool: { color: "#F2C14E" },
    badgeTextCourse: { color: "#9AD8ED" },
    cardTitle: { fontSize: 18, fontWeight: "800", color: "#F0FFF9", marginBottom: 6 },
    cardContent: { fontSize: 14, lineHeight: 21, color: "rgba(240,255,249,0.72)", marginBottom: 10 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 14 },
    metaText: { fontSize: 12, color: "rgba(240,255,249,0.5)" },
    actionRow: { flexDirection: "row", gap: 10 },
    actionButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        alignItems: "center",
        backgroundColor: "rgba(240,255,249,0.15)",
    },
    actionText: { fontSize: 14, fontWeight: "800", color: "#F0FFF9" },
    actionDanger: { backgroundColor: "rgba(242,140,140,0.18)" },
    actionDangerText: { color: "#F28C8C" },

    // 按壓效果
    pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },

    // 表單 Modal
    modalBackdrop: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "transparent",
    },
    sheet: {
        backgroundColor: "#123A4E",
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingHorizontal: 24,
        paddingTop: 26,
        paddingBottom: 30,
        maxHeight: "88%",
    },
    sheetTitle: { fontSize: 22, fontWeight: "800", color: "#F0FFF9", marginBottom: 14 },
    label: { fontSize: 13, fontWeight: "700", color: "rgba(240,255,249,0.7)", marginTop: 12, marginBottom: 6 },
    input: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(236,255,248,0.25)",
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: "#F0FFF9",
    },
    inputMultiline: { minHeight: 120 },
    formError: { color: "#F28C8C", fontSize: 13, marginTop: 12 },
    sheetActions: { flexDirection: "row", gap: 12, marginTop: 20 },
    sheetButton: {
        flex: 1,
        height: 48,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
    },
    sheetCancel: { backgroundColor: "rgba(240,255,249,0.15)" },
    sheetCancelText: { fontSize: 15, fontWeight: "800", color: "#F0FFF9" },
    sheetSave: { backgroundColor: "#F2C14E" },
    sheetSaveText: { fontSize: 15, fontWeight: "800", color: "#16445A" },

    // 刪除確認
    dialogBackdrop: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 32,
        backgroundColor: "rgba(0,0,0,0.65)",
    },
    dialog: { backgroundColor: "#123A4E", borderRadius: 32, padding: 24, width: "100%" },
    dialogTitle: { fontSize: 20, fontWeight: "800", color: "#F0FFF9", marginBottom: 8 },
    dialogText: { fontSize: 14, lineHeight: 21, color: "rgba(240,255,249,0.7)" },
    deleteConfirm: { backgroundColor: "#F28C8C" },
    deleteConfirmText: { fontSize: 15, fontWeight: "800", color: "#16445A" },
});