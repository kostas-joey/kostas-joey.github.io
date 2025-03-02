
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs } from "firebase/firestore"; 

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD1nnM8PbImTnRPdr6O2Nkcsm_6k22XHBo",
    authDomain: "foosball-elo-53e01.firebaseapp.com",
    projectId: "foosball-elo-53e01",
    storageBucket: "foosball-elo-53e01.firebasestorage.app",
    messagingSenderId: "520975826180",
    appId: "1:520975826180:web:58daa9f0fc6327a0036451"
  };
  

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize player ratings dictionary
let playerRatings = {};

// Elo rating calculation function
function calculateElo(playerRating, opponentRating, result) {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    return playerRating + K * (result - expectedScore);
}

function updatePlayerData(playerRatings, playerName, newRating, isWinner) {
    if (!playerRatings[playerName]) {
        playerRatings[playerName] = {
            rating: 1200,
            matches: 0,
            wins: 0,
            losses: 0
        };
    }
    
    playerRatings[playerName].rating = newRating;
    playerRatings[playerName].matches += 1;
    
    if (isWinner) {
        playerRatings[playerName].wins += 1;
    } else {
        playerRatings[playerName].losses += 1;
    }
}

function averageTeamElo(player1Rating, player2Rating) {
    return (player1Rating + player2Rating) / 2;
}

function getPlayerRatings() {
    return playerRatings;
}
>>>>>>> parent of 0692b5b (joey)

async function loadPlayerData() {
    try {
        const querySnapshot = await getDocs(collection(db, "players"));
        let players = {};
        querySnapshot.forEach((doc) => {
            players[doc.id] = doc.data();
        });
        return players;
    } catch (error) {
        console.error('Error loading player data:', error);
        return {};
    }
}

// async function loadPlayerData() {
//     try {
//         const querySnapshot = await getDocs(collection(db, "players"));
//         let playerData = {};
//         querySnapshot.forEach((doc) => {
//             playerData[doc.id] = doc.data();
//         });
//         console.log("Player data loaded from Firebase:", playerData);
//         return playerData;
//     } catch (error) {
//         console.error("Error loading player data:", error);
//         return {};
//     }
// }


async function savePlayerData(playerData) {
    try {
        const batch = db.batch();
        Object.keys(playerData).forEach((playerName) => {
            const playerRef = doc(db, "players", playerName);
            batch.set(playerRef, playerData[playerName]);
        });
        await batch.commit();
        return true;
    } catch (error) {
        console.error('Error saving player data:', error);
        return false;
    }
}
// async function savePlayerData(playerData) {
//     try {
//         for (const [playerName, data] of Object.entries(playerData)) {
//             await setDoc(doc(db, "players", playerName), data);
//         }
//         console.log("Player data saved to Firebase.");
//         return true;
//     } catch (error) {
//         console.error("Error saving player data:", error);
//         return false;
//     }
// }

export function calculateTeamEloChange(team1Players, team2Players, team1Wins) {
    // Get initial individual ratings
    const team1Ratings = team1Players.map(p => playerRatings[p]?.rating || 1200);
    const team2Ratings = team2Players.map(p => playerRatings[p]?.rating || 1200);

    // Calculate team means
    const team1Mean = team1Ratings.reduce((a, b) => a + b, 0) / team1Ratings.length;
    const team2Mean = team2Ratings.reduce((a, b) => a + b, 0) / team2Ratings.length;

    // Calculate Elo change based on team means
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (team2Mean - team1Mean) / 400));
    const actualScore = team1Wins ? 1 : 0;
    const eloChange = K * (actualScore - expectedScore);

    return eloChange;
}

// Export all functions
export {
    calculateElo,
    updatePlayerData,
    averageTeamElo,
    getPlayerRatings,
    loadPlayerData,
    savePlayerData
};