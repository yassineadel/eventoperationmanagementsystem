import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

// Keep the splash screen up until we know whether someone is logged in, so the login screen doesn't flash
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <SplashScreenController />
      <StatusBar style="light" />
      <RootNavigator />
    </SessionProvider>
  );
}

function SplashScreenController() {
  const { isLoading } = useSession();
  useEffect(() => {
    if (!isLoading) SplashScreen.hide();
  }, [isLoading]);
  return null;
}

// Stack.Protected hides screens whose guard is false. When the app signs out (token becomes null),
// the router leaves the protected screens on its own and shows the login screen.
function RootNavigator() {
  const { token } = useSession();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="events" options={{ title: 'Your events', headerBackVisible: false }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
        <Stack.Screen name="guest-list" options={{ title: 'Guest list (demo)' }} />
      </Stack.Protected>
    </Stack>
  );
}
