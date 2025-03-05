import { calculateElo, updatePlayerData, loadPlayerData, savePlayerData } from './elo.js';
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Firebase Initialization (already imported in HTML)
const db = getFirestore();

// DOM Elements
const playerList = document.getElementById('player-list');
const playerForm = document.getElementById('player-form');
const playerNameInput = document.getElementById('player-name');
const playerRatingInput = document.getElementById('player-rating');
const teamMatchCheckbox = document.getElementById('team-match');
const logMatchButton = document.getElementById('log-match');

let playerRatings = {};

// Load initial player data from Firestore
async function init() {
    console.log("Initializing application...");
    try {
        playerRatings = await loadPlayerData();
        console.log("Loaded player data from Firestore:", playerRatings);
    } catch (error) {
        console.error("Error loading player data:", error);
    }
    updatePlayerList();
    setupEventListeners();
    toggleTeamInputs();
    updatePlayersList();
}

function setupEventListeners() {
    console.log("Setting up event listeners...");
    playerForm.addEventListener('submit', handleAddPlayer);
    teamMatchCheckbox.addEventListener('change', toggleTeamInputs);
    logMatchButton.addEventListener('click', handleLogMatch);
    window.addEventListener('playerAdded', async () => {
        playerRatings = await loadPlayerData();
        updatePlayerList();
        updatePlayersList();
    });
}

async function getPlayerFromFirestore(playerName) {
    try {
        const docRef = doc(db, "players", playerName);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Error getting player:", error);
        return null;
    }
}

async function handleAddPlayer(event) {
    event.preventDefault();

    const playerName = playerNameInput.value.trim();
    const playerRating = parseInt(playerRatingInput.value) || 1200;

    console.log("Attempting to add player:", playerName, "with rating:", playerRating);

    if (!playerName) {
        console.warn("Player name is empty.");
        alert('Please enter a player name');
        return;
    }

    // Check if player exists in Firestore
    try {
        const playerData = await getPlayerFromFirestore(playerName);
        if (playerData) {
            console.warn("Player already exists:", playerName);
            alert('Player already exists');
            return;
        }
    } catch (error) {
        console.error("Error checking player existence:", error);
    }

    // Add new player
    const newPlayer = { 
        name: playerName,
        rating: playerRating, 
        matches: 0, 
        wins: 0, 
        losses: 0 
    };

    try {
        await savePlayerData(playerName, newPlayer);
        console.log("Player added successfully:", newPlayer);
        
        // Reload player data to refresh our local cache
        playerRatings = await loadPlayerData();
        
        // Update UI
        updatePlayerList();
        updatePlayersList();
        
        // Clear form
        playerNameInput.value = '';
        playerRatingInput.value = '1200';
    } catch (error) {
        console.error("Failed to save player:", error);
        alert('Failed to add player');
    }
}

async function handleLogMatch() {
    console.log("Logging a new match...");

    const isTeamMatch = teamMatchCheckbox.checked;
    console.log("Is this a team match?", isTeamMatch);

    const winner = document.querySelector('input[name="winner"]:checked')?.value;
    if (!winner) {
        console.warn("No winner selected.");
        alert('Please select a winner');
        return;
    }

    const player1 = document.getElementById('player1').value.trim();
    const player2 = document.getElementById('player2').value.trim();
    const player3 = document.getElementById('player3').value.trim();
    const player4 = document.getElementById('player4').value.trim();

    if (isTeamMatch) {
        if (!player1 || !player2 || !player3 || !player4) {
            console.warn("Not all players for the team match are filled.");
            alert('Please fill in all player fields');
            return;
        }
        console.log(`Team match: ${player1} & ${player2} vs ${player3} & ${player4}, Winner: ${winner}`);
        await updateTeamMatch(player1, player2, player3, player4, winner === 'team1');
        // Add victory animation
        const winners = winner === 'team1' ? `${player1} & ${player2}` : `${player3} & ${player4}`;
        showVictoryAnimation(winners);
    } else {
        if (!player1 || !player3) {
            console.warn("Player fields missing for 1v1 match.");
            alert('Please fill in player 1 and player 2');
            return;
        }
        console.log(`Single match: ${player1} vs ${player3}, Winner: ${winner}`);
        await updateSingleMatch(player1, player3, winner === 'team1');
        // Add victory animation
        const winners = winner === 'team1' ? player1 : player3;
        showVictoryAnimation(winners);
    }

    // Clear form fields after logging match
    document.getElementById('player1').value = '';
    document.getElementById('player2').value = '';
    document.getElementById('player3').value = '';
    document.getElementById('player4').value = '';
    document.querySelector('input[name="winner"]:checked').checked = false;
}

async function updateTeamMatch(player1, player2, player3, player4, team1Wins) {
    console.log("Updating team match...");
    
    const team1Elo = (await getPlayerRating(player1) + await getPlayerRating(player2)) / 2;
    const team2Elo = (await getPlayerRating(player3) + await getPlayerRating(player4)) / 2;

    console.log(`Current Team Elo Ratings: Team1 (${team1Elo}), Team2 (${team2Elo})`);

    const newTeam1Elo = calculateElo(team1Elo, team2Elo, team1Wins ? 1 : 0);
    const newTeam2Elo = calculateElo(team2Elo, team1Elo, team1Wins ? 0 : 1);

    console.log(`New Team Elo Ratings: Team1 (${newTeam1Elo}), Team2 (${newTeam2Elo})`);

    await updatePlayerData(player1, newTeam1Elo, team1Wins);
    await updatePlayerData(player2, newTeam1Elo, team1Wins);
    await updatePlayerData(player3, newTeam2Elo, !team1Wins);
    await updatePlayerData(player4, newTeam2Elo, !team1Wins);

    // Reload player data and update UI
    playerRatings = await loadPlayerData();
    updatePlayerList();
}

