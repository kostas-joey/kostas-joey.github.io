import { getFirestore, collection, getDocs, setDoc, doc } from "firebase/firestore";
const db = getFirestore();

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

// Export all functions
export {
    calculateElo,
    updatePlayerData,
    averageTeamElo,
    getPlayerRatings,
    loadPlayerData,
    savePlayerData
};