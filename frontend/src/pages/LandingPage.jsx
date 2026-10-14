import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { BRAND, SITE_DOMAIN } from '../brand'
import { useAuth } from '../contexts/AuthContext'
import useCreateShop from '../hooks/useCreateShop'
import LiveCounter from '../components/landing/LiveCounter'
import { prefersReducedMotion, useReveal } from '../components/landing/motion'
import '../components/landing/landing.css'
import Logo from '../components/ui/Logo'
import PasswordInput from '../components/ui/PasswordInput'
import dashboardShot from '../assets/landing/dashboard.webp'
import productsShot from '../assets/landing/products.webp'
import labelsShot from '../assets/landing/labels.webp'
import posShot from '../assets/landing/pos.webp'
import receiptShot from '../assets/landing/receipt.webp'
import customerShot from '../assets/landing/customer.webp'

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap'
const DEMO_HOST = `asha-boutique.${SITE_DOMAIN}`
const STEP_MS = 6000

// Same rule as the server's slugify: what the shop's web address will be.
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')

const SHOP_TYPES = ['Saree stores', 'Boutiques', 'Kurti and suit shops', 'Menswear', 'Kidswear', 'Ethnic wear', 'Lehenga studios', 'Uniform shops', 'Hosiery', 'Footwear and accessories']

const STEPS = [
  {
    title: 'Add stock',
    body: 'Enter a product once with its sizes, colours and price. Each piece gets its own barcode, so a saree in maroon and the same saree in navy are never mixed up.',
    shot: productsShot, alt: 'Products list with sizes, colours, supplier and stock for each', kind: 'screen', path: '/products',
  },
  {
    title: 'Print the tags',
    body: 'Labels come out at your sticker size on any thermal printer: name, colour and size, price and barcode, one sticker per piece.',
    shot: labelsShot, alt: 'Label settings with a true-size preview of a 50 × 25 mm tag', kind: 'paper',
  },
  {
    title: 'Scan at the counter',
    body: 'Scan each piece, pick cash, UPI or card, and charge. A returning customer’s name fills in from their phone number.',
    shot: posShot, alt: 'Billing counter with three scanned pieces and a returning customer', kind: 'screen', path: '/pos',
  },
  {
    title: 'Hand over the receipt',
    body: 'A GST receipt with your address and GSTIN on a 58 or 80 mm roll, or A4. Stock updates the moment the bill is saved.',
    shot: receiptShot, alt: 'Printed tax invoice from Asha Boutique', kind: 'paper',
  },
]

const FEATURES = [
  ['Sizes and colours', 'Every product carries its own sizes and colours, with stock counted for each one.'],
  ['One code per piece', 'See exactly when each garment came in, sold, came back or was written off.'],
  ['Returns and store credit', 'Refund to cash or UPI, or keep it as credit the customer spends on their next visit.'],
  ['Customers by phone', 'Type a number and their name, bills and credit are there. No loyalty cards to hand out.'],
  ['GST on every bill', 'Set your tax rate once. Every bill and receipt shows it, with discounts worked out for you.'],
  ['Staff with their own logins', 'Cashiers bill, managers look after stock, and only you decide who does what.'],
  ['Find anything', 'One search box takes a barcode, bill number, customer or product.'],
  ['Your own web address', 'Your shop opens at its own address from any laptop with a browser. Nothing to install.'],
]

