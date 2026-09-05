export const ARRIVAL_MINUTES = [500, 600, 760, 900, 1110, 1320];

export function formatGameClock(minutes) {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
