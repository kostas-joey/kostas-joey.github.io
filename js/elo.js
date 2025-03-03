import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore, collection, setDoc, getDocs, doc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

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

async function updatePlayerData(playerName, newRating, isWinner) {
    // Initialize player if not already in the ratings
    if (!playerRatings[playerName]) {
        playerRatings[playerName] = {
            rating: 1200,
            matches: 0,
            wins: 0,
            losses: 0
        };
    }

    // Update rating, match count, wins/losses
    playerRatings[playerName].rating = newRating; // Ensure playerName is used as key
    playerRatings[playerName].matches += 1;
    
    if (isWinner) {
        playerRatings[playerName].wins += 1;
    } else {
        playerRatings[playerName].losses += 1;
    }

    // Save updated player data to Firestore
    await savePlayerData(playerName, playerRatings[playerName]);
}


// Calculate average Elo for team
function averageTeamElo(player1Rating, player2Rating) {
    return (player1Rating + player2Rating) / 2;
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

// Export all functions
export {
    calculateElo,
    updatePlayerData,
    averageTeamElo,
    loadPlayerData,
    savePlayerData
};