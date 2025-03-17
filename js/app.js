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
    setDoc,
    deleteDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
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
let sortBy = 'elo'; // Default sort by Elo
let rankingType = 'general'; // Default to general rankings

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

        // Check for recently approved matches
        checkRecentlyApprovedMatch();
        setupMatchListener();

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
    
    // Sorting options
    document.getElementById('sort-by-elo').addEventListener('click', function() {
        sortBy = 'elo';
        this.classList.add('active');
        document.getElementById('sort-by-winrate').classList.remove('active');
        updatePlayerList();
    });
    
    document.getElementById('sort-by-winrate').addEventListener('click', function() {
        sortBy = 'winrate';
        this.classList.add('active');
        document.getElementById('sort-by-elo').classList.remove('active');
        updatePlayerList();
    });
    
    // Update both lists when a new player is added
    window.addEventListener('playerAdded', async () => {
        playerRatings = await loadPlayerData();
        Promise.all([
            updatePlayerList(),
            updatePlayersList()
        ]);
    });
        // Listen for match approvals
        window.addEventListener('matchApproved', async (event) => {
            console.log("Match approved, updating displays...");
            await Promise.all([
                updatePlayersList(),
                updatePlayerList(),
                displayRecentMatches()
            ]);
            
            if (event.detail.shouldCelebrate) {
                celebrateVictory(event.detail.winners);
            }
        });
    setupRankingTypeDropdown();
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

    const playerDisplayName = `${playerName} ${playerFlag}`;

    try {
        const playerData = await getPlayerFromFirestore(playerDisplayName);
        if (playerData) {
            alert('Player already exists');
            return;
        }

        // Create new player data
        const newPlayer = { 
            name: playerDisplayName,
            rating: playerRating, 
            matches: 0, 
            wins: 0, 
            losses: 0,
            password: playerPassword,
            timestamp: serverTimestamp()
        };

        // Save to pendingPlayers collection instead
        await setDoc(doc(db, "pendingPlayers", playerDisplayName), newPlayer);
        
        // Clear form
        playerNameInput.value = '';
        document.getElementById('player-password').value = '';
        playerRatingInput.value = '1200';
        document.getElementById('player-flag').value = '';
        
        alert('Player submitted for approval');
    } catch (error) {
        console.error("Failed to submit player:", error);
        alert('Failed to submit player');
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

    // Get scores from the hidden inputs
    const team1Score = parseInt(document.getElementById('team1-score').value || '0');
    const team2Score = parseInt(document.getElementById('team2-score').value || '0');

    const team1Wins = winner.value === 'team1';
    
    // Get player display names for the victory message
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
    
    // Get current ratings for reference
    const currentRatings = {
        [player1]: await getPlayerRating(player1),
        [player2]: await getPlayerRating(player2),
        [player3]: await getPlayerRating(player3),
        [player4]: await getPlayerRating(player4)
    };

    try {
        // Create pending match document
        const pendingMatch = {
            team1Players,
            team2Players,
            team1Wins,
            team1Score,  // Add team1 score
            team2Score,  // Add team2 score
            timestamp: serverTimestamp(),
            currentRatings, // Store current ratings for reference
            status: 'pending',
            winners: winners // Store winner names for display
        };

        // Save to pendingMatches collection
        await addDoc(collection(db, "pendingMatches"), pendingMatch);
        
        // Show confirmation message
        alert('Match submitted for approval');

        // Reset form
        ['player1', 'player2', 'player3', 'player4'].forEach(id => {
            const select = document.getElementById(id);
            if (select) select.value = '';
        });

         // Reset scores and beads
         document.querySelector('.reset-score')?.click();
         document.getElementById('team2-bead-scorer')?.querySelector('.reset-score')?.click();
 

        const checkedRadio = document.querySelector('input[name="winner"]:checked');
        if (checkedRadio) checkedRadio.checked = false;

    } catch (error) {
        console.error("Error submitting match:", error);
        alert('Failed to submit match. Please try again.');
    }

    // When updating player records in admin.js, add this to track monthly stats:
    async function updatePlayerRecord(playerName, newRating, isWinner) {
        const playerRef = doc(db, "players", playerName);
        const playerDoc = await getDoc(playerRef);
        const playerData = playerDoc.data();

        // Get current month key (YYYY-M format)
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

        // Initialize or update monthly stats
        const monthlyStats = playerData.monthlyStats || {};
        if (!monthlyStats[currentMonth]) {
            monthlyStats[currentMonth] = { matches: 0, wins: 0, losses: 0 };
        }
        
        // Update monthly stats
        monthlyStats[currentMonth].matches = (monthlyStats[currentMonth].matches || 0) + 1;
        monthlyStats[currentMonth].wins = (monthlyStats[currentMonth].wins || 0) + (isWinner ? 1 : 0);
        monthlyStats[currentMonth].losses = (monthlyStats[currentMonth].losses || 0) + (isWinner ? 0 : 1);

        await setDoc(playerRef, {
            ...playerData,
            rating: newRating,
            matches: (playerData.matches || 0) + 1,
            wins: (playerData.wins || 0) + (isWinner ? 1 : 0),
            losses: (playerData.losses || 0) + (isWinner ? 0 : 1),
            monthlyStats: monthlyStats
        });
    }
}

