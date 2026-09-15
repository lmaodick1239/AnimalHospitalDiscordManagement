export function isValidIanaTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format();
    return true;
  } catch {
    return false;
  }
}

export const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Hong_Kong",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;
