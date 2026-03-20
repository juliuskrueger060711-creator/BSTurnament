const STORAGE_KEY = "brawl-stars-turnier-state-v2";
const POINTS_FOR_WIN = 3;
const POINTS_FOR_LOSS = -1;

const teams = [
  "Max + Jonas",
  "Julius + Nick",
  "Ole + Til",
  "Filip + Matti",
  "Qusai + Louis",
];

const rounds = [
  {
    round: 1,
    bye: "Max + Jonas",
    matches: [
      ["Julius + Nick", "Qusai + Louis"],
      ["Ole + Til", "Filip + Matti"],
    ],
  },
  {
    round: 2,
    bye: "Filip + Matti",
    matches: [
      ["Max + Jonas", "Qusai + Louis"],
      ["Julius + Nick", "Ole + Til"],
    ],
  },
  {
    round: 3,
    bye: "Julius + Nick",
    matches: [
      ["Max + Jonas", "Filip + Matti"],
      ["Qusai + Louis", "Ole + Til"],
    ],
  },
  {
    round: 4,
    bye: "Qusai + Louis",
    matches: [
      ["Max + Jonas", "Ole + Til"],
      ["Filip + Matti", "Julius + Nick"],
    ],
  },
  {
    round: 5,
    bye: "Ole + Til",
    matches: [
      ["Max + Jonas", "Julius + Nick"],
      ["Filip + Matti", "Qusai + Louis"],
    ],
  },
];

const scheduledMatches = rounds.flatMap((roundData) =>
  roundData.matches.map(([teamOne, teamTwo], index) => ({
    id: `round-${roundData.round}-match-${index + 1}`,
    round: roundData.round,
    teamOne,
    teamTwo,
  })),
);

const matchesById = new Map(scheduledMatches.map((match) => [match.id, match]));

const standingsBody = document.getElementById("standingsBody");
const matchForm = document.getElementById("matchForm");
const scheduledMatchSelect = document.getElementById("scheduledMatch");
const winnerSelect = document.getElementById("winner");
const submitButton = document.getElementById("submitButton");
const selectedMatchInfo = document.getElementById("selectedMatchInfo");
const matchList = document.getElementById("matchList");
const scheduleGrid = document.getElementById("scheduleGrid");
const progressInfo = document.getElementById("progressInfo");
const resetButton = document.getElementById("resetButton");

const initialState = {
  results: {},
};

let state = loadState();

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return structuredClone(initialState);
  }

  try {
    const parsed = JSON.parse(stored);

    if (parsed && typeof parsed === "object" && parsed.results && typeof parsed.results === "object") {
      return {
        results: parsed.results,
      };
    }

    if (parsed && Array.isArray(parsed.matches)) {
      return migrateLegacyMatches(parsed.matches);
    }
  } catch {
    return structuredClone(initialState);
  }

  return structuredClone(initialState);
}

function migrateLegacyMatches(legacyMatches) {
  const migrated = {
    results: {},
  };

  legacyMatches.forEach((legacyMatch) => {
    const scheduledMatch = scheduledMatches.find((match) => {
      const sameOrder =
        match.teamOne === legacyMatch.teamOne && match.teamTwo === legacyMatch.teamTwo;
      const swappedOrder =
        match.teamOne === legacyMatch.teamTwo && match.teamTwo === legacyMatch.teamOne;

      return (sameOrder || swappedOrder) && !migrated.results[match.id];
    });

    if (scheduledMatch && teams.includes(legacyMatch.winner)) {
      migrated.results[scheduledMatch.id] = legacyMatch.winner;
    }
  });

  return migrated;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function persistState() {
  saveState();
}

function createOption(value, label, placeholder = false) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label ?? value;

  if (placeholder) {
    option.disabled = true;
    option.selected = true;
  }

  return option;
}

function populateMatchSelect() {
  const currentSelection = scheduledMatchSelect.value;
  scheduledMatchSelect.innerHTML = "";
  scheduledMatchSelect.appendChild(createOption("", "Match auswählen", true));

  scheduledMatches.forEach((match) => {
    const winner = state.results[match.id];
    const status = winner ? "eingetragen" : "offen";
    const label = `Runde ${match.round}: ${match.teamOne} vs. ${match.teamTwo} (${status})`;
    scheduledMatchSelect.appendChild(createOption(match.id, label));
  });

  if (currentSelection && matchesById.has(currentSelection)) {
    scheduledMatchSelect.value = currentSelection;
  }
}

function rebuildWinnerOptions() {
  const selectedMatch = matchesById.get(scheduledMatchSelect.value);
  const savedWinner = state.results[scheduledMatchSelect.value];

  winnerSelect.innerHTML = "";
  winnerSelect.appendChild(createOption("", "Gewinner auswählen", true));

  if (!selectedMatch) {
    selectedMatchInfo.textContent = "Wähle ein Match aus dem ausgelosten Spielplan.";
    submitButton.textContent = "Ergebnis speichern";
    return;
  }

  winnerSelect.appendChild(createOption(selectedMatch.teamOne, selectedMatch.teamOne));
  winnerSelect.appendChild(createOption(selectedMatch.teamTwo, selectedMatch.teamTwo));

  if (savedWinner) {
    winnerSelect.value = savedWinner;
    selectedMatchInfo.textContent =
      `Runde ${selectedMatch.round}: ${selectedMatch.teamOne} vs. ${selectedMatch.teamTwo}. Ergebnis kann geändert werden.`;
    submitButton.textContent = "Ergebnis aktualisieren";
  } else {
    selectedMatchInfo.textContent =
      `Runde ${selectedMatch.round}: ${selectedMatch.teamOne} vs. ${selectedMatch.teamTwo}.`;
    submitButton.textContent = "Ergebnis speichern";
  }
}

