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

async function loadPlayerData() {
    try {
        const data = localStorage.getItem('foosballPlayerData');
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error('Error loading player data:', error);
        return {};
    }
}

async function savePlayerData(playerData) {
    try {
        localStorage.setItem('foosballPlayerData', JSON.stringify(playerData));
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