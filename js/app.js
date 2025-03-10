import { 
    calculateElo, 
    updatePlayerData, 
    loadPlayerData, 
    savePlayerData,
    saveMatchHistory 
} from './elo.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    query,
    orderBy,
    limit,
    serverTimestamp,
    addDoc 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Firebase Initialization (already imported in HTML)
const db = getFirestore();


// DOM Elements
const playerList = document.getElementById('player-list');
const playerForm = document.getElementById('player-form');
const playerNameInput = document.getElementById('player-name');
const playerRatingInput = document.getElementById('player-rating');
//const teamMatchCheckbox = document.getElementById('team-match');
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
            updatePlayersList(),
            displayRecentMatches() // Add this line
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
    const playerPassword = document.getElementById('player-password').value;
    const playerFlag = document.getElementById('player-flag').value;
    const playerRating = parseInt(playerRatingInput.value) || 1200;

    if (!playerName || !playerPassword) {
        alert('Please enter both player name and password');
        return;
    }

    console.log("Attempting to add player:", playerName, "with rating:", playerRating);

    if (!playerName) {
        console.warn("Player name is empty.");
        alert('Please enter a player name');
        return;
    }

        // Create display name with flag
        const playerDisplayName = `${playerName} ${playerFlag}`;

    // Check if player exists in Firestore
    try {
        const playerData = await getPlayerFromFirestore(playerDisplayName);
        if (playerData) {
            console.warn("Player already exists:", playerDisplayName);
            alert('Player already exists');
            return;
        }
    } catch (error) {
        console.error("Error checking player existence:", error);
    }

    // Add new player
    const newPlayer = { 
        name: playerDisplayName,
        rating: playerRating, 
        matches: 0, 
        wins: 0, 
        losses: 0,
        password: playerPassword
    };

    try {
        await savePlayerData(playerDisplayName, newPlayer);
        console.log("Player added successfully:", newPlayer);
        
        // Reload player data to refresh our local cache
        playerRatings = await loadPlayerData();
        
        // Update UI
        updatePlayersList();
        twemoji.parse(document.body); // Parse new content for emoji
        
        // Clear form
        playerNameInput.value = '';
        document.getElementById('player-password').value = '';
        playerRatingInput.value = '1200';
        document.getElementById('player-flag').value = '';
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

// Modify handleLogMatch to include celebration
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

    const team1Players = [player1, player2];
    const team2Players = [player3, player4];
    
    // Get initial ratings
    const initialRatings = {
        [player1]: await getPlayerRating(player1),
        [player2]: await getPlayerRating(player2),
        [player3]: await getPlayerRating(player3),
        [player4]: await getPlayerRating(player4)
    };

    await updateTeamMatch(player1, player2, player3, player4, team1Wins);

    // Calculate elo changes
    const finalRatings = {
        [player1]: await getPlayerRating(player1),
        [player2]: await getPlayerRating(player2),
        [player3]: await getPlayerRating(player3),
        [player4]: await getPlayerRating(player4)
    };

    const eloChanges = Object.entries(finalRatings).map(([player, rating]) => ({
        player,
        change: rating - initialRatings[player]
    }));

    // Save match history
    await saveMatchHistory({
        team1Players,
        team2Players,
        team1Wins,
        eloChanges
    });

    // Update recent matches display
    await displayRecentMatches();
    
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

    // Update player data
    await Promise.all([
        updatePlayerData(player1, newPlayer1Rating, team1Wins),
        updatePlayerData(player2, newPlayer2Rating, team1Wins),
        updatePlayerData(player3, newPlayer3Rating, !team1Wins),
        updatePlayerData(player4, newPlayer4Rating, !team1Wins)
    ]);

    // Reload player data and update UI
    await updatePlayersList();
    await updatePlayerList();
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

/*function toggleTeamInputs() {
    const teamPlayers = document.querySelectorAll('.team-player');
    const matchTypeLabel = document.querySelector('.match-type-label');
    const isTeamMatch = teamMatchCheckbox.checked;

    console.log("Toggling team inputs. Team match enabled?", isTeamMatch);

    teamPlayers.forEach(input => {
        input.style.display = isTeamMatch ? 'block' : 'none';
        input.querySelector('input').required = isTeamMatch;
    });

    matchTypeLabel.textContent = isTeamMatch ? '2v2 Match' : '1v1 Match';
} */

async function updatePlayerList() {
    console.log("Updating player list...");
    
    playerList.innerHTML = '';
    
    try {
        // Get latest player data from Firestore
        const playersSnapshot = await getDocs(collection(db, "players"));
        
               // Map and sort players by weighted Elo
               const sortedPlayers = playersSnapshot.docs
               .map(doc => {
                   const data = doc.data();
                   const totalMatches = (data.matches || 0);
                   const wins = (data.wins || 0);
                   
                   // Calculate win rate and weighted Elo
                   const winRate = totalMatches > 0 ? wins / totalMatches : 0;
                   const weightedElo = data.rating * winRate; // Simple multiplication of Elo with win rate
                   
                   return {
                       id: doc.id,
                       name: data.name,
                       rating: data.rating,
                       matches: totalMatches,
                       wins: wins,
                       losses: (data.losses || 0),
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
            li.style.cursor = 'pointer';
            li.onclick = () => window.location.href = `player-profile.html?id=${data.id}`;
            playerList.appendChild(li);
        });

        convertEmojis(playerList);

        console.log("Player list updated with", sortedPlayers.length, "players");
    } catch (error) {
        console.error("Error updating player list:", error);
    }
}

// Replace updatePlayersList function with this new version
async function updatePlayersList() {
    console.log("Updating player selects...");

    const selects = ['player1', 'player2', 'player3', 'player4'].map(id => 
        document.getElementById(id)
    );

    try {
        const playersSnapshot = await getDocs(collection(db, "players"));
        const players = playersSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));

        // Update each select element
        selects.forEach(select => {
            // Keep the first "Select Player" option
            select.innerHTML = '<option value="">Select Player</option>';
            
            // Add player options
            players.forEach(player => {
                const option = document.createElement('option');
                option.value = player.id;
                option.textContent = player.name;
                select.appendChild(option);
            });
            convertEmojis(select);
        });
    } catch (error) {
        console.error("Error updating player selects:", error);
    }
}

