import { supabase } from './auth'

/**
 * The applicant-side half of the "list with us" upload path.
 *
 * WHAT IT REPLACED
 *   Two direct-to-storage writes with the anon key, under policies that
 *   checked only the first segment of the path (20260807 for photos, 20260905
 *   for certificates), plus an anonymous insert into vd_compliance_documents.
 *   All three were reachable by anything holding the anon key — which ships in
 *   every page of the site — without ever loading the form.
 *
 * HOW IT WORKS NOW
 *   1. The applicant solves one Turnstile challenge on step 1 of the wizard.
 *   2. POST /api/listing-applications/upload-grant trades it for a two-hour,
 *      reference-scoped grant, delivered as an httpOnly cookie.
 *   3. Each upload asks the server for a signed URL for ONE object at a path
 *      the server chooses, then PUTs the bytes straight to Supabase Storage.
 *
 *   The bytes never pass through a Vercel function — deliberately: the body
 *   limit there is about 4.5 MB and these files run to 15 MB. What passes
 *   through is the decision.
 */

export type UploadKind = 'photo' | 'compliance'

export type SignedUpload = {
  bucket: string
  path: string
  token: string
  /** Only ever set for the public bucket; a certificate must not acquire one. */
  publicUrl: string | null
}

/**
 * Thrown when the server says the grant is missing or expired. The form
 * catches this specifically so it can put the security check back in front of
 * the applicant rather than showing them a dead upload button.
 */
export class NeedsUploadGrantError extends Error {
  constructor(message = 'Please complete the security check before uploading.') {
    super(message)
    this.name = 'NeedsUploadGrantError'
  }
}

async function errorMessage(res: Response, fallback: string): Promise<{ message: string; needsGrant: boolean }> {
  try {
    const data = await res.json()
    return { message: typeof data?.error === 'string' ? data.error : fallback, needsGrant: data?.needsGrant === true }
  } catch {
    return { message: fallback, needsGrant: false }
  }
}

/** Trade a solved Turnstile token for an upload grant. Sets an httpOnly cookie. */
export async function requestUploadGrant(reference: string, captchaToken: string): Promise<void> {
  const res = await fetch('/api/listing-applications/upload-grant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, captchaToken }),
  })
  if (!res.ok) {
    const { message } = await errorMessage(res, 'Could not complete the security check.')
    throw new Error(message)
  }
}

export async function requestUploadUrl(input: {
  kind: UploadKind
  reference: string
  file: File
}): Promise<SignedUpload> {
  const res = await fetch('/api/listing-applications/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: input.kind,
      reference: input.reference,
      fileName: input.file.name,
      contentType: input.file.type,
      size: input.file.size,
    }),
  })
  if (!res.ok) {
    const { message, needsGrant } = await errorMessage(res, 'Could not start that upload.')
    if (needsGrant) throw new NeedsUploadGrantError(message)
    throw new Error(message)
  }
  return res.json()
}

/** PUT the bytes to the signed URL. The path and token are the server's. */
export async function putToSignedUrl(bucket: string, signed: SignedUpload, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || undefined,
    })
  if (error) {
    const message = String((error as { message?: string })?.message || '')
    if (/bucket.*not.*found/i.test(message)) {
      throw new Error(`Storage bucket "${bucket}" does not exist. Run the storage migrations first.`)
    }
    if (/mime type|not supported/i.test(message)) {
      throw new Error('That file type isn’t accepted. Upload a PDF, or a photo of the certificate.')
    }
    throw new Error(message || 'Upload failed.')
  }
}

/** Register an uploaded certificate against the application. */
export async function registerComplianceDocument(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/listing-applications/compliance-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const { message, needsGrant } = await errorMessage(res, 'Could not record that document.')
    if (needsGrant) throw new NeedsUploadGrantError(message)
    throw new Error(message)
  }
}
