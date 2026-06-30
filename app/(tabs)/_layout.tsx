import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { supabase } from "../../lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerPushToken() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push permission denied");
    return;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from("push_tokens")
      .upsert({ token, user_id: user?.id }, { onConflict: "token" });
    console.log("Push token saved:", token);
  } catch (e) {
    console.error("Push token error:", e);
  }
}

function TabIcon({ label }: { label: string }) {
  const { Text } = require("react-native");
  return <Text style={{ fontSize: 20 }}>{label}</Text>;
}

export default function TabLayout() {
  useEffect(() => {
    registerPushToken();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1a1a1a",
        tabBarInactiveTintColor: "#aaa",
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#e0e0e0" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Jobs", tabBarIcon: () => <TabIcon label="💼" /> }}
      />
      <Tabs.Screen
        name="certifications"
        options={{
          title: "Certifications",
          tabBarIcon: () => <TabIcon label="📋" />,
        }}
      />
    </Tabs>
  );
}
