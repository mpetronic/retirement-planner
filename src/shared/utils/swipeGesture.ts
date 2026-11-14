/** Minimum horizontal travel for a swipe to count. */
export const SWIPE_MIN_DISTANCE_PX = 80;
/** Horizontal travel must exceed vertical travel by this factor, so scrolling is not a swipe. */
export const SWIPE_HORIZONTAL_DOMINANCE_RATIO = 1.5;
/** Slower drags are treated as deliberate movement, not a swipe. */
export const SWIPE_MAX_DURATION_MS = 600;
/** Swipes starting this close to a screen edge are left to the system back gesture. */
export const SWIPE_EDGE_MARGIN_PX = 24;

export type SwipeDirection = 'left' | 'right' | 'none';

export interface SwipeInput {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
  viewportWidth: number;
}

/**
 * Classifies a finished touch as a left swipe, a right swipe, or neither.
 * A left swipe may not start in the right edge margin, and a right swipe may not
 * start in the left edge margin, because those edges belong to the system back gesture.
 */
export function detectHorizontalSwipe(input: SwipeInput): SwipeDirection {
  const { startX, startY, endX, endY, durationMs, viewportWidth } = input;
  const dx = endX - startX;
  const dy = endY - startY;

  if (durationMs > SWIPE_MAX_DURATION_MS) return 'none';
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX) return 'none';
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_HORIZONTAL_DOMINANCE_RATIO) return 'none';

  if (dx < 0) {
    return startX > viewportWidth - SWIPE_EDGE_MARGIN_PX ? 'none' : 'left';
  }
  return startX < SWIPE_EDGE_MARGIN_PX ? 'none' : 'right';
}
