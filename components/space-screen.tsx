import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function SpaceScreen({
  title,
  subtitle,
  tint,
  children,
}: {
  title: string;
  subtitle: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.base} />
      <View style={[styles.tint, { backgroundColor: tint }]} />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回大廳"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>大廳</Text>
        </Pressable>
        <Text style={styles.kicker}>MY SPACE</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#172b49' },
  base: { ...StyleSheet.absoluteFillObject, backgroundColor: '#172b49' },
  tint: { position: 'absolute', top: '38%', left: -90, right: -90, bottom: -100, borderRadius: 240, opacity: 0.84 },
  header: { paddingTop: 58, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 5 },
  pressed: { opacity: 0.6 },
  backArrow: { color: '#fffaf3', fontSize: 35, lineHeight: 30, fontWeight: '300' },
  backText: { color: '#fffaf3', fontSize: 15, fontWeight: '600' },
  kicker: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  body: { flex: 1, paddingHorizontal: 28, paddingTop: 48 },
  title: { color: '#fffaf3', fontSize: 38, fontWeight: '700' },
  subtitle: { marginTop: 10, color: 'rgba(255,250,243,0.72)', fontSize: 16 },
});
