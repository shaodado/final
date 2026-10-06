import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const API_URL = `${API_BASE}/api/manager/evaluations`;
const TIMEOUT_MS = 10000;

// ================================
// 型別與常數
// ================================
type Evaluation = {
    id: string; // MongoDB _id，一定存在，管理功能都靠它
    eval_id: number | null; // 舊資料可能沒有
    user_id: number | string | null;
    course_id: number | string | null;
    sweetness: number | null;
    easiness: number | null;
    gains: number | null;
    comment: string;
    evaluation_status: string;
    manager_update_id: number | null;
    manager_update: string | null;
};

const ALL = "全部";

// 預設會出現的狀態；資料庫裡有其他狀態時會自動補進來
const DEFAULT_STATUSES = ["已審核", "待審核", "已隱藏"];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    已審核: { bg: "rgba(66,160,120,0.30)", text: "#A7F3D0" },
    待審核: { bg: "rgba(242,193,78,0.30)", text: "#F2C14E" },
    已隱藏: { bg: "rgba(242,140,140,0.30)", text: "#F28C8C" },
};
const FALLBACK_STATUS_COLOR = { bg: "rgba(154,216,237,0.2)", text: "#9AD8ED" };

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
    list: async (): Promise<Evaluation[]> => {
        const json = await request<{ data: Evaluation[] }>(API_URL);
        return json.data ?? [];
    },
    update: (
        key: string,
        payload: {
            evaluation_status?: string;
            manager_update_id?: number;
            manager_update?: string;
        },
    ) =>
        request(`${API_URL}/${encodeURIComponent(key)}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
    remove: (key: string) =>
        request(`${API_URL}/${encodeURIComponent(key)}`, { method: "DELETE" }),
};

// ================================
// 工具
// ================================
function evalLabel(i: Evaluation): string {
    return i.eval_id != null ? `#${i.eval_id}` : `#${i.id.slice(-6)}`;
}

function formatScore(v: number | null | undefined): string {
    return typeof v === "number" && Number.isFinite(v) ? v.toFixed(1) : "-";
}

function statusColor(status: string) {
    return STATUS_COLORS[status] ?? FALLBACK_STATUS_COLOR;
}

