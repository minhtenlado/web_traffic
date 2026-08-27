/**
 * Cloudinary Service — Camera Snapshot Upload & Management
 *
 * Uses unsigned upload with fixed public_ids so each upload
 * automatically overwrites the previous snapshot (no delete needed).
 *
 * Firebase node `camera_snapshots/{camId}` stores the latest URL + metadata.
 */

import { firebaseSet } from './firebase';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

/** Camera IDs that have snapshots */
const CAMERA_IDS = ['cam_01', 'cam_02', 'cam_03', 'cam_04', 'cam_05'];

/**
 * Upload a single camera snapshot to Cloudinary.
 *
 * @param {string} camId — e.g. 'cam_01'
 * @param {File|Blob|string} imageData — File, Blob, or base64 data-URI
 * @returns {Promise<{public_id: string, secure_url: string, created_at: string}>}
 */
export async function uploadCameraSnapshot(camId, imageData) {
  const publicId = `traffic_cams/${camId}_snapshot`;

  const formData = new FormData();
  formData.append('file', imageData);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('public_id', `${camId}_snapshot_${Date.now()}`);

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Cloudinary upload failed for ${camId}: ${res.status} – ${err.error?.message || ''}`);
  }

  const data = await res.json();
  return {
    public_id: data.public_id,
    secure_url: data.secure_url,
    created_at: data.created_at,
    width: data.width,
    height: data.height,
  };
}

/**
 * Get the Cloudinary URL for a camera snapshot (with cache-bust).
 *
 * @param {string} camId
 * @returns {string} URL
 */
export function getCameraSnapshotUrl(camId) {
  const ts = Date.now();
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/traffic_cams/${camId}_snapshot?_t=${ts}`;
}

/**
 * Upload snapshots for all (or a subset of) cameras in parallel.
 *
 * @param {Object} snapshotsMap — { cam_01: File|Blob|base64, cam_02: ... }
 * @returns {Promise<Object>} — results keyed by camId
 */
export async function uploadAllCameraSnapshots(snapshotsMap) {
  const entries = Object.entries(snapshotsMap);
  const results = {};

  const uploads = entries.map(async ([camId, imageData]) => {
    try {
      const result = await uploadCameraSnapshot(camId, imageData);
      results[camId] = {
        url: result.secure_url,
        public_id: result.public_id,
        uploaded_at: new Date().toISOString(),
        status: 'success',
      };
    } catch (err) {
      console.error(`[Cloudinary] Upload failed for ${camId}:`, err);
      results[camId] = {
        url: null,
        public_id: null,
        uploaded_at: new Date().toISOString(),
        status: 'error',
        error: err.message,
      };
    }
  });

  await Promise.all(uploads);

  // Persist each result + meta to Firebase
  const now = new Date().toISOString();
  const CYCLE_MS = 3 * 60 * 60 * 1000; // 3 hours
  const nextRefresh = new Date(Date.now() + CYCLE_MS).toISOString();

  for (const [camId, data] of Object.entries(results)) {
    if (data.status === 'success') {
      await firebaseSet(`camera_snapshots/${camId}`, {
        ...data,
        next_refresh: nextRefresh,
      }).catch(console.error);
    }
  }

  // Update meta
  await firebaseSet('camera_snapshots/_meta', {
    last_cycle: now,
    next_refresh: nextRefresh,
    cycle_interval_ms: CYCLE_MS,
  }).catch(console.error);

  return results;
}

/**
 * Convenience: get all camera IDs.
 */
export { CAMERA_IDS };
