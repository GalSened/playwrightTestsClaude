/**
 * Virtual Clock Test Helper
 * Provides deterministic time control for testing time-sensitive logic
 */

import { beforeEach, afterEach, vi } from 'vitest';

/**
 * Virtual clock state
 */
export class VirtualClock {
  private currentTime: number;
  private originalDateNow: typeof Date.now;
  private originalDateConstructor: typeof Date;
  private timers: NodeJS.Timeout[] = [];

  constructor(initialTime?: Date | number) {
    this.currentTime = initialTime
      ? typeof initialTime === 'number'
        ? initialTime
        : initialTime.getTime()
      : Date.now();

    this.originalDateNow = Date.now;
    this.originalDateConstructor = Date;
  }

  /**
   * Install fake timers and Date.now()
   */
  install(): void {
    vi.useFakeTimers();
    vi.setSystemTime(this.currentTime);
  }

  /**
   * Restore real timers
   */
  uninstall(): void {
    vi.useRealTimers();
    this.clearTimers();
  }

  /**
   * Advance time by milliseconds
   */
  async tick(ms: number): Promise<void> {
    this.currentTime += ms;
    await vi.advanceTimersByTimeAsync(ms);
  }

  /**
   * Advance time to next timer
   */
  async tickNext(): Promise<void> {
    await vi.runOnlyPendingTimersAsync();
  }

  /**
   * Advance time and run all pending timers
   */
  async tickAll(): Promise<void> {
    await vi.runAllTimersAsync();
  }

  /**
   * Set current time to a specific timestamp
   */
  setTime(time: Date | number): void {
    this.currentTime = typeof time === 'number' ? time : time.getTime();
    vi.setSystemTime(this.currentTime);
  }

  /**
   * Get current virtual time
   */
  now(): number {
    return this.currentTime;
  }

  /**
   * Get current virtual time as Date
   */
  nowAsDate(): Date {
    return new Date(this.currentTime);
  }

  /**
   * Get current virtual time as ISO string
   */
  nowAsISO(): string {
    return new Date(this.currentTime).toISOString();
  }

  /**
   * Register a timer for cleanup
   */
  registerTimer(timer: NodeJS.Timeout): void {
    this.timers.push(timer);
  }

  /**
   * Clear all registered timers
   */
  clearTimers(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  /**
   * Create a timestamp in the future
   */
  futureTime(offsetMs: number): Date {
    return new Date(this.currentTime + offsetMs);
  }

  /**
   * Create a timestamp in the past
   */
  pastTime(offsetMs: number): Date {
    return new Date(this.currentTime - offsetMs);
  }

  /**
   * Check if a timestamp is in the future
   */
  isFuture(time: Date | string): boolean {
    const ts = typeof time === 'string' ? new Date(time).getTime() : time.getTime();
    return ts > this.currentTime;
  }

  /**
   * Check if a timestamp is in the past
   */
  isPast(time: Date | string): boolean {
    const ts = typeof time === 'string' ? new Date(time).getTime() : time.getTime();
    return ts < this.currentTime;
  }

  /**
   * Check if a timestamp is expired relative to current time
   */
  isExpired(expiryTime: Date | string, gracePeriodMs: number = 0): boolean {
    const ts = typeof expiryTime === 'string' ? new Date(expiryTime).getTime() : expiryTime.getTime();
    return this.currentTime > ts + gracePeriodMs;
  }
}

/**
 * Create a virtual clock helper for tests
 */
export function createVirtualClock(initialTime?: Date | number): VirtualClock {
  return new VirtualClock(initialTime);
}

/**
 * Setup virtual clock in beforeEach/afterEach hooks
 */
export function setupVirtualClock(
  initialTime?: Date | number
): { clock: VirtualClock; cleanup: () => void } {
  const clock = createVirtualClock(initialTime);

  const setup = () => {
    clock.install();
  };

  const cleanup = () => {
    clock.uninstall();
  };

  beforeEach(setup);
  afterEach(cleanup);

  return { clock, cleanup };
}

/**
 * Utility: wait for a promise with virtual time
 */
export async function waitForWithVirtualTime<T>(
  clock: VirtualClock,
  promise: Promise<T>,
  advanceBy: number
): Promise<T> {
  const resultPromise = promise;
  await clock.tick(advanceBy);
  return resultPromise;
}

/**
 * Utility: simulate periodic heartbeat with virtual time
 */
export async function simulateHeartbeats(
  clock: VirtualClock,
  count: number,
  intervalMs: number
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await clock.tick(intervalMs);
  }
}

/**
 * Utility: simulate lease expiry scenario
 */
export async function simulateLeaseExpiry(
  clock: VirtualClock,
  leaseDurationMs: number,
  gracePeriodMs: number = 0
): Promise<void> {
  await clock.tick(leaseDurationMs + gracePeriodMs + 1);
}
