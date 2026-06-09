const IST_TIME_ZONE = 'Asia/Kolkata'

export function formatIstDateTime(iso: string, showZone = false) {
  const date = new Date(iso)
  const weekday = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    weekday: 'short',
  }).format(date)
  const day = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
  }).format(date)
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)

  return `${weekday}, ${day} · ${time}${showZone ? ' IST' : ''}`
}

export function formatIstDateTimeWithZone(iso: string) {
  return formatIstDateTime(iso, true)
}

export function formatIstDateKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export function formatIstDay(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(iso))
}

export function getTodayIstKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function getKickoffDistance(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const days = Math.floor(abs / 86_400_000)
  const hours = Math.floor((abs % 86_400_000) / 3_600_000)
  const minutes = Math.floor((abs % 3_600_000) / 60_000)

  if (diff > 0) {
    if (days > 0) return `in ${days}d ${hours}h`
    if (hours > 0) return `in ${hours}h ${minutes}m`
    return `in ${minutes}m`
  }

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ${minutes}m ago`
  return `${minutes}m ago`
}

export function isSameIstDay(iso: string, dateKey: string) {
  return formatIstDateKey(iso) === dateKey
}