async function updateTeamMatch(player1, player2, player3, player4, team1Wins) {
    console.log("Updating team match...");
    
    // Get individual ratings
    const player1Rating = await getPlayerRating(player1);
    const player2Rating = await getPlayerRating(player2);
    const player3Rating = await getPlayerRating(player3);
    const player4Rating = await getPlayerRating(player4);

    // Calculate team averages using the shared function
    const team1Avg = averageTeamElo(player1Rating, player2Rating);
    const team2Avg = averageTeamElo(player3Rating, player4Rating);

    console.log(`Team Averages - Team1: ${team1Avg}, Team2: ${team2Avg}`);

    // Calculate new individual ratings using team averages for expected score
    const result = team1Wins ? 1 : 0;
    const newPlayer1Rating = Math.round(calculateTeamElo(player1Rating, team1Avg, team2Avg, result));
    const newPlayer2Rating = Math.round(calculateTeamElo(player2Rating, team1Avg, team2Avg, result));
    const newPlayer3Rating = Math.round(calculateTeamElo(player3Rating, team2Avg, team1Avg, 1 - result));
    const newPlayer4Rating = Math.round(calculateTeamElo(player4Rating, team2Avg, team1Avg, 1 - result));

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
    console.log(`Updating player list with ranking type: ${rankingType}...`);
    
    playerList.innerHTML = '';
    
    try {
        // Get latest player data from Firestore
        const playersSnapshot = await getDocs(collection(db, "players"));
        
        // Map players with calculated stats
        const players = playersSnapshot.docs.map(doc => {
            const data = doc.data();
            const totalMatches = (data.matches || 0);
            const wins = (data.wins || 0);
            const losses = (data.losses || 0);
            
            // Check if we're using general stats or monthly stats
            let monthlyStats = { matches: 0, wins: 0, losses: 0 };
            
            if (rankingType !== 'general' && data.monthlyStats && data.monthlyStats[rankingType]) {
                // Use the specific month's stats
                monthlyStats = data.monthlyStats[rankingType];
            } else if (rankingType === 'general') {
                // Use overall stats
                monthlyStats = {
                    matches: totalMatches,
                    wins: wins,
                    losses: losses
                };
            }
            
            // Calculate win rates
            const winRate = totalMatches > 0 ? wins / totalMatches : 0;
            const monthlyWinRate = monthlyStats.matches > 0 ? monthlyStats.wins / monthlyStats.matches : 0;
            
            return {
                id: doc.id,
                name: data.name,
                rating: data.rating,
                matches: totalMatches,
                wins: wins,
                losses: losses,
                winRate: winRate,
                monthlyMatches: monthlyStats.matches || 0,
                monthlyWins: monthlyStats.wins || 0,
                monthlyLosses: monthlyStats.losses || 0,
                monthlyWinRate: monthlyWinRate
            };
        });
        
        // Sort players based on selected criteria and ranking type
        const sortedPlayers = [...players].sort((a, b) => {
            if (sortBy === 'elo') {
                return b.rating - a.rating;
            } else { // sortBy === 'winrate'
                if (rankingType === 'monthly') {
                    return b.monthlyWinRate - a.monthlyWinRate;
                } else {
                    return b.winRate - a.winRate;
                }
            }
        });
            
        // Create list items for each player
        sortedPlayers.forEach((data, index) => {
            // Determine which stats to display based on ranking type
            let winRatePercent, winsDisplay, lossesDisplay;
            
            if (rankingType === 'monthly') {
                winRatePercent = Math.round(data.monthlyWinRate * 100);
                winsDisplay = data.monthlyWins;
                lossesDisplay = data.monthlyLosses;
            } else {
                winRatePercent = Math.round(data.winRate * 100);
                winsDisplay = data.wins;
                lossesDisplay = data.losses;
            }
            
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="rank">${index + 1}</span>
                <span class="name">${data.name}</span>
                <span class="elo">${Math.round(data.rating)}</span>
                <span class="win-ratio">${winRatePercent}%</span>
                <span class="stats">${winsDisplay}W - ${lossesDisplay}L</span>
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

// Modify the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing app...");
    init();
    initializeBeadScorers();
});


// Add function to display match history

async function displayRecentMatches() {
    try {
        // Get both approved matches and pending matches
        const matchesRef = collection(db, "matches");
        const pendingMatchesRef = collection(db, "pendingMatches");
        
        const matchesQuery = query(matchesRef, orderBy("timestamp", "desc"), limit(10));
        const pendingMatchesQuery = query(pendingMatchesRef, orderBy("timestamp", "desc"));
        
        const [matchesSnapshot, pendingMatchesSnapshot] = await Promise.all([
            getDocs(matchesQuery),
            getDocs(pendingMatchesQuery)
        ]);
        
        const matchesList = document.getElementById('matches-list');
        matchesList.innerHTML = '';
        
        // Display pending matches first
        pendingMatchesSnapshot.forEach((doc) => {
            const match = doc.data();
            const matchId = doc.id;
            const date = match.timestamp.toDate();
            const formattedDate = date.toLocaleDateString();
            
            // Create score display string if scores are available
            const scoreDisplay = match.team1Score !== undefined && match.team2Score !== undefined ? 
                `<div class="match-score">${match.team1Score} - ${match.team2Score}</div>` : '';
            
            const li = document.createElement('li');
            li.className = 'match-entry pending-match';
            li.innerHTML = `
                <div class="match-content">
                    <div class="match-header">
                        <div class="match-date">${formattedDate}</div>
                        ${scoreDisplay}
                        <div class="pending-badge">PENDING</div>
                    </div>
                    <div class="teams-played">
                        ${match.team1Players.join(' & ')} vs ${match.team2Players.join(' & ')}
                    </div>
                    <div class="match-actions">
                        <button class="undo-match" data-match-id="${matchId}">
                            Undo Match
                        </button>
                    </div>
                </div>
            `;
            matchesList.appendChild(li);
        });
        
        // Then display approved matches
        matchesSnapshot.forEach((doc) => {
            const match = doc.data();
            const date = match.timestamp.toDate();
            const formattedDate = date.toLocaleDateString();
            
            // Create score display string if scores are available
            const scoreDisplay = match.team1Score !== undefined && match.team2Score !== undefined ? 
                `<div class="match-score">${match.team1Score} - ${match.team2Score}</div>` : '';
            
            const li = document.createElement('li');
            li.className = 'match-entry';
            li.innerHTML = `
                <div class="match-content">
                    <div class="match-header">
                        <div class="match-date">${formattedDate}</div>
                        ${scoreDisplay}
                    </div>
                    <div class="elo-changes">
                        ${match.eloChanges.map(change => {
                            // Check if player was on winning team
                            const isWinner = (match.team1Wins && match.team1Players.includes(change.player)) || 
                                           (!match.team1Wins && match.team2Players.includes(change.player));
                            const hasDetailedRatings = change.ratingBefore !== undefined && change.ratingAfter !== undefined;
                            const changeValue = change.change || (hasDetailedRatings ? change.ratingAfter - change.ratingBefore : 0);
                            const direction = changeValue > 0 ? 'elo-positive' : 'elo-negative';
                            
                            return `<span class="elo-change ${direction} ${isWinner ? 'match-winner' : 'match-loser'}">
                                ${change.player}: ${hasDetailedRatings ? 
                                  `${Math.round(change.ratingBefore)} → ${Math.round(change.ratingAfter)}` : 
                                  `${changeValue > 0 ? '+' : ''}${Math.round(changeValue)}`}
                                ${hasDetailedRatings ? 
                                  `<span class="change-value">(${changeValue > 0 ? '+' : ''}${Math.round(changeValue)})</span>` : 
                                  ''}
                            </span>`;
                        }).join('')}
                    </div>
                </div>
            `;
            matchesList.appendChild(li);
        });

        // Add event listeners for undo buttons
        document.querySelectorAll('.undo-match').forEach(button => {
            button.addEventListener('click', handleUndoMatch);
        });

        convertEmojis(matchesList);

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

async function handleUndoMatch(event) {
    const matchId = event.target.getAttribute('data-match-id');
    
    if (!matchId) {
        console.error('No match ID found');
        return;
    }
    
    if (!confirm('Are you sure you want to undo this pending match?')) {
        return;
    }
    
    try {
        // Delete the pending match document
        await deleteDoc(doc(db, "pendingMatches", matchId));
        
        // Refresh the matches display
        await displayRecentMatches();
        
        // Show success message
        alert('Match has been removed from pending queue');
    } catch (error) {
        console.error('Error removing match:', error);
        alert('Failed to remove match. Please try again.');
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

// Add this new function to check for recently approved matches
function checkRecentlyApprovedMatch() {
    const lastMatchStr = localStorage.getItem('lastApprovedMatch');
    if (lastMatchStr) {
        const lastMatch = JSON.parse(lastMatchStr);
        const now = Date.now();
        
        // Check if this match hasn't been celebrated yet
        if (lastMatch.shouldCelebrate && !lastMatch.celebrated) {
            console.log("Celebrating match victory...", lastMatch);
            celebrateVictory(lastMatch.winners);
            
            // Mark as celebrated
            lastMatch.celebrated = true;
            localStorage.setItem('lastApprovedMatch', JSON.stringify(lastMatch));
        }
    }
}

// Add real-time listener for matches collection
function setupMatchListener() {
    console.log("Setting up match listener...");
    const matchesRef = collection(db, "matches");
    const q = query(matchesRef, orderBy("timestamp", "desc"), limit(1));

    let lastCelebratedMatchId = localStorage.getItem('lastCelebratedMatchId');
    
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const match = change.doc.data();
                const matchId = change.doc.id; // Get the document ID
                console.log("New match detected:", match);
                
                // Update all displays
                Promise.all([
                    updatePlayersList(),
                    displayRecentMatches()
                ]).then(() => {
                    // Only celebrate if this match hasn't been celebrated before
                    if (matchId !== lastCelebratedMatchId) {
                        const winners = match.team1Wins ? match.team1Players : match.team2Players;
                        celebrateVictory(winners);
                        
                        // Store the celebrated match ID
                        localStorage.setItem('lastCelebratedMatchId', matchId);
                        lastCelebratedMatchId = matchId;
                    }
                });
            }
        });
    });
}

function initializeBeadScorers() {
    const team1Scorer = document.getElementById('team1-bead-scorer');
    const team2Scorer = document.getElementById('team2-bead-scorer');
    
    if (team1Scorer && team2Scorer) {
        setupBeadScorer(team1Scorer, 'team1');
        setupBeadScorer(team2Scorer, 'team2');
    }
}

function setupBeadScorer(scorerElement, teamId) {
    const beads = Array.from(scorerElement.querySelectorAll('.bead'));
    const scoreDisplay = scorerElement.querySelector('.score-display');
    const resetButton = scorerElement.querySelector('.reset-score');
    const scoreInput = document.getElementById(`${teamId}-score`);
    
    // Position beads at the top initially
    positionBeadsAtTop(beads);
    
    // Add click handlers to beads
    beads.forEach((bead, index) => {
        bead.addEventListener('click', () => {
            const currentScore = parseInt(scoreInput.value || '0');
            // For reverse order, we need to find the lowest bead that hasn't been scored yet
            const nextBeadIndex = findNextBeadToDrop(beads);
            
            if (index === nextBeadIndex && currentScore < 10) {
                dropBead(bead);
                updateScore(scoreInput, scoreDisplay, currentScore + 1);
            }
        });
    });
    
    // Reset button functionality
    resetButton.addEventListener('click', () => {
        resetBeads(beads);
        updateScore(scoreInput, scoreDisplay, 0);
    });
}

function findNextBeadToDrop(beads) {
    // Find the bottom-most bead that hasn't been scored yet
    for (let i = beads.length - 1; i >= 0; i--) {
        if (beads[i].dataset.scored !== 'true') {
            return i;
        }
    }
    return -1;
}

function positionBeadsAtTop(beads) {
    beads.forEach((bead, i) => {
        // Position beads at top with slight offset for visibility
        bead.style.top = `${i * 10}px`;
        bead.dataset.scored = 'false';
    });
}

function dropBead(bead) {
    bead.dataset.scored = 'true';
    // The CSS will handle actual positioning via the [data-scored="true"] selector
    // Calculate offset for smoother stacking at bottom (we're setting a CSS variable)
    const position = parseInt(bead.dataset.position);
    const offsetPx = (10 - position) * 10; // Spread beads at bottom
    bead.style.setProperty('--offset-px', `${offsetPx}px`);
}

function resetBeads(beads) {
    beads.forEach((bead, i) => {
        bead.dataset.scored = 'false';
        bead.style.top = `${i * 10}px`; // Reset to top position with offset
    });
}

function updateScore(scoreInput, scoreDisplay, newScore) {
    scoreInput.value = newScore;
    scoreDisplay.textContent = newScore;
}

// Setup the ranking type dropdown with dynamic month options
function setupRankingTypeDropdown() {
    const rankingTypeSelect = document.getElementById('ranking-type');
    if (!rankingTypeSelect) return;
    
    // Clear existing options except the first one (All Time)
    while (rankingTypeSelect.options.length > 1) {
        rankingTypeSelect.remove(1);
    }
    
    // Get all unique months from player data
    getUniqueMonths().then(months => {
        // Sort months in descending order (newest first)
        months.sort().reverse();
        
        // Add option for each month
        months.forEach(monthKey => {
            const [year, month] = monthKey.split('-');
            const date = new Date(year, month - 1, 1);
            const monthName = date.toLocaleString('en-US', { month: 'long' });
            
            const option = document.createElement('option');
            option.value = monthKey;  // Use YYYY-M format as value
            option.textContent = `${monthName} ${year}`;
            rankingTypeSelect.appendChild(option);
        });
        
        // Set current month as selected if available
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
        
        // Find and select the current month if it exists
        for (let i = 0; i < rankingTypeSelect.options.length; i++) {
            if (rankingTypeSelect.options[i].value === currentMonthKey) {
                rankingTypeSelect.selectedIndex = i;
                break;
            }
        }
    });
    
    // Add event listener to handle ranking type changes
    rankingTypeSelect.addEventListener('change', function() {
        rankingType = this.value;
        updatePlayerList(); // Refresh the player list with new ranking type
    });
}

// Function to get all unique months that have data
async function getUniqueMonths() {
    try {
        const playersSnapshot = await getDocs(collection(db, "players"));
        const months = new Set();
        
        playersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.monthlyStats) {
                Object.keys(data.monthlyStats).forEach(month => {
                    months.add(month);
                });
            }
        });
        
        return Array.from(months);
    } catch (error) {
        console.error("Error getting unique months:", error);
        return [];
    }
}