function Reveal({ as: Tag = 'div', zoom = false, delay = 0, className = '', children, ...rest }) {
  const ref = useReveal()
  return (
    <Tag ref={ref} className={`lp-reveal ${zoom ? 'lp-zoom' : ''} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined} {...rest}>
      {children}
    </Tag>
  )
}

// Headline whose words rise in one after another.
function RisingHeadline({ text, className, start = 0 }) {
  return (
    <h1 className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} aria-hidden="true">
          <span className="lp-word" style={{ animationDelay: `${start + i * 90}ms` }}>{w}</span>{' '}
        </span>
      ))}
    </h1>
  )
}

function Frame({ shot, alt, kind, path }) {
  if (kind === 'paper') {
    return (
      <div className="flex h-full items-center justify-center rounded-3xl bg-white p-6 ring-1 ring-dye-900/5 sm:p-10">
        <img src={shot} alt={alt} className="max-h-[30rem] w-auto rounded-xl shadow-[0_24px_50px_-20px_rgba(18,15,51,.4)]" />
      </div>
    )
  }
  return (
    <figure className="overflow-hidden rounded-3xl bg-white shadow-[0_40px_80px_-40px_rgba(18,15,51,.45)] ring-1 ring-dye-900/10">
      <div className="flex items-center border-b border-zinc-200/80 bg-zinc-50 px-4 py-2.5">
        {/* The address bar shows the shop's own web address. */}
        <span className="mx-auto truncate rounded-full bg-white px-4 py-1 text-xs text-zinc-500 ring-1 ring-zinc-200">{DEMO_HOST}{path}</span>
      </div>
      <img src={shot} alt={alt} className="block w-full" loading="lazy" />
    </figure>
  )
}

// Steps advance on their own until the visitor picks one.
function Steps() {
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(!prefersReducedMotion())
  const [paused, setPaused] = useState(false)
  const ref = useReveal(0.3)

  useEffect(() => {
    if (!auto || paused) return
    const t = setTimeout(() => setActive(a => (a + 1) % STEPS.length), STEP_MS)
    return () => clearTimeout(t)
  }, [active, auto, paused])

  const step = STEPS[active]
  return (
    <div ref={ref} className="lp-reveal grid gap-10 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:gap-14"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <ol className="space-y-2" role="tablist" aria-label="How it works">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button" role="tab" aria-selected={i === active} aria-controls="step-panel"
              onClick={() => { setActive(i); setAuto(false) }}
              className={`group relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-dye-700 ${i === active ? 'bg-white shadow-[0_12px_30px_-16px_rgba(18,15,51,.35)]' : 'hover:bg-white/70'}`}
            >
              <span className="flex items-center gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold transition-colors duration-300 ${i === active ? 'bg-dye-900 text-white' : 'bg-white text-zinc-500 ring-1 ring-zinc-200'}`}>{i + 1}</span>
                <span className="font-display text-lg font-semibold tracking-tight text-dye-950">{s.title}</span>
              </span>
              <span className={`grid transition-[grid-template-rows] duration-500 ${i === active ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] max-lg:grid-rows-[1fr]'}`}>
                <span className="overflow-hidden">
                  <span className="mt-2 block pl-11 text-sm leading-relaxed text-zinc-600">{s.body}</span>
                </span>
              </span>
              {i === active && auto && (
                <span key={active} className="lp-progress absolute bottom-0 left-0 h-0.5 w-full bg-marigold-500"
                  style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }} aria-hidden="true" />
              )}
            </button>
          </li>
        ))}
      </ol>
      <div id="step-panel" role="tabpanel" aria-label={step.title} key={active} className="lp-pop min-h-[18rem]">
        <Frame {...step} />
      </div>
    </div>
  )
}

