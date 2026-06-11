import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Filter,
  Heart,
  Info,
  MapPin,
  RefreshCw,
  Search,
  Share2,
  Shield,
  Sparkles,
  Star,
  Table2,
  Trophy,
  Tv,
  Users,
  X,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { downloadCalendar } from './lib/calendar'
import { loadMatchExtras, loadTeamProfile, loadTournamentStats, loadVenueIntel, loadWorldCupData, watchSources } from './lib/sources'
import { buildStandings, getBestThirds } from './lib/standings'
import { formatIstDateKey, formatIstDateTime, formatIstDay, getKickoffDistance, getTodayIstKey } from './lib/time'
import type {
  GroupStanding,
  LiveEvent,
  Match,
  MatchExtras,
  SourceState,
  StandingRow,
  Team,
  TeamPlayer,
  TeamProfile,
  TournamentStats,
  Venue,
  VenueIntel,
  WorldCupData,
} from './types'

type ViewMode = 'hub' | 'matches' | 'stats' | 'groups' | 'bracket' | 'teams' | 'venues'
type QuickFilter = 'all' | 'today' | 'live' | 'upcoming' | 'favorites'
type ShareTarget = 'app' | 'match'
type ShareStatus = {
  state: 'idle' | 'copied' | 'manual'
  target?: ShareTarget
  message?: string
}

const viewIds: ViewMode[] = ['hub', 'matches', 'stats', 'groups', 'bracket', 'teams', 'venues']

function isViewMode(value: string | null): value is ViewMode {
  return valueIdsIncludes(viewIds, value)
}

function valueIdsIncludes<T extends string>(values: T[], value: string | null): value is T {
  return !!value && values.includes(value as T)
}

function getInitialView(): ViewMode {
  if (typeof window === 'undefined') return 'hub'
  const view = new URLSearchParams(window.location.search).get('view')
  return isViewMode(view) ? view : 'hub'
}

function getInitialMatchId() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('match')
}

function getInitialTeamCode() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('team')
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  input.style.top = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(input)
  if (!copied) throw new Error('Clipboard blocked')
}

const blankExtras: MatchExtras = {
  summarySource: {
    id: 'blank',
    label: 'Match summary',
    status: 'degraded',
    detail: 'Select a match to check live match details.',
  },
  events: [],
  stats: [],
  lineups: [],
  playerCards: [],
  form: [],
  headToHead: [],
  broadcasts: [],
}

const blankTournamentStats: TournamentStats = {
  source: {
    id: 'stats',
    label: 'Tournament stats',
    status: 'degraded',
    detail: 'Waiting for tournament data.',
  },
  teamRows: [],
  playerRows: [],
  sourceLinks: [],
  matchesChecked: 0,
  summariesLoaded: 0,
  updatedAt: new Date(0).toISOString(),
}

const blankVenueIntel: VenueIntel = {
  source: {
    id: 'open-meteo-venues',
    label: 'Venue weather',
    status: 'degraded',
    detail: 'Waiting for venue enrichment.',
    href: 'https://open-meteo.com/',
  },
  records: [],
  updatedAt: new Date(0).toISOString(),
}

const WORLD_CUP_2026_LOGO_URL =
  'https://upload.wikimedia.org/wikipedia/en/thumb/1/17/2026_FIFA_World_Cup_emblem.svg/250px-2026_FIFA_World_Cup_emblem.svg.png'

function useLocalFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('fwc26:favorites') ?? '[]') as string[]
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('fwc26:favorites', JSON.stringify(favorites))
  }, [favorites])

  const toggle = useCallback((id: string) => {
    setFavorites((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }, [])

  return { favorites, toggle }
}

function sourceTone(status: SourceState['status']) {
  if (status === 'online') return 'good'
  if (status === 'degraded') return 'warn'
  return 'bad'
}

function formatRefreshTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  if (date.getTime() === 0) return '-'
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
}

function statusTone(status: Match['status']['state']) {
  if (status === 'live' || status === 'halftime') return 'live'
  if (status === 'fulltime') return 'done'
  if (status === 'postponed') return 'bad'
  return 'scheduled'
}

function isKnockout(match: Match) {
  return match.stage !== 'First Stage'
}

function isUpcoming(match: Match) {
  return new Date(match.dateUtc).getTime() > Date.now() && match.status.state === 'scheduled'
}

function isRealTeam(team: Team) {
  if (team.id.startsWith('home-') || team.id.startsWith('away-')) return false
  if (/^(W|L|RU)?\d+$/.test(team.code)) return false
  if (/^[A-L][1-4]$/.test(team.code)) return false
  if (/^[1-4][A-L]$/.test(team.code)) return false
  if (/^3[A-L]+$/.test(team.code)) return false
  return !team.code.startsWith('TBD') && !team.name.toLowerCase().includes('decided')
}

function getTeams(matches: Match[]) {
  const map = new Map<string, Team>()
  for (const match of matches) {
    for (const team of [match.home, match.away]) {
      if (isRealTeam(team)) map.set(team.code, team)
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function getVenues(matches: Match[]) {
  const map = new Map<string, Venue & { matches: number; next?: string }>()
  for (const match of matches) {
    const existing = map.get(match.venue.id)
    if (!existing) {
      map.set(match.venue.id, {
        ...match.venue,
        matches: 1,
        next: match.dateUtc,
      })
      continue
    }
    existing.matches += 1
    if (new Date(match.dateUtc).getTime() < new Date(existing.next ?? match.dateUtc).getTime()) {
      existing.next = match.dateUtc
    }
  }
  return [...map.values()].sort((a, b) => b.matches - a.matches)
}

function groupByDay(matches: Match[]) {
  return matches.reduce<Map<string, Match[]>>((groups, match) => {
    const key = formatIstDateKey(match.dateUtc)
    groups.set(key, [...(groups.get(key) ?? []), match])
    return groups
  }, new Map())
}

function sortByKickoff(matches: Match[]) {
  return [...matches].sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())
}

function getNextWindowMatches(matches: Match[], hours = 24) {
  const now = Date.now()
  const limit = now + hours * 3_600_000
  return sortByKickoff(matches).filter((match) => {
    const kickoff = new Date(match.dateUtc).getTime()
    return kickoff >= now && kickoff <= limit
  })
}

function getFavoriteMatches(matches: Match[], favorites: string[]) {
  const favoriteSet = new Set(favorites)
  return sortByKickoff(matches).filter((match) => favoriteSet.has(match.id))
}

function formatStatValue(value: number | null) {
  return value === null ? '-' : String(value)
}

function openSearchUrl(source: 'fotmob' | 'goal', match: Match) {
  const query = encodeURIComponent(`${match.home.shortName} ${match.away.shortName} World Cup 2026`)
  return source === 'fotmob'
    ? `https://www.fotmob.com/search?q=${query}`
    : `https://www.goal.com/en-us/search?q=${query}`
}

function openTeamSearchUrl(source: 'fotmob' | 'goal', team: Team) {
  const query = encodeURIComponent(`${team.name} World Cup 2026`)
  return source === 'fotmob'
    ? `https://www.fotmob.com/search?q=${query}`
    : `https://www.goal.com/en-us/search?q=${query}`
}

const teamFlagCodes: Record<string, string> = {
  AFG: 'af',
  ALB: 'al',
  ALG: 'dz',
  AND: 'ad',
  ANG: 'ao',
  ARG: 'ar',
  ARM: 'am',
  ARU: 'aw',
  ASA: 'as',
  AUS: 'au',
  AUT: 'at',
  AZE: 'az',
  BAH: 'bs',
  BAN: 'bd',
  BAR: 'bb',
  BDI: 'bi',
  BEL: 'be',
  BEN: 'bj',
  BER: 'bm',
  BFA: 'bf',
  BHR: 'bh',
  BIH: 'ba',
  BLR: 'by',
  BLZ: 'bz',
  BOL: 'bo',
  BOT: 'bw',
  BRA: 'br',
  BRU: 'bn',
  BUL: 'bg',
  CAM: 'kh',
  CAN: 'ca',
  CGO: 'cg',
  CHA: 'td',
  CHI: 'cl',
  CHN: 'cn',
  CIV: 'ci',
  CMR: 'cm',
  COD: 'cd',
  COL: 'co',
  COM: 'km',
  CPV: 'cv',
  CRC: 'cr',
  CRO: 'hr',
  CTA: 'cf',
  CUB: 'cu',
  CUW: 'cw',
  CYP: 'cy',
  CZE: 'cz',
  DEN: 'dk',
  DJI: 'dj',
  DMA: 'dm',
  DOM: 'do',
  ECU: 'ec',
  EGY: 'eg',
  ENG: 'gb-eng',
  EQG: 'gq',
  ERI: 'er',
  ESP: 'es',
  EST: 'ee',
  ETH: 'et',
  FIJ: 'fj',
  FIN: 'fi',
  FRA: 'fr',
  FRO: 'fo',
  GAB: 'ga',
  GAM: 'gm',
  GEO: 'ge',
  GER: 'de',
  GHA: 'gh',
  GIB: 'gi',
  GRE: 'gr',
  GRN: 'gd',
  GUA: 'gt',
  GUI: 'gn',
  GUM: 'gu',
  GUY: 'gy',
  HAI: 'ht',
  HKG: 'hk',
  HON: 'hn',
  HUN: 'hu',
  IDN: 'id',
  IND: 'in',
  IRL: 'ie',
  IRN: 'ir',
  IRQ: 'iq',
  ISL: 'is',
  ISR: 'il',
  ITA: 'it',
  JAM: 'jm',
  JOR: 'jo',
  JPN: 'jp',
  KAZ: 'kz',
  KEN: 'ke',
  KGZ: 'kg',
  KOR: 'kr',
  KSA: 'sa',
  KUW: 'kw',
  LAO: 'la',
  LBN: 'lb',
  LBR: 'lr',
  LBY: 'ly',
  LIE: 'li',
  LTU: 'lt',
  LUX: 'lu',
  LVA: 'lv',
  MAD: 'mg',
  MAR: 'ma',
  MAS: 'my',
  MDA: 'md',
  MDV: 'mv',
  MEX: 'mx',
  MKD: 'mk',
  MLI: 'ml',
  MLT: 'mt',
  MNE: 'me',
  MNG: 'mn',
  MOZ: 'mz',
  MRI: 'mu',
  MTN: 'mr',
  MYA: 'mm',
  NAM: 'na',
  NCA: 'ni',
  NED: 'nl',
  NEP: 'np',
  NGA: 'ng',
  NIR: 'gb-nir',
  NIG: 'ne',
  NOR: 'no',
  NZL: 'nz',
  OMA: 'om',
  PAK: 'pk',
  PAN: 'pa',
  PAR: 'py',
  PER: 'pe',
  PHI: 'ph',
  PLE: 'ps',
  POL: 'pl',
  POR: 'pt',
  PRK: 'kp',
  PUR: 'pr',
  QAT: 'qa',
  ROU: 'ro',
  RSA: 'za',
  RUS: 'ru',
  RWA: 'rw',
  SCO: 'gb-sct',
  SEN: 'sn',
  SEY: 'sc',
  SIN: 'sg',
  SLV: 'sv',
  SMR: 'sm',
  SOL: 'sb',
  SOM: 'so',
  SRB: 'rs',
  SRI: 'lk',
  SSD: 'ss',
  STP: 'st',
  SUD: 'sd',
  SUI: 'ch',
  SUR: 'sr',
  SVK: 'sk',
  SVN: 'si',
  SWE: 'se',
  SWZ: 'sz',
  SYR: 'sy',
  TAH: 'pf',
  TAN: 'tz',
  THA: 'th',
  TJK: 'tj',
  TKM: 'tm',
  TOG: 'tg',
  TPE: 'tw',
  TRI: 'tt',
  TUN: 'tn',
  TUR: 'tr',
  UAE: 'ae',
  UGA: 'ug',
  UKR: 'ua',
  URU: 'uy',
  USA: 'us',
  UZB: 'uz',
  VAN: 'vu',
  VEN: 've',
  VIE: 'vn',
  WAL: 'gb-wls',
  YEM: 'ye',
  ZAM: 'zm',
  ZIM: 'zw',
}

function getTeamFlagUrl(team: Team) {
  const lookupCodes = [team.countryCode, team.code, team.id].filter(Boolean).map((code) => code!.toUpperCase())
  const flagCode = lookupCodes.map((code) => teamFlagCodes[code] ?? (code.length === 2 ? code.toLowerCase() : '')).find(Boolean)
  return flagCode ? `https://flagcdn.com/w80/${flagCode}.png` : null
}

function getTeamImageCandidates(team: Team) {
  const fallbackFlag = getTeamFlagUrl(team)
  return [team.logo, fallbackFlag].filter((url, index, urls): url is string => !!url && urls.indexOf(url) === index)
}

function TeamMarkVisual({ code, imageCandidates }: { code: string; imageCandidates: string[] }) {
  const [imageIndex, setImageIndex] = useState(0)
  const imageUrl = imageCandidates[imageIndex]

  return imageUrl ? (
    <img
      key={imageUrl}
      src={imageUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setImageIndex((currentIndex) => currentIndex + 1)}
    />
  ) : (
    <span>{code.slice(0, 3)}</span>
  )
}

function TeamMark({ team, size = 'md' }: { team: Team; size?: 'sm' | 'md' | 'lg' }) {
  const imageCandidates = getTeamImageCandidates(team)
  const imageKey = imageCandidates.join('|')

  return (
    <span className={`team-mark ${size}`} style={{ '--team-color': `#${team.color ?? '0f8b62'}` } as React.CSSProperties}>
      <TeamMarkVisual key={imageKey} code={team.code} imageCandidates={imageCandidates} />
    </span>
  )
}

function TeamName({
  team,
  align = 'left',
  onTeamSelect,
}: {
  team: Team
  align?: 'left' | 'right'
  onTeamSelect?: (team: Team) => void
}) {
  const content = (
    <>
      <TeamMark team={team} />
      <span>
        <strong>{team.shortName}</strong>
        <small>{team.code}</small>
      </span>
    </>
  )

  if (onTeamSelect) {
    return (
      <button
        className={`team-name team-button ${align}`}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onTeamSelect(team)
        }}
        aria-label={`Open ${team.shortName} nation page`}
      >
        {content}
      </button>
    )
  }

  return <span className={`team-name ${align}`}>{content}</span>
}

