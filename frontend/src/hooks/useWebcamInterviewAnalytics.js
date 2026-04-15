import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function getBlendshapeScore(categories, key) {
  const found = categories?.find((item) => item.categoryName === key);
  return found ? Number(found.score || 0) : 0;
}

function buildFeedback(summary) {
  const posture =
    summary.postureQualityPercent >= 75
      ? "Posture stayed stable and interview-ready."
      : "Posture dropped at times. Keep shoulders level and sit more upright.";
  const confidence =
    summary.confidenceScore >= 70
      ? "Strong confidence signals with good expression balance."
      : "Confidence appears moderate. Speak with slightly more energy and smile naturally.";
  const eyeContact =
    summary.eyeContactPercent >= 70
      ? "Eye contact stayed mostly aligned with the camera."
      : "Eye contact drifted often. Try focusing near the webcam lens while answering.";

  return { posture, confidence, eyeContact };
}

export function useWebcamInterviewAnalytics() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const faceRef = useRef(null);
  const poseRef = useRef(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");

  const [liveStats, setLiveStats] = useState({
    eyeContactPercent: 0,
    smileFrequencyPercent: 0,
    postureQualityPercent: 0,
    confidenceScore: 0
  });

  const metricsRef = useRef({
    totalFrames: 0,
    eyeContactFrames: 0,
    smileFrames: 0,
    postureGoodFrames: 0,
    headTiltAlerts: 0
  });

  const stopCamera = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !faceRef.current || !poseRef.current) {
      frameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    const ts = performance.now();
    const faceResult = faceRef.current.detectForVideo(video, ts);
    const poseResult = poseRef.current.detectForVideo(video, ts);
    const stats = metricsRef.current;
    stats.totalFrames += 1;

    const blend = faceResult?.faceBlendshapes?.[0]?.categories || [];
    const gazeDeviation =
      getBlendshapeScore(blend, "eyeLookInLeft") +
      getBlendshapeScore(blend, "eyeLookInRight") +
      getBlendshapeScore(blend, "eyeLookOutLeft") +
      getBlendshapeScore(blend, "eyeLookOutRight");
    const smileScore = Math.max(
      getBlendshapeScore(blend, "mouthSmileLeft"),
      getBlendshapeScore(blend, "mouthSmileRight")
    );
    if (gazeDeviation < 0.65) {
      stats.eyeContactFrames += 1;
    }
    if (smileScore > 0.38) {
      stats.smileFrames += 1;
    }

    const pose = poseResult?.landmarks?.[0];
    if (pose && pose.length > 12) {
      const leftShoulder = pose[11];
      const rightShoulder = pose[12];
      const nose = pose[0];
      const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);
      const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
      const headTilt = Math.abs((nose?.x || shoulderMidX) - shoulderMidX);

      const postureGood = shoulderSlope < 0.07 && headTilt < 0.09;
      if (postureGood) {
        stats.postureGoodFrames += 1;
      } else if (headTilt >= 0.09) {
        stats.headTiltAlerts += 1;
      }
    }

    if (stats.totalFrames % 10 === 0) {
      const eye = (stats.eyeContactFrames / stats.totalFrames) * 100;
      const smile = (stats.smileFrames / stats.totalFrames) * 100;
      const posture = (stats.postureGoodFrames / stats.totalFrames) * 100;
      const confidence = eye * 0.5 + smile * 0.2 + posture * 0.3;
      setLiveStats({
        eyeContactPercent: clampPercent(eye),
        smileFrequencyPercent: clampPercent(smile),
        postureQualityPercent: clampPercent(posture),
        confidenceScore: clampPercent(confidence)
      });
    }

    frameRef.current = requestAnimationFrame(analyzeFrame);
  }, []);

  const startCamera = useCallback(async () => {
    setIsInitializing(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (!videoRef.current) {
        throw new Error("Video preview is unavailable.");
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      faceRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        },
        runningMode: "VIDEO",
        outputFaceBlendshapes: true,
        numFaces: 1
      });

      poseRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
        },
        runningMode: "VIDEO",
        numPoses: 1
      });

      setIsReady(true);
      frameRef.current = requestAnimationFrame(analyzeFrame);
    } catch (err) {
      setError(
        err?.name === "NotAllowedError"
          ? "Camera access denied. Please allow webcam permission to enable posture/confidence analysis."
          : "Unable to start webcam analysis. Check camera availability and browser compatibility."
      );
      stopCamera();
    } finally {
      setIsInitializing(false);
    }
  }, [analyzeFrame, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
      faceRef.current?.close?.();
      poseRef.current?.close?.();
    };
  }, [stopCamera]);

  const buildSummary = useCallback(() => {
    const stats = metricsRef.current;
    const total = Math.max(1, stats.totalFrames);
    const eye = (stats.eyeContactFrames / total) * 100;
    const smile = (stats.smileFrames / total) * 100;
    const posture = (stats.postureGoodFrames / total) * 100;
    const confidence = eye * 0.5 + smile * 0.2 + posture * 0.3;

    const summary = {
      totalFrames: stats.totalFrames,
      eyeContactPercent: clampPercent(eye),
      smileFrequencyPercent: clampPercent(smile),
      postureQualityPercent: clampPercent(posture),
      headTiltAlerts: stats.headTiltAlerts,
      confidenceScore: clampPercent(confidence)
    };
    return { ...summary, feedback: buildFeedback(summary) };
  }, []);

  const webcamAvailable = useMemo(
    () => Boolean(navigator.mediaDevices?.getUserMedia),
    []
  );

  return {
    videoRef,
    webcamAvailable,
    isInitializing,
    isReady,
    error,
    liveStats,
    startCamera,
    stopCamera,
    buildSummary
  };
}