function buildStandings() {
  const stats = new Map(
    teams.map((team) => [
      team,
      {
        team,
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
      },
    ]),
  );

  scheduledMatches.forEach((match) => {
    const winner = state.results[match.id];

    if (!winner) {
      return;
    }

    const teamOneStats = stats.get(match.teamOne);
    const teamTwoStats = stats.get(match.teamTwo);

    teamOneStats.played += 1;
    teamTwoStats.played += 1;

    if (winner === match.teamOne) {
      teamOneStats.wins += 1;
      teamOneStats.points += POINTS_FOR_WIN;
      teamTwoStats.losses += 1;
      teamTwoStats.points += POINTS_FOR_LOSS;
      return;
    }

    teamTwoStats.wins += 1;
    teamTwoStats.points += POINTS_FOR_WIN;
    teamOneStats.losses += 1;
    teamOneStats.points += POINTS_FOR_LOSS;
  });

  return [...stats.values()].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }

    return a.team.localeCompare(b.team, "de");
  });
}

function renderStandings() {
  const standings = buildStandings();

  standingsBody.innerHTML = standings
    .map(
      (team, index) => `
        <tr>
          <td><span class="position-badge">${index + 1}</span></td>
          <td><div class="team-name">${team.team}</div></td>
          <td>${team.played}</td>
          <td>${team.wins}</td>
          <td>${team.losses}</td>
          <td class="points">${team.points}</td>
        </tr>
      `,
    )
    .join("");
}

function renderMatches() {
  const playedMatches = scheduledMatches.filter((match) => state.results[match.id]);

  if (playedMatches.length === 0) {
    matchList.innerHTML = '<li class="empty-state">Noch keine Ergebnisse eingetragen.</li>';
    return;
  }

  matchList.innerHTML = playedMatches
    .slice()
    .reverse()
    .map((match) => {
      const winner = state.results[match.id];
      return `
        <li class="match-item">
          Runde ${match.round}: ${match.teamOne} vs. ${match.teamTwo}<br>
          <strong>Sieger: ${winner}</strong>
        </li>
      `;
    })
    .join("");
}

function renderSchedule() {
  scheduleGrid.innerHTML = rounds
    .map((roundData) => {
      const cards = scheduledMatches
        .filter((match) => match.round === roundData.round)
        .map((match) => {
          const winner = state.results[match.id];
          const isSelected = match.id === scheduledMatchSelect.value;
          return `
            <article class="schedule-card ${isSelected ? "is-selected" : ""}">
              <span class="status-pill ${winner ? "done" : "open"}">
                ${winner ? "Ergebnis drin" : "Offen"}
              </span>
              <div class="match-teams">${match.teamOne}<br>vs.<br>${match.teamTwo}</div>
              <div class="match-result">
                ${
                  winner
                    ? `Gewinner: <span class="winner-name">${winner}</span>`
                    : "Noch kein Sieger eingetragen."
                }
              </div>
              <button class="secondary-button" type="button" data-match-id="${match.id}">
                ${winner ? "Bearbeiten" : "Eintragen"}
              </button>
            </article>
          `;
        })
        .join("");

      return `
        <section class="round-column">
          <div class="round-header">
            <h3>Runde ${roundData.round}</h3>
            <p>${roundData.matches.length} Matches</p>
          </div>
          <div class="bye-note">Freilos: <strong>${roundData.bye}</strong></div>
          ${cards}
        </section>
      `;
    })
    .join("");

  const completedMatches = scheduledMatches.filter((match) => state.results[match.id]).length;
  progressInfo.textContent = `${completedMatches}/${scheduledMatches.length} Matches eingetragen`;
}

function render() {
  populateMatchSelect();
  rebuildWinnerOptions();
  renderStandings();
  renderMatches();
  renderSchedule();
}

function focusMatch(matchId) {
  if (!matchesById.has(matchId)) {
    return;
  }

  scheduledMatchSelect.value = matchId;
  rebuildWinnerOptions();
  renderSchedule();
  winnerSelect.focus();
}

function addMatch(event) {
  event.preventDefault();

  const selectedMatchId = scheduledMatchSelect.value;
  const selectedMatch = matchesById.get(selectedMatchId);
  const winner = winnerSelect.value;

  if (!selectedMatch) {
    alert("Bitte wähle zuerst ein ausgelostes Match aus.");
    return;
  }

  if (winner !== selectedMatch.teamOne && winner !== selectedMatch.teamTwo) {
    alert("Der Gewinner muss eines der beiden Teams sein.");
    return;
  }

  state.results[selectedMatchId] = winner;
  saveState();
  render();
  focusMatch(selectedMatchId);
}

function resetTournament() {
  const confirmed = window.confirm("Alle Ergebnisse und Punkte wirklich zurücksetzen?");

  if (!confirmed) {
    return;
  }

  state = structuredClone(initialState);
  saveState();
  scheduledMatchSelect.value = "";
  winnerSelect.innerHTML = "";
  render();
}

scheduledMatchSelect.addEventListener("change", () => {
  rebuildWinnerOptions();
  renderSchedule();
});

matchForm.addEventListener("submit", addMatch);

scheduleGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-match-id]");

  if (!button) {
    return;
  }

  focusMatch(button.dataset.matchId);
});

resetButton.addEventListener("click", resetTournament);

window.addEventListener("beforeunload", persistState);
window.addEventListener("pagehide", persistState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    persistState();
  }
});

render();