function getTeamMatchList(team: Team, matches: Match[]) {
  return matches.filter(
    (match) =>
      match.home.code === team.code ||
      match.away.code === team.code ||
      match.home.id === team.id ||
      match.away.id === team.id,
  )
}

function Score({ match }: { match: Match }) {
  const home = match.homeScore ?? '-'
  const away = match.awayScore ?? '-'
  const penalties =
    match.homePenaltyScore !== null &&
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== null &&
    match.awayPenaltyScore !== undefined
      ? `(${match.homePenaltyScore}-${match.awayPenaltyScore} pens)`
      : null

  return (
    <span className="score">
      <strong>{home}</strong>
      <span>-</span>
      <strong>{away}</strong>
      {penalties ? <small>{penalties}</small> : null}
    </span>
  )
}

function teamAccent(team: Team, fallback: string) {
  return `#${team.color ?? fallback}`
}

function matchStageLabel(match: Match) {
  return match.group ?? match.stage
}

function MatchRow({
  match,
  selected,
  favorite,
  onSelect,
  onFavorite,
  onTeamSelect,
}: {
  match: Match
  selected: boolean
  favorite: boolean
  onSelect: (id: string) => void
  onFavorite: (id: string) => void
  onTeamSelect: (team: Team) => void
}) {
  const kickoffDistance = match.status.state === 'scheduled' ? getKickoffDistance(match.dateUtc) : match.status.label
  const matchStyle = {
    '--home-color': teamAccent(match.home, '0b7a59'),
    '--away-color': teamAccent(match.away, '235a8b'),
  } as React.CSSProperties

  return (
    <article
      className={`match-row ${statusTone(match.status.state)} ${selected ? 'selected' : ''}`}
      data-match-id={match.id}
      style={matchStyle}
      onClick={() => onSelect(match.id)}
    >
      <div className="match-card-head">
        <span className="match-number">M{match.matchNumber}</span>
        <span className={`status-pill ${statusTone(match.status.state)}`}>{match.status.phase ?? match.status.label}</span>
        <span className="match-kickoff">{kickoffDistance}</span>
      </div>
      <div className="match-row-main">
        <div className="match-teams">
          <TeamName team={match.home} onTeamSelect={onTeamSelect} />
          <Score match={match} />
          <TeamName team={match.away} align="right" onTeamSelect={onTeamSelect} />
        </div>
      </div>
      <div className="match-row-meta">
        <span>
          <Clock size={14} />
          {formatIstDateTime(match.dateUtc)}
        </span>
        <span>
          <MapPin size={14} />
          {match.venue.city}
        </span>
        <span>{matchStageLabel(match)}</span>
      </div>
      <button
        className={`icon-button heart ${favorite ? 'active' : ''}`}
        type="button"
        aria-label={favorite ? 'Remove favorite' : 'Add favorite'}
        onClick={(event) => {
          event.stopPropagation()
          onFavorite(match.id)
        }}
      >
        <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}

function SourceHealth({
  sources,
  updatedAt,
  venueIntel,
}: {
  sources: SourceState[]
  updatedAt?: string
  venueIntel: VenueIntel
}) {
  const allSources = venueIntel.records.length ? [...sources, venueIntel.source] : sources
  const online = allSources.filter((source) => source.status === 'online').length
  const degraded = allSources.filter((source) => source.status === 'degraded').length
  const offline = allSources.filter((source) => source.status === 'offline').length
  const enrichedVenues = venueIntel.records.filter((record) => record.latitude !== undefined && record.longitude !== undefined).length

  return (
    <section className="source-dashboard" aria-label="Live data sources">
      <div className="source-dashboard-head">
        <div>
          <span>Source health</span>
          <strong>{online}/{allSources.length || 0} online</strong>
        </div>
        <div className="source-dashboard-metrics">
          <span className="good">{online} online</span>
          <span className="warn">{degraded} degraded</span>
          <span className="bad">{offline} offline</span>
          <span>{formatRefreshTime(updatedAt)} IST</span>
        </div>
      </div>
      <div className="source-strip">
        {allSources.map((source) => {
          const content = (
            <>
              <span className="source-dot" />
              <strong>{source.label}</strong>
              <small>{source.detail}</small>
              <ExternalLink className="source-link-icon" size={14} aria-hidden="true" />
            </>
          )

          return source.href ? (
            <a
              className={`source-chip ${sourceTone(source.status)}`}
              href={source.href}
              target="_blank"
              rel="noreferrer"
              key={source.id}
              aria-label={`Open ${source.label}`}
            >
              {content}
            </a>
          ) : (
            <article className={`source-chip ${sourceTone(source.status)}`} key={source.id}>
              {content}
            </article>
          )
        })}
      </div>
      <div className="source-provenance">
        <span>
          <MapPin size={14} />
          {enrichedVenues}/{venueIntel.records.length || 0} venues enriched
        </span>
        <span>
          <Shield size={14} />
          No unofficial stream sources
        </span>
        <span>
          <RefreshCw size={14} />
          App refreshes every 60 seconds
        </span>
      </div>
    </section>
  )
}

function AvailabilityPanel({
  title,
  icon,
  items,
  unavailable,
}: {
  title: string
  icon: React.ReactNode
  items: React.ReactNode
  unavailable: string
}) {
  return (
    <section className="detail-block">
      <div className="block-title">
        {icon}
        <h3>{title}</h3>
      </div>
      {items || (
        <div className="empty-state">
          <Info size={18} />
          <span>{unavailable}</span>
        </div>
      )}
    </section>
  )
}

function WatchPanel() {
  return (
    <section className="watch-panel">
      <div className="block-title">
        <Tv size={18} />
        <h3>Watch in India</h3>
      </div>
      <p>
        India coverage is listed through ZEE5 streaming and UNITE8 Sports TV channels. Availability may depend on
        subscription, device, and regional packaging.
      </p>
      <div className="link-list">
        {watchSources.map((link) => (
          <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>
            {link.label}
            <ExternalLink size={14} />
          </a>
        ))}
      </div>
      <div className="notice">
        <Shield size={16} />
        Unofficial streams are not listed. They are often unsafe, unreliable, and can violate broadcast rights.
      </div>
    </section>
  )
}

type LineupPlayer = MatchExtras['lineups'][number]['players'][number]

function playerPitchBand(player: LineupPlayer) {
  const position = (player.position ?? '').toLowerCase()
  if (/goal|gk|keeper|^g$/.test(position)) return 'Goalkeeper'
  if (/def|back|^d$|^cb$|^lb$|^rb$/.test(position)) return 'Defenders'
  if (/mid|^m$|^cm$|^dm$|^am$/.test(position)) return 'Midfielders'
  if (/for|fw|att|striker|wing|^f$|^st$/.test(position)) return 'Forwards'
  return 'Squad'
}

function getPitchRows(players: LineupPlayer[]) {
  const starters = players.filter((player) => player.starter !== false)
  const source = starters.length ? starters : players.slice(0, 11)
  const order = ['Goalkeeper', 'Defenders', 'Midfielders', 'Forwards', 'Squad']
  const rows = source.reduce<Map<string, LineupPlayer[]>>((map, player) => {
    const band = playerPitchBand(player)
    map.set(band, [...(map.get(band) ?? []), player])
    return map
  }, new Map())

  return order.map((band) => [band, rows.get(band) ?? []] as const).filter(([, row]) => row.length)
}

function findLineupForTeam(lineups: MatchExtras['lineups'], team: Team) {
  return lineups.find((lineup) => lineup.team.id === team.id || lineup.team.code === team.code)
}

function PitchLineup({ lineup, side }: { lineup: MatchExtras['lineups'][number]; side: 'home' | 'away' }) {
  const rows = getPitchRows(lineup.players)
  const substitutes = lineup.players.filter((player) => player.starter === false)

  return (
    <div className={`pitch-team ${side}`}>
      <div className="pitch-team-label">
        <TeamMark team={lineup.team} size="sm" />
        <strong>{lineup.team.shortName}</strong>
        {lineup.formation ? <small>{lineup.formation}</small> : null}
      </div>
      <div className="pitch-lines">
        {rows.map(([band, players]) => (
          <div className="pitch-line" key={`${lineup.team.id}-${band}`}>
            {players.map((player) => (
              <span className="pitch-player" key={`${lineup.team.id}-${player.id}-${band}`}>
                <b>{player.shirt ?? player.position ?? '-'}</b>
                <small>{player.name}</small>
              </span>
            ))}
          </div>
        ))}
      </div>
      {substitutes.length ? (
        <div className="bench-strip">
          <span>Bench</span>
          <strong>{substitutes.slice(0, 6).map((player) => player.name).join(', ')}</strong>
        </div>
      ) : null}
    </div>
  )
}

function TacticalPitch({
  match,
  lineups,
  loading,
}: {
  match: Match
  lineups: MatchExtras['lineups']
  loading: boolean
}) {
  const homeLineup = findLineupForTeam(lineups, match.home)
  const awayLineup = findLineupForTeam(lineups, match.away)
  const hasLineups = Boolean(homeLineup || awayLineup)

  return (
    <section className="detail-block tactical-panel">
      <div className="block-title">
        <Users size={18} />
        <h3>Tactical pitch</h3>
      </div>
      <div className={`pitch-board ${hasLineups ? 'with-lineups' : 'pending'}`}>
        <div className="pitch-surface">
          <span className="pitch-halfway" />
          <span className="pitch-centre" />
          {hasLineups ? (
            <>
              {homeLineup ? <PitchLineup lineup={homeLineup} side="home" /> : null}
              {awayLineup ? <PitchLineup lineup={awayLineup} side="away" /> : null}
            </>
          ) : (
            <div className="pitch-pending">
              <div>
                <TeamMark team={match.home} size="lg" />
                <strong>{match.home.shortName}</strong>
              </div>
              <span>{loading ? 'Checking lineup feed' : 'Official XI pending'}</span>
              <div>
                <TeamMark team={match.away} size="lg" />
                <strong>{match.away.shortName}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="pitch-note">
        Player positions appear only when the connected live match feed publishes lineups. No projected XI is guessed.
      </p>
    </section>
  )
}

function eventMinutePercent(minute?: string) {
  if (!minute) return 0
  const value = Number(minute.match(/\d+/)?.[0] ?? 0)
  if (!value) return 0
  return Math.max(0, Math.min(100, (value / 120) * 100))
}

function eventTone(event: LiveEvent) {
  const text = `${event.type} ${event.text}`.toLowerCase()
  if (text.includes('goal')) return 'goal'
  if (text.includes('yellow') || text.includes('red') || text.includes('card')) return 'card'
  if (text.includes('substitution') || text.includes('sub')) return 'sub'
  if (/\bvar\b/.test(text) || text.includes('penalty')) return 'review'
  return 'event'
}

function MatchMomentum({
  match,
  events,
  loading,
}: {
  match: Match
  events: LiveEvent[]
  loading: boolean
}) {
  const keyEvents = events.filter((event) => eventTone(event) !== 'event')
  const markers = (keyEvents.length ? keyEvents : events).slice(0, keyEvents.length ? 18 : 8)
  const latestEvents = (keyEvents.length ? keyEvents : events).slice(-3)
  const hasEvents = markers.length > 0
  return (
    <section className="detail-block momentum-panel">
      <div className="block-title">
        <Activity size={18} />
        <h3>Match momentum</h3>
      </div>
      <div className={`momentum-rail ${hasEvents ? 'active' : 'pending'}`}>
        <div className="momentum-teams">
          <span>{match.home.code}</span>
          <span>{match.away.code}</span>
        </div>
        <div className="momentum-track" aria-label="Match event momentum rail">
          <span className="momentum-phase start">KO</span>
          <span className="momentum-phase half">HT</span>
          <span className="momentum-phase full">FT</span>
          {hasEvents ? (
            markers.map((event) => (
              <span
                className={`momentum-marker ${eventTone(event)}`}
                style={{ left: `${eventMinutePercent(event.minute)}%` }}
                key={event.id}
                title={`${event.minute ?? ''} ${event.type}: ${event.text}`}
              >
                <b>{event.minute ?? '--'}</b>
              </span>
            ))
          ) : (
            <strong>{loading ? 'Checking event feed' : match.status.state === 'scheduled' ? 'Events pending kickoff' : 'No event feed yet'}</strong>
          )}
        </div>
        <div className="momentum-legend">
          <span className="goal">Goal</span>
          <span className="card">Card</span>
          <span className="sub">Sub</span>
          <span className="review">VAR / penalty</span>
        </div>
      </div>
      {hasEvents ? (
        <div className="momentum-latest">
          {latestEvents.map((event) => (
            <span key={`latest-${event.id}`}>
              <strong>{event.minute ?? '--'} {event.type}</strong>
              {event.athlete || event.team || event.text}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function MiniMatchCard({
  match,
  onMatchSelect,
  onTeamSelect,
}: {
  match: Match
  onMatchSelect: (matchId: string) => void
  onTeamSelect: (team: Team) => void
}) {
  return (
    <article className="mini-match-card">
      <div>
        <span className={`status-pill ${statusTone(match.status.state)}`}>{match.status.phase ?? match.status.label}</span>
        <strong>{match.home.shortName} vs {match.away.shortName}</strong>
        <small>{formatIstDateTime(match.dateUtc)}</small>
      </div>
      <div className="mini-teams">
        <TeamName team={match.home} onTeamSelect={onTeamSelect} />
        <Score match={match} />
        <TeamName team={match.away} align="right" onTeamSelect={onTeamSelect} />
      </div>
      <button type="button" onClick={() => onMatchSelect(match.id)}>
        Match centre
        <ChevronRight size={15} />
      </button>
    </article>
  )
}

function HubView({
  matches,
  standings,
  favorites,
  sources,
  tournamentStats,
  statsLoading,
  onMatchSelect,
  onTeamSelect,
  onView,
}: {
  matches: Match[]
  standings: GroupStanding[]
  favorites: string[]
  sources: SourceState[]
  tournamentStats: TournamentStats
  statsLoading: boolean
  onMatchSelect: (matchId: string) => void
  onTeamSelect: (team: Team) => void
  onView: (view: ViewMode) => void
}) {
  const nextMatch = sortByKickoff(matches).find(isUpcoming)
  const nextWindow = getNextWindowMatches(matches, 36)
  const favoriteMatches = getFavoriteMatches(matches, favorites).slice(0, 4)
  const liveMatches = matches.filter((match) => match.status.state === 'live' || match.status.state === 'halftime')
  const activeGroups = standings.slice(0, 4)

  return (
    <div className="hub-view">
      <section className="hub-hero">
        <div>
          <span>IST command centre</span>
          <h2>{nextMatch ? `${nextMatch.home.shortName} vs ${nextMatch.away.shortName}` : 'Tournament schedule ready'}</h2>
          <p>
            {nextMatch
              ? `${formatIstDateTime(nextMatch.dateUtc)} · ${nextMatch.venue.city} · ${getKickoffDistance(nextMatch.dateUtc)}`
              : 'Live match windows, source health, favorites and stat readiness appear here.'}
          </p>
        </div>
        <div className="hub-hero-actions">
          {nextMatch ? (
            <button type="button" className="primary-button" onClick={() => onMatchSelect(nextMatch.id)}>
              <Activity size={16} />
              Open next match
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={() => onView('stats')}>
            <Table2 size={16} />
            Stats hub
          </button>
        </div>
      </section>

      <div className="hub-grid">
        <section className="hub-panel wide">
          <div className="block-title">
            <Clock size={18} />
            <h3>Next 36 hours</h3>
          </div>
          {nextWindow.length ? (
            <div className="mini-match-list">
              {nextWindow.slice(0, 4).map((match) => (
                <MiniMatchCard
                  match={match}
                  key={match.id}
                  onMatchSelect={onMatchSelect}
                  onTeamSelect={onTeamSelect}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>No kickoffs in the next 36 hours. Use Matches for the full schedule.</span>
            </div>
          )}
        </section>

        <section className="hub-panel">
          <div className="block-title">
            <Heart size={18} />
            <h3>Favorites</h3>
          </div>
          {favoriteMatches.length ? (
            <div className="compact-list">
              {favoriteMatches.map((match) => (
                <button type="button" key={match.id} onClick={() => onMatchSelect(match.id)}>
                  <strong>{match.home.code} vs {match.away.code}</strong>
                  <small>{formatIstDateTime(match.dateUtc)}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>Tap the heart on matches you want to follow.</span>
            </div>
          )}
        </section>

        <section className="hub-panel">
          <div className="block-title">
            <Activity size={18} />
            <h3>Live and stats readiness</h3>
          </div>
          <div className="readiness-grid">
            <div>
              <span>Live now</span>
              <strong>{liveMatches.length}</strong>
            </div>
            <div>
              <span>Summaries</span>
              <strong>{statsLoading ? '-' : `${tournamentStats.summariesLoaded}/${tournamentStats.matchesChecked}`}</strong>
            </div>
            <div>
              <span>Player rows</span>
              <strong>{statsLoading ? '-' : tournamentStats.playerRows.length}</strong>
            </div>
            <div>
              <span>Team rows</span>
              <strong>{statsLoading ? '-' : tournamentStats.teamRows.filter((row) => row.played).length}</strong>
            </div>
          </div>
          <div className={`source-note ${sourceTone(tournamentStats.source.status)}`}>
            {statsLoading ? <RefreshCw size={15} className="spin" /> : <Info size={15} />}
            {statsLoading ? 'Checking tournament stat feeds...' : tournamentStats.source.detail}
          </div>
        </section>

        <section className="hub-panel">
          <div className="block-title">
            <Shield size={18} />
            <h3>Source health</h3>
          </div>
          <div className="compact-source-list">
            {sources.map((source) => (
              <a href={source.href} target="_blank" rel="noreferrer" className={sourceTone(source.status)} key={source.id}>
                <strong>{source.label}</strong>
                <small>{source.detail}</small>
              </a>
            ))}
          </div>
        </section>

        <section className="hub-panel wide">
          <div className="block-title">
            <Trophy size={18} />
            <h3>Group snapshot</h3>
          </div>
          <div className="group-snapshot">
            {activeGroups.map((group) => (
              <div key={group.group}>
                <strong>{group.group}</strong>
                {group.rows.slice(0, 3).map((row) => (
                  <button type="button" key={row.team.id} onClick={() => onTeamSelect(row.team)}>
                    <TeamMark team={row.team} size="sm" />
                    <span>{row.team.shortName}</span>
                    <small>{row.points} pts</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function DetailView({
  match,
  extras,
  extrasLoading,
  onDownloadOne,
  onShare,
  shareStatus,
  onTeamSelect,
  variant = 'side',
}: {
  match?: Match
  extras: MatchExtras
  extrasLoading: boolean
  onDownloadOne: (match: Match) => void
  onShare?: (match: Match) => void
  shareStatus?: ShareStatus
  onTeamSelect: (team: Team) => void
  variant?: 'side' | 'inline'
}) {
  const panelClassName = `detail-panel ${variant}`

  if (!match) {
    return (
      <aside className={`${panelClassName} empty-detail`}>
        <Sparkles size={24} />
        <h2>Select a match</h2>
        <p>Line-ups, live status, stats, watch links, reminders, and match links appear here.</p>
      </aside>
    )
  }

  const timeline = extras.events.length ? (
    <ol className="timeline">
      {extras.events.map((event) => (
        <li key={event.id}>
          <time>{event.minute ?? '--'}</time>
          <div>
            <strong>{event.type}</strong>
            <span>{event.text}</span>
            {event.athlete ? <small>{event.athlete}</small> : null}
          </div>
        </li>
      ))}
    </ol>
  ) : null

  const stats = extras.stats.length ? (
    <div className="stats-list">
      {extras.stats.slice(0, 12).map((stat) => (
        <div key={stat.label}>
          <strong>{stat.home}</strong>
          <span>{stat.label}</span>
          <strong>{stat.away}</strong>
        </div>
      ))}
    </div>
  ) : null

  const lineups = extras.lineups.length ? (
    <div className="lineup-grid">
      {extras.lineups.map((lineup) => {
        const starters = lineup.players.filter((player) => player.starter !== false)
        const substitutes = lineup.players.filter((player) => player.starter === false)
        const fallbackSquad = starters.length ? [] : lineup.players
        const renderPlayer = (player: LineupPlayer, role: 'starter' | 'substitute' | 'squad') => (
          <span className={`lineup-player ${role}`} key={`${lineup.team.id}-${player.id}-${role}`}>
            <b>{player.shirt ?? '-'}</b>
            <em>{player.name}</em>
            {player.position ? <small>{player.position}</small> : null}
          </span>
        )

        return (
          <div className="lineup-team-card" key={lineup.team.id}>
            <h4>
              {lineup.team.shortName}
              {lineup.formation ? <small>{lineup.formation}</small> : null}
            </h4>
            {starters.length ? (
              <div className="lineup-section">
                <h5>Starting XI</h5>
                {starters.map((player) => renderPlayer(player, 'starter'))}
              </div>
            ) : null}
            {substitutes.length ? (
              <div className="lineup-section">
                <h5>Substitutes</h5>
                {substitutes.map((player) => renderPlayer(player, 'substitute'))}
              </div>
            ) : null}
            {fallbackSquad.length ? (
              <div className="lineup-section">
                <h5>Squad</h5>
                {fallbackSquad.map((player) => renderPlayer(player, 'squad'))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  ) : null

  const cards = extras.playerCards.length ? (
    <div className="mini-list">
      {extras.playerCards.map((card) => (
        <span key={card.id}>
          <strong>{card.name}</strong>
          {card.team} - {card.detail}
        </span>
      ))}
    </div>
  ) : null
  const broadcasts = extras.broadcasts.length ? (
    <div className="tag-list">
      {[...new Set(extras.broadcasts)].map((broadcast) => (
        <span key={broadcast}>{broadcast}</span>
      ))}
    </div>
  ) : null
  const form = extras.form.length ? (
    <div className="form-list">
      {extras.form.map((item) => (
        <span key={item.team.id}>
          <TeamMark team={item.team} size="sm" />
          <strong>{item.team.shortName}</strong>
          <small>{item.recent.join(' ')}</small>
        </span>
      ))}
    </div>
  ) : null
  const headToHead = extras.headToHead.length ? (
    <div className="link-list">
      {extras.headToHead.slice(0, 5).map((link) => (
        <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>
          {link.label}
          <ExternalLink size={14} />
        </a>
      ))}
    </div>
  ) : null
  const detailedSources = (
    <div className="link-list">
      <a href={openSearchUrl('fotmob', match)} target="_blank" rel="noreferrer">
        FotMob match stats and ratings
        <ExternalLink size={14} />
      </a>
      <a href={openSearchUrl('goal', match)} target="_blank" rel="noreferrer">
        GOAL match centre and reaction
        <ExternalLink size={14} />
      </a>
    </div>
  )

  return (
    <aside className={panelClassName}>
      <div className="detail-header">
        <div>
          <span className={`status-pill ${statusTone(match.status.state)}`}>{match.status.phase ?? match.status.label}</span>
          <h2>
            {match.home.shortName} vs {match.away.shortName}
          </h2>
          <p>{match.stage}{match.group ? ` - ${match.group}` : ''}</p>
        </div>
        <div className="detail-actions">
          {onShare ? (
            <button
              className={`icon-button ${shareStatus?.state === 'copied' && shareStatus.target === 'match' ? 'success' : ''}`}
              type="button"
              onClick={() => onShare(match)}
              aria-label="Copy match link"
              title="Copy match link"
            >
              {shareStatus?.state === 'copied' && shareStatus.target === 'match' ? <Check size={18} /> : <Share2 size={18} />}
            </button>
          ) : null}
          <button className="icon-button" type="button" onClick={() => onDownloadOne(match)} aria-label="Download calendar event" title="Download calendar event">
            <Calendar size={19} />
          </button>
        </div>
      </div>

      <section className="scoreboard">
        <TeamName team={match.home} onTeamSelect={onTeamSelect} />
        <Score match={match} />
        <TeamName team={match.away} align="right" onTeamSelect={onTeamSelect} />
      </section>

      <div className="detail-facts">
        <span>
          <Clock size={15} />
          {formatIstDateTime(match.dateUtc)}
        </span>
        <span>
          <MapPin size={15} />
          {match.venue.name}, {match.venue.city}
        </span>
        <span>
          <Activity size={15} />
          {match.status.label}
          {match.status.clock ? ` - ${match.status.clock}` : ''}
        </span>
      </div>

      <div className={`source-note ${sourceTone(extras.summarySource.status)}`}>
        {extrasLoading ? <RefreshCw size={15} className="spin" /> : <Info size={15} />}
        {extrasLoading ? 'Checking match detail feed...' : extras.summarySource.detail}
      </div>

      <MatchMomentum match={match} events={extras.events} loading={extrasLoading} />
      <AvailabilityPanel
        title="Live timeline"
        icon={<Activity size={18} />}
        items={timeline}
        unavailable="No timeline events have been published for this match yet."
      />
      <TacticalPitch match={match} lineups={extras.lineups} loading={extrasLoading} />
      <AvailabilityPanel
        title="Line-up list"
        icon={<Users size={18} />}
        items={lineups}
        unavailable="Line-ups are not available yet. They usually appear close to kickoff."
      />
      <AvailabilityPanel
        title="Stats"
        icon={<Table2 size={18} />}
        items={stats}
        unavailable="Team stats, possession, shots, and xG are not available for this match yet."
      />
      <AvailabilityPanel
        title="Cards and player notes"
        icon={<AlertTriangle size={18} />}
        items={cards}
        unavailable="No player cards or player notes are available yet."
      />
      <AvailabilityPanel
        title="Broadcast feed"
        icon={<Tv size={18} />}
        items={broadcasts}
        unavailable="Broadcast metadata has not been published for this match yet."
      />
      <AvailabilityPanel
        title="Form and head-to-head"
        icon={<Star size={18} />}
        items={
          form || headToHead ? (
            <div className="stacked-mini">
              {form}
              {headToHead}
            </div>
          ) : null
        }
        unavailable="Recent form and head-to-head links are not available yet."
      />
      <AvailabilityPanel
        title="Detailed stat sources"
        icon={<ExternalLink size={18} />}
        items={detailedSources}
        unavailable="Detailed stat source links are not available."
      />

      <section className="detail-block">
        <div className="block-title">
          <ExternalLink size={18} />
          <h3>Official links</h3>
        </div>
        <div className="link-list">
          {match.links.map((link) => (
            <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>
              {link.label}
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </section>

      <WatchPanel />
    </aside>
  )
}

function StandingsTable({ group, onTeamSelect }: { group: GroupStanding; onTeamSelect: (team: Team) => void }) {
  return (
    <section className="standings-table">
      <div className="table-header">
        <h3>{group.group}</h3>
        <span>Top 2 advance; best 8 third-place teams also advance</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>GP</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row, index) => (
            <tr key={row.team.id} className={index < 2 ? 'advance' : index === 2 ? 'third' : ''}>
              <td>
                <button className="standings-team" type="button" onClick={() => onTeamSelect(row.team)}>
                  <TeamMark team={row.team} size="sm" />
                  {row.team.shortName}
                </button>
              </td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.drawn}</td>
              <td>{row.lost}</td>
              <td>{row.goalsFor}</td>
              <td>{row.goalsAgainst}</td>
              <td>{row.goalDifference}</td>
              <td>
                <strong>{row.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function BestThirds({ rows, onTeamSelect }: { rows: StandingRow[]; onTeamSelect: (team: Team) => void }) {
  return (
    <section className="thirds-panel">
      <div className="block-title">
        <Star size={18} />
        <h3>Best third-place race</h3>
      </div>
      <div className="thirds-list">
        {rows.map((row, index) => (
          <button
            type="button"
            key={`${row.group}-${row.team.id}`}
            className={index < 8 ? 'inside' : ''}
            onClick={() => onTeamSelect(row.team)}
          >
            <strong>{index + 1}</strong>
            <TeamMark team={row.team} size="sm" />
            {row.team.shortName}
            <small>{row.group} - {row.points} pts</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function StatsView({
  stats,
  loading,
  matches,
  onMatchSelect,
  onTeamSelect,
}: {
  stats: TournamentStats
  loading: boolean
  matches: Match[]
  onMatchSelect: (matchId: string) => void
  onTeamSelect: (team: Team) => void
}) {
  const playedRows = stats.teamRows.filter(
    (row) => row.played || row.goalsFor || row.goalsAgainst || row.shots !== null || row.shotsOnTarget !== null,
  )
  const playerRows = stats.playerRows.filter(
    (row) => row.goals || row.assists || row.yellowCards || row.redCards || row.appearances || row.rating,
  )
  const liveOrCompleted = sortByKickoff(matches)
    .filter((match) => match.status.state === 'live' || match.status.state === 'halftime' || match.status.state === 'fulltime')
    .slice(-6)
    .reverse()

  return (
    <div className="stats-view">
      <section className="stats-hero">
        <div>
          <span>Live stat hub</span>
          <h2>Player and team leaders</h2>
          <p>{loading ? 'Checking live match summaries...' : stats.source.detail}</p>
        </div>
        <div className="stat-source-actions">
          {stats.sourceLinks.map((link) => (
            <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>
              {link.label}
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </section>

      <div className="stats-grid">
        <section className="stats-panel wide">
          <div className="block-title">
            <Table2 size={18} />
            <h3>Team leaderboard</h3>
          </div>
          {playedRows.length ? (
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>GP</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>GD</th>
                  <th>CS</th>
                  <th>Shots</th>
                  <th>SOT</th>
                  <th>Poss</th>
                </tr>
              </thead>
              <tbody>
                {playedRows.slice(0, 16).map((row) => (
                  <tr key={row.team.id}>
                    <td>
                      <button className="standings-team" type="button" onClick={() => onTeamSelect(row.team)}>
                        <TeamMark team={row.team} size="sm" />
                        {row.team.shortName}
                      </button>
                    </td>
                    <td>{row.played}</td>
                    <td>{row.goalsFor}</td>
                    <td>{row.goalsAgainst}</td>
                    <td>{row.goalDifference}</td>
                    <td>{row.cleanSheets}</td>
                    <td>{formatStatValue(row.shots)}</td>
                    <td>{formatStatValue(row.shotsOnTarget)}</td>
                    <td>{row.possessionAverage === null ? '-' : `${row.possessionAverage}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>Team leaderboards will populate after live or completed matches publish stat rows.</span>
            </div>
          )}
        </section>

        <section className="stats-panel">
          <div className="block-title">
            <Trophy size={18} />
            <h3>Goal leaders</h3>
          </div>
          {playerRows.some((row) => row.goals) ? (
            <div className="leader-list">
              {playerRows.filter((row) => row.goals).slice(0, 10).map((row, index) => (
                <span key={row.id}>
                  <strong>{index + 1}</strong>
                  <span>{row.name}<small>{row.team}</small></span>
                  <b>{row.goals}</b>
                </span>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>Goal scorers appear once event feeds publish goals.</span>
            </div>
          )}
        </section>

        <section className="stats-panel">
          <div className="block-title">
            <Users size={18} />
            <h3>Appearances and cards</h3>
          </div>
          {playerRows.length ? (
            <div className="leader-list">
              {playerRows.slice(0, 10).map((row, index) => (
                <span key={row.id}>
                  <strong>{index + 1}</strong>
                  <span>{row.name}<small>{row.team}</small></span>
                  <b>{row.appearances || row.yellowCards + row.redCards}</b>
                </span>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>Player rows appear when lineup, card, and event feeds are released.</span>
            </div>
          )}
        </section>

        <section className="stats-panel">
          <div className="block-title">
            <Star size={18} />
            <h3>Player ratings</h3>
          </div>
          <div className="empty-state">
            <Info size={18} />
            <span>
              Ratings from FotMob or GOAL need a compliant adapter. Direct browser scraping is not enabled in this
              static app.
            </span>
          </div>
        </section>

        <section className="stats-panel wide">
          <div className="block-title">
            <Activity size={18} />
            <h3>Matches feeding the stats hub</h3>
          </div>
          {liveOrCompleted.length ? (
            <div className="compact-list stat-match-list">
              {liveOrCompleted.map((match) => (
                <button type="button" key={match.id} onClick={() => onMatchSelect(match.id)}>
                  <strong>{match.home.code} vs {match.away.code}</strong>
                  <small>{match.status.label} · {formatIstDateTime(match.dateUtc)}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>No live or completed matches are available yet.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function GroupsView({ standings, onTeamSelect }: { standings: GroupStanding[]; onTeamSelect: (team: Team) => void }) {
  return (
    <div className="view-stack">
      <section className="info-band">
        <CheckCircle2 size={18} />
        <span>
          Standings are calculated from the match results loaded into this app. Tiebreakers use points, goal difference,
          goals scored, then team name until head-to-head and fair-play data appear.
        </span>
      </section>
      <BestThirds rows={getBestThirds(standings)} onTeamSelect={onTeamSelect} />
      <div className="standings-grid">
        {standings.map((group) => (
          <StandingsTable group={group} key={group.group} onTeamSelect={onTeamSelect} />
        ))}
      </div>
    </div>
  )
}

function BracketView({ matches }: { matches: Match[] }) {
  const rounds = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Play-off for third place', 'Final']
  return (
    <div className="bracket-board">
      {rounds.map((round) => {
        const roundMatches = matches.filter((match) => match.stage === round)
        return (
          <section className="bracket-column" key={round}>
            <h3>{round}</h3>
            {roundMatches.map((match) => (
              <div className="bracket-match" key={match.id}>
                <span>M{match.matchNumber}</span>
                <strong>{match.home.shortName}</strong>
                <strong>{match.away.shortName}</strong>
                <small>{formatIstDateTime(match.dateUtc)}</small>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

function playerInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function groupRoster(players: TeamPlayer[]) {
  const order = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
  const groups = players.reduce<Map<string, TeamPlayer[]>>((map, player) => {
    const key = player.position ?? 'Squad'
    map.set(key, [...(map.get(key) ?? []), player])
    return map
  }, new Map())

  return [...groups.entries()].sort(([a], [b]) => {
    const aIndex = order.indexOf(a)
    const bIndex = order.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
}

function ProfilePhoto({
  src,
  fallback,
  className,
}: {
  src?: string
  fallback: string
  className: string
}) {
  return (
    <span className={className}>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
            const fallbackNode = event.currentTarget.nextElementSibling
            if (fallbackNode instanceof HTMLElement) fallbackNode.hidden = false
          }}
        />
      ) : null}
      <span hidden={Boolean(src)}>{fallback}</span>
    </span>
  )
}

function PlayerCard({ player, onSelect }: { player: TeamPlayer; onSelect: (player: TeamPlayer) => void }) {
  const photoSource = player.links.find((link) => link.type === 'image-source')
  return (
    <article className="player-card">
      <button className="player-card-main" type="button" onClick={() => onSelect(player)}>
        <ProfilePhoto src={player.headshot} fallback={playerInitials(player.name)} className="profile-photo player-photo" />
        <div>
          <strong>{player.jersey ? `#${player.jersey} ${player.name}` : player.name}</strong>
          <span>
            {[player.position, player.age ? `${player.age} yrs` : undefined, player.status].filter(Boolean).join(' - ') ||
              'Squad details pending'}
          </span>
        </div>
        <ChevronRight size={15} />
      </button>
      {photoSource ? (
        <a
          className="photo-source-link"
          href={photoSource.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${player.name} photo source`}
          title="Photo source"
        >
          <ExternalLink size={13} />
        </a>
      ) : null}
      {player.injuries.length ? <small>Injury note</small> : null}
    </article>
  )
}

function PlayerSpotlight({
  player,
  team,
  onClose,
}: {
  player: TeamPlayer
  team: Team
  onClose: () => void
}) {
  const photoSource = player.links.find((link) => link.type === 'image-source')
  const publicLinks = player.links.filter((link) => link.type !== 'image-source')
  const facts = [
    ['Role', player.position],
    ['Age', player.age ? `${player.age} yrs` : undefined],
    ['Height', player.height],
    ['Weight', player.weight],
    ['Status', player.status],
    ['Jersey', player.jersey ? `#${player.jersey}` : undefined],
  ].filter(([, value]) => value)

  return (
    <div className="player-sheet-overlay" role="presentation" onClick={onClose}>
      <section
        className="player-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name} player profile`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="icon-button sheet-close" type="button" onClick={onClose} aria-label="Close player profile">
          <X size={18} />
        </button>
        <div className="player-sheet-hero" style={{ '--team-accent': teamAccent(team, '0b7a59') } as React.CSSProperties}>
          <ProfilePhoto src={player.headshot} fallback={playerInitials(player.name)} className="profile-photo spotlight-photo" />
          <div>
            <span>{team.name}</span>
            <h2>{player.name}</h2>
            <p>{[player.position, player.jersey ? `#${player.jersey}` : undefined].filter(Boolean).join(' - ') || 'Squad member'}</p>
          </div>
        </div>
        <div className="player-fact-grid">
          {facts.length ? (
            facts.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))
          ) : (
            <div>
              <span>Profile</span>
              <strong>Details pending</strong>
            </div>
          )}
        </div>
        <section className="player-sheet-block">
          <div className="block-title">
            <AlertTriangle size={18} />
            <h3>Availability</h3>
          </div>
          {player.injuries.length ? (
            <div className="injury-list">
              {player.injuries.map((injury) => (
                <span key={injury}>
                  <strong>{injury}</strong>
                </span>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>No injury note is published for this player in the connected roster feed.</span>
            </div>
          )}
        </section>
        <section className="player-sheet-block">
          <div className="block-title">
            <ExternalLink size={18} />
            <h3>Profile links</h3>
          </div>
          {publicLinks.length || photoSource ? (
            <div className="link-list">
              {publicLinks.slice(0, 4).map((link) => (
                <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>
                  {link.label}
                  <ExternalLink size={14} />
                </a>
              ))}
              {photoSource ? (
                <a href={photoSource.href} target="_blank" rel="noreferrer">
                  {photoSource.label}
                  <ExternalLink size={14} />
                </a>
              ) : null}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>No public player links are published by the connected feed yet.</span>
            </div>
          )}
        </section>
      </section>
    </div>
  )
}

function StaffCard({ member }: { member: NonNullable<TeamProfile['staff']>[number] }) {
  const photoSource = member.links?.find((link) => link.type === 'image-source')
  return (
    <article className="staff-card">
      <ProfilePhoto src={member.headshot} fallback={playerInitials(member.name)} className="profile-photo staff-photo" />
      <div>
        <strong>{member.name}</strong>
        <small>{member.role ?? 'Staff'}</small>
      </div>
      {photoSource ? (
        <a
          className="photo-source-link staff-source-link"
          href={photoSource.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${member.name} photo source`}
          title="Photo source"
        >
          <ExternalLink size={13} />
        </a>
      ) : null}
    </article>
  )
}

function TeamProfilePanel({
  team,
  matches,
  profile,
  loading,
  onTeamFilter,
  onMatchSelect,
}: {
  team: Team
  matches: Match[]
  profile: TeamProfile | null
  loading: boolean
  onTeamFilter: (team: string) => void
  onMatchSelect: (matchId: string) => void
}) {
  const activeProfile = profile?.team.code === team.code || profile?.team.id === team.id ? profile : null
  const roster = activeProfile?.roster ?? []
  const staff = activeProfile?.staff ?? []
  const injuries = activeProfile?.injuries ?? []
  const updates = activeProfile?.updates ?? []
  const links = activeProfile?.links ?? team.links ?? []
  const photoCoverage = activeProfile?.photoCoverage
  const squadWatch = roster
    .filter((player) => player.headshot || /forward|midfielder|goalkeeper/i.test(player.position ?? ''))
    .slice(0, 4)
  const fixtures = getTeamMatchList(team, matches).sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())
  const group = fixtures.find((match) => match.group)?.group
  const source = activeProfile?.source ?? {
    id: 'team-profile-loading',
    label: 'Team profile',
    status: 'degraded',
    detail: loading ? 'Loading team profile...' : 'Select a nation to load team details.',
  } satisfies SourceState
  const profileTeam = activeProfile?.team ?? team
  const [spotlight, setSpotlight] = useState<{ teamCode: string; player: TeamPlayer } | null>(null)
  const spotlightPlayer = spotlight?.teamCode === profileTeam.code ? spotlight.player : null

  return (
    <section className="team-profile">
      <div
        className="team-profile-hero"
        style={{ '--team-accent': `#${profileTeam.color ?? '0f8b62'}` } as React.CSSProperties}
      >
        <TeamMark team={profileTeam} size="lg" />
        <div>
          <span>{group ?? 'World Cup squad'}</span>
          <h2>{profileTeam.name}</h2>
          <p>{activeProfile?.standingSummary ?? `${fixtures.length} scheduled matches`}</p>
        </div>
        <button type="button" onClick={() => onTeamFilter(team.code)}>
          View fixtures
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="team-profile-metrics">
        <div>
          <span>Record</span>
          <strong>{activeProfile?.record ?? 'Not started'}</strong>
        </div>
        <div>
          <span>Roster</span>
          <strong>{roster.length || '-'}</strong>
        </div>
        <div>
          <span>Injuries</span>
          <strong>{injuries.length}</strong>
        </div>
        <div>
          <span>Photos</span>
          <strong>{photoCoverage ? `${photoCoverage.playerPhotos}/${photoCoverage.players}` : '-'}</strong>
        </div>
        <div>
          <span>Staff</span>
          <strong>{staff.length || '-'}</strong>
        </div>
      </div>

      <div className={`source-note ${sourceTone(source.status)}`}>
        {loading ? <RefreshCw size={15} className="spin" /> : <Info size={15} />}
        {source.detail}
      </div>

      <div className="team-profile-grid">
        <section className="team-section roster-section">
          <div className="block-title">
            <Users size={18} />
            <h3>Players and squad</h3>
          </div>
          {roster.length ? (
            <div className="roster-groups">
              {groupRoster(roster).map(([position, players]) => (
                <div key={position}>
                  <h4>{position}</h4>
                  <div className="player-grid">
                    {players.map((player) => (
                      <PlayerCard
                        player={player}
                        key={player.id}
                        onSelect={(selectedPlayer) => setSpotlight({ teamCode: profileTeam.code, player: selectedPlayer })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>Roster has not been published by the current free team feed yet.</span>
            </div>
          )}
          <p className="team-note">Match substitutes are published inside live line-ups when a match feed releases them.</p>
        </section>

        <section className="team-section">
          <div className="block-title">
            <Shield size={18} />
            <h3>Coach and staff</h3>
          </div>
          {staff.length ? (
            <div className="staff-list">
              {staff.map((member) => (
                <StaffCard member={member} key={member.id} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>Coach and manager details are not published by the current roster feed yet.</span>
            </div>
          )}
        </section>

        <section className="team-section">
          <div className="block-title">
            <AlertTriangle size={18} />
            <h3>Injuries</h3>
          </div>
          {injuries.length ? (
            <div className="injury-list">
              {injuries.map((player) => (
                <span key={player.id}>
                  <strong>{player.name}</strong>
                  <small>{player.injuries.join(', ')}</small>
                </span>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>No injury notes are published for this squad in the roster feed.</span>
            </div>
          )}
        </section>

        <section className="team-section">
          <div className="block-title">
            <Activity size={18} />
            <h3>Live updates and squad changes</h3>
          </div>
          {updates.length ? (
            <ol className="update-list">
              {updates.map((update) => (
                <li key={update.id}>
                  <strong>{update.label}: </strong>
                  <span>{update.detail}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>No squad-change notes have been published by the free team feed yet.</span>
            </div>
          )}
        </section>

        <section className="team-section">
          <div className="block-title">
            <Calendar size={18} />
            <h3>Team fixtures</h3>
          </div>
          <div className="team-fixtures">
            {fixtures.slice(0, 6).map((match) => (
              <button type="button" key={match.id} onClick={() => onMatchSelect(match.id)}>
                <span>M{match.matchNumber}</span>
                <strong>{match.home.code} vs {match.away.code}</strong>
                <small>{formatIstDateTime(match.dateUtc)}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="team-section">
          <div className="block-title">
            <Star size={18} />
            <h3>Squad watch</h3>
          </div>
          {squadWatch.length ? (
            <div className="watch-player-list">
              {squadWatch.map((player) => (
                <span key={player.id}>
                  <ProfilePhoto src={player.headshot} fallback={playerInitials(player.name)} className="profile-photo mini-photo" />
                  <strong>{player.name}</strong>
                  <small>{[player.position, player.status].filter(Boolean).join(' - ') || 'Squad member'}</small>
                </span>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>Squad watch appears when roster images or position data are available.</span>
            </div>
          )}
        </section>

        <section className="team-section">
          <div className="block-title">
            <ExternalLink size={18} />
            <h3>Detailed team stats</h3>
          </div>
          <div className="link-list">
            <a href={openTeamSearchUrl('fotmob', profileTeam)} target="_blank" rel="noreferrer">
              FotMob squad and player ratings
              <ExternalLink size={14} />
            </a>
            <a href={openTeamSearchUrl('goal', profileTeam)} target="_blank" rel="noreferrer">
              GOAL team news and match ratings
              <ExternalLink size={14} />
            </a>
          </div>
        </section>

        <section className="team-section">
          <div className="block-title">
            <ExternalLink size={18} />
            <h3>Official media links</h3>
          </div>
          {links.length ? (
            <div className="link-list">
              {links.slice(0, 6).map((link) => (
                <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>
                  {link.label}
                  <ExternalLink size={14} />
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Info size={18} />
              <span>No official team media links are currently published by the connected feeds.</span>
            </div>
          )}
        </section>
      </div>
      {spotlightPlayer ? <PlayerSpotlight player={spotlightPlayer} team={profileTeam} onClose={() => setSpotlight(null)} /> : null}
    </section>
  )
}

function TeamsView({
  teams,
  matches,
  selectedTeamCode,
  teamProfile,
  teamProfileLoading,
  onTeamFilter,
  onTeamSelect,
  onMatchSelect,
}: {
  teams: Team[]
  matches: Match[]
  selectedTeamCode: string | null
  teamProfile: TeamProfile | null
  teamProfileLoading: boolean
  onTeamFilter: (team: string) => void
  onTeamSelect: (team: Team) => void
  onMatchSelect: (matchId: string) => void
}) {
  const selectedTeam = teams.find((team) => team.code === selectedTeamCode) ?? teams[0]

  if (!selectedTeam) {
    return (
      <section className="loading-panel">
        <Users size={22} />
        <h2>No teams loaded yet</h2>
        <p>Team pages appear once the live schedule feed returns nations.</p>
      </section>
    )
  }

  return (
    <div className="teams-layout">
      <aside className="team-directory" aria-label="Nations">
        {teams.map((team) => {
          const fixtures = getTeamMatchList(team, matches)
          const group = fixtures.find((match) => match.group)?.group
          return (
            <button
              type="button"
              className={selectedTeam.code === team.code ? 'active' : ''}
              key={team.code}
              onClick={() => onTeamSelect(team)}
            >
              <TeamMark team={team} size="sm" />
              <span>
                <strong>{team.shortName}</strong>
                <small>{team.code}{group ? ` - ${group}` : ''}</small>
              </span>
              <em>{fixtures.length}</em>
            </button>
          )
        })}
      </aside>
      <TeamProfilePanel
        team={selectedTeam}
        matches={matches}
        profile={teamProfile}
        loading={teamProfileLoading}
        onTeamFilter={onTeamFilter}
        onMatchSelect={onMatchSelect}
      />
    </div>
  )
}

function formatWeather(record?: VenueIntel['records'][number]) {
  if (!record?.weather) return 'Weather pending'
  return [
    record.weather.temperatureC !== undefined ? `${Math.round(record.weather.temperatureC)}°C` : undefined,
    record.weather.label,
    record.weather.windKph !== undefined ? `${Math.round(record.weather.windKph)} km/h wind` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
}

function getVenuePinPosition(record: VenueIntel['records'][number], records: VenueIntel['records']) {
  const plotted = records.filter((item) => item.latitude !== undefined && item.longitude !== undefined)
  const lats = plotted.map((item) => item.latitude as number)
  const lons = plotted.map((item) => item.longitude as number)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const latRange = maxLat - minLat || 1
  const lonRange = maxLon - minLon || 1
  const x = (((record.longitude as number) - minLon) / lonRange) * 84 + 8
  const y = (1 - (((record.latitude as number) - minLat) / latRange)) * 72 + 14
  return { left: `${x}%`, top: `${y}%` }
}

function VenuesView({
  venues,
  matches,
  venueIntel,
  loading,
}: {
  venues: ReturnType<typeof getVenues>
  matches: Match[]
  venueIntel: VenueIntel
  loading: boolean
}) {
  const intelByVenue = new Map(venueIntel.records.map((record) => [record.venueId, record]))
  const plottedRecords = venueIntel.records.filter((record) => record.latitude !== undefined && record.longitude !== undefined)
  const nextVenue = venues.find((venue) => venue.next)

  return (
    <div className="venues-view">
      <section className="venue-map-panel">
        <div className="venue-map-copy">
          <span>Host city map</span>
          <h2>{plottedRecords.length ? `${plottedRecords.length} venues plotted` : 'Venue map loading'}</h2>
          <p>{loading ? 'Connecting venue coordinates and weather...' : venueIntel.source.detail}</p>
        </div>
        <div className="venue-map" aria-label="World Cup host venue map">
          <span className="map-region canada">Canada</span>
          <span className="map-region usa">United States</span>
          <span className="map-region mexico">Mexico</span>
          {plottedRecords.map((record) => {
            const venue = venues.find((item) => item.id === record.venueId)
            if (!venue) return null
            return (
              <span
                className="venue-pin"
                style={getVenuePinPosition(record, plottedRecords)}
                title={`${venue.name}, ${venue.city}`}
                key={record.venueId}
              >
                <b>{venue.matches}</b>
              </span>
            )
          })}
        </div>
        <div className="venue-map-stats">
          <div>
            <span>Weather</span>
            <strong>{venueIntel.source.status}</strong>
          </div>
          <div>
            <span>Next venue</span>
            <strong>{nextVenue?.city ?? '-'}</strong>
          </div>
          <div>
            <span>Updated</span>
            <strong>{formatRefreshTime(venueIntel.updatedAt)}</strong>
          </div>
        </div>
      </section>

      <div className="venue-card-grid">
        {venues.map((venue) => {
          const finalOrLate = matches
            .filter((match) => match.venue.id === venue.id)
            .sort((a, b) => b.matchNumber - a.matchNumber)[0]
          const record = intelByVenue.get(venue.id)
          const venueMatches = matches.filter((match) => match.venue.id === venue.id)
          const nextMatch = sortByKickoff(venueMatches).find(isUpcoming) ?? sortByKickoff(venueMatches)[0]

          return (
            <article className="venue-card" key={venue.id}>
              <div className="venue-card-head">
                <span className="venue-icon">
                  <MapPin size={22} />
                </span>
                <div>
                  <h3>{venue.name}</h3>
                  <span>{venue.city}, {venue.country}</span>
                </div>
              </div>
              <div className="venue-card-metrics">
                <div>
                  <span>Matches</span>
                  <strong>{venue.matches}</strong>
                </div>
                <div>
                  <span>Next</span>
                  <strong>{venue.next ? formatIstDateTime(venue.next) : 'TBD'}</strong>
                </div>
              </div>
              <div className={`venue-weather ${record?.weather ? 'good' : 'warn'}`}>
                {record?.weather ? <CheckCircle2 size={16} /> : loading ? <RefreshCw size={16} className="spin" /> : <Info size={16} />}
                <span>{formatWeather(record)}</span>
              </div>
              <div className="venue-next-match">
                <span>Featured fixture</span>
                <strong>{nextMatch ? `${nextMatch.home.code} vs ${nextMatch.away.code}` : 'TBD'}</strong>
                <small>{nextMatch ? `${formatIstDateTime(nextMatch.dateUtc)} · M${nextMatch.matchNumber}` : 'No fixture loaded'}</small>
              </div>
              {record?.placeLabel ? <small>{record.placeLabel}</small> : record?.detail ? <small>{record.detail}</small> : null}
              {finalOrLate ? <small>Latest scheduled: M{finalOrLate.matchNumber}, {finalOrLate.stage}</small> : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function App() {
  const homeHref = import.meta.env.BASE_URL || '/'
  const [data, setData] = useState<WorldCupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(() => getInitialMatchId())
  const [selectedTeamCode, setSelectedTeamCode] = useState<string | null>(() => getInitialTeamCode())
  const [view, setView] = useState<ViewMode>(() => getInitialView())
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [extras, setExtras] = useState<MatchExtras>(blankExtras)
  const [extrasLoading, setExtrasLoading] = useState(false)
  const [tournamentStats, setTournamentStats] = useState<TournamentStats>(blankTournamentStats)
  const [statsLoading, setStatsLoading] = useState(false)
  const [venueIntel, setVenueIntel] = useState<VenueIntel>(blankVenueIntel)
  const [venueIntelLoading, setVenueIntelLoading] = useState(false)
  const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(null)
  const [teamProfileLoading, setTeamProfileLoading] = useState(false)
  const [shareStatus, setShareStatus] = useState<ShareStatus>({ state: 'idle' })
  const shouldScrollToSelected = useRef(Boolean(getInitialMatchId()))
  const { favorites, toggle } = useLocalFavorites()

  const refresh = useCallback(async (background = false) => {
    const controller = new AbortController()
    if (background) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const nextData = await loadWorldCupData(controller.signal)
      setData(nextData)
      setSelectedId((current) => current ?? nextData.matches[0]?.id ?? null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load live data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void refresh(false)
    })
    return () => {
      active = false
    }
  }, [refresh])

  useEffect(() => {
    const interval = window.setInterval(() => refresh(true), 60_000)
    return () => window.clearInterval(interval)
  }, [refresh])

  const matches = useMemo(() => data?.matches ?? [], [data])
  const selectedMatch = matches.find((match) => match.id === selectedId) ?? matches[0]
  const standings = useMemo(() => buildStandings(matches), [matches])
  const teams = useMemo(() => getTeams(matches), [matches])
  const selectedTeam = teams.find((team) => team.code === selectedTeamCode) ?? null
  const venues = useMemo(() => getVenues(matches), [matches])
  const venueKey = useMemo(() => venues.map((venue) => venue.id).join('|'), [venues])
  const liveCount = matches.filter((match) => match.status.state === 'live' || match.status.state === 'halftime').length
  const todayKey = getTodayIstKey()
  const viewTabs: { id: ViewMode; icon: typeof Calendar; label: string }[] = [
    { id: 'hub', icon: Activity, label: 'Hub' },
    { id: 'matches', icon: Calendar, label: 'Matches' },
    { id: 'stats', icon: Star, label: 'Stats' },
    { id: 'groups', icon: Table2, label: 'Groups' },
    { id: 'bracket', icon: Trophy, label: 'Knockout' },
    { id: 'teams', icon: Shield, label: 'Teams' },
    { id: 'venues', icon: MapPin, label: 'Venues' },
  ]

  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search)
      const nextView = params.get('view')
      const nextMatch = params.get('match')
      const nextTeam = params.get('team')
      setView(isViewMode(nextView) ? nextView : 'hub')
      setSelectedId(nextMatch)
      setSelectedTeamCode(nextTeam)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!selectedMatch) return
    const url = new URL(window.location.href)
    url.searchParams.set('view', view)
    if (view === 'teams') {
      if (selectedTeam) url.searchParams.set('team', selectedTeam.code)
      url.searchParams.delete('match')
    } else {
      url.searchParams.set('match', selectedMatch.id)
      url.searchParams.delete('team')
    }
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`)
  }, [selectedMatch, selectedTeam, view])

  useEffect(() => {
    if (!shouldScrollToSelected.current || !selectedMatch || loading) return
    const selectedRow = [...document.querySelectorAll<HTMLElement>('.match-row')].find(
      (row) => row.dataset.matchId === selectedMatch.id,
    )
    selectedRow?.scrollIntoView({ block: 'center' })
    shouldScrollToSelected.current = false
  }, [loading, selectedMatch])

  useEffect(() => {
    if (!selectedMatch) return
    const controller = new AbortController()
    let active = true
    queueMicrotask(() => {
      if (active) setExtrasLoading(true)
    })
    loadMatchExtras(selectedMatch, controller.signal)
      .then((nextExtras) => {
        if (active) setExtras(nextExtras)
      })
      .catch((loadError) => {
        if (active && !isAbortError(loadError)) {
          setExtras({
            ...blankExtras,
            summarySource: {
              id: 'espn-summary',
              label: 'Match summary',
              status: 'offline',
              detail: loadError instanceof Error ? loadError.message : 'Match detail feed failed.',
            },
          })
        }
      })
      .finally(() => {
        if (active) setExtrasLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [selectedMatch])

  useEffect(() => {
    if (!matches.length) return
    const controller = new AbortController()
    let active = true
    queueMicrotask(() => {
      if (active) setStatsLoading(true)
    })
    loadTournamentStats(matches, controller.signal)
      .then((nextStats) => {
        if (active) setTournamentStats(nextStats)
      })
      .catch((loadError) => {
        if (active && !isAbortError(loadError)) {
          setTournamentStats({
            ...blankTournamentStats,
            source: {
              ...blankTournamentStats.source,
              status: 'offline',
              detail: loadError instanceof Error ? loadError.message : 'Tournament stats failed.',
            },
          })
        }
      })
      .finally(() => {
        if (active) setStatsLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [matches])

  useEffect(() => {
    if (!venues.length) return
    const controller = new AbortController()
    let active = true
    queueMicrotask(() => {
      if (active) setVenueIntelLoading(true)
    })
    loadVenueIntel(venues, controller.signal)
      .then((nextIntel) => {
        if (active) setVenueIntel(nextIntel)
      })
      .catch((loadError) => {
        if (active && !isAbortError(loadError)) {
          setVenueIntel({
            ...blankVenueIntel,
            source: {
              ...blankVenueIntel.source,
              status: 'offline',
              detail: loadError instanceof Error ? loadError.message : 'Venue enrichment failed.',
            },
          })
        }
      })
      .finally(() => {
        if (active) setVenueIntelLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [venueKey, venues])

  useEffect(() => {
    if (!selectedTeam) return
    const controller = new AbortController()
    let active = true
    queueMicrotask(() => {
      if (active) setTeamProfileLoading(true)
    })
    loadTeamProfile(selectedTeam, matches, controller.signal)
      .then((nextProfile) => {
        if (active) setTeamProfile(nextProfile)
      })
      .catch((loadError) => {
        if (active && !isAbortError(loadError)) {
          setTeamProfile(null)
        }
      })
      .finally(() => {
        if (active) setTeamProfileLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [matches, selectedTeam])

  const groupOptions = useMemo(
    () => ['all', ...new Set(matches.map((match) => match.group).filter(Boolean) as string[])],
    [matches],
  )

  const teamOptions = useMemo(() => ['all', ...teams.map((team) => team.code)], [teams])

  const filteredMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return matches.filter((match) => {
      if (quickFilter === 'today' && formatIstDateKey(match.dateUtc) !== todayKey) return false
      if (quickFilter === 'live' && match.status.state !== 'live' && match.status.state !== 'halftime') return false
      if (quickFilter === 'upcoming' && !isUpcoming(match)) return false
      if (quickFilter === 'favorites' && !favorites.includes(match.id)) return false
      if (groupFilter !== 'all' && match.group !== groupFilter) return false
      if (teamFilter !== 'all' && match.home.code !== teamFilter && match.away.code !== teamFilter) return false
      if (!normalizedQuery) return true
      return [
        match.home.name,
        match.away.name,
        match.home.code,
        match.away.code,
        match.venue.name,
        match.venue.city,
        match.stage,
        match.group,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [matches, query, quickFilter, todayKey, favorites, groupFilter, teamFilter])

  const groupedMatches = useMemo(() => groupByDay(filteredMatches), [filteredMatches])
  const nextMatch = matches.find(isUpcoming)

  function selectTeamFilter(team: string) {
    setTeamFilter(team)
    setView('matches')
    setQuickFilter('all')
  }

  function openTeam(team: Team) {
    setSelectedTeamCode(team.code)
    setView('teams')
    setQuickFilter('all')
  }

  function openMatch(matchId: string) {
    setSelectedId(matchId)
    setView('matches')
    shouldScrollToSelected.current = true
  }

  function resetShareStatus() {
    window.setTimeout(() => setShareStatus({ state: 'idle' }), 2200)
  }

  async function shareUrl(url: URL, title: string, target: ShareTarget) {
    try {
      if (navigator.share) {
        await navigator.share({ title, url: url.toString() })
        setShareStatus({ state: 'copied', target, message: 'Share sheet opened.' })
        resetShareStatus()
        return
      }

      await copyText(url.toString())
      setShareStatus({ state: 'copied', target, message: 'Link copied.' })
      resetShareStatus()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      window.prompt('Copy this link', url.toString())
      setShareStatus({ state: 'manual', target, message: 'Copy the link shown in the prompt.' })
      resetShareStatus()
    }
  }

  async function shareMatch(match: Match) {
    const url = new URL(window.location.href)
    url.searchParams.set('view', 'matches')
    url.searchParams.set('match', match.id)
    setView('matches')
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`)
    await shareUrl(url, `${match.home.shortName} vs ${match.away.shortName}`, 'match')
  }

  async function shareCurrentView() {
    const url = new URL(window.location.href)
    url.searchParams.set('view', view)
    if (view === 'teams' && selectedTeam) {
      url.searchParams.set('team', selectedTeam.code)
      url.searchParams.delete('match')
    } else if (selectedMatch) {
      url.searchParams.set('match', selectedMatch.id)
      url.searchParams.delete('team')
    }
    await shareUrl(url, 'FIFA World Cup 2026 Tracker', 'app')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href={homeHref} aria-label="Open World Cup tracker home">
          <span className="brand-mark">
            <img src={WORLD_CUP_2026_LOGO_URL} alt="" />
          </span>
          <div>
            <strong>FIFA World Cup 2026 Tracker</strong>
            <small>Schedule, groups, bracket, teams, venues</small>
          </div>
        </a>
        <div className="top-actions">
          <button className={`secondary-button ${shareStatus.state === 'copied' && shareStatus.target === 'app' ? 'success' : ''}`} type="button" onClick={shareCurrentView}>
            {shareStatus.state === 'copied' && shareStatus.target === 'app' ? <Check size={16} /> : <Share2 size={16} />}
            Share
          </button>
          <button className="secondary-button" type="button" onClick={() => downloadCalendar(matches)} disabled={!matches.length}>
            <Download size={16} />
            Calendar
          </button>
          <button className="primary-button" type="button" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      <SourceHealth sources={data?.sourceStates ?? []} updatedAt={data?.updatedAt} venueIntel={venueIntel} />

      {error ? (
        <section className="error-panel">
          <AlertTriangle size={20} />
          <div>
            <strong>Live data could not be loaded</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => refresh(false)}>Try again</button>
        </section>
      ) : null}

      {shareStatus.message ? (
        <div className={`share-toast ${shareStatus.state}`} role="status">
          {shareStatus.state === 'copied' ? <Check size={16} /> : <Info size={16} />}
          {shareStatus.message}
        </div>
      ) : null}

      <section className="summary-rail">
        <div>
          <span>Matches</span>
          <strong>{loading ? '-' : matches.length}</strong>
        </div>
        <div>
          <span>Live now</span>
          <strong>{loading ? '-' : liveCount}</strong>
        </div>
        <div>
          <span>Teams</span>
          <strong>{loading ? '-' : teams.length}</strong>
        </div>
        <div>
          <span>Venues</span>
          <strong>{loading ? '-' : venues.length}</strong>
        </div>
        <div className="wide">
          <span>Next kickoff</span>
          <strong>{nextMatch ? `${nextMatch.home.code} vs ${nextMatch.away.code} ${getKickoffDistance(nextMatch.dateUtc)}` : '-'}</strong>
        </div>
      </section>

      <nav className="view-tabs" aria-label="Tracker views">
        {viewTabs.map(({ id, icon: TypedIcon, label }) => {
          return (
            <button type="button" className={view === id ? 'active' : ''} onClick={() => setView(id)} key={id}>
              <TypedIcon size={16} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className={`workspace ${view === 'matches' ? '' : 'wide-workspace'}`}>
        <section className="main-panel">
          {view === 'hub' ? (
            <HubView
              matches={matches}
              standings={standings}
              favorites={favorites}
              sources={data?.sourceStates ?? []}
              tournamentStats={tournamentStats}
              statsLoading={statsLoading}
              onMatchSelect={openMatch}
              onTeamSelect={openTeam}
              onView={setView}
            />
          ) : null}

          {view === 'matches' ? (
            <div className="toolbar">
              <div className="search-box">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team, venue, city, group..." />
              </div>
              <div className="select-row">
                <label>
                  <Filter size={15} />
                  <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                    {groupOptions.map((group) => (
                      <option value={group} key={group}>
                        {group === 'all' ? 'All groups' : group}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <Users size={15} />
                  <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
                    {teamOptions.map((team) => (
                      <option value={team} key={team}>
                        {team === 'all' ? 'All teams' : team}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {view === 'matches' ? (
            <>
              <div className="quick-filters">
                {[
                  ['all', 'All'],
                  ['today', "Today's matches"],
                  ['live', 'Live'],
                  ['upcoming', 'Upcoming'],
                  ['favorites', 'Favorites'],
                ].map(([id, label]) => (
                  <button
                    type="button"
                    className={quickFilter === id ? 'active' : ''}
                    onClick={() => setQuickFilter(id as QuickFilter)}
                    key={id}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <section className="loading-panel">
                  <RefreshCw size={22} className="spin" />
                  <h2>Loading World Cup data</h2>
                  <p>Fetching FIFA fixtures and match details.</p>
                </section>
              ) : filteredMatches.length ? (
                <div className="match-list">
                  {[...groupedMatches.entries()].map(([day, dayMatches]) => (
                    <section className="match-day" key={day}>
                      <div className="day-header">
                        <h2>{formatIstDay(dayMatches[0].dateUtc)}</h2>
                        <span>{dayMatches.length} matches</span>
                      </div>
                      {dayMatches.map((match) => {
                        const selected = selectedMatch?.id === match.id

                        return (
                          <Fragment key={match.id}>
                            <MatchRow
                              match={match}
                              selected={selected}
                              favorite={favorites.includes(match.id)}
                              onSelect={setSelectedId}
                              onFavorite={toggle}
                              onTeamSelect={openTeam}
                            />
                            {selected ? (
                              <div className="inline-detail">
                                <DetailView
                                  match={selectedMatch}
                                  extras={extras}
                                  extrasLoading={extrasLoading}
                                  onDownloadOne={(match) => downloadCalendar([match], `fwc2026-match-${match.matchNumber}.ics`)}
                                  onShare={shareMatch}
                                  shareStatus={shareStatus}
                                  onTeamSelect={openTeam}
                                  variant="inline"
                                />
                              </div>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </section>
                  ))}
                </div>
              ) : (
                <section className="loading-panel">
                  <Search size={22} />
                  <h2>No matches match this filter</h2>
                  <p>Clear search, team, group, or favorites filters to return to the official fixture list.</p>
                </section>
              )}
            </>
          ) : null}

          {view === 'stats' ? (
            <StatsView
              stats={tournamentStats}
              loading={statsLoading}
              matches={matches}
              onMatchSelect={openMatch}
              onTeamSelect={openTeam}
            />
          ) : null}
          {view === 'groups' ? <GroupsView standings={standings} onTeamSelect={openTeam} /> : null}
          {view === 'bracket' ? <BracketView matches={matches.filter(isKnockout)} /> : null}
          {view === 'teams' ? (
            <TeamsView
              teams={teams}
              matches={matches}
              selectedTeamCode={selectedTeam?.code ?? selectedTeamCode}
              teamProfile={teamProfile}
              teamProfileLoading={teamProfileLoading}
              onTeamFilter={selectTeamFilter}
              onTeamSelect={openTeam}
              onMatchSelect={openMatch}
            />
          ) : null}
          {view === 'venues' ? (
            <VenuesView venues={venues} matches={matches} venueIntel={venueIntel} loading={venueIntelLoading} />
          ) : null}
        </section>

        {view === 'matches' ? (
          <DetailView
            match={selectedMatch}
            extras={extras}
            extrasLoading={extrasLoading}
            onDownloadOne={(match) => downloadCalendar([match], `fwc2026-match-${match.matchNumber}.ics`)}
            onShare={shareMatch}
            shareStatus={shareStatus}
            onTeamSelect={openTeam}
            variant="side"
          />
        ) : null}
      </div>

      <section className="bottom-info">
        <div>
          <Bell size={18} />
          <h3>Reminders</h3>
          <p>Add one match or the full tournament to your device calendar.</p>
        </div>
        <div>
          <Activity size={18} />
          <h3>Live updates</h3>
          <p>The app refreshes every 60 seconds and can be manually refreshed. Details appear when match feeds publish them.</p>
        </div>
        <div>
          <Shield size={18} />
          <h3>Watch links</h3>
          <p>Only official India options are listed. Unofficial streams are intentionally excluded.</p>
        </div>
      </section>
    </main>
  )
}

export default App
