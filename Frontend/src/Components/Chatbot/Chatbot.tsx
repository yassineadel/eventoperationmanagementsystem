import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { createChatSession, chatInputLimit } from './chatSession'
import { assistantChatReply } from './assistantApi'
import { chatStrings } from './strings'
import type { ChatSend } from './types'
import { voiceSupported } from './voiceAudio'
import { createVoiceController, type VoiceDeps, type VoiceProblem, type VoiceState } from './voiceSession'
import './Chatbot.css'

function ChatIcon({ name }: { name: 'chat' | 'close' | 'reset' | 'send' | 'arrow' | 'ticket' | 'mic' | 'stop' }) {
  const paths = {
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-3 3V11.5A7.5 7.5 0 0 1 9.5 4h3A7.5 7.5 0 0 1 20 11.5Z" /><path d="M7 10h8M7 14h5" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
    send: <><path d="m21 3-7 18-4-8-8-4 19-6ZM10 13l11-10" /></>,
    arrow: <path d="M4 12h15m-5-5 5 5-5 5" />,
    ticket: <><path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6Z" /><path d="M15 6v3m0 3v1m0 3v2" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

// The live assistant waits on Gemini, which can take a while when busy; the backend stops starting
// new attempts after 30 s, so wait a little longer than that before showing "took too long"
const replyTimeoutMs = 45_000

// The service is injectable: tests pass the local sample adapter (chatService.ts) instead.
// voiceDeps: tests pass fake microphone, speaker and socket; null hides voice
export default function Chatbot({ sendMessage = assistantChatReply, defaultOpen = false, voiceDeps }: { sendMessage?: ChatSend; defaultOpen?: boolean; voiceDeps?: VoiceDeps | null }) {
  const { lang, theme } = usePreferences()
  const t = chatStrings[lang]
  const id = useId()
  const [session] = useState(() => createChatSession(sendMessage, replyTimeoutMs))
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot)
  const [open, setOpen] = useState(defaultOpen)
  const [draft, setDraft] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const launcher = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const followLatest = useRef(true)
  const busy = snapshot.status === 'typing'
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [captions, setCaptions] = useState({ user: '', assistant: '' })
  const [voiceProblem, setVoiceProblem] = useState<VoiceProblem | null>(null)
  // Voice chat: spoken exchanges join the same conversation as typed ones
  const [voice] = useState(() => voiceDeps === null || (!voiceDeps && !voiceSupported()) ? null : createVoiceController({
    onState: setVoiceState,
    onCaptions: setCaptions,
    onTurn: (user, reply) => { session.addSpokenExchange(user, reply) },
    onProblem: setVoiceProblem,
  }, voiceDeps ?? undefined))
  const talking = voiceState !== 'idle'

  useEffect(() => () => { session.cancel(); voice?.stop() }, [session, voice])
  useEffect(() => {
    const openHelp = () => setOpen(true)
    window.addEventListener('hafletna:open-help', openHelp)
    return () => window.removeEventListener('hafletna:open-help', openHelp)
  }, [])
  useEffect(() => {
    if (open) input.current?.focus({ preventScroll: true })
  }, [open])
  useEffect(() => {
    if (open && followLatest.current && body.current) body.current.scrollTop = body.current.scrollHeight
  }, [open, snapshot])

  function close() {
    voice?.stop()
    setOpen(false)
    launcher.current?.focus({ preventScroll: true })
  }

  function ask(query: string, display = query) {
    followLatest.current = true
    if (session.ask(query, display)) {
      setDraft('')
      setAnnouncement('')
      input.current?.focus({ preventScroll: true })
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    ask(draft)
  }

  function onInputKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (!busy) ask(draft)
    }
  }

  function toggleVoice() {
    if (!voice) return
    if (talking) { voice.stop(); return }
    setVoiceProblem(null)
    followLatest.current = true
    void voice.start(session.history())
  }

  function reset() {
    voice?.stop()
    session.reset()
    setDraft('')
    setAnnouncement(t.reset)
    followLatest.current = true
    input.current?.focus({ preventScroll: true })
  }

  return <div className="chat-root" data-theme={theme} lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <button ref={launcher} className="chat-launcher" type="button" aria-label={t.open} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => open ? close() : setOpen(true)}>
      <span className="chat-launcher-icon"><ChatIcon name={open ? 'close' : 'chat'} /></span>
      <span className="chat-launcher-copy"><strong>{t.open}</strong><small>{t.launcherHint}</small></span>
    </button>
    {open && <section className="chat-panel" id={`${id}-panel`} role="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-mode`} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }}>
      <header className="chat-header">
        <span className="chat-brand-mark"><ChatIcon name="ticket" /></span>
        <div className="chat-header-copy"><h2 id={`${id}-title`}>{t.title}</h2><p>{t.subtitle}</p></div>
        <div className="chat-header-actions">
          <button type="button" aria-label={t.clear} title={t.clear} onClick={reset} disabled={!snapshot.messages.length}><ChatIcon name="reset" /></button>
          <button type="button" aria-label={t.close} title={t.close} onClick={close}><ChatIcon name="close" /></button>
        </div>
      </header>
      <p className="chat-mode-note" id={`${id}-mode`}><strong>{t.sample}</strong> · {t.languageNote}</p>
      <div className="chat-body" ref={body} onScroll={(event) => { const element = event.currentTarget; followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 60 }}>
        {!snapshot.messages.length && <div className="chat-welcome">
          <p className="chat-eyebrow">{t.eyebrow}</p><h3>{t.welcome}</h3><p>{t.intro}</p>
          <div className="chat-prompts">{t.prompts.map((prompt, index) => <button type="button" key={prompt} onClick={() => ask(prompt)}><span className="chat-prompt-icon"><ChatIcon name={index === 0 ? 'ticket' : 'arrow'} /></span>{prompt}</button>)}</div>
        </div>}
        <div className="chat-log" role="log" aria-label={t.conversation} aria-live="polite" aria-relevant="additions" aria-atomic="false">
          {snapshot.messages.map((message) => <div className={`chat-message is-${message.role}`} key={message.id}>
            <span className="chat-message-label">{message.role === 'user' ? t.you : t.assistant}</span>
            <div className="chat-bubble" dir="auto">{message.text}
              {!!message.links?.length && <div className="chat-links">{message.links.map((link) => <Link to={link.to} key={link.to} onClick={close}>{link.label}<ChatIcon name="arrow" /></Link>)}</div>}
            </div>
          </div>)}
        </div>
        {busy && <div className="chat-typing" role="status"><span className="chat-typing-dots" aria-hidden="true"><span /><span /><span /></span>{t.typing}</div>}
        {snapshot.status === 'error' && <div className="chat-error" role="alert"><p>{snapshot.error === 'timeout' ? t.timeout : t.unavailable}</p><button type="button" onClick={() => { followLatest.current = true; session.retry() }}>{t.retry}</button></div>}
      </div>
      {talking && <div className="chat-voice" role="status" aria-live="polite">
        <p className="chat-voice-state"><span className={`chat-voice-dot is-${voiceState}`} aria-hidden="true" />{voiceState === 'connecting' ? t.voiceConnecting : voiceState === 'speaking' ? t.voiceSpeaking : t.voiceListening}</p>
        {captions.user && <p className="chat-voice-caption" dir="auto"><strong>{t.you}:</strong> {captions.user}</p>}
        {captions.assistant && <p className="chat-voice-caption" dir="auto"><strong>{t.assistant}:</strong> {captions.assistant}</p>}
      </div>}
      {voiceProblem && !talking && <p className="chat-voice-problem" role="alert">{t.voiceProblems[voiceProblem]}</p>}
      <form className="chat-composer" onSubmit={submit}>
        <textarea ref={input} rows={2} aria-label={t.input} aria-describedby={`${id}-hint ${id}-privacy`} placeholder={talking ? t.voicePlaceholder : t.placeholder} value={draft} maxLength={chatInputLimit} onChange={(event) => setDraft(event.target.value)} onKeyDown={onInputKey} dir="auto" disabled={talking} />
        {voice && <button type="button" className={`chat-voice-button${talking ? ' is-on' : ''}`} onClick={toggleVoice} disabled={busy && !talking} aria-pressed={talking} aria-label={talking ? t.voiceStop : t.voiceStart} title={talking ? t.voiceStop : t.voiceStart}><ChatIcon name={talking ? 'stop' : 'mic'} /></button>}
        <button type="submit" disabled={busy || talking || !draft.trim()} aria-label={t.send} title={t.send}><ChatIcon name="send" /></button>
      </form>
      <div className="chat-composer-note"><small id={`${id}-hint`}>{t.hint}</small><small aria-label={`${draft.length} / ${chatInputLimit} ${t.count}`}>{draft.length}/{chatInputLimit}</small></div>
      <p className="chat-privacy" id={`${id}-privacy`}>{t.privacy}</p>
      <span className="chat-sr-only" role="status">{announcement}</span>
    </section>}
  </div>
}
