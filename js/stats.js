import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCC6oO1N3jkcLbyX0q9NYqWbR-VoRtZ-fQ",
    authDomain: "new-project-8e4ac.firebaseapp.com",
    projectId: "new-project-8e4ac",
    storageBucket: "new-project-8e4ac.firebasestorage.app",
    messagingSenderId: "921717995613",
    appId: "1:921717995613:web:539ba4a30df006c944b5b4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const playerCheckboxes = document.getElementById('player-checkboxes');
const chartContainer = document.getElementById('elo-chart');
const teamStatsChart = document.getElementById('team-stats-chart');
const playerStatsChart = document.getElementById('player-stats-chart');
const positionChart = document.getElementById('position-chart');
let selectedPlayers = new Set();

// Colors for different players
const colors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
];

async function loadPlayers() {
    const playersRef = collection(db, "players");
    const snapshot = await getDocs(playersRef);
    
    const players = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
    }));

    // Create checkbox for each player
    playerCheckboxes.innerHTML = '';
    players.forEach(player => {
        const label = document.createElement('label');
        label.className = 'player-checkbox';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = player.id;
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedPlayers.add(player.id);
            } else {
                selectedPlayers.delete(player.id);
            }
            updateChart();
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(player.name));
        playerCheckboxes.appendChild(label);
    });

    // Parse emojis
    twemoji.parse(playerCheckboxes);
    
    // Update chart initially with no players selected
    updateChart();
}

async function loadEloHistory(selectedPlayers) {
    const matchesRef = collection(db, "matches");
    const q = query(matchesRef, orderBy("timestamp", "asc"));
    const snapshot = await getDocs(q);

    // Initialize data structure for each player
    const playerData = {};
    selectedPlayers.forEach(playerId => {
        playerData[playerId] = {
            x: [], // timestamps
            y: [], // elo ratings
            name: playerId,
            type: 'scatter',
            mode: 'lines+markers'
        };
    });

    // Process matches chronologically
    snapshot.docs.forEach(doc => {
        const match = doc.data();
        const timestamp = match.timestamp.toDate();

        match.eloChanges.forEach(change => {
            if (selectedPlayers.includes(change.player)) {
                playerData[change.player].x.push(timestamp);
                playerData[change.player].y.push(Math.round(change.rating));
            }
        });
    });

    return Object.values(playerData);
}

async function loadPositionWins(selectedPlayers) {
    const matchesRef = collection(db, "matches");
    const snapshot = await getDocs(matchesRef);

    // Initialize data structure for each player's position wins
    const playerPositionWins = {};
    selectedPlayers.forEach(playerId => {
        playerPositionWins[playerId] = {
            position0: 0,
            position1: 0,
            name: playerId
        };
    });

    // Process matches
    snapshot.docs.forEach(doc => {
        const match = doc.data();
        const winningTeam = match.team1Wins ? match.team1Players : match.team2Players;

        selectedPlayers.forEach(playerId => {
            const position = winningTeam.indexOf(playerId);
            if (position === 0) {
                playerPositionWins[playerId].position0++;
            } else if (position === 1) {
                playerPositionWins[playerId].position1++;
            }
        });
    });

    return Object.values(playerPositionWins);
}

async function updateChart() {
    if (selectedPlayers.size === 0) {
        // Show empty charts with messages
        const emptyLayout = {
            title: 'Select players to view statistics',
            xaxis: { title: 'No data' },
            yaxis: { title: 'No data' },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000'
            }
        };
        Plotly.newPlot(chartContainer, [], emptyLayout);
        Plotly.newPlot(positionChart, [], emptyLayout);
        return;
    }

    // Update Elo history chart
    const eloData = await loadEloHistory(Array.from(selectedPlayers));
    eloData.forEach((trace, i) => {
        trace.line = { color: colors[i % colors.length] };
    });

    const eloLayout = {
        xaxis: { title: 'Date', type: 'date' },
        yaxis: { title: 'Elo Rating' },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000'
        }
    };

    // Update Position wins chart
    const positionData = await loadPositionWins(Array.from(selectedPlayers));
    const positionTraces = positionData.map((player, i) => ({
        x: ['Front', 'Back'],
        y: [player.position0, player.position1],
        name: player.name,
        type: 'bar',
        marker: { color: colors[i % colors.length] }
    }));

    const positionLayout = {
        barmode: 'group',
        xaxis: { title: 'Position' },
        yaxis: { title: 'Number of Wins' },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000'
        }
    };

    Plotly.newPlot(chartContainer, eloData, eloLayout);
    Plotly.newPlot(positionChart, positionTraces, positionLayout);
}

// Theme switcher
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');

function switchTheme(e) {
    const isDark = e.target.checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Update chart colors if it exists
    if (chartContainer.data) {
        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: isDark ? '#fff' : '#000' }
        };
        Plotly.relayout(chartContainer, layout);
    }
}

toggleSwitch.addEventListener('change', switchTheme);

// Check for saved theme preference
const currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    toggleSwitch.checked = currentTheme === 'dark';
}

// Initialize
loadPlayers();

async function loadMatchStatistics() {
    const matchesRef = collection(db, "matches");
    const snapshot = await getDocs(matchesRef);
    
    const stats = {
        team1Wins: 0,
        team2Wins: 0
    };

    snapshot.docs.forEach(doc => {
        const match = doc.data();
        console.log('Processing match:', match);

        // Count team wins based on team1Wins boolean
        if (match.team1Wins === true) {
            stats.team1Wins++;
        } else {
            stats.team2Wins++;
        }
    });

    console.log('Final stats:', stats);
    displayTeamStats(stats);
}

function displayTeamStats(stats) {
    if (!teamStatsChart) {
        console.error('Team stats chart container not found!');
        return;
    }
    console.log('Displaying team stats:', stats);
    const data = [{
        x: ['Team Black', 'Team Gray'],
        y: [stats.team1Wins, stats.team2Wins],
        type: 'bar',
        marker: {
            color: ['#000000', '#808080']
        }
    }];

    const layout = {
        title: 'Wins by Team',
        xaxis: {
            title: 'Team'
        },
        yaxis: {
            title: 'Number of Wins'
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000'
        }
    };

    Plotly.newPlot(teamStatsChart, data, layout);
}

function displayPlayerStats(stats) {
    if (!playerStatsChart) {
        console.error('Player stats chart container not found!');
        return;
    }
    console.log('Displaying player stats:', stats);
    const data = [{
        x: ['Player 1', 'Player 2'],
        y: [stats.player1Wins, stats.player2Wins],
        type: 'bar',
        marker: {
            color: ['#FF9800', '#9C27B0']
        }
    }];

    const layout = {
        title: 'Wins by Player Position',
        xaxis: {
            title: 'Player Position'
        },
        yaxis: {
            title: 'Number of Wins'
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000'
        }
    };

    Plotly.newPlot(playerStatsChart, data, layout);
}

// Update the initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadPlayers();
    await loadMatchStatistics();  // Make sure this runs
});