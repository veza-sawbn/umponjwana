'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { id: 1, label: 'Basic Info' },
  { id: 2, label: 'Location' },
  { id: 3, label: 'Pricing' },
  { id: 4, label: 'Amenities' },
  { id: 5, label: 'Images' },
];

const CATEGORIES = ['Lodge', 'Guesthouse', 'Resort', 'Hotel', 'Cabin', 'Camp', 'Activity', 'Hike', 'Shuttle', 'Package'];

const ALL_AMENITIES = [
  'Swimming Pool', 'Free WiFi', 'Braai Facilities', 'Hiking Access', 'Restaurant',
  'Parking', 'Laundry', 'Room Service', 'Air Conditioning', 'Fireplace',
  'Pet Friendly', 'Wheelchair Accessible', 'Spa', 'Gym', 'Bar',
  'Airport Transfer', 'Guided Tours', 'Equipment Hire', 'Horse Riding', 'Bird Watching',
];

interface FormData {
  title: string;
  category: string;
  description: string;
  address: string;
  lat: string;
  lng: string;
  price: string;
  priceUnit: string;
  maxGuests: string;
  amenities: string[];
  images: File[];
}

const initialForm: FormData = {
  title: '',
  category: '',
  description: '',
  address: '',
  lat: '',
  lng: '',
  price: '',
  priceUnit: 'per night',
  maxGuests: '',
  amenities: [],
  images: [],
};

export default function NewListingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const update = (field: keyof FormData, value: string | string[] | File[]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleAmenity = (a: string) =>
    update(
      'amenities',
      form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a]
    );

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    update('images', [...form.images, ...Array.from(files)]);
  };

  const canNext = () => {
    if (step === 1) return form.title.trim() && form.category && form.description.trim();
    if (step === 2) return form.address.trim();
    if (step === 3) return form.price && form.maxGuests;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    router.push('/supplier/listings');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2D6A4F] text-white py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.push('/supplier/listings')}
            className="text-green-200 hover:text-white text-sm mb-2 block"
          >
            ← Back to Listings
          </button>
          <h1 className="text-2xl font-bold">Create New Listing</h1>
          <p className="text-green-100 text-sm mt-1">Step {step} of {STEPS.length}</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex-1 flex items-center">
                <button
                  onClick={() => s.id < step && setStep(s.id)}
                  className={`flex flex-col items-center py-4 flex-1 text-xs font-medium transition-colors ${
                    s.id === step
                      ? 'text-[#2D6A4F]'
                      : s.id < step
                      ? 'text-[#2D6A4F] cursor-pointer'
                      : 'text-gray-400 cursor-default'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 text-xs font-bold border-2 transition-colors ${
                      s.id < step
                        ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white'
                        : s.id === step
                        ? 'border-[#2D6A4F] text-[#2D6A4F]'
                        : 'border-gray-300 text-gray-400'
                    }`}
                  >
                    {s.id < step ? '✓' : s.id}
                  </span>
                  <span className="hidden sm:block">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-1 transition-colors ${step > s.id ? 'bg-[#2D6A4F]' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-800">Basic Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listing Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="e.g. Cathedral Peak Mountain Lodge"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={5}
                  placeholder="Describe your listing — what makes it special, what guests can expect..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">{form.description.length} / 2000 characters</p>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-800">Location</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Address *</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="e.g. Cathedral Peak Road, Cathedral Peak 3309"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                  <input
                    type="text"
                    value={form.lat}
                    onChange={(e) => update('lat', e.target.value)}
                    placeholder="-28.944"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                  <input
                    type="text"
                    value={form.lng}
                    onChange={(e) => update('lng', e.target.value)}
                    placeholder="29.256"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  />
                </div>
              </div>

              {/* Mock map */}
              <div className="bg-gradient-to-br from-green-100 to-blue-100 rounded-xl h-48 flex items-center justify-center border border-gray-200">
                <div className="text-center text-gray-500">
                  <span className="text-3xl block mb-2">🗺️</span>
                  <p className="text-sm">Map preview will appear here</p>
                  <p className="text-xs text-gray-400 mt-1">Enter coordinates above to pin your location</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Pricing */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-800">Pricing & Capacity</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (R) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R</span>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => update('price', e.target.value)}
                    placeholder="0"
                    min={0}
                    className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price Unit</label>
                <select
                  value={form.priceUnit}
                  onChange={(e) => update('priceUnit', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                >
                  {['per night', 'per person', 'per trip', 'per day', 'per group'].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Guests *</label>
                <input
                  type="number"
                  value={form.maxGuests}
                  onChange={(e) => update('maxGuests', e.target.value)}
                  placeholder="e.g. 4"
                  min={1}
                  max={50}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
              </div>

              {form.price && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-gray-700">
                  <p className="font-medium text-[#2D6A4F] mb-1">Earnings Estimate</p>
                  <p>
                    At R{Number(form.price).toLocaleString()} {form.priceUnit}, with 70% occupancy over 30 days,
                    you could earn approximately{' '}
                    <span className="font-bold">
                      R{Math.round(Number(form.price) * 21).toLocaleString()}
                    </span>{' '}
                    per month.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Amenities */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-800">Amenities & Features</h2>
              <p className="text-sm text-gray-500">Select all amenities available at your listing</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ALL_AMENITIES.map((a) => (
                  <label
                    key={a}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.amenities.includes(a)
                        ? 'border-[#2D6A4F] bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.amenities.includes(a)}
                      onChange={() => toggleAmenity(a)}
                      className="accent-[#2D6A4F]"
                    />
                    <span className="text-sm text-gray-700">{a}</span>
                  </label>
                ))}
              </div>

              <p className="text-xs text-gray-400">
                {form.amenities.length} amenities selected
              </p>
            </div>
          )}

          {/* Step 5: Images */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-800">Photos</h2>
              <p className="text-sm text-gray-500">
                Upload high-quality photos of your listing. Good photos dramatically increase bookings.
              </p>

              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  dragOver ? 'border-[#2D6A4F] bg-green-50' : 'border-gray-300'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFiles(e.dataTransfer.files);
                }}
              >
                <span className="text-4xl block mb-3">📷</span>
                <p className="text-gray-600 font-medium mb-1">Drag & drop photos here</p>
                <p className="text-sm text-gray-400 mb-4">or</p>
                <label className="bg-[#2D6A4F] text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-[#245a42] transition-colors">
                  Browse Files
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-3">PNG, JPG, WEBP up to 10MB each</p>
              </div>

              {form.images.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {form.images.length} photo{form.images.length !== 1 ? 's' : ''} selected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {form.images.map((file, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={URL.createObjectURL(file)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() =>
                            update('images', form.images.filter((_, idx) => idx !== i))
                          }
                          className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Back
            </button>

            {step < STEPS.length ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="px-5 py-2.5 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#245a42] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-[#2D6A4F] text-white rounded-lg text-sm font-semibold hover:bg-[#245a42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Publishing…
                  </>
                ) : (
                  'Publish Listing'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