// ================================
// 畫面
// ================================
export default function ManagerEvaluationsScreen() {
    const router = useRouter();

    // 盡力取得目前登入的管理員 ID，寫入 manager_update_id
    // （如果你的 useAuth 沒有提供，就不會送這個欄位，不影響其他功能）
    const auth = useAuth() as any;
    const rawMyId = auth?.user?.userId ?? auth?.user?.user_id ?? auth?.userId;
    const myId =
        rawMyId != null && Number.isFinite(Number(rawMyId)) ? Number(rawMyId) : undefined;

    const [items, setItems] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<string>(ALL);
    const [query, setQuery] = useState("");
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // 提示
    const [notice, setNotice] = useState<string | null>(null);
    const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 編輯表單
    const [editing, setEditing] = useState<Evaluation | null>(null);
    const [status, setStatus] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // 刪除確認
    const [deleteTarget, setDeleteTarget] = useState<Evaluation | null>(null);
    const [deleting, setDeleting] = useState(false);

    // ------------------------------
    // 提示訊息
    // ------------------------------
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

    // ------------------------------
    // 狀態清單與篩選
    // ------------------------------
    const statusOptions = useMemo(() => {
        const set = new Set<string>(DEFAULT_STATUSES);
        items.forEach((i) => i.evaluation_status && set.add(i.evaluation_status));
        return Array.from(set);
    }, [items]);

    const visibleItems = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((i) => {
            if (statusFilter !== ALL && i.evaluation_status !== statusFilter) return false;
            if (!q) return true;
            return (
                (i.comment ?? "").toLowerCase().includes(q) ||
                String(i.course_id ?? "").toLowerCase().includes(q) ||
                String(i.user_id ?? "").toLowerCase().includes(q) ||
                String(i.eval_id ?? "").toLowerCase().includes(q) ||
                i.id.toLowerCase().endsWith(q.replace(/^#/, ""))
            );
        });
    }, [items, statusFilter, query]);

    const countOf = (s: string) =>
        s === ALL ? items.length : items.filter((i) => i.evaluation_status === s).length;

    const isFiltering = statusFilter !== ALL || query.trim() !== "";

    // ------------------------------
    // 導覽
    // ------------------------------
    const handleBack = (): void => {
        if (router.canGoBack()) router.back();
        else router.replace("/manager" as never);
    };

    // ------------------------------
    // 編輯
    // ------------------------------
    const openEdit = (item: Evaluation): void => {
        setEditing(item);
        setStatus(item.evaluation_status ?? "");
        setNote(item.manager_update ?? "");
        setFormError(null);
    };

    const closeEdit = (): void => {
        if (saving) return;
        setEditing(null);
    };

    const handleSave = async (): Promise<void> => {
        if (!editing) return;

        const statusChanged = status !== (editing.evaluation_status ?? "");
        const trimmedNote = note.trim();
        const noteChanged = trimmedNote !== (editing.manager_update ?? "");

        if (!statusChanged && !noteChanged) {
            setFormError("沒有任何變更");
            return;
        }

        setSaving(true);
        setFormError(null);
        try {
            await api.update(editing.id, {
                ...(statusChanged ? { evaluation_status: status } : {}),
                ...(noteChanged ? { manager_update: trimmedNote } : {}),
                ...(myId !== undefined ? { manager_update_id: myId } : {}),
            });
            setEditing(null);
            showNotice("評價已更新");
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
            showNotice("評價已刪除");
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
        <View style={styles.page}>
            <Stack.Screen options={{ headerShown: false }} />
            
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

                        <Text style={styles.title}>管理課程評價</Text>
                        <Text style={styles.description}>
                            {loading
                                ? "載入中…"
                                : isFiltering
                                  ? `符合 ${visibleItems.length} 則，共 ${items.length} 則評價`
                                  : `共 ${items.length} 則評價`}
                        </Text>
                    </View>

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
                            placeholder="搜尋評論、課程或評價者 ID"
                            placeholderTextColor="rgba(240,255,249,0.45)"
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.searchInput}
                        />
                        {query.length > 0 && (
                            <Pressable onPress={() => setQuery("")} hitSlop={10}>
                                <Ionicons
                                    name="close-circle"
                                    size={18}
                                    color="rgba(240,255,249,0.6)"
                                />
                            </Pressable>
                        )}
                    </View>

                    {/* 狀態篩選 */}
                    <View style={styles.filterRow}>
                        {[ALL, ...statusOptions].map((s) => {
                            const active = s === statusFilter;
                            return (
                                <Pressable
                                    key={s}
                                    onPress={() => setStatusFilter(s)}
                                    style={[styles.chip, active && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                        {s} {countOf(s)}
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
                            <Text style={styles.emptyIcon}>⭐</Text>
                            <Text style={styles.emptyTitle}>
                                {isFiltering ? "找不到符合的評價" : "還沒有任何課程評價"}
                            </Text>
                            {isFiltering && (
                                <Pressable
                                    onPress={() => {
                                        setQuery("");
                                        setStatusFilter(ALL);
                                    }}
                                    hitSlop={8}
                                >
                                    <Text style={styles.emptyAction}>清除搜尋與篩選</Text>
                                </Pressable>
                            )}
                        </View>
                    )}

                    {/* 評價列表 */}
                    {visibleItems.map((item) => {
                        const colors = statusColor(item.evaluation_status);
                        const isOpen = !!expanded[item.id];
                        const comment = (item.comment ?? "").trim();

                        return (
                            <View key={item.id} style={styles.card}>
                                <View style={styles.cardTop}>
                                    <View style={styles.cardTopLeft}>
                                        <View style={[styles.badge, styles.courseBadge]}>
                                            <Text style={styles.courseBadgeText}>
                                                課程 {item.course_id ?? "-"}
                                            </Text>
                                        </View>
                                        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                                            <Text style={[styles.badgeText, { color: colors.text }]}>
                                                {item.evaluation_status || "未設定"}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.idText}>{evalLabel(item)}</Text>
                                </View>

                                {/* 三項分數 */}
                                <View style={styles.scoreRow}>
                                    <View style={styles.scoreBox}>
                                        <Text style={styles.scoreValue}>{formatScore(item.sweetness)}</Text>
                                        <Text style={styles.scoreLabel}>甜度</Text>
                                    </View>
                                    <View style={styles.scoreBox}>
                                        <Text style={styles.scoreValue}>{formatScore(item.easiness)}</Text>
                                        <Text style={styles.scoreLabel}>輕鬆度</Text>
                                    </View>
                                    <View style={styles.scoreBox}>
                                        <Text style={styles.scoreValue}>{formatScore(item.gains)}</Text>
                                        <Text style={styles.scoreLabel}>收穫</Text>
                                    </View>
                                </View>

                                {/* 評論 */}
                                {comment ? (
                                    <Pressable
                                        onPress={() =>
                                            setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                                        }
                                    >
                                        <Text
                                            style={styles.comment}
                                            numberOfLines={isOpen ? undefined : 4}
                                        >
                                            {comment}
                                        </Text>
                                        {comment.length > 90 && (
                                            <Text style={styles.expandText}>
                                                {isOpen ? "收合" : "展開全文"}
                                            </Text>
                                        )}
                                    </Pressable>
                                ) : (
                                    <Text style={styles.commentEmpty}>（沒有文字評論）</Text>
                                )}

                                <Text style={styles.metaText}>評價者 ID {item.user_id ?? "-"}</Text>

                                {/* 管理備註 */}
                                {!!item.manager_update && (
                                    <View style={styles.noteBox}>
                                        <Text style={styles.noteLabel}>
                                            管理備註
                                            {item.manager_update_id != null
                                                ? `・管理員 ${item.manager_update_id}`
                                                : ""}
                                        </Text>
                                        <Text style={styles.noteText}>{item.manager_update}</Text>
                                    </View>
                                )}

                                <View style={styles.actionRow}>
                                    <Pressable
                                        onPress={() => openEdit(item)}
                                        style={({ pressed }) => [
                                            styles.actionButton,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <Text style={styles.actionText}>審核 / 備註</Text>
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
            {/* 審核 / 備註 Modal */}
            {/* ========================= */}
            <Modal
                visible={!!editing}
                transparent
                animationType="slide"
                onRequestClose={closeEdit}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.modalBackdrop}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeEdit} />
                    <View style={styles.sheet}>
                        <Text style={styles.sheetTitle}>審核評價</Text>
                        {!!editing && (
                            <Text style={styles.sheetSub} numberOfLines={2}>
                                {evalLabel(editing)}・課程 {editing.course_id ?? "-"}
                                {editing.comment ? `・${editing.comment}` : ""}
                            </Text>
                        )}

                        <ScrollView keyboardShouldPersistTaps="handled">
                            <Text style={styles.label}>評價狀態</Text>
                            <View style={styles.statusPicker}>
                                {statusOptions.map((s) => {
                                    const active = s === status;
                                    const c = statusColor(s);
                                    return (
                                        <Pressable
                                            key={s}
                                            onPress={() => setStatus(s)}
                                            style={[
                                                styles.statusOption,
                                                active && {
                                                    backgroundColor: c.bg,
                                                    borderColor: c.text,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusOptionText,
                                                    active && { color: c.text },
                                                ]}
                                            >
                                                {s}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>管理備註（選填）</Text>
                            <TextInput
                                value={note}
                                onChangeText={setNote}
                                placeholder="例如：內容含不當用語，已隱藏"
                                placeholderTextColor="#8AA6AF"
                                multiline
                                textAlignVertical="top"
                                style={[styles.input, styles.inputMultiline]}
                            />

                            {!!formError && <Text style={styles.formError}>{formError}</Text>}
                        </ScrollView>

                        <View style={styles.sheetActions}>
                            <Pressable
                                onPress={closeEdit}
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
                                    <Text style={styles.sheetSaveText}>儲存變更</Text>
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
                        <Text style={styles.dialogTitle}>刪除這則評價？</Text>
                        <Text style={styles.dialogText} numberOfLines={4}>
                            {deleteTarget
                                ? `${evalLabel(deleteTarget)}・課程 ${deleteTarget.course_id ?? "-"}${
                                      deleteTarget.comment ? `\n「${deleteTarget.comment}」` : ""
                                  }\n刪除後無法復原。`
                                : ""}
                        </Text>
                        <Text style={styles.dialogHint}>
                            只是不想讓同學看到的話，可以改成「已隱藏」，不用刪除。
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
        </View>
    );
}

const styles = StyleSheet.create({
    // 整體
    page: { flex: 1, backgroundColor: "#16445A" },
    safeArea: { flex: 1 },
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
    header: { marginTop: 16, marginBottom: 20 },
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

    // 搜尋
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
    searchInput: { flex: 1, color: "#F0FFF9", fontSize: 15, paddingVertical: 0 },

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
    emptyTitle: { fontSize: 18, fontWeight: "800", color: "#F0FFF9", marginBottom: 10 },
    emptyAction: { fontSize: 14, fontWeight: "800", color: "#F2C14E" },

    // 評價卡片
    card: {
        backgroundColor: "rgba(239,255,249,0.12)",
        borderColor: "rgba(236,255,248,0.35)",
        borderWidth: 1,
        borderRadius: 24,
        padding: 20,
        marginBottom: 14,
    },
    cardTop: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    cardTopLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, flexWrap: "wrap" },
    badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
    badgeText: { fontSize: 12, fontWeight: "700" },
    courseBadge: { backgroundColor: "rgba(154,216,237,0.2)" },
    courseBadgeText: { fontSize: 12, fontWeight: "700", color: "#9AD8ED" },
    idText: { fontSize: 13, color: "rgba(240,255,249,0.6)", fontWeight: "700" },

    scoreRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    scoreBox: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.07)",
    },
    scoreValue: { fontSize: 20, fontWeight: "800", color: "#F0FFF9" },
    scoreLabel: { fontSize: 12, color: "rgba(240,255,249,0.6)", marginTop: 2 },

    comment: { fontSize: 14, lineHeight: 22, color: "rgba(240,255,249,0.8)" },
    commentEmpty: { fontSize: 14, color: "rgba(240,255,249,0.4)" },
    expandText: { fontSize: 13, fontWeight: "800", color: "#F2C14E", marginTop: 6 },
    metaText: { fontSize: 12, color: "rgba(240,255,249,0.5)", marginTop: 10 },

    noteBox: {
        marginTop: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: "rgba(242,193,78,0.15)",
    },
    noteLabel: { fontSize: 12, fontWeight: "800", color: "#F2C14E", marginBottom: 4 },
    noteText: { fontSize: 13, lineHeight: 19, color: "rgba(240,255,249,0.8)" },

    actionRow: { flexDirection: "row", gap: 10, marginTop: 16 },
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

    // 成功提示
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
    noticeText: { fontSize: 14, fontWeight: "800", color: "#16445A" },

    // 編輯 Modal
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
    sheetTitle: { fontSize: 22, fontWeight: "800", color: "#F0FFF9", marginBottom: 6 },
    sheetSub: { fontSize: 13, lineHeight: 19, color: "rgba(240,255,249,0.7)", marginBottom: 4 },
    label: { fontSize: 13, fontWeight: "700", color: "rgba(240,255,249,0.7)", marginTop: 14, marginBottom: 8 },
    statusPicker: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    statusOption: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: "rgba(236,255,248,0.25)",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    statusOptionText: { fontSize: 14, fontWeight: "800", color: "#F0FFF9" },
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
    inputMultiline: { minHeight: 100 },
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
    dialogHint: { fontSize: 13, lineHeight: 19, color: "rgba(240,255,249,0.5)", marginTop: 10 },
    deleteConfirm: { backgroundColor: "#F28C8C" },
    deleteConfirmText: { fontSize: 15, fontWeight: "800", color: "#16445A" },
});