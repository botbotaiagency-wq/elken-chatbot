'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import type { DateRange } from 'react-day-picker'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { downloadCsv } from '@/lib/analytics/csv'

// ─── Constants ───────────────────────────────────────────────────────────────

const INTENT_LABELS: Record<string, string> = {
  browse_product: 'Browse Product',
  health_issue: 'Health Issue',
  book_session: 'Book Session',
  faq: 'FAQ',
  general: 'Unknown',
  unknown: 'Unknown',
}

const FACILITY_DISPLAY: Record<string, string> = {
  bed_female: 'Bed (Female)',
  bed_male: 'Bed (Male)',
  bed_unisex: 'Bed (Unisex)',
  inhaler: 'Inhaler',
  room_small: 'Meeting Room (Small)',
  room_large: 'Meeting Room (Large)',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingChart({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse bg-muted rounded-md"
      style={{ height }}
      aria-busy="true"
      aria-label="Loading analytics..."
    />
  )
}

function LoadingTableRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i}>
          <td colSpan={99} className="py-1 px-0">
            <div className="h-8 animate-pulse bg-muted rounded" aria-busy="true" aria-label="Loading analytics..." />
          </td>
        </tr>
      ))}
    </>
  )
}

function LoadingStat() {
  return <div className="h-8 w-24 animate-pulse bg-muted rounded" aria-busy="true" aria-label="Loading analytics..." />
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <p className="text-sm font-semibold">Could not load data</p>
      <p className="text-xs text-muted-foreground">Refresh the page or try again in a moment.</p>
    </div>
  )
}

function ChartEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <p className="text-sm font-semibold">No data for this period</p>
      <p className="text-xs text-muted-foreground">Try selecting a longer date range or a different bot.</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  // Bot selector
  const [bots, setBots] = useState<{ id: string; name: string }[]>([])
  const [selectedBotId, setSelectedBotId] = useState<string>('')

  // Date filter
  const [datePreset, setDatePreset] = useState<'today' | '7d' | '30d' | 'custom'>('7d')
  const [customRange, setCustomRange] = useState<DateRange | undefined>()

  // Active tab
  const [activeTab, setActiveTab] = useState('message-stats')

  // Data state — Message Stats
  const [messageVolume, setMessageVolume] = useState<{ day: string; channel: string; count: number }[] | null>(null)
  const [intentData, setIntentData] = useState<{ intent: string; count: number }[] | null>(null)
  const [unansweredData, setUnansweredData] = useState<{ content: string; frequency: number }[] | null>(null)
  const [latencyData, setLatencyData] = useState<{ p50: number; p95: number } | null>(null)

  // Data state — Booking Reports
  const [confirmedLocation, setConfirmedLocation] = useState<'all' | 'okr' | 'subang'>('all')
  const [confirmedData, setConfirmedData] = useState<any[] | null>(null)
  const [funnelData, setFunnelData] = useState<{ enquiries: number; submitted: number; confirmed: number; attended: number } | null>(null)
  const [facilityData, setFacilityData] = useState<{ facility_type: string; count: number }[] | null>(null)
  const [locationData, setLocationData] = useState<{ okr: number; subang: number } | null>(null)
  const [cancellationsData, setCancellationsData] = useState<any[] | null>(null)
  const [auditData, setAuditData] = useState<any[] | null>(null)

  // Data state — Survey
  const [surveyData, setSurveyData] = useState<any[] | null>(null)

  // Loading/error per report
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  // Cache ref
  const cache = useRef<Record<string, unknown>>({})

  // ─── Date range computation ───────────────────────────────────────────────

  const getDateRange = useCallback((): { from: string; to: string } => {
    const now = new Date()
    const to = now.toISOString()
    if (datePreset === 'today') {
      const from = new Date(now)
      from.setHours(0, 0, 0, 0)
      return { from: from.toISOString(), to }
    }
    if (datePreset === '7d') {
      const from = new Date(now)
      from.setDate(from.getDate() - 7)
      return { from: from.toISOString(), to }
    }
    if (datePreset === '30d') {
      const from = new Date(now)
      from.setDate(from.getDate() - 30)
      return { from: from.toISOString(), to }
    }
    // custom
    if (customRange?.from && customRange?.to) {
      return { from: customRange.from.toISOString(), to: customRange.to.toISOString() }
    }
    // fallback to 7d
    const from = new Date(now)
    from.setDate(from.getDate() - 7)
    return { from: from.toISOString(), to }
  }, [datePreset, customRange])

  // ─── Fetch helper ─────────────────────────────────────────────────────────

  async function fetchReport(botId: string, report: string, from: string, to: string, extra?: string): Promise<unknown> {
    const extraQ = extra ? `&${extra}` : ''
    const res = await fetch(
      `/api/analytics/${botId}?report=${report}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${extraQ}`
    )
    if (!res.ok) throw new Error(`Failed to fetch ${report}`)
    return res.json()
  }

  // ─── Bot fetch on mount ───────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/bots')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.bots ?? [])
        setBots(list)
      })
      .catch(() => {})
  }, [])

  // ─── Bot change handler ───────────────────────────────────────────────────

  const handleBotChange = useCallback((botId: string) => {
    setSelectedBotId(botId)
    // Clear cache and reset all data
    cache.current = {}
    setMessageVolume(null)
    setIntentData(null)
    setUnansweredData(null)
    setLatencyData(null)
    setConfirmedData(null)
    setFunnelData(null)
    setFacilityData(null)
    setLocationData(null)
    setCancellationsData(null)
    setAuditData(null)
    setSurveyData(null)
    setErrors({})
  }, [])

  // ─── Data fetching effect ─────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedBotId) return
    const { from, to } = getDateRange()

    async function fetchWithCache<T>(
      report: string,
      setter: (v: T | null) => void,
      extra?: string
    ) {
      const cacheKey = `${selectedBotId}:${from}:${to}:${report}${extra ? ':' + extra : ''}`
      if (cache.current[cacheKey] !== undefined) {
        setter(cache.current[cacheKey] as T)
        return
      }
      setLoading((prev) => ({ ...prev, [report]: true }))
      setErrors((prev) => ({ ...prev, [report]: false }))
      try {
        const data = await fetchReport(selectedBotId, report, from, to, extra)
        cache.current[cacheKey] = data
        setter(data as T)
      } catch {
        setErrors((prev) => ({ ...prev, [report]: true }))
        setter(null)
      } finally {
        setLoading((prev) => ({ ...prev, [report]: false }))
      }
    }

    if (activeTab === 'message-stats') {
      fetchWithCache<{ day: string; channel: string; count: number }[]>('message-volume', setMessageVolume)
      fetchWithCache<{ intent: string; count: number }[]>('intent', setIntentData)
      fetchWithCache<{ content: string; frequency: number }[]>('unanswered', setUnansweredData)
      fetchWithCache<{ p50: number; p95: number }>('latency', setLatencyData)
    }

    if (activeTab === 'booking-reports') {
      const locationExtra = confirmedLocation !== 'all' ? `location=${confirmedLocation}` : undefined
      fetchWithCache<any[]>('confirmed', setConfirmedData, locationExtra ? `confirmed:${confirmedLocation}` : undefined)
      fetchWithCache<{ enquiries: number; submitted: number; confirmed: number; attended: number }>('funnel', setFunnelData)
      fetchWithCache<{ facility_type: string; count: number }[]>('facility', setFacilityData)
      fetchWithCache<{ okr: number; subang: number }>('location', setLocationData)
      fetchWithCache<any[]>('cancellations', setCancellationsData)
      fetchWithCache<any[]>('audit', setAuditData)
    }

    if (activeTab === 'survey') {
      fetchWithCache<any[]>('survey', setSurveyData)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBotId, datePreset, customRange, activeTab])

  // Re-fetch confirmed when location filter changes (booking-reports tab only)
  useEffect(() => {
    if (!selectedBotId || activeTab !== 'booking-reports') return
    const { from, to } = getDateRange()
    const cacheKey = `${selectedBotId}:${from}:${to}:confirmed:${confirmedLocation}`
    if (cache.current[cacheKey] !== undefined) {
      setConfirmedData(cache.current[cacheKey] as any[])
      return
    }
    setLoading((prev) => ({ ...prev, confirmed: true }))
    setErrors((prev) => ({ ...prev, confirmed: false }))
    const locationExtra = confirmedLocation !== 'all' ? `location=${confirmedLocation}` : undefined
    fetchReport(selectedBotId, 'confirmed', from, to, locationExtra)
      .then((data) => {
        cache.current[cacheKey] = data
        setConfirmedData(data as any[])
      })
      .catch(() => {
        setErrors((prev) => ({ ...prev, confirmed: true }))
        setConfirmedData(null)
      })
      .finally(() => {
        setLoading((prev) => ({ ...prev, confirmed: false }))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedLocation])

  // ─── CSV export helper ────────────────────────────────────────────────────

  const { from: exportFrom, to: exportTo } = getDateRange()

  function handleExport(report: string, data: Record<string, unknown>[]) {
    downloadCsv(data, `${report}_${selectedBotId}_${exportFrom}_${exportTo}.csv`)
    toast.success('Report exported.')
  }

  // ─── Date filter display ──────────────────────────────────────────────────

  function customRangeLabel(): string {
    if (customRange?.from && customRange?.to) {
      const f = customRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const t = customRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `${f} - ${t}`
    }
    return 'Custom'
  }

  // ─── Message Stats data transforms ───────────────────────────────────────

  // Aggregate message volume by day (sum all channels)
  const aggregatedVolume = messageVolume
    ? Object.values(
        messageVolume.reduce<Record<string, { day: string; count: number }>>((acc, row) => {
          if (!acc[row.day]) acc[row.day] = { day: row.day, count: 0 }
          acc[row.day].count += row.count
          return acc
        }, {})
      )
    : null

  // Intent chart data with display labels
  const intentChartData = intentData
    ? intentData.map((row) => ({
        ...row,
        label: INTENT_LABELS[row.intent] ?? row.intent,
      }))
    : null

  const intentTotal = intentData ? intentData.reduce((s, r) => s + r.count, 0) : 0

  const messageVolumeChartConfig: ChartConfig = {
    messages: { label: 'Messages', color: 'hsl(var(--chart-1))' },
  }

  const intentChartConfig: ChartConfig = {
    count: { label: 'Count', color: 'hsl(var(--chart-1))' },
  }

  // ─── Facility chart data ──────────────────────────────────────────────────

  const facilityChartData = facilityData
    ? facilityData.map((row) => ({
        ...row,
        label: FACILITY_DISPLAY[row.facility_type] ?? row.facility_type,
      }))
    : null

  const facilityChartConfig: ChartConfig = {
    count: { label: 'Count', color: 'hsl(var(--chart-1))' },
  }

  // ─── Audit trail flat rows ────────────────────────────────────────────────

  type AuditRow = {
    booking_id: string
    customer: string
    action: string
    who: string
    timestamp: string
    note: string
  }

  const flatAuditRows: AuditRow[] = auditData
    ? auditData
        .flatMap((booking: any) =>
          (booking.audit_log || []).map((entry: any) => ({
            booking_id: booking.id,
            customer: booking.customer_name,
            action: entry.action,
            who: entry.who,
            timestamp: entry.timestamp,
            note: entry.note || '',
          }))
        )
        .sort((a: AuditRow, b: AuditRow) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
    : []

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Message volume, intent breakdown, and booking reports for your bot.
        </p>
      </div>

      {/* Bot selector */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Select a bot to view analytics:</Label>
        <Select value={selectedBotId} onValueChange={handleBotChange}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choose a bot..." />
          </SelectTrigger>
          <SelectContent>
            {bots.map((bot) => (
              <SelectItem key={bot.id} value={bot.id}>
                {bot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedBotId && (
        <>
          {/* Date filter bar */}
          <div className="flex items-center gap-2">
            <Button
              variant={datePreset === 'today' ? 'default' : 'outline'}
              size="sm"
              className="h-11"
              aria-pressed={datePreset === 'today'}
              onClick={() => setDatePreset('today')}
            >
              Today
            </Button>
            <Button
              variant={datePreset === '7d' ? 'default' : 'outline'}
              size="sm"
              className="h-11"
              aria-pressed={datePreset === '7d'}
              onClick={() => setDatePreset('7d')}
            >
              7 days
            </Button>
            <Button
              variant={datePreset === '30d' ? 'default' : 'outline'}
              size="sm"
              className="h-11"
              aria-pressed={datePreset === '30d'}
              onClick={() => setDatePreset('30d')}
            >
              30 days
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={datePreset === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  className="h-11"
                  aria-pressed={datePreset === 'custom'}
                >
                  {datePreset === 'custom' && customRange?.from && customRange?.to
                    ? customRangeLabel()
                    : 'Custom'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range)
                    if (range?.from && range?.to) setDatePreset('custom')
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="message-stats">Message Stats</TabsTrigger>
              <TabsTrigger value="booking-reports">Booking Reports</TabsTrigger>
              <TabsTrigger value="survey">Survey</TabsTrigger>
            </TabsList>

            {/* ── Message Stats Tab ───────────────────────────────────────── */}
            <TabsContent value="message-stats" className="space-y-4 mt-4">

              {/* Message Volume */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Message Volume</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!aggregatedVolume || errors['message-volume']}
                    aria-label="Export Message Volume as CSV"
                    onClick={() =>
                      aggregatedVolume &&
                      handleExport('message-volume', aggregatedVolume as Record<string, unknown>[])
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading['message-volume'] ? (
                    <LoadingChart height={200} />
                  ) : errors['message-volume'] ? (
                    <ErrorState />
                  ) : !aggregatedVolume || aggregatedVolume.length === 0 ? (
                    <ChartEmptyState />
                  ) : (
                    <ChartContainer
                      config={messageVolumeChartConfig}
                      className="h-[200px] w-full"
                      role="img"
                      aria-label="Message volume over the selected period"
                    >
                      <AreaChart data={aggregatedVolume}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="var(--color-messages)"
                          fill="var(--color-messages)"
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Intent Breakdown */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Intent Breakdown</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!intentChartData || errors['intent']}
                    aria-label="Export Intent Breakdown as CSV"
                    onClick={() =>
                      intentChartData &&
                      handleExport('intent-breakdown', intentChartData as Record<string, unknown>[])
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading['intent'] ? (
                    <LoadingChart height={180} />
                  ) : errors['intent'] ? (
                    <ErrorState />
                  ) : !intentChartData || intentChartData.length === 0 ? (
                    <ChartEmptyState />
                  ) : (
                    <ChartContainer
                      config={intentChartConfig}
                      className="h-[180px] w-full"
                      role="img"
                      aria-label="Intent breakdown for the selected period"
                    >
                      <BarChart data={intentChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="label" width={120} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, name, item) => {
                                const pct = intentTotal > 0
                                  ? ((Number(value) / intentTotal) * 100).toFixed(1)
                                  : '0.0'
                                return (
                                  <span>
                                    {value} ({pct}%)
                                  </span>
                                )
                              }}
                            />
                          }
                        />
                        <Bar dataKey="count" fill="hsl(var(--chart-1))" />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Unanswered Queries */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Unanswered Queries</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!unansweredData || errors['unanswered']}
                    aria-label="Export Unanswered Queries as CSV"
                    onClick={() =>
                      unansweredData &&
                      handleExport(
                        'unanswered-queries',
                        unansweredData.map((r) => ({ query: r.content, count: r.frequency }))
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Query</th>
                        <th className="text-right text-xs text-muted-foreground pb-2 font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading['unanswered'] ? (
                        <LoadingTableRows />
                      ) : errors['unanswered'] ? (
                        <tr>
                          <td colSpan={2}>
                            <ErrorState />
                          </td>
                        </tr>
                      ) : !unansweredData || unansweredData.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-center py-8 text-muted-foreground">
                            No records for this period.
                          </td>
                        </tr>
                      ) : (
                        unansweredData.map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="py-2 pr-4">{row.content}</td>
                            <td className="py-2 text-right">{row.frequency}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Response Latency */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Response Latency</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!latencyData || errors['latency']}
                    aria-label="Export Response Latency as CSV"
                    onClick={() =>
                      latencyData &&
                      handleExport('response-latency', [
                        { metric: 'p50', value_ms: latencyData.p50 },
                        { metric: 'p95', value_ms: latencyData.p95 },
                      ])
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading['latency'] ? (
                    <div className="grid grid-cols-2 gap-4">
                      <LoadingStat />
                      <LoadingStat />
                    </div>
                  ) : errors['latency'] ? (
                    <ErrorState />
                  ) : !latencyData ? (
                    <ChartEmptyState />
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-semibold">{latencyData.p50}ms</p>
                        <p className="text-xs text-muted-foreground">Median (p50)</p>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold">{latencyData.p95}ms</p>
                        <p className="text-xs text-muted-foreground">95th Percentile (p95)</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Booking Reports Tab ─────────────────────────────────────── */}
            <TabsContent value="booking-reports" className="space-y-4 mt-4">

              {/* Confirmed Bookings */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Confirmed Bookings</CardTitle>
                  <div className="ml-auto flex items-center gap-2">
                    <Select
                      value={confirmedLocation}
                      onValueChange={(v) => setConfirmedLocation(v as 'all' | 'okr' | 'subang')}
                    >
                      <SelectTrigger className="w-[160px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        <SelectItem value="okr">Old Klang Road</SelectItem>
                        <SelectItem value="subang">Subang</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!confirmedData || errors['confirmed']}
                      aria-label="Export Confirmed Bookings as CSV"
                      onClick={() =>
                        confirmedData &&
                        handleExport(
                          'confirmed-bookings',
                          confirmedData.map((b) => ({
                            name: b.customer_name,
                            facility: b.facility_type,
                            location: b.location,
                            date: b.session_start,
                            status: b.status,
                          }))
                        )
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading['confirmed'] ? (
                    <div className="space-y-2">
                      <LoadingStat />
                    </div>
                  ) : errors['confirmed'] ? (
                    <ErrorState />
                  ) : !confirmedData ? (
                    <ChartEmptyState />
                  ) : (
                    <div>
                      <p className="text-2xl font-semibold">{confirmedData.length}</p>
                      <p className="text-xs text-muted-foreground">confirmed bookings in selected period</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Booking Funnel */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Booking Funnel</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!funnelData || errors['funnel']}
                    aria-label="Export Booking Funnel as CSV"
                    onClick={() =>
                      funnelData &&
                      handleExport('booking-funnel', [
                        { stage: 'Enquiries', count: funnelData.enquiries, conversion: '100%' },
                        {
                          stage: 'Submitted',
                          count: funnelData.submitted,
                          conversion:
                            funnelData.enquiries > 0
                              ? `${((funnelData.submitted / funnelData.enquiries) * 100).toFixed(1)}%`
                              : '---',
                        },
                        {
                          stage: 'Confirmed',
                          count: funnelData.confirmed,
                          conversion:
                            funnelData.enquiries > 0
                              ? `${((funnelData.confirmed / funnelData.enquiries) * 100).toFixed(1)}%`
                              : '---',
                        },
                        {
                          stage: 'Attended',
                          count: funnelData.attended,
                          conversion:
                            funnelData.enquiries > 0
                              ? `${((funnelData.attended / funnelData.enquiries) * 100).toFixed(1)}%`
                              : '---',
                        },
                      ])
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading['funnel'] ? (
                    <div className="grid grid-cols-4 gap-4">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-20 animate-pulse bg-muted rounded" aria-busy="true" aria-label="Loading analytics..." />
                      ))}
                    </div>
                  ) : errors['funnel'] ? (
                    <ErrorState />
                  ) : (
                    <div className="grid grid-cols-4 gap-4">
                      {(
                        [
                          { key: 'enquiries', label: 'Enquiries' },
                          { key: 'submitted', label: 'Submitted' },
                          { key: 'confirmed', label: 'Confirmed' },
                          { key: 'attended', label: 'Attended' },
                        ] as const
                      ).map(({ key, label }) => {
                        const count = funnelData?.[key] ?? 0
                        const enquiries = funnelData?.enquiries ?? 0
                        const pct =
                          key === 'enquiries'
                            ? '100%'
                            : enquiries > 0
                            ? `${((count / enquiries) * 100).toFixed(1)}%`
                            : '---'
                        return (
                          <div key={key} className="flex flex-col gap-1 p-3 border rounded-md">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-2xl font-semibold">{count}</p>
                            <p className="text-xs text-muted-foreground">{pct}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Facility Breakdown */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Facility Breakdown</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!facilityChartData || errors['facility']}
                    aria-label="Export Facility Breakdown as CSV"
                    onClick={() =>
                      facilityChartData &&
                      handleExport('facility-breakdown', facilityChartData as Record<string, unknown>[])
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading['facility'] ? (
                    <LoadingChart height={180} />
                  ) : errors['facility'] ? (
                    <ErrorState />
                  ) : !facilityChartData || facilityChartData.length === 0 ? (
                    <ChartEmptyState />
                  ) : (
                    <ChartContainer
                      config={facilityChartConfig}
                      className="h-[180px] w-full"
                      role="img"
                      aria-label="Facility breakdown for the selected period"
                    >
                      <BarChart data={facilityChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="label" width={160} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="hsl(var(--chart-1))" />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Location Volume */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Location Volume</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!locationData || errors['location']}
                    aria-label="Export Location Volume as CSV"
                    onClick={() =>
                      locationData &&
                      handleExport('location-volume', [
                        { location: 'Old Klang Road', count: locationData.okr },
                        { location: 'Subang', count: locationData.subang },
                      ])
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading['location'] ? (
                    <div className="grid grid-cols-2 gap-4">
                      <LoadingStat />
                      <LoadingStat />
                    </div>
                  ) : errors['location'] ? (
                    <ErrorState />
                  ) : !locationData ? (
                    <ChartEmptyState />
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-semibold">{locationData.okr}</p>
                        <p className="text-xs text-muted-foreground">Old Klang Road</p>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold">{locationData.subang}</p>
                        <p className="text-xs text-muted-foreground">Subang</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cancellations */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Cancellations</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!cancellationsData || errors['cancellations']}
                    aria-label="Export Cancellations as CSV"
                    onClick={() =>
                      cancellationsData &&
                      handleExport(
                        'cancellations',
                        cancellationsData.map((b) => {
                          const lastAudit =
                            b.audit_log && b.audit_log.length > 0
                              ? b.audit_log[b.audit_log.length - 1]
                              : null
                          return {
                            customer: b.customer_name,
                            facility: b.facility_type,
                            location: b.location,
                            session_date: b.session_start,
                            last_action: lastAudit
                              ? `${lastAudit.action} by ${lastAudit.who} at ${lastAudit.timestamp}`
                              : '',
                          }
                        })
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Customer</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Facility</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Location</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Session Date</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Last Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading['cancellations'] ? (
                        <LoadingTableRows />
                      ) : errors['cancellations'] ? (
                        <tr>
                          <td colSpan={5}>
                            <ErrorState />
                          </td>
                        </tr>
                      ) : !cancellationsData || cancellationsData.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-muted-foreground">
                            No records for this period.
                          </td>
                        </tr>
                      ) : (
                        cancellationsData.map((b: any, i: number) => {
                          const lastAudit =
                            b.audit_log && b.audit_log.length > 0
                              ? b.audit_log[b.audit_log.length - 1]
                              : null
                          return (
                            <tr key={i} className="border-t">
                              <td className="py-2 pr-3">{b.customer_name}</td>
                              <td className="py-2 pr-3">{FACILITY_DISPLAY[b.facility_type] ?? b.facility_type}</td>
                              <td className="py-2 pr-3">{b.location}</td>
                              <td className="py-2 pr-3">{formatDate(b.session_start)}</td>
                              <td className="py-2 text-xs text-muted-foreground">
                                {lastAudit
                                  ? `Last action: ${lastAudit.action} by ${lastAudit.who} at ${lastAudit.timestamp}`
                                  : '—'}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Full Audit Trail */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Full Audit Trail</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!auditData || errors['audit']}
                    aria-label="Export Full Audit Trail as CSV"
                    onClick={() =>
                      flatAuditRows.length > 0 &&
                      handleExport('audit-trail', flatAuditRows as unknown as Record<string, unknown>[])
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Customer</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Action</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">By</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Timestamp</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading['audit'] ? (
                        <LoadingTableRows />
                      ) : errors['audit'] ? (
                        <tr>
                          <td colSpan={5}>
                            <ErrorState />
                          </td>
                        </tr>
                      ) : flatAuditRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-muted-foreground">
                            No records for this period.
                          </td>
                        </tr>
                      ) : (
                        flatAuditRows.map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="py-2 pr-3">{row.customer}</td>
                            <td className="py-2 pr-3">{row.action}</td>
                            <td className="py-2 pr-3">{row.who}</td>
                            <td className="py-2 pr-3">{formatDate(row.timestamp)}</td>
                            <td className="py-2 text-xs text-muted-foreground">{row.note || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Survey Tab ──────────────────────────────────────────────── */}
            <TabsContent value="survey" className="space-y-4 mt-4">

              {/* Customer Satisfaction */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Customer Satisfaction</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!surveyData || errors['survey']}
                    aria-label="Export Customer Satisfaction as CSV"
                    onClick={() =>
                      surveyData &&
                      handleExport(
                        'customer-satisfaction',
                        surveyData.map((b) => ({
                          customer: b.customer_name,
                          facility: FACILITY_DISPLAY[b.facility_type] ?? b.facility_type,
                          session_date: b.session_start,
                          rating: b.survey_response?.rating ?? '',
                          comments: b.survey_response?.comments ?? b.survey_response?.feedback ?? '',
                        }))
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Customer</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Facility</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Session Date</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Rating</th>
                        <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading['survey'] ? (
                        <LoadingTableRows />
                      ) : errors['survey'] ? (
                        <tr>
                          <td colSpan={5}>
                            <ErrorState />
                          </td>
                        </tr>
                      ) : !surveyData || surveyData.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-muted-foreground">
                            No records for this period.
                          </td>
                        </tr>
                      ) : (
                        surveyData.map((b: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="py-2 pr-3">{b.customer_name}</td>
                            <td className="py-2 pr-3">{FACILITY_DISPLAY[b.facility_type] ?? b.facility_type}</td>
                            <td className="py-2 pr-3">{formatDate(b.session_start)}</td>
                            <td className="py-2 pr-3">{b.survey_response?.rating ?? '—'}</td>
                            <td className="py-2">{b.survey_response?.comments ?? b.survey_response?.feedback ?? '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
