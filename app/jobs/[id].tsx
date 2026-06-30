import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ImageZoomModal } from "../../components/ImageZoomModal";
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

type QcStatus = "pending" | "approved" | "rejected";

interface Job {
  id: number;
  site_name: string;
  status: string;
  date: string;
  qc_finalized: boolean;
}

interface Photo {
  id: number;
  url: string;
  label: string;
  taken_at: string | null;
  lat: number | null;
  lng: number | null;
  qc_status: QcStatus;
  qc_comment: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active: { bg: "#e8f5e9", text: "#2e7d32" },
  Completed: { bg: "#e3f2fd", text: "#1565c0" },
  Pending: { bg: "#fff8e1", text: "#f57f17" },
};

const QC_COLORS: Record<
  QcStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  pending: { bg: "#f5f5f5", text: "#888", border: "#e0e0e0", label: "Pending" },
  approved: {
    bg: "#e8f5e9",
    text: "#2e7d32",
    border: "#a5d6a7",
    label: "Approved",
  },
  rejected: {
    bg: "#ffebee",
    text: "#c62828",
    border: "#ef9a9a",
    label: "Rejected",
  },
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [retakingId, setRetakingId] = useState<number | null>(null);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

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

  async function getGps(): Promise<{ lat: number | null; lng: number | null }> {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return { lat: null, lng: null };
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    } catch {
      return { lat: null, lng: null };
    }
  }

  async function uploadToStorage(uri: string): Promise<string> {
    const filename = `${id}/${Date.now()}.jpg`;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64" as any,
    });
    const { error } = await supabase.storage
      .from("photos")
      .upload(filename, decode(base64), { contentType: "image/jpeg" });
    if (error) throw error;
    const {
      data: { publicUrl },
    } = supabase.storage.from("photos").getPublicUrl(filename);
    return publicUrl;
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
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

  // Новое фото → новая запись в БД
  async function uploadPhoto(uri: string) {
    setUploading(true);
    try {
      const [publicUrl, { lat, lng }] = await Promise.all([
        uploadToStorage(uri),
        getGps(),
      ]);
      await supabase.from("photos").insert([
        {
          job_id: Number(id),
          url: publicUrl,
          label: `Photo ${photos.length + 1}`,
          lat,
          lng,
          taken_at: new Date().toISOString(),
        },
      ]);
      fetchData();
    } catch (e) {
      Alert.alert("Upload failed", "Could not upload photo. Try again.");
      console.error(e);
    }
    setUploading(false);
  }

  // Пересъёмка → обновляем существующую запись, сбрасываем QC в pending
  async function retakePhoto(photoId: number) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;

    setRetakingId(photoId);
    try {
      const [publicUrl, { lat, lng }] = await Promise.all([
        uploadToStorage(result.assets[0].uri),
        getGps(),
      ]);
      await supabase
        .from("photos")
        .update({
          url: publicUrl,
          lat,
          lng,
          taken_at: new Date().toISOString(),
          qc_status: "pending",
          qc_comment: null,
        })
        .eq("id", photoId);
      fetchData();
    } catch (e) {
      Alert.alert("Upload failed", "Could not upload photo. Try again.");
      console.error(e);
    }
    setRetakingId(null);
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
  const rejectedCount = photos.filter((p) => p.qc_status === "rejected").length;
  const approvedCount = photos.filter((p) => p.qc_status === "approved").length;

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Jobs</Text>
      </TouchableOpacity>

      {/* Job info */}
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

        {/* QC banner */}
        {photos.length > 0 && (
          <View
            style={[
              styles.qcBanner,
              job.qc_finalized
                ? styles.qcGreen
                : rejectedCount > 0
                  ? styles.qcRed
                  : styles.qcGray,
            ]}
          >
            <Text
              style={[
                styles.qcBannerText,
                job.qc_finalized
                  ? { color: "#2e7d32" }
                  : rejectedCount > 0
                    ? { color: "#c62828" }
                    : { color: "#888" },
              ]}
            >
              {job.qc_finalized
                ? "✓ QC Finalized — COP ready"
                : rejectedCount > 0
                  ? `⚠ ${rejectedCount} photo${rejectedCount > 1 ? "s" : ""} need attention`
                  : `${approvedCount} / ${photos.length} photos reviewed`}
            </Text>
          </View>
        )}
      </View>

      {/* Photos */}
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
            {photos.map((photo) => {
              const qc = QC_COLORS[photo.qc_status];
              const isRetaking = retakingId === photo.id;
              return (
                <View
                  key={photo.id}
                  style={[styles.photoCard, { borderColor: qc.border }]}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setZoomUri(photo.url)}
                    style={{ cursor: 'zoom-in' } as any}
                  >
                    <Image
                      source={{ uri: photo.url }}
                      style={styles.photoImg}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  <View style={styles.photoInfo}>
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

                    {/* QC badge */}
                    <View style={[styles.qcBadge, { backgroundColor: qc.bg }]}>
                      <Text style={[styles.qcBadgeText, { color: qc.text }]}>
                        {qc.label}
                      </Text>
                    </View>

                    {/* Комментарий при отклонении */}
                    {photo.qc_status === "rejected" && photo.qc_comment && (
                      <Text style={styles.rejectionComment}>
                        ↳ {photo.qc_comment}
                      </Text>
                    )}

                    {/* Кнопка Retake — только для rejected */}
                    {photo.qc_status === "rejected" && (
                      <TouchableOpacity
                        style={styles.retakeBtn}
                        onPress={() => retakePhoto(photo.id)}
                        disabled={isRetaking}
                      >
                        {isRetaking ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.retakeBtnText}>📷 Retake</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>

    {zoomUri && (
      <ImageZoomModal uri={zoomUri} onClose={() => setZoomUri(null)} />
    )}
    </>
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

  qcBanner: { marginTop: 14, padding: 10, borderRadius: 8 },
  qcGreen: { backgroundColor: "#e8f5e9" },
  qcRed: { backgroundColor: "#ffebee" },
  qcGray: { backgroundColor: "#f5f5f5" },
  qcBannerText: { fontSize: 13, fontWeight: "600", textAlign: "center" },

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
  photoCard: {
    width: "47%",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    backgroundColor: "#fafafa",
  },
  photoImg: { width: "100%", height: 130 },
  photoInfo: { padding: 8 },
  photoLabel: { fontSize: 12, fontWeight: "600", color: "#1a1a1a" },
  photoMeta: { fontSize: 11, color: "#888", marginTop: 1 },
  photoGps: { fontSize: 10, color: "#aaa", marginTop: 1 },

  qcBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 5,
  },
  qcBadgeText: { fontSize: 10, fontWeight: "700" },
  rejectionComment: {
    fontSize: 11,
    color: "#c62828",
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 15,
  },
  retakeBtn: {
    marginTop: 7,
    backgroundColor: "#1a1a1a",
    borderRadius: 7,
    paddingVertical: 7,
    alignItems: "center",
  },
  retakeBtnText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
