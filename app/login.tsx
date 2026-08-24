import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from './_layout';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const login = () => {
    if (account.trim() === 'adm' && password === '123') {
      signIn();
      return;
    }
    Alert.alert('登入失敗', '帳號或密碼不正確，請再試一次。');
  };

  return <View style={styles.page}>
    <View style={[styles.glow, styles.glowTop]} /><View style={[styles.glow, styles.glowBottom]} />
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.hero}><View style={styles.logo}><Ionicons name="school-outline" size={33} color="#16445A" /></View><Text style={styles.kicker}>STUDENT SPACE</Text><Text style={styles.title}>歡迎回來</Text><Text style={styles.copy}>登入後，繼續安排你的學習生活。</Text></View>
        <LinearGradient colors={['rgba(239,255,249,0.28)', 'rgba(172,224,208,0.1)']} style={styles.card}>
          <Text style={styles.cardTitle}>登入帳號</Text>
          <Text style={styles.label}>帳號</Text>
          <View style={styles.inputWrap}><Ionicons name="person-outline" size={19} color="#A9CEC3" /><TextInput value={account} onChangeText={setAccount} autoCapitalize="none" autoCorrect={false} placeholder="請輸入帳號" placeholderTextColor="#7BA79C" style={styles.input} returnKeyType="next" /></View>
          <Text style={styles.label}>密碼</Text>
          <View style={styles.inputWrap}><Ionicons name="lock-closed-outline" size={18} color="#A9CEC3" /><TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder="請輸入密碼" placeholderTextColor="#7BA79C" style={styles.input} returnKeyType="done" onSubmitEditing={login} /><Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#A9CEC3" /></Pressable></View>
          <Pressable style={styles.loginButton} onPress={login} accessibilityRole="button"><Text style={styles.loginText}>登入</Text><Ionicons name="arrow-forward" size={19} color="#16445A" /></Pressable>
          <Text style={styles.hint}>預設帳號：adm　密碼：123</Text>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#16445A' }, safeArea: { flex: 1, paddingHorizontal: 24 }, keyboard: { flex: 1, justifyContent: 'center' }, glow: { position: 'absolute', borderRadius: 999, opacity: 0.48 }, glowTop: { width: 260, height: 260, top: -120, right: -80, backgroundColor: '#F28C8C' }, glowBottom: { width: 300, height: 300, bottom: -110, left: -160, backgroundColor: '#F2C14E' }, hero: { alignItems: 'center', marginBottom: 34 }, logo: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDF8ED', marginBottom: 20 }, kicker: { color: '#B4D8D2', fontSize: 11, letterSpacing: 1.7, fontWeight: '700' }, title: { color: '#F0FFF9', fontSize: 34, fontWeight: '800', marginTop: 9 }, copy: { color: '#C3E0D8', fontSize: 14, marginTop: 9 }, card: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(236,255,248,0.35)', padding: 20, overflow: 'hidden' }, cardTitle: { color: '#F0FFF9', fontSize: 19, fontWeight: '800', marginBottom: 20 }, label: { color: '#C3E0D8', fontSize: 12, fontWeight: '700', marginBottom: 8 }, inputWrap: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 14, gap: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(236,255,248,0.28)', backgroundColor: 'rgba(8,47,61,0.38)', marginBottom: 16 }, input: { flex: 1, color: '#F0FFF9', fontSize: 15, height: '100%' }, loginButton: { marginTop: 4, minHeight: 52, borderRadius: 14, backgroundColor: '#F2C14E', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 }, loginText: { color: '#16445A', fontSize: 15, fontWeight: '800' }, hint: { color: '#A9CEC3', fontSize: 11, textAlign: 'center', marginTop: 16 },
});
