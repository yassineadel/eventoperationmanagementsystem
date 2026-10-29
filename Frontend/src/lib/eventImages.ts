import type { Category } from '../Components/Homepage/types.ts'

export const fallbackImages: Record<Category, string> = {
  concerts: '/event-images/concert.jpg', festivals: '/event-images/festival.jpg', arts: '/event-images/art.jpg',
  sports: '/event-images/sports.jpg', workshops: '/event-images/workshop.jpg', conferences: '/event-images/conference.jpg',
}

// Temporary local photos, used only until an organiser uploads event photography.
// A stable choice keeps cards, the hero, tickets and the detail page consistent.
export function eventPlaceholderImage(title: string, category: Category): string {
  const topics: [RegExp, string][] = [
    [/jazz|جاز/i, 'jazz'], [/piano|بيانو/i, 'piano'], [/oud|guitar|acoustic|عود|جيتار/i, 'guitar'],
    [/electronic|dj|إلكتروني/i, 'electronic'], [/violin|classical|orchestra|sufi|كمان|كلاسيك|صوفي/i, 'orchestra'],
    [/poetry|شعر/i, 'poetry'], [/comedy|open mic|كوميديا/i, 'microphone'], [/film|cinema|فيلم|سينما/i, 'cinema'],
    [/photograph|تصوير/i, 'photography'],
  ]
  const match = topics.find(([pattern]) => pattern.test(title))
  if (match) return `/event-images/${match[1]}.jpg`
  const photos: Record<Category, string[]> = {
    concerts: ['concert', 'electronic', 'guitar', 'jazz'], festivals: ['festival', 'electronic', 'concert'],
    arts: ['art', 'microphone', 'cinema'], sports: ['sports'],
    workshops: ['workshop', 'photography'], conferences: ['conference', 'workshop'],
  }
  const hash = Array.from(title).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)
  const choices = photos[category]
  return `/event-images/${choices[hash % choices.length]}.jpg`
}
