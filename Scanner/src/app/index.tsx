// Login screen. Staff accounts are created by the app administrator; there is no sign-up (FR-APP-01).
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '@/api';
import { getDeviceId, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const { token, staff } = await api.login(username, password, deviceId);
      await signIn(token, staff);
      router.replace('/events');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.box}>
        <Text style={styles.title}>Hafletna Gate</Text>
        <Text style={styles.subtitle}>Staff sign in</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onLogin}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, loading && { opacity: 0.6 }]} onPress={onLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  box: { paddingHorizontal: 24 },
  title: { color: colors.text, fontSize: 32, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 16, marginBottom: 32, marginTop: 4 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontSize: 18,
    padding: 16,
    marginBottom: 12,
  },
  error: { color: colors.reject, fontSize: 15, marginBottom: 12 },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
