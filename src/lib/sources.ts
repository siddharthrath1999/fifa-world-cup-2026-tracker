import type {
  ExternalLink,
  LineupGroup,
  LiveEvent,
  Match,
  MatchExtras,
  SourceState,
  StatLine,
  Team,
  TeamPlayer,
  TeamProfile,
  TeamStaff,
  TeamUpdate,
  TournamentPlayerStat,
  TournamentStats,
  TournamentTeamStat,
  Venue,
  VenueIntel,
  WorldCupData,
} from '../types'

const FIFA_MATCHES_URL =
  'https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idCompetition=17&from=2026-06-11&to=2026-07-20'
const ESPN_SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200'
const FIFA_COMPETITION_ID = '17'
const FIFA_SEASON_ID = '285023'
const FIFA_SQUAD_SEASONS = [
  { id: FIFA_SEASON_ID, label: 'FIFA 2026' },
  { id: '255711', label: 'FIFA 2022' },
] as const
const FIFA_PUBLIC_SCHEDULE_URL = 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/schedule'
const FIFA_PUBLIC_TEAMS_URL = 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/teams'
const ESPN_PUBLIC_SCOREBOARD_URL = 'https://www.espn.com/soccer/scoreboard/_/league/fifa.world'
const ESPN_PUBLIC_SCHEDULE_URL = 'https://www.espn.com/soccer/schedule/_/league/fifa.world'
const FOTMOB_PUBLIC_WORLD_CUP_URL = 'https://www.fotmob.com/leagues/77/overview/world-cup'
const GOAL_PUBLIC_LIVE_SCORES_URL = 'https://www.goal.com/en-us/live-scores'

type Localized = { Description?: string }

type FifaTeam = {
  IdTeam?: string
  IdCountry?: string
  TeamName?: Localized[]
  Abbreviation?: string
  ShortClubName?: string
  Score?: number | null
}

type FifaMatch = {
  IdMatch: string
  IdCompetition: string
  IdSeason: string
  IdStage?: string
  IdGroup?: string
  Date: string
  LocalDate?: string
  Home?: FifaTeam
  Away?: FifaTeam
  HomeTeamScore?: number | null
  AwayTeamScore?: number | null
  HomeTeamPenaltyScore?: number | null
  AwayTeamPenaltyScore?: number | null
  StageName?: Localized[]
  GroupName?: Localized[]
  MatchStatus?: number
  ResultType?: number
  MatchNumber?: number
  Winner?: string | null
  PlaceHolderA?: string | null
  PlaceHolderB?: string | null
  Stadium?: {
    IdStadium?: string
    Name?: Localized[]
    Capacity?: number | null
    WebAddress?: string | null
    Roof?: boolean | null
    Turf?: string | null
    CityName?: Localized[]
    IdCountry?: string
    Latitude?: number | null
    Longitude?: number | null
    Street?: string | null
  }
  Officials?: {
    NameShort?: Localized[]
    Name?: Localized[]
    TypeLocalized?: Localized[]
  }[]
  MatchReportUrl?: string | null
}

type FifaResponse = {
  Results?: FifaMatch[]
}

type FifaSquad = {
  Players?: FifaSquadPlayer[]
  Officials?: FifaSquadOfficial[]
}

type FifaSquadWithSeason = FifaSquad & {
  seasonId: string
  seasonLabel: string
}

type FifaSquadPlayer = {
  IdPlayer?: string
  PlayerName?: Localized[]
  ShortName?: Localized[]
  JerseyNum?: number
  BirthDate?: string
  PositionLocalized?: Localized[]
  RealPositionLocalized?: Localized[]
  Height?: number
  Weight?: number
  PlayerPicture?: {
    PictureUrl?: string
  }
}

type FifaSquadOfficial = {
  IdCoach?: string
  Name?: Localized[]
  Alias?: Localized[]
  Role?: number
  PictureUrl?: string | null
}

type EspnEvent = {
  id: string
  date: string
  name?: string
  shortName?: string
  competitions?: {
    id?: string
    status?: {
      displayClock?: string
      type?: {
        state?: string
        description?: string
        shortDetail?: string
        detail?: string
        completed?: boolean
      }
    }
    venue?: {
      id?: string
      fullName?: string
      address?: {
        city?: string
        country?: string
      }
    }
    competitors?: {
      homeAway?: string
      score?: string
      team?: {
        id?: string
        abbreviation?: string
        displayName?: string
        shortDisplayName?: string
        name?: string
        logo?: string
        color?: string
        links?: { href?: string; text?: string; rel?: string[] }[]
      }
      statistics?: { name?: string; displayName?: string; displayValue?: string }[]
    }[]
    details?: unknown[]
    broadcasts?: { names?: string[] }[]
  }[]
  links?: ExternalLink[]
}

type EspnScoreboard = {
  events?: EspnEvent[]
}

type EspnSummary = {
  boxscore?: {
    teams?: {
      homeAway?: string
      team?: {
        id?: string
        abbreviation?: string
        displayName?: string
        shortDisplayName?: string
        logo?: string
        color?: string
      }
      statistics?: { name?: string; displayName?: string; label?: string; displayValue?: string }[]
    }[]
    players?: {
      team?: {
        id?: string
        abbreviation?: string
        displayName?: string
        shortDisplayName?: string
      }
      statistics?: {
        names?: string[]
        labels?: string[]
        athletes?: {
          athlete?: { id?: string; displayName?: string; jersey?: string; position?: { abbreviation?: string } }
          stats?: string[]
          starter?: boolean
        }[]
      }[]
    }[]
    form?: {
      team?: { id?: string; abbreviation?: string; displayName?: string; logo?: string }
      events?: { gameResult?: string }[]
    }[]
  }
  gameInfo?: {
    venue?: {
      fullName?: string
      address?: { city?: string; country?: string }
    }
  }
  competitions?: {
    details?: {
      id?: string
      clock?: { displayValue?: string }
      team?: { displayName?: string; abbreviation?: string }
      athletesInvolved?: { displayName?: string }[]
      type?: { text?: string; abbreviation?: string }
      text?: string
    }[]
  }[]
  keyEvents?: EspnSummaryEvent[]
  commentary?: {
    sequence?: number
    time?: { value?: number; displayValue?: string }
    text?: string
    play?: EspnSummaryEvent
  }[]
  rosters?: {
    homeAway?: string
    team?: {
      id?: string
      abbreviation?: string
      displayName?: string
      shortDisplayName?: string
      color?: string
      logos?: { href?: string }[]
    }
    roster?: {
      active?: boolean
      starter?: boolean
      jersey?: string
      athlete?: {
        id?: string
        displayName?: string
        fullName?: string
        shortName?: string
      }
      position?: {
        name?: string
        displayName?: string
        abbreviation?: string
      }
      subbedIn?: boolean
      subbedOut?: boolean
      formationPlace?: string
      stats?: { name?: string; displayName?: string; displayValue?: string; value?: number }[]
    }[]
    formation?: string
  }[]
  broadcasts?: {
    media?: { shortName?: string; name?: string }
    region?: string
  }[]
  headToHeadGames?: {
    events?: { id?: string; links?: { href?: string; text?: string }[]; score?: string; gameDate?: string }[]
  }[]
}

type EspnSummaryEvent = {
  id?: string
  clock?: { value?: number; displayValue?: string }
  time?: { value?: number; displayValue?: string }
  team?: { id?: string; displayName?: string; abbreviation?: string }
  athletesInvolved?: { displayName?: string }[]
  participants?: { athlete?: { id?: string; displayName?: string } }[]
  type?: { text?: string; abbreviation?: string; type?: string }
  text?: string
  shortText?: string
}

type EspnLink = {
  href?: string
  text?: string
  shortText?: string
  rel?: string[]
  isPremium?: boolean
}

type EspnTeamDetails = {
  team?: {
    id?: string
    abbreviation?: string
    displayName?: string
    shortDisplayName?: string
    color?: string
    alternateColor?: string
    logos?: { href?: string }[]
    record?: { items?: { summary?: string; description?: string; type?: string }[] }
    links?: EspnLink[]
    nextEvent?: {
      name?: string
      date?: string
      competitions?: {
        status?: { type?: { description?: string; shortDetail?: string } }
        venue?: { fullName?: string; address?: { city?: string; country?: string } }
      }[]
    }[]
    standingSummary?: string
  }
}

type EspnRoster = {
  timestamp?: string
  athletes?: EspnAthlete[]
  coach?: {
    id?: string
    firstName?: string
    lastName?: string
    displayName?: string
    role?: string
    headshot?: { href?: string }
  }[]
}

type EspnAthlete = {
  id?: string
  displayName?: string
  shortName?: string
  jersey?: string
  position?: { displayName?: string; abbreviation?: string; name?: string }
  age?: number
  displayHeight?: string
  displayWeight?: string
  headshot?: { href?: string; alt?: string }
  status?: { name?: string; type?: string; abbreviation?: string }
  injuries?: {
    displayName?: string
    name?: string
    type?: string
    status?: string
    detail?: string
  }[]
  links?: EspnLink[]
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json() as Promise<T>
}

