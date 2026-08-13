import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import CompaniesClient, { type CompanyWithDetails } from './companies-client';

export const metadata = {
  title: 'Companies — NeoPAT Placement Tracker',
  description: 'View all tracked placement drives, application statuses, and roles.',
};

export default async function CompaniesPage() {
  const session = await requireSession();
  const supabase = createAdminClient();

  // Fetch companies, applications, latest events, and candidate matches for the user
  const [{ data: companies }, { data: applications }, { data: events }, { data: matches }, { data: emails }] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, legal_name, aliases, updated_at')
      .eq('user_id', session.userId)
      .order('updated_at', { ascending: false }),

    supabase
      .from('applications')
      .select('id, company_id, status, role, ctc, stipend, location, manual_override, applied_at, last_updated')
      .eq('user_id', session.userId),

    supabase
      .from('events')
      .select('id, company_id, event_type, title, start_time, venue, mode')
      .eq('user_id', session.userId)
      .order('start_time', { ascending: true }),

    supabase
      .from('candidate_matches')
      .select('id, application_id, email_id')
      .eq('user_id', session.userId),

    supabase
      .from('emails')
      .select('id, company_id')
      .eq('user_id', session.userId),
  ]);

  // Maps for efficient lookups
  const appMap = new Map((applications || []).map((app) => [app.company_id, app]));
  const nowIso = new Date().toISOString();
  const eventMap = new Map();
  if (events) {
    for (const event of events) {
      if (event.start_time && event.start_time >= nowIso) {
        if (!eventMap.has(event.company_id)) {
          eventMap.set(event.company_id, event);
        }
      }
    }
  }

  const allEventsByCompany = new Map<string, typeof events>();
  if (events) {
    for (const event of events) {
      const existing = allEventsByCompany.get(event.company_id) || [];
      existing.push(event);
      allEventsByCompany.set(event.company_id, existing);
    }
  }

  const emailCountMap = new Map<string, number>();
  if (emails) {
    for (const email of emails) {
      if (email.company_id) {
        emailCountMap.set(email.company_id, (emailCountMap.get(email.company_id) || 0) + 1);
      }
    }
  }

  const matchedAppIds = new Set((matches || []).map((m) => m.application_id).filter(Boolean));

  // Assemble full details
  const formattedCompanies: CompanyWithDetails[] = (companies || []).map((comp) => {
    const app = appMap.get(comp.id) || null;
    return {
      id: comp.id,
      name: comp.name,
      legal_name: comp.legal_name,
      aliases: comp.aliases,
      updated_at: comp.updated_at,
      application: app
        ? {
            id: app.id,
            status: app.status,
            role: app.role,
            ctc: app.ctc,
            stipend: app.stipend,
            location: app.location,
            manual_override: app.manual_override,
            applied_at: app.applied_at,
            last_updated: app.last_updated,
          }
        : null,
      latestEvent: eventMap.get(comp.id) || null,
      events: allEventsByCompany.get(comp.id) || [],
      neoIdMatched: app ? matchedAppIds.has(app.id) : false,
      emailCount: emailCountMap.get(comp.id) || 0,
    };
  });

  return <CompaniesClient companies={formattedCompanies} />;
}
