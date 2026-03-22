/**
 * Client-side CSV download utility.
 * Generates a CSV from an array of row objects and triggers a browser download.
 */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    value = JSON.stringify(value)
  }
  const str = String(value)
  // Wrap in quotes if the value contains commas, double quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const headerRow = headers.map(escapeCell).join(',')

  const dataRows = rows.map(row =>
    headers.map(header => escapeCell(row[header])).join(',')
  )

  const csv = [headerRow, ...dataRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
