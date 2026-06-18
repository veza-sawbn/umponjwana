'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  // Mock booking data
  const booking = {
    listing: 'Cathedral Peak Mountain Lodge',
    location: 'Cathedral Peak, Northern Berg',
    checkIn: '15 Jul 2024',
    checkOut: '18 Jul 2024',
    nights: 3,
    guests: 2,
    pricePerNight: 1850,
  };

  const subtotal = booking.pricePerNight * booking.nights;
  const cleaningFee = 350;
  const serviceFee = Math.round(subtotal * 0.12);
  const tax = Math.round((subtotal + cleaningFee + serviceFee) * 0.15);
  const total = subtotal + cleaningFee + serviceFee + tax;

  const formatCardNumber = (val: string) =>
    val
      .replace(/\D/g, '')
      .slice(0, 16)
      .replace(/(.{4})/g, '$1 ')
      .trim();

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    router.push('/checkout/success');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2D6A4F] text-white py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold">Complete Your Booking</h1>
          <p className="text-green-100 text-sm mt-1">Secure checkout — your details are protected</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8">
          {/* Payment Form */}
          <div className="flex-1 space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Payment Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Card Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="4242 4242 4242 4242"
                      required
                      maxLength={19}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                      💳
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      required
                      maxLength={5}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
                    <input
                      type="text"
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      required
                      maxLength={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center gap-2 text-xs text-gray-500">
                <span>🔒</span>
                <span>Your payment is encrypted and secure. We never store your card details.</span>
              </div>
            </div>

            {/* T&Cs */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Terms & Conditions</h2>
              <div className="bg-gray-50 rounded-lg p-4 h-28 overflow-y-auto text-xs text-gray-500 leading-relaxed mb-4">
                By completing this booking you agree to the Visit Drakensberg Terms of Service,
                Cancellation Policy, and Privacy Policy. Cancellations made more than 7 days
                before check-in are eligible for a full refund. Cancellations within 7 days of
                check-in will incur a 50% charge. No-shows are non-refundable. The host is
                responsible for the accuracy of the listing description. Visit Drakensberg acts
                as an intermediary and is not liable for any disputes between guest and host.
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 accent-[#2D6A4F]"
                />
                <span className="text-sm text-gray-700">
                  I agree to the{' '}
                  <a href="#" className="text-[#2D6A4F] underline">Terms & Conditions</a>
                  {' '}and{' '}
                  <a href="#" className="text-[#2D6A4F] underline">Cancellation Policy</a>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!agreed || loading}
              className="w-full bg-[#2D6A4F] text-white py-3.5 rounded-xl font-semibold text-lg hover:bg-[#245a42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Processing…
                </>
              ) : (
                <>🔒 Complete Booking — R{total.toLocaleString()}</>
              )}
            </button>
          </div>

          {/* Booking Summary */}
          <div className="lg:w-80 shrink-0">
            <div className="bg-white rounded-xl p-6 shadow-sm sticky top-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Booking Summary</h2>

              <div className="flex gap-3 mb-4 pb-4 border-b border-gray-100">
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200"
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">{booking.listing}</p>
                  <p className="text-xs text-gray-500">{booking.location}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between text-gray-600">
                  <span>Check-in</span>
                  <span className="font-medium text-gray-800">{booking.checkIn}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Check-out</span>
                  <span className="font-medium text-gray-800">{booking.checkOut}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Guests</span>
                  <span className="font-medium text-gray-800">{booking.guests} adults</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>R{booking.pricePerNight.toLocaleString()} × {booking.nights} nights</span>
                  <span>R{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Cleaning fee</span>
                  <span>R{cleaningFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Service fee</span>
                  <span>R{serviceFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>VAT (15%)</span>
                  <span>R{tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>R{total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
