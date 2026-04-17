import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { WebcamAnalysisPanel } from "../components/WebcamAnalysisPanel";
import { useAuth } from "../hooks/useAuth";
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

const QUESTION_TIME_SECONDS = 60;
const STRICT_VOICE_ONLY_MODE = true;
const MAX_TOTAL_FOLLOW_UPS = 3;
const MAX_INTERVIEW_QUESTIONS = 9;
const FOLLOW_UP_SKIP_PATTERN =
  /\b(don'?t know|do not know|no idea|sorry|learn (it )?(later|in future)|not sure)\b/i;
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
  const navigate = useNavigate();
  function handleBrowserLikeBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app");
  }

  const { user } = useAuth();
  const SpeechRecognitionApi =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const speechSupported = Boolean(SpeechRecognitionApi);
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = searchParams.get("roleTrack") || "";
  const [activeSessionId, setActiveSessionId] = useState("");
  const [selectedRoleTrack, setSelectedRoleTrack] = useState(initialRole);
  const [started, setStarted] = useState(false);
  const [baseQuestions, setBaseQuestions] = useState(DEFAULT_QUESTIONS);
  const [questionFlow, setQuestionFlow] = useState([]);
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
  const [isPreparingInterview, setIsPreparingInterview] = useState(false);
  const [isInterviewLive, setIsInterviewLive] = useState(false);
  const [liveSpeechMetrics, setLiveSpeechMetrics] = useState(null);
  const [followUpsAsked, setFollowUpsAsked] = useState(0);

  const recognitionRef = useRef(null);
  const currentIndexRef = useRef(0);
  const baseAnswerTextRef = useRef("");
  const speechTrackerRef = useRef(createSpeechTracker());
  const skipNextAutoLoadRef = useRef(false);
  const loadAttemptRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const autoAdvanceTimeoutRef = useRef(null);
  const hasSpokenWelcomeRef = useRef(false);

  const currentQuestion =
    questionFlow[currentIndex] || baseQuestions[currentIndex] || DEFAULT_QUESTIONS[0];
  const isFinalQuestion = currentIndex + 1 >= Math.min(questionFlow.length, MAX_INTERVIEW_QUESTIONS);
  const progressPercent = useMemo(
    () =>
      ((Math.min(currentIndex + 1, MAX_INTERVIEW_QUESTIONS) /
        Math.max(Math.min(questionFlow.length, MAX_INTERVIEW_QUESTIONS), 1)) *
        100),
    [currentIndex, questionFlow.length]
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
    if (questionFlow.length > 0) {
      return;
    }
    setQuestionFlow(
      DEFAULT_QUESTIONS.map((question, idx) => ({
        ...question,
        rootQuestionIndex: idx,
        isFollowUp: false
      }))
    );
  }, [questionFlow.length]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    setSecondsLeft(QUESTION_TIME_SECONDS);
    setStatusMessage("");
    setLiveTranscript("");
    setLiveSpeechMetrics(null);
  }, [currentIndex]);

  useEffect(() => {
    localStorage.removeItem(ACTIVE_INTERVIEW_SESSION_KEY);
    setActiveSessionId("");
    setStarted(false);
    const roleTrack = searchParams.get("roleTrack") || initialRole || "Software Engineer";
    setSearchParams({ roleTrack }, { replace: true });
  }, []);

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
          setBaseQuestions(incomingQuestions);
          setQuestionFlow(
            incomingQuestions.map((question, idx) => ({
              ...question,
              rootQuestionIndex: idx,
              isFollowUp: false
            }))
          );
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
          setSearchParams({ roleTrack: selectedRoleTrack || initialRole || "Software Engineer" });
          setStatusMessage("Previous session is no longer available. Start a new interview.");
          return;
        }
        setStarted(false);
        setStatusMessage("Unable to load current session. Please start a new interview.");
      }
    }
    loadSession();
  }, [activeSessionId, initialRole, selectedRoleTrack, setSearchParams, isStartingSession]);

  useEffect(() => {
    if (!started || !isInterviewLive) {
      return undefined;
    }
    const timerId = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timerId);
  }, [currentIndex, started, isInterviewLive]);

  useEffect(() => {
    return () => {
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopCamera();
    };
  }, [stopCamera]);

  function updateAnswerAtIndex(targetIndex, patch) {
    setAnswers((prev) => ({
      ...prev,
      [targetIndex]: {
        ...(prev[targetIndex] || { textAnswer: "", submitted: false }),
        ...patch
      }
    }));
  }

  function speakText(text) {
    if (!ttsSupported || !text) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
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

  async function submitAnswer(options = {}) {
    const { autoAdvance = false, fromTimer = false } = options;
    if (isSubmittingRef.current) {
      return;
    }
    if (!activeSessionId) {
      setStatusMessage("Interview session is not active. Please start a new session.");
      return;
    }
    isSubmittingRef.current = true;
    const activeQuestionIndex = currentIndexRef.current;
    const snapshot = answers[activeQuestionIndex] || { textAnswer: "", submitted: false };
    const userAnswerText = String(snapshot.textAnswer || "").trim() || "No answer provided.";
    const activeQuestion =
      questionFlow[activeQuestionIndex] ||
      baseQuestions[activeQuestionIndex] ||
      DEFAULT_QUESTIONS[activeQuestionIndex] ||
      DEFAULT_QUESTIONS[0];
    const rootQuestionIndex = Number.isInteger(activeQuestion?.rootQuestionIndex)
      ? activeQuestion.rootQuestionIndex
      : activeQuestionIndex;
    updateAnswerAtIndex(activeQuestionIndex, { submitted: true, textAnswer: userAnswerText });
    setStatusMessage(
      fromTimer
        ? "Time is up. Submitting your answer for evaluation..."
        : "Submitting answer and generating evaluation..."
    );

    const speechMetrics = analyzeSpeechFromTranscript(
      userAnswerText,
      speechTrackerRef.current
    );
    updateAnswerAtIndex(activeQuestionIndex, { speechMetrics });
    setLiveSpeechMetrics(speechMetrics);

    if (activeSessionId) {
      apiRequest(`/interviews/${activeSessionId}/speech-analytics`, {
        method: "POST",
        body: JSON.stringify({
          questionIndex: rootQuestionIndex,
          ...speechMetrics
        })
      }).catch(() => {
        console.warn("[InterviewSessionPage] Speech analytics sync failed", {
          sessionId: activeSessionId,
          questionIndex: rootQuestionIndex
        });
      });
    }

    try {
      const evaluationResponse = await apiRequest(
        `/interviews/${activeSessionId}/evaluate-answer`,
        {
          method: "POST",
          body: JSON.stringify({
            question: activeQuestion?.question || "",
            expectedAnswer: activeQuestion?.expectedAnswer || "",
            userAnswer: userAnswerText,
            questionIndex: activeQuestion?.isFollowUp ? -1 : rootQuestionIndex,
            speechMetrics
          })
        }
      );
      console.info("[InterviewSessionPage] Evaluation saved", {
        sessionId: activeSessionId,
        questionIndex: activeQuestionIndex,
        evaluationId: evaluationResponse?.evaluation?.id,
        overallScore: evaluationResponse?.evaluation?.overallScore
      });
      const shouldSkipFollowUp =
        activeQuestion?.isFollowUp ||
        FOLLOW_UP_SKIP_PATTERN.test(userAnswerText) ||
        followUpsAsked >= MAX_TOTAL_FOLLOW_UPS ||
        activeQuestionIndex + 1 >= MAX_INTERVIEW_QUESTIONS;

      let insertedFollowUp = false;
      if (autoAdvance && !shouldSkipFollowUp) {
        try {
          const followUpResponse = await apiRequest(
            `/interviews/${activeSessionId}/follow-up`,
            {
              method: "POST",
              body: JSON.stringify({
                rootQuestionIndex,
                previousAnswer: userAnswerText,
                previousQuestion: activeQuestion?.question || ""
              })
            }
          );
          const followUpQuestion = String(followUpResponse?.followUp?.question || "").trim();
          if (followUpQuestion) {
            setQuestionFlow((prev) => {
              const updated = [...prev];
              updated.splice(activeQuestionIndex + 1, 0, {
                question: followUpQuestion,
                category: activeQuestion?.category || "technical",
                difficulty: currentDifficulty,
                expectedAnswer: "",
                rootQuestionIndex,
                isFollowUp: true
              });
              return updated;
            });
            setFollowUpsAsked((prev) => prev + 1);
            insertedFollowUp = true;
          }
        } catch (followUpErr) {
          console.warn("[InterviewSessionPage] Follow-up generation skipped", {
            message: followUpErr?.message,
            rootQuestionIndex
          });
        }
      }

      const nextIndex = activeQuestionIndex + 1;
      const flowLengthAtSubmit = Math.min(
        questionFlow.length + (insertedFollowUp ? 1 : 0),
        MAX_INTERVIEW_QUESTIONS
      );
      const hasNextQuestion = nextIndex < flowLengthAtSubmit;
      if (autoAdvance && hasNextQuestion) {
        setStatusMessage(
          insertedFollowUp
            ? "Answer evaluated. Asking a follow-up from your response..."
            : "Answer evaluated. Loading next question..."
        );
        autoAdvanceTimeoutRef.current = setTimeout(() => {
          setCurrentIndex(nextIndex);
        }, 800);
      } else if (autoAdvance && !hasNextQuestion) {
        setStatusMessage("Final answer evaluated. Completing interview...");
        await completeInterview();
      } else {
        setStatusMessage("Answer submitted and evaluation saved.");
      }
    } catch (err) {
      console.error("[InterviewSessionPage] Failed to save evaluation", {
        sessionId: activeSessionId,
        questionIndex: activeQuestionIndex,
        message: err?.message
      });
      setStatusMessage(err.message || "Answer submitted but evaluation failed.");
    } finally {
      isSubmittingRef.current = false;
    }

    const localDifficultyOrder = ["Easy", "Medium", "Hard", "Expert"];
    const idx = Math.max(0, localDifficultyOrder.indexOf(currentDifficulty));
    const len = userAnswerText.length;
    const delta = len >= 220 ? 1 : len <= 80 ? -1 : 0;
    const next = localDifficultyOrder[Math.max(0, Math.min(localDifficultyOrder.length - 1, idx + delta))];
    setCurrentDifficulty(next);
  }

  useEffect(() => {
    if (!started || !activeSessionId || secondsLeft > 0 || isCompleting || isStartingSession) {
      return;
    }
    stopRecording();
    submitAnswer({ autoAdvance: true, fromTimer: true });
  }, [secondsLeft, started, activeSessionId, isCompleting, isStartingSession]);

  useEffect(() => {
    if (!started || isInterviewLive || hasSpokenWelcomeRef.current) {
      return;
    }
    const userName = user?.name || "candidate";
    speakText(
      `Welcome to your mock interview, ${userName}. Shall we start our interview? Please click OK to continue.`
    );
    hasSpokenWelcomeRef.current = true;
  }, [started, isInterviewLive, user?.name]);

  useEffect(() => {
    if (!started || !isInterviewLive || !currentQuestion?.question) {
      return;
    }
    const prompt = `Question ${currentIndex + 1}. ${currentQuestion.question}`;
    speakText(prompt);
    if (STRICT_VOICE_ONLY_MODE && speechSupported) {
      const startTimer = setTimeout(() => {
        startRecording();
      }, 800);
      return () => clearTimeout(startTimer);
    }
  }, [started, isInterviewLive, currentIndex, currentQuestion?.question]);

  async function completeInterview() {
    if (!activeSessionId) {
      setStatusMessage("Session ID missing. Start a new interview session.");
      return;
    }
    setIsCompleting(true);
    setStatusMessage("");
    try {
      const webcamAnalytics = webcamReady ? buildSummary() : null;
      const result = await apiRequest(`/interviews/${activeSessionId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          webcamAnalytics
        })
      });
      stopCamera();
      localStorage.removeItem(ACTIVE_INTERVIEW_SESSION_KEY);
      setActiveSessionId("");
      setStarted(false);
      setIsInterviewLive(false);
      setIsPreparingInterview(false);
      hasSpokenWelcomeRef.current = false;
      setSearchParams({ roleTrack: selectedRoleTrack || "Software Engineer" });
      const score = Number(result?.interviewScoreOutOf10 || 0);
      setStatusMessage(
        `Interview completed. Final interview score: ${score.toFixed(
          1
        )}/10. Performance + webcam analytics saved.`
      );
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
      setIsInterviewLive(false);
      setIsPreparingInterview(false);
      hasSpokenWelcomeRef.current = false;
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
      const incomingQuestions = (generated.questions || []).slice(0, MAX_INTERVIEW_QUESTIONS);
      if (!newSessionId || incomingQuestions.length === 0) {
        throw new Error("Failed to create interview session. Please retry.");
      }

      localStorage.setItem(ACTIVE_INTERVIEW_SESSION_KEY, newSessionId);
      // We already have generated questions in-hand, so skip the immediate re-fetch cycle once.
      skipNextAutoLoadRef.current = true;
      setActiveSessionId(newSessionId);
      setCurrentDifficulty(generated.session?.difficulty || incomingQuestions[0]?.difficulty || "Medium");
      setCurrentIndex(0);
      setAnswers({});
      setFollowUpsAsked(0);
      setStarted(true);
      setIsInterviewLive(false);
      setIsPreparingInterview(false);
      setBaseQuestions(incomingQuestions);
      setQuestionFlow(
        incomingQuestions.map((question, idx) => ({
          ...question,
          rootQuestionIndex: idx,
          isFollowUp: false
        }))
      );
      setSearchParams({
        sessionId: newSessionId,
        roleTrack: selectedRoleTrack
      });
      const userName = user?.name || "Candidate";
      setStatusMessage(`Welcome ${userName}. Shall we start our interview?`);
    } catch (err) {
      setStatusMessage(err.message || "Unable to create interview session.");
    } finally {
      setIsStartingSession(false);
    }
  }

  async function beginInterview() {
    if (isPreparingInterview || isInterviewLive) {
      return;
    }
    if (STRICT_VOICE_ONLY_MODE && !speechSupported) {
      setStatusMessage(
        "Voice-only interview mode requires Speech Recognition support. Use Chrome or Edge."
      );
      return;
    }
    setIsPreparingInterview(true);
    setStatusMessage("Please allow webcam access to start the interview.");
    try {
      await startCamera();
      setIsInterviewLive(true);
      setSecondsLeft(QUESTION_TIME_SECONDS);
      setStatusMessage("Interview started. Listen to the question and answer within 60 seconds.");
    } catch {
      setStatusMessage("Webcam permission is required to start the interview.");
      setIsInterviewLive(false);
    } finally {
      setIsPreparingInterview(false);
    }
  }

  if (!started) {
    return (
      <main className="resume-container">
        <button
          type="button"
          aria-label="Go back"
          onClick={handleBrowserLikeBack}
          style={{
            position: "fixed",
            top: "72px",
            left: "12px",
            width: "40px",
            height: "40px",
            padding: 0,
            borderRadius: "999px",
            zIndex: 999,
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)"
          }}
        >
          ←
        </button>
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
      <button
        type="button"
        aria-label="Go back"
        onClick={handleBrowserLikeBack}
        style={{
          position: "fixed",
          top: "72px",
          left: "12px",
          width: "40px",
          height: "40px",
          padding: 0,
          borderRadius: "999px",
          zIndex: 999,
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)"
        }}
      >
        ←
      </button>
      <div className="resume-card">
        <h1>Interview Session</h1>
        <p className="helper-text">
          Role Track: <strong>{selectedRoleTrack || "Software Engineer"}</strong>
        </p>
        <p className="helper-text">
          Current adaptive difficulty: <strong>{currentDifficulty}</strong>
        </p>
        <p className="helper-text">
          Question {Math.min(currentIndex + 1, MAX_INTERVIEW_QUESTIONS)} of{" "}
          {Math.min(questionFlow.length, MAX_INTERVIEW_QUESTIONS)}
        </p>

        {!isInterviewLive && (
          <section className="preview-section">
            <p className="helper-text">
              Welcome {user?.name || "Candidate"}. Shall we start our interview?
            </p>
            <button type="button" onClick={beginInterview} disabled={isPreparingInterview}>
              {isPreparingInterview ? "Requesting webcam permission..." : "OK, Start Interview"}
            </button>
          </section>
        )}

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
            Time left: {isInterviewLive ? secondsLeft : QUESTION_TIME_SECONDS}s
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
          <p className="helper-text">
            Voice-only mode is active. Recording starts automatically for each question.
          </p>
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
          <button
            type="button"
            onClick={() => {
              stopRecording();
              submitAnswer({ autoAdvance: true });
            }}
            disabled={!isInterviewLive || isSubmittingRef.current || isCompleting}
          >
            {isFinalQuestion ? "Submit & Complete" : "Submit Answer"}
          </button>
          <button
            type="button"
            onClick={completeInterview}
            disabled={isCompleting || !activeSessionId}
          >
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
