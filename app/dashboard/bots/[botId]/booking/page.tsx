'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'

import { FacilityType, FACILITY_LABELS } from '@/lib/booking/types'

const FACILITY_TYPES: FacilityType[] = [
  'bed_female',
  'bed_male',
  'bed_unisex',
  'inhaler',
  'room_small',
  'room_large',
]

interface FacilityConfigRow {
  facility_type: FacilityType
  capacity: number
  duration_minutes: number
  min_advance_hours: number
  max_window_days: number
}

const DEFAULT_CONFIG: Omit<FacilityConfigRow, 'facility_type'> = {
  capacity: 1,
  duration_minutes: 60,
  min_advance_hours: 2,
  max_window_days: 30,
}

export default function BookingConfigPage() {
  const params = useParams()
  const botId = params.botId as string

  const [configs, setConfigs] = useState<FacilityConfigRow[]>(
    FACILITY_TYPES.map((ft) => ({ facility_type: ft, ...DEFAULT_CONFIG }))
  )
  const [bookingEnabled, setBookingEnabled] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [savingModule, setSavingModule] = useState(false)
  const [savingWebhook, setSavingWebhook] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        // Load facility configs
        const configRes = await fetch(`/api/bots/${botId}/facilities`)
        if (configRes.ok) {
          const configData = await configRes.json()
          if (configData.configs && configData.configs.length > 0) {
            // Merge loaded configs with defaults for any missing facility types
            const merged = FACILITY_TYPES.map((ft) => {
              const existing = configData.configs.find(
                (c: FacilityConfigRow) => c.facility_type === ft
              )
              return existing
                ? {
                    facility_type: ft,
                    capacity: existing.capacity,
                    duration_minutes: existing.duration_minutes,
                    min_advance_hours: existing.min_advance_hours,
                    max_window_days: existing.max_window_days,
                  }
                : { facility_type: ft, ...DEFAULT_CONFIG }
            })
            setConfigs(merged)
          }
        }

        // Load bot data for feature flags + webhook
        const botRes = await fetch(`/api/bots`)
        if (botRes.ok) {
          const botData = await botRes.json()
          const bot = botData.bots?.find((b: { id: string; feature_flags?: Record<string, boolean>; n8n_outbound_webhook?: string }) => b.id === botId)
          if (bot) {
            setBookingEnabled(bot.feature_flags?.booking_enabled ?? false)
            setWebhookUrl(bot.n8n_outbound_webhook ?? '')
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [botId])

  function updateConfig(facility_type: FacilityType, field: keyof Omit<FacilityConfigRow, 'facility_type'>, value: string) {
    setConfigs((prev) =>
      prev.map((c) =>
        c.facility_type === facility_type ? { ...c, [field]: parseInt(value) || 0 } : c
      )
    )
  }

  async function handleSaveModule() {
    setSavingModule(true)
    try {
      const res = await fetch(`/api/config/${botId}/feature-flags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_enabled: bookingEnabled }),
      })
      if (!res.ok) throw new Error()
      toast.success('Booking module setting saved.')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSavingModule(false)
    }
  }

  async function handleSaveConfig() {
    setSavingConfig(true)
    try {
      const res = await fetch(`/api/bots/${botId}/facilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs }),
      })
      if (!res.ok) throw new Error()
      toast.success('Booking configuration saved.')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleSaveWebhook() {
    setSavingWebhook(true)
    try {
      const res = await fetch(`/api/config/${botId}/webhook`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n8n_outbound_webhook: webhookUrl }),
      })
      if (!res.ok) throw new Error()
      toast.success('Webhook URL saved.')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSavingWebhook(false)
    }
  }

  if (loading) {
    return (
      <>
        <Toaster />
        <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
      </>
    )
  }

  return (
    <>
      <Toaster />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Booking Configuration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure facility types, booking rules, and notification settings for this bot.
          </p>
        </div>

        {/* Card 1: Booking Module Toggle */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                id="booking-enabled"
                type="checkbox"
                checked={bookingEnabled}
                onChange={(e) => setBookingEnabled(e.target.checked)}
                className="h-4 w-4 rounded border border-input"
              />
              <Label htmlFor="booking-enabled">Enable booking module for this bot</Label>
            </div>
            <Button onClick={handleSaveModule} disabled={savingModule}>
              {savingModule ? 'Saving...' : 'Save'}
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Facility Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Facility Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Facility Type</th>
                    <th className="pb-3 pr-4 font-medium">Capacity</th>
                    <th className="pb-3 pr-4 font-medium">Duration (min)</th>
                    <th className="pb-3 pr-4 font-medium">Min Advance (hours)</th>
                    <th className="pb-3 font-medium">Max Window (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((config) => (
                    <tr key={config.facility_type} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">
                        {FACILITY_LABELS[config.facility_type]}
                      </td>
                      <td className="py-2 pr-4">
                        <Input
                          type="number"
                          value={config.capacity}
                          onChange={(e) => updateConfig(config.facility_type, 'capacity', e.target.value)}
                          min={1}
                          className="w-20 h-8"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <Input
                          type="number"
                          value={config.duration_minutes}
                          onChange={(e) => updateConfig(config.facility_type, 'duration_minutes', e.target.value)}
                          min={15}
                          step={15}
                          className="w-20 h-8"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <Input
                          type="number"
                          value={config.min_advance_hours}
                          onChange={(e) => updateConfig(config.facility_type, 'min_advance_hours', e.target.value)}
                          min={0}
                          className="w-20 h-8"
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          type="number"
                          value={config.max_window_days}
                          onChange={(e) => updateConfig(config.facility_type, 'max_window_days', e.target.value)}
                          min={1}
                          className="w-20 h-8"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig ? 'Saving...' : 'Save Booking Config'}
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: n8n Outbound Webhook */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="webhook-url">n8n Outbound Webhook URL</Label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-n8n-instance.com/webhook/..."
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The URL n8n will receive booking notifications on. Required for confirmation, reminders, and survey messages.
              </p>
            </div>
            <Button onClick={handleSaveWebhook} disabled={savingWebhook}>
              {savingWebhook ? 'Saving...' : 'Save Webhook URL'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
