import { format, parseISO, addMinutes, subMinutes } from 'date-fns';
import { formatInTimeZone, zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { SchedulerError, TimezoneConversion } from '@/types/scheduler';
import { logger } from './logger';

/**
 * Timezone utilities for DST-safe schedule handling
 * All times stored in database are in UTC, displayed times are in user's timezone
 */

// Supported timezones - can be extended
const SUPPORTED_TIMEZONES = [
  'Asia/Jerusalem',
  'Europe/London', 
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC'
] as const;

export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number];

export function isSupportedTimezone(tz: string): tz is SupportedTimezone {
  return SUPPORTED_TIMEZONES.includes(tz as SupportedTimezone);
}

/**
 * Get system timezone automatically
 * Falls back to Asia/Jerusalem if system timezone is not supported
 */
export function getSystemTimezone(): SupportedTimezone {
  try {
    // Check if timezone is configured via environment variable
    const envTimezone = process.env.DEFAULT_TIMEZONE;
    if (envTimezone && envTimezone !== 'auto') {
      if (isSupportedTimezone(envTimezone)) {
        logger.info(`Using configured timezone: ${envTimezone}`);
        return envTimezone;
      }
      logger.warn(`Configured timezone ${envTimezone} not supported, auto-detecting...`);
    }

    // Auto-detect system timezone
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isSupportedTimezone(systemTz)) {
      logger.info(`Auto-detected system timezone: ${systemTz}`);
      return systemTz;
    }
    logger.warn(`System timezone ${systemTz} not supported, falling back to Asia/Jerusalem`);
    return 'Asia/Jerusalem';
  } catch (error) {
    logger.warn('Failed to detect system timezone, falling back to Asia/Jerusalem', error);
    return 'Asia/Jerusalem';
  }
}

/**
 * Convert user's local time to UTC for storage
 * Handles DST transitions correctly
 */
