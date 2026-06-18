'use client';

import { useState } from 'react';

interface PaymentFormProps {
  onSuccess?: (data: { cardholderName: string; last4: string }) => void;
  amount?: number;
  submitLabel?: string;
}

export default function PaymentForm({
  onSuccess,
  amount,
  submitLabel = 'Pay Now',
}: PaymentFormProps) {
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const getCardType = (num: string): string => {
    const digits = num.replace(/\s/g, '');
    if (/^4/.test(digits)) return 'VISA';
    if (/^5[1-5]/.test(digits)) return 'MC';
    if (/^3[47]/.test(digits)) return 'AMEX';
    return '💳';
  };

  const isValid =
    cardholderName.trim().length >= 2 &&
    cardNumber.replace(/\s/g, '').length === 16 &&
    expiry.length === 5 &&
    cvc.length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    setLoading(true);

    try {
      // Simulate payment processing
      await new Promise((r) => setTimeout(r, 1800));
      const last4 = cardNumber.replace(/\s/g, '').slice(-4);
      onSuccess?.({ cardholderName, last4 });
    } catch {
      setError('Payment failed. Please check your card details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Cardholder Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
        <input
          type="text"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder="Jane Doe"
          autoComplete="cc-name"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
        />
      </div>

      {/* Card Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
        <div className="relative">
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="4242 4242 4242 4242"
            autoComplete="cc-number"
            inputMode="numeric"
            maxLength={19}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] pr-16 font-mono tracking-wide"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
            {cardNumber ? getCardType(cardNumber) : '💳'}
          </span>
        </div>
      </div>

      {/* Expiry + CVC */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
          <input
            type="text"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            placeholder="MM/YY"
            autoComplete="cc-exp"
            inputMode="numeric"
            maxLength={5}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
          <input
            type="text"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="123"
            autoComplete="cc-csc"
            inputMode="numeric"
            maxLength={4}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] font-mono"
          />
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-2.5">
        <span>🔒</span>
        <span>256-bit SSL encrypted. Your card details are never stored.</span>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!isValid || loading}
        className="w-full bg-[#2D6A4F] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#245a42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            Processing…
          </>
        ) : (
          <>
            🔒 {submitLabel}
            {amount ? ` — R${amount.toLocaleString()}` : ''}
          </>
        )}
      </button>
    </form>
  );
}
