import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

interface Job {
  id: number;
  site_name: string;
  status: string;
  date: string;
}

interface Photo {
  id: number;
  url: string;
  label: string;
  taken_at: string | null;
  lat: number | null;
  lng: number | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active: { bg: "#e8f5e9", text: "#2e7d32" },
  Completed: { bg: "#e3f2fd", text: "#1565c0" },
  Pending: { bg: "#fff8e1", text: "#f57f17" },
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    const [{ data: jobData }, { data: photosData }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", id).single(),
      supabase
        .from("photos")
        .select("*")
        .eq("job_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (jobData) setJob(jobData as Job);
    if (photosData) setPhotos(photosData as Photo[]);
    setLoading(false);
  }

  async function takePhoto() {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) {
      Alert.alert("Permission needed", "Camera access is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    await uploadPhoto(result.assets[0].uri);
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    await uploadPhoto(result.assets[0].uri);
  }

  async function uploadPhoto(uri: string) {
    setUploading(true);
    const takenAt = new Date().toISOString();

    let lat: number | null = null;
    let lng: number | null = null;

    try {
      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (locPerm.granted) {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch {
      console.warn("GPS unavailable");
    }

    try {
      const filename = `${id}/${Date.now()}.jpg`;

      // Читаем файл как base64 и конвертируем в ArrayBuffer
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(filename, decode(base64), { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("photos").getPublicUrl(filename);

      await supabase.from("photos").insert([
        {
          job_id: Number(id),
          url: publicUrl,
          label: `Photo ${photos.length + 1}`,
          lat,
          lng,
          taken_at: takenAt,
        },
      ]);

      fetchData();
    } catch (e) {
      Alert.alert("Upload failed", "Could not upload photo. Try again.");
      console.error(e);
    }

    setUploading(false);
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );

  if (!job)
    return (
      <View style={styles.center}>
        <Text>Job not found</Text>
      </View>
    );

  const badge = STATUS_COLORS[job.status] ?? { bg: "#f0f0f0", text: "#666" };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Jobs</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.siteName}>{job.site_name}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>
              {job.status}
            </Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date</Text>
          <Text style={styles.infoValue}>{job.date}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Job ID</Text>
          <Text style={styles.infoValue}>#{job.id}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>

        <View style={styles.photoActions}>
          <TouchableOpacity
            style={[styles.photoBtn, styles.photoBtnPrimary]}
            onPress={takePhoto}
            disabled={uploading}
          >
            <Text style={styles.photoBtnPrimaryText}>📷 Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.photoBtn, styles.photoBtnSecondary]}
            onPress={pickPhoto}
            disabled={uploading}
          >
            <Text style={styles.photoBtnSecondaryText}>🖼 Gallery</Text>
          </TouchableOpacity>
        </View>

        {uploading && (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color="#888" />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}

        {photos.length === 0 ? (
          <View style={styles.emptyPhotos}>
            <Text style={styles.emptyPhotosText}>No photos yet</Text>
          </View>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoCard}>
                <Image
                  source={{ uri: photo.url }}
                  style={styles.photoImg}
                  resizeMode="cover"
                />
                <Text style={styles.photoLabel} numberOfLines={1}>
                  {photo.label}
                </Text>
                {photo.taken_at && (
                  <Text style={styles.photoMeta}>
                    {new Date(photo.taken_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                )}
                {photo.lat && photo.lng && (
                  <Text style={styles.photoGps}>
                    {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 20, paddingTop: 60, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  back: { marginBottom: 8 },
  backText: { fontSize: 15, color: "#888" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  siteName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    flex: 1,
    marginRight: 10,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  infoRow: { flexDirection: "row", marginBottom: 6 },
  infoLabel: { fontSize: 13, color: "#888", width: 60 },
  infoValue: { fontSize: 13, color: "#1a1a1a", fontWeight: "500" },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 14,
  },
  photoActions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  photoBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" },
  photoBtnPrimary: { backgroundColor: "#1a1a1a" },
  photoBtnSecondary: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  photoBtnPrimaryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  photoBtnSecondaryText: { color: "#666", fontWeight: "600", fontSize: 14 },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  uploadingText: { fontSize: 13, color: "#888" },
  emptyPhotos: { alignItems: "center", paddingVertical: 24 },
  emptyPhotosText: { fontSize: 14, color: "#aaa" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoCard: { width: "47%" },
  photoImg: { width: "100%", height: 130, borderRadius: 8, marginBottom: 5 },
  photoLabel: { fontSize: 12, fontWeight: "600", color: "#1a1a1a" },
  photoMeta: { fontSize: 11, color: "#888", marginTop: 1 },
  photoGps: { fontSize: 10, color: "#aaa", marginTop: 1 },
});
