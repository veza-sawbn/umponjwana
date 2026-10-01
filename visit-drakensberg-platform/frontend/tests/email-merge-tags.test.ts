import { describe, it, expect } from 'vitest'
import {
  buildMergeValues, renderMergeTags, findMergeTagIssues, campaignFieldKeyError, toCampaignFieldKey,
  usedMergeTags, type MergeContact,
} from '@/lib/email-merge-tags'

const contact: MergeContact = {
  id: 'u1',
  fullName: 'Thandi Nomsa Dlamini',
  email: 'thandi@example.com',
  country: 'South Africa',
  city: null,
  lifecycleStage: 'returning_customer',
  interests: ['hiking', 'birding'],
  favouriteDestinations: ['Royal Natal'],
  favouriteActivities: [],
  tripCount: 3,
  upcomingTravel: '2027-07-14',
}

describe('buildMergeValues', () => {
  it('splits the name and flattens profile fields', () => {
    const v = buildMergeValues(contact)
    expect(v.first_name).toBe('Thandi')
    expect(v.last_name).toBe('Nomsa Dlamini')
    expect(v.interests).toBe('hiking, birding')
    expect(v.favourite_destination).toBe('Royal Natal')
    expect(v.trip_count).toBe('3')
    expect(v.lifecycle_stage).toBe('returning customer')
    expect(v.upcoming_travel).toMatch(/2027/)
  })

  it('never greets someone by their email address', () => {
    const v = buildMergeValues({ ...contact, fullName: 'thandi@example.com' })
    expect(v.first_name).toBe('')
    expect(v.full_name).toBe('')
  })

  it('includes campaign fields but never lets them shadow a contact tag', () => {
    const v = buildMergeValues(contact, { offer: 'Stay 3, pay 2', first_name: 'Hijack', 'Bad Key': 'x' })
    expect(v.offer).toBe('Stay 3, pay 2')
    expect(v.first_name).toBe('Thandi')
    expect('Bad Key' in v).toBe(false)
  })

  it('uses sample values when no contact is given', () => {
    expect(buildMergeValues(null).first_name).toBe('Thandi')
  })
})

describe('renderMergeTags', () => {
  const v = buildMergeValues(contact, { offer: '<b>20% off</b>' })

  it('fills tags, case- and whitespace-insensitively', () => {
    expect(renderMergeTags('Hi {{ First_Name }}!', v, { html: false })).toBe('Hi Thandi!')
  })

  it('uses the fallback only when the value is empty', () => {
    expect(renderMergeTags('{{city|your town}} / {{country|x}}', v, { html: false })).toBe('your town / South Africa')
  })

  it('renders an empty value without a fallback as nothing', () => {
    expect(renderMergeTags('[{{favourite_activity}}]', v, { html: false })).toBe('[]')
  })

  it('leaves unknown tags in place', () => {
    expect(renderMergeTags('Use {{promo_code}}', v, { html: false })).toBe('Use {{promo_code}}')
  })

  it('escapes values in HTML mode only', () => {
    expect(renderMergeTags('{{offer}}', v, { html: true })).toBe('&lt;b&gt;20% off&lt;/b&gt;')
    expect(renderMergeTags('{{offer}}', v, { html: false })).toBe('<b>20% off</b>')
  })
})

describe('findMergeTagIssues', () => {
  it('reports unknown tags and blank tags without fallback', () => {
    const v = buildMergeValues(contact)
    const issues = findMergeTagIssues(['{{promo_code}} {{city}} {{favourite_activity|anything}}'], v)
    expect(issues).toEqual([
      { key: 'promo_code', kind: 'unknown' },
      { key: 'city', kind: 'empty' },
    ])
  })
})

describe('campaign field keys', () => {
  it('validates keys', () => {
    expect(campaignFieldKeyError('promo_code')).toBeNull()
    expect(campaignFieldKeyError('first_name')).toMatch(/already/)
    expect(campaignFieldKeyError('9lives')).toMatch(/lowercase/)
  })

  it('normalises typed names', () => {
    expect(toCampaignFieldKey(' Promo-Code ')).toBe('promo_code')
    expect(toCampaignFieldKey('2 for 1 deal')).toBe('for_1_deal')
  })

  it('lists used tags once', () => {
    expect(usedMergeTags(['{{a}} {{b|x}}', '{{A}}'])).toEqual(['a', 'b'])
  })
})
