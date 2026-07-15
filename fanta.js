'use strict';
// Fantatomorrowland core rules. Pure functions only; UI and storage live in index.html.
// Rules reference: spec.md

const CATEGORIES = ['sex', 'disgust', 'idiocy', 'drama', 'pain'];
const BUDGET = 100;

function costOf(name, friends) {
  const f = friends.find((f) => f.name === name);
  return f ? f.cost : 0;
}

function rosterCost(roster, friends) {
  return roster.reduce((sum, name) => sum + costOf(name, friends), 0);
}

function validateTeam(team, friends) {
  const errors = [];
  if (team.roster.length === 0) {
    errors.push('The roster is empty.');
  }
  const cost = rosterCost(team.roster, friends);
  if (cost > BUDGET) {
    errors.push(`Roster costs ${cost}, over the ${BUDGET}-credit budget.`);
  }
  if (team.roster.includes(team.owner)) {
    errors.push(`${team.owner} cannot be in their own team.`);
  }
  if (new Set(team.roster).size !== team.roster.length) {
    errors.push('The roster contains duplicate friends.');
  }
  if (!team.roster.includes(team.captain)) {
    errors.push('The captain must be one of the rostered friends.');
  }
  if (!CATEGORIES.includes(team.captainCategory)) {
    errors.push('The captain category must be one of the five categories.');
  }
  return { ok: errors.length === 0, errors };
}

function eventValueForTeam(team, event) {
  if (!team.roster.includes(event.friend)) return 0;
  const doubled = event.friend === team.captain && event.category === team.captainCategory;
  return doubled ? event.points * 2 : event.points;
}

function teamScore(team, events) {
  return events.reduce((sum, e) => sum + eventValueForTeam(team, e), 0);
}

function standings(teams, events) {
  return teams
    .map((t) => ({ ...t, total: teamScore(t, events) }))
    .sort((a, b) => b.total - a.total);
}

if (typeof module !== 'undefined') {
  module.exports = { CATEGORIES, BUDGET, rosterCost, validateTeam, teamScore, standings, eventValueForTeam };
}
