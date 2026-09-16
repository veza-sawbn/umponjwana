'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, ScanLine, KeyRound } from 'lucide-react'
import { redeemTicket, getTicketByCode, type Ticket } from '@/lib/tickets'
import { getEventById } from '@/lib/events'

type ScanOutcome = {
  kind: 'success' | 'duplicate' | 'invalid'
  message: string
  eventTitle?: string
  tierName?: string
}

const SCANNER_ID = 'vd-check-in-reader'

export default function CheckInScannerPage() {
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null)
  const [cameraError, setCameraError] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [manualBusy, setManualBusy] = useState(false)
  const scannerRef = useRef<import('html5-qrcode').Html5QrcodeScanner | null>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      if (cancelled) return
      const scanner = new Html5QrcodeScanner(SCANNER_ID, { fps: 10, qrbox: 240 }, false)
      scanner.render(
        decodedText => handleDecoded(decodedText),
        () => {}, // per-frame "no QR found" noise — nothing to surface
      )
      scannerRef.current = scanner
    }).catch(() => setCameraError(true))

    return () => {
      cancelled = true
      scannerRef.current?.clear().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function describeTicket(ticket: Ticket): Promise<{ eventTitle?: string; tierName?: string }> {
    const event = await getEventById(ticket.eventId).catch(() => null)
    return { eventTitle: event?.title, tierName: event?.ticketTypes?.find(t => t.id === ticket.ticketTypeId)?.name }
  }

  async function redeemAndReport(ticketId: string, token: string, via: 'scan' | 'manual') {
    const result = await redeemTicket(ticketId, token, via)
    if (result.ok) {
      const { eventTitle, tierName } = await describeTicket(result.ticket)
      setOutcome({ kind: 'success', message: 'Checked in', eventTitle, tierName })
    } else if (result.reason === 'already_redeemed') {
      setOutcome({
        kind: 'duplicate',
        message: result.redeemedAt
          ? `Already checked in at ${new Date(result.redeemedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
          : 'Already checked in',
      })
    } else if (result.reason === 'void') {
      setOutcome({ kind: 'invalid', message: 'This ticket was cancelled.' })
    } else {
      setOutcome({ kind: 'invalid', message: 'Not a valid ticket for one of your events.' })
    }
  }

  async function handleDecoded(decodedText: string) {
    if (busyRef.current) return
    busyRef.current = true
    scannerRef.current?.pause(true)
    try {
      const [ticketId, token] = decodedText.split(':')
      if (!ticketId || !token) {
        setOutcome({ kind: 'invalid', message: 'This QR code isn’t a Visit Drakensberg ticket.' })
        return
      }
      await redeemAndReport(ticketId, token, 'scan')
    } catch {
      setOutcome({ kind: 'invalid', message: 'Could not check in this ticket. Try again.' })
    }
  }

  function scanNext() {
    setOutcome(null)
    busyRef.current = false
    scannerRef.current?.resume()
  }

  async function handleManualCheckIn() {
    if (!manualCode.trim()) return
    setManualBusy(true)
    try {
      const ticket = await getTicketByCode(manualCode.trim())
      if (!ticket) {
        setOutcome({ kind: 'invalid', message: 'No ticket found with that code.' })
      } else {
        await redeemAndReport(ticket.id, ticket.token, 'manual')
      }
      setManualCode('')
    } catch {
      setOutcome({ kind: 'invalid', message: 'Could not check in this ticket. Try again.' })
    } finally {
      setManualBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white py-12 px-6 lg:px-12 mt-16">
        <div className="max-w-xl mx-auto">
          <Link href="/supplier" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 className="font-display italic text-4xl flex items-center gap-3"><ScanLine size={30} /> Check-in Scanner</h1>
          <p className="mt-3 text-white/70 font-sans text-base">
            Point the camera at a guest&apos;s ticket QR code to check them in.
          </p>
        </div>
      </section>

      <main className="max-w-xl mx-auto px-6 lg:px-12 py-10">
        {outcome ? (
          <div
            className={`p-8 text-center border ${
              outcome.kind === 'success' ? 'bg-[#2d6a4f]/5 border-[#2d6a4f]'
              : outcome.kind === 'duplicate' ? 'bg-amber-50 border-amber-300'
              : 'bg-red-50 border-red-300'
            }`}
          >
            {outcome.kind === 'success' ? (
              <CheckCircle2 size={44} className="text-[#2d6a4f] mx-auto mb-3" />
            ) : outcome.kind === 'duplicate' ? (
              <AlertCircle size={44} className="text-amber-500 mx-auto mb-3" />
            ) : (
              <XCircle size={44} className="text-red-500 mx-auto mb-3" />
            )}
            <p className="font-display italic text-2xl mb-1">{outcome.message}</p>
            {outcome.eventTitle && (
              <p className="font-sans text-sm text-gray-500">{outcome.eventTitle}{outcome.tierName ? ` · ${outcome.tierName}` : ''}</p>
            )}
            <button
              onClick={scanNext}
              className="mt-6 bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors"
            >
              Scan next ticket
            </button>
          </div>
        ) : (
          <>
            <div id={SCANNER_ID} className="bg-white border border-gray-200 overflow-hidden" />
            {cameraError && (
              <p className="font-sans text-sm text-red-500 mt-3 text-center">
                Couldn&apos;t start the camera. You can still check guests in manually below.
              </p>
            )}
          </>
        )}

        <div className="mt-8 bg-white border border-gray-200 p-5">
          <p className="font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-3 flex items-center gap-2">
            <KeyRound size={13} /> No camera? Enter the ticket code
          </p>
          <div className="flex gap-3">
            <input
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualCheckIn()}
              placeholder="TIX-XXXXXXXX"
              className="flex-1 border border-gray-300 px-4 py-2.5 font-sans text-sm uppercase focus:outline-none focus:border-[#2d6a4f]"
            />
            <button
              onClick={handleManualCheckIn}
              disabled={manualBusy || !manualCode.trim()}
              className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] disabled:opacity-40 transition-colors"
            >
              Check in
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
