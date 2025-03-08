import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

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
const storage = getStorage(app);

// Get player ID from URL
const urlParams = new URLSearchParams(window.location.search);
const playerId = urlParams.get('id');

// Theme switcher
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');

function switchTheme(e) {
    const isDark = e.target.checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Update chart colors if it exists
    if (window.eloChart) {
        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: isDark ? '#fff' : '#000' }
        };
        Plotly.relayout('elo-history', layout);
    }
}

toggleSwitch.addEventListener('change', switchTheme);

// Check for saved theme preference
const currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    toggleSwitch.checked = currentTheme === 'dark';
}

// Update the loadPlayerProfile function
async function loadPlayerProfile() {
    if (!playerId) {
        console.error('No player ID provided');
        window.location.href = 'index.html';
        return;
    }

    try {
        const playerDoc = await getDoc(doc(db, "players", playerId));
        if (!playerDoc.exists()) {
            console.error('Player not found');
            window.location.href = 'index.html';
            return;
        }

        const playerData = playerDoc.data();
        document.getElementById('player-name').textContent = playerData.name || 'Unnamed Player';
        
        // Update profile image with fallback
        const profileImage = document.getElementById('profile-image');
        if (playerData.profileImage) {
            profileImage.src = playerData.profileImage;
        } else {
            profileImage.src = 'images/player_gray.png'; // Use existing default image
        }
        
        // Update bio with fallback
        const bioElement = document.getElementById('player-bio');
        bioElement.textContent = playerData.bio || 'No bio available.';

        // Load performance data
        await Promise.all([
            loadEloHistory(),
            loadPlayerMatches()
        ]);

    } catch (error) {
        console.error('Error loading profile:', error);
        // Show error message to user
        const container = document.querySelector('.profile-container');
        container.innerHTML = '<div class="error">Error loading profile. Please try again later.</div>';
    }
}

async function loadPlayerMatches() {
    try {
        const matchesRef = collection(db, "matches");
        const q = query(
            matchesRef,
            orderBy("timestamp", "desc"),
            limit(10)
        );
        const snapshot = await getDocs(q);

        const matchesList = document.getElementById('player-matches');
        matchesList.innerHTML = '';

        snapshot.docs.forEach(doc => {
            const match = doc.data();
            const timestamp = match.timestamp.toDate();
            
            // Check if this player was in the match
            const playerChange = match.eloChanges.find(change => change.player === playerId);
            if (!playerChange) return;

            // Determine if player was on team 1 or 2
            const wasTeam1 = match.team1Players.includes(playerId);
            const playerTeam = wasTeam1 ? match.team1Players : match.team2Players;
            const opposingTeam = wasTeam1 ? match.team2Players : match.team1Players;
            const didWin = wasTeam1 === match.team1Wins;

            const li = document.createElement('li');
            li.innerHTML = `
                <div class="match-result ${didWin ? 'win' : 'loss'}">
                    <div class="match-teams">
                        ${playerTeam.join(' & ')} vs ${opposingTeam.join(' & ')}
                    </div>
                    <div class="match-details">
                        <span class="match-date">${timestamp.toLocaleDateString()}</span>
                        <span class="match-outcome">
                            ${didWin ? 'Won' : 'Lost'} 
                            (${playerChange.change > 0 ? '+' : ''}${Math.round(playerChange.change)})
                        </span>
                    </div>
                </div>
            `;
            matchesList.appendChild(li);
        });

        // Convert emojis in match history
        twemoji.parse(matchesList);

    } catch (error) {
        console.error('Error loading matches:', error);
        document.getElementById('player-matches').innerHTML = 
            '<li class="error">Error loading matches</li>';
    }
}

async function loadEloHistory() {
    try {
        const matchesRef = collection(db, "matches");
        const q = query(
            matchesRef,
            orderBy("timestamp", "asc")
        );
        const snapshot = await getDocs(q);

        // Initialize data structure
        const data = [{
            x: [], // timestamps
            y: [], // elo ratings
            name: 'Elo Rating',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#dc3545' }
        }];

        // Process matches chronologically
        snapshot.docs.forEach(doc => {
            const match = doc.data();
            const timestamp = match.timestamp.toDate();
            
            // Find this player's rating change
            match.eloChanges.forEach(change => {
                if (change.player === playerId) {
                    data[0].x.push(timestamp);
                    data[0].y.push(Math.round(change.rating));
                }
            });
        });

        const layout = {
            title: 'Elo Rating History',
            xaxis: {
                title: 'Date',
                type: 'date',
                gridcolor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#444' : '#ddd'
            },
            yaxis: {
                title: 'Elo Rating',
                gridcolor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#444' : '#ddd'
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000'
            }
        };

        const config = {
            responsive: true,
            displayModeBar: false
        };

        await Plotly.newPlot('elo-history', data, layout, config);

    } catch (error) {
        console.error('Error loading elo history:', error);
        document.getElementById('elo-history').innerHTML = 
            '<p class="error">Error loading Elo history</p>';
    }
}

// Edit profile handlers
document.getElementById('edit-bio').addEventListener('click', async () => {
    const playerDoc = await getDoc(doc(db, "players", playerId));
    if (!playerDoc.exists()) {
        alert('Player not found');
        return;
    }

    const currentBio = playerDoc.data().bio || '';
    const newBio = prompt('Enter new bio:', currentBio);
    
    if (newBio !== null) {
        try {
            await updateDoc(doc(db, "players", playerId), { 
                bio: newBio.trim() 
            });
            document.getElementById('player-bio').textContent = newBio.trim() || 'No bio available.';
        } catch (error) {
            console.error('Error updating bio:', error);
            alert('Failed to update bio. Please try again.');
        }
    }
});

document.getElementById('edit-profile-image').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert('Image must be less than 2MB');
                return;
            }

            // Show loading state
            document.getElementById('profile-image').style.opacity = '0.5';
            
            // Create storage reference with file extension
            const fileExt = file.name.split('.').pop();
            const storageRef = ref(storage, `profile-images/${playerId}.${fileExt}`);
            
            // Upload file
            await uploadBytes(storageRef, file);
            
            // Get download URL
            const url = await getDownloadURL(storageRef);
            
            // Update player document with new image URL
            await updateDoc(doc(db, "players", playerId), { 
                profileImage: url 
            });
            
            // Update image in UI
            const profileImage = document.getElementById('profile-image');
            profileImage.src = url;
            profileImage.style.opacity = '1';
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image. Please try again.');
            document.getElementById('profile-image').style.opacity = '1';
        }
    };

    input.click();
});

// Initialize
loadPlayerProfile();