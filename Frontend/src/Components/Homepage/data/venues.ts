import type { Venue } from '../types'

// Fictional venues linked by name to the sample event catalogue.
export const venues: Venue[] = [
  {
    id: 'garden-stage', name: { en: 'The Garden Stage', ar: 'مسرح الحديقة' }, city: 'cairo',
    description: { en: 'Open skies, live sounds, and a front-row feeling in the heart of the city.', ar: 'سماء مفتوحة وموسيقى حية وإحساس الصف الأول في قلب المدينة.' },
    image: '/event-images/venue-garden.jpg',
  },
  {
    id: 'seafront-gardens', name: { en: 'Seafront Gardens', ar: 'حدائق الواجهة البحرية' }, city: 'alexandria',
    description: { en: 'A coastal gathering place for festival days and evenings worth staying out for.', ar: 'مساحة ساحلية لأيام المهرجانات والأمسيات التي تستحق السهر.' },
    image: '/event-images/venue-seafront.jpg',
  },
  {
    id: 'riverside-park', name: { en: 'Riverside Park', ar: 'حديقة ضفاف النيل' }, city: 'giza',
    description: { en: 'Fresh air and room to move. A welcoming space for the whole community.', ar: 'هواء نقي ومساحة للحركة. مكان يرحب بجميع أفراد المجتمع.' },
    image: '/event-images/venue-riverside.jpg',
  },
]