async function fetchJsonWithTimeout<T>(url: string, signal?: AbortSignal, timeoutMs = 8_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const abortFromParent = () => controller.abort()
  signal?.addEventListener('abort', abortFromParent, { once: true })
  try {
    return await fetchJson<T>(url, controller.signal)
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromParent)
  }
}

function label(value?: Localized[]) {
  return value?.find((item) => item.Description)?.Description ?? value?.[0]?.Description ?? ''
}

function normalizeTeam(team: FifaTeam | undefined, placeholder: string | null | undefined, side: 'home' | 'away'): Team {
  const code = team?.Abbreviation ?? placeholder ?? `TBD-${side.toUpperCase()}`
  const name = team ? label(team.TeamName) || team.ShortClubName || code : placeholder || 'To be decided'
  return {
    id: team?.IdTeam ?? `${side}-${code}`,
    fifaId: team?.IdTeam,
    name,
    shortName: team?.ShortClubName || name,
    code,
    countryCode: team?.IdCountry,
  }
}

function normalizeVenue(stadium: FifaMatch['Stadium']): Venue {
  return {
    id: stadium?.IdStadium ?? 'venue-tbd',
    name: label(stadium?.Name) || 'Venue to be confirmed',
    city: label(stadium?.CityName) || 'City to be confirmed',
    country: stadium?.IdCountry ?? 'TBD',
    latitude: stadium?.Latitude,
    longitude: stadium?.Longitude,
    capacity: stadium?.Capacity,
    roof: stadium?.Roof,
    turf: stadium?.Turf,
    address: stadium?.Street,
    webAddress: stadium?.WebAddress,
  }
}

function getFifaStatus(match: FifaMatch): Match['status'] {
  if (match.ResultType && match.ResultType > 0) {
    return { state: 'fulltime', label: 'Full time', phase: 'FT' }
  }

  if (match.MatchStatus === 12) {
    return { state: 'postponed', label: 'Postponed' }
  }

  const kickoff = new Date(match.Date).getTime()
  const now = Date.now()
  if (match.HomeTeamScore !== null && match.HomeTeamScore !== undefined && now >= kickoff) {
    return { state: 'live', label: 'Live', phase: 'LIVE' }
  }

  return { state: 'scheduled', label: 'Scheduled', phase: 'PRE' }
}

function makeFifaMatch(match: FifaMatch): Match {
  const home = normalizeTeam(match.Home, match.PlaceHolderA, 'home')
  const away = normalizeTeam(match.Away, match.PlaceHolderB, 'away')
  const stage = label(match.StageName) || 'Stage to be confirmed'
  const links: ExternalLink[] = [
    {
      label: 'FIFA match centre',
      href: `https://www.fifa.com/en/match-centre/match/${match.IdCompetition}/${match.IdSeason}/${match.IdStage ?? 'stage'}/${match.IdMatch}`,
      type: 'official',
    },
  ]
  if (match.MatchReportUrl) {
    links.push({ label: 'FIFA report', href: match.MatchReportUrl, type: 'official' })
  }

  return {
    id: match.IdMatch,
    fifaId: match.IdMatch,
    matchNumber: match.MatchNumber ?? Number(match.IdMatch),
    stage,
    group: label(match.GroupName) || undefined,
    dateUtc: match.Date,
    localDate: match.LocalDate,
    home,
    away,
    homeScore: match.HomeTeamScore ?? null,
    awayScore: match.AwayTeamScore ?? null,
    homePenaltyScore: match.HomeTeamPenaltyScore ?? null,
    awayPenaltyScore: match.AwayTeamPenaltyScore ?? null,
    venue: normalizeVenue(match.Stadium),
    status: getFifaStatus(match),
    officials:
      match.Officials?.map((official) => {
        const role = label(official.TypeLocalized)
        const name = label(official.NameShort) || label(official.Name)
        return role ? `${role}: ${name}` : name
      }).filter(Boolean) ?? [],
    winnerId: match.Winner,
    placeholders: {
      home: match.PlaceHolderA,
      away: match.PlaceHolderB,
    },
    links,
    rawSources: {
      fifa: true,
      espn: false,
    },
  }
}

function espnLinksToExternal(links?: EspnLink[]) {
  return (
    links
      ?.filter((link) => {
        const linkText = `${link.text ?? ''} ${link.shortText ?? ''} ${link.rel?.join(' ') ?? ''}`.toLowerCase()
        return (
          link.href &&
          (link.text || link.shortText) &&
          !link.isPremium &&
          !linkText.includes('odds') &&
          !linkText.includes('bet') &&
          !linkText.includes('fantasy') &&
          !linkText.includes('insider')
        )
      })
      .map((link) => ({
        label: (link.shortText || link.text) as string,
        href: link.href as string,
        type: link.rel?.[0],
      })) ?? []
  )
}

function espnTeamToLinks(links?: EspnLink[]) {
  return espnLinksToExternal(links)
}

