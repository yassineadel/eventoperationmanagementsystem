// CSV export for admin tables (FR-ADM-33). Built in the browser from what the page already
// shows, so it works the same on sample data and on the API.

export type CsvCell = string | number | null | undefined

function cell(value: CsvCell) {
  const text = value == null ? '' : String(value)
  // Quote anything with a comma, quote or line break; a leading = + - @ is kept as text in spreadsheets.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: CsvCell[][]) {
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

/** Saves the rows as a .csv file. The byte-order mark makes Excel read Arabic correctly. */
export function downloadCsv(fileName: string, rows: CsvCell[][]) {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "cairo-jazz-night" from "Cairo Jazz Night", for file names. */
export function slug(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9؀-ۿ]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'export'
  )
}
