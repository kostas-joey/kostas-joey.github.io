import { calculateElo, updatePlayerData, loadPlayerData, savePlayerData } from './elo.js';

// DOM Elements
const playerList = document.getElementById('player-list');
const playerForm = document.getElementById('player-form');
const playerNameInput = document.getElementById('player-name');
const playerRatingInput = document.getElementById('player-rating');
const teamMatchCheckbox = document.getElementById('team-match');
const logMatchButton = document.getElementById('log-match');

let playerRatings = {};

// Load initial player data
async function init() {
    playerRatings = await loadPlayerData() || {};
    updatePlayerList();
    setupEventListeners();
    toggleTeamInputs(); // Add this line
    updatePlayersList();
}

function setupEventListeners() {
    // Add player form submission
    playerForm.addEventListener('submit', handleAddPlayer);
    
    // Team match toggle
    teamMatchCheckbox.addEventListener('change', toggleTeamInputs);
    
    // Log match button
    logMatchButton.addEventListener('click', handleLogMatch);
}

async function handleAddPlayer(event) {
    event.preventDefault();
    
    const playerName = playerNameInput.value.trim();
    const playerRating = parseInt(playerRatingInput.value) || 1200;

    if (!playerName) {
        alert('Please enter a player name');
        return;
    }

    if (playerName in playerRatings) {
        alert('Player already exists');
        return;
    }

    // Add new player
    playerRatings[playerName] = { 
        rating: playerRating, 
        matches: 0, 
        wins: 0, 
        losses: 0 
    };
    
    try {
        await savePlayerData(playerRatings);
        updatePlayerList();
        
        // Clear form
        playerNameInput.value = '';
        playerRatingInput.value = '1200';
    } catch (error) {
        console.error('Failed to save player:', error);
        alert('Failed to add player');
    }
}

function handleLogMatch() {
    const isTeamMatch = teamMatchCheckbox.checked;
    const winner = document.querySelector('input[name="winner"]:checked')?.value;
    
    if (!winner) {
        alert('Please select a winner');
        return;
    }

    const player1 = document.getElementById('player1').value.trim();
    const player2 = document.getElementById('player2').value.trim();
    const player3 = document.getElementById('player3').value.trim();
    const player4 = document.getElementById('player4').value.trim();

    if (isTeamMatch) {
        if (!player1 || !player2 || !player3 || !player4) {
            alert('Please fill in all player fields');
            return;
        }
        updateTeamMatch(player1, player2, player3, player4, winner === 'team1');
    } else {
        if (!player1 || !player3) {
            alert('Please fill in player 1 and player 2');
            return;
        }
        updateSingleMatch(player1, player3, winner === 'team1');
    }

    updatePlayerList();
}

function updateTeamMatch(player1, player2, player3, player4, team1Wins) {
    // Calculate Elo change based on team means
    const eloChange = calculateTeamEloChange([player1, player2], [player3, player4], team1Wins);

    // Update each player's individual rating
    const team1Players = [player1, player2];
    const team2Players = [player3, player4];

    team1Players.forEach(player => {
        const currentRating = getPlayerRating(player);
        updatePlayerData(playerRatings, player, currentRating + eloChange, team1Wins);
    });

    team2Players.forEach(player => {
        const currentRating = getPlayerRating(player);
        updatePlayerData(playerRatings, player, currentRating - eloChange, !team1Wins);
    });

    savePlayerData(playerRatings);
}

function updateSingleMatch(player1, player2, player1Wins) {
    const player1Elo = getPlayerRating(player1);
    const player2Elo = getPlayerRating(player2);

    const newPlayer1Elo = calculateElo(player1Elo, player2Elo, player1Wins ? 1 : 0);
    const newPlayer2Elo = calculateElo(player2Elo, player1Elo, player1Wins ? 0 : 1);

    updatePlayerData(playerRatings, player1, newPlayer1Elo, player1Wins);
    updatePlayerData(playerRatings, player2, newPlayer2Elo, !player1Wins);

    savePlayerData(playerRatings);
}

function getPlayerRating(playerName) {
    return playerRatings[playerName]?.rating || 1200;
}

function toggleTeamInputs() {
    const teamPlayers = document.querySelectorAll('.team-player');
    const matchTypeLabel = document.querySelector('.match-type-label');
    const isTeamMatch = teamMatchCheckbox.checked;
    
    teamPlayers.forEach(input => {
        input.style.display = isTeamMatch ? 'block' : 'none';
        input.querySelector('input').required = isTeamMatch;
    });
    
    matchTypeLabel.textContent = isTeamMatch ? '2v2 Match' : '1v1 Match';
}

function updatePlayerList() {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';
    
    const sortedPlayers = Object.entries(playerRatings)
        .sort(([,a], [,b]) => b.rating - a.rating);

    sortedPlayers.forEach(([player, data], index) => {
        const li = document.createElement('li');
        const winRate = data.matches > 0 ? 
            ((data.wins / data.matches) * 100).toFixed(1) : 0;
        
        li.innerHTML = `
            <span class="rank">${index + 1}</span>
            <span class="name">${player}</span>
            <span class="elo">${Math.round(data.rating)}</span>
            <span class="stats">${data.wins}W - ${data.losses}L</span>
            <div class="ratio">
                <span>${winRate}%</span>
                <div class="win-rate-bar">
                    <div class="win-rate-fill" style="width: ${winRate}%"></div>
                </div>
            </div>
        `;
        
        playerList.appendChild(li);
    });
}

function updatePlayersList() {
    const datalist = document.getElementById('players-list');
    datalist.innerHTML = '';
    
    Object.keys(playerRatings).forEach(playerName => {
        const option = document.createElement('option');
        option.value = playerName;
        datalist.appendChild(option);
    });
}

// Initialize the application
init();