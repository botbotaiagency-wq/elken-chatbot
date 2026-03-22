import { createServiceClient } from '@/lib/supabase/service'
import {
  getMessageVolume,
  getIntentBreakdown,
  getUnansweredQueries,
  getLatencyStats,
  getBookingFunnel,
  getConfirmedBookings,
  getCancellations,
  getFacilityBreakdown,
  getLocationVolume,
  getAuditTrail,
  getSurveyResponses,
} from '@/lib/analytics/queries'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params  // MUST await — Next.js 16
  const url = new URL(req.url)
  const report = url.searchParams.get('report')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const location = url.searchParams.get('location') ?? undefined  // optional: 'okr' | 'subang' | null

  if (!report || !from || !to) {
    return Response.json(
      { error: 'Missing required params: report, from, to' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const handlers: Record<string, () => Promise<{ data: unknown; error: unknown }>> = {
    'message-volume': () => getMessageVolume(supabase, botId, from, to),
    'intent':         () => getIntentBreakdown(supabase, botId, from, to),
    'unanswered':     () => getUnansweredQueries(supabase, botId, from, to),
    'latency':        () => getLatencyStats(supabase, botId, from, to),
    'confirmed':      () => getConfirmedBookings(supabase, botId, from, to, location),
    'cancellations':  () => getCancellations(supabase, botId, from, to),
    'facility':       () => getFacilityBreakdown(supabase, botId, from, to),
    'location':       () => getLocationVolume(supabase, botId, from, to),
    'audit':          () => getAuditTrail(supabase, botId, from, to),
    'survey':         () => getSurveyResponses(supabase, botId, from, to),
    'funnel':         () => getBookingFunnel(supabase, botId, from, to),
  }

  const handler = handlers[report]
  if (!handler) {
    return Response.json({ error: `Unknown report: ${report}` }, { status: 400 })
  }

  const { data, error } = await handler()
  if (error) {
    return Response.json(
      {
        error:
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as { message: string }).message
            : 'Query failed',
      },
      { status: 500 }
    )
  }

  return Response.json(data)
}
