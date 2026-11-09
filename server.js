const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Serve static frontend files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Mock database storage (Will be replaced with MongoDB/PostgreSQL later)
let players = [
    { id: 1, name: "Gildor", class: "Wizard", hp: 24, x: 100, y: 150 },
    { id: 2, name: "Thorgar", class: "Fighter", hp: 42, x: 200, y: 250 }
];

/* ==========================================================================
   API ENDPOINTS (Future Socket.io/Auth foundation)
   ========================================================================== */

// GET: Retrieve all active campaign players
app.get('/api/players', (req, res) => {
    res.json(players);
});

// POST: Add a new character or register state
app.post('/api/players', (req, res) => {
    const { name, characterClass } = req.body;
    if (!name || !characterClass) {
        return res.status(400).json({ error: "Missing character name or class" });
    }
    
    const newPlayer = {
        id: players.length + 1,
        name,
        class: characterClass,
        hp: Math.floor(Math.random() * 20) + 20,
        x: 300,
        y: 300
    };
    
    players.push(newPlayer);
    res.status(201).json(newPlayer);
});

// Catch-all route to serve the SPA frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`⚔️ D&D Campaign Server running at http://localhost:${PORT}`);
});
