import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../_layout";

type BubblePosition = "right" | "left" | "center";

type Bubble = {
  label: string;
  subtitle: string;
  route: string;
  position: BubblePosition;
};

const bubbles: Bubble[] = [
  {
    label: "選課模組",
    subtitle: "探索適合你的課程",
    route: "/mood",
    position: "right",
  },
  {
    label: "課表與作業管理",
    subtitle: "掌握課程與作業進度",
    route: "/notes",
    position: "left",
  },
  {
    label: "學分進度管理",
    subtitle: "查看畢業學分進度",
    route: "/courses",
    position: "center",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, userName } = useAuth();

  const handleLogout = (): void => {
    signOut();
  };

  const handleBubblePress = (route: string): void => {
    router.push(route as never);
  };

  return (
    <View style={styles.page}>
      {/* 背景光暈 */}
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        {/* 頁首 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>A QUIET PLACE FOR YOU</Text>
            <Text style={styles.headerTitle}>
              {userName ? `${userName}的空間` : "我的空間"}
            </Text>
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

        {/* 頁面介紹 */}
        <View style={styles.intro}>
          <Text style={styles.introTitle}>今天想去哪裡？</Text>

          <Text style={styles.introCopy}>選一顆泡泡，進入你的專屬空間</Text>
        </View>

        {/* 功能泡泡 */}
        <View style={styles.bubbleField}>
          {bubbles.map((bubble) => (
            <BubbleButton
              key={bubble.label}
              bubble={bubble}
              onPress={() => handleBubblePress(bubble.route)}
            />
          ))}
        </View>

        {/* 底部提示 */}
        <Text style={styles.footerNote}>
          每一次選擇，都讓你的校園生活更有方向
        </Text>
      </SafeAreaView>
    </View>
  );
}

type BubbleButtonProps = {
  bubble: Bubble;
  onPress: () => void;
};

function BubbleButton({ bubble, onPress }: BubbleButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`前往${bubble.label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bubble,
        getBubblePositionStyle(bubble.position),
        pressed && styles.bubblePressed,
      ]}
    >
      <LinearGradient
        colors={[
          "rgba(245,255,252,0.72)",
          "rgba(166,221,207,0.25)",
          "rgba(117,181,169,0.10)",
        ]}
        locations={[0, 0.55, 1]}
        style={styles.bubbleGradient}
      >
        {/* 泡泡高光 */}
        <View style={styles.bubbleShine} />

        {/* 泡泡內部裝飾 */}
        <View style={styles.bubbleGlow} />

        {/* 文字 */}
        <Text
          style={[
            styles.bubbleLabel,
            bubble.label.length > 6 && styles.bubbleLabelLong,
          ]}
        >
          {bubble.label}
        </Text>

        <Text style={styles.bubbleSubtitle}>{bubble.subtitle}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function getBubblePositionStyle(position: BubblePosition) {
  switch (position) {
    case "right":
      return styles.bubbleRight;

    case "left":
      return styles.bubbleLeft;

    case "center":
      return styles.bubbleCenter;
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#16445A",
  },

  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },

  /* =========================
     背景光暈
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
    opacity: 0.42,
  },

  glowBottom: {
    width: 320,
    height: 320,
    bottom: -135,
    left: -175,
    backgroundColor: "#F2C14E",
    opacity: 0.32,
  },

  /* =========================
     頁首
     ========================= */

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 22,
  },

  eyebrow: {
    color: "#8FB8AE",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
  },

  headerTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 5,
  },

  logoutButton: {
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  logoutButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },

  logoutText: {
    color: "#F0FFF9",
    fontSize: 12,
    fontWeight: "700",
  },

  /* =========================
     介紹文字
     ========================= */

  intro: {
    alignItems: "center",
    marginTop: 48,
  },

  introTitle: {
    color: "#F1FFF9",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  introCopy: {
    color: "#9EC3B8",
    fontSize: 13,
    marginTop: 9,
  },

  /* =========================
     泡泡區域
     ========================= */

  bubbleField: {
    flex: 1,
    minHeight: 460,
    justifyContent: "space-evenly",
    paddingVertical: 18,
  },

  bubble: {
    width: 154,
    height: 154,
    borderRadius: 100,

    shadowColor: "#020D0D",
    shadowOffset: {
      width: 6,
      height: 9,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,

    elevation: 10,
  },

  bubblePressed: {
    transform: [
      {
        scale: 0.94,
      },
    ],
    opacity: 0.9,
  },

  bubbleRight: {
    alignSelf: "flex-end",
    marginRight: 4,
  },

  bubbleLeft: {
    alignSelf: "flex-start",
    marginLeft: 0,
  },

  bubbleCenter: {
    alignSelf: "center",
    marginLeft: 28,
  },

  bubbleGradient: {
    flex: 1,
    borderRadius: 100,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1.5,
    borderColor: "rgba(224,255,245,0.72)",

    overflow: "hidden",
  },

  /* =========================
     泡泡高光
     ========================= */

  bubbleShine: {
    position: "absolute",

    width: 105,
    height: 43,

    top: 10,
    left: 23,

    borderRadius: 100,

    backgroundColor: "rgba(255,255,255,0.30)",

    transform: [
      {
        rotate: "-25deg",
      },
    ],
  },

  bubbleGlow: {
    position: "absolute",

    width: 75,
    height: 75,

    right: -20,
    bottom: -18,

    borderRadius: 999,

    backgroundColor: "rgba(255,255,255,0.08)",
  },

  /* =========================
     泡泡文字
     ========================= */

  bubbleLabel: {
    color: "#173F3B",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 27,
    textAlign: "center",
    paddingHorizontal: 18,
  },

  bubbleLabelLong: {
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 17,
  },

  bubbleSubtitle: {
    color: "#8dbaed",
    fontSize: 10.5,
    lineHeight: 16,
    marginTop: 7,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  /* =========================
     底部文字
     ========================= */

  footerNote: {
    textAlign: "center",
    color: "#86AAA1",
    fontSize: 11,
    paddingBottom: 17,
  },
});
