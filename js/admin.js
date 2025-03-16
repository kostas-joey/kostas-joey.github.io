import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    getDoc,
    doc, 
    setDoc, 
    deleteDoc, 
    query,
    orderBy 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { calculateTeamElo, averageTeamElo } from './elo.js';

const firebaseConfig = {
    apiKey: "AIzaSyCC6oO1N3jkcLbyX0q9NYqWbR-VoRtZ-fQ",
    authDomain: "new-project-8e4ac.firebaseapp.com",
    projectId: "new-project-8e4ac",
    storageBucket: "new-project-8e4ac.firebasestorage.app",
    messagingSenderId: "921717995613",
    appId: "1:921717995613:web:539ba4a30df006c944b5b4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ADMIN_PASSWORD = 'balldontlie'; // Change this to your desired admin password

// DOM Elements
const adminLogin = document.getElementById('adminLogin');
const adminPanel = document.getElementById('adminPanel');
const pendingPlayersList = document.getElementById('pendingPlayersList');
const pendingMatchesList = document.getElementById('pendingMatchesList');

// Check if admin is already logged in
function checkAdminAuth() {
    const isAdminAuthenticated = localStorage.getItem('foosballAdminAuthenticated') === 'true';
    if (isAdminAuthenticated) {
        showAdminPanel();
    }
}

// Admin login handler
window.checkAdminPassword = function() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        localStorage.setItem('foosballAdminAuthenticated', 'true');
        showAdminPanel();
    } else {
        alert('Incorrect admin password');
    }
}

function showAdminPanel() {
    adminLogin.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    loadPendingData();
}

async function loadPendingData() {
    await Promise.all([
        loadPendingPlayers(),
        loadPendingMatches()
    ]);
}

async function loadPendingPlayers() {
    const pendingPlayersRef = collection(db, "pendingPlayers");
    const snapshot = await getDocs(pendingPlayersRef);
    
    pendingPlayersList.innerHTML = '';
    
    snapshot.docs.forEach(doc => {
        const player = doc.data();
        const div = createPendingPlayerElement(doc.id, player);
        pendingPlayersList.appendChild(div);
    });
}

async function loadPendingMatches() {
    const pendingMatchesRef = collection(db, "pendingMatches");
    const snapshot = await getDocs(query(pendingMatchesRef, orderBy("timestamp", "desc")));
    
    pendingMatchesList.innerHTML = '';
    
    snapshot.docs.forEach(doc => {
        const match = doc.data();
        const div = createPendingMatchElement(doc.id, match);
        pendingMatchesList.appendChild(div);
    });
}

function createPendingPlayerElement(id, player) {
    const div = document.createElement('div');
    div.className = 'pending-item';
    div.innerHTML = `
        <div class="pending-info">
            <h3>${player.name}</h3>
            <p>Initial Rating: ${player.rating}</p>
        </div>
        <div class="pending-actions">
            <button class="approve-btn" onclick="approvePlayer('${id}')">Approve</button>
            <button class="deny-btn" onclick="denyPlayer('${id}')">Deny</button>
        </div>
    `;
    return div;
}

function createPendingMatchElement(id, match) {
    const div = document.createElement('div');
    div.className = 'pending-item';
    div.innerHTML = `
        <div class="pending-info">
            <h3>${match.team1Players.join(' & ')} vs ${match.team2Players.join(' & ')}</h3>
            <p>Winner: ${match.team1Wins ? 'Team 1' : 'Team 2'}</p>
        </div>
        <div class="pending-actions">
            <button class="approve-btn" onclick="approveMatch('${id}')">Approve</button>
            <button class="deny-btn" onclick="denyMatch('${id}')">Deny</button>
        </div>
    `;
    return div;
}

window.approvePlayer = async function(playerId) {
    try {
        const playerRef = doc(db, "pendingPlayers", playerId);
        const playerDoc = await getDoc(playerRef);
        const playerData = playerDoc.data();

        // Move to approved players collection
        await setDoc(doc(db, "players", playerId), playerData);
        
        // Delete from pending
        await deleteDoc(playerRef);
        
        loadPendingPlayers();
    } catch (error) {
        console.error("Error approving player:", error);
        alert("Error approving player");
    }
}

window.denyPlayer = async function(playerId) {
    try {
        await deleteDoc(doc(db, "pendingPlayers", playerId));
        loadPendingPlayers();
    } catch (error) {
        console.error("Error denying player:", error);
        alert("Error denying player");
    }
}

