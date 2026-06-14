import { useAuth } from "@/utils/auth/useAuth";
import { Slot } from "expo-router";
import * as ExpoSplash from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View } from "react-native";
import TxSplash from "./splash";

ExpoSplash.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const { initiate, isReady } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const seeded = useRef(false);

  useEffect(() => {
    initiate();
  }, [initiate]);

  useEffect(() => {
    if (isReady) {
      ExpoSplash.hideAsync();
      if (!seeded.current) {
        seeded.current = true;
        fetch("/api/auth/seed-demo", { method: "POST" }).catch(() => {});
      }
    }
  }, [isReady]);

  if (!isReady) {
    return (
      <View style={{ flex: 1 }}>
        <TxSplash onComplete={() => {}} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Slot />
          {showSplash && <TxSplash onComplete={() => setShowSplash(false)} />}
        </View>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
