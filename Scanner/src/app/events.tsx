// Event picker: only events this staff member is assigned to (FR-APP-03).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { api, GateEvent } from '@/api';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function EventsScreen() {
  const { token, staff, selectEvent, signOut } = useSession();
  const [events, setEvents] = useState<GateEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace('/');
      return;
    }
    api.getAssignedEvents(token).then(setEvents).catch((e) => setError(String(e?.message ?? e)));
  }, [token]);

  function open(event: GateEvent) {
    selectEvent(event);
    router.push('/scan');
  }

  async function logout() {
    await signOut();
    router.replace('/');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hello}>Signed in as {staff?.fullName}</Text>

      {!events && !error && <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {events?.length === 0 && <Text style={styles.empty}>You are not assigned to any events.</Text>}

      <FlatList
        data={events ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => open(item)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.venueName}</Text>
            <Text style={styles.meta}>{new Date(item.startAt).toLocaleString()}</Text>
          </Pressable>
        )}
      />

      <Pressable onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  hello: { color: colors.muted, fontSize: 15, marginBottom: 16 },
  error: { color: colors.reject, fontSize: 16 },
  empty: { color: colors.muted, fontSize: 16, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 18 },
  name: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  meta: { color: colors.muted, fontSize: 15 },
  logout: { padding: 16, alignItems: 'center' },
  logoutText: { color: colors.muted, fontSize: 16 },
});