function uniqueLinks(links: ExternalLink[]) {
  const seen = new Set<string>()
  return links.filter((link) => {
    if (!link.href || seen.has(link.href)) return false
    seen.add(link.href)
    return true
  })
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

function makeEspnTeamMap(events: EspnEvent[]) {
  const map = new Map<string, Partial<Team>>()
  for (const event of events) {
    for (const competitor of event.competitions?.[0]?.competitors ?? []) {
      const team = competitor.team
      if (!team?.abbreviation) continue
      map.set(team.abbreviation, {
        id: team.id,
        name: team.displayName ?? team.shortDisplayName ?? team.abbreviation,
        shortName: team.shortDisplayName ?? team.displayName ?? team.abbreviation,
        code: team.abbreviation,
        logo: team.logo,
        color: team.color,
        links: espnTeamToLinks(team.links),
      })
    }
  }
  return map
}

function getEspnCompetitors(event: EspnEvent) {
  const competition = event.competitions?.[0]
  const home = competition?.competitors?.find((competitor) => competitor.homeAway === 'home')
  const away = competition?.competitors?.find((competitor) => competitor.homeAway === 'away')
  return { competition, home, away }
}

function eventKey(dateIso: string, homeCode: string, awayCode: string) {
  const minutes = Math.round(new Date(dateIso).getTime() / 60_000)
  return `${minutes}|${homeCode}|${awayCode}`
}

function buildEspnEventMap(events: EspnEvent[]) {
  const map = new Map<string, EspnEvent>()
  for (const event of events) {
    const { home, away } = getEspnCompetitors(event)
    const homeCode = home?.team?.abbreviation
    const awayCode = away?.team?.abbreviation
    if (!homeCode || !awayCode) continue
    map.set(eventKey(event.date, homeCode, awayCode), event)
  }
  return map
}

function applyEspnStatus(match: Match, event: EspnEvent) {
  const status = event.competitions?.[0]?.status
  const state = status?.type?.state
  if (!state) return match.status

  if (state === 'in') {
    return {
      state: status.type?.description?.toLowerCase().includes('half') ? 'halftime' : 'live',
      label: status.type?.description ?? 'Live',
      phase: status.type?.shortDetail ?? status.type?.detail,
      clock: status.displayClock,
    } satisfies Match['status']
  }

  if (state === 'post') {
    return {
      state: 'fulltime',
      label: status.type?.description ?? 'Full time',
      phase: status.type?.shortDetail ?? 'FT',
      clock: status.displayClock,
    } satisfies Match['status']
  }

  return {
    state: 'scheduled',
    label: status.type?.description ?? 'Scheduled',
    phase: 'PRE',
  } satisfies Match['status']
}

function espnScore(score: string | undefined, event: EspnEvent) {
  const state = event.competitions?.[0]?.status?.type?.state
  if (state === 'pre') return null
  return score !== undefined ? Number(score) : null
}

function mergeEspn(match: Match, event: EspnEvent, teamMap: Map<string, Partial<Team>>): Match {
  const { home, away, competition } = getEspnCompetitors(event)
  const homeTeam = teamMap.get(match.home.code)
  const awayTeam = teamMap.get(match.away.code)
  const espnLinks =
    event.links
      ?.filter((link) => link.href && link.label)
      .map((link) => ({ label: link.label, href: link.href, type: link.type ?? 'espn' })) ?? []

  return {
    ...match,
    espnId: event.id,
    home: {
      ...match.home,
      ...homeTeam,
      fifaId: match.home.fifaId ?? match.home.id,
      logo: home?.team?.logo ?? homeTeam?.logo ?? match.home.logo,
      color: home?.team?.color ?? homeTeam?.color ?? match.home.color,
      links: homeTeam?.links ?? match.home.links,
    },
    away: {
      ...match.away,
      ...awayTeam,
      fifaId: match.away.fifaId ?? match.away.id,
      logo: away?.team?.logo ?? awayTeam?.logo ?? match.away.logo,
      color: away?.team?.color ?? awayTeam?.color ?? match.away.color,
      links: awayTeam?.links ?? match.away.links,
    },
    homeScore: espnScore(home?.score, event) ?? match.homeScore,
    awayScore: espnScore(away?.score, event) ?? match.awayScore,
    venue: {
      ...match.venue,
      name: competition?.venue?.fullName ?? match.venue.name,
      city: competition?.venue?.address?.city ?? match.venue.city,
      country: competition?.venue?.address?.country ?? match.venue.country,
    },
    status: applyEspnStatus(match, event),
    links: [...match.links, ...espnLinks],
    rawSources: {
      ...match.rawSources,
      espn: true,
    },
  }
}

function makeMatchFromEspn(event: EspnEvent, teamMap: Map<string, Partial<Team>>): Match | null {
  const { home, away, competition } = getEspnCompetitors(event)
  if (!home?.team?.abbreviation || !away?.team?.abbreviation) return null
  const homeFromMap = teamMap.get(home.team.abbreviation)
  const awayFromMap = teamMap.get(away.team.abbreviation)

  const makeTeam = (team: NonNullable<typeof home>['team'], fromMap?: Partial<Team>): Team => ({
    id: team?.id ?? fromMap?.id ?? team?.abbreviation ?? 'team',
    name: team?.displayName ?? fromMap?.name ?? team?.abbreviation ?? 'Team',
    shortName: team?.shortDisplayName ?? fromMap?.shortName ?? team?.displayName ?? team?.abbreviation ?? 'Team',
    code: team?.abbreviation ?? fromMap?.code ?? 'TBD',
    logo: team?.logo ?? fromMap?.logo,
    color: team?.color ?? fromMap?.color,
    links: fromMap?.links,
  })

  const venue = competition?.venue
  return {
    id: `espn-${event.id}`,
    fifaId: `espn-${event.id}`,
    espnId: event.id,
    matchNumber: Number(event.id),
    stage: 'FIFA World Cup',
    dateUtc: event.date,
    home: makeTeam(home.team, homeFromMap),
    away: makeTeam(away.team, awayFromMap),
    homeScore: espnScore(home.score, event),
    awayScore: espnScore(away.score, event),
    venue: {
      id: venue?.id ?? `venue-${event.id}`,
      name: venue?.fullName ?? 'Venue to be confirmed',
      city: venue?.address?.city ?? 'City to be confirmed',
      country: venue?.address?.country ?? 'TBD',
    },
    status: applyEspnStatus(
      {
        status: { state: 'unknown', label: 'Unknown' },
      } as Match,
      event,
    ),
    officials: [],
    placeholders: {},
    links:
      event.links
        ?.filter((link) => link.href && link.label)
        .map((link) => ({ label: link.label, href: link.href, type: link.type ?? 'espn' })) ?? [],
    rawSources: { fifa: false, espn: true },
  }
}

export async function loadWorldCupData(signal?: AbortSignal): Promise<WorldCupData> {
  const [fifaResult, espnResult] = await Promise.allSettled([
    fetchJson<FifaResponse>(FIFA_MATCHES_URL, signal),
    fetchJson<EspnScoreboard>(ESPN_SCOREBOARD_URL, signal),
  ])

  const sourceStates: SourceState[] = []
  const espnEvents = espnResult.status === 'fulfilled' ? espnResult.value.events ?? [] : []
  const teamMap = makeEspnTeamMap(espnEvents)

  if (fifaResult.status === 'fulfilled') {
    sourceStates.push({
      id: 'fifa',
      label: 'Official FIFA schedule',
      status: 'online',
      detail: `${fifaResult.value.Results?.length ?? 0} matches loaded`,
      href: FIFA_PUBLIC_SCHEDULE_URL,
    })
  } else {
    sourceStates.push({
      id: 'fifa',
      label: 'Official FIFA schedule',
      status: 'offline',
      detail: fifaResult.reason instanceof Error ? fifaResult.reason.message : 'FIFA feed failed',
      href: FIFA_PUBLIC_SCHEDULE_URL,
    })
  }

  if (espnResult.status === 'fulfilled') {
    sourceStates.push({
      id: 'espn',
      label: 'Live match details',
      status: espnEvents.length ? 'online' : 'degraded',
      detail: espnEvents.length ? 'Scores, logos and links connected' : 'Waiting for match detail feed',
      href: ESPN_PUBLIC_SCOREBOARD_URL,
    })
  } else {
    sourceStates.push({
      id: 'espn',
      label: 'Live match details',
      status: 'degraded',
      detail: espnResult.reason instanceof Error ? espnResult.reason.message : 'ESPN fallback failed',
      href: ESPN_PUBLIC_SCOREBOARD_URL,
    })
  }

  sourceStates.push({
    id: 'espn-teams',
    label: 'Team media',
    status: teamMap.size ? 'online' : 'degraded',
    detail: teamMap.size ? 'Logos and team links connected' : 'Logos will appear when available',
    href: FIFA_PUBLIC_TEAMS_URL,
  })

  const espnMap = buildEspnEventMap(espnEvents)
  const matches: Match[] =
    fifaResult.status === 'fulfilled' && fifaResult.value.Results?.length
      ? fifaResult.value.Results.map(makeFifaMatch).map((match) => {
          const event = espnMap.get(eventKey(match.dateUtc, match.home.code, match.away.code))
          return event ? mergeEspn(match, event, teamMap) : match
        })
      : (espnEvents.map((event) => makeMatchFromEspn(event, teamMap)).filter(Boolean) as Match[])

  if (!matches.length) throw new Error('No live source returned World Cup matches.')

  return {
    matches: matches.sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime()),
    sourceStates,
    updatedAt: new Date().toISOString(),
  }
}

function summarySource(status: SourceState['status'], detail: string): SourceState {
  return {
    id: 'espn-summary',
    label: 'ESPN match summary',
    status,
    detail,
    href: 'https://site.api.espn.com',
  }
}

type OpenMeteoGeocode = {
  results?: {
    name?: string
    latitude?: number
    longitude?: number
    country_code?: string
    country?: string
    admin1?: string
    timezone?: string
  }[]
}

type OpenMeteoWeather = {
  timezone?: string
  current?: {
    time?: string
    temperature_2m?: number
    weather_code?: number
    wind_speed_10m?: number
  }
}

const openMeteoCountryCodes: Record<string, string> = {
  USA: 'US',
  CAN: 'CA',
  MEX: 'MX',
}

function weatherCodeLabel(code?: number) {
  if (code === undefined) return undefined
  if (code === 0) return 'Clear'
  if ([1, 2, 3].includes(code)) return 'Cloud cover'
  if ([45, 48].includes(code)) return 'Fog'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow'
  if ([95, 96, 99].includes(code)) return 'Thunderstorm'
  return `Weather code ${code}`
}

function pickGeocodeResult(venue: Venue, results: NonNullable<OpenMeteoGeocode['results']>) {
  const expectedCountry = openMeteoCountryCodes[venue.country] ?? venue.country
  return (
    results.find((result) => result.country_code === expectedCountry) ??
    results.find((result) => result.country_code) ??
    results[0]
  )
}

function venueLookupQuery(venue: Venue) {
  const label = `${venue.name} ${venue.city}`
  if (/arlington/i.test(label)) return 'Arlington'
  if (/inglewood/i.test(label)) return 'Inglewood'
  if (/east rutherford|new york\/new jersey|new jersey/i.test(label)) return 'East Rutherford'
  if (/foxborough/i.test(label)) return 'Foxborough'
  if (/vancouver/i.test(label)) return 'Vancouver'
  if (/houston/i.test(label)) return 'Houston'
  if (/philadelphia/i.test(label)) return 'Philadelphia'
  if (/seattle/i.test(label)) return 'Seattle'
  if (/kansas city/i.test(label)) return 'Kansas City'
  if (/mexico city/i.test(label)) return 'Mexico City'
  if (/guadalajara/i.test(label)) return 'Guadalajara'
  if (/toronto/i.test(label)) return 'Toronto'
  if (/atlanta/i.test(label)) return 'Atlanta'
  if (/miami gardens/i.test(label)) return 'Miami Gardens'
  if (/\bmiami\b/i.test(label)) return 'Miami'
  if (/santa clara|san francisco bay area/i.test(label)) return 'Santa Clara'
  if (/guadalupe/i.test(label)) return 'Guadalupe'
  if (/monterrey/i.test(label)) return 'Monterrey'
  return venue.city
}

