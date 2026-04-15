import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

const features = [
  {
    icon: "🧠",
    title: "AI Interview Generation",
    text: "Personalized questions from your resume and target job description."
  },
  {
    icon: "🎙️",
    title: "Voice + Text Practice",
    text: "Answer naturally with speech-to-text or typed responses."
  },
  {
    icon: "📊",
    title: "Score & Analytics",
    text: "Get deep evaluation scores, trends, and focused improvement insights."
  },
  {
    icon: "🧩",
    title: "Dynamic Follow-ups",
    text: "Context-aware follow-up questions that mimic real interviews."
  }
];

const testimonials = [
  {
    quote:
      "The quality of follow-up questions felt like a real hiring manager. I walked into interviews much more confident.",
    name: "Aman S.",
    role: "Software Engineer Candidate"
  },
  {
    quote:
      "The weakness analysis and timeline made my preparation measurable week to week. Huge upgrade over random practice.",
    name: "Priya K.",
    role: "Product Analyst Candidate"
  }
];

const faqs = [
  {
    q: "How are interview questions personalized?",
    a: "The platform blends your resume strengths, project history, and job description requirements to generate role-specific questions."
  },
  {
    q: "Can I use this for technical and behavioral rounds?",
    a: "Yes. It supports technical, HR, and behavioral formats with adjustable difficulty levels."
  },
  {
    q: "How is my answer evaluated?",
    a: "Answers are scored across relevance, technical depth, clarity, and completeness, then combined with semantic similarity."
  },
  {
    q: "Is my data secure?",
    a: "All sessions are protected with authentication and server-side validation. You control your profile and interview records."
  }
];

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [openFaq, setOpenFaq] = useState(0);
  const primaryCta = useMemo(
    () => (isAuthenticated ? "/interview-session" : "/signup"),
    [isAuthenticated]
  );

  return (
    <main className="landing-page">
      <section className="hero">
        <div className="hero-bg-glow" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="hero-card"
        >
          <p className="badge">AI-Powered Interview Copilot</p>
          <h1>Ace Interviews with Personalized AI Mock Sessions</h1>
          <p className="hero-sub">
            Generate tailored interviews from your resume and job description, get
            expert-grade answer feedback, and track progress with advanced
            performance analytics.
          </p>
          <div className="hero-cta">
            <Link className="link-button" to={primaryCta}>
              Start Interview
            </Link>
            <a className="ghost-button" href="#preview">
              Watch Demo
            </a>
          </div>
          <div className="hero-trust">
            <span>Trusted by early-stage job seekers and career coaches</span>
            <strong>10,000+ answers evaluated</strong>
          </div>
        </motion.div>
      </section>

      <section className="landing-section">
        <p className="section-kicker">Core Platform</p>
        <h2>Feature Highlights</h2>
        <p className="section-sub">
          Everything you need to prepare smarter and improve faster.
        </p>
        <div className="feature-grid">
          {features.map((f, idx) => (
            <motion.article
              key={f.title}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
            >
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <p className="section-kicker">Simple Workflow</p>
        <h2>How It Works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <strong>1</strong>
            <p>Upload resume + job description.</p>
          </div>
          <div className="step-card">
            <strong>2</strong>
            <p>Practice interview with AI-generated questions and follow-ups.</p>
          </div>
          <div className="step-card">
            <strong>3</strong>
            <p>Review scores, weaknesses, and track improvements over time.</p>
          </div>
        </div>
      </section>

      <section id="preview" className="landing-section">
        <p className="section-kicker">Product Experience</p>
        <h2>Product Preview</h2>
        <div className="preview-mockup">
          <div className="mockup-sidebar" />
          <div className="mockup-main">
            <div className="mockup-chart" />
            <div className="mockup-chart small" />
            <div className="mockup-chart small" />
          </div>
        </div>
      </section>

      <section className="landing-section">
        <p className="section-kicker">Customer Outcomes</p>
        <h2>Outcomes Teams Love</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>92%</h3>
            <p>Users report higher interview confidence after 2 weeks.</p>
          </div>
          <div className="metric-card">
            <h3>3.2x</h3>
            <p>Faster preparation compared to manual mock practice.</p>
          </div>
          <div className="metric-card">
            <h3>10k+</h3>
            <p>Mock answers evaluated with actionable feedback.</p>
          </div>
        </div>
        <div className="testimonials-grid">
          {testimonials.map((item) => (
            <article key={item.name} className="testimonial-card">
              <p>"{item.quote}"</p>
              <div>
                <strong>{item.name}</strong>
                <span>{item.role}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <p className="section-kicker">Plans</p>
        <h2>Pricing</h2>
        <div className="pricing-grid">
          <div className="pricing-card">
            <h3>Starter</h3>
            <p>Free trial / limited interviews</p>
          </div>
          <div className="pricing-card featured">
            <h3>Pro</h3>
            <p>Unlimited interviews + advanced analytics</p>
          </div>
          <div className="pricing-card">
            <h3>Team</h3>
            <p>Collaborative prep for coaching programs</p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <p className="section-kicker">Questions</p>
        <h2>FAQ</h2>
        <div className="faq-list">
          {faqs.map((item, idx) => (
            <motion.button
              key={item.q}
              type="button"
              className="faq-item"
              onClick={() => setOpenFaq((prev) => (prev === idx ? -1 : idx))}
              whileHover={{ y: -1 }}
            >
              <div className="faq-question">
                <span>{item.q}</span>
                <span>{openFaq === idx ? "-" : "+"}</span>
              </div>
              <AnimatePresence initial={false}>
                {openFaq === idx && (
                  <motion.p
                    className="faq-answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {item.a}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>AI Mock Interview Analyzer</strong>
          <p>Build confidence. Improve performance. Get hired faster.</p>
        </div>
        <p>© {new Date().getFullYear()} AI Mock Interview Analyzer. All rights reserved.</p>
      </footer>
    </main>
  );
}
