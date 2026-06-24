#!/usr/bin/env node
/**
 * Seed test user accounts for Visit Drakensberg
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/seed-test-users.js
 *
 * All accounts use password:  Test1234!
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'Test1234!'

const TEST_USERS = [
  // ── Visitor ─────────────────────────────────────────────────────────
  {
    email:    'visitor@test.vd',
    name:     'Sam Visitor',
    role:     'visitor',
    approved: false,
    notes:    'Standard logged-in visitor — can browse, book, view dashboard',
  },

  // ── Admin ────────────────────────────────────────────────────────────
  {
    email:    'admin@test.vd',
    name:     'Admin User',
    role:     'admin',
    approved: true,
    notes:    'Full admin access — /admin panel, approve suppliers, manage content',
  },

  // ── Suppliers (approved) ─────────────────────────────────────────────
  {
    email:         'stays@test.vd',
    name:          'Mountain Lodge Co.',
    role:          'supplier',
    supplier_type: 'Accommodation',
    approved:      true,
    notes:         'Accommodation supplier — lodge, hotel, guesthouse listings',
  },
  {
    email:         'activity@test.vd',
    name:          'Berg Activities Ltd.',
    role:          'supplier',
    supplier_type: 'Activity',
    approved:      true,
    notes:         'Activity supplier — abseiling, zip-line, horseback, etc.',
  },
  {
    email:         'tours@test.vd',
    name:          'Peak Guides Collective',
    role:          'supplier',
    supplier_type: 'Guided Tours',
    approved:      true,
    notes:         'Guided tours supplier — multi-day hikes, summit attempts, cultural tours',
  },
  {
    email:         'shuttle@test.vd',
    name:          'Berg Transfers',
    role:          'supplier',
    supplier_type: 'Shuttle',
    approved:      true,
    notes:         'Shuttle/transfer supplier — airport runs, trailhead drops, 4x4 transfers',
  },
  {
    email:         'experience@test.vd',
    name:          'Drakensberg Experiences',
    role:          'supplier',
    supplier_type: 'Experience',
    approved:      true,
    notes:         'Experience supplier — photography workshops, stargazing nights, wellness retreats',
  },

  // ── Supplier (pending approval) ───────────────────────────────────────
  {
    email:         'pending@test.vd',
    name:          'New Supplier (Pending)',
    role:          'supplier',
    supplier_type: 'Accommodation',
    approved:      false,
    notes:         'Unapproved supplier — tests the "awaiting approval" screen and admin workflow',
  },
]

async function upsertUser({ email, name, role, supplier_type, approved, notes }) {
  // Create or retrieve the auth user
  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing?.users?.find(u => u.email === email)

  let userId

  if (found) {
    console.log(`  ↻  ${email} already exists, updating…`)
    await supabase.auth.admin.updateUserById(found.id, {
      password: PASSWORD,
      user_metadata: { full_name: name, role, supplier_type },
    })
    userId = found.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name, role, supplier_type },
    })
    if (error) {
      console.error(`  ✗  ${email}: ${error.message}`)
      return
    }
    userId = data.user.id
    console.log(`  ✓  ${email} created`)
  }

  // Upsert the profile row (the trigger creates it, but we need to set is_approved)
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({
      id:         userId,
      full_name:  name,
      email,
      role,
      is_approved: approved,
    }, { onConflict: 'id' })

  if (profileErr) {
    console.error(`  ✗  profile for ${email}: ${profileErr.message}`)
  } else {
    console.log(`     profile set — role: ${role}${supplier_type ? `, type: ${supplier_type}` : ''}, approved: ${approved}`)
  }
}

async function main() {
  console.log('\n🏔  Visit Drakensberg — seeding test users\n')
  console.log(`   Supabase: ${SUPABASE_URL}`)
  console.log(`   Password for all accounts: ${PASSWORD}\n`)
  console.log('─'.repeat(60))

  for (const user of TEST_USERS) {
    console.log(`\n● ${user.name} <${user.email}>`)
    console.log(`  ${user.notes}`)
    await upsertUser(user)
  }

  console.log('\n' + '─'.repeat(60))
  console.log('\n✅  Done! Test accounts:\n')
  console.log('  ROLE              EMAIL                    PASSWORD')
  console.log('  ─────────────     ───────────────────────  ─────────')
  for (const u of TEST_USERS) {
    const roleLabel = u.supplier_type ? `Supplier (${u.supplier_type})` : u.role.charAt(0).toUpperCase() + u.role.slice(1)
    console.log(`  ${roleLabel.padEnd(24)}${u.email.padEnd(25)}${PASSWORD}`)
  }
  console.log()
}

main().catch(err => { console.error(err); process.exit(1) })
