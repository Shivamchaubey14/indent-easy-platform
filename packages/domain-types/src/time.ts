/** Business time zone. Dates such as "required by" are calendar dates in this zone. */
export const BUSINESS_TIME_ZONE = 'Asia/Kolkata';

const isoDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The business calendar date (YYYY-MM-DD, Asia/Kolkata) at the given instant. */
export function businessDate(at: Date = new Date()): string {
  return isoDateFormat.format(at);
}
