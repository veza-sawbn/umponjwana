# Visit Drakensberg Platform

A full-stack booking platform for visitdrakensberg.com — built like Booking.com for the Drakensberg region.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI (Python 3.11), SQLAlchemy (async) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + JWT |
| Cache / Queue | Upstash Redis |
| Payments | Stripe |
| Email | SendGrid |
| Frontend Deploy | Vercel |
| Backend Deploy | Render |

## Project Structure

```
visit-drakensberg-platform/
├── backend/          # FastAPI app (deploy to Render)
├── frontend/         # Next.js app (deploy to Vercel)
├── docker-compose.yml
└── .env.example
```

## Listing Categories

- **Stays** — hotels, lodges, self-catering, camping
- **Activities** — guided tours, horse riding, adventure sports
- **Hikes** — guided & self-guided trails with difficulty ratings
- **Shuttles** — airport & inter-regional transfers
- **Packages** — multi-day holiday packages

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account
- Upstash Redis instance
- Stripe account
- SendGrid account

### 1. Clone & configure

```bash
cp .env.example .env
# Fill in all values in .env
```

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

### 4. Docker (full stack)

```bash
docker-compose up --build
```

## Deployment

### Backend → Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repo, set root directory to `backend/`
3. Build command: `pip install -r requirements.txt && alembic upgrade head`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add all environment variables from `.env.example`

### Frontend → Vercel

1. Import repo to Vercel, set root directory to `frontend/`
2. Framework preset: **Next.js**
3. Add all `NEXT_PUBLIC_*` environment variables
4. Deploy

## API Documentation

Once running, visit `http://localhost:8000/docs` for interactive Swagger UI.

## Database Schema

Managed via Alembic migrations. Key tables:
- `users` — guests, suppliers, admins
- `suppliers` — business profiles
- `listings` — all bookable items
- `bookings` — reservations
- `payments` — Stripe payment records
- `reviews` — verified guest reviews
- `notifications` — in-app notifications

## License

Proprietary — visitdrakensberg.com

## Google Maps setup

Address and location fields in the supplier listing, property, activity, and tour forms use the Google Maps JavaScript API with the Places library when a browser API key is available. The shuttle route estimator and supplier routes forms additionally use the Distance Matrix API to auto-calculate driving distance/duration in the background once both addresses are set.

1. In Google Cloud Console, enable **Maps JavaScript API**, **Places API**, and **Distance Matrix API** for your project.
2. Create an API key and restrict it to your web app domains (for local development, include `http://localhost:3000/*`).
3. Put the key in `visit-drakensberg-platform/frontend/.env.local`:

   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_browser_key_here
   ```

4. Restart the Next.js dev server after changing `.env.local`.

The key must be prefixed with `NEXT_PUBLIC_` because Google Places autocomplete and map previews run in the browser. Keep the key restricted in Google Cloud Console instead of committing a real key to the repository.
