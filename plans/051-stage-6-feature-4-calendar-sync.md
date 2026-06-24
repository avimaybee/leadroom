# [051] Stage 6 Enhancement — Calendar Sync & External Notifications

**Category:** Core Feature / Automation
**Effort:** M (Medium)
**Impact:** Prevents dropped leads by ensuring that follow-ups and tasks are visible to operators outside of the Leadroom application.

---

## Context

The current reminder engine and task assignment system (implemented in Stage 6) rely on the operator being logged into the Leadroom dashboard. It uses an SSE polling loop for real-time notifications. However, pipeline discipline often fails because operators live in their inbox or external calendar, not always in the CRM. If they don't check Leadroom, they miss the 7-day follow-up.

## Goal

Provide external visibility for Leadroom tasks and reminders via an authenticated `.ics` Calendar feed and/or a daily digest email ("Your Pipeline Today").

---

## Design

**Calendar Integration (iCal feed):**
- Generate a read-only `.ics` URL for each user (`/api/calendar/[userId]/feed.ics?token=...`).
- The feed exposes all `Open` tasks assigned to that user, mapping `dueDate` to an all-day event or specific time if available.
- The feed exposes all scheduled `reminders` for that user.
- The event description includes a direct link back to the Lead in Leadroom.

**Daily Digest (Optional/Complementary):**
- A scheduled Cloudflare Workflow (Cron Trigger) that runs daily at 8 AM.
- Collects all overdue tasks, tasks due today, and stale leads assigned to a user.
- Dispatches a simple HTML email summary.

---

## Implementation

### 1. Database Schema

Add an authentication token for the Calendar Feed to `src/db/schema/core.ts`:

```typescript
// Add to `users` table:
calendarToken: text('calendar_token').unique(),
```

*Create a migration to populate `calendarToken` with `crypto.randomUUID()` for all existing users.*

### 2. Service Layer Updates

**iCal Generation Service:**
Create `src/services/calendar.ts`:

```typescript
import { formatICalDate } from '@/lib/utils'; // helper to format dates per RFC 5545

export class CalendarService {
  constructor(private db: Db) {}

  async generateICalFeed(token: string): Promise<string> {
    const [user] = await this.db.select().from(users).where(eq(users.calendarToken, token));
    if (!user) throw new Error('Invalid token');

    const openTasks = await this.db.select().from(tasks)
      .where(and(eq(tasks.assigneeId, user.id), eq(tasks.status, 'Open')));

    const pendingReminders = await this.db.select().from(reminders)
      .where(and(eq(reminders.userId, user.id), eq(reminders.isFired, false)));

    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Leadroom//Task Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Leadroom Tasks'
    ];

    // Add Tasks
    for (const task of openTasks) {
      if (!task.dueDate) continue;
      ics.push(
        'BEGIN:VEVENT',
        `UID:task-${task.id}`,
        `DTSTAMP:${formatICalDate(new Date())}`,
        `DTSTART;VALUE=DATE:${formatICalDate(task.dueDate, true)}`, // All day event
        `SUMMARY:[Leadroom] ${task.title}`,
        `DESCRIPTION:View Lead: ${process.env.NEXT_PUBLIC_APP_URL}/leads/${task.leadId}`,
        'END:VEVENT'
      );
    }

    // Add Reminders
    for (const r of pendingReminders) {
      ics.push(
        'BEGIN:VEVENT',
        `UID:rem-${r.id}`,
        `DTSTAMP:${formatICalDate(new Date())}`,
        `DTSTART:${formatICalDate(r.remindAt)}`, // Specific time
        `SUMMARY:⏰ ${r.title}`,
        `DESCRIPTION:${r.message || ''}\\n\\nLink: ${process.env.NEXT_PUBLIC_APP_URL}${r.link || `/leads/${r.leadId}`}`,
        'END:VEVENT'
      );
    }

    ics.push('END:VCALENDAR');
    return ics.join('\\r\\n');
  }
}
```

### 3. API Route

**New Route: `src/app/api/calendar/[token]/route.ts`**
- Intercepts GET requests.
- Calls `CalendarService.generateICalFeed(token)`.
- Returns response with `Content-Type: text/calendar`.

### 4. Frontend Settings

**Settings UI:**
In the User Profile or Preferences page:
- Show a section "Calendar Integration".
- Display the unique feed URL: `https://[app-domain]/api/calendar/[calendarToken]`.
- Provide a "Copy URL" button and an "Invalidate/Reset Token" button.

---

## Edge Cases

- **Privacy & Security:** The `.ics` URL is essentially a bearer token. Anyone with the link can see task titles. If a user suspects a leak, they must be able to click "Reset Token", which generates a new UUID and invalidates the old URL.
- **Caching:** External calendar apps (Google Calendar, Outlook) poll `.ics` URLs aggressively. The API route should set appropriate cache-control headers (e.g., `Cache-Control: public, max-age=3600`) to prevent DB spam.
- **Timezones:** iCal date formatting (`DTSTART`) must strictly adhere to UTC (`Z` suffix) or specified local timezones to ensure reminders trigger at the correct hour in the operator's calendar.

---

## Verification

1. **API Endpoint Test:** Make a GET request to `/api/calendar/[valid-token]`. Assert the response is a valid RFC 5545 text block containing the user's open tasks.
2. **Security Test:** Make a GET request with an invalid or missing token. Assert a 404 or 401 response.
3. **Manual Verification:** Add the generated URL to Google Calendar or Apple Calendar using "Add Subscribed Calendar" and verify tasks and reminders populate correctly.
