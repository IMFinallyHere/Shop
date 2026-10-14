import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getOnboarding, updateOnboarding } from '../api/shopsettings'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/common/Modal'
import { translate } from './strings'
import { startTour } from './tour'

const OnboardingContext = createContext(null)

// Outside a shop (website, sign-in) there's no onboarding; callers get harmless no-ops.
const NONE = {
  ready: false, language: 'en', checklist: null, checklistDismissed: true,
  t: (k, v) => translate('en', k, v),
  setLanguage: () => {}, runTour: () => {}, dismissChecklist: () => {}, addEvent: () => {},
  refresh: () => {}, playVideo: () => {},
}
// eslint-disable-next-line react-refresh/only-export-components
export const useOnboarding = () => useContext(OnboardingContext) ?? NONE

// Videos live in /videos as <id>.<lang>.mp4 with a matching .vtt caption file.
function VideoPlayer({ id, language, t, onClose }) {
  const [failed, setFailed] = useState(false)
  return (
    <Modal isOpen onClose={onClose} title={t(`video.${id}.title`)} description={t(`video.${id}.body`)} size="2xl">
      {failed ? (
        <p className="rounded-lg bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">{t('help.empty')}</p>
      ) : (
        <video key={`${id}.${language}`} className="w-full rounded-lg bg-zinc-900" controls autoPlay playsInline
          src={`/videos/${id}.${language}.mp4`} onError={() => setFailed(true)}>
          <track kind="captions" srcLang={language} label={language === 'hi' ? 'हिंदी' : 'English'} src={`/videos/${id}.${language}.vtt`} default />
        </video>
      )}
    </Modal>
  )
}

export function OnboardingProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(null)
  const [video, setVideo] = useState(null)
  const stateRef = useRef(null)
  useEffect(() => { stateRef.current = state }, [state])
  const started = useRef(false)
  const member = !!(user?.is_superuser || user?.is_staff)

  const language = state?.language ?? 'en'
  const t = useCallback((key, vars) => translate(language, key, vars), [language])

  const refresh = useCallback(() => getOnboarding().then(r => setState(r.data)).catch(() => {}), [])
  const update = useCallback((data) => updateOnboarding(data).then(r => setState(r.data)).catch(() => {}), [])

  useEffect(() => { if (member) refresh() }, [member, refresh])

  const setLanguage = useCallback((lang) => {
    setState(s => (s ? { ...s, language: lang } : s))
    update({ language: lang })
  }, [update])

  const runTour = useCallback((lang) => {
    // Switching language on the welcome step restarts the tour in the new language.
    const launch = (l) => startTour({
      user,
      shopName: user?.shop_name,
      language: l,
      t: (key, vars) => translate(l, key, vars),
      onLanguage: (next) => { setLanguage(next); setTimeout(() => launch(next), 60) },
      onFinish: () => { if (!stateRef.current?.tour_done) update({ tour_done: true }) },
    })
    launch(lang ?? stateRef.current?.language ?? 'en')
  }, [user, setLanguage, update])

  // First visit to the shop: start the tour once the page has drawn.
  useEffect(() => {
    if (!state || state.tour_done || started.current) return
    // Marked inside the timer: a cancelled timer (e.g. re-render) must not count as started.
    const timer = setTimeout(() => { started.current = true; runTour(state.language) }, 700)
    return () => clearTimeout(timer)
  }, [state, runTour])

  const value = useMemo(() => ({
    ready: !!state,
    language,
    t,
    checklist: state?.checklist ?? null,
    checklistDismissed: !!state?.checklist_dismissed,
    setLanguage,
    runTour,
    refresh,
    dismissChecklist: () => update({ checklist_dismissed: true }),
    addEvent: (event) => update({ add_event: event }),
    playVideo: setVideo,
  }), [state, language, t, setLanguage, runTour, refresh, update])

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {video && <VideoPlayer id={video} language={language} t={t} onClose={() => setVideo(null)} />}
    </OnboardingContext.Provider>
  )
}
