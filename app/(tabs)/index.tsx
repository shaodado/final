import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../_layout";

const bubbles = [
  { label: "選課模組", subtitle: "", route: "/mood", position: "right" },
  { label: "課表與作業管理", subtitle: "", route: "/notes", position: "left" },
  {
    label: "學分進度管理",
    subtitle: "",
    route: "/courses",
    position: "center",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>A QUIET PLACE FOR YOU</Text>
          </View>

          <Pressable
            style={styles.logoutButton}
            onPress={signOut}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>登出</Text>
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={styles.introTitle}>今天想去哪裡？</Text>
          <Text style={styles.introCopy}>選一顆泡泡，進入你的專屬空間</Text>
        </View>

        <View style={styles.bubbleField}>
          {bubbles.map((bubble) => (
            <Pressable
              key={bubble.label}
              accessibilityRole="button"
              accessibilityLabel={`前往${bubble.label}`}
              onPress={() => router.push(bubble.route as never)}
              style={[
                styles.bubble,
                styles[
                  `bubble${bubble.position[0].toUpperCase()}${bubble.position.slice(1)}` as keyof typeof styles
                ] as object,
              ]}
            >
              <LinearGradient
                colors={["rgba(238,255,249,0.58)", "rgba(143,205,190,0.16)"]}
                style={styles.bubbleGradient}
              >
                <View style={styles.bubbleShine} />
                <Text
                  style={[
                    styles.bubbleLabel,
                    bubble.label.length > 4 && styles.bubbleLabelLong,
                  ]}
                >
                  {bubble.label}
                </Text>
                <Text style={styles.bubbleSubtitle}>{bubble.subtitle}</Text>
              </LinearGradient>
            </Pressable>
          ))}
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
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#9EF2BE",
  },
  statusText: { color: "#C5E7DC", fontSize: 11 },
  intro: { marginTop: 50, alignItems: "center" },
  introTitle: { color: "#F1FFF9", fontSize: 25, fontWeight: "700" },
  introCopy: { color: "#9EC3B8", fontSize: 13, marginTop: 8 },
  bubbleField: {
    flex: 1,
    minHeight: 470,
    justifyContent: "space-evenly",
    paddingVertical: 12,
  },
  bubble: {
    width: 150,
    height: 150,
    borderRadius: 100,
    shadowColor: "#020D0D",
    shadowOffset: { width: 7, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 15,
    elevation: 10,
  },
  bubbleRight: { alignSelf: "flex-end", marginRight: 8 },
  bubbleLeft: { alignSelf: "flex-start", marginLeft: 3 },
  bubbleCenter: { alignSelf: "center", marginLeft: 30 },
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
    width: 102,
    height: 40,
    top: 10,
    left: 22,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.28)",
    transform: [{ rotate: "-25deg" }],
  },
  bubbleLabel: {
    color: "#173F3B",
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 27,
    textAlign: "center",
    paddingHorizontal: 18,
  },
  bubbleLabelLong: { fontSize: 16, lineHeight: 22, paddingHorizontal: 16 },
  bubbleSubtitle: {
    color: "#35655D",
    fontSize: 11,
    marginTop: 5,
    textAlign: "center",
  },
  footerNote: {
    textAlign: "center",
    color: "#86AAA1",
    fontSize: 12,
    paddingBottom: 18,
  },
});
