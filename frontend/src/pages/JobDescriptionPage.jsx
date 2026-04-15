import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

export function JobDescriptionPage() {
  const [sessionId, setSessionId] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [savedList, setSavedList] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadSaved() {
    const data = await apiRequest("/job-descriptions");
    setSavedList(data.jobDescriptions || []);
  }

  useEffect(() => {
    loadSaved().catch((err) => setError(err.message));
  }, []);

  function validateBeforeParse() {
    if (!text.trim() && !file) {
      return "Paste a job description or upload a PDF/TXT file.";
    }
    if (text.trim() && file) {
      return "Use either pasted text or a file upload, not both.";
    }
    return "";
  }

  async function handleParse(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPreview(null);

    const validationError = validateBeforeParse();
    if (validationError) {
      setError(validationError);
      return;
    }

    setParsing(true);
    try {
      let data;
      if (text.trim()) {
        data = await apiRequest("/job-descriptions/parse", {
          method: "POST",
          body: JSON.stringify({ text })
        });
      } else {
        const formData = new FormData();
        formData.append("jdFile", file);
        data = await apiRequest("/job-descriptions/parse", {
          method: "POST",
          body: formData
        });
      }
      setPreview(data.preview);
      setMessage("JD parsed. Review extracted skills/keywords, then save.");
    } catch (err) {
      setError(err.message || "Failed to parse JD");
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    setError("");
    setMessage("");

    if (!preview) {
      setError("Parse a JD first.");
      return;
    }
    if (!sessionId.trim()) {
      setError("Interview Session ID is required before saving.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/job-descriptions", {
        method: "POST",
        body: JSON.stringify({
          interviewSessionId: sessionId.trim(),
          ...preview
        })
      });
      setMessage("Job description saved successfully.");
      setPreview(null);
      setText("");
      setFile(null);
      await loadSaved();
    } catch (err) {
      setError(err.message || "Failed to save JD");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="resume-container">
      <div className="resume-card">
        <h1>Job Description Module</h1>
        <form className="resume-form" onSubmit={handleParse}>
          <label htmlFor="sessionId">Interview Session ID</label>
          <input
            id="sessionId"
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="e.g. interview_2026_04_13_001"
          />

          <label htmlFor="jdText">Paste JD text</label>
          <textarea
            id="jdText"
            className="jd-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste complete job description here..."
          />

          <p className="helper-text">Or upload JD file (PDF/TXT)</p>
          <input
            type="file"
            accept="application/pdf,text/plain,.txt"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <button type="submit" disabled={parsing}>
            {parsing ? "Parsing JD..." : "Parse Job Description"}
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}

        {preview && (
          <section className="preview-section">
            <h2>Parsed Preview</h2>
            <p>
              <strong>Source:</strong> {preview.sourceType}
              {preview.fileName ? ` (${preview.fileName})` : ""}
            </p>
            <PreviewList title="Extracted Skills" items={preview.skills} />
            <PreviewList title="Extracted Keywords" items={preview.keywords} />
            <details>
              <summary>Raw text preview</summary>
              <p className="raw-preview">{preview.rawText.slice(0, 1500)}</p>
            </details>
            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save JD to Session"}
            </button>
          </section>
        )}

        <section className="preview-section">
          <h2>Saved Job Descriptions</h2>
          {savedList.length === 0 ? (
            <p className="helper-text">No job descriptions saved yet.</p>
          ) : (
            <ul>
              {savedList.map((jd) => (
                <li key={jd._id}>
                  {jd.interviewSessionId} - {new Date(jd.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function PreviewList({ title, items }) {
  return (
    <div>
      <h3>{title}</h3>
      {items?.length ? (
        <ul>
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="helper-text">No items extracted.</p>
      )}
    </div>
  );
}
