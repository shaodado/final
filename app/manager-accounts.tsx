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
const API_URL = `${API_BASE}/api/manager/accounts`;
const TIMEOUT_MS = 10000;

// ================================
// 型別
// ================================
type Account = {
    user_id: number | string;
    name: string;
    role: string; // "student" | "teacher" | "Manager"
    department_id?: number | string | null;
    department_name?: string | null;
    grade?: number | string | null;
};

type RoleFilter = "all" | "student" | "teacher" | "Manager";

const FILTERS: { key: RoleFilter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "student", label: "學生" },
    { key: "teacher", label: "老師" },
    { key: "Manager", label: "管理員" },
];

const ROLE_LABEL: Record<string, string> = {
    student: "學生",
    teacher: "老師",
    Manager: "管理員",
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    student: { bg: "rgba(154,216,237,0.2)", text: "#9AD8ED" },
    teacher: { bg: "rgba(242,193,78,0.2)", text: "#F2C14E" },
    Manager: { bg: "rgba(242,140,140,0.2)", text: "#F28C8C" },
};

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
    list: async (): Promise<Account[]> => {
        const json = await request<{ data: Account[] }>(API_URL);
        return json.data ?? [];
    },
    update: (id: number | string, payload: { name?: string; password?: string }) =>
        request(`${API_URL}/${encodeURIComponent(String(id))}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),
    remove: (id: number | string) =>
        request(`${API_URL}/${encodeURIComponent(String(id))}`, {
            method: "DELETE",
        }),
};

// ================================
// 工具
// ================================
function metaLine(a: Account): string {
    const parts: string[] = [];

    if (a.role === "student") {
        if (a.grade != null && a.grade !== "") parts.push(String(a.grade));
        if (a.department_id != null && a.department_id !== "") {
            parts.push(`系所代碼 ${a.department_id}`);
        }
    } else if (a.role === "teacher") {
        if (a.department_name) parts.push(a.department_name);
        else if (a.department_id != null && a.department_id !== "") {
            parts.push(`系所代碼 ${a.department_id}`);
        }
    }

    return parts.join("・");
}

// ================================
// 畫面
// ================================
export default function ManagerAccountsScreen() {
    const router = useRouter();

    // 盡力取得目前登入者的 ID，用來防止刪除自己
    // （如果你的 useAuth 沒有提供，myId 會是 undefined，不影響其他功能）
    const auth = useAuth() as any;
    const myId = auth?.user?.userId ?? auth?.user?.user_id ?? auth?.userId;

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
    const [query, setQuery] = useState("");

    // 提示
    const [notice, setNotice] = useState<string | null>(null);
    const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 編輯表單
    const [editing, setEditing] = useState<Account | null>(null);
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // 刪除確認
    const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
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
            setAccounts(await api.list());
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
    // 篩選
    // ------------------------------
    const visibleAccounts = useMemo(() => {
        const q = query.trim().toLowerCase();
        return accounts.filter((a) => {
            if (roleFilter !== "all" && a.role !== roleFilter) return false;
            if (!q) return true;
            return (
                (a.name ?? "").toLowerCase().includes(q) ||
                String(a.user_id).toLowerCase().includes(q)
            );
        });
    }, [accounts, roleFilter, query]);

    const countOf = (key: RoleFilter) =>
        key === "all" ? accounts.length : accounts.filter((a) => a.role === key).length;

    const isFiltering = roleFilter !== "all" || query.trim() !== "";

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
    const openEdit = (item: Account): void => {
        setEditing(item);
        setName(item.name ?? "");
        setPassword("");
        setShowPassword(false);
        setFormError(null);
    };

    const closeEdit = (): void => {
        if (saving) return;
        setEditing(null);
    };

    const handleSave = async (): Promise<void> => {
        if (!editing) return;

        const trimmedName = name.trim();
        if (!trimmedName) {
            setFormError("名稱不能空白");
            return;
        }

        const nameChanged = trimmedName !== (editing.name ?? "");
        const passwordChanged = password.length > 0;

        if (!nameChanged && !passwordChanged) {
            setFormError("沒有任何變更");
            return;
        }

        setSaving(true);
        setFormError(null);
        try {
            await api.update(editing.user_id, {
                ...(nameChanged ? { name: trimmedName } : {}),
                ...(passwordChanged ? { password } : {}),
            });
            const savedName = trimmedName;
            setEditing(null);
            showNotice(`已更新「${savedName}」`);
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
            await api.remove(deleteTarget.user_id);
            const removedName = deleteTarget.name;
            setDeleteTarget(null);
            showNotice(`已刪除「${removedName}」`);
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

                        <Text style={styles.title}>管理帳號</Text>
                        <Text style={styles.description}>
                            {loading
                                ? "載入中…"
                                : isFiltering
                                  ? `符合 ${visibleAccounts.length} 個，共 ${accounts.length} 個帳號`
                                  : `共 ${accounts.length} 個帳號`}
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
                            placeholder="搜尋名稱或帳號 ID"
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

                    {/* 身分篩選 */}
                    <View style={styles.filterRow}>
                        {FILTERS.map((f) => {
                            const active = f.key === roleFilter;
                            return (
                                <Pressable
                                    key={f.key}
                                    onPress={() => setRoleFilter(f.key)}
                                    style={[styles.chip, active && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                        {f.label} {countOf(f.key)}
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
                    {!loading && !error && visibleAccounts.length === 0 && (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyIcon}>👤</Text>
                            <Text style={styles.emptyTitle}>
                                {isFiltering ? "找不到符合的帳號" : "還沒有任何帳號"}
                            </Text>
                            {isFiltering && (
                                <Pressable
                                    onPress={() => {
                                        setQuery("");
                                        setRoleFilter("all");
                                    }}
                                    hitSlop={8}
                                >
                                    <Text style={styles.emptyAction}>清除搜尋與篩選</Text>
                                </Pressable>
                            )}
                        </View>
                    )}

                    {/* 帳號列表 */}
                    {visibleAccounts.map((item) => {
                        const colors = ROLE_COLORS[item.role] ?? ROLE_COLORS.student;
                        const meta = metaLine(item);
                        const isSelf =
                            item.role === "Manager" &&
                            myId != null &&
                            String(item.user_id) === String(myId);

                        return (
                            <View key={`${item.role}-${item.user_id}`} style={styles.card}>
                                <View style={styles.cardMain}>
                                    <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
                                        <Text style={[styles.avatarText, { color: colors.text }]}>
                                            {(item.name || "?").charAt(0)}
                                        </Text>
                                    </View>

                                    <View style={styles.cardInfo}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.cardName} numberOfLines={1}>
                                                {item.name || "（未命名）"}
                                            </Text>
                                            {isSelf && <Text style={styles.selfTag}>目前登入</Text>}
                                        </View>

                                        <View style={styles.badgeRow}>
                                            <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                                                <Text style={[styles.badgeText, { color: colors.text }]}>
                                                    {ROLE_LABEL[item.role] ?? item.role}
                                                </Text>
                                            </View>
                                            <Text style={styles.idText}>ID {item.user_id}</Text>
                                        </View>

                                        {!!meta && <Text style={styles.metaText}>{meta}</Text>}
                                    </View>
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
                                        disabled={isSelf}
                                        style={({ pressed }) => [
                                            styles.actionButton,
                                            styles.actionDanger,
                                            isSelf && styles.actionDisabled,
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
            </View>

            {/* ========================= */}
            {/* 編輯 Modal */}
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
                        <Text style={styles.sheetTitle}>編輯帳號</Text>

                        {!!editing && (
                            <View style={styles.sheetMeta}>
                                <View
                                    style={[
                                        styles.badge,
                                        {
                                            backgroundColor: (
                                                ROLE_COLORS[editing.role] ?? ROLE_COLORS.student
                                            ).bg,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.badgeText,
                                            {
                                                color: (
                                                    ROLE_COLORS[editing.role] ?? ROLE_COLORS.student
                                                ).text,
                                            },
                                        ]}
                                    >
                                        {ROLE_LABEL[editing.role] ?? editing.role}
                                    </Text>
                                </View>
                                <Text style={styles.idText}>ID {editing.user_id}</Text>
                            </View>
                        )}

                        <ScrollView keyboardShouldPersistTaps="handled">
                            <Text style={styles.label}>名稱</Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="輸入名稱"
                                placeholderTextColor="#8AA6AF"
                                style={styles.input}
                            />

                            <Text style={styles.label}>新密碼（不修改請留空）</Text>
                            <View style={styles.passwordWrap}>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="輸入新密碼"
                                    placeholderTextColor="#8AA6AF"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={styles.passwordInput}
                                />
                                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                                    <Ionicons
                                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color="#6F8F9A"
                                    />
                                </Pressable>
                            </View>

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
                        <Text style={styles.dialogTitle}>刪除這個帳號？</Text>
                        <Text style={styles.dialogText}>
                            {deleteTarget
                                ? `${ROLE_LABEL[deleteTarget.role] ?? deleteTarget.role}「${deleteTarget.name}」（ID ${deleteTarget.user_id}）刪除後無法復原。`
                                : ""}
                        </Text>
                        {deleteTarget?.role === "Manager" && (
                            <Text style={styles.dialogWarning}>
                                這是管理員帳號，刪除後此人將無法再登入管理員專區。
                            </Text>
                        )}
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
    searchInput: {
        flex: 1,
        color: "#F0FFF9",
        fontSize: 15,
        paddingVertical: 0,
    },

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

    // 帳號卡片
    card: {
        backgroundColor: "rgba(239,255,249,0.12)",
        borderColor: "rgba(236,255,248,0.35)",
        borderWidth: 1,
        borderRadius: 24,
        padding: 18,
        marginBottom: 14,
    },
    cardMain: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: { fontSize: 22, fontWeight: "800" },
    cardInfo: { flex: 1 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardName: { flexShrink: 1, fontSize: 18, fontWeight: "800", color: "#F0FFF9" },
    selfTag: {
        fontSize: 11,
        fontWeight: "800",
        color: "#16445A",
        backgroundColor: "rgba(242,193,78,0.8)",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        overflow: "hidden",
    },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
    badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
    badgeText: { fontSize: 12, fontWeight: "700" },
    idText: { fontSize: 13, color: "rgba(240,255,249,0.6)", fontWeight: "600" },
    metaText: { fontSize: 12, color: "rgba(240,255,249,0.5)", marginTop: 6 },

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
    actionDisabled: { opacity: 0.35 },

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
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    sheet: {
        backgroundColor: "#F0FFF9",
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingHorizontal: 24,
        paddingTop: 26,
        paddingBottom: 30,
        maxHeight: "88%",
    },
    sheetTitle: { fontSize: 22, fontWeight: "800", color: "#16445A", marginBottom: 10 },
    sheetMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
    label: { fontSize: 13, fontWeight: "700", color: "#426875", marginTop: 14, marginBottom: 6 },
    input: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(22,68,90,0.15)",
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: "#16445A",
    },
    passwordWrap: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(22,68,90,0.15)",
        paddingHorizontal: 16,
    },
    passwordInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
        color: "#16445A",
    },
    formError: { color: "#C23B3B", fontSize: 13, marginTop: 12 },
    sheetActions: { flexDirection: "row", gap: 12, marginTop: 20 },
    sheetButton: {
        flex: 1,
        height: 48,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
    },
    sheetCancel: { backgroundColor: "rgba(22,68,90,0.10)" },
    sheetCancelText: { fontSize: 15, fontWeight: "800", color: "#16445A" },
    sheetSave: { backgroundColor: "#F2C14E" },
    sheetSaveText: { fontSize: 15, fontWeight: "800", color: "#16445A" },

    // 刪除確認
    dialogBackdrop: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 32,
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    dialog: { backgroundColor: "#F0FFF9", borderRadius: 32, padding: 24 },
    dialogTitle: { fontSize: 20, fontWeight: "800", color: "#16445A", marginBottom: 8 },
    dialogText: { fontSize: 14, lineHeight: 21, color: "#426875" },
    dialogWarning: {
        fontSize: 13,
        lineHeight: 20,
        color: "#C23B3B",
        fontWeight: "700",
        marginTop: 10,
    },
    deleteConfirm: { backgroundColor: "#C23B3B" },
    deleteConfirmText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
});