const hostCityCoordinateFallbacks: Record<string, { latitude: number; longitude: number; placeLabel: string }> = {
  'Mexico City': { latitude: 19.42847, longitude: -99.12766, placeLabel: 'Mexico City, Mexico' },
  Guadalajara: { latitude: 20.67738, longitude: -103.34749, placeLabel: 'Guadalajara, Jalisco, Mexico' },
  Toronto: { latitude: 43.70643, longitude: -79.39864, placeLabel: 'Toronto, Ontario, Canada' },
  'Los Angeles': { latitude: 34.05223, longitude: -118.24368, placeLabel: 'Los Angeles, California, United States' },
  Arlington: { latitude: 32.73569, longitude: -97.10807, placeLabel: 'Arlington, Texas, United States' },
  Inglewood: { latitude: 33.96168, longitude: -118.35313, placeLabel: 'Inglewood, California, United States' },
  'Santa Clara': { latitude: 37.35411, longitude: -121.95524, placeLabel: 'Santa Clara, California, United States' },
  'East Rutherford': { latitude: 40.83399, longitude: -74.09709, placeLabel: 'East Rutherford, New Jersey, United States' },
  Boston: { latitude: 42.35843, longitude: -71.05977, placeLabel: 'Boston, Massachusetts, United States' },
  Foxborough: { latitude: 42.06538, longitude: -71.24783, placeLabel: 'Foxborough, Massachusetts, United States' },
  Vancouver: { latitude: 49.24966, longitude: -123.11934, placeLabel: 'Vancouver, British Columbia, Canada' },
  Houston: { latitude: 29.76328, longitude: -95.36327, placeLabel: 'Houston, Texas, United States' },
  Dallas: { latitude: 32.78306, longitude: -96.80667, placeLabel: 'Dallas, Texas, United States' },
  Philadelphia: { latitude: 39.95238, longitude: -75.16362, placeLabel: 'Philadelphia, Pennsylvania, United States' },
  Monterrey: { latitude: 25.68435, longitude: -100.31721, placeLabel: 'Monterrey, Nuevo Leon, Mexico' },
  Guadalupe: { latitude: 25.67678, longitude: -100.25646, placeLabel: 'Guadalupe, Nuevo Leon, Mexico' },
  Atlanta: { latitude: 33.749, longitude: -84.38798, placeLabel: 'Atlanta, Georgia, United States' },
  Seattle: { latitude: 47.60621, longitude: -122.33207, placeLabel: 'Seattle, Washington, United States' },
  Miami: { latitude: 25.77427, longitude: -80.19366, placeLabel: 'Miami, Florida, United States' },
  'Miami Gardens': { latitude: 25.94204, longitude: -80.2456, placeLabel: 'Miami Gardens, Florida, United States' },
  'Kansas City': { latitude: 39.09973, longitude: -94.57857, placeLabel: 'Kansas City, Missouri, United States' },
}

async function loadOneVenueIntel(venue: Venue, signal?: AbortSignal): Promise<VenueIntel['records'][number]> {
  const scheduleLatitude = venue.latitude ?? undefined
  const scheduleLongitude = venue.longitude ?? undefined
  let latitude = scheduleLatitude
  let longitude = scheduleLongitude
  let timezone: string | undefined
  let placeLabel: string | undefined
  const lookupQuery = venueLookupQuery(venue)

  if (latitude === undefined || longitude === undefined) {
    try {
      const params = new URLSearchParams({
        name: lookupQuery,
        count: '5',
        language: 'en',
        format: 'json',
      })
      const geocode = await fetchJsonWithTimeout<OpenMeteoGeocode>(
        `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
        signal,
      )
      const result = pickGeocodeResult(venue, geocode.results ?? [])
      latitude = result?.latitude
      longitude = result?.longitude
      timezone = result?.timezone
      placeLabel = [result?.name, result?.admin1, result?.country].filter(Boolean).join(', ')
    } catch {
      const fallback = hostCityCoordinateFallbacks[lookupQuery]
      latitude = fallback?.latitude
      longitude = fallback?.longitude
      placeLabel = fallback?.placeLabel
    }
  }

  if ((latitude === undefined || longitude === undefined) && hostCityCoordinateFallbacks[lookupQuery]) {
    const fallback = hostCityCoordinateFallbacks[lookupQuery]
    latitude = fallback.latitude
    longitude = fallback.longitude
    placeLabel = placeLabel || fallback.placeLabel
  }

  if (latitude === undefined || longitude === undefined) {
    return {
      venueId: venue.id,
      detail: 'Coordinate lookup unavailable from free geocoding feed.',
    }
  }

  let weather: OpenMeteoWeather | undefined
  try {
    const weatherParams = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,weather_code,wind_speed_10m',
      timezone: 'auto',
    })
    weather = await fetchJsonWithTimeout<OpenMeteoWeather>(
      `https://api.open-meteo.com/v1/forecast?${weatherParams.toString()}`,
      signal,
    )
  } catch {
    weather = undefined
  }
  const currentWeather = weather?.current
  const weatherCode = currentWeather?.weather_code

  return {
    venueId: venue.id,
    latitude,
    longitude,
    timezone: weather?.timezone ?? timezone,
    placeLabel,
    weather: currentWeather
      ? {
          temperatureC: currentWeather.temperature_2m,
          windKph: currentWeather.wind_speed_10m,
          code: weatherCode,
          label: weatherCodeLabel(weatherCode),
          observedAt: currentWeather.time,
        }
      : undefined,
    detail: weather?.current ? 'Live weather connected from Open-Meteo.' : 'Coordinate connected; weather feed unavailable.',
  }
}

export async function loadVenueIntel(venues: Venue[], signal?: AbortSignal): Promise<VenueIntel> {
  const uniqueVenues = [...new Map(venues.map((venue) => [venue.id, venue])).values()]
  const records: VenueIntel['records'] = new Array(uniqueVenues.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < uniqueVenues.length) {
      const index = nextIndex
      nextIndex += 1
      const venue = uniqueVenues[index]
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      try {
        records[index] = await loadOneVenueIntel(venue, signal)
      } catch (error) {
        records[index] = {
          venueId: venue.id,
          detail: error instanceof Error ? error.message : 'Venue enrichment failed.',
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, uniqueVenues.length) }, () => worker()))
  const connected = records.filter((record) => record.latitude !== undefined && record.longitude !== undefined).length
  return {
    source: {
      id: 'open-meteo-venues',
      label: 'Venue weather',
      status: connected ? (connected === uniqueVenues.length ? 'online' : 'degraded') : 'offline',
      detail: connected
        ? `${connected}/${uniqueVenues.length} venue locations enriched`
        : 'Venue coordinate and weather enrichment unavailable',
      href: 'https://open-meteo.com/',
    },
    records,
    updatedAt: new Date().toISOString(),
  }
}

type ParsedLiveEvent = LiveEvent & { order: number }

function eventParticipants(event: EspnSummaryEvent) {
  return (
    event.athletesInvolved?.map((athlete) => athlete.displayName).filter(Boolean) ??
    event.participants?.map((participant) => participant.athlete?.displayName).filter(Boolean) ??
    []
  )
}

function eventOrder(event: EspnSummaryEvent, fallback: number) {
  return event.clock?.value ?? event.time?.value ?? fallback
}

function parseSummaryEvent(event: EspnSummaryEvent, index: number, prefix: string): ParsedLiveEvent {
  const participants = eventParticipants(event)
  return {
    id: event.id ?? `${prefix}-${index}`,
    minute: event.clock?.displayValue ?? event.time?.displayValue,
    team: event.team?.displayName ?? event.team?.abbreviation,
    athlete: participants.join(', '),
    type: event.type?.text ?? event.type?.abbreviation ?? 'Commentary',
    text: event.text ?? event.shortText ?? event.type?.text ?? 'Match event',
    order: eventOrder(event, index),
  }
}

