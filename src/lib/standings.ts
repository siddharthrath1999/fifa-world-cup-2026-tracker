import type { GroupStanding, Match, StandingRow, Team } from '../types'

function makeRow(team: Team, group: string): StandingRow {
  return {
    team,
    group,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }
}

function getResult(match: Match) {
  if (match.homeScore === null || match.awayScore === null) return null
  if (match.status.state !== 'fulltime') return null
  return {
    home: match.homeScore,
    away: match.awayScore,
  }
}

function sortRows(rows: StandingRow[]) {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return a.team.name.localeCompare(b.team.name)
  })
}

export function buildStandings(matches: Match[]): GroupStanding[] {
  const groups = new Map<string, Map<string, StandingRow>>()
  const groupMatches = matches.filter((match) => match.group && match.stage === 'First Stage')

  for (const match of groupMatches) {
    const group = match.group as string
    if (!groups.has(group)) groups.set(group, new Map())
    const rows = groups.get(group) as Map<string, StandingRow>

    for (const team of [match.home, match.away]) {
      if (!team.code.startsWith('TBD') && !rows.has(team.id)) {
        rows.set(team.id, makeRow(team, group))
      }
    }
  }

  for (const match of groupMatches) {
    if (!match.group) continue
    const result = getResult(match)
    if (!result) continue

    const rows = groups.get(match.group)
    const home = rows?.get(match.home.id)
    const away = rows?.get(match.away.id)
    if (!home || !away) continue

    home.played += 1
    away.played += 1
    home.goalsFor += result.home
    home.goalsAgainst += result.away
    away.goalsFor += result.away
    away.goalsAgainst += result.home

    if (result.home > result.away) {
      home.won += 1
      away.lost += 1
      home.points += 3
    } else if (result.home < result.away) {
      away.won += 1
      home.lost += 1
      away.points += 3
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, rows]) => ({
      group,
      rows: sortRows(
        [...rows.values()].map((row) => ({
          ...row,
          goalDifference: row.goalsFor - row.goalsAgainst,
        })),
      ),
    }))
}

export function getBestThirds(standings: GroupStanding[]) {
  return standings
    .map((group) => group.rows[2])
    .filter(Boolean)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
      return a.team.name.localeCompare(b.team.name)
    })
}
