export function assertSameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return // non-browser local clients may omit Origin
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host')
  if (!host || new URL(origin).host !== host) throw new Error('Cross-origin writes are not allowed')
}