function parseEvents(summary?: EspnSummary): LiveEvent[] {
  const parsedEvents: ParsedLiveEvent[] = []

  summary?.competitions?.[0]?.details?.forEach((event, index) => {
    parsedEvents.push(parseSummaryEvent(event, index, 'detail'))
  })

  summary?.commentary?.forEach((commentary, index) => {
    const event: EspnSummaryEvent = commentary.play
      ? {
          ...commentary.play,
          clock: commentary.play.clock ?? commentary.time,
          text: commentary.play.text ?? commentary.text,
        }
      : {
          id: `commentary-${commentary.sequence ?? index}`,
          clock: commentary.time,
          text: commentary.text,
          type: { text: 'Commentary' },
        }
    parsedEvents.push({
      ...parseSummaryEvent(event, commentary.sequence ?? index, 'commentary'),
      order: commentary.sequence ?? eventOrder(event, index),
    })
  })

  summary?.keyEvents?.forEach((event, index) => {
    parsedEvents.push(parseSummaryEvent(event, index, 'key-event'))
  })

  const seen = new Set<string>()
  return parsedEvents
    .filter((event) => {
      const key = event.id || `${event.minute ?? ''}|${event.text}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.order - b.order)
    .map((event) => ({
      id: event.id,
      minute: event.minute,
      team: event.team,
      athlete: event.athlete,
      type: event.type,
      text: event.text,
    }))
}

function parseStats(summary: EspnSummary | undefined): StatLine[] {
  const teams = summary?.boxscore?.teams ?? []
  const home = teams.find((team) => team.homeAway === 'home')?.statistics ?? []
  const away = teams.find((team) => team.homeAway === 'away')?.statistics ?? []
  if (!home.length || !away.length) return []

  return home
    .map((stat) => {
      const awayStat = away.find((candidate) => candidate.name === stat.name || candidate.label === stat.label)
      if (!awayStat) return null
      return {
        label: stat.displayName ?? stat.label ?? stat.name ?? 'Stat',
        home: stat.displayValue ?? '-',
        away: awayStat.displayValue ?? '-',
      }
    })
    .filter(Boolean) as StatLine[]
}

function summaryTeamForMatch(
  match: Match,
  team?: { id?: string; abbreviation?: string; displayName?: string },
  homeAway?: string,
) {
  if (homeAway === 'home') return match.home
  if (homeAway === 'away') return match.away
  if (team?.abbreviation === match.home.code || team?.id === match.home.id) return match.home
  if (team?.abbreviation === match.away.code || team?.id === match.away.id) return match.away
  return undefined
}

function shirtNumber(value?: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 999
}

function parseLineups(summary: EspnSummary | undefined, match: Match): LineupGroup[] {
  const rosterLineups =
    summary?.rosters
      ?.map((group) => {
        const team = summaryTeamForMatch(match, group.team, group.homeAway)
        const players =
          group.roster
            ?.filter((entry) => entry.active !== false)
            .map((entry, index) => {
              const name = entry.athlete?.displayName ?? entry.athlete?.fullName ?? entry.athlete?.shortName
              if (!name) return null
              return {
                id: entry.athlete?.id ?? `${team?.id ?? group.team?.abbreviation ?? 'team'}-${index}`,
                name,
                position: entry.position?.abbreviation ?? entry.position?.displayName ?? entry.position?.name,
                shirt: entry.jersey,
                starter: entry.starter,
              }
            })
            .filter(isDefined)
            .sort((a, b) => {
              const starterOrder = Number(b.starter === true) - Number(a.starter === true)
              return starterOrder || shirtNumber(a.shirt) - shirtNumber(b.shirt) || a.name.localeCompare(b.name)
            }) ?? []
        if (!team || !players.length) return null
        return { team, formation: group.formation, players }
      })
      .filter(isDefined) ?? []

  if (rosterLineups.length) return rosterLineups as LineupGroup[]

  const players = summary?.boxscore?.players ?? []
  return players
    .map((group) => {
      const team = summaryTeamForMatch(match, group.team)
      const athletes =
        group.statistics
          ?.flatMap((statGroup) => statGroup.athletes ?? [])
          .map((entry) => ({
            id: entry.athlete?.id ?? entry.athlete?.displayName ?? 'player',
            name: entry.athlete?.displayName ?? 'Player',
            position: entry.athlete?.position?.abbreviation,
            shirt: entry.athlete?.jersey,
            starter: entry.starter,
          })) ?? []
      if (!team || !athletes.length) return null
      return { team, players: athletes }
    })
    .filter(Boolean) as LineupGroup[]
}

function parsePlayerCards(summary: EspnSummary | undefined) {
  const candidates: EspnSummaryEvent[] = [
    ...(summary?.competitions?.[0]?.details ?? []),
    ...(summary?.keyEvents ?? []),
    ...((summary?.commentary?.map((commentary) => commentary.play).filter(isDefined) as EspnSummaryEvent[] | undefined) ?? []),
  ]
  const seen = new Set<string>()
  return candidates
    .filter((event) => {
      const text = `${event.type?.text ?? ''} ${event.type?.type ?? ''} ${event.text ?? ''} ${event.shortText ?? ''}`.toLowerCase()
      return text.includes('yellow') || text.includes('red') || text.includes('card')
    })
    .filter((event, index) => {
      const key = event.id ?? `${event.clock?.displayValue ?? index}|${event.text}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((event, index) => ({
      id: event.id ?? `card-${index}`,
      name: eventParticipants(event)[0] ?? 'Player',
      team: event.team?.displayName ?? event.team?.abbreviation ?? 'Team',
      detail: event.text ?? event.shortText ?? event.type?.text ?? 'Card',
    }))
}

function parseForm(summary: EspnSummary | undefined, match: Match) {
  return (
    summary?.boxscore?.form
      ?.map((form) => {
        const team = form.team?.abbreviation === match.home.code ? match.home : match.away
        return {
          team,
          recent: form.events?.map((event) => event.gameResult ?? '').filter(Boolean) ?? [],
        }
      })
      .filter((form) => form.recent.length) ?? []
  )
}

function parseHeadToHead(summary: EspnSummary | undefined): ExternalLink[] {
  return (
    summary?.headToHeadGames
      ?.flatMap((group) => group.events ?? [])
      .map((event) => {
        const firstLink = event.links?.[0]
        if (!firstLink?.href) return null
        return {
          label: `${event.score ?? 'Previous meeting'}${event.gameDate ? ` · ${new Date(event.gameDate).getFullYear()}` : ''}`,
          href: firstLink.href,
          type: 'espn',
        }
      })
      .filter(Boolean) as ExternalLink[]
  )
}

function profileSource(status: SourceState['status'], detail: string): SourceState {
  return {
    id: 'espn-team-profile',
    label: 'Team profile',
    status,
    detail,
    href: 'https://site.api.espn.com',
  }
}

function teamMatches(team: Team, matches: Match[]) {
  return matches.filter(
    (match) =>
      match.home.code === team.code ||
      match.away.code === team.code ||
      match.home.id === team.id ||
      match.away.id === team.id,
  )
}

function getScheduleNextEvent(team: Team, matches: Match[]): TeamProfile['nextEvent'] {
  const scheduled = teamMatches(team, matches).sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())
  const next = scheduled.find((match) => new Date(match.dateUtc).getTime() >= Date.now()) ?? scheduled[0]
  if (!next) return undefined
  return {
    name: `${next.home.shortName} vs ${next.away.shortName}`,
    dateUtc: next.dateUtc,
    venue: `${next.venue.name}, ${next.venue.city}`,
    status: next.status.label,
  }
}

function parseNextEvent(details: EspnTeamDetails['team'], team: Team, matches: Match[]): TeamProfile['nextEvent'] {
  const next = details?.nextEvent?.[0]
  const competition = next?.competitions?.[0]
  const venue = competition?.venue
  if (next) {
    return {
      name: next.name,
      dateUtc: next.date,
      venue: venue?.fullName
        ? `${venue.fullName}${venue.address?.city ? `, ${venue.address.city}` : ''}`
        : undefined,
      status: competition?.status?.type?.shortDetail ?? competition?.status?.type?.description,
    }
  }
  return getScheduleNextEvent(team, matches)
}

function parseRecord(details: EspnTeamDetails['team']) {
  return (
    details?.record?.items?.find((item) => item.type === 'total')?.summary ??
    details?.record?.items?.find((item) => item.summary)?.summary
  )
}

function parseStaff(roster?: EspnRoster): TeamStaff[] {
  return (
    roster?.coach
      ?.map((coach, index) => {
        const name = coach.displayName ?? [coach.firstName, coach.lastName].filter(Boolean).join(' ')
        if (!name) return null
        return {
          id: coach.id ?? `staff-${index}`,
          name,
          role: coach.role ?? (index === 0 ? 'Head coach / manager' : 'Technical staff'),
          headshot: coach.headshot?.href,
        }
      })
      .filter(Boolean) as TeamStaff[]
  ) ?? []
}

function parsePlayer(athlete: EspnAthlete, index: number): TeamPlayer | null {
  const name = athlete.displayName ?? athlete.shortName
  if (!name) return null
  const injuries =
    athlete.injuries
      ?.map((injury) => injury.displayName ?? injury.detail ?? [injury.type, injury.status, injury.name].filter(Boolean).join(' - '))
      .filter(Boolean) ?? []
  return {
    id: athlete.id ?? `player-${index}`,
    name,
    shortName: athlete.shortName,
    jersey: athlete.jersey,
    position: athlete.position?.displayName ?? athlete.position?.name ?? athlete.position?.abbreviation,
    age: athlete.age,
    height: athlete.displayHeight,
    weight: athlete.displayWeight,
    headshot: athlete.headshot?.href,
    status: athlete.status?.name ?? athlete.status?.abbreviation,
    injuries,
    links: espnLinksToExternal(athlete.links),
  }
}

function formatFifaImage(url?: string, width = 160) {
  if (!url) return undefined
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}io=transform:fill,aspectratio:1x1,width:${width}&quality=80`
}

function normalizePersonName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
}

function personNameKeys(...values: (string | undefined)[]) {
  return [...new Set(values.map((value) => (value ? normalizePersonName(value) : '')).filter(Boolean))]
}

function isFifaImage(url?: string) {
  return Boolean(url?.includes('digitalhub.fifa.com'))
}

function isWikimediaImage(url?: string) {
  return Boolean(url?.includes('upload.wikimedia.org'))
}

function fifaSquadUrl(teamId: string, seasonId: string) {
  return `https://api.fifa.com/api/v3/teams/${teamId}/squad?idCompetition=${FIFA_COMPETITION_ID}&idSeason=${seasonId}&language=en`
}

