import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { ImageZoomModal } from "../../components/ImageZoomModal";
import { supabase } from "../../lib/supabase";

type Cert = {
  id: string;
  name: string;
  cert_type: string;
  issued_at: string;
  expires_at: string;
  scan_url: string | null;
};

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

export default function CertificationsScreen() {
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  const fetchCerts = async () => {
    const { data, error } = await supabase
      .from("certifications")
      .select("*")
      .order("expires_at", { ascending: true });

    if (error) Alert.alert("Error", error.message);
    else setCerts(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchCerts();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCerts();
  }, []);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  if (loading)
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Certifications</Text>
        <Text style={s.count}>{certs.length} total</Text>
      </View>

      <FlatList
        data={certs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
                  <Image
                    source={{ uri: item.scan_url }}
                    style={s.thumb}
                    resizeMode="cover"
                  />
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
                    <Text style={[s.badgeText, { color }]}>
                      {LABEL[status]}
                    </Text>
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

      {zoomUri && (
        <ImageZoomModal uri={zoomUri} onClose={() => setZoomUri(null)} />
      )}
    </View>
  );
}

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
    alignItems: "baseline",
    gap: 8,
  },
  title: { fontSize: 28, fontWeight: "700", color: "#1a1a1a" },
  count: { fontSize: 14, color: "#888" },
  list: { padding: 16, gap: 12 },
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
  body: { flex: 1, padding: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
    marginRight: 8,
  },
  type: { fontSize: 13, color: "#666", marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  dates: { flexDirection: "row", gap: 12 },
  date: { fontSize: 12, color: "#888" },
  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { color: "#aaa", fontSize: 16 },
  thumb: { width: 52, height: 52, alignSelf: 'center', borderRadius: 6, marginLeft: 6 },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    alignSelf: 'center',
    marginLeft: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: { fontSize: 22 },
});
