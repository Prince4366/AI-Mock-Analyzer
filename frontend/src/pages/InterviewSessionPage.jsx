import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { WebcamAnalysisPanel } from "../components/WebcamAnalysisPanel";
import { useWebcamInterviewAnalytics } from "../hooks/useWebcamInterviewAnalytics";
import {
  analyzeSpeechFromTranscript,
  createSpeechTracker,
  markSpeechResult,
  markSpeechStart
} from "../utils/speechAnalysis";

const DEFAULT_QUESTIONS = [
  {
    category: "technical",
    difficulty: "Medium",
    question: "Explain how you would optimize a slow MongoDB query in production."
  },
  {
    category: "behavioral",
    difficulty: "Medium",
    question: "Tell me about a project where you handled tight deadlines and trade-offs."
  },
  {
    category: "hr",
    difficulty: "Medium",
    question: "Why are you interested in this role and how does it match your career goals?"
  }
];

const QUESTION_TIME_SECONDS = 120;
const ACTIVE_INTERVIEW_SESSION_KEY = "active_interview_session_id";
const ROLE_TRACKS = [
  "Software Engineer",
  "Data Analyst",
  "AIML Engineer",
  "Product Manager",
  "HR/Behavioral"
];

function extractSessionId(sessionPayload) {
  return (
    sessionPayload?.id ||
    sessionPayload?._id ||
    sessionPayload?.sessionId ||
    ""
  );
}

