/**
 * Copy text to the clipboard, reporting whether it actually worked.
 *
 * navigator.clipboard is undefined outside a secure context and inside a few
 * in-app browsers (the WhatsApp and Instagram webviews among them) — which is
 * precisely where a "copy this link" button gets used — so fall back to the
 * old selection-based copy rather than leaving the button silently dead.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or blocked — try the fallback below.
  }

  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    // Off-screen but still focusable; `display:none` would break the copy.
    field.style.position = 'fixed'
    field.style.top = '0'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    field.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(field)
    return ok
  } catch {
    return false
  }
}
