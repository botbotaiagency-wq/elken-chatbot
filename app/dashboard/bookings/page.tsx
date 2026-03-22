'use client'

import { useEffect, useState, useCallback } from 'react'
import { CalendarDays, Eye } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/sonner'

import {
  Booking,
  BookingStatus,
  FacilityType,
  BookingLocation,
  FACILITY_LABELS,
  LOCATION_LABELS,
  FACILITY_LOCATION_CONSTRAINTS,
} from '@/lib/booking/types'

interface Bot {
  id: string
  name: string
}

function statusBadgeClass(status: BookingStatus): string {
  switch (status) {
    case 'pending':
      return 'border-amber-300 text-amber-700 bg-amber-50'
    case 'confirmed':
      return 'border-green-300 text-green-700 bg-green-50'
    case 'cancelled':
      return 'border-red-300 text-red-700 bg-red-50'
    case 'no_show':
      return 'border-gray-300 text-gray-500 bg-gray-50'
    case 'walk_in':
      return 'border-blue-300 text-blue-700 bg-blue-50'
    default:
      return ''
  }
}

function statusLabel(status: BookingStatus): string {
  switch (status) {
    case 'pending': return 'Pending'
    case 'confirmed': return 'Confirmed'
    case 'cancelled': return 'Cancelled'
    case 'no_show': return 'No-show'
    case 'walk_in': return 'Walk-in'
    default: return status
  }
}

function notifBadge(sent: boolean, retryCount: number): { label: string; cls: string } {
  if (sent) return { label: 'Sent', cls: 'border-green-300 text-green-700 bg-green-50' }
  if (retryCount >= 3) return { label: 'Failed', cls: 'border-red-300 text-red-700 bg-red-50' }
  return { label: 'Pending', cls: '' }
}

const FACILITY_TYPES: FacilityType[] = [
  'bed_female',
  'bed_male',
  'bed_unisex',
  'inhaler',
  'room_small',
  'room_large',
]