async function updateSingleMatch(player1, player2, player1Wins) {
    console.log("Updating single match...");

    const player1Elo = await getPlayerRating(player1);
    const player2Elo = await getPlayerRating(player2);

    console.log(`Current Elo Ratings: ${player1} (${player1Elo}), ${player2} (${player2Elo})`);

    const newPlayer1Elo = calculateElo(player1Elo, player2Elo, player1Wins ? 1 : 0);
    const newPlayer2Elo = calculateElo(player2Elo, player1Elo, player1Wins ? 0 : 1);

    console.log(`New Elo Ratings: ${player1} (${newPlayer1Elo}), ${player2} (${newPlayer2Elo})`);

    await updatePlayerData(player1, newPlayer1Elo, player1Wins);
    await updatePlayerData(player2, newPlayer2Elo, !player1Wins);

    // Reload player data and update UI
    playerRatings = await loadPlayerData();
    updatePlayerList();
}

async function getPlayerRating(playerName) {
    try {
        const docRef = doc(db, "players", playerName);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data().rating || 1200;
        } else {
            console.warn(`Player ${playerName} not found, using default rating 1200`);
            return 1200;
        }
    } catch (error) {
        console.error("Error getting player rating:", error);
        return 1200;
    }
}

function toggleTeamInputs() {
    const teamPlayers = document.querySelectorAll('.team-player');
    const matchTypeLabel = document.querySelector('.match-type-label');
    const isTeamMatch = teamMatchCheckbox.checked;

    console.log("Toggling team inputs. Team match enabled?", isTeamMatch);

    teamPlayers.forEach(input => {
        input.style.display = isTeamMatch ? 'block' : 'none';
        input.querySelector('input').required = isTeamMatch;
    });

    matchTypeLabel.textContent = isTeamMatch ? '2v2 Match' : '1v1 Match';
}

async function updatePlayerList() {
    console.log("Updating player list...");
    
    playerList.innerHTML = '';
    
    try {
        // Get latest player data from Firestore
        const playersSnapshot = await getDocs(collection(db, "players"));
        
        // Map and sort players by rating
        const sortedPlayers = playersSnapshot.docs
            .map(doc => doc.data())
            .sort((a, b) => b.rating - a.rating);
            
        // Create list items for each player
        sortedPlayers.forEach((data, index) => {
            console.log(`Ranking ${index + 1}: ${data.name} - Elo: ${data.rating}`);
            
            const li = document.createElement('li');
            const winRate = data.matches > 0 
                ? Math.round((data.wins / data.matches) * 100) 
                : 0;
                
            li.innerHTML = `
                <span class="rank">${index + 1}</span>
                <span class="name">${data.name}</span>
                <span class="elo">${Math.round(data.rating)}</span>
                <span class="stats">${data.wins || 0}W - ${data.losses || 0}L</span>
                <span class="ratio">${winRate}%</span>
            `;
            playerList.appendChild(li);
        });
    } catch (error) {
        console.error("Error updating player list:", error);
    }
}

async function updatePlayersList() {
    console.log("Updating player datalist...");

    const datalist = document.getElementById('players-list');
    datalist.innerHTML = '';

    const playersSnapshot = await getDocs(collection(db, "players"));
    playersSnapshot.docs.forEach(doc => {
        console.log("Adding player to list:", doc.id);
        const option = document.createElement('option');
        option.value = doc.id;
        datalist.appendChild(option);
    });
}

// Add this to your app.js file
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        // Update active tab
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Show corresponding rankings
        const tabType = button.dataset.tab;
        document.querySelectorAll('.rankings-section').forEach(section => {
            section.style.display = 'none';
        });
        document.getElementById(`${tabType}-rankings`).style.display = 'block';

        // Update rankings based on the selected tab
        if (tabType === 'elo') {
            displayEloRankings();
        } else {
            displayWinrateRankings();
        }
    });
});

function displayEloRankings() {
    // Sort players by ELO and display in #elo-player-list
    // ...existing ranking logic...
}

function displayWinrateRankings() {
    // Sort players by winrate and display in #winrate-player-list
    // Similar to ELO rankings but sort by wins/total games
    // ...
}

// Add this function after your existing functions
function showVictoryAnimation(winners) {
    // Create victory message
    const announcement = document.getElementById('victory-announcement');
    announcement.textContent = `🏆 ${winners} Wins! 🏆`;
    announcement.style.display = 'block';

    // Trigger confetti
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });

    // Create more confetti after a small delay
    setTimeout(() => {
        confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });
    }, 250);

    // Hide announcement after animation
    setTimeout(() => {
        announcement.style.display = 'none';
    }, 3000);
}

// Initialize the application
init();