async function loadFifaSquads(teamId: string, signal?: AbortSignal): Promise<FifaSquadWithSeason[]> {
  const results = await Promise.allSettled(
    FIFA_SQUAD_SEASONS.map(async (season) => {
      const squad = await fetchJson<FifaSquad>(fifaSquadUrl(teamId, season.id), signal)
      return {
        ...squad,
        seasonId: season.id,
        seasonLabel: season.label,
      }
    }),
  )

  const abort = results.find(
    (result) => result.status === 'rejected' && result.reason instanceof DOMException && result.reason.name === 'AbortError',
  )
  if (abort?.status === 'rejected') throw abort.reason

  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
}

type FifaPlayerCandidate = {
  player: FifaSquadPlayer
  seasonId: string
}

type WikimediaImageResult = {
  image?: string
  pageUrl?: string
}

type WikimediaPage = {
  title?: string
  fullurl?: string
  thumbnail?: { source?: string }
  extract?: string
  index?: number
}

type WikimediaResponse = {
  query?: {
    pages?: Record<string, WikimediaPage>
  }
}

const wikimediaImageCache = new Map<string, Promise<WikimediaImageResult>>()

function getFifaPlayerLookups(squads: FifaSquadWithSeason[]) {
  const currentByJersey = new Map<string, FifaSquadPlayer>()
  const currentByName = new Map<string, FifaSquadPlayer>()
  const photoById = new Map<string, FifaPlayerCandidate>()
  const photoByName = new Map<string, FifaPlayerCandidate>()
  const currentPhotoByJersey = new Map<string, FifaPlayerCandidate>()
  const currentSquad = squads.find((squad) => squad.seasonId === FIFA_SEASON_ID) ?? squads[0]

  for (const player of currentSquad?.Players ?? []) {
    if (player.JerseyNum !== undefined) currentByJersey.set(String(player.JerseyNum), player)
    for (const key of personNameKeys(label(player.PlayerName), label(player.ShortName))) {
      currentByName.set(key, player)
    }
  }

  for (const squad of squads) {
    for (const player of squad.Players ?? []) {
      if (!player.PlayerPicture?.PictureUrl) continue
      const candidate = { player, seasonId: squad.seasonId }
      if (player.IdPlayer && !photoById.has(player.IdPlayer)) photoById.set(player.IdPlayer, candidate)
      for (const key of personNameKeys(label(player.PlayerName), label(player.ShortName))) {
        if (!photoByName.has(key)) photoByName.set(key, candidate)
      }
      if (squad.seasonId === FIFA_SEASON_ID && player.JerseyNum !== undefined) {
        currentPhotoByJersey.set(String(player.JerseyNum), candidate)
      }
    }
  }

  return { currentByJersey, currentByName, currentPhotoByJersey, photoById, photoByName }
}

function enrichPlayersWithFifaImages(players: TeamPlayer[], squads: FifaSquadWithSeason[]) {
  const lookups = getFifaPlayerLookups(squads)
  return players.map((player) => {
    const nameKeys = personNameKeys(player.name, player.shortName)
    const infoPlayer =
      (player.jersey ? lookups.currentByJersey.get(player.jersey) : undefined) ??
      nameKeys.map((key) => lookups.currentByName.get(key)).find(Boolean)
    const photoCandidate =
      lookups.photoById.get(player.id) ??
      nameKeys.map((key) => lookups.photoByName.get(key)).find(Boolean) ??
      (player.jersey ? lookups.currentPhotoByJersey.get(player.jersey) : undefined)
    const fifaHeadshot = formatFifaImage(photoCandidate?.player.PlayerPicture?.PictureUrl)
    const fifaInfoPlayer = infoPlayer ?? photoCandidate?.player

    if (!fifaHeadshot && !fifaInfoPlayer) return player
    return {
      ...player,
      headshot: fifaHeadshot ?? player.headshot,
      position:
        player.position ||
        label(fifaInfoPlayer?.PositionLocalized) ||
        label(fifaInfoPlayer?.RealPositionLocalized) ||
        undefined,
      height: player.height ?? (fifaInfoPlayer?.Height ? `${fifaInfoPlayer.Height} cm` : undefined),
      weight: player.weight ?? (fifaInfoPlayer?.Weight ? `${fifaInfoPlayer.Weight} kg` : undefined),
    }
  })
}

function nameTokens(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/i)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 1)
}

function isLikelyPersonImagePage(page: WikimediaPage, name: string) {
  if (!page.thumbnail?.source || !page.title) return false
  const extract = page.extract?.toLowerCase() ?? ''
  const title = page.title.replace(/\(.+\)/, '')
  const titleKey = normalizePersonName(title)
  const nameKey = normalizePersonName(name)
  const tokens = nameTokens(name)
  const first = tokens[0]
  const last = tokens[tokens.length - 1]
  const hasNameMatch =
    titleKey === nameKey ||
    Boolean(first && last && titleKey.includes(first) && titleKey.includes(last)) ||
    Boolean(last && titleKey.includes(last) && extract.includes('footballer'))
  return hasNameMatch && /footballer|association football|soccer player|football manager|football coach/.test(extract)
}

async function lookupWikimediaImage(name: string, signal?: AbortSignal): Promise<WikimediaImageResult> {
  const cacheKey = normalizePersonName(name)
  const cached = wikimediaImageCache.get(cacheKey)
  if (cached) return cached

  const request = (async () => {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: `${name} footballer`,
      gsrlimit: '3',
      prop: 'pageimages|info|extracts',
      piprop: 'thumbnail',
      pithumbsize: '220',
      inprop: 'url',
      exintro: '1',
      explaintext: '1',
    })
    const data = await fetchJson<WikimediaResponse>(`https://en.wikipedia.org/w/api.php?${params.toString()}`, signal)
    const page = Object.values(data.query?.pages ?? {})
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .find((candidate) => isLikelyPersonImagePage(candidate, name))
    return {
      image: page?.thumbnail?.source,
      pageUrl: page?.fullurl,
    }
  })()

  wikimediaImageCache.set(cacheKey, request)
  return request
}

async function enrichPlayersWithWikimediaImages(players: TeamPlayer[], signal?: AbortSignal) {
  const enriched = await Promise.allSettled(
    players.map(async (player) => {
      if (player.headshot) return player
      const result = await lookupWikimediaImage(player.name, signal)
      if (!result.image) return player
      return {
        ...player,
        headshot: result.image,
        links: uniqueLinks([
          ...player.links,
          ...(result.pageUrl
            ? [{ label: 'Photo source: Wikipedia', href: result.pageUrl, type: 'image-source' }]
            : []),
        ]),
      }
    }),
  )

  const abort = enriched.find(
    (result) => result.status === 'rejected' && result.reason instanceof DOMException && result.reason.name === 'AbortError',
  )
  if (abort?.status === 'rejected') throw abort.reason
  return enriched.map((result, index) => (result.status === 'fulfilled' ? result.value : players[index]))
}

function getFifaStaffPhotoLookup(squads: FifaSquadWithSeason[]) {
  const byName = new Map<string, FifaSquadOfficial>()
  for (const squad of squads) {
    for (const official of squad.Officials ?? []) {
      if (!official.PictureUrl) continue
      for (const key of personNameKeys(label(official.Alias), label(official.Name))) {
        if (!byName.has(key)) byName.set(key, official)
      }
    }
  }
  return byName
}

function enrichStaffWithFifaImages(staff: TeamStaff[], squads: FifaSquadWithSeason[]) {
  const photoByName = getFifaStaffPhotoLookup(squads)
  return staff.map((member) => {
    const photoOfficial = personNameKeys(member.name)
      .map((key) => photoByName.get(key))
      .find(Boolean)
    return {
      ...member,
      headshot: formatFifaImage(photoOfficial?.PictureUrl ?? undefined, 180) ?? member.headshot,
    }
  })
}

async function enrichStaffWithWikimediaImages(staff: TeamStaff[], signal?: AbortSignal) {
  const enriched = await Promise.allSettled(
    staff.map(async (member) => {
      if (member.headshot || nameTokens(member.name).length < 2) return member
      const result = await lookupWikimediaImage(member.name, signal)
      if (!result.image) return member
      return {
        ...member,
        headshot: result.image,
        links: uniqueLinks([
          ...(member.links ?? []),
          ...(result.pageUrl
            ? [{ label: 'Photo source: Wikipedia', href: result.pageUrl, type: 'image-source' }]
            : []),
        ]),
      }
    }),
  )

  const abort = enriched.find(
    (result) => result.status === 'rejected' && result.reason instanceof DOMException && result.reason.name === 'AbortError',
  )
  if (abort?.status === 'rejected') throw abort.reason
  return enriched.map((result, index) => (result.status === 'fulfilled' ? result.value : staff[index]))
}

function parseFifaStaff(squads: FifaSquadWithSeason[]): TeamStaff[] {
  const primarySquad = squads.find((squad) => squad.seasonId === FIFA_SEASON_ID) ?? squads[0]
  const photoByName = getFifaStaffPhotoLookup(squads)
  return (
    primarySquad?.Officials?.map((official, index) => {
      const name = label(official.Alias) || label(official.Name)
      if (!name) return null
      const photoOfficial = personNameKeys(name)
        .map((key) => photoByName.get(key))
        .find(Boolean)
      return {
        id: official.IdCoach ?? `fifa-staff-${index}`,
        name,
        role: official.Role === 0 ? 'Manager / head coach' : 'Technical staff',
        headshot: formatFifaImage(official.PictureUrl ?? photoOfficial?.PictureUrl ?? undefined, 180),
      }
    }).filter(Boolean) as TeamStaff[]
  ) ?? []
}

