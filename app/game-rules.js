export const ARRIVAL_MINUTES = [500, 575, 670, 760, 855, 950, 1040, 1130];

export const IDEAL_ACTION = Object.freeze({
  normal: 'verify',
  caution: 'pause',
  scam: 'block',
});

export function formatGameClock(minutes) {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function calculateCaseScore({ correct, actionCorrect, confidence, evidenceCount }) {
  const reward = confidence === 90 ? 120 : confidence === 70 ? 100 : 80;
  const penalty = confidence === 90 ? 90 : confidence === 70 ? 60 : 35;
  const evidenceBonus = Math.max(0, evidenceCount) * 20;
  const actionBonus = actionCorrect ? 50 : 0;
  return (correct ? reward : -penalty) + evidenceBonus + actionBonus;
}

export function advanceCaseProgress({ activeIndex, availableCount, resultCount, totalCases }) {
  if (resultCount >= totalCases) {
    return { activeIndex, availableCount, complete: true, unlocked: false };
  }
  if (activeIndex < availableCount - 1) {
    return { activeIndex: availableCount - 1, availableCount, complete: false, unlocked: false };
  }
  const nextAvailableCount = Math.min(availableCount + 1, totalCases);
  return {
    activeIndex: Math.min(availableCount, totalCases - 1),
    availableCount: nextAvailableCount,
    complete: false,
    unlocked: nextAvailableCount > availableCount,
  };
}
