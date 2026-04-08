'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface ChannelConfig {
  id?: string
  channel: string
  is_active: boolean
  webhook_url: string | null
  last_connected_at: string | null
  config: Record<string, string>
}

const CHANNEL_META: Record<string, { label: string; icon: string; color: string; available: boolean }> = {
  whatsapp: { label: 'WhatsApp', icon: '💬', color: 'text-green-600 border-green-200 bg-green-50', available: true },
  telegram: { label: 'Telegram', icon: '✈️', color: 'text-blue-600 border-blue-200 bg-blue-50', available: true },
  web_widget: { label: 'Web Widget', icon: '🌐', color: 'text-indigo-600 border-indigo-200 bg-indigo-50', available: true },
  instagram: { label: 'Instagram', icon: '📸', color: 'text-pink-600 border-pink-200 bg-pink-50', available: false },
  facebook: { label: 'Facebook', icon: '👤', color: 'text-blue-800 border-blue-200 bg-blue-50', available: false },
}

export default function ChannelsPage() {
  const { botId } = useParams<{ botId: string }>()

  const [configs, setConfigs] = useState<ChannelConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [configuring, setConfiguring] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [setupMsg, setSetupMsg] = useState<string | null>(null)

  // WhatsApp form state
  const [wa, setWa] = useState({ phone_number_id: '', access_token: '', verify_token: '', waba_id: '', app_secret: '' })
  // Telegram form state
  const [tg, setTg] = useState({ bot_token: '', bot_username: '' })

  useEffect(() => {
    fetch(`/api/config/${botId}/channels`)
      .then(r => r.json())
      .then((data: ChannelConfig[]) => {
        setConfigs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [botId])

  function getConfig(channel: string): ChannelConfig | undefined {
    return configs.find(c => c.channel === channel)
  }

  async function toggleActive(channel: string, current: boolean) {
    await fetch(`/api/config/${botId}/channels`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, is_active: !current }),
    })
    setConfigs(prev => prev.map(c => c.channel === channel ? { ...c, is_active: !current } : c))
  }

  async function saveWhatsApp() {
    setSaving(true)
    setSetupMsg(null)
    const res = await fetch(`/api/config/${botId}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'whatsapp', ...wa }),
    })
    if (res.ok) {
      const updated = await res.json() as ChannelConfig
      setConfigs(prev => {
        const exists = prev.find(c => c.channel === 'whatsapp')
        return exists
          ? prev.map(c => c.channel === 'whatsapp' ? { ...c, ...updated } : c)
          : [...prev, { ...updated, config: {} }]
      })
      setConfiguring(null)
      setSetupMsg('WhatsApp configured. Set webhook URL in Meta Business: /api/webhook/whatsapp?bot_id=' + botId)
    }
    setSaving(false)
  }

  async function saveTelegram() {
    setSaving(true)
    setSetupMsg(null)
    const res = await fetch(`/api/config/${botId}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', ...tg }),
    })
    if (res.ok) {
      const updated = await res.json() as ChannelConfig
      setConfigs(prev => {
        const exists = prev.find(c => c.channel === 'telegram')
        return exists
          ? prev.map(c => c.channel === 'telegram' ? { ...c, ...updated } : c)
          : [...prev, { ...updated, config: {} }]
      })
      setConfiguring(null)
    }
    setSaving(false)
  }

  async function registerTelegramWebhook() {
    setSaving(true)
    setSetupMsg(null)
    const res = await fetch(`/api/webhook/telegram/setup?bot_id=${botId}`, { method: 'POST' })
    const data = await res.json() as { success?: boolean; webhook_url?: string; error?: string }
    if (data.success) {
      setSetupMsg(`Telegram webhook registered: ${data.webhook_url}`)
    } else {
      setSetupMsg(`Error: ${data.error}`)
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading channels...</div>
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-xl font-semibold">Channel Connections</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect WhatsApp, Telegram, or embed a web widget on your website.
        </p>
      </div>

      {setupMsg && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          {setupMsg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(CHANNEL_META).map(([channel, meta]) => {
          const cfg = getConfig(channel)
          const isConfigured = !!cfg

          return (
            <div
              key={channel}
              className={`rounded-lg border p-5 space-y-4 ${!meta.available ? 'opacity-50' : ''}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{meta.label}</p>
                    {!meta.available && (
                      <span className="text-xs text-muted-foreground">Coming soon</span>
                    )}
                  </div>
                </div>
                {/* Active toggle */}
                {meta.available && isConfigured && (
                  <button
                    onClick={() => toggleActive(channel, cfg.is_active)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      cfg.is_active ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        cfg.is_active ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="text-xs text-muted-foreground">
                {!isConfigured && meta.available && 'Not configured'}
                {isConfigured && cfg.is_active && (
                  <span className="text-green-600 font-medium">Active</span>
                )}
                {isConfigured && !cfg.is_active && 'Configured — inactive'}
                {cfg?.last_connected_at && (
                  <span className="block text-muted-foreground">
                    Last connected: {new Date(cfg.last_connected_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Actions */}
              {meta.available && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfiguring(configuring === channel ? null : channel)}
                    className="text-xs rounded border px-3 py-1 hover:bg-muted"
                    disabled={!meta.available}
                  >
                    {isConfigured ? 'Edit' : 'Configure'}
                  </button>
                  {channel === 'telegram' && isConfigured && (
                    <button
                      onClick={registerTelegramWebhook}
                      disabled={saving}
                      className="text-xs rounded border px-3 py-1 hover:bg-muted"
                    >
                      Register Webhook
                    </button>
                  )}
                  {channel === 'web_widget' && (
                    <a
                      href={`/dashboard/bots/${botId}/widget`}
                      className="text-xs rounded border px-3 py-1 hover:bg-muted"
                    >
                      Widget Settings
                    </a>
                  )}
                </div>
              )}

              {/* WhatsApp config form */}
              {configuring === 'whatsapp' && channel === 'whatsapp' && (
                <div className="space-y-3 border-t pt-3">
                  {[
                    { key: 'phone_number_id', label: 'Phone Number ID', placeholder: '123456789012345' },
                    { key: 'waba_id', label: 'WhatsApp Business Account ID', placeholder: '123456789012345' },
                    { key: 'access_token', label: 'Access Token (permanent)', placeholder: 'EAAxxxxxx...', type: 'password' },
                    { key: 'verify_token', label: 'Webhook Verify Token', placeholder: 'your-secret-verify-token' },
                    { key: 'app_secret', label: 'App Secret (for signature validation)', placeholder: 'optional', type: 'password' },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-xs font-medium">{label}</label>
                      <input
                        type={type ?? 'text'}
                        value={wa[key as keyof typeof wa]}
                        onChange={e => setWa(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      />
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground bg-muted rounded p-2">
                    Webhook URL for Meta:<br />
                    <code className="break-all">/api/webhook/whatsapp?bot_id={botId}</code>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveWhatsApp}
                      disabled={saving}
                      className="text-xs rounded bg-primary px-3 py-1 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setConfiguring(null)} className="text-xs rounded border px-3 py-1 hover:bg-muted">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Telegram config form */}
              {configuring === 'telegram' && channel === 'telegram' && (
                <div className="space-y-3 border-t pt-3">
                  {[
                    { key: 'bot_username', label: 'Bot Username', placeholder: '@YourBot' },
                    { key: 'bot_token', label: 'Bot Token (from @BotFather)', placeholder: '123456:ABC-DEF...', type: 'password' },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-xs font-medium">{label}</label>
                      <input
                        type={type ?? 'text'}
                        value={tg[key as keyof typeof tg]}
                        onChange={e => setTg(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={saveTelegram}
                      disabled={saving}
                      className="text-xs rounded bg-primary px-3 py-1 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save & Register Webhook'}
                    </button>
                    <button onClick={() => setConfiguring(null)} className="text-xs rounded border px-3 py-1 hover:bg-muted">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
