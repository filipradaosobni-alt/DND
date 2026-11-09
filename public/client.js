const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const playerList = document.getElementById('player-list');
const charForm = document.getElementById('character-form');

// Fetch players from our API and draw them to canvas
async function updateGameArea() {
    try {
        const response = await fetch('/api/players');
        const players = await response.json();
        
        // Clear canvas layout loop
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        playerList.innerHTML = '';

        players.forEach(player => {
            // 1. Draw representation token on map canvas
            ctx.beginPath();
            ctx.arc(player.x, player.y, 15, 0, 2 * Math.PI);
            ctx.fillStyle = player.class === 'Wizard' ? '#4a90e2' : '#d0021b';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            // Text Label above token
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.fillText(player.name, player.x - 18, player.y - 22);

            // 2. Render user metadata to roster tracking list
            const li = document.createElement('li');
            li.textContent = `${player.name} (${player.class}) - HP: ${player.hp}`;
            playerList.appendChild(li);
        });
    } catch (err) {
        console.error("Error updating canvas stream:", err);
    }
}

// Intercept form creation to append data through API
charForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('char-name').value;
    const characterClass = document.getElementById('char-class').value;

    await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, characterClass })
    });

    document.getElementById('char-name').value = '';
    updateGameArea();
});

// Run rendering loop on loop cycle
setInterval(updateGameArea, 3000);
updateGameArea();
