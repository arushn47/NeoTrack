import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseDateTime, extractVenue } from '@/lib/sync/events';
import { formatDateTime } from '@/lib/utils';

/**
 * POST /api/chat
 * Natural Language Placement Assistant & Intelligent Command / Query Processor
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: 'Unauthorized', code: 'unauthorized' } },
      { status: 401 }
    );
  }

  const { message } = await request.json();
  if (!message || typeof message !== 'string') {
    return NextResponse.json(
      { error: { message: 'Message is required', code: 'bad_request' } },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const lowerMsg = message.toLowerCase().trim();

  // Fetch all user companies, applications, and events for context
  const [{ data: companies }, { data: applications }, { data: events }] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, aliases')
      .eq('user_id', session.userId),

    supabase
      .from('applications')
      .select('id, company_id, status, role, ctc, stipend, location')
      .eq('user_id', session.userId),

    supabase
      .from('events')
      .select('id, company_id, event_type, title, start_time, venue, mode')
      .eq('user_id', session.userId)
      .order('start_time', { ascending: true }),
  ]);

  const companyList = companies || [];
  const appMap = new Map((applications || []).map((a) => [a.company_id, a]));
  const companyEventsMap = new Map<string, typeof events>();
  (events || []).forEach((e) => {
    const list = companyEventsMap.get(e.company_id) || [];
    list.push(e);
    companyEventsMap.set(e.company_id, list);
  });

  // Helper to find specific company mentioned in the query
  const findMentionedCompany = () => {
    // Sort by name length descending so specific names like "EY GDS" match before "EY"
    const sorted = [...companyList].sort((a, b) => b.name.length - a.name.length);
    for (const comp of sorted) {
      const cName = comp.name.toLowerCase();
      // Match exact name or word boundary match
      if (lowerMsg.includes(cName) || new RegExp(`\\b${escapeRegex(cName)}\\b`, 'i').test(lowerMsg)) {
        return comp;
      }
      if (comp.aliases) {
        for (const alias of comp.aliases) {
          const aName = alias.toLowerCase();
          if (lowerMsg.includes(aName) || new RegExp(`\\b${escapeRegex(aName)}\\b`, 'i').test(lowerMsg)) {
            return comp;
          }
        }
      }
    }
    // Fallback for short keywords like "ey", "lseg", "mufg"
    if (/\b(?:ey\s*gds|ey|ernst)\b/i.test(lowerMsg)) {
      return companyList.find((c) => /ey\s*gds/i.test(c.name)) || companyList.find((c) => /ey/i.test(c.name)) || null;
    }
    if (/\b(?:lseg|london\s*stock)\b/i.test(lowerMsg)) {
      return companyList.find((c) => /london|lseg/i.test(c.name)) || null;
    }
    return null;
  };

  const targetComp = findMentionedCompany();
  const parsedDate = parseDateTime(message);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. COMMAND: Add / Schedule Placement Event on Calendar
  // ═══════════════════════════════════════════════════════════════════════════
  // Triggered when target company is mentioned AND a date/time is extracted,
  // OR when explicit scheduling intent is detected with a date
  if (
    targetComp &&
    parsedDate &&
    (/add|schedule|create|set|mark|book|reschedule|move/i.test(lowerMsg) ||
      /test|ppt|interview|talk|assessment|round/i.test(lowerMsg))
  ) {
    let eventType = 'online_test';
    let eventLabel = 'Online Assessment';
    let appStatus = 'test_scheduled';

    if (/ppt|pre[\s-]*placement/i.test(lowerMsg)) {
      eventType = 'ppt';
      eventLabel = 'Pre-Placement Talk (PPT)';
      appStatus = 'ppt_scheduled';
    } else if (/interview|hr|technical/i.test(lowerMsg)) {
      eventType = 'technical_interview';
      eventLabel = 'Technical Interview';
      appStatus = 'interview_scheduled';
    }

    const venue = extractVenue(message) || 'Own Location / Online';
    const isOffline = /offline|lab|campus|prp|sjt|hall|room|auditorium/i.test(venue) || /offline|physical|in[\s-]person/i.test(lowerMsg);
    const mode = isOffline ? 'offline' : 'online';

    // Insert the new event into the events table
    const { data: insertedEvent } = await supabase
      .from('events')
      .insert({
        user_id: session.userId,
        company_id: targetComp.id,
        event_type: eventType,
        title: `${targetComp.name} - ${eventLabel}`,
        start_time: parsedDate.toISOString(),
        end_time: new Date(parsedDate.getTime() + 3600000).toISOString(),
        venue,
        mode,
        confidence: 'high',
        manual_override: true,
      })
      .select()
      .single();

    // Update application status to reflect the scheduled event
    await supabase.from('applications').upsert(
      {
        user_id: session.userId,
        company_id: targetComp.id,
        status: appStatus,
        status_source: 'ai_assistant_chat',
        status_confidence: 'manual',
        manual_override: true,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'user_id,company_id' }
    );

    const formatted = formatDateTime(parsedDate.toISOString());

    return NextResponse.json({
      reply: `📅 Added **${targetComp.name} ${eventLabel}** on **${formatted}** (${venue}) directly to your Placement Calendar and Dashboard!`,
      action: 'event_added',
      event: insertedEvent,
      companyId: targetComp.id,
      status: appStatus,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. COMMAND: Update Status (Without Date)
  // ═══════════════════════════════════════════════════════════════════════════
  if (
    targetComp &&
    !parsedDate &&
    (/mark|set|change|update|got\s+selected|placed|shortlisted|declined|opted\s+out|rejected|withdrew|applied/i.test(lowerMsg))
  ) {
    let targetStatus: string | null = null;
    if (/not\s+shortlist|not\s+selected\s+in\s+shortlist/i.test(lowerMsg)) targetStatus = 'not_shortlisted';
    else if (lowerMsg.includes('shortlist')) targetStatus = 'shortlisted';
    else if (/select|offer|placed/i.test(lowerMsg)) targetStatus = 'selected';
    else if (/reject|eliminated/i.test(lowerMsg)) targetStatus = 'rejected';
    else if (/decline|opt\s*out|opted\s*out/i.test(lowerMsg)) targetStatus = 'declined';
    else if (/withdraw|withdrew/i.test(lowerMsg)) targetStatus = 'withdrawn';
    else if (/ppt|pre[\s-]*placement/i.test(lowerMsg)) targetStatus = 'ppt_scheduled';
    else if (/test/i.test(lowerMsg)) targetStatus = 'test_scheduled';
    else if (/interview/i.test(lowerMsg)) targetStatus = 'interview_scheduled';
    else if (/not\s+applied|didnt\s+apply|didn't\s+apply/i.test(lowerMsg)) targetStatus = 'not_applied';
    else if (/applied|registered/i.test(lowerMsg)) targetStatus = 'applied';

    if (targetStatus) {
      await supabase
        .from('applications')
        .upsert(
          {
            user_id: session.userId,
            company_id: targetComp.id,
            status: targetStatus,
            status_source: 'ai_assistant_chat',
            status_confidence: 'manual',
            manual_override: true,
            last_updated: new Date().toISOString(),
          },
          { onConflict: 'user_id,company_id' }
        );

      const emoji =
        targetStatus === 'selected' ? '🎉' : targetStatus === 'shortlisted' ? '✨' : '✅';

      return NextResponse.json({
        reply: `${emoji} Updated **${targetComp.name}** status to **${targetStatus.replace('_', ' ').toUpperCase()}**!`,
        action: 'status_updated',
        companyId: targetComp.id,
        status: targetStatus,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. COMPANY-SPECIFIC QUERY (e.g. "infosys test", "when is chubb test", "status of ey", "infosys ctc")
  // ═══════════════════════════════════════════════════════════════════════════
  if (targetComp) {
    const app = appMap.get(targetComp.id);
    const compEvents = companyEventsMap.get(targetComp.id) || [];
    const now = new Date();

    const upcoming = compEvents.filter((e) => e.start_time && new Date(e.start_time) >= now);
    const past = compEvents.filter((e) => e.start_time && new Date(e.start_time) < now);

    const isTestOrScheduleQuery = /test|exam|assessment|ppt|interview|round|when|date|time|venue|schedule|calendar/i.test(lowerMsg);
    const isCtcQuery = /ctc|salary|stipend|package|lpa|money|pay/i.test(lowerMsg);

    // If query is specifically about tests / events for this company:
    if (isTestOrScheduleQuery) {
      if (upcoming.length > 0) {
        const list = upcoming.map((e) => {
          const dateStr = formatDateTime(e.start_time!);
          return `• ⏰ **${e.title || e.event_type}**: **${dateStr}** (@ ${e.venue || 'Online'})`;
        });

        return NextResponse.json({
          reply: `🗓️ **${targetComp.name} Scheduled Events:**\n${list.join('\n')}\n\n• **Current Status**: *${(app?.status || 'applied').replace('_', ' ').toUpperCase()}*\n• **Role**: ${app?.role || 'Software Engineer'}`,
        });
      }

      if (past.length > 0) {
        const list = past.map((e) => {
          const dateStr = formatDateTime(e.start_time!);
          return `• 📋 **${e.title || e.event_type}** (*${dateStr}* @ ${e.venue || 'Online'})`;
        });

        return NextResponse.json({
          reply: `📋 **${targetComp.name} Past Events:**\n${list.join('\n')}\n\n• **Status**: *${(app?.status || 'applied').replace('_', ' ').toUpperCase()}* (No future tests currently scheduled).`,
        });
      }

      // No events in calendar for this company
      let statusExplanation = '';
      const s = app?.status || 'applied';
      if (s === 'applied') {
        statusExplanation = 'You have registered and are currently **Applied (In Screening)**. The test date has not been officially announced yet.';
      } else if (s === 'not_shortlisted') {
        statusExplanation = 'Initial screening shortlist was released for this drive and you were **Not Shortlisted**.';
      } else if (s === 'rejected') {
        statusExplanation = 'You took the online assessment and were **Eliminated in Test**.';
      } else if (s === 'declined' || s === 'withdrawn') {
        statusExplanation = 'You **Opted Out** of this placement drive.';
      } else if (s === 'not_applied') {
        statusExplanation = 'You did not register for this placement drive.';
      } else {
        statusExplanation = `Current status: **${s.replace('_', ' ').toUpperCase()}**.`;
      }

      return NextResponse.json({
        reply: `📌 **${targetComp.name}**: ${statusExplanation}\n\n• **Role**: ${app?.role || 'Software Engineer'}\n• **CTC**: ${app?.ctc || 'Not specified'}\n• **Upcoming Tests**: None scheduled yet.`,
      });
    }

    // If query is specifically about CTC / Compensation:
    if (isCtcQuery) {
      return NextResponse.json({
        reply: `💰 **${targetComp.name} Compensation Details:**\n• **CTC**: ${app?.ctc || 'Not specified'}\n• **Stipend**: ${app?.stipend || 'Not specified'}\n• **Role**: ${app?.role || 'Software Engineer'}\n• **Location**: ${app?.location || 'Pan India / Remote'}`,
      });
    }

    // General company overview:
    const statusStr = (app?.status || 'APPLIED').replace('_', ' ').toUpperCase();
    const eventSummary = upcoming.length > 0
      ? `\n• **Next Event**: ${upcoming[0].title} on ${formatDateTime(upcoming[0].start_time!)} (@ ${upcoming[0].venue || 'Online'})`
      : '';

    return NextResponse.json({
      reply: `🏢 **${targetComp.name} Overview:**\n• **Status**: **${statusStr}**\n• **Role**: ${app?.role || 'Software Engineer'}\n• **CTC**: ${app?.ctc || 'Not specified'}\n• **Stipend**: ${app?.stipend || 'Not specified'}\n• **Location**: ${app?.location || 'Pan India / Remote'}${eventSummary}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. GLOBAL QUERIES (When no specific company was mentioned)
  // ═══════════════════════════════════════════════════════════════════════════

  // A. All Tests Query (Past, Given, Upcoming)
  if (
    lowerMsg.includes('test') ||
    lowerMsg.includes('interview') ||
    lowerMsg.includes('upcoming') ||
    lowerMsg.includes('schedule') ||
    lowerMsg.includes('given') ||
    lowerMsg.includes('past') ||
    lowerMsg.includes('history')
  ) {
    const isPastQuery = /past|previous|given|attended|history|already|completed|done|was|were/i.test(lowerMsg);
    const now = new Date();
    const companyMap = new Map(companyList.map((c) => [c.id, c.name]));

    const pastEvents = (events || []).filter((e) => e.start_time && new Date(e.start_time) < now);
    const upcomingEvents = (events || []).filter((e) => e.start_time && new Date(e.start_time) >= now);

    if (isPastQuery || !lowerMsg.includes('upcoming')) {
      const replyParts: string[] = [];

      if (pastEvents.length > 0) {
        const list = pastEvents.map((e) => {
          const cName = companyMap.get(e.company_id) || 'Company';
          const dateStr = formatDateTime(e.start_time!);
          const app = appMap.get(e.company_id);
          const statusText = app?.status ? ` · Status: *${app.status.replace('_', ' ')}*` : '';
          return `• **${cName}** — ${e.title || e.event_type} (*${dateStr}* @ ${e.venue || 'Online'})${statusText}`;
        });
        replyParts.push(`📋 **Past Tests & Events Attended (${pastEvents.length}):**\n${list.join('\n')}`);
      }

      if (upcomingEvents.length > 0) {
        const list = upcomingEvents.map((e) => {
          const cName = companyMap.get(e.company_id) || 'Company';
          const dateStr = formatDateTime(e.start_time!);
          return `• **${cName}** — ${e.title || e.event_type} (*${dateStr}* @ ${e.venue || 'Online'})`;
        });
        replyParts.push(`⏰ **Upcoming Scheduled Tests (${upcomingEvents.length}):**\n${list.join('\n')}`);
      }

      if (replyParts.length > 0) {
        return NextResponse.json({ reply: replyParts.join('\n\n') });
      }
    }

    // Explicit "upcoming" query
    if (upcomingEvents.length === 0) {
      return NextResponse.json({
        reply: "You don't have any upcoming tests or interviews scheduled right now. Check back after email syncs!",
      });
    }

    const list = upcomingEvents.map((e) => {
      const cName = companyMap.get(e.company_id) || 'Placement Event';
      const dateStr = formatDateTime(e.start_time!);
      return `• **${cName}** — ${e.title || e.event_type} on *${dateStr}* (${e.venue || 'Online'})`;
    });

    return NextResponse.json({
      reply: `⏰ **Upcoming Placement Schedule (${upcomingEvents.length}):**\n\n${list.join('\n')}`,
    });
  }

  // B. Shortlisted Companies Query
  if (lowerMsg.includes('shortlist') || lowerMsg.includes('shortlisted')) {
    const shortlistedComps = companyList.filter((c) => {
      const app = appMap.get(c.id);
      return ['shortlisted', 'test_scheduled', 'interview_scheduled'].includes(app?.status || '');
    });

    if (shortlistedComps.length === 0) {
      return NextResponse.json({
        reply: "You don't have any active shortlists right now. When NeoPAT shortlist Excel files or emails match your Neo ID, they will appear here automatically!",
      });
    }

    const list = shortlistedComps.map((c) => {
      const app = appMap.get(c.id);
      return `• **${c.name}** (${app?.role || 'Software Engineer'}) — Status: *${app?.status?.replace('_', ' ').toUpperCase()}*`;
    });

    return NextResponse.json({
      reply: `✨ You are currently shortlisted for **${shortlistedComps.length}** companies:\n\n${list.join('\n')}`,
    });
  }

  // C. In Progress / Active Pipeline Query
  if (/active|in\s+progress|pipeline/i.test(lowerMsg)) {
    const activeComps = companyList.filter((c) => {
      const app = appMap.get(c.id);
      return !['not_applied', 'withdrawn', 'declined', 'not_shortlisted', 'rejected', 'selected'].includes(app?.status || 'not_applied');
    });

    const list = activeComps.map((c) => {
      const app = appMap.get(c.id);
      return `• **${c.name}** — *${app?.status?.replace('_', ' ').toUpperCase()}*`;
    });

    return NextResponse.json({
      reply: `💼 **Active Opportunities in Pipeline (${activeComps.length}):**\n\n${list.join('\n')}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. DEFAULT GENERAL HELP
  // ═══════════════════════════════════════════════════════════════════════════
  return NextResponse.json({
    reply: `Hi Arush! I'm your Placement Command Assistant. You can ask me:\n• *"When is Infosys test?"*\n• *"Schedule Chubb test on 2nd Sept at 3:30pm @ PRP 717"*\n• *"Mark EY GDS as shortlisted"*\n• *"What is the CTC for Veeva Systems?"*\n• *"Show all upcoming tests"*\n• *"What are my active pipeline companies?"*`,
  });
}

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
