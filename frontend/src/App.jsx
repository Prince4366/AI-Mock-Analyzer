import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { useAuth } from "./hooks/useAuth";

const ResumeUploadPage = lazy(() =>
  import("./pages/ResumeUploadPage").then((module) => ({ default: module.ResumeUploadPage }))
);
const JobDescriptionPage = lazy(() =>
  import("./pages/JobDescriptionPage").then((module) => ({
    default: module.JobDescriptionPage
  }))
);
const InterviewSessionPage = lazy(() =>
  import("./pages/InterviewSessionPage").then((module) => ({
    default: module.InterviewSessionPage
  }))
);
const AnalyticsDashboardPage = lazy(() =>
  import("./pages/AnalyticsDashboardPage").then((module) => ({
    default: module.AnalyticsDashboardPage
  }))
);
const InterviewHistoryPage = lazy(() =>
  import("./pages/InterviewHistoryPage").then((module) => ({
    default: module.InterviewHistoryPage
  }))
);

function AuthRedirect({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <p className="status-message">Loading...</p>;
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<p className="status-message">Loading page...</p>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics-dashboard"
            element={
              <ProtectedRoute>
                <AnalyticsDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview-history"
            element={
              <ProtectedRoute>
                <InterviewHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resumes"
            element={
              <ProtectedRoute>
                <ResumeUploadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/job-descriptions"
            element={
              <ProtectedRoute>
                <JobDescriptionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview-session"
            element={
              <ProtectedRoute>
                <InterviewSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <AuthRedirect>
                <LoginPage />
              </AuthRedirect>
            }
          />
          <Route
            path="/signup"
            element={
              <AuthRedirect>
                <SignupPage />
              </AuthRedirect>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
