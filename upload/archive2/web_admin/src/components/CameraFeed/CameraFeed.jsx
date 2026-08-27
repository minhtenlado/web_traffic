import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Camera } from 'lucide-react';
import './CameraFeed.css';

export default function CameraFeed({ url, name, mini = false, snapshotUrl = null }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  /* Detect if the URL is a direct HLS stream (.m3u8) or an iframe page */
  const isHlsStream = url && (url.endsWith('.m3u8') || url.includes('playlist.m3u8'));
  const isIframePage = url && url.includes('expandcameraplayer');

  /* If snapshotUrl is provided, show static image instead of video/iframe */
  const showSnapshot = !!snapshotUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url || !isHlsStream || showSnapshot) return;

    let hls;
    const initHls = async () => {
      try {
        const Hls = (await import('https://cdn.jsdelivr.net/npm/hls.js@latest/+esm')).default;
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: false, lowLatencyMode: true });
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
          video.play().catch(() => {});
        }
      } catch {
        // HLS not available - show placeholder
      }
    };
    initHls();

    return () => {
      if (hlsRef.current) { 
        hlsRef.current.destroy(); 
        hlsRef.current = null; 
      }
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [url, isHlsStream, showSnapshot]);

  /* Reset image state when snapshot URL changes */
  useEffect(() => {
    if (snapshotUrl) {
      setImgLoaded(false);
      setImgError(false);
    }
  }, [snapshotUrl]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = (e) => {
    if (e) e.stopPropagation();
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div ref={containerRef} className={`camera-feed ${mini ? 'mini' : ''}`}>
      {showSnapshot ? (
        /* ── Snapshot mode: static image from Cloudinary ── */
        <div className="camera-snapshot-wrap">
          {!imgLoaded && !imgError && (
            <div className="snapshot-loading">
              <div className="snapshot-spinner" />
            </div>
          )}
          {imgError ? (
            <div className="snapshot-placeholder">
              <Camera size={32} strokeWidth={1.5} />
              <span>Chưa có snapshot</span>
            </div>
          ) : (
            <img
              src={snapshotUrl}
              alt={`Snapshot – ${name}`}
              className={`camera-snapshot-img ${imgLoaded ? 'loaded' : ''}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          )}
        </div>
      ) : isIframePage ? (
        <iframe
          src={url}
          className="camera-iframe"
          title={name}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <video ref={videoRef} muted playsInline className="camera-video" />
      )}
      <div className="camera-overlay">
        <span className="camera-name">{name}</span>
        <div className="camera-controls">
          <span className="camera-live">
            <span className={`live-dot ${showSnapshot ? 'snapshot-mode' : ''}`} />
            {showSnapshot ? '📸 SNAPSHOT' : 'HOẠT ĐỘNG'}
          </span>
          {!mini && (
            <button className="fullscreen-btn" onClick={toggleFullscreen} title="Toàn màn hình">
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
