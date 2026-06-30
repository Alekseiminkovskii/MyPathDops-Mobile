import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const EMAIL_KEY = "saved_email";
const REMEMBER_KEY = "remember_email";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    async function loadSaved() {
      const remember = await AsyncStorage.getItem(REMEMBER_KEY);
      if (remember === "true") {
        const saved = await AsyncStorage.getItem(EMAIL_KEY);
        if (saved) {
          setEmail(saved);
          setRememberEmail(true);
        }
      }
    }
    loadSaved();
  }, []);

  async function handleSignIn() {
    if (!email || !password) return;
    setLoading(true);

    if (rememberEmail) {
      await AsyncStorage.setItem(EMAIL_KEY, email);
      await AsyncStorage.setItem(REMEMBER_KEY, "true");
    } else {
      await AsyncStorage.removeItem(EMAIL_KEY);
      await AsyncStorage.setItem(REMEMBER_KEY, "false");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      router.replace("/(tabs)" as any);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>MyPathDops</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#aaa"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#aaa"
        />

        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRememberEmail((r) => !r)}
          activeOpacity={0.7}
        >
          <View
            style={[styles.checkbox, rememberEmail && styles.checkboxChecked]}
          >
            {rememberEmail && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>Remember email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Signing in..." : "Sign in"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 24, fontWeight: "600", color: "#1a1a1a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#888", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: "#1a1a1a",
    marginBottom: 12,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxChecked: { backgroundColor: "#1a1a1a", borderColor: "#1a1a1a" },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  rememberText: { fontSize: 14, color: "#555" },
  button: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
