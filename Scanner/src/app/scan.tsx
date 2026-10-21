// The core screen: camera scanning with a full-screen accept/reject result.
// Big colours and text so the result reads at a glance, one-handed, in the dark (FR-APP-10, NFR-25).
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ScanResponse } from '@/api';
import { useSession } from '@/lib/session';
import { colors, rejectLabels } from '@/lib/theme';

const RESULT_MS = 2500; // how long a result stays on screen before scanning resumes

export default function ScanScreen() {
  const { token, event } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [admitted, setAdmitted] = useState(0); // running count (FR-APP-18)
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token || !event) router.replace('/events');
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [token, event]);

  async function onScanned(code: string) {
    if (busy.current || !token || !event) return;
    busy.current = true;
    try {
      const res = await api.scan(token, { clientScanId: Crypto.randomUUID(), eventId: event.id, code });
      show(res);
    } catch {
      show({ result: 'REJECTED', reason: 'INVALID' });
    }
  }

  function show(res: ScanResponse) {
    setResult(res);
    if (res.result === 'ACCEPTED') {
      setAdmitted((n) => n + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    timer.current = setTimeout(dismiss, RESULT_MS);
  }

  function dismiss() {
    if (timer.current) clearTimeout(timer.current);
    setResult(null);
    busy.current = false;
  }

  if (!permission) return <View style={styles.fill} />;

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.permText}>Camera access is needed to scan tickets</Text>
        <Pressable style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={result ? undefined : ({ data }) => onScanned(data)}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.topLink}>‹ Events</Text>
          </Pressable>
          <Text style={styles.count}>{admitted} admitted</Text>
        </View>
        <Text style={styles.eventName} numberOfLines={1}>
          {event?.name}
        </Text>

        <View style={styles.frame} pointerEvents="none" />

        <Pressable style={styles.guestButton} onPress={() => router.push('/guest-list')}>
          <Text style={styles.guestButtonText}>Guest list</Text>
        </Pressable>
      </SafeAreaView>

      {result && <ResultOverlay result={result} seated={!!event?.seated} onDismiss={dismiss} />}
    </View>
  );
}

function ResultOverlay({ result, seated, onDismiss }: { result: ScanResponse; seated: boolean; onDismiss: () => void }) {
  const ok = result.result === 'ACCEPTED';
  return (
    <Pressable style={[StyleSheet.absoluteFill, styles.result, { backgroundColor: ok ? colors.accept : colors.reject }]} onPress={onDismiss}>
      <Text style={styles.resultIcon}>{ok ? '✓' : '✕'}</Text>
      <Text style={styles.resultTitle}>{ok ? 'ADMIT' : 'DENY'}</Text>
      {ok ? (
        <>
          <Text style={styles.resultName}>{result.attendeeName}</Text>
          <Text style={styles.resultDetail}>{seated && result.seat ? `Seat ${result.seat} · ${result.category}` : result.category}</Text>
        </>
      ) : (
        <Text style={styles.resultName}>{rejectLabels[result.reason] ?? result.reason}</Text>
      )}
      <Text style={styles.resultHint}>Tap to scan next</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  permText: { color: colors.text, fontSize: 18, textAlign: 'center', marginBottom: 16 },
  permButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 28 },
  permButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  overlay: { flex: 1, justifyContent: 'space-between', padding: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topLink: { color: '#fff', fontSize: 18, fontWeight: '600' },
  count: { color: '#fff', fontSize: 18, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, overflow: 'hidden' },
  eventName: { color: '#fff', fontSize: 16, marginTop: 8, textAlign: 'center' },
  frame: { alignSelf: 'center', width: 260, height: 260, borderWidth: 4, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 24 },
  guestButton: { backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 14, padding: 18, alignItems: 'center' },
  guestButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  result: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  resultIcon: { color: '#fff', fontSize: 120, fontWeight: '800', lineHeight: 130 },
  resultTitle: { color: '#fff', fontSize: 48, fontWeight: '800', letterSpacing: 2, marginBottom: 16 },
  resultName: { color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  resultDetail: { color: '#fff', fontSize: 22, marginTop: 8, textAlign: 'center' },
  resultHint: { color: 'rgba(255,255,255,0.8)', fontSize: 16, marginTop: 40 },
});
