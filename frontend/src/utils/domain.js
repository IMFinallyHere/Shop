// In dev, the main/landing domain is bare `localhost`; each shop is a subdomain
// like `acme.localhost`. Login on the main domain shows the shop picker; login on a
// shop subdomain goes straight to that shop's dashboard.
export const isMainDomain = () => {
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1'
}

export const homePath = () => (isMainDomain() ? '/shops' : '/dashboard')

// Build the absolute URL of a shop, carrying the JWT across the origin boundary
// (different subdomain = different origin = separate localStorage) via the URL hash.
export const shopUrlWithTokens = (domain) => {
  const port = window.location.port ? `:${window.location.port}` : ''
  const access = localStorage.getItem('access_token')
  const refresh = localStorage.getItem('refresh_token')
  const frag = `#access=${encodeURIComponent(access)}&refresh=${encodeURIComponent(refresh)}`
  return `${window.location.protocol}//${domain}${port}/dashboard${frag}`
}
