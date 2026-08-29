import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "./_layout";

export default function TeacherScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TEACHER PORTAL</Text>
            <Text style={styles.title}>老師專區</Text>
          </View>

          <Pressable
            style={styles.logoutButton}
            onPress={signOut}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>登出</Text>
          </Pressable>
        </View>

        <View style={styles.centeredArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="進入課程專區"
            onPress={() => router.push("/teacher-courses" as never)}
            style={styles.bubble}
          >
            <LinearGradient
              colors={["rgba(238,255,249,0.58)", "rgba(143,205,190,0.16)"]}
              style={styles.bubbleGradient}
            >
              <View style={styles.bubbleShine} />
              <Text style={styles.bubbleLabel}>課程專區</Text>
            </LinearGradient>
          </Pressable>
        </View>
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
  eyebrow: {
    color: "#8FB8AE",
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "700",
  },
  title: { color: "#F0FFF9", fontSize: 28, fontWeight: "700", marginTop: 8 },
  logoutButton: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  logoutText: { color: "#F0FFF9", fontSize: 12, fontWeight: "700" },
  centeredArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubble: {
    width: 180,
    height: 180,
    borderRadius: 100,
    shadowColor: "#020D0D",
    shadowOffset: { width: 7, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 15,
    elevation: 10,
  },
  bubbleGradient: {
    flex: 1,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(224,255,245,0.68)",
    overflow: "hidden",
  },
  bubbleShine: {
    position: "absolute",
    width: 120,
    height: 42,
    top: 12,
    left: 22,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.28)",
    transform: [{ rotate: "-25deg" }],
  },
  bubbleLabel: {
    color: "#173F3B",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
