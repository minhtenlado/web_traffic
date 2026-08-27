import { useState } from 'react';
import { Maximize2, X, Video, Camera } from 'lucide-react';
import { CAMERAS } from '../../utils/constants';
import useStore from '../../stores/trafficStore';
import { CAMERA_IDS } from '../../services/cloudinaryService';
import CameraFeed from '../../components/CameraFeed/CameraFeed';
import './LiveMonitoring.css';

/* Map CAMERAS array index to Firebase cam_id for snapshot lookup */
const CAMERA_TO_FIREBASE = {
  cam1: 'cam_01',
  cam2: 'cam_02',
  cam3: 'cam_03',
  cam4: 'cam_04',
  cam5: 'cam_05',
  cam6: null,   // cam_06 and cam_07 don't have Firebase snapshots
  cam7: null,
};

export default function LiveMonitoring() {
  const [fullCam, setFullCam] = useState(null);
  const [snapshotMode, setSnapshotMode] = useState({}); // { cam1: true, cam2: false, ... }
  const cameraSnapshots = useStore(s => s.cameraSnapshots);

  const toggleMode = (camId) => {
    setSnapshotMode(prev => ({ ...prev, [camId]: !prev[camId] }));
  };

  const getSnapshotUrl = (camId) => {
    const fbId = CAMERA_TO_FIREBASE[camId];
    if (!fbId) return null;
    const snap = cameraSnapshots[fbId];
    return snap?.url || null;
  };

  return (
    <div className="live-page">
      <div className="page-header">
        <h2>Giám sát Camera trực tiếp</h2>
        <div className="page-header-actions">
          <span className="cam-count">{CAMERAS.length} camera hoạt động</span>
        </div>
      </div>

      {fullCam ? (
        <div className="full-view">
          <div className="full-view-header">
            <span>{fullCam.name}</span>
            <div className="full-view-actions">
              {CAMERA_TO_FIREBASE[fullCam.id] && (
                <button
                  className={`mode-toggle-btn ${snapshotMode[fullCam.id] ? 'active' : ''}`}
                  onClick={() => toggleMode(fullCam.id)}
                >
                  {snapshotMode[fullCam.id] ? <><Video size={13} /> Stream</> : <><Camera size={13} /> Snapshot</>}
                </button>
              )}
              <button className="btn" onClick={() => setFullCam(null)}><X size={14} /> Đóng</button>
            </div>
          </div>
          <div className="full-view-video">
            <CameraFeed
              url={fullCam.url}
              name={fullCam.name}
              snapshotUrl={snapshotMode[fullCam.id] ? getSnapshotUrl(fullCam.id) : null}
            />
          </div>
        </div>
      ) : (
        <div className="camera-grid">
          {CAMERAS.map(cam => {
            const hasSnapshot = !!CAMERA_TO_FIREBASE[cam.id];
            const isSnapshot = snapshotMode[cam.id];
            return (
              <div className="camera-cell" key={cam.id}>
                <CameraFeed
                  url={cam.url}
                  name={cam.name}
                  snapshotUrl={isSnapshot ? getSnapshotUrl(cam.id) : null}
                />
                <div className="camera-cell-actions">
                  {hasSnapshot && (
                    <button
                      className={`mode-toggle-btn mini ${isSnapshot ? 'active' : ''}`}
                      onClick={() => toggleMode(cam.id)}
                      title={isSnapshot ? 'Chuyển sang Stream' : 'Xem Snapshot'}
                    >
                      {isSnapshot ? <Video size={12} /> : <Camera size={12} />}
                    </button>
                  )}
                  <button className="expand-btn" onClick={() => setFullCam(cam)} title="Phóng to">
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