export function convertToUTC(
  localDateTime: string, 
  timezone: string = getSystemTimezone()
): TimezoneConversion {
  try {
    if (!isSupportedTimezone(timezone)) {
      throw new SchedulerError('INVALID_TIMEZONE', `Unsupported timezone: ${timezone}`);
    }

    // Check if the input is already in UTC (ends with Z or +00:00)
    let utcDate: Date;
    let utcDateTime: string;
    
    if (localDateTime.endsWith('Z') || localDateTime.includes('+00:00') || localDateTime.includes('-00:00')) {
      // Input is already in UTC format
      utcDate = parseISO(localDateTime);
      utcDateTime = utcDate.toISOString();
      logger.debug('Input already in UTC format', { localDateTime, utcDateTime });
    } else {
      // Input is in local timezone, convert to UTC
      const localDate = parseISO(localDateTime);
      utcDate = zonedTimeToUtc(localDate, timezone);
      utcDateTime = utcDate.toISOString();
      logger.debug('Converting from local timezone to UTC', { localDateTime, timezone, utcDateTime });
    }
    
    // Create display version in user's timezone
    const displayDate = utcToZonedTime(utcDate, timezone);
    const localDisplayDateTime = formatInTimeZone(utcDate, timezone, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
    
    // Calculate timezone offset and DST info
    const now = new Date();
    const utcNow = zonedTimeToUtc(now, timezone);
    const localNow = utcToZonedTime(utcNow, timezone);
    const offsetMs = now.getTime() - utcNow.getTime();
    const offset = Math.round(offsetMs / (1000 * 60)); // minutes
    
    // DST detection (rough estimate)
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const jul1 = new Date(now.getFullYear(), 6, 1);
    const jan1Utc = zonedTimeToUtc(jan1, timezone);
    const jul1Utc = zonedTimeToUtc(jul1, timezone);
    const winterOffset = Math.round((jan1.getTime() - jan1Utc.getTime()) / (1000 * 60));
    const summerOffset = Math.round((jul1.getTime() - jul1Utc.getTime()) / (1000 * 60));
    const isDST = offset !== winterOffset;

    const result: TimezoneConversion = {
      userDateTime: localDateTime,
      userTimezone: timezone,
      utcDateTime,
      localDateTime: localDisplayDateTime,
      isDST,
      offset
    };

    logger.debug('Timezone conversion completed', result);
    return result;

  } catch (error) {
    logger.error('Timezone conversion failed', { localDateTime, timezone, error });
    if (error instanceof SchedulerError) {
      throw error;
    }
    throw new SchedulerError('INVALID_TIMEZONE', 'Invalid timezone conversion', error);
  }
}

/**
 * Convert UTC time back to user's local timezone for display
 */
export function convertFromUTC(
  utcDateTime: string, 
  timezone: string = 'Asia/Jerusalem'
): TimezoneConversion {
  try {
    if (!isSupportedTimezone(timezone)) {
      throw new SchedulerError('INVALID_TIMEZONE', `Unsupported timezone: ${timezone}`);
    }

    const utcDate = parseISO(utcDateTime);
    const localDate = utcToZonedTime(utcDate, timezone);
    const localDateTime = formatInTimeZone(utcDate, timezone, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
    
    // Calculate offset and DST
    const now = new Date();
    const utcNow = zonedTimeToUtc(now, timezone);
    const offsetMs = now.getTime() - utcNow.getTime();
    const offset = Math.round(offsetMs / (1000 * 60));

    const jan1 = new Date(now.getFullYear(), 0, 1);
    const jul1 = new Date(now.getFullYear(), 6, 1);
    const jan1Utc = zonedTimeToUtc(jan1, timezone);
    const jul1Utc = zonedTimeToUtc(jul1, timezone);
    const winterOffset = Math.round((jan1.getTime() - jan1Utc.getTime()) / (1000 * 60));
    const summerOffset = Math.round((jul1.getTime() - jul1Utc.getTime()) / (1000 * 60));
    const isDST = offset !== winterOffset;

    return {
      userDateTime: localDateTime,
      userTimezone: timezone,
      utcDateTime,
      localDateTime,
      isDST,
      offset
    };

  } catch (error) {
    logger.error('UTC to local conversion failed', { utcDateTime, timezone, error });
    throw new SchedulerError('INVALID_TIMEZONE', 'Invalid UTC to local conversion', error);
  }
}

/**
 * Validate that a scheduled time is in the future
 */
export function validateFutureTime(utcDateTime: string, minMinutesFromNow: number = 1): void {
  const scheduledTime = parseISO(utcDateTime);
  const minTime = addMinutes(new Date(), minMinutesFromNow);
  
  if (scheduledTime <= minTime) {
    throw new SchedulerError(
      'PAST_TIME', 
      `Scheduled time must be at least ${minMinutesFromNow} minutes in the future`
    );
  }
}

/**
 * Calculate minutes until execution
 */
export function getMinutesUntilExecution(utcDateTime: string): number {
  const scheduled = parseISO(utcDateTime);
  const now = new Date();
  const diffMs = scheduled.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60));
}

/**
 * Check if a time is within DST transition period (risky for scheduling)
 */
export function isDSTTransitionRisk(
  utcDateTime: string, 
  timezone: string = 'Asia/Jerusalem'
): boolean {
  try {
    const utcDate = parseISO(utcDateTime);
    const localDate = utcToZonedTime(utcDate, timezone);
    
    // Get the hour before and after to check for DST transition
    const hourBefore = subMinutes(localDate, 60);
    const hourAfter = addMinutes(localDate, 60);
    
    const utcBefore = zonedTimeToUtc(hourBefore, timezone);
    const utcAfter = zonedTimeToUtc(hourAfter, timezone);
    
    const expectedDiffMs = 2 * 60 * 60 * 1000; // 2 hours
    const actualDiffMs = utcAfter.getTime() - utcBefore.getTime();
    
    // If the actual difference is not 2 hours, we're in a DST transition
    return Math.abs(actualDiffMs - expectedDiffMs) > (30 * 60 * 1000); // 30 min tolerance
    
  } catch (error) {
    logger.warn('DST transition check failed', { utcDateTime, timezone, error });
    return false; // Assume no risk on error
  }
}

