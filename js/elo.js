import { initializeApp } from "node-modules/firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs } from "node-modules/firebase/firestore"; 

// Your web app's Firebase configuration
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
 
 // Initialize player ratings dictionary
 let playerRatings = {};

 // Elo rating calculation function
 function calculateElo(playerRating, opponentRating, result) {
     const K = 32;
     const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
     return playerRating + K * (result - expectedScore);
 }
 
//  function updatePlayerData(playerRatings, playerName, newRating, isWinner) {
//      if (!playerRatings[playerName]) {
//          playerRatings[playerName] = {
//              rating: 1200,
//              matches: 0,
//              wins: 0,
//              losses: 0
//          };
//      }
     
//      playerRatings[playerName].rating = newRating;
//      playerRatings[playerName].matches += 1;
     
//      if (isWinner) {
//          playerRatings[playerName].wins += 1;
//      } else {
//          playerRatings[playerName].losses += 1;
//      }
//  }

async function updatePlayerData(playerRatings, playerName, newRating, isWinner) {
    if (!playerRatings[playerName]) {
        playerRatings[playerName] = { rating: 1200, matches: 0, wins: 0, losses: 0 };
    }

    playerRatings[playerName].rating = newRating;
    playerRatings[playerName].matches += 1;
    if (isWinner) {
        playerRatings[playerName].wins += 1;
    } else {
        playerRatings[playerName].losses += 1;
    }

    await savePlayerData(playerRatings);  // Save updated data to Firebase
}

 
 function averageTeamElo(player1Rating, player2Rating) {
     return (player1Rating + player2Rating) / 2;
 }
 
 function getPlayerRatings() {
     return playerRatings;
 }
 
//  async function loadPlayerData() {
//      try {
//          const data = localStorage.getItem('foosballPlayerData');
//          return data ? JSON.parse(data) : {};
//      } catch (error) {
//          console.error('Error loading player data:', error);
//          return {};
//      }
//  }

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

//
//  async function savePlayerData(playerData) {
//      try {
//          localStorage.setItem('foosballPlayerData', JSON.stringify(playerData));
//          return true;
//      } catch (error) {
//          console.error('Error saving player data:', error);
//          return false;
//      }
//  }
async function savePlayerData(playerData) {
    try {
        for (const [playerName, data] of Object.entries(playerData)) {
            await setDoc(doc(db, "players", playerName), data);
        }
        console.log("Player data saved to Firebase.");
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
     getPlayerRatings,
     loadPlayerData,
     savePlayerData
 };