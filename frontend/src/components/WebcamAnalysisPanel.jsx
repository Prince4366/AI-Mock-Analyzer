export function WebcamAnalysisPanel({
  videoRef,
  webcamAvailable,
  isInitializing,
  isReady,
  error,
  liveStats,
  onStart
}) {
  return (
    <section className="preview-section">
      <h2>Live Webcam Analysis</h2>
      <p className="helper-text">
        Tracks gaze, smile frequency, and posture confidence during your interview.
      </p>
      <div className="webcam-panel">
        <video ref={videoRef} className="webcam-preview" autoPlay muted playsInline />
        <div className="webcam-metrics">
          <p>Eye contact: {liveStats.eyeContactPercent}%</p>
          <p>Smile frequency: {liveStats.smileFrequencyPercent}%</p>
          <p>Posture quality: {liveStats.postureQualityPercent}%</p>
          <p>Confidence score: {liveStats.confidenceScore}%</p>
          {!isReady && (
            <button
              type="button"
              onClick={onStart}
              disabled={isInitializing || !webcamAvailable}
            >
              {isInitializing ? "Starting webcam..." : "Enable Webcam Analysis"}
            </button>
          )}
        </div>
      </div>
      {!webcamAvailable && (
        <p className="error-message">Webcam APIs are unavailable in this browser.</p>
      )}
      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
