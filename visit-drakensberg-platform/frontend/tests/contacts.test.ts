import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ supabase: {} }))
vi.mock('@/lib/customers-admin', () => ({ fetchAllRows: vi.fn() }))

import {
  avatarText, contactDetail, contactInitial, contactLabel, groupContacts, searchContacts, type Contact,
} from '@/lib/contacts'
import { parseContactsCsv } from '@/lib/csv'

function c(over: Partial<Contact>): Contact {
  return {
    id: over.id ?? Math.random().toString(36).slice(2), name: '', email: null, phone: '', userId: null,
    isCompany: false, company: '', vatNumber: '', registrationNumber: '', address: '', sources: [],
    invoiceCount: 0, lastInvoicedAt: null, createdAt: '', ...over,
  }
}

describe('contact labels', () => {
  it('falls back from name to company, email, then phone', () => {
    expect(contactLabel(c({ name: 'Elodie Berger', email: 'e@x.test' }))).toBe('Elodie Berger')
    expect(contactLabel(c({ company: 'Acme', email: 'e@x.test' }))).toBe('Acme')
    expect(contactLabel(c({ email: 'e@x.test' }))).toBe('e@x.test')
    expect(contactLabel(c({ phone: '12014864320' }))).toBe('12014864320')
  })

  it('does not repeat the label in the detail line', () => {
    expect(contactDetail(c({ email: 'e@x.test', phone: '082' }))).toBe('082')
    expect(contactDetail(c({ name: 'A', email: 'e@x.test', phone: '082' }))).toBe('e@x.test · 082')
  })

  it('sections numbers under # and folds accents', () => {
    expect(contactInitial(c({ phone: '12014864320' }))).toBe('#')
    expect(contactInitial(c({ name: 'Élodie' }))).toBe('E')
    expect(avatarText(c({ name: 'Juliana Mourão Doroteu' }))).toBe('JD')
    expect(avatarText(c({ phone: '12014864320' }))).toBe('1')
  })
})

describe('searchContacts', () => {
  const book = [
    c({ name: 'Esben Anker-Møller', email: 'esben.anker.moller@gmail.com' }),
    c({ name: 'Juliana Mourão Doroteu', email: 'julianadoroteu.unb@gmail.com', phone: '+55 61 99999 1234' }),
    c({ phone: '12014864320' }),
  ]

  it('matches every word, ignoring case and accents', () => {
    expect(searchContacts(book, 'juliana mourao').map(x => x.name)).toEqual(['Juliana Mourão Doroteu'])
    expect(searchContacts(book, 'GMAIL')).toHaveLength(2)
  })

  it('matches phone digits regardless of formatting', () => {
    expect(searchContacts(book, '99999-1234')).toHaveLength(1)
    expect(searchContacts(book, '+1 201 486')).toHaveLength(1)
  })

  it('returns everything for an empty query', () => {
    expect(searchContacts(book, '  ')).toHaveLength(3)
  })
})

describe('groupContacts', () => {
  it('sorts A–Z with numbers last', () => {
    const groups = groupContacts([c({ phone: '123456789' }), c({ name: 'zed' }), c({ name: 'Anna' }), c({ name: 'adam' })])
    expect(groups.map(g => g.letter)).toEqual(['A', 'Z', '#'])
    expect(groups[0].contacts.map(x => x.name)).toEqual(['adam', 'Anna'])
  })
})

describe('parseContactsCsv keepPhoneOnly', () => {
  const csv = 'First Name,Last Name,Email 1,Phone 1\nHannah,Hagen,hannah-hagen@web.de,\n,,,12014864320\n'
  it('drops phone-only rows by default (supplier address books)', () => {
    expect(parseContactsCsv(csv)).toHaveLength(1)
  })
  it('keeps them for the platform contact book', () => {
    expect(parseContactsCsv(csv, { keepPhoneOnly: true })).toEqual([
      { name: 'Hannah Hagen', email: 'hannah-hagen@web.de', phone: '' },
      { name: '', email: '', phone: '12014864320' },
    ])
  })
})
