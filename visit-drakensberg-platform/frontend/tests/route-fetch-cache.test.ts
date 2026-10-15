import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Next 14 keeps fetch() results in its Data Cache, and that includes POST
// requests. supabase-js makes every query and .rpc() through fetch. In a
// route handler that only exports GET, `dynamic = 'force-dynamic'` does NOT
// switch the cache off: unless the handler reads cookies()/headers() before
// its first query, the first database answer is replayed on every later
// request, indefinitely, and across deployments.
//
// That is how the invoice PDF kept printing a customer's old name after
// staff corrected it, and how a cron's RPC can silently stop running. Every
// GET route handler that touches the database must therefore opt out:
//
//   export const fetchCache = 'force-no-store'

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return routeFiles(path)
    return /^route\.tsx?$/.test(name) ? [path] : []
  })
}

const touchesDatabase = (src: string) => /supabase|Supabase|\.rpc\(|\.from\(/.test(src)
const exportsGet = (src: string) => /export\s+(async\s+)?function\s+GET\b|export\s+const\s+GET\b/.test(src)

describe('GET route handlers never cache database reads', () => {
  const offenders = routeFiles('app')
    .map(path => ({ path, src: readFileSync(path, 'utf8') }))
    .filter(({ src }) => exportsGet(src) && touchesDatabase(src))
    .filter(({ src }) => !/export\s+const\s+fetchCache\s*=\s*['"]force-no-store['"]/.test(src))
    .map(({ path }) => path)

  it('every one exports fetchCache = force-no-store', () => {
    expect(offenders).toEqual([])
  })
})
