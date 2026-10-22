'use strict';

/**
 * SuperMemo-2 (SM-2) Spaced Repetition Algorithm
 *
 * Quality ratings (q):
 * 5 - Perfect response, instant recall
 * 4 - Correct response after a hesitation
 * 3 - Correct response recalled with serious difficulty
 * 2 - Incorrect response; where the correct one seemed easy to recall
 * 1 - Incorrect response; the correct one remembered
 * 0 - Complete blackout
 */

function calculateSM2(current = {}, quality = 0) {
  const q = Math.max(0, Math.min(5, Number(quality) || 0));
  let repetitions = Number(current.repetitions) || 0;
  let easeFactor = Number(current.easeFactor) || 2.5;
  let interval = Number(current.interval) || 0;
  let streak = Number(current.streak) || 0;

  if (q >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
    streak += 1;
  } else {
    repetitions = 0;
    interval = 1;
    streak = 0;
  }

  // Calculate new Ease Factor (EF)
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;
  if (easeFactor > 3.0) easeFactor = 3.0;

  const now = Date.now();
  const nextReviewDate = new Date(now + interval * 24 * 60 * 60 * 1000).toISOString();
  const mastered = streak >= 3;

  return {
    repetitions,
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval,
    streak,
    mastered,
    lastReviewedAt: new Date(now).toISOString(),
    nextReviewDate,
  };
}

module.exports = { calculateSM2 };