export function InterviewSessionPage() {
  const SpeechRecognitionApi =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const speechSupported = Boolean(SpeechRecognitionApi);

  const [searchParams, setSearchParams] = useSearchParams();
  const sessionIdFromUrl = searchParams.get("sessionId");
  const initialRole = searchParams.get("roleTrack") || "";
  const [activeSessionId, setActiveSessionId] = useState(
    sessionIdFromUrl || localStorage.getItem(ACTIVE_INTERVIEW_SESSION_KEY) || ""
  );
  const [selectedRoleTrack, setSelectedRoleTrack] = useState(initialRole);
  const [started, setStarted] = useState(Boolean(sessionIdFromUrl));
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [currentDifficulty, setCurrentDifficulty] = useState(
    DEFAULT_QUESTIONS[0]?.difficulty || "Medium"
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_TIME_SECONDS);
  const [isListening, setIsListening] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [liveSpeechMetrics, setLiveSpeechMetrics] = useState(null);

  const recognitionRef = useRef(null);
  const currentIndexRef = useRef(0);
  const baseAnswerTextRef = useRef("");
  const speechTrackerRef = useRef(createSpeechTracker());
  const skipNextAutoLoadRef = useRef(false);
  const loadAttemptRef = useRef(0);

  const currentQuestion = questions[currentIndex];
  const progressPercent = useMemo(
    () => ((currentIndex + 1) / questions.length) * 100,
    [currentIndex, questions.length]
  );

  const answerState = answers[currentIndex] || {
    textAnswer: "",
    submitted: false
  };
  const {
    videoRef,
    webcamAvailable,
    isInitializing: webcamInitializing,
    isReady: webcamReady,
    error: webcamError,
    liveStats,
    startCamera,
    stopCamera,
    buildSummary
  } = useWebcamInterviewAnalytics();

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    setSecondsLeft(QUESTION_TIME_SECONDS);
    setStatusMessage("");
    setLiveTranscript("");
    setLiveSpeechMetrics(null);
  }, [currentIndex]);

  useEffect(() => {
    if (sessionIdFromUrl && sessionIdFromUrl !== activeSessionId && !started && !isStartingSession) {
      setActiveSessionId(sessionIdFromUrl);
      localStorage.setItem(ACTIVE_INTERVIEW_SESSION_KEY, sessionIdFromUrl);
    }
  }, [sessionIdFromUrl, activeSessionId, started, isStartingSession]);

  useEffect(() => {
    async function loadSession() {
      if (!activeSessionId || isStartingSession) {
        return;
      }
      if (skipNextAutoLoadRef.current) {
        skipNextAutoLoadRef.current = false;
        return;
      }
      const attemptId = Date.now();
      loadAttemptRef.current = attemptId;
      try {
        const data = await apiRequest(`/interviews/${activeSessionId}/questions`);
        if (loadAttemptRef.current !== attemptId) {
          return;
        }
        const incomingQuestions = data.questions || [];
        if (incomingQuestions.length > 0) {
          setQuestions(incomingQuestions);
        }
        setCurrentDifficulty(data.session?.currentDifficulty || incomingQuestions[0]?.difficulty || "Medium");
        setSelectedRoleTrack(data.session?.roleTrack || initialRole || "Software Engineer");
        setStarted(true);
      } catch (err) {
        if (loadAttemptRef.current !== attemptId) {
          return;
        }
        const status = Number(err?.status || 0);
        const isInvalidSession = status === 400 || status === 404;
        if (isInvalidSession) {
          localStorage.removeItem(ACTIVE_INTERVIEW_SESSION_KEY);
          setActiveSessionId("");
          setStarted(false);
          if (sessionIdFromUrl) {
            setSearchParams({ roleTrack: selectedRoleTrack || initialRole || "Software Engineer" });
          }
          setStatusMessage("Previous session is no longer available. Start a new interview.");
          return;
        }
        setStatusMessage("Temporary sync issue while loading session. Please retry.");
      }
    }
    loadSession();
  }, [activeSessionId, initialRole, sessionIdFromUrl, selectedRoleTrack, setSearchParams, isStartingSession]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timerId);
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopCamera();
    };
  }, [stopCamera]);

  function updateCurrentAnswer(patch) {
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: {
        ...answerState,
        ...patch
      }
    }));
  }

  function handlePrev() {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }

  function handleNext() {
    setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
  }

  function handleTextChange(event) {
    updateCurrentAnswer({ textAnswer: event.target.value, submitted: false });
  }

  function startRecording() {
    if (!speechSupported) {
      setRecordingError(
        "Speech recognition is not supported in this browser. Use Chrome or Edge."
      );
      return;
    }

    setRecordingError("");
    setLiveTranscript("");
    baseAnswerTextRef.current = answerState.textAnswer.trim();
    speechTrackerRef.current = createSpeechTracker();
    markSpeechStart(speechTrackerRef.current);

    const recognition = new SpeechRecognitionApi();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      markSpeechResult(speechTrackerRef.current);
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const combinedSpeech = `${finalTranscript} ${interimTranscript}`.trim();
      setLiveTranscript(combinedSpeech);

      const prefix = baseAnswerTextRef.current;
      const mergedText = [prefix, combinedSpeech].filter(Boolean).join("\n");
      const activeQuestionIndex = currentIndexRef.current;
      const interimMetrics = analyzeSpeechFromTranscript(
        mergedText,
        speechTrackerRef.current
      );
      setLiveSpeechMetrics(interimMetrics);

      setAnswers((prev) => ({
        ...prev,
        [activeQuestionIndex]: {
          ...(prev[activeQuestionIndex] || { textAnswer: "", submitted: false }),
          textAnswer: mergedText,
          submitted: false
        }
      }));
    };

    recognition.onerror = () => {
      setRecordingError("Speech recognition failed. Check microphone permissions.");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setLiveTranscript("");
    };

    recognition.start();
    setIsListening(true);
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }

  function submitAnswer() {
    if (!activeSessionId) {
      setStatusMessage("Interview session is not active. Please start a new session.");
      return;
    }
    const hasText = Boolean(answerState.textAnswer.trim());

    if (!hasText) {
      setStatusMessage("Add an answer before submitting.");
      return;
    }

    updateCurrentAnswer({ submitted: true });
    setStatusMessage("Answer submitted for this question.");
    const speechMetrics = analyzeSpeechFromTranscript(
      answerState.textAnswer,
      speechTrackerRef.current
    );
    updateCurrentAnswer({ speechMetrics });
    setLiveSpeechMetrics(speechMetrics);

    if (activeSessionId) {
      apiRequest(`/interviews/${activeSessionId}/speech-analytics`, {
        method: "POST",
        body: JSON.stringify({
          questionIndex: currentIndex,
          ...speechMetrics
        })
      }).catch(() => {
        setStatusMessage("Answer saved, but speech analytics sync failed. Try again.");
      });
    }

    const localDifficultyOrder = ["Easy", "Medium", "Hard", "Expert"];
    const idx = Math.max(0, localDifficultyOrder.indexOf(currentDifficulty));
    const len = answerState.textAnswer.trim().length;
    const delta = len >= 220 ? 1 : len <= 80 ? -1 : 0;
    const next = localDifficultyOrder[Math.max(0, Math.min(localDifficultyOrder.length - 1, idx + delta))];
    setCurrentDifficulty(next);
  }

  async function completeInterview() {
    if (!activeSessionId) {
      setStatusMessage("Session ID missing. Start a new interview session.");
      return;
    }
    setIsCompleting(true);
    setStatusMessage("");
    try {
      const webcamAnalytics = webcamReady ? buildSummary() : null;
      await apiRequest(`/interviews/${activeSessionId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          webcamAnalytics
        })
      });
      stopCamera();
      localStorage.removeItem(ACTIVE_INTERVIEW_SESSION_KEY);
      setActiveSessionId("");
      setStarted(false);
      setSearchParams({ roleTrack: selectedRoleTrack || "Software Engineer" });
      setStatusMessage("Interview completed. Performance + webcam analytics saved.");
    } catch (err) {
      setStatusMessage(err.message || "Failed to complete interview session.");
    } finally {
      setIsCompleting(false);
    }
  }

  async function startWithRole() {
    if (!selectedRoleTrack) {
      setStatusMessage("Please select a role track to begin.");
      return;
    }
    setIsStartingSession(true);
    setStatusMessage("Creating interview session...");
    try {
      loadAttemptRef.current = 0;
      localStorage.removeItem(ACTIVE_INTERVIEW_SESSION_KEY);
      setActiveSessionId("");
      setStarted(false);
      setSearchParams({ roleTrack: selectedRoleTrack });

      const [resumeData, jdData] = await Promise.all([
        apiRequest("/resumes"),
        apiRequest("/job-descriptions")
      ]);
      const latestResume = resumeData.resumes?.[0];
      const latestJd = jdData.jobDescriptions?.[0];
      if (!latestResume?._id || !latestJd?._id) {
        setStatusMessage("");
        setStatusMessage(
          "Save at least one resume and one job description before starting the interview."
        );
        return;
      }

      const generated = await apiRequest("/interviews/generate-questions", {
        method: "POST",
        body: JSON.stringify({
          resumeId: latestResume._id,
          jobDescriptionId: latestJd._id,
          difficulty: "Medium",
          questionCount: 9,
          roleTrack: selectedRoleTrack
        })
      });

      const newSessionId = String(extractSessionId(generated.session)).trim();
      const incomingQuestions = generated.questions || [];
      if (!newSessionId || incomingQuestions.length === 0) {
        throw new Error("Failed to create interview session. Please retry.");
      }

      localStorage.setItem(ACTIVE_INTERVIEW_SESSION_KEY, newSessionId);
      // We already have generated questions in-hand, so skip the immediate re-fetch cycle once.
      skipNextAutoLoadRef.current = true;
      setActiveSessionId(newSessionId);
      setQuestions(incomingQuestions);
      setCurrentDifficulty(generated.session?.difficulty || incomingQuestions[0]?.difficulty || "Medium");
      setCurrentIndex(0);
      setAnswers({});
      setStarted(true);
      setSearchParams({
        sessionId: newSessionId,
        roleTrack: selectedRoleTrack
      });
      setStatusMessage("");
    } catch (err) {
      setStatusMessage(err.message || "Unable to create interview session.");
    } finally {
      setIsStartingSession(false);
    }
  }

  if (!started) {
    return (
      <main className="resume-container">
        <div className="resume-card">
          <h1>Select Interview Role Track</h1>
          <p className="helper-text">Choose the track before starting your mock interview.</p>
          <select
            value={selectedRoleTrack}
            onChange={(event) => setSelectedRoleTrack(event.target.value)}
          >
            <option value="">Select role track</option>
            {ROLE_TRACKS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button type="button" onClick={startWithRole} disabled={isStartingSession}>
            {isStartingSession ? "Creating session..." : "Start Interview"}
          </button>
          {statusMessage && <p className="error-message">{statusMessage}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="resume-container">
      <div className="resume-card">
        <h1>Interview Session</h1>
        <p className="helper-text">
          Role Track: <strong>{selectedRoleTrack || "Software Engineer"}</strong>
        </p>
        <p className="helper-text">
          Current adaptive difficulty: <strong>{currentDifficulty}</strong>
        </p>
        <p className="helper-text">
          Question {currentIndex + 1} of {questions.length}
        </p>

        <div className="progress-track" aria-label="Interview progress">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <section className="preview-section">
          <p className="helper-text">
            <strong>Category:</strong> {currentQuestion.category} |{" "}
            <strong>Difficulty:</strong> {currentQuestion.difficulty}
          </p>
          <h2>{currentQuestion.question}</h2>
          <p className={`timer-text ${secondsLeft <= 15 ? "timer-warning" : ""}`}>
            Time left: {secondsLeft}s
          </p>
        </section>

        <WebcamAnalysisPanel
          videoRef={videoRef}
          webcamAvailable={webcamAvailable}
          isInitializing={webcamInitializing}
          isReady={webcamReady}
          error={webcamError}
          liveStats={liveStats}
          onStart={startCamera}
        />

        <section className="preview-section">
          <label htmlFor="textAnswer">Text answer</label>
          <textarea
            id="textAnswer"
            className="jd-textarea"
            value={answerState.textAnswer}
            onChange={handleTextChange}
            placeholder="Type or dictate your answer here..."
          />

          <div className="voice-actions">
            {!isListening ? (
              <button type="button" onClick={startRecording} disabled={!speechSupported}>
                Start Speech-to-Text
              </button>
            ) : (
              <button type="button" onClick={stopRecording}>
                Stop Speech-to-Text
              </button>
            )}
          </div>
          {!speechSupported && (
            <p className="helper-text">
              Voice transcription is unavailable in this browser.
            </p>
          )}
          {recordingError && <p className="error-message">{recordingError}</p>}
          {isListening && (
            <p className="transcript-live">
              Live transcript: {liveTranscript || "Listening..."}
            </p>
          )}
          {liveSpeechMetrics && (
            <div className="speech-metrics-box">
              <p>
                Pace: <strong>{liveSpeechMetrics.wordsPerMinute} WPM</strong> | Pauses:{" "}
                <strong>{liveSpeechMetrics.pauseCount}</strong> | Filler ratio:{" "}
                <strong>{liveSpeechMetrics.fillerWordRatio}%</strong>
              </p>
              <p>
                Confidence score: <strong>{liveSpeechMetrics.confidenceScore}/100</strong>
              </p>
            </div>
          )}
        </section>

        <section className="preview-section nav-grid">
          <button type="button" onClick={handlePrev} disabled={currentIndex === 0}>
            Previous
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
          >
            Next
          </button>
          <button type="button" onClick={submitAnswer}>
            Submit Answer
          </button>
        </section>
        <section className="preview-section">
          <button type="button" onClick={completeInterview} disabled={isCompleting}>
            {isCompleting ? "Completing..." : "Complete Interview"}
          </button>
        </section>

        {statusMessage && (
          <p className={answerState.submitted ? "success-message" : "error-message"}>
            {statusMessage}
          </p>
        )}
      </div>
    </main>
  );
}