/**
 * Get human-readable timezone info
 */
export function getTimezoneInfo(timezone: string = 'Asia/Jerusalem'): {
  name: string;
  abbreviation: string;
  offset: string;
  isDST: boolean;
} {
  try {
    const now = new Date();
    const utcNow = zonedTimeToUtc(now, timezone);
    const localNow = utcToZonedTime(utcNow, timezone);
    
    const offsetMs = now.getTime() - utcNow.getTime();
    const offsetMinutes = Math.round(offsetMs / (1000 * 60));
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const offsetString = `GMT${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')}`;

    // DST detection
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const jul1 = new Date(now.getFullYear(), 6, 1);
    const jan1Utc = zonedTimeToUtc(jan1, timezone);
    const jul1Utc = zonedTimeToUtc(jul1, timezone);
    const winterOffset = Math.round((jan1.getTime() - jan1Utc.getTime()) / (1000 * 60));
    const summerOffset = Math.round((jul1.getTime() - jul1Utc.getTime()) / (1000 * 60));
    const isDST = offsetMinutes !== winterOffset;

    // Abbreviation mapping
    const abbreviations: Record<string, { standard: string; dst: string }> = {
      'Asia/Jerusalem': { standard: 'IST', dst: 'IDT' },
      'Europe/London': { standard: 'GMT', dst: 'BST' },
      'America/New_York': { standard: 'EST', dst: 'EDT' },
      'America/Los_Angeles': { standard: 'PST', dst: 'PDT' },
      'Europe/Berlin': { standard: 'CET', dst: 'CEST' },
      'Asia/Tokyo': { standard: 'JST', dst: 'JST' }, // Japan doesn't use DST
      'Australia/Sydney': { standard: 'AEST', dst: 'AEDT' },
      'UTC': { standard: 'UTC', dst: 'UTC' }
    };

    const abbr = abbreviations[timezone];
    const abbreviation = abbr ? (isDST ? abbr.dst : abbr.standard) : 'UNK';

    return {
      name: timezone,
      abbreviation,
      offset: offsetString,
      isDST
    };

  } catch (error) {
    logger.error('Failed to get timezone info', { timezone, error });
    return {
      name: timezone,
      abbreviation: 'UNK',
      offset: 'GMT+00:00',
      isDST: false
    };
  }
}

/**
 * Format a date for display in a specific timezone
 */
export function formatForTimezone(
  utcDateTime: string, 
  timezone: string = 'Asia/Jerusalem',
  formatStr: string = 'yyyy-MM-dd HH:mm:ss'
): string {
  try {
    return formatInTimeZone(parseISO(utcDateTime), timezone, formatStr);
  } catch (error) {
    logger.error('Date formatting failed', { utcDateTime, timezone, formatStr, error });
    return utcDateTime; // Fallback to original
  }
}

/**
 * Get next valid scheduling time (avoiding DST transitions)
 */
export function getNextValidScheduleTime(
  baseTime: Date, 
  timezone: string = 'Asia/Jerusalem'
): Date {
  let candidateTime = baseTime;
  let attempts = 0;
  
  while (attempts < 24) { // Max 24 hours ahead
    const candidateUTC = candidateTime.toISOString();
    
    if (!isDSTTransitionRisk(candidateUTC, timezone)) {
      return candidateTime;
    }
    
    // Move forward by 1 hour and try again
    candidateTime = addMinutes(candidateTime, 60);
    attempts++;
  }
  
  // If we can't find a safe time, just return the original
  logger.warn('Could not find DST-safe schedule time', { baseTime, timezone });
  return baseTime;
}