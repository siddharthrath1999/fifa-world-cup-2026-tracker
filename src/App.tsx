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
  ListFilter,
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
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { downloadCalendar } from './lib/calendar'
import { loadMatchExtras, loadTeamProfile, loadWorldCupData, watchSources } from './lib/sources'
import { buildStandings, getBestThirds } from './lib/standings'
import { formatIstDateKey, formatIstDateTime, formatIstDay, getKickoffDistance, getTodayIstKey } from './lib/time'
import type {
  GroupStanding,
  Match,
  MatchExtras,
  SourceState,
  StandingRow,
  Team,
  TeamPlayer,
  TeamProfile,
  Venue,
  WorldCupData,
} from './types'

type ViewMode = 'matches' | 'groups' | 'bracket' | 'teams' | 'venues'
type QuickFilter = 'all' | 'today' | 'live' | 'upcoming' | 'favorites'
type ShareTarget = 'app' | 'match'
type ShareStatus = {
  state: 'idle' | 'copied' | 'manual'
  target?: ShareTarget
  message?: string
}

const viewIds: ViewMode[] = ['matches', 'groups', 'bracket', 'teams', 'venues']

function isViewMode(value: string | null): value is ViewMode {
  return valueIdsIncludes(viewIds, value)
}

function valueIdsIncludes<T extends string>(values: T[], value: string | null): value is T {
  return !!value && values.includes(value as T)
}

function getInitialView(): ViewMode {
  if (typeof window === 'undefined') return 'matches'
  const view = new URLSearchParams(window.location.search).get('view')
  return isViewMode(view) ? view : 'matches'
}

function getInitialMatchId() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('match')
}

function getInitialTeamCode() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('team')
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

function TeamMark({ team, size = 'md' }: { team: Team; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`team-mark ${size}`} style={{ '--team-color': `#${team.color ?? '0f8b62'}` } as React.CSSProperties}>
      {team.logo ? <img src={team.logo} alt="" /> : <span>{team.code.slice(0, 3)}</span>}
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
  return (
    <article className={`match-row ${selected ? 'selected' : ''}`} data-match-id={match.id} onClick={() => onSelect(match.id)}>
      <div className="match-row-main">
        <div className="match-number">M{match.matchNumber}</div>
        <div className="match-teams">
          <TeamName team={match.home} onTeamSelect={onTeamSelect} />
          <Score match={match} />
          <TeamName team={match.away} align="right" onTeamSelect={onTeamSelect} />
        </div>
      </div>
      <div className="match-row-meta">
        <span className={`status-pill ${statusTone(match.status.state)}`}>{match.status.label}</span>
        <span>
          <Clock size={14} />
          {formatIstDateTime(match.dateUtc)}
        </span>
        <span>
          <MapPin size={14} />
          {match.venue.city}
        </span>
        <span>{match.group ?? match.stage}</span>
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

function SourceHealth({ sources }: { sources: SourceState[] }) {
  return (
    <section className="source-strip" aria-label="Live data sources">
      {sources.map((source) => (
        <article className={`source-chip ${sourceTone(source.status)}`} key={source.id}>
          <span />
          <strong>{source.label}</strong>
          <small>{source.detail}</small>
        </article>
      ))}
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
      {extras.lineups.map((lineup) => (
        <div key={lineup.team.id}>
          <h4>{lineup.team.shortName}</h4>
          {lineup.players.slice(0, 18).map((player) => (
            <span key={`${lineup.team.id}-${player.id}`}>
              {player.shirt ? `${player.shirt} ` : ''}
              {player.name}
              {player.position ? <small>{player.position}</small> : null}
            </span>
          ))}
        </div>
      ))}
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

      <AvailabilityPanel
        title="Live timeline"
        icon={<Activity size={18} />}
        items={timeline}
        unavailable="No timeline events have been published for this match yet."
      />
      <AvailabilityPanel
        title="Line-ups"
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

function PlayerCard({ player }: { player: TeamPlayer }) {
  return (
    <article className="player-card">
      {player.headshot ? (
        <img src={player.headshot} alt="" loading="lazy" />
      ) : (
        <span className="player-avatar">{playerInitials(player.name)}</span>
      )}
      <div>
        <strong>{player.jersey ? `#${player.jersey} ${player.name}` : player.name}</strong>
        <span>
          {[player.position, player.age ? `${player.age} yrs` : undefined, player.status].filter(Boolean).join(' - ') ||
            'Squad details pending'}
        </span>
      </div>
      {player.injuries.length ? <small>Injury note</small> : null}
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
  const fixtures = getTeamMatchList(team, matches).sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())
  const group = fixtures.find((match) => match.group)?.group
  const source = activeProfile?.source ?? {
    id: 'team-profile-loading',
    label: 'Team profile',
    status: 'degraded',
    detail: loading ? 'Loading team profile...' : 'Select a nation to load team details.',
  } satisfies SourceState
  const profileTeam = activeProfile?.team ?? team

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
                      <PlayerCard player={player} key={player.id} />
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
                <span key={member.id}>
                  <strong>{member.name}</strong>
                  <small>{member.role ?? 'Staff'}</small>
                </span>
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
                  <strong>{update.label}</strong>
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

function VenuesView({ venues, matches }: { venues: ReturnType<typeof getVenues>; matches: Match[] }) {
  return (
    <div className="directory-grid venues">
      {venues.map((venue) => {
        const finalOrLate = matches
          .filter((match) => match.venue.id === venue.id)
          .sort((a, b) => b.matchNumber - a.matchNumber)[0]
        return (
          <article className="directory-card" key={venue.id}>
            <div>
              <span className="venue-icon">
                <MapPin size={22} />
              </span>
              <h3>{venue.name}</h3>
              <span>{venue.city}, {venue.country}</span>
            </div>
            <p>{venue.matches} matches - next {venue.next ? formatIstDateTime(venue.next) : 'TBD'}</p>
            {finalOrLate ? <small>Latest scheduled: M{finalOrLate.matchNumber}, {finalOrLate.stage}</small> : null}
          </article>
        )
      })}
    </div>
  )
}

function App() {
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
  const liveCount = matches.filter((match) => match.status.state === 'live' || match.status.state === 'halftime').length
  const todayKey = getTodayIstKey()
  const viewTabs: { id: ViewMode; icon: typeof ListFilter; label: string }[] = [
    { id: 'matches', icon: ListFilter, label: 'Matches' },
    { id: 'groups', icon: Table2, label: 'Groups' },
    { id: 'bracket', icon: Trophy, label: 'Knockout' },
    { id: 'teams', icon: Users, label: 'Teams' },
    { id: 'venues', icon: MapPin, label: 'Venues' },
  ]

  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search)
      const nextView = params.get('view')
      const nextMatch = params.get('match')
      const nextTeam = params.get('team')
      setView(isViewMode(nextView) ? nextView : 'matches')
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
      .finally(() => {
        if (active) setExtrasLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [selectedMatch])

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
        <div className="brand">
          <span className="brand-mark">
            <Trophy size={20} />
          </span>
          <div>
            <strong>FIFA World Cup 2026 Tracker</strong>
            <small>Schedule, groups, bracket, teams, venues</small>
          </div>
        </div>
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

      <SourceHealth sources={data?.sourceStates ?? []} />

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
          {view === 'venues' ? <VenuesView venues={venues} matches={matches} /> : null}
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
