import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseDateTime, extractVenue } from '@/lib/sync/events';
import { formatDateTime } from '@/lib/utils';
import { pushEventToGoogleCalendar } from '@/lib/calendar/google-sync';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/chat
 * AI-Powered Placement Copilot & Command Processor
 * Uses Gemini for deep contextual understanding with deterministic tool execution.
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

  // 1. Fetch comprehensive user context: profile, companies, applications, and events
  const [
    { data: userData },
    { data: companies },
    { data: applications },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, neo_id, campus')
      .eq('id', session.userId)
      .single(),
    supabase
      .from('companies')
      .select('id, name, aliases')
      .eq('user_id', session.userId),
    supabase
      .from('applications')
      .select('id, company_id, status, role, ctc, stipend, location, manual_override, notes, applied_at')
      .eq('user_id', session.userId),
    supabase
      .from('events')
      .select('id, company_id, event_type, title, start_time, end_time, venue, mode, gcal_event_id, manual_override')
      .eq('user_id', session.userId)
      .order('start_time', { ascending: true }),
  ]);

  const companyList = companies || [];
  const appMap = new Map((applications || []).map((a) => [a.company_id, a]));
  const companyNameMap = new Map(companyList.map((c) => [c.id, c.name]));
  const now = new Date();

  // Build pipeline items
  const pipeline = companyList.map((c) => {
    const app = appMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      status: app?.status || 'not_applied',
      role: app?.role || 'Campus Placement Drive',
      ctc: app?.ctc || 'TBA',
      stipend: app?.stipend || null,
      location: app?.location || 'Not Specified',
      manual_override: app?.manual_override || false,
    };
  });

  // Upcoming vs past events
  const allEvents = events || [];
  const upcomingEvents = allEvents
    .filter((e) => e.start_time && new Date(e.start_time) >= now)
    .map((e) => ({
      id: e.id,
      companyId: e.company_id,
      company: companyNameMap.get(e.company_id) || 'Unknown Company',
      title: e.title || e.event_type,
      type: e.event_type,
      startTime: e.start_time,
      endTime: e.end_time,
      venue: e.venue || 'Campus / Online',
      mode: e.mode || 'online',
    }));

  const pastEvents = allEvents
    .filter((e) => e.start_time && new Date(e.start_time) < now)
    .slice(-15)
    .map((e) => ({
      id: e.id,
      company: companyNameMap.get(e.company_id) || 'Unknown Company',
      title: e.title || e.event_type,
      type: e.event_type,
      startTime: e.start_time,
      venue: e.venue || 'Campus / Online',
    }));

  const studentName = userData?.name || session.name || 'Student';

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PRIMARY ENGINE: Gemini via @google/genai
  // ═══════════════════════════════════════════════════════════════════════════
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const contextData = {
        student: {
          name: studentName,
          email: userData?.email || session.email,
          neoId: userData?.neo_id || 'Not set',
          homeCampus: userData?.campus || 'VIT Bhopal',
        },
        pipelineSummary: {
          totalDrives: pipeline.length,
          applied: pipeline.filter((p) => !['not_applied', 'declined', 'withdrawn'].includes(p.status)).length,
          shortlistedForOA: pipeline.filter((p) => ['shortlisted', 'test_scheduled', 'test_completed', 'interview_scheduled', 'selected'].includes(p.status)).length,
          interviews: pipeline.filter((p) => ['interview_scheduled', 'selected'].includes(p.status)).length,
          offers: pipeline.filter((p) => ['selected', 'offer', 'offer_received'].includes(p.status)).length,
        },
        upcomingEvents,
        recentPastEvents: pastEvents,
        companies: pipeline,
      };

      const systemPrompt = `You are the Placement Assistant for "Where's My Offer?" — an expert, concise campus placement copilot for engineering students.
Today's local date is ${now.toISOString().split('T')[0]}. The current time is ${now.toISOString()}.
You have complete, live, real-time access to this student's placement pipeline, company drives, test dates, venues, CTCs, and events.

STUDENT PLACEMENT CONTEXT:
${JSON.stringify(contextData)}

INSTRUCTIONS & BEHAVIOR:
1. Always be direct, crisp, and helpful. Use clean Markdown (bullet points, bold company names, emojis where fitting).
2. Distinguish clearly between recruitment event types:
   - "PPT": Pre-Placement Talks (informative talks held before tests)
   - "Test / OA / Assessment": Coding tests, hackathons, aptitude exams
   - "Interview": Technical, managerial, or HR interview rounds
   - "Offer / Shortlist": Results and selection
3. When the student asks about events (e.g. "upcoming ppts?", "what are my upcoming tests?", "when is my next interview?"):
   - Inspect the 'upcomingEvents' list carefully by 'type' ('ppt', 'online_test', 'coding_test', 'technical_interview', etc.).
   - If upcoming events exist, list them clearly with company name, title, date/time formatted nicely, and venue (Online / Campus / Labs).
   - If NO upcoming events exist for that category, state that clearly and mention recent past events if relevant (e.g. "No upcoming PPTs scheduled. Your last PPT was ExxonMobil on Sept 17").
4. When the student gives a command to update status (e.g. "I gave Infosys test yesterday, didn't make interview shortlist", "mark Cognizant as applied", "rejected in interview for Amazon", "got offer from TCS", "opted out of Wipro"):
   - Identify the target company from 'companies'.
   - Decide the correct normalized status:
     - 'applied'
     - 'ppt_scheduled'
     - 'shortlisted' (shortlisted for OA test)
     - 'test_scheduled'
     - 'test_completed' (wrote test, waiting for results)
     - 'interview_scheduled'
     - 'selected' (offer won 🎉)
     - 'not_shortlisted' (screened out before test)
     - 'rejected' (eliminated in test or interview)
     - 'declined' (opted out by choice)
     - 'withdrawn'
   - Include the "action" block in your JSON output.
5. When the student asks to schedule or add an event (e.g. "Add Accenture interview tomorrow at 3pm at TT Lab 3"):
   - Include the "action" block of type "add_event" or "update_event" with start_time in ISO format.
6. When the student asks to sync with Google Calendar (e.g. "sync google calendar", "push events to calendar"):
   - Include the "action" block of type "sync_gcal".

OUTPUT SCHEMA:
Return ONLY valid JSON with this exact structure:
{
  "reply": "Your markdown response to the student",
  "action": null | {
    "type": "update_status" | "add_event" | "update_event" | "sync_gcal",
    "company_name"?: string,
    "status"?: string,
    "event_type"?: string,
    "title"?: string,
    "start_time"?: string,
    "venue"?: string,
    "mode"?: "online" | "offline",
    "notes"?: string
  }
}`;

      // Call Gemini (try gemini-flash-lite-latest, fallback to gemini-flash-latest)
      const modelCandidates = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash'];
      let rawText = '';

      for (const modelName of modelCandidates) {
        try {
          const res = await ai.models.generateContent({
            model: modelName,
            contents: message,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              temperature: 0.15,
            },
          });
          if (res.text) {
            rawText = res.text;
            break;
          }
        } catch (modelErr: any) {
          console.warn(`[chat/route] ${modelName} call error:`, modelErr?.message || modelErr);
        }
      }

      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          let executedAction: string | undefined = undefined;
          let affectedCompanyId: string | undefined = undefined;
          let affectedStatus: string | undefined = undefined;

          // Execute action if Gemini identified one
          if (parsed.action) {
            const action = parsed.action;

            if (action.type === 'update_status' && action.company_name && action.status) {
              const targetComp = companyList.find(
                (c) =>
                  c.name.toLowerCase() === action.company_name.toLowerCase() ||
                  c.name.toLowerCase().includes(action.company_name.toLowerCase()) ||
                  (c.aliases && c.aliases.some((a: string) => a.toLowerCase().includes(action.company_name.toLowerCase())))
              );

              if (targetComp) {
                let normStatus = action.status;
                let normNotes = action.notes;
                if (action.status === 'rejected_test' || action.status === 'test_eliminated') {
                  normStatus = 'rejected';
                  normNotes = normNotes || 'Eliminated in Test Round';
                } else if (action.status === 'rejected_interview' || action.status === 'interview_eliminated') {
                  normStatus = 'rejected';
                  normNotes = normNotes || 'Interviewed · Not Selected';
                } else if (action.status === 'not_shortlisted') {
                  normStatus = 'not_shortlisted';
                  normNotes = normNotes || 'Not Shortlisted for Test';
                }

                await supabase.from('applications').upsert(
                  {
                    user_id: session.userId,
                    company_id: targetComp.id,
                    status: normStatus,
                    status_source: 'ai_assistant_chat',
                    status_confidence: 'manual',
                    manual_override: true,
                    notes: normNotes || undefined,
                    last_updated: new Date().toISOString(),
                  },
                  { onConflict: 'user_id,company_id' }
                );
                executedAction = 'status_updated';
                affectedCompanyId = targetComp.id;
                affectedStatus = normStatus;
              }
            } else if ((action.type === 'add_event' || action.type === 'update_event') && action.company_name) {
              const targetComp = companyList.find(
                (c) =>
                  c.name.toLowerCase() === action.company_name.toLowerCase() ||
                  c.name.toLowerCase().includes(action.company_name.toLowerCase())
              );

              if (targetComp && action.start_time) {
                const eventType = action.event_type || 'online_test';
                const venue = action.venue || 'Campus / Online';
                const mode = action.mode || (/offline|lab|campus|hall/i.test(venue) ? 'offline' : 'online');
                const title = action.title || `${targetComp.name} - ${eventType.replace(/_/g, ' ').toUpperCase()}`;
                const startTime = new Date(action.start_time).toISOString();
                const endTime = new Date(new Date(startTime).getTime() + 3600000).toISOString();

                const { data: insertedEvt } = await supabase.from('events').insert({
                  user_id: session.userId,
                  company_id: targetComp.id,
                  event_type: eventType,
                  title,
                  start_time: startTime,
                  end_time: endTime,
                  venue,
                  mode,
                  confidence: 'high',
                  manual_override: true,
                }).select().single();

                if (insertedEvt) {
                  pushEventToGoogleCalendar({
                    userId: session.userId,
                    title,
                    startTime,
                    endTime,
                    venue,
                    mode,
                  }).catch((gErr) => console.warn('[chat/route] GCal sync error:', gErr));
                }

                executedAction = 'event_added';
                affectedCompanyId = targetComp.id;
              }
            } else if (action.type === 'sync_gcal') {
              executedAction = 'gcal_synced';
              for (const evt of upcomingEvents) {
                pushEventToGoogleCalendar({
                  userId: session.userId,
                  title: evt.title,
                  startTime: evt.startTime!,
                  endTime: evt.endTime,
                  venue: evt.venue,
                  mode: evt.mode,
                }).catch((gErr) => console.warn('[chat/route] GCal sync error:', gErr));
              }
            }
          }

          return NextResponse.json({
            reply: parsed.reply,
            action: executedAction,
            companyId: affectedCompanyId,
            status: affectedStatus,
          });
        } catch (parseErr) {
          console.warn('[chat/route] Failed to parse Gemini response as JSON:', rawText);
        }
      }
    } catch (aiErr: any) {
      console.error('[chat/route] Gemini processing failed, using fallback:', aiErr?.message || aiErr);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. DETERMINISTIC FALLBACK (If AI Key is missing or rate limited)
  // ═══════════════════════════════════════════════════════════════════════════

  // Upcoming PPTs
  if (/ppt|pre[\s-]*placement/i.test(lowerMsg)) {
    const upcomingPpts = upcomingEvents.filter((e) => /ppt/i.test(e.type || e.title));
    if (upcomingPpts.length > 0) {
      const list = upcomingPpts.map(
        (p) => `• **${p.company}** — *${formatDateTime(p.startTime!)}* (${p.venue})`
      );
      return NextResponse.json({
        reply: `📢 **Upcoming Pre-Placement Talks (PPTs):**\n\n${list.join('\n')}`,
      });
    }
    const pastPpts = pastEvents.filter((e) => /ppt/i.test(e.type || e.title));
    const pastNote = pastPpts.length > 0
      ? `\n\nYour past PPTs include: **${pastPpts.map((p) => p.company).join(', ')}**.`
      : '';
    return NextResponse.json({
      reply: `You don't have any upcoming Pre-Placement Talks (PPTs) scheduled right now.${pastNote}`,
    });
  }

  // Upcoming Tests
  if (/test|assessment|exam|coding|oa/i.test(lowerMsg) && /upcoming|next|when|schedule/i.test(lowerMsg)) {
    const upcomingTests = upcomingEvents.filter((e) =>
      /test|assessment|coding|exam/i.test(e.type || e.title)
    );
    if (upcomingTests.length > 0) {
      const list = upcomingTests.map(
        (t) => `• **${t.company}** — *${formatDateTime(t.startTime!)}* (${t.venue})`
      );
      return NextResponse.json({
        reply: `⏰ **Upcoming Online Assessments & Tests (${upcomingTests.length}):**\n\n${list.join('\n')}`,
      });
    }
    return NextResponse.json({
      reply: "You don't have any upcoming tests scheduled right now. All caught up! 🎯",
    });
  }

  // Upcoming Interviews
  if (/interview/i.test(lowerMsg) && /upcoming|next|when|schedule/i.test(lowerMsg)) {
    const upcomingInts = upcomingEvents.filter((e) => /interview/i.test(e.type || e.title));
    if (upcomingInts.length > 0) {
      const list = upcomingInts.map(
        (t) => `• **${t.company}** — *${formatDateTime(t.startTime!)}* (${t.venue})`
      );
      return NextResponse.json({
        reply: `🤝 **Upcoming Interviews (${upcomingInts.length}):**\n\n${list.join('\n')}`,
      });
    }
    return NextResponse.json({
      reply: "You don't have any interviews scheduled right now. Check back once test shortlists are released!",
    });
  }

  // General Upcoming Schedule
  if (/upcoming|next|schedule/i.test(lowerMsg)) {
    if (upcomingEvents.length > 0) {
      const list = upcomingEvents.map(
        (e) => `• **${e.company}** (${e.title}) — *${formatDateTime(e.startTime!)}* (${e.venue})`
      );
      return NextResponse.json({
        reply: `🗓️ **Your Upcoming Placement Schedule (${upcomingEvents.length}):**\n\n${list.join('\n')}`,
      });
    }
    return NextResponse.json({
      reply: "You don't have any upcoming rounds scheduled right now. Check back as new CDC circulars land!",
    });
  }

  // Shortlisted Companies
  if (/shortlist/i.test(lowerMsg)) {
    const shortlisted = pipeline.filter((p) =>
      ['shortlisted', 'test_scheduled', 'test_completed', 'interview_scheduled'].includes(p.status)
    );
    if (shortlisted.length > 0) {
      const list = shortlisted.map((s) => `• **${s.name}** (${s.role}) — ${s.ctc}`);
      return NextResponse.json({
        reply: `✨ You are currently shortlisted for **${shortlisted.length}** companies:\n\n${list.join('\n')}`,
      });
    }
    return NextResponse.json({
      reply: "You don't have any active test/interview shortlists right now.",
    });
  }

  // Default fallback response
  return NextResponse.json({
    reply: `Hi ${studentName}! I'm your Placement Copilot. You can ask me:\n• *"What are my upcoming tests?"*\n• *"Upcoming PPTs?"*\n• *"What is the CTC for Infosys?"*\n• *"Mark Cognizant as applied"*\n• *"I gave Infosys test yesterday, didn't make shortlist"*\n• *"Sync with Google Calendar"*`,
  });
}
