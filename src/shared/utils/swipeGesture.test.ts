import { describe, it, expect } from 'vitest';
import {
  detectHorizontalSwipe,
  SWIPE_EDGE_MARGIN_PX,
  SWIPE_MAX_DURATION_MS,
  SWIPE_MIN_DISTANCE_PX,
  type SwipeInput,
} from './swipeGesture';

const VIEWPORT_WIDTH = 400;

const swipe = (overrides: Partial<SwipeInput>): SwipeInput => ({
  startX: 300,
  startY: 400,
  endX: 150,
  endY: 410,
  durationMs: 200,
  viewportWidth: VIEWPORT_WIDTH,
  ...overrides,
});

describe('detectHorizontalSwipe', () => {
  it('detects a left swipe', () => {
    expect(detectHorizontalSwipe(swipe({}))).toBe('left');
  });

  it('detects a right swipe', () => {
    expect(detectHorizontalSwipe(swipe({ startX: 100, endX: 260 }))).toBe('right');
  });

  it('ignores travel shorter than the minimum distance', () => {
    expect(detectHorizontalSwipe(swipe({ startX: 300, endX: 300 - SWIPE_MIN_DISTANCE_PX + 1 }))).toBe('none');
    expect(detectHorizontalSwipe(swipe({ startX: 300, endX: 300 - SWIPE_MIN_DISTANCE_PX }))).toBe('left');
  });

  it('ignores slow drags', () => {
    expect(detectHorizontalSwipe(swipe({ durationMs: SWIPE_MAX_DURATION_MS + 1 }))).toBe('none');
    expect(detectHorizontalSwipe(swipe({ durationMs: SWIPE_MAX_DURATION_MS }))).toBe('left');
  });

  it('ignores mostly vertical movement', () => {
    expect(detectHorizontalSwipe(swipe({ startX: 300, endX: 200, startY: 300, endY: 450 }))).toBe('none');
  });

  it('ignores a left swipe that starts in the right edge margin', () => {
    const edgeStart = VIEWPORT_WIDTH - SWIPE_EDGE_MARGIN_PX + 1;
    expect(detectHorizontalSwipe(swipe({ startX: edgeStart, endX: edgeStart - 150 }))).toBe('none');
  });

  it('ignores a right swipe that starts in the left edge margin', () => {
    const edgeStart = SWIPE_EDGE_MARGIN_PX - 1;
    expect(detectHorizontalSwipe(swipe({ startX: edgeStart, endX: edgeStart + 150 }))).toBe('none');
  });

  it('allows a left swipe to end at the left edge and a right swipe to end at the right edge', () => {
    expect(detectHorizontalSwipe(swipe({ startX: 200, endX: 5 }))).toBe('left');
    expect(detectHorizontalSwipe(swipe({ startX: 200, endX: VIEWPORT_WIDTH - 1 }))).toBe('right');
  });
});
