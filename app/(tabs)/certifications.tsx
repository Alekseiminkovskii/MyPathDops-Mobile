import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ImageZoomModal } from "../../components/ImageZoomModal";
import { useRole } from "../../lib/useRole";
import { supabase } from "../../lib/supabase";

// ─── constants ────────────────────────────────────────────────────────────────

const CERT_TYPES = [
  // Tower & climbing
  "Competent Climber (NWSA)",
  "Tower Crew Lead (NWSA)",
  "Tower Site Manager (NWSA)",
  "Tower Rescue / Competent Rescuer",
  "Fall Protection Competent Person",
  // RF & telecom
  "RF Safety / EME Awareness",
  "Antenna Installation",
  "Fiber Optic Technician",
  "Telecommunications Technician",
  // OSHA & safety
  "OSHA 10-Hour",
  "OSHA 30-Hour",
  "Electrical Safety (NFPA 70E)",
  "Confined Space Entry",
  "Excavation & Trenching Safety",
  "Hazard Communication (HazCom)",
  "HAZWOPER 40-Hour",
  "Fire Extinguisher / Fire Safety",
  // Equipment
  "Aerial Lift / Boom Lift Operator",
  "Scissor Lift Operator",
  "Forklift Operator",
  "Rigging & Signaling",
  // Medical / emergency
  "First Aid / CPR / AED",
  "DOT Physical / Medical Card",
  // Driving & aviation
  "CDL (Commercial Driver's License)",
  "FAA Part 107 Drone Pilot",
  // Other
  "Other",
];

const EMPTY_FORM = {
  name: "",
  cert_type: CERT_TYPES[0],
  issued_at: "",
  expires_at: "",
};

// ─── types ────────────────────────────────────────────────────────────────────

type Cert = {
  id: string;
  name: string;
  cert_type: string;
  issued_at: string;
  expires_at: string;
  scan_url: string | null;
};