function SignupForm() {
  const { createShop, fieldErrors, error, loading, created } = useCreateShop()
  const [form, setForm] = useState({ shop_name: '', first_name: '', last_name: '', email: '', password: '' })
  const id = useId()
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const slug = slugify(form.shop_name)

  if (created) {
    return (
      <div className="flex min-h-[22rem] flex-col items-center justify-center text-center" role="status">
        <span className="lp-pop mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-marigold-200">
          <Loader2 className="animate-spin text-dye-900" size={26} />
        </span>
        <p className="font-display text-2xl font-bold tracking-tight text-dye-950">{created.shop} is ready</p>
        <p className="mt-2 text-sm text-zinc-600">Opening your dashboard at {created.domain}</p>
      </div>
    )
  }

  const input = 'block w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-[15px] text-dye-950 transition-shadow placeholder:text-zinc-400 focus:border-dye-700 focus:outline-none focus:ring-4 focus:ring-dye-700/15'
  const field = (name, label, props = {}) => (
    <div>
      <label htmlFor={`${id}-${name}`} className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</label>
      {name === 'password'
        ? <PasswordInput id={`${id}-${name}`} value={form[name]} onChange={set(name)} invalid={!!fieldErrors[name]} {...props} />
        : <input id={`${id}-${name}`} className={input} value={form[name]} onChange={set(name)} aria-invalid={!!fieldErrors[name]} {...props} />}
      {fieldErrors[name] && <p className="lp-swap mt-1.5 text-sm text-red-700">{fieldErrors[name]}</p>}
    </div>
  )

  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); createShop(form) }} noValidate>
      {error && <p className="lp-swap rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
      {field('shop_name', 'Shop name', { required: true, placeholder: 'Asha Boutique', autoComplete: 'organization' })}
      <p className="-mt-2 truncate text-sm text-zinc-500" aria-live="polite">
        Your shop will open at <span key={slug} className="lp-swap inline-block font-medium text-dye-800">{slug || 'your-shop'}.{SITE_DOMAIN}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('first_name', 'First name', { autoComplete: 'given-name' })}
        {field('last_name', 'Last name', { autoComplete: 'family-name' })}
      </div>
      {field('email', 'Email', { type: 'email', required: true, autoComplete: 'email' })}
      {field('password', 'Password', { required: true, autoComplete: 'new-password' })}
      <p className="-mt-2 text-sm text-zinc-500">At least 8 characters. Not all numbers or a common password.</p>
      <button type="submit" disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-dye-900 px-5 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-dye-800 hover:shadow-[0_12px_24px_-10px_rgba(26,22,80,.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dye-700 active:translate-y-0 disabled:opacity-70">
        {loading && <Loader2 size={18} className="animate-spin" />}
        {loading ? 'Creating your shop' : 'Create shop'}
      </button>
    </form>
  )
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    document.title = `${BRAND}: billing and stock for clothing shops`
    if (!document.querySelector(`link[href="${FONT_URL}"]`)) {
      document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONT_URL }))
    }
  }, [])

  const cta = 'inline-flex items-center justify-center rounded-full px-6 py-3 text-[15px] font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
  const h2 = 'font-display text-4xl font-bold leading-[1.08] tracking-[-0.02em] sm:text-5xl'

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-dye-950 antialiased">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Skip to content</a>

      {/* Hero */}
      <header className="relative bg-dye-900 text-white">
        <nav className="lp-fade relative z-10 mx-auto flex max-w-6xl items-center gap-6 px-5 py-5 sm:px-8" aria-label="Main">
          <Link to="/" className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight"><Logo size={30} />{BRAND}</Link>
          <div className="ml-6 hidden gap-7 text-sm text-white/70 md:flex">
            <a href="#how" className="transition-colors hover:text-white">How it works</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated
              ? <Link to="/shops" className="rounded-full px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:text-white">Your shops</Link>
              : <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:text-white">Sign in</Link>}
            <a href="#start" className={`${cta} hidden bg-marigold-400 px-5 py-2 text-sm text-dye-950 hover:bg-marigold-300 focus-visible:outline-white sm:inline-flex`}>Create your shop</a>
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_31rem] lg:pb-24 lg:pt-14">
          <div>
            <RisingHeadline text="Bill faster. Know every piece in your shop."
              className="max-w-[14ch] font-display text-[2.9rem] font-extrabold leading-[1.02] tracking-[-0.025em] sm:text-6xl lg:text-7xl" />
            <p className="lp-fade mt-7 max-w-xl text-lg leading-relaxed text-white/75" style={{ animationDelay: '650ms' }}>
              Barcode tags for every garment, a quick billing counter, returns and store credit, and stock that keeps itself up to date. Made for clothing shops in India.
            </p>
            <div className="lp-fade mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: '800ms' }}>
              <a href="#start" className={`${cta} bg-marigold-400 text-dye-950 shadow-[0_10px_30px_-10px_rgba(253,186,77,.7)] hover:bg-marigold-300 focus-visible:outline-white`}>Create your shop</a>
              <a href="#how" className={`${cta} text-white ring-1 ring-white/25 hover:bg-white/10 focus-visible:outline-white`}>See how it works</a>
            </div>
            <p className="lp-fade mt-5 text-sm text-white/55" style={{ animationDelay: '950ms' }}>Free during early access. No card needed.</p>
          </div>
          <div className="lp-fade" style={{ animationDelay: '400ms' }}><LiveCounter /></div>
        </div>

        {/* Who it's for, drifting past. */}
        <div className="relative overflow-hidden border-t border-white/10 py-5" aria-label="Made for saree stores, boutiques, menswear, kidswear and more">
          <div className="lp-marquee" aria-hidden="true">
            {[0, 1].map(copy => (
              <div key={copy} className="flex shrink-0 items-center">
                {SHOP_TYPES.map(t => (
                  <span key={t} className="flex items-center gap-8 pr-8 font-display text-lg font-semibold tracking-tight text-white/60">
                    {t}<span className="h-1.5 w-1.5 rounded-full bg-marigold-400" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main id="main">
        {/* How it works: a real sequence, so the steps are numbered. */}
        <section id="how" className="bg-mist py-20 sm:py-28" aria-labelledby="how-title">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <h2 id="how-title" className={h2}>From rack to receipt</h2>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600">
                The four things a clothing shop does all day. Every screen here is the real app, running a demo shop.
              </p>
            </Reveal>
            <div className="mt-12"><Steps /></div>
          </div>
        </section>

        {/* Dashboard */}
        <section className="overflow-hidden py-20 sm:py-28" aria-labelledby="day-title">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <h2 id="day-title" className={h2}>Open the shop and see the day</h2>
              <p className="max-w-xl text-lg leading-relaxed text-zinc-600">
                Today’s sales, the last seven days, which sizes are running out and the latest bills, on one screen before the first customer walks in.
              </p>
            </Reveal>
            <Reveal zoom className="mt-12"><Frame shot={dashboardShot} alt="Dashboard with today's sales, a seven-day chart, recent bills and low stock" kind="screen" path="/dashboard" /></Reveal>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-mist py-20 sm:py-28" aria-labelledby="features-title">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal><h2 id="features-title" className={`${h2} max-w-2xl`}>Made for the way a clothing shop works</h2></Reveal>
            <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(([title, body], i) => (
                <Reveal key={title} delay={(i % 4) * 90}
                  className="group rounded-2xl bg-white p-5 ring-1 ring-dye-900/5 transition-shadow duration-300 hover:shadow-[0_20px_40px_-24px_rgba(18,15,51,.4)]">
                  <dt className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
                    <span className="h-2 w-2 rounded-full bg-marigold-400 transition-transform duration-300 group-hover:scale-150" aria-hidden="true" />{title}
                  </dt>
                  <dd className="mt-2 text-[15px] leading-relaxed text-zinc-600">{body}</dd>
                </Reveal>
              ))}
            </dl>
            <Reveal as="figure" zoom className="mt-12">
              <img src={customerShot} alt="A customer's page: bills, total spent, refunds and store credit" loading="lazy"
                className="w-full rounded-3xl shadow-[0_40px_80px_-40px_rgba(18,15,51,.45)] ring-1 ring-dye-900/10" />
              <figcaption className="mt-4 text-sm text-zinc-500">Every customer’s bills, spend, refunds and store credit, found by their phone number.</figcaption>
            </Reveal>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="relative overflow-hidden bg-dye-900 py-20 text-white sm:py-28" aria-labelledby="pricing-title">
          <div className="lp-glow pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-marigold-400/20 blur-3xl" aria-hidden="true" />
          <Reveal className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <h2 id="pricing-title" className="max-w-3xl font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.025em] sm:text-7xl">
              Free during early access
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">
              Everything on this page, with no limit on products, bills or staff. You only need a laptop, a barcode scanner and, if you print tags or receipts, a thermal printer.
            </p>
            <a href="#start" className={`${cta} mt-9 bg-marigold-400 text-dye-950 hover:bg-marigold-300 focus-visible:outline-white`}>Create your shop</a>
          </Reveal>
        </section>

        {/* Signup */}
        <section id="start" className="bg-mist py-20 sm:py-28" aria-labelledby="start-title">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
            <Reveal>
              <h2 id="start-title" className={h2}>Open your shop</h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-zinc-600">
                It takes about a minute. You’ll land on your dashboard, ready to add your first products and print their tags.
              </p>
              <p className="mt-8 max-w-lg text-[15px] leading-relaxed text-zinc-600">
                Already have a shop? <Link to="/login" className="font-medium text-dye-800 underline decoration-marigold-400 decoration-2 underline-offset-4 hover:text-dye-950">Sign in</Link>
              </p>
            </Reveal>
            <Reveal delay={120} className="rounded-3xl bg-white p-6 shadow-[0_40px_80px_-40px_rgba(18,15,51,.4)] sm:p-8">
              <SignupForm />
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="bg-dye-950 py-10 text-sm text-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 sm:px-8">
          <span className="flex items-center gap-2 font-display text-base font-bold text-white"><Logo size={22} />{BRAND}</span>
          <span>Billing and stock for clothing shops</span>
          <span className="ml-auto flex gap-5">
            <Link to="/login" className="transition-colors hover:text-white">Sign in</Link>
            <a href="#start" className="transition-colors hover:text-white">Create your shop</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
