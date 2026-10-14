import { useEffect, useState } from 'react'
import { Compass, PlayCircle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { useAuth } from '../contexts/AuthContext'
import { can } from '../utils/permissions'
import { useOnboarding } from '../onboarding/OnboardingContext'
import { LANGUAGES, VIDEOS } from '../onboarding/strings'

// How-to videos the user's role can act on, in their language, plus the tour.
export default function HelpPage() {
  const { user } = useAuth()
  const { t, language, setLanguage, playVideo, runTour } = useOnboarding()
  const [index, setIndex] = useState(null)

  // index.json is written by tools/videos (lengths and poster frames).
  useEffect(() => {
    fetch('/videos/index.json').then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(setIndex)
  }, [])

  const videos = VIDEOS.filter(v => can(user, v.perm))
  const length = (id) => {
    const s = index?.[id]?.[language]?.seconds
    if (!s) return null
    return s >= 90 ? t('help.minutes', { n: Math.round(s / 60) }) : t('help.seconds', { n: Math.round(s) })
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title={t('help.title')} subtitle={t('help.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-zinc-100 p-0.5" role="radiogroup" aria-label={t('menu.language')}>
              {LANGUAGES.map(l => (
                <button key={l.value} role="radio" aria-checked={language === l.value} onClick={() => setLanguage(l.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${language === l.value ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-800'}`}>
                  {l.label}
                </button>
              ))}
            </div>
            <Button icon={Compass} onClick={() => runTour()}>{t('help.tour')}</Button>
          </div>
        } />

      {index && !Object.keys(index).length ? (
        <EmptyState icon={PlayCircle} title={t('help.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map(({ id }) => (
            <button key={id} onClick={() => playVideo(id)}
              className="group overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-card transition-shadow hover:shadow-pop focus-visible:ring-2 focus-visible:ring-brand-500">
              <div className="relative aspect-video bg-zinc-100">
                {index?.[id]?.poster && <img src={`/videos/${index[id].poster}`} alt="" className="h-full w-full object-cover" loading="lazy" />}
                <span className="absolute inset-0 flex items-center justify-center bg-zinc-900/10 transition-colors group-hover:bg-zinc-900/25">
                  <PlayCircle size={44} className="text-white drop-shadow-md transition-transform group-hover:scale-110" />
                </span>
                {length(id) && <span className="absolute bottom-2 right-2 rounded bg-zinc-900/75 px-1.5 py-0.5 text-xs font-medium text-white">{length(id)}</span>}
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-zinc-900">{t(`video.${id}.title`)}</p>
                <p className="mt-1 text-sm text-zinc-500">{t(`video.${id}.body`)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
