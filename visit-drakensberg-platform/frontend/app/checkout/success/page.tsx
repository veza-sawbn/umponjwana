'use client';

import { useMemo } from 'react';
import Link from 'next/link';

function generateRef(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function BookingSuccessPage() {
  const bookingRef = useMemo(() => generateRef(), []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
          {/* Checkmark */}
          <div className="w-20 h-20 bg-[#2D6A4F] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
          <p className="text-gray-500 mb-6">
            Your Drakensberg adventure is booked. Get ready for an unforgettable experience!
          </p>

          {/* Reference */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
              Booking Reference
            </p>
            <p className="text-3xl font-bold text-[#2D6A4F] tracking-widest font-mono">
              {bookingRef}
            </p>
          </div>

          {/* Details */}
          <div className="text-sm text-gray-600 mb-8 space-y-2">
            <p>
              A confirmation email has been sent to your registered email address with full
              booking details, host contact information, and directions.
            </p>
            <p>
              Keep your booking reference handy — you'll need it when you check in.
            </p>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-4 mb-8 text-left text-sm">
            <div className="flex justify-between text-gray-600 mb-1">
              <span>Property</span>
              <span className="font-medium text-gray-800">Cathedral Peak Mountain Lodge</span>
            </div>
            <div className="flex justify-between text-gray-600 mb-1">
              <span>Check-in</span>
              <span className="font-medium text-gray-800">15 Jul 2024</span>
            </div>
            <div className="flex justify-between text-gray-600 mb-1">
              <span>Check-out</span>
              <span className="font-medium text-gray-800">18 Jul 2024</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total charged</span>
              <span className="font-bold text-gray-900">R8,214</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/dashboard"
              className="flex-1 bg-[#2D6A4F] text-white py-3 rounded-xl font-medium hover:bg-[#245a42] transition-colors text-center"
            >
              View My Bookings
            </Link>
            <Link
              href="/"
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors text-center"
            >
              Back to Home
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            Need help?{' '}
            <a href="mailto:support@visitdrakensberg.co.za" className="text-[#2D6A4F] underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
