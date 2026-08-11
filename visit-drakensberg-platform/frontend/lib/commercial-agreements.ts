import { supabase } from './auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ManagementModel = 'supplier_managed' | 'vd_managed'
export type ManagementStatus = 'active' | 'pending_agreement' | 'suspended' | 'terminated'
export type AgreementType = 'marketplace_agreement' | 'managed_asset_agreement'

export const MANAGEMENT_MODEL_LABEL: Record<ManagementModel, string> = {
  supplier_managed: 'Supplier Managed',
  vd_managed: 'Visit Drakensberg Managed',
}

export const MANAGEMENT_STATUS_LABEL: Record<ManagementStatus, string> = {
  active: 'Active',
  pending_agreement: 'Pending Agreement',
  suspended: 'Suspended',
  terminated: 'Terminated',
}

export const AGREEMENT_TYPE_LABEL: Record<AgreementType, string> = {
  marketplace_agreement: 'Marketplace Agreement',
  managed_asset_agreement: 'Managed Asset Agreement',
}

export type CommercialTerms = {
  supplier_id: string
  commission_rate: number | null
  platform_fee_rate: number | null
  settlement_frequency: string
  notes: string | null
  // New delegated management fields
  management_model: ManagementModel
  management_status: ManagementStatus
  agreement_type: AgreementType | null
  management_fee: number | null
  agreement_effective_date: string | null
  agreement_expiry_date: string | null
  agreement_reference: string | null
  agreement_notes: string | null
  updated_at: string
  updated_by: string | null
}

// ─── Functions ────────────────────────────────────────────────────────────────

/** Get commercial terms for a supplier. */
export async function getSupplierTerms(supplierId: string): Promise<CommercialTerms | null> {
  try {
    const { data } = await supabase
      .from('vd_supplier_terms')
      .select('*')
      .eq('supplier_id', supplierId)
      .maybeSingle()
    return data as CommercialTerms | null
  } catch {
    return null
  }
}

/** Get all supplier terms with profile data — for the admin commercial view. */
export async function getAllSupplierTerms(): Promise<(CommercialTerms & {
  supplier_name: string | null
  supplier_email: string | null
  supplier_type: string | null
  approval_status: string | null
})[]> {
  try {
    const { data } = await supabase
      .from('vd_supplier_terms')
      .select(`
        *,
        profiles!vd_supplier_terms_supplier_id_fkey (
          full_name, email, supplier_type, approval_status
        )
      `)
      .order('updated_at', { ascending: false })
    if (!Array.isArray(data)) return []
    return data.map((row: any) => ({
      ...row,
      supplier_name: row.profiles?.full_name ?? null,
      supplier_email: row.profiles?.email ?? null,
      supplier_type: row.profiles?.supplier_type ?? null,
      approval_status: row.profiles?.approval_status ?? null,
    }))
  } catch {
    return []
  }
}

/** Get all VD Managed suppliers summary — for the operations overview. */
export async function getVdManagedSuppliers(): Promise<(CommercialTerms & {
  supplier_name: string | null
  supplier_type: string | null
})[]> {
  try {
    const { data } = await supabase
      .from('vd_supplier_terms')
      .select(`
        *,
        profiles!vd_supplier_terms_supplier_id_fkey (
          full_name, supplier_type
        )
      `)
      .eq('management_model', 'vd_managed')
      .order('updated_at', { ascending: false })
    if (!Array.isArray(data)) return []
    return data.map((row: any) => ({
      ...row,
      supplier_name: row.profiles?.full_name ?? null,
      supplier_type: row.profiles?.supplier_type ?? null,
    }))
  } catch {
    return []
  }
}

/**
 * Create or update commercial terms for a supplier (admin only).
 * Uses upsert so the first call creates the row; subsequent calls update it.
 */
export async function upsertSupplierTerms(
  supplierId: string,
  patch: Partial<Omit<CommercialTerms, 'supplier_id' | 'updated_at' | 'updated_by'>>
): Promise<void> {
  const { error } = await supabase.from('vd_supplier_terms').upsert(
    {
      supplier_id: supplierId,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'supplier_id' }
  )
  if (error) throw error
}

/** Set the management model for a supplier (admin only). */
export async function setManagementModel(
  supplierId: string,
  model: ManagementModel,
  agreementType?: AgreementType,
  status?: ManagementStatus
): Promise<void> {
  await upsertSupplierTerms(supplierId, {
    management_model: model,
    agreement_type: agreementType ?? (model === 'vd_managed' ? 'managed_asset_agreement' : 'marketplace_agreement'),
    management_status: status ?? 'active',
  })
}
