export type SourceStatus = 'online' | 'degraded' | 'offline'

export type SourceState = {
  id: string
  label: string
  status: SourceStatus
  detail: string
  href?: string
}

export type Team = {
  id: string
  name: string
  shortName: string
  code: string
  countryCode?: string
  logo?: string
  color?: string
  links?: ExternalLink[]
}

export type Venue = {
  id: string
  name: string
  city: string
  country: string
}

export type ExternalLink = {
  label: string
  href: string
  type?: string
}

export type MatchStatus = {
  state: 'scheduled' | 'live' | 'halftime' | 'fulltime' | 'postponed' | 'unknown'
  label: string
  phase?: string
  clock?: string
}

export type Match = {
  id: string
  fifaId: string
  espnId?: string
  matchNumber: number
  stage: string
  group?: string
  dateUtc: string
  localDate?: string
  home: Team
  away: Team
  homeScore: number | null
  awayScore: number | null
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
  venue: Venue
  status: MatchStatus
  officials: string[]
  winnerId?: string | null
  placeholders: {
    home?: string | null
    away?: string | null
  }
  links: ExternalLink[]
  rawSources: {
    fifa: boolean
    espn: boolean
  }
}

export type StandingRow = {
  team: Team
  group: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export type GroupStanding = {
  group: string
  rows: StandingRow[]
}

export type LiveEvent = {
  id: string
  minute?: string
  team?: string
  athlete?: string
  type: string
  text: string
}

export type StatLine = {
  label: string
  home: string
  away: string
}

export type LineupGroup = {
  team: Team
  formation?: string
  players: {
    id: string
    name: string
    position?: string
    shirt?: string
    starter?: boolean
  }[]
}

export type MatchExtras = {
  summarySource: SourceState
  events: LiveEvent[]
  stats: StatLine[]
  lineups: LineupGroup[]
  playerCards: {
    id: string
    name: string
    team: string
    detail: string
  }[]
  form: {
    team: Team
    recent: string[]
  }[]
  headToHead: ExternalLink[]
  broadcasts: string[]
}

export type TeamPlayer = {
  id: string
  name: string
  shortName?: string
  jersey?: string
  position?: string
  age?: number
  height?: string
  weight?: string
  headshot?: string
  status?: string
  injuries: string[]
  links: ExternalLink[]
}

export type TeamStaff = {
  id: string
  name: string
  role?: string
}

export type TeamUpdate = {
  id: string
  label: string
  detail: string
  href?: string
}

export type TeamProfile = {
  source: SourceState
  team: Team
  record?: string
  standingSummary?: string
  nextEvent?: {
    name?: string
    dateUtc?: string
    venue?: string
    status?: string
  }
  roster: TeamPlayer[]
  staff: TeamStaff[]
  injuries: TeamPlayer[]
  updates: TeamUpdate[]
  links: ExternalLink[]
  rosterUpdatedAt?: string
}

export type WorldCupData = {
  matches: Match[]
  sourceStates: SourceState[]
  updatedAt: string
}
