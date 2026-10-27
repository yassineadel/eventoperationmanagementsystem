// Guest list: search by name and mark present (FR-APP-22, FR-APP-23).
// Deliberately no way to add a person (FR-APP-24). Manual admissions are flagged MANUAL by the backend (FR-APP-25).
// FOR NOW this screen uses demo data (src/api/mock.ts): the backend has no guest list yet,
// so the banner below says clearly that nothing here is real or recorded.
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api, Guest } from '@/api';
import { useSession } from '@/lib/session';
import { colors, rejectLabels } from '@/lib/theme';

export default function GuestListScreen() {
  const { token, event } = useSession();
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (token && event) api.getGuestList(token, event.id).then(setGuests);
  }, [token, event]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (guests ?? []).filter((g) => g.attendeeName.toLowerCase().includes(q));
  }, [guests, query]);

  async function markPresent(g: Guest) {
    if (!token || !event) return;
    const res = await api.admitManually(token, event.id, g.ticketId, Crypto.randomUUID());
    if (res.result === 'ACCEPTED') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGuests((list) => list?.map((x) => (x.ticketId === g.ticketId ? { ...x, admitted: true } : x)) ?? null);
      setMessage(`Demo only: ${g.attendeeName} marked present (not recorded)`);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage(`${g.attendeeName}: ${rejectLabels[res.reason] ?? res.reason}`);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.demo}>
        <Text style={styles.demoTitle}>DEMO DATA</Text>
        <Text style={styles.demoText}>
          These are not the real guests of this event, and &quot;Mark present&quot; does not admit anyone or save anything.
          Scan the QR code to admit a guest.
        </Text>
      </View>
      <TextInput
        style={styles.search}
        placeholder="Search attendee name"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      {message && <Text style={styles.message}>{message}</Text>}
      {!guests && <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />}

      <FlatList
        data={filtered}
        keyExtractor={(g) => g.ticketId}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        ListEmptyComponent={guests ? <Text style={styles.empty}>No matching guests</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.attendeeName}</Text>
              <Text style={styles.meta}>{item.seat ? `Seat ${item.seat} · ${item.category}` : item.category}</Text>
            </View>
            {item.admitted ? (
              <Text style={styles.done}>Admitted</Text>
            ) : (
              <Pressable style={styles.admit} onPress={() => markPresent(item)}>
                <Text style={styles.admitText}>Mark present</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  demo: { backgroundColor: colors.warn, borderRadius: 12, padding: 14, marginBottom: 12 },
  demoTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  demoText: { color: '#fff', fontSize: 15, marginTop: 4 },
  search: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, color: colors.text, fontSize: 18, padding: 14, marginBottom: 12 },
  message: { color: colors.text, fontSize: 15, marginBottom: 12 },
  empty: { color: colors.muted, fontSize: 16, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 12 },
  name: { color: colors.text, fontSize: 18, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 14, marginTop: 2 },
  done: { color: colors.accept, fontSize: 15, fontWeight: '700' },
  admit: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  admitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
