import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

export function ResumeUploadPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [loadingParse, setLoadingParse] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadResumes() {
    const data = await apiRequest("/resumes");
    setResumes(data.resumes || []);
  }

  useEffect(() => {
    loadResumes().catch((err) => setError(err.message));
  }, []);

  async function handleParse(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!file) {
      setError("Please select a PDF resume first.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    setLoadingParse(true);
    try {
      const data = await apiRequest("/resumes/parse", {
        method: "POST",
        body: formData
      });
      setPreview(data.preview);
      setMessage("Resume parsed successfully. Review and save.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingParse(false);
    }
  }

  async function handleSave() {
    if (!preview) {
      return;
    }
    setLoadingSave(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("/resumes", {
        method: "POST",
        body: JSON.stringify(preview)
      });
      setMessage("Parsed resume saved.");
      setPreview(null);
      setFile(null);
      await loadResumes();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSave(false);
    }
  }

  return (
    <main className="resume-container">
      <div className="resume-card">
        <h1>Resume Upload & Parsing</h1>
        <form onSubmit={handleParse} className="resume-form">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button type="submit" disabled={loadingParse}>
            {loadingParse ? "Parsing..." : "Upload & Parse"}
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}

        {preview && (
          <section className="preview-section">
            <h2>Parsed Preview</h2>
            <p>
              <strong>File:</strong> {preview.fileName}
            </p>
            <PreviewList title="Skills" items={preview.skills} />
            <PreviewList title="Projects" items={preview.projects} />
            <PreviewList title="Education" items={preview.education} />
            <details>
              <summary>Raw text preview</summary>
              <p className="raw-preview">{preview.rawText.slice(0, 1200)}</p>
            </details>
            <button type="button" onClick={handleSave} disabled={loadingSave}>
              {loadingSave ? "Saving..." : "Save Parsed Resume"}
            </button>
          </section>
        )}

        <section className="preview-section">
          <h2>Saved Resumes</h2>
          {resumes.length === 0 ? (
            <p className="helper-text">No resumes saved yet.</p>
          ) : (
            <ul>
              {resumes.map((resume) => (
                <li key={resume._id}>
                  {resume.fileName} - {new Date(resume.createdAt).toLocaleString()}
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
        <p className="helper-text">No {title.toLowerCase()} extracted.</p>
      )}
    </div>
  );
}