export default function BookingsPage() {
  // Bot selector
  const [bots, setBots] = useState<Bot[]>([])
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null)

  // Bookings data
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [locationFilter, setLocationFilter] = useState<'all' | BookingLocation>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all')
  const [facilityFilter, setFacilityFilter] = useState<'all' | FacilityType>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Inline confirm state
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'confirm' | 'cancel' | 'no_show' | null>(null)

  // Walk-in dialog
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [walkInName, setWalkInName] = useState('')
  const [walkInMemberId, setWalkInMemberId] = useState('')
  const [walkInContact, setWalkInContact] = useState('')
  const [walkInIsMember, setWalkInIsMember] = useState<'member' | 'non_member'>('non_member')
  const [walkInFacility, setWalkInFacility] = useState<FacilityType>('bed_female')
  const [walkInLocation, setWalkInLocation] = useState<BookingLocation>('okr')
  const [walkInDatetime, setWalkInDatetime] = useState('')
  const [walkInNotes, setWalkInNotes] = useState('')
  const [walkInSubmitting, setWalkInSubmitting] = useState(false)

  // Booking detail sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editSessionStart, setEditSessionStart] = useState('')
  const [editFacility, setEditFacility] = useState<FacilityType>('bed_female')
  const [editLocation, setEditLocation] = useState<BookingLocation>('okr')
  const [editNotes, setEditNotes] = useState('')

  // Action loading
  const [actionLoading, setActionLoading] = useState(false)

  // Fetch bots on mount
  useEffect(() => {
    async function fetchBots() {
      try {
        const res = await fetch('/api/bots')
        if (!res.ok) throw new Error('Failed to fetch bots')
        const data = await res.json()
        setBots(data.bots ?? [])
      } catch {
        // silent
      }
    }
    fetchBots()
  }, [])

  // Fetch bookings when bot or filters change
  const fetchBookings = useCallback(async () => {
    if (!selectedBotId) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (locationFilter !== 'all') params.set('location', locationFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (facilityFilter !== 'all') params.set('facility_type', facilityFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const res = await fetch(`/api/bookings/${selectedBotId}?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch bookings')
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [selectedBotId, locationFilter, statusFilter, facilityFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Inline confirm handlers
  function startConfirm(bookingId: string, action: 'confirm' | 'cancel' | 'no_show') {
    setConfirmingId(bookingId)
    setConfirmAction(action)
  }

  function cancelConfirm() {
    setConfirmingId(null)
    setConfirmAction(null)
  }

  async function handleConfirm(bookingId: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/bookings/${selectedBotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action: 'confirm', staffName: 'Admin', note: '' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Booking confirmed. Customer will be notified.')
      cancelConfirm()
      await fetchBookings()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel(bookingId: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/bookings/${selectedBotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action: 'cancel', staffName: 'Admin', note: '' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Booking cancelled.')
      cancelConfirm()
      await fetchBookings()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleNoShow(bookingId: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/bookings/${selectedBotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action: 'no_show', staffName: 'Admin', note: '' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Marked as no-show.')
      cancelConfirm()
      await fetchBookings()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  // Walk-in form handlers
  function resetWalkInForm() {
    setWalkInName('')
    setWalkInMemberId('')
    setWalkInContact('')
    setWalkInIsMember('non_member')
    setWalkInFacility('bed_female')
    setWalkInLocation('okr')
    setWalkInDatetime('')
    setWalkInNotes('')
  }

  // Auto-select location when facility changes
  function handleWalkInFacilityChange(facility: FacilityType) {
    setWalkInFacility(facility)
    const allowed = FACILITY_LOCATION_CONSTRAINTS[facility]
    if (allowed.length === 1) {
      setWalkInLocation(allowed[0])
    } else if (!allowed.includes(walkInLocation)) {
      setWalkInLocation(allowed[0])
    }
  }

  async function handleWalkInSubmit() {
    if (!walkInName.trim() || !walkInContact.trim() || !walkInDatetime) return
    setWalkInSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${selectedBotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: walkInName.trim(),
          member_id: walkInMemberId.trim() || null,
          contact_number: walkInContact.trim(),
          facility_type: walkInFacility,
          location: walkInLocation,
          session_start: new Date(walkInDatetime).toISOString(),
          is_member: walkInIsMember === 'member',
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Walk-in registered successfully.')
      setWalkInOpen(false)
      resetWalkInForm()
      await fetchBookings()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setWalkInSubmitting(false)
    }
  }

  // Sheet handlers
  function openSheet(booking: Booking) {
    setSelectedBooking(booking)
    setEditMode(false)
    setEditSessionStart(booking.session_start ? new Date(booking.session_start).toISOString().slice(0, 16) : '')
    setEditFacility(booking.facility_type)
    setEditLocation(booking.location)
    setEditNotes('')
    setSheetOpen(true)
  }

  async function handleSaveEdit() {
    if (!selectedBooking || !selectedBotId) return
    setActionLoading(true)
    try {
      const session_start = editSessionStart ? new Date(editSessionStart).toISOString() : undefined
      const res = await fetch(`/api/bookings/${selectedBotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          action: 'edit',
          staffName: 'Admin',
          note: editNotes,
          session_start,
          facility_type: editFacility,
          location: editLocation,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Booking updated.')
      setEditMode(false)
      await fetchBookings()
      // Refresh selected booking
      setSelectedBooking((prev) => prev ? {
        ...prev,
        session_start: session_start ?? prev.session_start,
        facility_type: editFacility,
        location: editLocation,
      } : prev)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const availableLocations = FACILITY_LOCATION_CONSTRAINTS[walkInFacility]

  return (
    <>
      <Toaster />

      {/* Page */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">Bookings</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage facility bookings, confirm requests, and register walk-ins.
          </p>
        </div>

        {/* Bot selector */}
        {!selectedBotId ? (
          <div className="flex items-center gap-3">
            <Label>Select a bot to view bookings:</Label>
            <Select onValueChange={(val) => setSelectedBotId(val)}>
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
        ) : (
          <>
            {/* Bot switch row */}
            <div className="flex items-center gap-3">
              <Label>Bot:</Label>
              <Select value={selectedBotId} onValueChange={(val) => setSelectedBotId(val)}>
                <SelectTrigger className="w-64">
                  <SelectValue />
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

            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="space-y-2">
                  <CardTitle>All Bookings</CardTitle>
                  {/* Filter bar */}
                  <div className="flex flex-wrap gap-2">
                    {/* Location filter */}
                    <Select value={locationFilter} onValueChange={(val) => setLocationFilter(val as typeof locationFilter)}>
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        <SelectItem value="okr">GenQi Old Klang Road</SelectItem>
                        <SelectItem value="subang">GenQi Subang</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Status filter */}
                    <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="no_show">No-show</SelectItem>
                        <SelectItem value="walk_in">Walk-in</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Facility filter */}
                    <Select value={facilityFilter} onValueChange={(val) => setFacilityFilter(val as typeof facilityFilter)}>
                      <SelectTrigger className="w-52">
                        <SelectValue placeholder="Facility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Facilities</SelectItem>
                        {FACILITY_TYPES.map((ft) => (
                          <SelectItem key={ft} value={ft}>
                            {FACILITY_LABELS[ft]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Date range */}
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-36 h-9"
                        placeholder="From"
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-36 h-9"
                        placeholder="To"
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={() => setWalkInOpen(true)}>
                  Register Walk-in
                </Button>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Loading bookings...
                  </div>
                ) : bookings.length === 0 ? (
                  <div className="py-12 text-center">
                    <h3 className="text-sm font-semibold">No bookings yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Bookings submitted through the bot will appear here. You can also register a walk-in customer using the button above.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-3 pr-4 font-medium">Customer</th>
                          <th className="pb-3 pr-4 font-medium">Facility</th>
                          <th className="pb-3 pr-4 font-medium">Location</th>
                          <th className="pb-3 pr-4 font-medium">Date/Time</th>
                          <th className="pb-3 pr-4 font-medium">Status</th>
                          <th className="pb-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((booking) => (
                          <>
                            <tr key={booking.id} className="border-b last:border-0">
                              <td className="py-3 pr-4">
                                <div className="font-medium">{booking.customer_name}</div>
                                <div className="text-xs text-muted-foreground">{booking.contact_number}</div>
                              </td>
                              <td className="py-3 pr-4">{FACILITY_LABELS[booking.facility_type]}</td>
                              <td className="py-3 pr-4">{LOCATION_LABELS[booking.location]}</td>
                              <td className="py-3 pr-4">
                                <div>{new Date(booking.session_start).toLocaleDateString()}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(booking.session_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <Badge variant="outline" className={statusBadgeClass(booking.status)}>
                                  {statusLabel(booking.status)}
                                </Badge>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-1">
                                  {booking.status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => startConfirm(booking.id, 'confirm')}
                                        disabled={actionLoading}
                                      >
                                        Confirm
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive"
                                        onClick={() => startConfirm(booking.id, 'cancel')}
                                        disabled={actionLoading}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                  {booking.status === 'confirmed' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive"
                                      onClick={() => startConfirm(booking.id, 'no_show')}
                                      disabled={actionLoading}
                                    >
                                      No-show
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openSheet(booking)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                </div>
                              </td>
                            </tr>

                            {/* Inline confirm row */}
                            {confirmingId === booking.id && confirmAction && (
                              <tr key={`${booking.id}-confirm`} className="bg-destructive/5">
                                <td colSpan={6} className="px-2 py-3">
                                  <div className="flex items-center gap-3">
                                    {confirmAction === 'confirm' && (
                                      <>
                                        <span className="text-sm">
                                          Confirm this booking? A confirmation message will be sent to the customer.
                                        </span>
                                        <Button
                                          size="sm"
                                          onClick={() => handleConfirm(booking.id)}
                                          disabled={actionLoading}
                                        >
                                          Confirm
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={cancelConfirm}
                                          disabled={actionLoading}
                                        >
                                          Keep pending
                                        </Button>
                                      </>
                                    )}
                                    {confirmAction === 'cancel' && (
                                      <>
                                        <span className="text-sm text-destructive">
                                          Cancel this booking? This cannot be undone.
                                        </span>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => handleCancel(booking.id)}
                                          disabled={actionLoading}
                                        >
                                          Yes, cancel
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={cancelConfirm}
                                          disabled={actionLoading}
                                        >
                                          Keep booking
                                        </Button>
                                      </>
                                    )}
                                    {confirmAction === 'no_show' && (
                                      <>
                                        <span className="text-sm text-destructive">
                                          Mark this booking as no-show? The customer will not receive a survey.
                                        </span>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => handleNoShow(booking.id)}
                                          disabled={actionLoading}
                                        >
                                          Mark no-show
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={cancelConfirm}
                                          disabled={actionLoading}
                                        >
                                          Keep confirmed
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Walk-in Registration Dialog */}
      <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register Walk-in Customer</DialogTitle>
            <DialogDescription>
              Walk-in bookings are confirmed immediately — no staff approval required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="walkin-name">Full Name *</Label>
              <Input
                id="walkin-name"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder="Customer's full name"
              />
            </div>

            <div>
              <Label htmlFor="walkin-member-id">Member ID (optional)</Label>
              <Input
                id="walkin-member-id"
                value={walkInMemberId}
                onChange={(e) => setWalkInMemberId(e.target.value)}
                placeholder="e.g. ELK-12345"
              />
            </div>

            <div>
              <Label htmlFor="walkin-contact">Contact Number *</Label>
              <Input
                id="walkin-contact"
                value={walkInContact}
                onChange={(e) => setWalkInContact(e.target.value)}
                placeholder="e.g. 0123456789"
              />
            </div>

            <div>
              <Label>Member Status</Label>
              <Select value={walkInIsMember} onValueChange={(val) => setWalkInIsMember(val as 'member' | 'non_member')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="non_member">Non-member</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Facility Type</Label>
              <Select value={walkInFacility} onValueChange={(val) => handleWalkInFacilityChange(val as FacilityType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FACILITY_TYPES.map((ft) => (
                    <SelectItem key={ft} value={ft}>
                      {FACILITY_LABELS[ft]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Location</Label>
              <Select
                value={walkInLocation}
                onValueChange={(val) => setWalkInLocation(val as BookingLocation)}
                disabled={availableLocations.length === 1}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableLocations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {LOCATION_LABELS[loc]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="walkin-datetime">Date &amp; Time *</Label>
              <Input
                id="walkin-datetime"
                type="datetime-local"
                value={walkInDatetime}
                onChange={(e) => setWalkInDatetime(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="walkin-notes">Notes (optional)</Label>
              <textarea
                id="walkin-notes"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                value={walkInNotes}
                onChange={(e) => setWalkInNotes(e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>

            <Button
              className="w-full"
              onClick={handleWalkInSubmit}
              disabled={walkInSubmitting || !walkInName.trim() || !walkInContact.trim() || !walkInDatetime}
            >
              {walkInSubmitting ? 'Registering...' : 'Register Walk-in'}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setWalkInOpen(false)
                resetWalkInForm()
              }}
              disabled={walkInSubmitting}
            >
              Go Back
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Booking Details</SheetTitle>
          </SheetHeader>

          {selectedBooking && (
            <div className="p-4 space-y-4">
              {/* Booking fields */}
              {!editMode ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Customer Name</p>
                    <p className="font-medium">{selectedBooking.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Member ID</p>
                    <p className="font-medium">{selectedBooking.member_id ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Contact Number</p>
                    <p className="font-medium">{selectedBooking.contact_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Facility</p>
                    <p className="font-medium">{FACILITY_LABELS[selectedBooking.facility_type]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Location</p>
                    <p className="font-medium">{LOCATION_LABELS[selectedBooking.location]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Date/Time</p>
                    <p className="font-medium">
                      {new Date(selectedBooking.session_start).toLocaleDateString()}{' '}
                      {new Date(selectedBooking.session_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <Badge variant="outline" className={statusBadgeClass(selectedBooking.status)}>
                      {statusLabel(selectedBooking.status)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Member</p>
                    <p className="font-medium">{selectedBooking.is_member ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">BES Device</p>
                    <p className="font-medium">
                      {selectedBooking.has_bes_device === null ? '—' : selectedBooking.has_bes_device ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Date/Time</Label>
                    <Input
                      type="datetime-local"
                      value={editSessionStart}
                      onChange={(e) => setEditSessionStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Facility</Label>
                    <Select value={editFacility} onValueChange={(val) => setEditFacility(val as FacilityType)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FACILITY_TYPES.map((ft) => (
                          <SelectItem key={ft} value={ft}>
                            {FACILITY_LABELS[ft]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Location</Label>
                    <Select value={editLocation} onValueChange={(val) => setEditLocation(val as BookingLocation)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="okr">{LOCATION_LABELS.okr}</SelectItem>
                        <SelectItem value="subang">{LOCATION_LABELS.subang}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Reason for edit..."
                    />
                  </div>
                </div>
              )}

              {/* Edit toggle / save */}
              <div className="flex gap-2">
                {!editMode ? (
                  <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button size="sm" onClick={handleSaveEdit} disabled={actionLoading}>
                      Save Changes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditMode(false)} disabled={actionLoading}>
                      Cancel Edit
                    </Button>
                  </>
                )}
              </div>

              <Separator />

              {/* Audit Trail */}
              <div>
                <p className="text-base font-semibold mb-2">Audit Trail</p>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {selectedBooking.audit_log && selectedBooking.audit_log.length > 0 ? (
                    selectedBooking.audit_log.map((entry, idx) => (
                      <div key={idx} className="text-sm border rounded-md p-2">
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.at).toLocaleString()}
                        </p>
                        <p className="font-medium">{entry.action}</p>
                        {entry.by && (
                          <p className="text-muted-foreground">by {entry.by}</p>
                        )}
                        {entry.note && (
                          <p className="text-muted-foreground italic">{entry.note}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No audit entries yet.</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Notification status */}
              <div>
                <p className="text-sm font-semibold mb-2">Notification Status</p>
                <div className="flex gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reminder</p>
                    {(() => {
                      const nb = notifBadge(selectedBooking.reminder_sent, selectedBooking.reminder_retry_count)
                      return (
                        <Badge variant="outline" className={nb.cls}>
                          {nb.label}
                        </Badge>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Survey</p>
                    {(() => {
                      const nb = notifBadge(selectedBooking.survey_sent, selectedBooking.survey_retry_count)
                      return (
                        <Badge variant="outline" className={nb.cls}>
                          {nb.label}
                        </Badge>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
