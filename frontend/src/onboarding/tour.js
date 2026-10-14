import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './tour.css'
import { LANGUAGES } from './strings'

// Steps point at `data-tour` attributes. A step is skipped when its element isn't on
// screen, which is also how the staff tour loses what their role can't open: the sidebar
// and top bar only render what the user may use.
const STEPS = [
  { key: 'welcome' },
  { key: 'sell', el: '[data-tour="nav-sell"]', side: 'right' },
  { key: 'inventory', el: '[data-tour="nav-inventory"]', side: 'right' },
  { key: 'newBill', el: '[data-tour="new-bill"]', side: 'bottom' },
  { key: 'search', el: '[data-tour="search"]', side: 'bottom' },
  { key: 'admin', el: '[data-tour="nav-admin"]', side: 'right', owner: true },
  { key: 'help', el: '[data-tour="user-menu"]', side: 'bottom' },
  { key: 'checklist', el: '[data-tour="checklist"]', side: 'bottom', owner: true },
]

const visible = (selector) => {
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth ? el : null
}

/**
 * Runs the tour. `t(key, vars)` gives text in the current language; `onLanguage(lang)` is
 * called from the welcome step's language buttons (the caller restarts the tour);
 * `onFinish()` runs when the tour is finished or skipped.
 */
export function startTour({ user, shopName, language, t, onLanguage, onFinish }) {
  const owner = !!user?.is_superuser
  const steps = STEPS
    .filter(s => !s.owner || owner)
    .filter(s => !s.el || visible(s.el))
    .map(s => {
      const welcome = s.key === 'welcome'
      return {
        element: s.el,
        popover: {
          title: welcome ? t('tour.welcome.title', { shop: shopName || '' }) : t(`tour.${s.key}.title`),
          description: welcome ? t(owner ? 'tour.welcome.body' : 'tour.welcomeStaff.body') : t(`tour.${s.key}.body`),
          side: s.side,
          align: 'start',
          popoverClass: welcome ? 'shop-tour shop-tour-welcome' : 'shop-tour',
        },
      }
    })

  let switching = false
  const tour = driver({
    steps,
    showProgress: true,
    progressText: t('tour.progress'),
    nextBtnText: t('tour.next'),
    prevBtnText: t('tour.back'),
    doneBtnText: t('tour.done'),
    allowClose: true,
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 10,
    smoothScroll: true,
    onPopoverRender: (popover, { state }) => {
      if (state.activeIndex !== 0) return
      // English / हिंदी on the welcome step.
      const row = document.createElement('div')
      row.className = 'shop-tour-langs'
      row.setAttribute('role', 'group')
      row.setAttribute('aria-label', 'Language')
      LANGUAGES.forEach(({ value, label }) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.setAttribute('aria-pressed', String(value === language))
        b.addEventListener('click', () => {
          if (value === language) return
          switching = true
          tour.destroy()
          onLanguage(value)
        })
        row.appendChild(b)
      })
      popover.description.after(row)
    },
    onDestroyed: () => { if (!switching) onFinish() },
  })
  tour.drive()
  return tour
}
