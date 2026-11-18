/**
 * Customer mood: the chatbot reads the mood of every question in the same Gemini call as its
 * reply (a hidden "[mood: …]" tag at the end, removed before the user sees it). It uses it at once
 * to adjust its tone, and it is stored here with what the question was about, never the text.
 */
import type { ChatAsker, ChatMoodKind } from '@prisma/client'
import prisma from '../../../config/db'

export type Mood = 'calm' | 'confused' | 'frustrated'

// "[mood: frustrated]", tolerant of spacing and letter case
const MOOD_TAG = /\[\s*mood\s*:\s*(calm|confused|frustrated)\s*\]/gi

/** Removes every mood tag from the model's reply and returns the last mood it gave, if any */
export const takeMood = (reply: string): { text: string; mood?: Mood } => {
  let mood: Mood | undefined
  const text = reply
    .replace(MOOD_TAG, (_tag, found: string) => {
      mood = found.toLowerCase() as Mood
      return ''
    })
    .trim()
  return { text, mood }
}

export type MoodRecord = {
  mood?: Mood
  asker: 'visitor' | 'customer'
  arabic: boolean
  topic: string
  eventId?: string
}

/**
 * Stores one question's mood in the background: a failure is logged and never affects the reply.
 * Administrators' questions are not passed here, so the figures are about customers only.
 */
export const recordMood = (r: MoodRecord) => {
  // Started inside a promise so that even an error thrown at once is caught here, not by the reply
  Promise.resolve()
    .then(() =>
      prisma.chatMood.create({
      data: {
        mood: (r.mood?.toUpperCase() ?? 'UNKNOWN') as ChatMoodKind,
        asker: r.asker.toUpperCase() as ChatAsker,
        language: r.arabic ? 'ar' : 'en',
        topic: r.topic.slice(0, 50),
        eventId: r.eventId ?? null,
      },
      }),
    )
    .catch((error: unknown) => console.error('[intelligence] could not record chat mood:', error instanceof Error ? error.message : error))
}

const CAIRO = 'Africa/Cairo'
const DAY_MS = 86_400_000
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
const cairoDay = new Intl.DateTimeFormat('en-CA', { timeZone: CAIRO, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Midnight in Cairo at the start of a YYYY-MM-DD day, as a UTC instant (Egypt is UTC+2 or +3) */
const cairoMidnight = (yyyyMmDd: string) => {
  const guess = new Date(`${yyyyMmDd}T00:00:00Z`)
  const offset = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: CAIRO, timeZoneName: 'shortOffset' })
      .formatToParts(guess)
      .find((p) => p.type === 'timeZoneName')
      ?.value.replace('GMT', '') || 0,
  )
  return new Date(guess.getTime() - offset * 3_600_000)
}

const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

/**
 * How customers felt when asking the chatbot over a period (Cairo dates, inclusive; default the
 * last 30 days): mood counts, mood per day, the topics and events with the most confused or
 * frustrated questions, and the language split. Used by the admin assistant and GET /api/assistant/mood.
 */
export const moodReport = async ({ from, to }: { from?: string; to?: string } = {}) => {
  const today = cairoDay.format(new Date())
  const toDay = isDay(to) ? to : today
  const fromDay = isDay(from) ? from : cairoDay.format(new Date(cairoMidnight(toDay).getTime() - 29 * DAY_MS + 12 * 3_600_000))
  const where = { createdAt: { gte: cairoMidnight(fromDay), lt: new Date(cairoMidnight(toDay).getTime() + DAY_MS) } }

  const rows = await prisma.chatMood.findMany({
    where,
    select: { mood: true, asker: true, language: true, topic: true, createdAt: true, event: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const moods = ['CALM', 'CONFUSED', 'FRUSTRATED', 'UNKNOWN'] as const
  const empty = () => Object.fromEntries(moods.map((m) => [m.toLowerCase(), 0])) as Record<Lowercase<(typeof moods)[number]>, number>
  const total = empty()
  const byDay = new Map<string, ReturnType<typeof empty>>()
  const byTopic = new Map<string, ReturnType<typeof empty>>()
  const byEvent = new Map<string, { name: string; counts: ReturnType<typeof empty> }>()
  let arabic = 0
  let customers = 0

  for (const r of rows) {
    const mood = r.mood.toLowerCase() as keyof ReturnType<typeof empty>
    total[mood]++
    const dayKey = cairoDay.format(r.createdAt)
    if (!byDay.has(dayKey)) byDay.set(dayKey, empty())
    byDay.get(dayKey)![mood]++
    if (!byTopic.has(r.topic)) byTopic.set(r.topic, empty())
    byTopic.get(r.topic)![mood]++
    if (r.event) {
      if (!byEvent.has(r.event.id)) byEvent.set(r.event.id, { name: r.event.name, counts: empty() })
      byEvent.get(r.event.id)!.counts[mood]++
    }
    if (r.language === 'ar') arabic++
    if (r.asker === 'CUSTOMER') customers++
  }

  const unhappy = (c: ReturnType<typeof empty>) => c.confused + c.frustrated
  const questions = rows.length
  return {
    period: { from: fromDay, to: toDay, timezone: CAIRO },
    questions,
    moods: total,
    moods_percent: { calm: share(total.calm, questions), confused: share(total.confused, questions), frustrated: share(total.frustrated, questions) },
    signed_in_customers_percent: share(customers, questions),
    arabic_percent: share(arabic, questions),
    per_day: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, counts]) => ({ day, ...counts })),
    topics_most_confused_or_frustrated: [...byTopic.entries()]
      .map(([topic, counts]) => ({ topic, questions: Object.values(counts).reduce((a, b) => a + b, 0), ...counts }))
      .filter((t) => unhappy(t) > 0)
      .sort((a, b) => unhappy(b) - unhappy(a) || b.questions - a.questions)
      .slice(0, 8),
    events_most_confused_or_frustrated: [...byEvent.entries()]
      .map(([eventId, e]) => ({ event_id: eventId, name: e.name, questions: Object.values(e.counts).reduce((a, b) => a + b, 0), ...e.counts }))
      .filter((e) => unhappy(e) > 0)
      .sort((a, b) => unhappy(b) - unhappy(a) || b.questions - a.questions)
      .slice(0, 5),
  }
}
