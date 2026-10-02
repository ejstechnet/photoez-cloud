import { siteUrl } from "@/lib/site";

// A studio's private calendar link (Settings > Calendar; served by app/calendar/[token]/route.ts).
export function calendarUrl(token: string) {
  return `${siteUrl}/calendar/${token}.ics`;
}
