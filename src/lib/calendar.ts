/**
 * Generates a Google Calendar event creation URL.
 */
export function getGoogleCalendarUrl(event: {
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  companyName?: string;
}): string {
  const start = event.startTime ? new Date(event.startTime) : new Date();
  const end = event.endTime ? new Date(event.endTime) : new Date(start.getTime() + 60 * 60 * 1000);

  // Format as YYYYMMDDTHHMMSSZ (UTC ISO without dashes or colons)
  const formatUtc = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');

  const datesParam = `${formatUtc(start)}/${formatUtc(end)}`;
  const title = encodeURIComponent(`${event.companyName ? `${event.companyName} - ` : ''}${event.title}`);
  const location = encodeURIComponent(event.venue || 'Online / VIT Campus');
  const details = encodeURIComponent(
    `Placement drive schedule tracked by NeoTrack.\nCompany: ${event.companyName || ''}\nVenue: ${event.venue || 'Online'}`
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datesParam}&details=${details}&location=${location}`;
}
