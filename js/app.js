import { calculateElo, updatePlayerData, loadPlayerData, savePlayerData } from './elo.js';
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

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

    if (playerRatings[playerName]) {
        console.warn("Player already exists:", playerName);
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
        await savePlayerData(playerName, playerRatings[playerName]);
        console.log("Player added successfully:", playerRatings[playerName]);
        updatePlayerList();
        
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
        updateTeamMatch(player1, player2, player3, player4, winner === 'team1');
    } else {
        if (!player1 || !player3) {
            console.warn("Player fields missing for 1v1 match.");
            alert('Please fill in player 1 and player 2');
            return;
        }
        console.log(`Single match: ${player1} vs ${player3}, Winner: ${winner}`);
        updateSingleMatch(player1, player3, winner === 'team1');
    }

    updatePlayerList();
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

    savePlayerData();
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

    savePlayerData();
}

function getPlayerRating(playerName) {
    return playerRatings[playerName]?.rating || 1200;
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
    const playersSnapshot = await getDocs(collection(db, "players"));
    const sortedPlayers = playersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.rating - a.rating);

    sortedPlayers.forEach((data, index) => {
        console.log(`Ranking ${index + 1}: ${data.name} - Elo: ${data.rating}`);
        
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="rank">${index + 1}</span>
            <span class="name">${data.name}</span>
            <span class="elo">${Math.round(data.rating)}</span>
            <span class="stats">${data.wins}W - ${data.losses}L</span>
        `;
        playerList.appendChild(li);
    });
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

// Save player data to Firestore
async function savePlayerData(playerName, playerData) {
    const playersRef = collection(db, "players");

    try {
        // Create a new document with the player's name as the document ID
        const playerDocRef = doc(playersRef, playerName);

        // Set the document data with initial player values
        await setDoc(playerDocRef, {
            rating: playerData.rating,
            wins: playerData.wins,
            losses: playerData.losses,
            matches: playerData.matches || 0  // Initialize matches field with 0
        });

        console.log(`Player ${playerName} added successfully.`);
    } catch (error) {
        console.error("Error adding player data:", error);
        throw new Error("Failed to save player data.");
    }
}

// Initialize the application
init();