window.approveMatch = async function(matchId) {
    try {
        const matchRef = doc(db, "pendingMatches", matchId);
        const matchDoc = await getDoc(matchRef);
        const pendingMatch = matchDoc.data();

        // Store match details for celebration
        const matchDetails = {
            winners: pendingMatch.winners,
            timestamp: Date.now(),
            shouldCelebrate: true
        };
        localStorage.setItem('lastApprovedMatch', JSON.stringify(matchDetails));

        // Extract data from pending match
        const { 
            team1Players, 
            team2Players, 
            team1Wins, 
            currentRatings,
            team1Score, // Include score
            team2Score  // Include score
        } = pendingMatch;

        // Calculate team averages using the existing function
        const team1Avg = averageTeamElo(currentRatings[team1Players[0]], currentRatings[team1Players[1]]);
        const team2Avg = averageTeamElo(currentRatings[team2Players[0]], currentRatings[team2Players[1]]);

        // Calculate new ratings using the existing function
        const result = team1Wins ? 1 : 0;
        const newTeam1Ratings = [
            Math.round(calculateTeamElo(currentRatings[team1Players[0]], team1Avg, team2Avg, result)),
            Math.round(calculateTeamElo(currentRatings[team1Players[1]], team1Avg, team2Avg, result))
        ];
        const newTeam2Ratings = [
            Math.round(calculateTeamElo(currentRatings[team2Players[0]], team2Avg, team1Avg, 1 - result)),
            Math.round(calculateTeamElo(currentRatings[team2Players[1]], team2Avg, team1Avg, 1 - result))
        ];

        // Create enhanced eloChanges array with before and after ratings
        const eloChanges = [
            {
                player: team1Players[0],
                ratingBefore: currentRatings[team1Players[0]],  // Add the before rating
                ratingAfter: newTeam1Ratings[0],               // Rename to ratingAfter for clarity
                rating: newTeam1Ratings[0], // Add this line for backward compatibility
                change: newTeam1Ratings[0] - currentRatings[team1Players[0]]
            },
            {
                player: team1Players[1],
                ratingBefore: currentRatings[team1Players[1]],
                ratingAfter: newTeam1Ratings[1],
                rating: newTeam1Ratings[1], // Add this line for backward compatibility
                change: newTeam1Ratings[1] - currentRatings[team1Players[1]]
            },
            {
                player: team2Players[0],
                ratingBefore: currentRatings[team2Players[0]],
                ratingAfter: newTeam2Ratings[0],
                rating: newTeam2Ratings[0], // Add this line for backward compatibility
                change: newTeam2Ratings[0] - currentRatings[team2Players[0]]
            },
            {
                player: team2Players[1],
                ratingBefore: currentRatings[team2Players[1]],
                ratingAfter: newTeam2Ratings[1], 
                rating: newTeam2Ratings[1], // Add this line for backward compatibility
                change: newTeam2Ratings[1] - currentRatings[team2Players[1]]
            }
        ];

        // Create properly structured match document
        const matchData = {
            team1Players,
            team2Players,
            team1Wins,
            team1Score, // Include score
            team2Score, // Include score
            timestamp: pendingMatch.timestamp,
            eloChanges
        };

        // Update player records
        await Promise.all([
            updatePlayerRecord(team1Players[0], newTeam1Ratings[0], team1Wins),
            updatePlayerRecord(team1Players[1], newTeam1Ratings[1], team1Wins),
            updatePlayerRecord(team2Players[0], newTeam2Ratings[0], !team1Wins),
            updatePlayerRecord(team2Players[1], newTeam2Ratings[1], !team1Wins)
        ]);

        // Save to matches collection
        await setDoc(doc(db, "matches", matchId), matchData);
        
        // Delete from pending
        await deleteDoc(matchRef);
        
        loadPendingMatches();
        alert('Match approved and player ratings updated');

        // Trigger a custom event that index.html can listen for
        const matchApprovedEvent = new CustomEvent('matchApproved', { 
            detail: matchDetails 
        });
        window.dispatchEvent(matchApprovedEvent);

    } catch (error) {
        console.error("Error approving match:", error);
        alert("Error approving match");
    }
}

window.denyMatch = async function(matchId) {
    try {
        await deleteDoc(doc(db, "pendingMatches", matchId));
        loadPendingMatches();
    } catch (error) {
        console.error("Error denying match:", error);
        alert("Error denying match");
    }
}

// Initialize admin panel
document.addEventListener('DOMContentLoaded', checkAdminAuth);

// Helper function to update player records
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