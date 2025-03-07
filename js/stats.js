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
const playerSelect = document.getElementById('player-select');
const chartContainer = document.getElementById('elo-chart');

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

    // Populate player select
    players.forEach(player => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.name;
        playerSelect.appendChild(option);
    });

    // Convert emojis
    twemoji.parse(playerSelect);
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

async function updateChart() {
    const selectedPlayers = Array.from(playerSelect.selectedOptions).map(option => option.value);
    
    if (selectedPlayers.length === 0) {
        chartContainer.innerHTML = '<p>Please select at least one player</p>';
        return;
    }

    const data = await loadEloHistory(selectedPlayers);
    
    // Assign colors to traces
    data.forEach((trace, i) => {
        trace.line = { color: colors[i % colors.length] };
    });

    const layout = {
        title: 'Player Elo History',
        xaxis: {
            title: 'Date',
            type: 'date'
        },
        yaxis: {
            title: 'Elo Rating'
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000'
        }
    };

    Plotly.newPlot(chartContainer, data, layout);
}

// Event Listeners
playerSelect.addEventListener('change', updateChart);

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