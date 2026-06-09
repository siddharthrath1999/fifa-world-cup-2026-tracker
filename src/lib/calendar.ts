import type { Match } from '../types'
import { formatIstDateTimeWithZone } from './time'

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function toIcsStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function matchTitle(match: Match) {
  return `${match.home.shortName} vs ${match.away.shortName} - FIFA World Cup 2026`
}

export function makeCalendar(matches: Match[]) {
  const events = matches
    .map((match) => {
      const start = new Date(match.dateUtc)
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
      const location = `${match.venue.name}, ${match.venue.city}, ${match.venue.country}`
      const description = [
        `Match ${match.matchNumber}: ${match.home.name} vs ${match.away.name}`,
        `${match.stage}${match.group ? `, ${match.group}` : ''}`,
        `Kickoff: ${formatIstDateTimeWithZone(match.dateUtc)}`,
        'Watch in India: ZEE5 and UNITE8 Sports TV channels, subject to subscription and regional availability.',
      ].join('\\n')

      return [
        'BEGIN:VEVENT',
        `UID:fwc2026-${match.id}@codex.local`,
        `DTSTAMP:${toIcsStamp(new Date().toISOString())}`,
        `DTSTART:${toIcsStamp(start.toISOString())}`,
        `DTEND:${toIcsStamp(end.toISOString())}`,
        `SUMMARY:${escapeIcs(matchTitle(match))}`,
        `LOCATION:${escapeIcs(location)}`,
        `DESCRIPTION:${escapeIcs(description)}`,
        'END:VEVENT',
      ].join('\r\n')
    })
    .join('\r\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Codex//FIFA World Cup 2026 Tracker//EN',
    'CALSCALE:GREGORIAN',
    events,
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadCalendar(matches: Match[], filename = 'fifa-world-cup-2026.ics') {
  const blob = new Blob([makeCalendar(matches)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
