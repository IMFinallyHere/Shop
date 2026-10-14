import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, PartyPopper, PlayCircle, X } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { CHECKLIST } from './strings'
import { useOnboarding } from './OnboardingContext'

// The owner's first steps, at the top of the dashboard. Each item ticks itself off from
// the shop's data (see OnboardingView on the server).
export default function SetupChecklist() {
  const { checklist, checklistDismissed, dismissChecklist, playVideo, t } = useOnboarding()
  if (!checklist || checklistDismissed) return null
  const done = checklist.filter(c => c.done).length
  const allDone = done === checklist.length

  return (
    <Card className="mb-6 overflow-hidden" data-tour="checklist">
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-900">{t('checklist.title')}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{t('checklist.progress', { done, total: checklist.length })}</p>
        </div>
        <button onClick={dismissChecklist} className="-mr-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">
          <X size={14} />{t('checklist.hide')}
        </button>
      </div>
      <div className="mx-5 h-1.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuemin={0} aria-valuemax={checklist.length} aria-valuenow={done}>
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out" style={{ width: `${(done / checklist.length) * 100}%` }} />
      </div>

      {allDone ? (
        <p className="flex items-center gap-2 px-5 py-4 text-sm font-medium text-emerald-700 animate-pop-in">
          <PartyPopper size={18} />{t('checklist.allDone')}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100">
          {checklist.map(({ key, done: isDone }) => {
            const { video, to } = CHECKLIST[key]
            return (
              <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5">
                {isDone
                  ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-label="Done" />
                  : <Circle size={18} className="shrink-0 text-zinc-300" aria-label="Not done" />}
                <span className={`min-w-0 flex-1 text-sm ${isDone ? 'text-zinc-400 line-through' : 'text-zinc-800'}`}>{t(`checklist.${key}`)}</span>
                <span className="flex gap-1.5">
                  <button onClick={() => playVideo(video)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
                    <PlayCircle size={14} />{t('checklist.watch')}
                  </button>
                  {!isDone && (
                    <Link to={to} className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">{t('checklist.doIt')}</Link>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
