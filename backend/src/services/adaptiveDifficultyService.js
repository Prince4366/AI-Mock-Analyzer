const ORDER = ["Easy", "Medium", "Hard", "Expert"];

function clampIndex(index) {
  return Math.max(0, Math.min(ORDER.length - 1, index));
}

export function adaptDifficulty(currentDifficulty, answerScore) {
  const currentIndex = ORDER.indexOf(currentDifficulty);
  const safeIndex = currentIndex === -1 ? 1 : currentIndex;
  const score = Number(answerScore) || 0;

  // Strong answer -> increase challenge; weak answer -> provide support.
  if (score >= 8) {
    return ORDER[clampIndex(safeIndex + 1)];
  }
  if (score <= 5) {
    return ORDER[clampIndex(safeIndex - 1)];
  }
  return ORDER[safeIndex];
}

export function normalizeDifficulty(value) {
  return ORDER.includes(value) ? value : "Medium";
}
