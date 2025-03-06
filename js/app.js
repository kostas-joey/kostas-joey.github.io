import { calculateElo, updatePlayerData, loadPlayerData, savePlayerData } from './elo.js';
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Firebase Initialization (already imported in HTML)
const db = getFirestore();

// DOM Elements
const playerList = document.getElementById('player-list');
const playerForm = document.getElementById('player-form');
const playerNameInput = document.getElementById('player-name');
const playerRatingInput = document.getElementById('player-rating');
const logMatchButton = document.getElementById('log-match');

let playerRatings = {};

// Load initial player data from Firestore
async function init() {
    console.log("Initializing application...");
    try {
        await Promise.all([
            loadPlayerData().then(data => {
                playerRatings = data;
                console.log("Loaded player data from Firestore:", playerRatings);
            }),
            updatePlayersList() // Make sure player lists are populated
        ]);
        
        updatePlayerList();
        setupEventListeners();
    } catch (error) {
        console.error("Error during initialization:", error);
    }
}

// Modify the event listener setup to ensure proper loading sequence
function setupEventListeners() {
    console.log("Setting up event listeners...");
    
    // Add player form submission
    playerForm.addEventListener('submit', handleAddPlayer);
    
    // Log match button
    logMatchButton.addEventListener('click', handleLogMatch);
    
    // Update both lists when a new player is added
    window.addEventListener('playerAdded', async () => {
        playerRatings = await loadPlayerData();
        Promise.all([
            updatePlayerList(),
            updatePlayersList()
        ]);
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

function celebrateVictory(winners) {
    // Show victory message
    const victoryMessage = document.getElementById('victoryMessage');
    const winnersText = document.getElementById('winners');
    winnersText.textContent = `${winners.join(' & ')} win!`;
    victoryMessage.classList.add('show');

    // Trigger confetti
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });

    // Hide message after 3 seconds
    setTimeout(() => {
        victoryMessage.classList.remove('show');
    }, 3000);
}

// Modified handleLogMatch to ensure data consistency
async function handleLogMatch() {
    console.log("Logging a new match...");

    const winner = document.querySelector('input[name="winner"]:checked');
    if (!winner) {
        console.warn("No winner selected.");
        alert('Please select a winner');
        return;
    }

    const player1 = document.getElementById('player1').value.trim();
    const player2 = document.getElementById('player2').value.trim();
    const player3 = document.getElementById('player3').value.trim();
    const player4 = document.getElementById('player4').value.trim();

    if (!player1 || !player2 || !player3 || !player4) {
        console.warn("Not all players selected");
        alert('Please select all players');
        return;
    }

    const team1Wins = winner.value === 'team1';
    
    // Get winning players
    const winners = team1Wins ? 
        [
            document.getElementById('player1').options[document.getElementById('player1').selectedIndex].text,
            document.getElementById('player2').options[document.getElementById('player2').selectedIndex].text
        ] : 
        [
            document.getElementById('player3').options[document.getElementById('player3').selectedIndex].text,
            document.getElementById('player4').options[document.getElementById('player4').selectedIndex].text
        ];

    try {
        // Update the match in Firestore
        await updateTeamMatch(player1, player2, player3, player4, team1Wins);
        
        // Reload player data directly from Firestore to ensure consistency
        playerRatings = await loadPlayerData();
        
        // Update UI with freshly loaded data from Firestore
        await updatePlayerList();
        
        // Celebrate victory
        celebrateVictory(winners);
    
        // Reset form safely
        ['player1', 'player2', 'player3', 'player4'].forEach(id => {
            const select = document.getElementById(id);
            if (select) select.value = '';
        });
    
        // Uncheck winner radio button safely
        const checkedRadio = document.querySelector('input[name="winner"]:checked');
        if (checkedRadio) checkedRadio.checked = false;
    
        // Update player select dropdowns with fresh data
        await updatePlayersList();
    } catch (error) {
        console.error("Error logging match:", error);
        alert("Failed to log match. Please try again.");
    }
}

async function updateTeamMatch(player1, player2, player3, player4, team1Wins) {
    console.log("Updating team match...");
    
    // Get individual ratings
    const player1Rating = await getPlayerRating(player1);
    const player2Rating = await getPlayerRating(player2);
    const player3Rating = await getPlayerRating(player3);
    const player4Rating = await getPlayerRating(player4);

    // Calculate team averages (only for expected score calculation)
    const team1Avg = (player1Rating + player2Rating) / 2;
    const team2Avg = (player3Rating + player4Rating) / 2;

    console.log(`Team Averages - Team1: ${team1Avg}, Team2: ${team2Avg}`);

    // Calculate new individual ratings using team averages for expected score
    const result = team1Wins ? 1 : 0;
    const newPlayer1Rating = calculateElo(player1Rating, team2Avg, result);
    const newPlayer2Rating = calculateElo(player2Rating, team2Avg, result);
    const newPlayer3Rating = calculateElo(player3Rating, team1Avg, 1 - result);
    const newPlayer4Rating = calculateElo(player4Rating, team1Avg, 1 - result);

    console.log("New individual ratings:", {
        [player1]: newPlayer1Rating,
        [player2]: newPlayer2Rating,
        [player3]: newPlayer3Rating,
        [player4]: newPlayer4Rating
    });

    // Update player data in Firestore
    await Promise.all([
        updatePlayerData(player1, newPlayer1Rating, team1Wins),
        updatePlayerData(player2, newPlayer2Rating, team1Wins),
        updatePlayerData(player3, newPlayer3Rating, !team1Wins),
        updatePlayerData(player4, newPlayer4Rating, !team1Wins)
    ]);
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

// Completely rewritten updatePlayerList function to fix the duplication issue
async function updatePlayerList() {
    console.log("Updating player list...");
    
    playerList.innerHTML = '';
    
    try {
        // Get the latest player data directly from Firestore
        const playersSnapshot = await getDocs(collection(db, "players"));
        
        // Create a map of player data by ID to prevent duplicates
        const playerMap = new Map();
        
        playersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            playerMap.set(doc.id, {
                id: doc.id,
                name: data.name,
                rating: data.rating || 1200,
                matches: data.matches || 0,
                wins: data.wins || 0,
                losses: data.losses || 0
            });
        });
        
        // Convert map to array and calculate weighted Elo
        const sortedPlayers = Array.from(playerMap.values())
            .map(player => {
                const totalMatches = player.matches;
                const wins = player.wins;
                const winRate = totalMatches > 0 ? wins / totalMatches : 0;
                const weightedElo = player.rating * winRate;
                
                return {
                    ...player,
                    weightedElo: weightedElo
                };
            })
            .sort((a, b) => b.weightedElo - a.weightedElo);
        
        // Create list items for each player
        sortedPlayers.forEach((data, index) => {
            const winRate = data.matches > 0 
                ? Math.round((data.wins / data.matches) * 100) 
                : 0;
            
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="rank">${index + 1}</span>
                <span class="name">${data.name}</span>
                <span class="elo">${Math.round(data.rating)}</span>
                <span class="stats">${data.wins}W - ${data.losses}L</span>
                <span class="ratio">${winRate}%</span>
            `;
            playerList.appendChild(li);
        });

        console.log("Player list updated with", sortedPlayers.length, "players");
    } catch (error) {
        console.error("Error updating player list:", error);
    }
}

// Improved updatePlayersList function
async function updatePlayersList() {
    console.log("Updating player selects...");

    const selects = ['player1', 'player2', 'player3', 'player4'].map(id => 
        document.getElementById(id)
    );

    try {
        const playersSnapshot = await getDocs(collection(db, "players"));
        
        // Create a map of players to prevent duplicates
        const playerMap = new Map();
        
        playersSnapshot.docs.forEach(doc => {
            playerMap.set(doc.id, {
                id: doc.id,
                name: doc.data().name
            });
        });
        
        // Convert to array
        const players = Array.from(playerMap.values());

        // Update each select element
        selects.forEach(select => {
            // Keep the first "Select Player" option
            const currentValue = select.value;
            select.innerHTML = '<option value="">Select Player</option>';
            
            // Add player options
            players.forEach(player => {
                const option = document.createElement('option');
                option.value = player.id;
                option.textContent = player.name;
                select.appendChild(option);
            });
            
            // Restore selected value if possible
            if (currentValue && playerMap.has(currentValue)) {
                select.value = currentValue;
            }
        });
        
        // Re-apply disabled state for already selected players
        applyPlayerSelectRestrictions();
    } catch (error) {
        console.error("Error updating player selects:", error);
    }
}

// New function to apply select restrictions
function applyPlayerSelectRestrictions() {
    const selects = ['player1', 'player2', 'player3', 'player4'].map(id => 
        document.getElementById(id)
    );
    
    // Get all selected values
    const selectedValues = selects.map(select => select.value).filter(value => value !== "");
    
    // Disable options that are already selected in other dropdowns
    selects.forEach(select => {
        Array.from(select.options).forEach(option => {
            if (option.value !== "" && selectedValues.includes(option.value) && option.value !== select.value) {
                option.disabled = true;
            } else {
                option.disabled = false;
            }
        });
    });
}

// Add validation to prevent selecting the same player multiple times
document.addEventListener('change', function(event) {
    if (['player1', 'player2', 'player3', 'player4'].includes(event.target.id)) {
        applyPlayerSelectRestrictions();
    }
});

// Replace the multiple event listeners with a single initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded, initializing application...");
    try {
        await Promise.all([
            loadPlayerData().then(data => {
                playerRatings = data;
                console.log("Loaded player data from Firestore:", playerRatings);
            }),
            updatePlayersList()
        ]);
        
        await updatePlayerList();
        setupEventListeners();
    } catch (error) {
        console.error("Error during initialization:", error);
    }
});