function parseFifaPlayers(squad?: FifaSquadWithSeason): TeamPlayer[] {
  return (
    squad?.Players?.map((player, index) => {
      const name = label(player.PlayerName) || label(player.ShortName)
      if (!name) return null
      return {
        id: player.IdPlayer ?? `fifa-player-${index}`,
        name,
        shortName: label(player.ShortName),
        jersey: player.JerseyNum !== undefined ? String(player.JerseyNum) : undefined,
        position: label(player.PositionLocalized) || label(player.RealPositionLocalized),
        height: player.Height ? `${player.Height} cm` : undefined,
        weight: player.Weight ? `${player.Weight} kg` : undefined,
        headshot: formatFifaImage(player.PlayerPicture?.PictureUrl),
        status: 'Active',
        injuries: [],
        links: [],
      }
    }).filter(Boolean) as TeamPlayer[]
  ) ?? []
}

function buildTeamProfileFallback(team: Team, matches: Match[], detail: string): TeamProfile {
  const nextEvent = getScheduleNextEvent(team, matches)
  const updates: TeamUpdate[] = nextEvent
    ? [
        {
          id: 'next-event',
          label: 'Next match',
          detail: [nextEvent.name, nextEvent.status].filter(Boolean).join(' - '),
        },
      ]
    : []

  return {
    source: profileSource('degraded', detail),
    team,
    nextEvent,
    roster: [],
    staff: [],
    injuries: [],
    updates,
    links: uniqueLinks(team.links ?? []),
  }
}

export async function loadTeamProfile(team: Team, matches: Match[], signal?: AbortSignal): Promise<TeamProfile> {
  const espnTeamId = /^\d+$/.test(team.id) ? team.id : undefined
  const fifaTeamId = team.fifaId

  if (!espnTeamId && !fifaTeamId) {
    return buildTeamProfileFallback(team, matches, 'Team roster source is not linked for this nation yet.')
  }

  const detailsPromise: Promise<EspnTeamDetails> = espnTeamId
    ? fetchJson<EspnTeamDetails>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${espnTeamId}`,
        signal,
      )
    : Promise.resolve({})
  const rosterPromise: Promise<EspnRoster> = espnTeamId
    ? fetchJson<EspnRoster>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${espnTeamId}/roster`,
        signal,
      )
    : Promise.resolve({})
  const fifaSquadsPromise: Promise<FifaSquadWithSeason[]> = fifaTeamId ? loadFifaSquads(fifaTeamId, signal) : Promise.resolve([])

  const [detailsResult, rosterResult, fifaSquadsResult] = await Promise.allSettled([
    detailsPromise,
    rosterPromise,
    fifaSquadsPromise,
  ])

  if (detailsResult.status === 'rejected' && rosterResult.status === 'rejected' && fifaSquadsResult.status === 'rejected') {
    const message =
      detailsResult.reason instanceof Error ? detailsResult.reason.message : 'Team profile source failed.'
    return buildTeamProfileFallback(team, matches, message)
  }

  const details = detailsResult.status === 'fulfilled' ? detailsResult.value.team : undefined
  const roster = rosterResult.status === 'fulfilled' ? rosterResult.value : undefined
  const fifaSquads = fifaSquadsResult.status === 'fulfilled' ? fifaSquadsResult.value : []
  const primaryFifaSquad = fifaSquads.find((squad) => squad.seasonId === FIFA_SEASON_ID) ?? fifaSquads[0]
  const profileTeam: Team = {
    ...team,
    id: details?.id ?? team.id,
    fifaId: team.fifaId,
    name: details?.displayName ?? team.name,
    shortName: details?.shortDisplayName ?? team.shortName,
    code: details?.abbreviation ?? team.code,
    logo: details?.logos?.[0]?.href ?? team.logo,
    color: details?.color ?? team.color,
    links: uniqueLinks([
      ...(team.links ?? []),
      { label: 'FIFA teams hub', href: FIFA_PUBLIC_TEAMS_URL, type: 'official' },
      ...espnLinksToExternal(details?.links),
    ]),
  }
  const rosterPlayers = roster?.athletes?.map(parsePlayer).filter(Boolean) as TeamPlayer[] | undefined
  const players = await enrichPlayersWithWikimediaImages(
    enrichPlayersWithFifaImages(rosterPlayers?.length ? rosterPlayers : parseFifaPlayers(primaryFifaSquad), fifaSquads),
    signal,
  )
  const fifaStaff = parseFifaStaff(fifaSquads)
  const staff = await enrichStaffWithWikimediaImages(
    enrichStaffWithFifaImages(fifaStaff.length ? fifaStaff : parseStaff(roster), fifaSquads),
    signal,
  )
  const nextEvent = parseNextEvent(details, profileTeam, matches)
  const updates: TeamUpdate[] = []
  const playerPhotos = players.filter((player) => player.headshot).length
  const fifaPlayerPhotos = players.filter((player) => isFifaImage(player.headshot)).length
  const wikimediaPlayerPhotos = players.filter((player) => isWikimediaImage(player.headshot)).length
  const espnPlayerPhotos = players.filter(
    (player) => player.headshot && !isFifaImage(player.headshot) && !isWikimediaImage(player.headshot),
  ).length
  const staffPhotos = staff.filter((member) => member.headshot).length
  const photoSources = [
    ...(fifaSquads.some((squad) => squad.Players?.some((player) => player.PlayerPicture?.PictureUrl)) ? ['FIFA'] : []),
    ...(players.some((player) => player.headshot && !isFifaImage(player.headshot) && !isWikimediaImage(player.headshot))
      ? ['ESPN']
      : []),
    ...(wikimediaPlayerPhotos ? ['Wikimedia'] : []),
  ]

  if (nextEvent) {
    updates.push({
      id: 'next-event',
      label: 'Next match',
      detail: [nextEvent.name, nextEvent.status].filter(Boolean).join(' - '),
    })
  }

  if (roster?.timestamp) {
    updates.push({
      id: 'roster-timestamp',
      label: 'Roster feed',
      detail: `Roster snapshot published ${roster.timestamp}`,
    })
  }

  if (fifaSquads.length && players.length) {
    updates.push({
      id: 'photo-coverage',
      label: 'Photo coverage',
      detail: `${playerPhotos}/${players.length} player photos connected from ${photoSources.length ? photoSources.join(' and ') : 'the free roster feeds'}`,
    })
  }

  if (staff.length) {
    updates.push({
      id: 'staff-feed',
      label: 'Staff feed',
      detail: `${staff.length} staff ${staff.length === 1 ? 'member' : 'members'} listed by the roster source`,
    })
  }

  const photoParts = [
    fifaPlayerPhotos ? `${fifaPlayerPhotos} official FIFA photos` : null,
    espnPlayerPhotos ? `${espnPlayerPhotos} ESPN images` : null,
    wikimediaPlayerPhotos ? `${wikimediaPlayerPhotos} Wikimedia images` : null,
  ].filter(Boolean)
  const photoDetail = players.length
    ? `${playerPhotos}/${players.length} player photos connected${photoParts.length ? `, including ${photoParts.join(' and ')}` : ''}`
    : 'Roster details are not available right now'
  const sourceDetail =
    playerPhotos
      ? `${players.length} players loaded; ${photoDetail}`
      : detailsResult.status === 'fulfilled' && rosterResult.status === 'fulfilled'
        ? `${players.length} players and team profile loaded`
        : detailsResult.status === 'fulfilled'
          ? 'Team profile loaded; roster feed is not available right now'
          : `${players.length} roster players loaded; team profile is not available right now`

  return {
    source: profileSource(players.length || details ? 'online' : 'degraded', sourceDetail),
    team: profileTeam,
    record: parseRecord(details),
    standingSummary: details?.standingSummary,
    nextEvent,
    roster: players,
    staff,
    injuries: players.filter((player) => player.injuries.length),
    updates,
    links: profileTeam.links ?? [],
    rosterUpdatedAt: roster?.timestamp,
    photoCoverage: {
      players: players.length,
      playerPhotos,
      fifaPlayerPhotos,
      wikimediaPlayerPhotos,
      staff: staff.length,
      staffPhotos,
      sources: photoSources,
    },
  }
}

