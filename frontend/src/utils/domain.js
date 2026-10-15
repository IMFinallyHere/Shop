// The main/landing domain (`localhost` in dev, VITE_MAIN_DOMAIN at build time in prod);
// each shop is a subdomain of it, like `acme.localhost`. Login on the main domain shows
// the shop picker; login on a shop subdomain goes straight to that shop's dashboard.
const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'localhost'

export const isMainDomain = () => {
  const h = window.location.hostname
  return h === MAIN_DOMAIN || h === '127.0.0.1'
}

export const homePath = () => (isMainDomain() ? '/shops' : '/dashboard')

// Build the absolute URL of a shop, carrying the JWT across the origin boundary
// (different subdomain = different origin = separate localStorage) via the URL hash.
// A page on a shop's own address, keeping the current protocol and port (dev uses :5173).
export const shopUrl = (domain, path = '/') =>
  `${window.location.protocol}//${domain}${window.location.port ? `:${window.location.port}` : ''}${path}`

export const shopUrlWithTokens = (domain) => {
  const access = localStorage.getItem('access_token')
  const refresh = localStorage.getItem('refresh_token')
  const frag = `#access=${encodeURIComponent(access)}&refresh=${encodeURIComponent(refresh)}`
  return shopUrl(domain, `/dashboard${frag}`)
}
