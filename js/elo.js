import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore, collection, setDoc, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

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

// Elo rating calculation function
function calculateElo(playerRating, opponentRating, result) {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    return playerRating + K * (result - expectedScore);
}

// Calculate Elo change for a player based on team average
function calculateTeamElo(playerRating, teamAvgRating, opponentTeamAvgRating, result) {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (opponentTeamAvgRating - teamAvgRating) / 400));
    return playerRating + K * (result - expectedScore);
}

async function updatePlayerData(playerName, newRating, isWinner) {
    try {
        console.log(`Updating player ${playerName}:`, { newRating, isWinner });
        
        // Get current player data from Firestore
        const playerRef = doc(db, "players", playerName);
        const playerDoc = await getDoc(playerRef);
        
        if (!playerDoc.exists()) {
            console.error(`Player ${playerName} not found in Firestore`);
            return false;
        }
        
        const playerData = playerDoc.data();
        
        // Update player data
        const updatedData = {
            ...playerData,
            rating: newRating,
            matches: (playerData.matches || 0) + 1,
            wins: (playerData.wins || 0) + (isWinner ? 1 : 0),
            losses: (playerData.losses || 0) + (isWinner ? 0 : 1)
        };
        
        // Save to Firestore
        await setDoc(playerRef, updatedData);
        console.log(`Updated player ${playerName}: new rating ${newRating}`);
        return true;
    } catch (error) {
        console.error("Error updating player data:", error);
        return false;
    }
}

// Calculate average Elo for team
function averageTeamElo(player1Rating, player2Rating) {
    return (player1Rating + player2Rating) / 2;
}

// Calculate weighted Elo by win rate
function calculateWeightedElo(rating, wins, totalMatches) {
    const winRate = totalMatches > 0 ? wins / totalMatches : 0;
    return rating * winRate;
}

// Load player data from Firestore
async function loadPlayerData() {
    try {
        const querySnapshot = await getDocs(collection(db, "players"));
        let playerData = {};
        querySnapshot.forEach((doc) => {
            playerData[doc.id] = doc.data();
        });
        console.log("Player data loaded from Firebase:", playerData);
        return playerData;
    } catch (error) {
        console.error("Error loading player data:", error);
        return {};
    }
}

// Save player data to Firestore
async function savePlayerData(playerName, playerData) {
    try {
        // Use setDoc to create or update a player document
        await setDoc(doc(db, "players", playerName), playerData);
        console.log(`Player data for ${playerName} saved to Firebase.`);
        return true;
    } catch (error) {
        console.error("Error saving player data:", error);
        return false;
    }
}

// Process a team match
async function processTeamMatch(team1Players, team2Players, team1Wins) {
    try {
        console.log("Processing team match with players:", { team1Players, team2Players });

        // Get current ratings for all players
        const [player1Team1Data, player2Team1Data] = await Promise.all([
            getDoc(doc(db, "players", team1Players[0])),
            getDoc(doc(db, "players", team1Players[1]))
        ]);
        const [player1Team2Data, player2Team2Data] = await Promise.all([
            getDoc(doc(db, "players", team2Players[0])),
            getDoc(doc(db, "players", team2Players[1]))
        ]);

        // Get original ratings and log them
        const team1Ratings = [
            player1Team1Data.data().rating,
            player2Team1Data.data().rating
        ];
        const team2Ratings = [
            player1Team2Data.data().rating,
            player2Team2Data.data().rating
        ];

        console.log("Original ratings:", {
            team1: team1Ratings,
            team2: team2Ratings
        });

        // Calculate team averages
        const team1Avg = averageTeamElo(team1Ratings[0], team1Ratings[1]);
        const team2Avg = averageTeamElo(team2Ratings[0], team2Ratings[1]);

        // Calculate new ratings
        const result = team1Wins ? 1 : 0;
        const newTeam1Ratings = [
            Math.round(calculateTeamElo(team1Ratings[0], team1Avg, team2Avg, result)),
            Math.round(calculateTeamElo(team1Ratings[1], team1Avg, team2Avg, result))
        ];
        const newTeam2Ratings = [
            Math.round(calculateTeamElo(team2Ratings[0], team2Avg, team1Avg, 1 - result)),
            Math.round(calculateTeamElo(team2Ratings[1], team2Avg, team1Avg, 1 - result))
        ];

        console.log("New ratings:", {
            team1: newTeam1Ratings,
            team2: newTeam2Ratings
        });

        // Update all players
        const updateResults = await Promise.all([
            updatePlayerData(team1Players[0], newTeam1Ratings[0], team1Wins),
            updatePlayerData(team1Players[1], newTeam1Ratings[1], team1Wins),
            updatePlayerData(team2Players[0], newTeam2Ratings[0], !team1Wins),
            updatePlayerData(team2Players[1], newTeam2Ratings[1], !team1Wins)
        ]);

        // Verify all updates were successful
        if (updateResults.includes(false)) {
            console.error("One or more player updates failed");
            return false;
        }

        console.log("Successfully updated all player ratings");
        return true;
    } catch (error) {
        console.error("Error processing team match:", error);
        return false;
    }
}

// Export all functions
export {
    calculateElo,
    updatePlayerData,
    averageTeamElo,
    loadPlayerData,
    savePlayerData,
    calculateWeightedElo,  // Add the new function to exports
    processTeamMatch,
    calculateTeamElo
};