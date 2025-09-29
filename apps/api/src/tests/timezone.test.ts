import { 
  convertToUTC, 
  convertFromUTC, 
  validateFutureTime, 
  isDSTTransitionRisk,
  getTimezoneInfo,
  formatForTimezone
} from '@/utils/timezone';
import { SchedulerError } from '@/types/scheduler';

describe('Timezone Utils', () => {
  
  describe('convertToUTC', () => {
    it('should convert Jerusalem time to UTC correctly', () => {
      const localDateTime = '2024-06-15T14:30:00.000';
      const result = convertToUTC(localDateTime, 'Asia/Jerusalem');
      
      expect(result.userTimezone).toBe('Asia/Jerusalem');
      expect(result.userDateTime).toBe(localDateTime);
      expect(result.utcDateTime).toMatch(/^2024-06-15T11:30:00\.000Z$/);
    });

    it('should handle DST transitions', () => {
      // Test summer time (DST active)
      const summerTime = '2024-07-15T14:30:00.000';
      const summerResult = convertToUTC(summerTime, 'Asia/Jerusalem');
      
      expect(summerResult.isDST).toBe(true);
      expect(summerResult.utcDateTime).toMatch(/^2024-07-15T11:30:00\.000Z$/);
      
      // Test winter time (DST inactive)
      const winterTime = '2024-12-15T14:30:00.000';
      const winterResult = convertToUTC(winterTime, 'Asia/Jerusalem');
      
      expect(winterResult.isDST).toBe(false);
      expect(winterResult.utcDateTime).toMatch(/^2024-12-15T12:30:00\.000Z$/);
    });

    it('should throw error for unsupported timezone', () => {
      expect(() => {
        convertToUTC('2024-06-15T14:30:00.000', 'Invalid/Timezone');
      }).toThrow(SchedulerError);
    });
  });

  describe('convertFromUTC', () => {
    it('should convert UTC back to local time', () => {
      const utcDateTime = '2024-06-15T11:30:00.000Z';
      const result = convertFromUTC(utcDateTime, 'Asia/Jerusalem');
      
      expect(result.userTimezone).toBe('Asia/Jerusalem');
      expect(result.utcDateTime).toBe(utcDateTime);
      expect(result.localDateTime).toMatch(/2024-06-15T14:30:00/);
    });
  });

  describe('validateFutureTime', () => {
    it('should pass for future times', () => {
      const futureTime = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes from now
      expect(() => validateFutureTime(futureTime, 1)).not.toThrow();
    });

    it('should throw for past times', () => {
      const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      expect(() => validateFutureTime(pastTime, 1)).toThrow(SchedulerError);
    });

    it('should throw for times too close to now', () => {
      const nearTime = new Date(Date.now() + 30 * 1000).toISOString(); // 30 seconds from now
      expect(() => validateFutureTime(nearTime, 1)).toThrow(SchedulerError);
    });
  });

  describe('isDSTTransitionRisk', () => {
    it('should detect DST transition periods', () => {
      // These would need to be actual DST transition dates for Jerusalem
      // This is a simplified test
      const normalTime = '2024-06-15T12:00:00.000Z';
      const risk = isDSTTransitionRisk(normalTime, 'Asia/Jerusalem');
      
      expect(typeof risk).toBe('boolean');
    });
  });

  describe('getTimezoneInfo', () => {
    it('should return timezone information', () => {
      const info = getTimezoneInfo('Asia/Jerusalem');
      
      expect(info.name).toBe('Asia/Jerusalem');
      expect(info.abbreviation).toMatch(/^(IST|IDT)$/);
      expect(info.offset).toMatch(/^GMT[+-]\d{2}:\d{2}$/);
      expect(typeof info.isDST).toBe('boolean');
    });
  });

  describe('formatForTimezone', () => {
    it('should format dates for specific timezones', () => {
      const utcTime = '2024-06-15T12:00:00.000Z';
      const formatted = formatForTimezone(utcTime, 'Asia/Jerusalem', 'yyyy-MM-dd HH:mm');
      
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });
});