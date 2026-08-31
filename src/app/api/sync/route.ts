import { getSession } from '@/lib/auth';
import { runSync, type SyncProgress } from '@/lib/sync/engine';

/**
 * POST /api/sync
 *
 * Triggers a manual email sync for the authenticated user.
 * Returns a Server-Sent Events (SSE) stream with real-time progress updates.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return new Response(
      JSON.stringify({ error: { message: 'Unauthorized', code: 'unauthorized' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        sendEvent('sync_start', {
          message: 'Starting email sync...',
          userId: session.userId,
        });

        const result = await runSync(
          session.userId,
          (progress: SyncProgress) => {
            sendEvent('sync_progress', progress);
            sendEvent('progress', progress);
          }
        );

        sendEvent('sync_complete', {
          message: 'Sync complete!',
          result,
          newEmails: result.newEmails,
          newCompanies: result.newCompanies,
        });
        sendEvent('complete', {
          message: 'Sync complete!',
          result,
          newEmails: result.newEmails,
          newCompanies: result.newCompanies,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        console.error('Sync error:', err);
        sendEvent('sync_error', {
          message: errorMessage,
        });
        sendEvent('error', {
          message: errorMessage,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
