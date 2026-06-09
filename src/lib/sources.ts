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
  Venue,
  WorldCupData,
} from '../types'

const FIFA_MATCHES_URL =
  'https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idCompetition=17&from=2026-06-11&to=2026-07-20'
const ESPN_SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200'
const FIFA_PUBLIC_SCHEDULE_URL = 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/schedule'
const ESPN_PUBLIC_SCOREBOARD_URL = 'https://www.espn.com/soccer/scoreboard/_/league/fifa.world'
const ESPN_PUBLIC_TEAMS_URL = 'https://www.espn.com/soccer/teams/_/league/fifa.world'

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
    CityName?: Localized[]
    IdCountry?: string
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
  broadcasts?: {
    media?: { shortName?: string; name?: string }
    region?: string
  }[]
  headToHeadGames?: {
    events?: { id?: string; links?: { href?: string; text?: string }[]; score?: string; gameDate?: string }[]
  }[]
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

function label(value?: Localized[]) {
  return value?.find((item) => item.Description)?.Description ?? value?.[0]?.Description ?? ''
}

function normalizeTeam(team: FifaTeam | undefined, placeholder: string | null | undefined, side: 'home' | 'away'): Team {
  const code = team?.Abbreviation ?? placeholder ?? `TBD-${side.toUpperCase()}`
  const name = team ? label(team.TeamName) || team.ShortClubName || code : placeholder || 'To be decided'
  return {
    id: team?.IdTeam ?? `${side}-${code}`,
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
      logo: home?.team?.logo ?? homeTeam?.logo ?? match.home.logo,
      color: home?.team?.color ?? homeTeam?.color ?? match.home.color,
      links: homeTeam?.links ?? match.home.links,
    },
    away: {
      ...match.away,
      ...awayTeam,
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
    href: ESPN_PUBLIC_TEAMS_URL,
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

function parseEvents(summary?: EspnSummary): LiveEvent[] {
  return (
    summary?.competitions?.[0]?.details?.map((event, index) => ({
      id: event.id ?? `event-${index}`,
      minute: event.clock?.displayValue,
      team: event.team?.displayName ?? event.team?.abbreviation,
      athlete: event.athletesInvolved?.map((athlete) => athlete.displayName).filter(Boolean).join(', '),
      type: event.type?.text ?? event.type?.abbreviation ?? 'Event',
      text: event.text ?? event.type?.text ?? 'Match event',
    })) ?? []
  )
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

function parseLineups(summary: EspnSummary | undefined, match: Match): LineupGroup[] {
  const players = summary?.boxscore?.players ?? []
  return players
    .map((group) => {
      const team =
        group.team?.abbreviation === match.home.code
          ? match.home
          : group.team?.abbreviation === match.away.code
            ? match.away
            : undefined
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
  return (
    summary?.competitions?.[0]?.details
      ?.filter((event) => {
        const text = `${event.type?.text ?? ''} ${event.text ?? ''}`.toLowerCase()
        return text.includes('yellow') || text.includes('red') || text.includes('card')
      })
      .map((event, index) => ({
        id: event.id ?? `card-${index}`,
        name: event.athletesInvolved?.[0]?.displayName ?? 'Player',
        team: event.team?.displayName ?? event.team?.abbreviation ?? 'Team',
        detail: event.text ?? event.type?.text ?? 'Card',
      })) ?? []
  )
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
  if (!/^\d+$/.test(team.id)) {
    return buildTeamProfileFallback(team, matches, 'Team roster source is not linked for this nation yet.')
  }

  const [detailsResult, rosterResult] = await Promise.allSettled([
    fetchJson<EspnTeamDetails>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${team.id}`,
      signal,
    ),
    fetchJson<EspnRoster>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${team.id}/roster`,
      signal,
    ),
  ])

  if (detailsResult.status === 'rejected' && rosterResult.status === 'rejected') {
    const message =
      detailsResult.reason instanceof Error ? detailsResult.reason.message : 'Team profile source failed.'
    return buildTeamProfileFallback(team, matches, message)
  }

  const details = detailsResult.status === 'fulfilled' ? detailsResult.value.team : undefined
  const roster = rosterResult.status === 'fulfilled' ? rosterResult.value : undefined
  const profileTeam: Team = {
    ...team,
    id: details?.id ?? team.id,
    name: details?.displayName ?? team.name,
    shortName: details?.shortDisplayName ?? team.shortName,
    code: details?.abbreviation ?? team.code,
    logo: details?.logos?.[0]?.href ?? team.logo,
    color: details?.color ?? team.color,
    links: uniqueLinks([...(team.links ?? []), ...espnLinksToExternal(details?.links)]),
  }
  const rosterPlayers = roster?.athletes?.map(parsePlayer).filter(Boolean) as TeamPlayer[] | undefined
  const players = rosterPlayers ?? []
  const staff = parseStaff(roster)
  const nextEvent = parseNextEvent(details, profileTeam, matches)
  const updates: TeamUpdate[] = []

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

  if (staff.length) {
    updates.push({
      id: 'staff-feed',
      label: 'Staff feed',
      detail: `${staff.length} staff ${staff.length === 1 ? 'member' : 'members'} listed by the roster source`,
    })
  }

  const sourceDetail =
    detailsResult.status === 'fulfilled' && rosterResult.status === 'fulfilled'
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
