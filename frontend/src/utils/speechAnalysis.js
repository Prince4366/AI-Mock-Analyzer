const FILLER_WORDS = [
  "um",
  "uh",
  "like",
  "basically",
  "actually",
  "you know",
  "sort of",
  "kind of"
];

function countWords(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createSpeechTracker() {
  return {
    recordingStartedAt: 0,
    lastResultAt: 0,
    pauseDurationsMs: []
  };
}

export function markSpeechStart(tracker) {
  const now = Date.now();
  tracker.recordingStartedAt = now;
  tracker.lastResultAt = now;
  tracker.pauseDurationsMs = [];
}

export function markSpeechResult(tracker) {
  const now = Date.now();
  const gap = now - Number(tracker.lastResultAt || now);
  // Treat gaps >= 1.2s between result events as intentional pauses in speech.
  if (gap >= 1200) {
    tracker.pauseDurationsMs.push(gap);
  }
  tracker.lastResultAt = now;
}

export function analyzeSpeechFromTranscript(text, tracker) {
  const transcript = String(text || "").trim();
  const words = countWords(transcript);
  const durationMs = Math.max(1, Date.now() - Number(tracker.recordingStartedAt || Date.now()));
  const minutes = durationMs / 60000;
  const wpm = words > 0 ? words / minutes : 0;

  const lower = transcript.toLowerCase();
  let fillerWordCount = 0;
  FILLER_WORDS.forEach((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = lower.match(regex);
    fillerWordCount += matches ? matches.length : 0;
  });

  const pauseCount = tracker.pauseDurationsMs.length;
  const totalPauseMs = tracker.pauseDurationsMs.reduce((sum, value) => sum + value, 0);
  const averagePauseMs = pauseCount > 0 ? totalPauseMs / pauseCount : 0;
  const fillerWordRatio = words > 0 ? (fillerWordCount / words) * 100 : 0;

  // Confidence combines pace stability, filler control, and pause smoothness.
  const paceScore = clamp(100 - Math.abs(wpm - 135) * 0.9, 0, 100);
  const fillerScore = clamp(100 - fillerWordRatio * 8, 0, 100);
  const pauseScore = clamp(100 - Math.max(0, averagePauseMs - 900) * 0.05, 0, 100);
  const confidenceScore = Number((paceScore * 0.4 + fillerScore * 0.35 + pauseScore * 0.25).toFixed(1));

  const strengths = [];
  const improvements = [];
  if (wpm >= 105 && wpm <= 165) strengths.push("Good speaking pace for interview responses.");
  else improvements.push("Adjust pace toward 110-160 words per minute.");
  if (fillerWordRatio <= 8) strengths.push("Low filler-word frequency keeps responses clear.");
  else improvements.push("Reduce filler words by pausing silently before key points.");
  if (averagePauseMs <= 1500) strengths.push("Pauses are controlled and natural.");
  else improvements.push("Long pauses detected. Use a simple answer structure to stay fluent.");

  return {
    wordsPerMinute: Number(wpm.toFixed(1)),
    pauseCount,
    averagePauseMs: Number(averagePauseMs.toFixed(0)),
    fillerWordCount,
    fillerWordRatio: Number(fillerWordRatio.toFixed(1)),
    confidenceScore,
    transcriptWordCount: words,
    feedback: { strengths, improvements }
  };
}
