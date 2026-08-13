import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeCompanyName } from '@/lib/sync/classifier';

/**
 * POST /api/chat
 * Natural Language Placement Assistant & Command Processor
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

  // Fetch all user companies & applications for context
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
      .select('id, company_id, event_type, title, start_time, venue')
      .eq('user_id', session.userId)
      .order('start_time', { ascending: true }),
  ]);

  const companyList = companies || [];
  const appMap = new Map((applications || []).map((a) => [a.company_id, a]));

  // Helper to find company in message
  const findMentionedCompany = () => {
    for (const comp of companyList) {
      const cName = comp.name.toLowerCase();
      if (lowerMsg.includes(cName)) return comp;
      if (comp.aliases) {
        for (const alias of comp.aliases) {
          if (lowerMsg.includes(alias.toLowerCase())) return comp;
        }
      }
    }
    return null;
  };

  // 1. COMMAND: Update Status (Shortlisted, Selected, Rejected, Applied, Declined, Withdrawn)
  if (
    lowerMsg.includes('mark') ||
    lowerMsg.includes('set') ||
    lowerMsg.includes('change') ||
    lowerMsg.includes('update') ||
    lowerMsg.includes('got selected') ||
    lowerMsg.includes('shortlisted') ||
    lowerMsg.includes('declined') ||
    lowerMsg.includes('rejected')
  ) {
    const targetComp = findMentionedCompany();

    let targetStatus: string | null = null;
    if (lowerMsg.includes('shortlist')) targetStatus = 'shortlisted';
    else if (lowerMsg.includes('select') || lowerMsg.includes('offer') || lowerMsg.includes('placed')) targetStatus = 'selected';
    else if (lowerMsg.includes('reject')) targetStatus = 'rejected';
    else if (lowerMsg.includes('decline') || lowerMsg.includes('opt out') || lowerMsg.includes('opted out')) targetStatus = 'declined';
    else if (lowerMsg.includes('withdraw') || lowerMsg.includes('withdrew')) targetStatus = 'withdrawn';
    else if (lowerMsg.includes('test')) targetStatus = 'test_scheduled';
    else if (lowerMsg.includes('interview')) targetStatus = 'interview_scheduled';
    else if (lowerMsg.includes('applied')) targetStatus = 'applied';

    if (targetComp && targetStatus) {
      // Perform status update in DB
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

  // 2. QUERY: Tests (Past, Given, Attended, or Upcoming)
  if (
    lowerMsg.includes('test') ||
    lowerMsg.includes('interview') ||
    lowerMsg.includes('upcoming') ||
    lowerMsg.includes('schedule') ||
    lowerMsg.includes('given') ||
    lowerMsg.includes('previous') ||
    lowerMsg.includes('past') ||
    lowerMsg.includes('history')
  ) {
    const isPastQuery = /past|previous|given|attended|history|already|completed|done|was|were|all/i.test(lowerMsg);
    const now = new Date();
    const companyMap = new Map(companyList.map((c) => [c.id, c.name]));

    const pastEvents = (events || []).filter((e) => e.start_time && new Date(e.start_time) < now);
    const upcomingEvents = (events || []).filter((e) => e.start_time && new Date(e.start_time) >= now);

    // If user asked for past/given tests or general "which all tests"
    if (isPastQuery || !lowerMsg.includes('upcoming')) {
      const replyParts: string[] = [];

      if (pastEvents.length > 0) {
        const list = pastEvents.map((e) => {
          const cName = companyMap.get(e.company_id) || 'Company';
          const dateStr = new Date(e.start_time!).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
          const app = appMap.get(e.company_id);
          const statusText = app?.status ? ` · Status: *${app.status.replace('_', ' ')}*` : '';
          return `• **${cName}** — ${e.title || e.event_type} (*${dateStr}* @ ${e.venue || 'Online'})${statusText}`;
        });
        replyParts.push(`📋 **Past Tests & Events Attended (${pastEvents.length}):**\n${list.join('\n')}`);
      }

      if (upcomingEvents.length > 0) {
        const list = upcomingEvents.map((e) => {
          const cName = companyMap.get(e.company_id) || 'Company';
          const dateStr = new Date(e.start_time!).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
          return `• **${cName}** — ${e.title || e.event_type} (*${dateStr}* @ ${e.venue || 'Online'})`;
        });
        replyParts.push(`⏰ **Upcoming Scheduled Tests (${upcomingEvents.length}):**\n${list.join('\n')}`);
      }

      if (replyParts.length > 0) {
        return NextResponse.json({ reply: replyParts.join('\n\n') });
      } else {
        // Fallback: list applications where process reached online test
        const testComps = companyList.filter((c) => {
          const s = appMap.get(c.id)?.status;
          return ['test_scheduled', 'not_shortlisted', 'shortlisted', 'interview_scheduled', 'selected'].includes(s || '');
        });
        if (testComps.length > 0) {
          const list = testComps.map((c) => {
            const app = appMap.get(c.id);
            return `• **${c.name}** (${app?.role || 'Software Engineer'}) — Status: *${app?.status.replace('_', ' ')}*`;
          });
          return NextResponse.json({
            reply: `Here are the companies whose online test / assessment rounds you have participated in:\n\n${list.join('\n')}`,
          });
        }

        return NextResponse.json({
          reply: "You don't have any recorded past or upcoming online tests yet. Sync your emails to import test schedules automatically!",
        });
      }
    }

    // Explicit "upcoming" query
    if (upcomingEvents.length === 0) {
      return NextResponse.json({
        reply: "You don't have any upcoming tests or interviews scheduled right now. Check back after email syncs!",
      });
    }

    const list = upcomingEvents.slice(0, 5).map((e) => {
      const cName = companyMap.get(e.company_id) || 'Placement Event';
      const dateStr = new Date(e.start_time!).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `• **${cName}** — ${e.title || e.event_type} on *${dateStr}* (${e.venue || 'Online'})`;
    });

    return NextResponse.json({
      reply: `Here are your upcoming placement schedules:\n\n${list.join('\n')}`,
    });
  }

  // 3. QUERY: Shortlisted Companies
  if (lowerMsg.includes('shortlist') || lowerMsg.includes('shortlisted')) {
    const shortlistedComps = companyList.filter((c) => {
      const app = appMap.get(c.id);
      return app?.status === 'shortlisted';
    });

    if (shortlistedComps.length === 0) {
      return NextResponse.json({
        reply: "You don't have any companies marked as **Shortlisted** yet. When NeoPAT shortlist Excel files or emails match your Neo ID, they will appear here automatically!",
      });
    }

    const list = shortlistedComps.map((c) => `• **${c.name}** (${appMap.get(c.id)?.role || 'Software Engineer'})`);
    return NextResponse.json({
      reply: `You are currently shortlisted for **${shortlistedComps.length}** companies:\n\n${list.join('\n')}`,
    });
  }

  // 4. QUERY: Specific Company Details (CTC, Role, Stipend)
  const targetComp = findMentionedCompany();
  if (targetComp) {
    const app = appMap.get(targetComp.id);
    return NextResponse.json({
      reply: `Here is the info for **${targetComp.name}**:\n• **Status**: ${app?.status ? app.status.toUpperCase() : 'APPLIED'}\n• **Role**: ${app?.role || 'Software Engineer'}\n• **CTC**: ${app?.ctc || 'Not specified'}\n• **Stipend**: ${app?.stipend || 'Not specified'}\n• **Location**: ${app?.location || 'Pan India / Remote'}`,
    });
  }

  // 5. Default General Help
  return NextResponse.json({
    reply: `Hi! I'm your Placement Command Assistant. You can tell me:\n• *"Mark Value Labs as shortlisted"*\n• *"Change MUFG status to selected"*\n• *"I opted out of Juspay"*\n• *"What are my upcoming tests?"*\n• *"Show all shortlisted companies"*\n• *"What is the CTC of Infosys?"*`,
  });
}
