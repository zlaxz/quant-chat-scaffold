/**
 * Date Utilities - Safe date parsing and formatting
 *
 * Wraps date-fns functions with error handling to prevent crashes
 * from malformed date strings.
 */

import {
  parseISO as dateFnsParseISO,
  format as dateFnsFormat,
  formatDistanceToNow as dateFnsFormatDistanceToNow,
  isToday as dateFnsIsToday,
  isYesterday as dateFnsIsYesterday,
  isValid,
  differenceInDays as dateFnsDifferenceInDays,
} from 'date-fns';

/**
 * Safely parse an ISO date string
 * Returns null if parsing fails or date is invalid
 */
export function safeParseISO(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  try {
    const date = dateFnsParseISO(dateStr);
    return isValid(date) ? date : null;
  } catch (error) {
    console.warn(`[dateUtils] Failed to parse date: ${dateStr}`, error);
    return null;
  }
}

/**
 * Safely format a date or ISO string
 * Returns fallback string if parsing/formatting fails
 */
export function safeFormat(
  date: Date | string | null | undefined,
  formatStr: string,
  fallback: string = 'Invalid date'
): string {
  try {
    const parsedDate = typeof date === 'string' ? safeParseISO(date) : date;
    if (!parsedDate || !isValid(parsedDate)) {
      return fallback;
    }
    return dateFnsFormat(parsedDate, formatStr);
  } catch (error) {
    console.warn(`[dateUtils] Failed to format date: ${date}`, error);
    return fallback;
  }
}

/**
 * Safely format distance to now
 * Returns fallback string if parsing fails
 */
export function safeFormatDistanceToNow(
  date: Date | string | null | undefined,
  fallback: string = 'Unknown'
): string {
  try {
    const parsedDate = typeof date === 'string' ? safeParseISO(date) : date;
    if (!parsedDate || !isValid(parsedDate)) {
      return fallback;
    }
    return dateFnsFormatDistanceToNow(parsedDate);
  } catch (error) {
    console.warn(`[dateUtils] Failed to format distance: ${date}`, error);
    return fallback;
  }
}

/**
 * Safely check if date is today
 */
export function safeIsToday(date: Date | string | null | undefined): boolean {
  try {
    const parsedDate = typeof date === 'string' ? safeParseISO(date) : date;
    if (!parsedDate || !isValid(parsedDate)) {
      return false;
    }
    return dateFnsIsToday(parsedDate);
  } catch {
    return false;
  }
}

/**
 * Safely check if date is yesterday
 */
export function safeIsYesterday(date: Date | string | null | undefined): boolean {
  try {
    const parsedDate = typeof date === 'string' ? safeParseISO(date) : date;
    if (!parsedDate || !isValid(parsedDate)) {
      return false;
    }
    return dateFnsIsYesterday(parsedDate);
  } catch {
    return false;
  }
}

/**
 * Safely calculate difference in days
 */
export function safeDifferenceInDays(
  dateLeft: Date | string | null | undefined,
  dateRight: Date | string | null | undefined,
  fallback: number = 0
): number {
  try {
    const left = typeof dateLeft === 'string' ? safeParseISO(dateLeft) : dateLeft;
    const right = typeof dateRight === 'string' ? safeParseISO(dateRight) : dateRight;

    if (!left || !right || !isValid(left) || !isValid(right)) {
      return fallback;
    }
    return dateFnsDifferenceInDays(left, right);
  } catch {
    return fallback;
  }
}

// Re-export original functions for cases where they're needed
export { parseISO, format, formatDistanceToNow, isToday, isYesterday, differenceInDays, isValid } from 'date-fns';