type TechProfile = {
  id: string;
  email: string;
  full_name: string | null;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function getStatus(expiresAt: string): "valid" | "expiring" | "expired" {
  const days = Math.floor(
    (new Date(expiresAt).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}

const COLOR = { valid: "#22c55e", expiring: "#f59e0b", expired: "#ef4444" };
const LABEL = { valid: "Valid", expiring: "Expiring Soon", expired: "Expired" };

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ─── main screen ──────────────────────────────────────────────────────────────

export default function CertificationsScreen() {
  const { role, userId, loading: roleLoading } = useRole();

  const isTech = role === "tech";
  const isManager = role === "pm" || role === "safety_manager";

  // ── tech personal-list state ────────────────────────────────────────────────
  const [certs, setCerts] = useState<Cert[]>([]);
  const [certsLoading, setCertsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [scanUri, setScanUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  // ── PM / SM roster state ────────────────────────────────────────────────────
  const [techs, setTechs] = useState<TechProfile[]>([]);
  const [techsLoading, setTechsLoading] = useState(true);
  const [techsRefreshing, setTechsRefreshing] = useState(false);

  // ── fetch personal certs (tech only) ───────────────────────────────────────
  const fetchCerts = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("certifications")
      .select("*")
      .eq("user_id", userId)
      .order("expires_at", { ascending: true });
    if (error) Alert.alert("Error", error.message);
    else setCerts(data || []);
    setCertsLoading(false);
    setRefreshing(false);
  }, [userId]);

  // ── fetch tech roster (PM / SM only) ───────────────────────────────────────
  const fetchTechs = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "tech")
      .order("email");
    if (error) Alert.alert("Error", error.message);
    else setTechs((data as TechProfile[]) || []);
    setTechsLoading(false);
    setTechsRefreshing(false);
  }, []);

  useEffect(() => {
    if (isTech && userId) fetchCerts();
    else if (isManager) fetchTechs();
  }, [isTech, isManager, userId, fetchCerts, fetchTechs]);

  // ── add cert handlers ───────────────────────────────────────────────────────
  function openForm() {
    setForm(EMPTY_FORM);
    setScanUri(null);
    setShowForm(true);
  }

  async function pickScan() {
    Alert.alert("Add Scan", "Choose source", [
      {
        text: "Camera",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission needed", "Camera access is required.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!result.canceled) setScanUri(result.assets[0].uri);
        },
      },
      {
        text: "Gallery",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          if (!result.canceled) setScanUri(result.assets[0].uri);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleAdd() {
    if (!form.name.trim()) {
      Alert.alert("Required", "Name is required.");
      return;
    }
    if (!form.expires_at) {
      Alert.alert("Required", "Expiry date is required (YYYY-MM-DD).");
      return;
    }
    setSaving(true);
    try {
      let scan_url: string | null = null;
      if (scanUri) {
        const filename = `${Date.now()}.jpg`;
        const base64 = await FileSystem.readAsStringAsync(scanUri, {
          encoding: "base64" as any,
        });
        const { error: uploadErr } = await supabase.storage
          .from("cert-scans")
          .upload(filename, decode(base64), { contentType: "image/jpeg" });
        if (uploadErr) throw uploadErr;
        const {
          data: { publicUrl },
        } = supabase.storage.from("cert-scans").getPublicUrl(filename);
        scan_url = publicUrl;
      }
      const { error } = await supabase.from("certifications").insert([
        {
          name: form.name.trim(),
          cert_type: form.cert_type,
          issued_at: form.issued_at || null,
          expires_at: form.expires_at,
          scan_url,
          user_id: userId,
        },
      ]);
      if (error) throw error;
      setShowForm(false);
      fetchCerts();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save certification.");
    }
    setSaving(false);
  }

  // ── loading state ───────────────────────────────────────────────────────────
  if (roleLoading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  // ── PM / SM: tech roster ────────────────────────────────────────────────────
  if (isManager) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Team Certifications</Text>
            <Text style={s.count}>{techs.length} technicians</Text>
          </View>
        </View>
        {techsLoading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color="#1a1a1a" />
          </View>
        ) : (
          <FlatList
            data={techs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            refreshControl={
              <RefreshControl
                refreshing={techsRefreshing}
                onRefresh={() => { setTechsRefreshing(true); fetchTechs(); }}
              />
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyText}>No technicians found</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.techCard}
                onPress={() => router.push(`/certifications/${item.id}`)}
              >
                <View style={s.techAvatar}>
                  <Text style={s.techAvatarText}>
                    {(item.full_name ?? item.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={s.techBody}>
                  <Text style={s.techName}>{item.full_name ?? item.email}</Text>
                  {item.full_name && (
                    <Text style={s.techEmail}>{item.email}</Text>
                  )}
                </View>
                <Text style={s.techArrow}>›</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ── tech: personal cert list ────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>My Certifications</Text>
          <Text style={s.count}>{certs.length} total</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openForm}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {certsLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#1a1a1a" />
        </View>
      ) : (
        <FlatList
          data={certs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCerts(); }} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>No certifications yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = getStatus(item.expires_at);
            const color = COLOR[status];
            return (
              <View style={s.card}>
                <View style={[s.bar, { backgroundColor: color }]} />
                {item.scan_url ? (
                  <TouchableOpacity onPress={() => setZoomUri(item.scan_url!)}>
                    <Image source={{ uri: item.scan_url }} style={s.thumb} resizeMode="cover" />
                  </TouchableOpacity>
                ) : (
                  <View style={s.thumbPlaceholder}>
                    <Text style={s.thumbIcon}>📄</Text>
                  </View>
                )}
                <View style={s.body}>
                  <View style={s.row}>
                    <Text style={s.name}>{item.name}</Text>
                    <View style={[s.badge, { backgroundColor: color + "22" }]}>
                      <Text style={[s.badgeText, { color }]}>{LABEL[status]}</Text>
                    </View>
                  </View>
                  <Text style={s.type}>{item.cert_type}</Text>
                  <View style={s.dates}>
                    <Text style={s.date}>Issued: {fmt(item.issued_at)}</Text>
                    <Text style={s.date}>Expires: {fmt(item.expires_at)}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {zoomUri && (
        <ImageZoomModal uri={zoomUri} onClose={() => setZoomUri(null)} />
      )}

      {/* Add form */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.modalBackdrop}>
            <View style={s.formCard}>
              <View style={s.formHeader}>
                <Text style={s.formTitle}>Add Certification</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Text style={s.formClose}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.label}>Full name *</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. John Smith"
                  value={form.name}
                  onChangeText={(v) => setForm({ ...form, name: v })}
                  autoCapitalize="words"
                />

                <Text style={s.label}>Certification type *</Text>
                <TouchableOpacity
                  style={s.pickerRow}
                  onPress={() => setShowTypePicker(!showTypePicker)}
                >
                  <Text style={s.pickerText}>{form.cert_type}</Text>
                  <Text style={s.pickerArrow}>{showTypePicker ? "▲" : "▼"}</Text>
                </TouchableOpacity>
                {showTypePicker && (
                  <View style={s.inlineList}>
                    {CERT_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[s.typeRow, form.cert_type === t && s.typeRowSelected]}
                        onPress={() => { setForm({ ...form, cert_type: t }); setShowTypePicker(false); }}
                      >
                        <Text style={[s.typeText, form.cert_type === t && s.typeTextSelected]}>{t}</Text>
                        {form.cert_type === t && <Text style={s.typeCheck}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={s.label}>Issued date</Text>
                <TextInput
                  style={s.input}
                  placeholder="YYYY-MM-DD"
                  value={form.issued_at}
                  onChangeText={(v) => setForm({ ...form, issued_at: v })}
                  keyboardType="numbers-and-punctuation"
                />

                <Text style={s.label}>Expiry date *</Text>
                <TextInput
                  style={s.input}
                  placeholder="YYYY-MM-DD"
                  value={form.expires_at}
                  onChangeText={(v) => setForm({ ...form, expires_at: v })}
                  keyboardType="numbers-and-punctuation"
                />

                <Text style={s.label}>Certificate scan (optional)</Text>
                <TouchableOpacity style={s.scanBtn} onPress={pickScan}>
                  {scanUri ? (
                    <Image source={{ uri: scanUri }} style={s.scanPreview} resizeMode="cover" />
                  ) : (
                    <Text style={s.scanBtnText}>📷 Take photo or pick from gallery</Text>
                  )}
                </TouchableOpacity>
                {scanUri && (
                  <TouchableOpacity onPress={() => setScanUri(null)}>
                    <Text style={s.removeScan}>Remove scan</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[s.saveBtn, saving && s.saveBtnDisabled]}
                  onPress={handleAdd}
                  disabled={saving}
                >
                  <Text style={s.saveBtnText}>{saving ? "Saving..." : "Save Certification"}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#fff",
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#1a1a1a" },
  count: { fontSize: 13, color: "#888", marginTop: 2 },
  addBtn: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  list: { padding: 16, gap: 12 },

  // cert card
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    flexDirection: "row",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  bar: { width: 5 },
  thumb: { width: 52, height: 52, alignSelf: "center", borderRadius: 6, marginLeft: 6 },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    alignSelf: "center",
    marginLeft: 6,
    borderRadius: 6,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbIcon: { fontSize: 22 },
  body: { flex: 1, padding: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  name: { fontSize: 16, fontWeight: "600", color: "#1a1a1a", flex: 1, marginRight: 8 },
  type: { fontSize: 13, color: "#666", marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  dates: { flexDirection: "row", gap: 12 },
  date: { fontSize: 12, color: "#888" },
  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { color: "#aaa", fontSize: 16 },

  // tech roster
  techCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  techAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  techAvatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  techBody: { flex: 1 },
  techName: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  techEmail: { fontSize: 12, color: "#888", marginTop: 2 },
  techArrow: { fontSize: 22, color: "#ccc" },

  // modal / form
  modalWrap: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  formCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "90%",
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  formTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  formClose: { fontSize: 26, color: "#aaa", lineHeight: 28 },
  label: { fontSize: 12, color: "#888", fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1a1a1a",
  },
  pickerRow: {
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerText: { fontSize: 15, color: "#1a1a1a" },
  pickerArrow: { fontSize: 16, color: "#aaa" },
  inlineList: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  typeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  typeRowSelected: { backgroundColor: "#f0fdf4" },
  typeText: { fontSize: 14, color: "#1a1a1a" },
  typeTextSelected: { fontWeight: "600", color: "#16a34a" },
  typeCheck: { fontSize: 15, color: "#16a34a" },
  scanBtn: {
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
    padding: 16,
    alignItems: "center",
    minHeight: 64,
    justifyContent: "center",
  },
  scanBtnText: { fontSize: 14, color: "#888" },
  scanPreview: { width: "100%", height: 140, borderRadius: 8 },
  removeScan: { fontSize: 13, color: "#ef4444", textAlign: "center", marginTop: 8 },
  saveBtn: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 8,
  },
  saveBtnDisabled: { backgroundColor: "#aaa" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