// Add validation to prevent selecting the same player multiple times
document.addEventListener('change', function(event) {
    if (['player1', 'player2', 'player3', 'player4'].includes(event.target.id)) {
        const selectedValue = event.target.value;
        if (selectedValue) {
            const allSelects = ['player1', 'player2', 'player3', 'player4']
                .map(id => document.getElementById(id));
                
            allSelects.forEach(select => {
                if (select.id !== event.target.id) {
                    Array.from(select.options).forEach(option => {
                        option.disabled = option.value === selectedValue;
                    });
                }
            });
        }
    }
});

// Password protection
const CORRECT_PASSWORD = 'balldontlie'; // Change this to your desired password

function checkPassword() {
    const password = document.getElementById('passwordInput').value;
    if (password === CORRECT_PASSWORD) {
        document.getElementById('loginOverlay').classList.add('hidden');
        localStorage.setItem('foosballAuthenticated', 'true');
        init(); // Initialize the app
    } else {
        alert('Incorrect password');
    }
}

// Check if already authenticated
function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('foosballAuthenticated') === 'true';
    if (isAuthenticated) {
        document.getElementById('loginOverlay').classList.add('hidden');
        init(); // Initialize the app
    }
}

// Modify the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, checking authentication...");
    checkAuthentication();
});


// Add to window object for onclick access
window.checkPassword = checkPassword;

// Add function to display match history
async function displayRecentMatches() {
    try {
        const matchesRef = collection(db, "matches");
        const q = query(matchesRef, orderBy("timestamp", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        
        const matchesList = document.getElementById('matches-list');
        matchesList.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const match = doc.data();
            const date = match.timestamp.toDate();
            
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="match-result">
                    <div class="match-teams">
                        <span class="${match.team1Wins ? 'match-winner' : 'match-loser'}">
                            ${match.team1Players.join(' & ')}
                        </span>
                        vs
                        <span class="${match.team1Wins ? 'match-loser' : 'match-winner'}">
                            ${match.team2Players.join(' & ')}
                        </span>
                    </div>
                    <div class="match-meta">
                        ${date.toLocaleString()}
                    </div>
                </div>
                <div class="elo-changes">
                    ${match.eloChanges.map(change => 
                        `<span class="elo-change ${change.change > 0 ? 'elo-positive' : 'elo-negative'}">
                            ${change.player}: ${change.change > 0 ? '+' : ''}${Math.round(change.change)}
                        </span>`
                    ).join(' ')}
                </div>
            `;
            matchesList.appendChild(li);
        });

        convertEmojis(playerList);

    } catch (error) {
        console.error("Error displaying match history:", error);
    }
}

function convertEmojis(element) {
    if (typeof twemoji !== 'undefined') {
        twemoji.parse(element, {
            folder: 'svg',
            ext: '.svg'
        });
    }
}

// Theme switcher
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');

function switchTheme(e) {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }    
}

toggleSwitch.addEventListener('change', switchTheme);

// Check for saved theme preference
const currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'dark') {
        toggleSwitch.checked = true;
    }
}