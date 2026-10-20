import { NextResponse } from 'next/server'

export function proxy(request) {
  if (request.nextUrl.pathname === '/api/ingest') return NextResponse.next()
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) return NextResponse.next()

  const header = request.headers.get('authorization') || ''
  let supplied = ''
  try {
    if (header.startsWith('Basic ')) {
      const decoded = atob(header.slice(6))
      supplied = decoded.slice(decoded.indexOf(':') + 1)
    }
  } catch {}

  let mismatch = supplied.length ^ expected.length
  for (let i = 0; i < Math.max(supplied.length, expected.length); i++) {
    mismatch |= (supplied.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0)
  }
  if (mismatch === 0) return NextResponse.next()
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Personal Dashboard"' },
  })
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