export async function loadMatchExtras(match: Match, signal?: AbortSignal): Promise<MatchExtras> {
  if (!match.espnId) {
    return {
      summarySource: summarySource('degraded', 'Extra match details are not linked yet.'),
      events: [],
      stats: [],
      lineups: [],
      playerCards: [],
      form: [],
      headToHead: [],
      broadcasts: [],
    }
  }

  try {
    const summary = await fetchJson<EspnSummary>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${match.espnId}`,
      signal,
    )

    const events = parseEvents(summary)
    const stats = parseStats(summary)
    const lineups = parseLineups(summary, match)
    const playerCards = parsePlayerCards(summary)

    return {
      summarySource: summarySource(
        events.length || stats.length || lineups.length ? 'online' : 'degraded',
        events.length || stats.length || lineups.length
          ? 'Live match details are available.'
          : 'Line-ups, events and stats are not published for this match yet.',
      ),
      events,
      stats,
      lineups,
      playerCards,
      form: parseForm(summary, match),
      headToHead: parseHeadToHead(summary),
      broadcasts:
        summary.broadcasts
          ?.map((broadcast) => broadcast.media?.shortName ?? broadcast.media?.name)
          .filter(Boolean) as string[],
    }
  } catch (error) {
    return {
      summarySource: summarySource(
        'offline',
        error instanceof Error ? error.message : 'Match summary source failed.',
      ),
      events: [],
      stats: [],
      lineups: [],
      playerCards: [],
      form: [],
      headToHead: [],
      broadcasts: [],
    }
  }
}

function statNumber(value?: string) {
  if (!value) return null
  const normalized = value.replace(/,/g, '')
  const match = normalized.match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : null
}

type MutableTeamStat = TournamentTeamStat & {
  possessionTotal: number
  possessionCount: number
}

function emptyTeamStat(team: Team): MutableTeamStat {
  return {
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    cleanSheets: 0,
    shots: null,
    shotsOnTarget: null,
    possessionAverage: null,
    possessionTotal: 0,
    possessionCount: 0,
  }
}

function ensureTeamStat(map: Map<string, MutableTeamStat>, team: Team) {
  const existing = map.get(team.code)
  if (existing) return existing
  const row = emptyTeamStat(team)
  map.set(team.code, row)
  return row
}

function addNullableTotal(value: number | null, current: number | null) {
  if (value === null || Number.isNaN(value)) return current
  return (current ?? 0) + value
}

function addMatchResult(row: MutableTeamStat, goalsFor: number, goalsAgainst: number) {
  row.played += 1
  row.goalsFor += goalsFor
  row.goalsAgainst += goalsAgainst
  row.goalDifference = row.goalsFor - row.goalsAgainst
  if (goalsAgainst === 0) row.cleanSheets += 1
  if (goalsFor > goalsAgainst) {
    row.won += 1
    row.points += 3
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1
    row.points += 1
  } else {
    row.lost += 1
  }
}

function addSummaryTeamStats(row: MutableTeamStat, stats: StatLine[], side: 'home' | 'away') {
  for (const stat of stats) {
    const labelText = stat.label.toLowerCase()
    const value = statNumber(side === 'home' ? stat.home : stat.away)
    if (value === null) continue

    if (labelText.includes('possession')) {
      row.possessionTotal += value
      row.possessionCount += 1
    } else if (labelText.includes('shot') && labelText.includes('target')) {
      row.shotsOnTarget = addNullableTotal(value, row.shotsOnTarget)
    } else if (labelText.includes('shot')) {
      row.shots = addNullableTotal(value, row.shots)
    }
  }
}

function playerKey(team: string, name: string) {
  return `${team || 'Team'}:${normalizePersonName(name)}`
}

function ensurePlayerStat(map: Map<string, TournamentPlayerStat>, name: string, team: string) {
  const key = playerKey(team, name)
  const existing = map.get(key)
  if (existing) return existing
  const row: TournamentPlayerStat = {
    id: key,
    name,
    team: team || 'Team',
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    appearances: 0,
  }
  map.set(key, row)
  return row
}

function addPlayerEvents(summary: EspnSummary | undefined, players: Map<string, TournamentPlayerStat>) {
  for (const event of summary?.competitions?.[0]?.details ?? []) {
    const text = `${event.type?.text ?? ''} ${event.type?.abbreviation ?? ''} ${event.text ?? ''}`.toLowerCase()
    const names = event.athletesInvolved?.map((athlete) => athlete.displayName).filter(Boolean) ?? []
    const team = event.team?.abbreviation ?? event.team?.displayName ?? 'Team'
    const primary = names[0]
    if (!primary) continue

    if (text.includes('goal') && !text.includes('disallowed')) {
      ensurePlayerStat(players, primary, team).goals += 1
      const assister = names[1]
      if (assister) ensurePlayerStat(players, assister, team).assists += 1
    }

    if (text.includes('yellow')) ensurePlayerStat(players, primary, team).yellowCards += 1
    if (text.includes('red')) ensurePlayerStat(players, primary, team).redCards += 1
  }
}

function addLineupAppearances(lineups: LineupGroup[], players: Map<string, TournamentPlayerStat>) {
  for (const lineup of lineups) {
    const seen = new Set<string>()
    for (const player of lineup.players) {
      const key = playerKey(lineup.team.code, player.name)
      if (seen.has(key)) continue
      seen.add(key)
      ensurePlayerStat(players, player.name, lineup.team.code).appearances += 1
    }
  }
}

function shouldLoadSummaryForStats(match: Match) {
  if (!match.espnId) return false
  if (match.status.state === 'live' || match.status.state === 'halftime' || match.status.state === 'fulltime') return true
  return new Date(match.dateUtc).getTime() <= Date.now()
}

export async function loadTournamentStats(matches: Match[], signal?: AbortSignal): Promise<TournamentStats> {
  const teams = new Map<string, MutableTeamStat>()
  const players = new Map<string, TournamentPlayerStat>()
  const matchesForSummaries = matches.filter(shouldLoadSummaryForStats)

  for (const match of matches) {
    const home = ensureTeamStat(teams, match.home)
    const away = ensureTeamStat(teams, match.away)
    const hasScore = match.homeScore !== null && match.awayScore !== null
    const scoreCounts = hasScore && match.status.state !== 'scheduled'
    if (scoreCounts) {
      addMatchResult(home, match.homeScore ?? 0, match.awayScore ?? 0)
      addMatchResult(away, match.awayScore ?? 0, match.homeScore ?? 0)
    }
  }

  const summaryResults = await Promise.allSettled(
    matchesForSummaries.map(async (match) => {
      const summary = await fetchJson<EspnSummary>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${match.espnId}`,
        signal,
      )
      return { match, summary }
    }),
  )

  const abort = summaryResults.find(
    (result) => result.status === 'rejected' && result.reason instanceof DOMException && result.reason.name === 'AbortError',
  )
  if (abort?.status === 'rejected') throw abort.reason

  let summariesLoaded = 0
  for (const result of summaryResults) {
    if (result.status !== 'fulfilled') continue
    summariesLoaded += 1
    const { match, summary } = result.value
    const stats = parseStats(summary)
    addSummaryTeamStats(ensureTeamStat(teams, match.home), stats, 'home')
    addSummaryTeamStats(ensureTeamStat(teams, match.away), stats, 'away')
    addPlayerEvents(summary, players)
    addLineupAppearances(parseLineups(summary, match), players)
  }

  const teamRows = [...teams.values()]
    .map(({ possessionTotal, possessionCount, ...row }) => ({
      ...row,
      possessionAverage: possessionCount ? Math.round(possessionTotal / possessionCount) : null,
    }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)

  const playerRows = [...players.values()].sort(
    (a, b) =>
      b.goals - a.goals ||
      b.assists - a.assists ||
      b.appearances - a.appearances ||
      a.name.localeCompare(b.name),
  )

  const detail = matchesForSummaries.length
    ? `${summariesLoaded}/${matchesForSummaries.length} match summaries loaded for live stat aggregation`
    : 'Waiting for the first live or completed match before player stat rows appear'

  return {
    source: summarySource(summariesLoaded ? 'online' : matchesForSummaries.length ? 'degraded' : 'degraded', detail),
    teamRows,
    playerRows,
    sourceLinks: [
      { label: 'ESPN World Cup schedule and stats', href: ESPN_PUBLIC_SCHEDULE_URL, type: 'stats' },
      { label: 'FotMob World Cup match centre', href: FOTMOB_PUBLIC_WORLD_CUP_URL, type: 'external-stats' },
      { label: 'GOAL live scores', href: GOAL_PUBLIC_LIVE_SCORES_URL, type: 'external-stats' },
    ],
    matchesChecked: matchesForSummaries.length,
    summariesLoaded,
    updatedAt: new Date().toISOString(),
  }
}

export const watchSources: ExternalLink[] = [
  {
    label: 'ZEE5 - official streaming in India',
    href: 'https://www.zee5.com/sports',
    type: 'official',
  },
  {
    label: 'ZEE5 help: FIFA World Cup 2026 on ZEE5',
    href: 'https://helpcenter.zee5.com/portal/en/kb/articles/watch-fifa-world-cup-2026-on-zee5',
    type: 'official',
  },
  {
    label: 'FIFA announcement: Z and UNITE8 rights in India',
    href: 'https://vod.fifa.com/tournament-organisation/commercial/fifa-tv/media-releases/z-announce-agreement-world-cup-2026-major-fifa-tournaments-india-2034',
    type: 'official',
  },
]
