import { describe, it, expect } from 'vitest'
import { companyBillingRows, validateCustomerDetails, type OrderCustomerDetails } from '@/lib/customer-details'

const base: OrderCustomerDetails = {
  name: 'Chrissie Loock', email: 'loockc@telkom.co.za', phone: '',
  isCompany: true, company: 'Innovative Research & Events t/a SATNAC',
  vatNumber: '4840254876', registrationNumber: '', address: '',
}

describe('validateCustomerDetails', () => {
  it('accepts a complete company customer', () => {
    expect(validateCustomerDetails(base)).toBeNull()
  })
  it('needs a name and a real email', () => {
    expect(validateCustomerDetails({ ...base, name: ' ' })).toMatch(/name/)
    expect(validateCustomerDetails({ ...base, email: 'not-an-email' })).toMatch(/email/)
  })
  it('needs a company name for a company customer', () => {
    expect(validateCustomerDetails({ ...base, company: '' })).toMatch(/company name/)
  })
  it('checks an all-digit VAT number against the South African format', () => {
    expect(validateCustomerDetails({ ...base, vatNumber: '12345' })).toMatch(/10 digits starting with 4/)
    expect(validateCustomerDetails({ ...base, vatNumber: '4840 254 876' })).toBeNull()
  })
  it('takes a foreign VAT number as typed', () => {
    expect(validateCustomerDetails({ ...base, vatNumber: 'GB123456789' })).toBeNull()
  })
  it('ignores company fields for an individual', () => {
    expect(validateCustomerDetails({ ...base, isCompany: false, company: '', vatNumber: '123' })).toBeNull()
  })
})

describe('companyBillingRows', () => {
  it('lists the company and its numbers for a company customer', () => {
    expect(companyBillingRows({
      customer_is_company: true, customer_company: 'Acme Tours (Pty) Ltd',
      customer_vat_number: '4840254876', customer_registration_number: '2019/123456/07',
    })).toEqual([
      ['Received from', 'Acme Tours (Pty) Ltd'],
      ['VAT number', '4840254876'],
      ['Registration number', '2019/123456/07'],
    ])
  })
  it('leaves out numbers that are not on file', () => {
    expect(companyBillingRows({ customer_is_company: true, customer_company: 'Acme', customer_vat_number: '', customer_registration_number: null }))
      .toEqual([['Received from', 'Acme']])
  })
  it('adds nothing for an individual, or an order from before the billing columns', () => {
    expect(companyBillingRows({ customer_is_company: false, customer_company: 'Old Co' })).toEqual([])
    expect(companyBillingRows({})).toEqual([])
  })
})
