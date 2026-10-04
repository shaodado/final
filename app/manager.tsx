import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "./_layout";

const { width } = Dimensions.get("window");

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
const LAST_READ_KEY = "@manager_last_read_school_announcement";

type SchoolAnnouncement = {
    id: string;
    title: string;
    content: string;
    publishedAt: string;
};

export default function ManagerScreen() {
    const router = useRouter();
    const { signOut } = useAuth();

    const [announcements, setAnnouncements] = useState<SchoolAnnouncement[]>([]);
    const [loadingAnn, setLoadingAnn] = useState<boolean>(true);
    const [annError, setAnnError] = useState<string | null>(null);
    const [hasUnread, setHasUnread] = useState<boolean>(false);

    const [showAnnModal, setShowAnnModal] = useState<boolean>(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

    // ================================
    // 讀取校級公告 + 比對未讀紅點
    // 每次回到這個畫面都會重新檢查（例如剛發布完公告回來）
    // ================================
    useFocusEffect(
        useCallback(() => {
            let active = true;

            const check = async () => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 8000);

                try {
                    setAnnError(null);

                    const res = await fetch(`${API_BASE}/api/announcements/school`, {
                        signal: controller.signal,
                    });
                    const json = await res.json();

                    if (!json.success) {
                        throw new Error("伺服器回傳失敗");
                    }

                    const list: SchoolAnnouncement[] = json.data ?? [];
                    if (!active) return;
                    setAnnouncements(list);

                    const latestId = list[0]?.id;
                    const lastReadId = await AsyncStorage.getItem(LAST_READ_KEY);
                    if (active) setHasUnread(!!latestId && latestId !== lastReadId);
                } catch {
                    if (active) setAnnError(`無法取得公告（${API_BASE}）`);
                } finally {
                    clearTimeout(timer);
                    if (active) setLoadingAnn(false);
                }
            };

            check();

            return () => {
                active = false;
            };
        }, []),
    );

    // ================================
    // 鈴鐺：開啟公告並標示已讀
    // ================================
    const handleOpenBell = async (): Promise<void> => {
        setShowAnnModal(true);

        if (hasUnread) {
            setHasUnread(false);
            const latestId = announcements[0]?.id;
            if (latestId) {
                await AsyncStorage.setItem(LAST_READ_KEY, latestId);
            }
        }
    };

    // ================================
    // 登出
    // 確認視窗不是 Modal，所以不會有「關閉動畫吃掉登出」的問題
    // ================================
    const handleConfirmLogout = (): void => {
        setShowLogoutConfirm(false);
        signOut();
    };

    // ================================
    // 導覽
    // ================================
    const handleAnnouncements = (): void => {
        router.push("/manager-announcements" as never);
    };

    const handleAccounts = (): void => {
        router.push("/manager-accounts" as never);
    };

    const handleEvaluations = (): void => {
        router.push("/manager-evaluations" as never);
    };

    // 先關閉 Modal，等關閉動畫結束再跳頁，避免 iOS 吃掉導覽
    const handleGoManageFromModal = (): void => {
        setShowAnnModal(false);
        setTimeout(() => {
            handleAnnouncements();
        }, 300);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.container}>
                {/* 背景 Glow */}
                <View style={styles.pinkGlow} />
                <View style={styles.yellowGlow} />

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ========================= */}
                    {/* 標題列：左邊標題，右邊鈴鐺＋登出 */}
                    {/* ========================= */}
                    <View style={styles.topBar}>
                        <View style={styles.topBarText}>
                            <Text style={styles.smallTitle}>ADMIN PORTAL</Text>
                            <Text style={styles.title}>管理員專區</Text>
                        </View>

                        <View style={styles.topBarActions}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="校級公告"
                                onPress={handleOpenBell}
                                style={({ pressed }) => [
                                    styles.iconButton,
                                    pressed && styles.buttonPressed,
                                ]}
                            >
                                <Ionicons
                                    name="notifications-outline"
                                    size={20}
                                    color="#FFFFFF"
                                />
                                {hasUnread && <View style={styles.unreadDot} />}
                            </Pressable>

                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="登出"
                                onPress={() => setShowLogoutConfirm(true)}
                                style={({ pressed }) => [
                                    styles.logoutButton,
                                    pressed && styles.buttonPressed,
                                ]}
                            >
                                <Text style={styles.logoutText}>登出</Text>
                            </Pressable>
                        </View>
                    </View>

                    <Text style={styles.description}>
                        管理校園公告、使用者帳號與課程評價
                    </Text>

                    {/* ========================= */}
                    {/* 主要功能泡泡 */}
                    {/* ========================= */}
                    <View style={styles.mainBubbleContainer}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="管理公告"
                            onPress={handleAnnouncements}
                            style={({ pressed }) => [
                                styles.mainBubble,
                                pressed && styles.pressed,
                            ]}
                        >
                            <LinearGradient
                                colors={[
                                    "rgba(240,255,249,0.95)",
                                    "rgba(210,245,235,0.78)",
                                ]}
                                style={styles.mainBubbleGradient}
                            >
                                <Text style={styles.mainBubbleIcon}>📢</Text>
                                <Text style={styles.mainBubbleTitle}>管理公告</Text>
                                <Text style={styles.mainBubbleDescription}>
                                    查看與管理校級公告
                                </Text>
                            </LinearGradient>
                        </Pressable>
                    </View>

                    {/* ========================= */}
                    {/* 其他功能 */}
                    {/* ========================= */}
                    <View style={styles.featureRow}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="管理帳號"
                            onPress={handleAccounts}
                            style={({ pressed }) => [
                                styles.smallBubble,
                                pressed && styles.pressed,
                            ]}
                        >
                            <LinearGradient
                                colors={[
                                    "rgba(240,255,249,0.88)",
                                    "rgba(210,245,235,0.70)",
                                ]}
                                style={styles.smallBubbleGradient}
                            >
                                <Text style={styles.smallBubbleIcon}>👤</Text>
                                <Text style={styles.smallBubbleTitle}>管理帳號</Text>
                                <Text style={styles.smallBubbleDescription}>
                                    學生・老師・管理員
                                </Text>
                            </LinearGradient>
                        </Pressable>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="管理課程評價"
                            onPress={handleEvaluations}
                            style={({ pressed }) => [
                                styles.smallBubble,
                                pressed && styles.pressed,
                            ]}
                        >
                            <LinearGradient
                                colors={[
                                    "rgba(240,255,249,0.88)",
                                    "rgba(210,245,235,0.70)",
                                ]}
                                style={styles.smallBubbleGradient}
                            >
                                <Text style={styles.smallBubbleIcon}>⭐</Text>
                                <Text style={styles.smallBubbleTitle}>管理課程評價</Text>
                                <Text style={styles.smallBubbleDescription}>
                                    查看與管理課程評價
                                </Text>
                            </LinearGradient>
                        </Pressable>
                    </View>

                    {/* ========================= */}
                    {/* 底部文字 */}
                    {/* ========================= */}
                    <View style={styles.footer}>
                        <View style={styles.footerLine} />
                        <Text style={styles.footerTitle}>
                            ADMIN • MANAGEMENT • SERVICE
                        </Text>
                        <Text style={styles.footerText}>校園智慧助手</Text>
                    </View>
                </ScrollView>
            </View>

            {/* ========================= */}
            {/* 校級公告 Modal（鈴鐺） */}
            {/* ========================= */}
            <Modal
                visible={showAnnModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAnnModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => setShowAnnModal(false)}
                    />

                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderLeft}>
                                <View style={styles.modalIconWrap}>
                                    <Ionicons
                                        name="megaphone-outline"
                                        size={18}
                                        color="#FFFFFF"
                                    />
                                </View>
                                <View>
                                    <Text style={styles.modalTitle}>校級公告</Text>
                                    <Text style={styles.modalSubtitle}>
                                        目前對全校師生顯示的公告
                                    </Text>
                                </View>
                            </View>

                            <Pressable
                                accessibilityLabel="關閉"
                                onPress={() => setShowAnnModal(false)}
                                hitSlop={10}
                            >
                                <Ionicons name="close" size={24} color="#F0FFF9" />
                            </Pressable>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={styles.modalScroll}
                        >
                            {loadingAnn && (
                                <ActivityIndicator
                                    color="#F2C14E"
                                    style={{ marginTop: 30 }}
                                />
                            )}

                            {!loadingAnn && !!annError && (
                                <Text style={styles.modalMessage}>{annError}</Text>
                            )}

                            {!loadingAnn && !annError && announcements.length === 0 && (
                                <Text style={styles.modalMessage}>
                                    目前沒有校級公告
                                </Text>
                            )}

                            {announcements.map((item) => (
                                <LinearGradient
                                    key={item.id}
                                    colors={[
                                        "rgba(239,255,249,0.22)",
                                        "rgba(172,224,208,0.08)",
                                    ]}
                                    style={styles.schoolCard}
                                >
                                    <View style={styles.cardTopRow}>
                                        <View style={styles.schoolTag}>
                                            <Text style={styles.schoolTagText}>
                                                全校公告
                                            </Text>
                                        </View>
                                        <Text style={styles.metaTimeText}>
                                            {item.publishedAt}
                                        </Text>
                                    </View>
                                    <Text style={styles.announcementTitle}>
                                        {item.title}
                                    </Text>
                                    {!!item.content && (
                                        <Text style={styles.announcementContent}>
                                            {item.content}
                                        </Text>
                                    )}
                                </LinearGradient>
                            ))}
                        </ScrollView>

                        <Pressable
                            onPress={handleGoManageFromModal}
                            style={({ pressed }) => [
                                styles.manageButton,
                                pressed && styles.buttonPressed,
                            ]}
                        >
                            <Text style={styles.manageButtonText}>前往管理公告</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* ========================= */}
            {/* 登出確認（覆蓋層，不使用 Modal） */}
            {/* ========================= */}
            {showLogoutConfirm && (
                <View style={styles.dialogBackdrop} accessibilityViewIsModal>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => setShowLogoutConfirm(false)}
                    />

                    <LinearGradient
            colors={[
              "rgba(239,255,249,0.28)",
              "rgba(172,224,208,0.1)",
            ]}
            style={[styles.dialog, { backgroundColor: "#16445A", borderWidth: 1, borderColor: "rgba(236,255,248,0.35)", borderRadius: 24 }]}
          >
            <Text style={[styles.dialogTitle, { color: "#F0FFF9", fontSize: 19, marginBottom: 10 }]}>要登出嗎？</Text>
            <Text style={[styles.dialogText, { color: "#C3E0D8", marginBottom: 6 }]}>
              登出後需要重新輸入帳號密碼才能進入管理員專區。
            </Text>

            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setShowLogoutConfirm(false)}
                style={[styles.dialogButton, styles.dialogCancel, { backgroundColor: "rgba(8,47,61,0.38)", borderWidth: 1, borderColor: "rgba(236,255,248,0.28)", borderRadius: 14 }]}
              >
                <Text style={[styles.dialogCancelText, { color: "#F0FFF9" }]}>取消</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmLogout}
                style={[styles.dialogButton, styles.dialogConfirm, { backgroundColor: "#F2C14E", borderRadius: 14 }]}
              >
                <Text style={[styles.dialogConfirmText, { color: "#16445A" }]}>登出</Text>
              </Pressable>
            </View>
          </LinearGradient>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // ==================================
    // 整體
    // ==================================
    safeArea: {
        flex: 1,
        backgroundColor: "#16445A",
    },

    container: {
        flex: 1,
        backgroundColor: "#16445A",
        overflow: "hidden",
    },

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
    // 標題列
    // ==================================
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 22,
    },

    topBarText: {
        flexShrink: 1,
    },

    topBarActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    smallTitle: {
        fontSize: 11,
        letterSpacing: 3,
        color: "#F2C14E",
        fontWeight: "700",
        marginBottom: 6,
    },

    title: {
        fontSize: 30,
        fontWeight: "800",
        color: "#F0FFF9",
    },

    description: {
        fontSize: 15,
        lineHeight: 24,
        color: "rgba(240,255,249,0.72)",
        marginTop: 14,
        marginBottom: 30,
    },

    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.09)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
        alignItems: "center",
        justifyContent: "center",
    },

    unreadDot: {
        position: "absolute",
        top: 8,
        right: 9,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#F28C8C",
        borderWidth: 1,
        borderColor: "#16445A",
    },

    logoutButton: {
        minWidth: 58,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 15,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.09)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
    },

    logoutText: {
        color: "#F0FFF9",
        fontSize: 13,
        fontWeight: "700",
    },

    buttonPressed: {
        opacity: 0.65,
        transform: [{ scale: 0.95 }],
    },

    // ==================================
    // 大泡泡
    // ==================================
    mainBubbleContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 28,
    },

    mainBubble: {
        width: width * 0.62,
        height: width * 0.62,
        maxWidth: 280,
        maxHeight: 280,
        borderRadius: 140,
        overflow: "hidden",

        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.2,
        shadowRadius: 18,

        elevation: 8,
    },

    mainBubbleGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 25,
    },

    mainBubbleIcon: {
        fontSize: 38,
        marginBottom: 8,
    },

    mainBubbleTitle: {
        fontSize: 24,
        fontWeight: "800",
        color: "#16445A",
        marginBottom: 7,
    },

    mainBubbleDescription: {
        fontSize: 14,
        color: "#426875",
        textAlign: "center",
    },

    // ==================================
    // 小泡泡
    // ==================================
    featureRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 14,
    },

    smallBubble: {
        flex: 1,
        height: 180,
        borderRadius: 40,
        overflow: "hidden",

        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.18,
        shadowRadius: 15,

        elevation: 7,
    },

    smallBubbleGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 15,
    },

    smallBubbleIcon: {
        fontSize: 30,
        marginBottom: 8,
    },

    smallBubbleTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#16445A",
        marginBottom: 7,
        textAlign: "center",
    },

    smallBubbleDescription: {
        fontSize: 12,
        lineHeight: 18,
        textAlign: "center",
        color: "#426875",
    },

    // ==================================
    // 按壓效果
    // ==================================
    pressed: {
        opacity: 0.75,
        transform: [{ scale: 0.97 }],
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
    // 公告 Modal
    // ==================================
    modalOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.65)",
    },

    modalContent: {
        height: "75%",
        backgroundColor: "#123A4E",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
    },

    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
    },

    modalHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    modalIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },

    modalTitle: {
        color: "#F0FFF9",
        fontSize: 18,
        fontWeight: "800",
    },

    modalSubtitle: {
        color: "#9AD8ED",
        fontSize: 11,
        marginTop: 2,
    },

    modalScroll: {
        flex: 1,
    },

    modalMessage: {
        color: "rgba(240,255,249,0.65)",
        fontSize: 14,
        lineHeight: 21,
        textAlign: "center",
        marginTop: 36,
        paddingHorizontal: 12,
    },

    schoolCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(236,255,248,0.22)",
        padding: 15,
        marginBottom: 12,
    },

    cardTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },

    schoolTag: {
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 7,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },

    schoolTagText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "800",
    },

    metaTimeText: {
        color: "#A9CEC3",
        fontSize: 11,
    },

    announcementTitle: {
        color: "#F0FFF9",
        fontSize: 16,
        fontWeight: "800",
        marginBottom: 6,
    },

    announcementContent: {
        color: "#DDEFE7",
        fontSize: 13,
        lineHeight: 19,
    },

    manageButton: {
        marginTop: 12,
        height: 48,
        borderRadius: 999,
        backgroundColor: "#F2C14E",
        alignItems: "center",
        justifyContent: "center",
    },

    manageButtonText: {
        color: "#16445A",
        fontSize: 15,
        fontWeight: "800",
    },

    // ==================================
    // 登出確認（覆蓋層）
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
        backgroundColor: "rgba(0,0,0,0.55)",
    },

    dialog: {
        backgroundColor: "#F0FFF9",
        borderRadius: 32,
        padding: 24,
    },

    dialogTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: "#16445A",
        marginBottom: 8,
    },

    dialogText: {
        fontSize: 14,
        lineHeight: 21,
        color: "#426875",
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
        backgroundColor: "rgba(22,68,90,0.10)",
    },
    
    dialogCancelText: {
        fontSize: 15,
        fontWeight: "800",
        color: "#16445A",
    },

    dialogConfirm: {
        backgroundColor: "#F2C14E",
    },

    dialogConfirmText: {
        fontSize: 15,
        fontWeight: "800",
        color: "#16445A",
    },
});