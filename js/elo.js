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

async function updatePlayerData(playerName, newRating, isWinner) {
    try {
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