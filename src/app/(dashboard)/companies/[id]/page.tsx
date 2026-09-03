import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import CompanyDetailClient, { type CompanyDetail } from './company-detail-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', id)
    .single();

  const name = company?.name || 'Company Details';
  return {
    title: name,
    description: `Detailed recruitment drive history, schedule, test rounds, and email updates for ${name} on NeoTrack.`,
    alternates: {
      canonical: `/companies/${id}`,
    },
  };
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id: companyId } = await params;
  const supabase = createAdminClient();

  // Fetch company, application, events, emails, candidate matches
  const [
    { data: company },
    { data: application },
    { data: events },
    { data: emails },
    { data: candidateMatches },
  ] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, legal_name, aliases')
      .eq('id', companyId)
      .eq('user_id', session.userId)
      .single(),

    supabase
      .from('applications')
      .select('*')
      .eq('company_id', companyId)
      .eq('user_id', session.userId)
      .single(),

    supabase
      .from('events')
      .select('id, event_type, title, start_time, venue, mode')
      .eq('company_id', companyId)
      .eq('user_id', session.userId)
      .order('start_time', { ascending: false }),

    supabase
      .from('emails')
      .select('id, subject, sender, received_at, body_snippet, classification')
      .eq('company_id', companyId)
      .eq('user_id', session.userId)
      .order('received_at', { ascending: false }),

    supabase
      .from('candidate_matches')
      .select('id, match_type, matched_value, created_at, email_id')
      .eq('user_id', session.userId),
  ]);

  if (!company) {
    notFound();
  }

  // Filter candidate matches to only those belonging to this company's emails
  const companyEmailIds = new Set((emails || []).map((e) => e.id));
  const companyCandidateMatches = (candidateMatches || []).filter((cm) =>
    companyEmailIds.has((cm as { email_id?: string }).email_id || '')
  );

  const detail: CompanyDetail = {
    id: company.id,
    name: company.name,
    legalName: company.legal_name,
    aliases: company.aliases,
    application: application
      ? {
          id: application.id,
          status: application.status,
          statusSource: application.status_source,
          statusConfidence: application.status_confidence,
          role: application.role,
          category: application.category,
          ctc: application.ctc,
          stipend: application.stipend,
          location: application.location,
          eligibility: application.eligibility,
          manualOverride: application.manual_override,
          notes: application.notes,
          appliedAt: application.applied_at,
          lastUpdated: application.last_updated,
        }
      : null,
    events: (events || []).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      title: e.title,
      startTime: e.start_time,
      venue: e.venue,
      mode: e.mode,
    })),
    emails: (emails || []).map((em) => ({
      id: em.id,
      subject: em.subject,
      sender: em.sender,
      receivedAt: em.received_at,
      snippet: em.body_snippet,
      classification: em.classification,
    })),
    candidateMatches: companyCandidateMatches.map((cm) => ({
      id: cm.id,
      matchType: cm.match_type,
      matchedValue: cm.matched_value,
      createdAt: cm.created_at,
    })),
  };

  return <CompanyDetailClient company={detail} />;
}
