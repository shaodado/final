import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "./_layout";

export default function TeacherScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  /**
   * 登出
   */
  const handleLogout = (): void => {
    signOut();
  };

  /**
   * 進入課程專區
   */
  const handleCoursePress = (): void => {
    router.push("/teacher-courses" as never);
  };

  return (
    <View style={styles.page}>
      {/* 背景光暈 */}
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        {/* =========================
            Header
           ========================= */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TEACHER PORTAL</Text>

            <Text style={styles.title}>老師專區</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="登出"
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutButtonPressed,
            ]}
          >
            <Text style={styles.logoutText}>登出</Text>
          </Pressable>
        </View>

        {/* =========================
            Welcome
           ========================= */}
        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>
            歡迎回到老師專區
          </Text>

          <Text style={styles.welcomeDescription}>
            選擇課程，管理課程資訊與相關事項
          </Text>
        </View>

        {/* =========================
            Course Entry
           ========================= */}
        <View style={styles.mainArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="進入課程專區"
            onPress={handleCoursePress}
            style={({ pressed }) => [
              styles.bubble,
              pressed && styles.bubblePressed,
            ]}
          >
            <LinearGradient
              colors={[
                "rgba(250,255,253,0.78)",
                "rgba(178,225,212,0.30)",
                "rgba(120,185,173,0.10)",
              ]}
              locations={[0, 0.52, 1]}
              style={styles.bubbleGradient}
            >
              {/* 泡泡高光 */}
              <View style={styles.bubbleShine} />

              {/* 泡泡光暈 */}
              <View style={styles.bubbleGlow} />

              {/* 泡泡內容 */}
              <View style={styles.bubbleContent}>
                <Text style={styles.bubbleSmallText}>
                  COURSE
                </Text>

                <Text style={styles.bubbleTitle}>
                  課程專區
                </Text>

                <Text style={styles.bubbleDescription}>
                  查看與管理課程
                </Text>
              </View>
            </LinearGradient>
          </Pressable>

          {/* 功能說明 */}
          <View style={styles.featureBox}>
            <Text style={styles.featureTitle}>
              課程專區
            </Text>

            <Text style={styles.featureDescription}>
              課程資訊　・　指派助教　・　發布公告
            </Text>
          </View>
        </View>

        {/* =========================
            Footer
           ========================= */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />

          <Text style={styles.footerText}>
            TEACHER COURSE MANAGEMENT
          </Text>
        </View>
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
  },

  glowTop: {
    width: 280,
    height: 280,
    top: -135,
    right: -90,
    backgroundColor: "#F28C8C",
    opacity: 0.34,
  },

  glowBottom: {
    width: 320,
    height: 320,
    bottom: -145,
    left: -175,
    backgroundColor: "#F2C14E",
    opacity: 0.25,
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

  eyebrow: {
    color: "#8FB8AE",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.8,
  },

  title: {
    color: "#F0FFF9",
    fontSize: 27,
    fontWeight: "700",
    marginTop: 5,
  },

  logoutButton: {
    minWidth: 58,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 15,
    paddingVertical: 9,

    borderRadius: 999,

    backgroundColor: "rgba(255,255,255,0.09)",

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  logoutButtonPressed: {
    opacity: 0.65,

    transform: [
      {
        scale: 0.95,
      },
    ],
  },

  logoutText: {
    color: "#F0FFF9",
    fontSize: 12,
    fontWeight: "700",
  },

  /* =========================
     Welcome
     ========================= */

  welcome: {
    alignItems: "center",
    marginTop: 55,
  },

  welcomeTitle: {
    color: "#F1FFF9",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },

  welcomeDescription: {
    color: "#9EC3B8",
    fontSize: 12,
    marginTop: 9,
    textAlign: "center",
  },

  /* =========================
     Main Area
     ========================= */

  mainArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* =========================
     Bubble
     ========================= */

  bubble: {
    width: 205,
    height: 205,

    borderRadius: 105,

    shadowColor: "#020D0D",

    shadowOffset: {
      width: 8,
      height: 12,
    },

    shadowOpacity: 0.32,
    shadowRadius: 20,

    elevation: 12,
  },

  bubblePressed: {
    opacity: 0.9,

    transform: [
      {
        scale: 0.94,
      },
    ],
  },

  bubbleGradient: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 105,

    borderWidth: 1.5,
    borderColor: "rgba(229,255,247,0.76)",

    overflow: "hidden",
  },

  bubbleShine: {
    position: "absolute",

    width: 135,
    height: 46,

    top: 12,
    left: 30,

    borderRadius: 100,

    backgroundColor: "rgba(255,255,255,0.32)",

    transform: [
      {
        rotate: "-25deg",
      },
    ],
  },

  bubbleGlow: {
    position: "absolute",

    width: 105,
    height: 105,

    right: -35,
    bottom: -35,

    borderRadius: 999,

    backgroundColor: "rgba(255,255,255,0.10)",
  },

  bubbleContent: {
    alignItems: "center",
  },

  bubbleSmallText: {
    color: "#4B756D",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 6,
  },

  bubbleTitle: {
    color: "#173F3B",
    fontSize: 25,
    fontWeight: "800",
  },

  bubbleDescription: {
    color: "#35655D",
    fontSize: 11,
    marginTop: 8,
  },

  /* =========================
     Feature Box
     ========================= */

  featureBox: {
    alignItems: "center",

    marginTop: 34,

    paddingHorizontal: 20,
    paddingVertical: 13,

    borderRadius: 18,

    backgroundColor: "rgba(255,255,255,0.07)",

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  featureTitle: {
    color: "#C5E7DC",
    fontSize: 12,
    fontWeight: "700",
  },

  featureDescription: {
    color: "#86AAA1",
    fontSize: 10,
    marginTop: 6,
    textAlign: "center",
  },

  /* =========================
     Footer
     ========================= */

  footer: {
    alignItems: "center",
    paddingBottom: 17,
  },

  footerLine: {
    width: 38,
    height: 1,

    backgroundColor: "rgba(180,216,210,0.25)",

    marginBottom: 9,
  },

  footerText: {
    color: "#668F87",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
});
