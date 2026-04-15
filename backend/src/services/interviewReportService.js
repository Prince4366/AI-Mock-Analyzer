import PDFDocument from "pdfkit";
import { AnswerEvaluation } from "../models/AnswerEvaluation.js";
import { buildWeaknessAnalysis } from "./weaknessAnalysis.js";

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function buildRoadmapFromWeaknesses(weakDimensions, weakTopics) {
  const roadmap = [];
  weakDimensions.slice(0, 2).forEach((item) => {
    roadmap.push(
      `Practice ${item.dimension} with structured STAR-style answers and daily 20-minute drills.`
    );
  });
  weakTopics.slice(0, 3).forEach((topic) => {
    roadmap.push(`Revise ${topic.topic} concepts and solve 2 targeted exercises this week.`);
  });
  if (roadmap.length === 0) {
    roadmap.push("Maintain current performance with 2 mock sessions per week and reflection notes.");
  }
  return roadmap;
}

export async function buildInterviewReportData({ user, session }) {
  const evaluations = await AnswerEvaluation.find({
    userId: user._id,
    sessionId: session._id
  }).sort({ questionIndex: 1, createdAt: 1 });

  const overallScore = Number(avg(evaluations.map((item) => item.overallScore)).toFixed(2));
  const weaknessAnalysis =
    evaluations.length > 0
      ? buildWeaknessAnalysis(evaluations)
      : { weakDimensions: [], weakTopics: [], recommendations: [] };

  const strengthsSummary = [];
  if (overallScore >= 7) strengthsSummary.push("Strong overall interview performance.");
  if ((session.speechAnswerAnalytics || []).length > 0) {
    const speechConfidence = avg(
      session.speechAnswerAnalytics.map((item) => item.confidenceScore || 0)
    );
    if (speechConfidence >= 70) strengthsSummary.push("Confident verbal delivery across responses.");
  }
  if (session.webcamAnalytics?.confidenceScore >= 70) {
    strengthsSummary.push("Positive visual confidence and posture indicators.");
  }

  const weaknessSummary = weaknessAnalysis.weakDimensions.map(
    (item) => `${item.dimension} needs improvement (${item.averageScore.toFixed(1)}/10).`
  );

  const roadmap = buildRoadmapFromWeaknesses(
    weaknessAnalysis.weakDimensions || [],
    weaknessAnalysis.weakTopics || []
  );

  const questionFeedback = evaluations.map((item) => ({
    questionIndex: item.questionIndex,
    question: item.question,
    overallScore: Number(item.overallScore || 0),
    feedbackSummary: item.feedback?.summary || "No summary provided",
    strengths: item.feedback?.strengths || [],
    improvements: item.feedback?.improvements || []
  }));

  return {
    metadata: {
      userName: user.name,
      interviewType: "AI Mock Interview",
      roleTrack: session.roleTrack || "",
      difficulty: session.difficulty || ""
    },
    summary: {
      overallScore,
      strengths: strengthsSummary,
      weaknesses: weaknessSummary,
      recommendations: weaknessAnalysis.recommendations || [],
      roadmap
    },
    questionFeedback,
    speechAnalytics: session.speechAnswerAnalytics || [],
    facialPostureAnalytics: session.webcamAnalytics || null
  };
}

export function generateInterviewPdfBuffer({ report, session }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(22).fillColor("#0f172a").text("AI Mock Interview Performance Report");
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .fillColor("#475569")
      .text(`Candidate: ${report.metadata.userName}`)
      .text(`Date: ${new Date(report.reportDate).toLocaleString()}`)
      .text(`Interview Type: ${report.metadata.interviewType}`)
      .text(`Role Track: ${report.metadata.roleTrack} | Difficulty: ${report.metadata.difficulty}`);

    doc.moveDown();
    doc.fontSize(16).fillColor("#111827").text("Overall Performance");
    doc
      .fontSize(12)
      .fillColor("#1f2937")
      .text(`Overall Score: ${report.summary.overallScore}/10`)
      .text(`Session: ${session.title}`);

    doc.moveDown(0.6);
    doc.fontSize(14).text("Strengths");
    (report.summary.strengths || ["No strengths summary available."]).forEach((line) => {
      doc.fontSize(11).text(`- ${line}`);
    });

    doc.moveDown(0.5);
    doc.fontSize(14).text("Weaknesses");
    (report.summary.weaknesses || ["No weakness summary available."]).forEach((line) => {
      doc.fontSize(11).text(`- ${line}`);
    });

    doc.moveDown(0.5);
    doc.fontSize(14).text("Suggested Improvement Roadmap");
    (report.summary.roadmap || []).forEach((line) => doc.fontSize(11).text(`- ${line}`));

    doc.moveDown(0.5);
    doc.fontSize(14).text("Personalized Recommendations");
    (report.summary.recommendations || []).forEach((line) => doc.fontSize(11).text(`- ${line}`));

    if (report.facialPostureAnalytics) {
      doc.addPage();
      doc.fontSize(15).text("Facial and Posture Metrics");
      doc
        .fontSize(11)
        .text(`Eye Contact: ${report.facialPostureAnalytics.eyeContactPercent || 0}%`)
        .text(`Posture Quality: ${report.facialPostureAnalytics.postureQualityPercent || 0}%`)
        .text(`Smile Frequency: ${report.facialPostureAnalytics.smileFrequencyPercent || 0}%`)
        .text(`Confidence Score: ${report.facialPostureAnalytics.confidenceScore || 0}%`);
    }

    if ((report.speechAnalytics || []).length > 0) {
      doc.moveDown(0.6);
      doc.fontSize(15).text("Speech Metrics");
      report.speechAnalytics.slice(0, 10).forEach((item) => {
        doc
          .fontSize(11)
          .text(
            `Q${Number(item.questionIndex) + 1}: ${item.wordsPerMinute} WPM | Pauses ${item.pauseCount} | Fillers ${item.fillerWordRatio}% | Confidence ${item.confidenceScore}/100`
          );
      });
    }

    doc.addPage();
    doc.fontSize(16).text("Question-by-Question Feedback");
    (report.questionFeedback || []).forEach((item) => {
      doc
        .moveDown(0.5)
        .fontSize(12)
        .fillColor("#111827")
        .text(`Q${Number(item.questionIndex) + 1} (${item.overallScore}/10): ${item.question}`);
      doc.fontSize(10).fillColor("#374151").text(`Summary: ${item.feedbackSummary}`);
      (item.strengths || []).slice(0, 2).forEach((line) => doc.text(`+ ${line}`));
      (item.improvements || []).slice(0, 2).forEach((line) => doc.text(`- ${line}`));
    });

    doc.end();
  });
}
