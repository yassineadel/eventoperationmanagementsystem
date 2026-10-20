import type { AdminStrings } from './adminStrings'

/** Message handed over by the add / edit / detail pages when they navigate back to the list. */
export type VenueToast = { kind: 'added' | 'saved' | 'deleted' | 'failed'; name: string; id: string }

/** Fills "{name}" in a translated message. */
export function fill(template: string, name: string) {
  return template.replace('{name}', name)
}

export function toastText(t: AdminStrings, toast: VenueToast) {
  if (toast.kind === 'failed') return t.actionFailed
  const template = { added: t.toastAdded, saved: t.toastSaved, deleted: t.toastDeleted }[toast.kind]
  return fill(template, toast.name)
}
