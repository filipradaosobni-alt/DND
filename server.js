require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_CHARACTERS_PER_PLAYER = 6;
const SALT_ROUNDS = 10;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
}));

/* ==========================================================================
   CLASS STAT TABLES
   ========================================================================== */
const CLASS_STATS = {
    Fighter: { str: 16, dex: 12, con: 15, int: 8,  wis: 10, cha: 10, hitDie: 10, baseArmor: 4 },
    Wizard:  { str: 8,  dex: 12, con: 12, int: 16, wis: 13, cha: 10, hitDie: 6,  baseArmor: 0 },
    Rogue:   { str: 10, dex: 16, con: 12, int: 12, wis: 10, cha: 13, hitDie: 8,  baseArmor: 1 },
    Cleric:  { str: 13, dex: 10, con: 14, int: 10, wis: 16, cha: 11, hitDie: 8,  baseArmor: 3 }
};

function abilityModifier(score) {
    return Math.floor((score - 10) / 2);
}

function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

function generateStats(characterClass) {
    const base = CLASS_STATS[characterClass] || CLASS_STATS.Fighter;
    const conMod = abilityModifier(base.con);
    const dexMod = abilityModifier(base.dex);
    const hp = rollDie(base.hitDie) + conMod + 10;
    const ac = 10 + base.baseArmor + dexMod;

    return {
        str: base.str, dex: base.dex, con: base.con,
        intel: base.int, wis: base.wis, cha: base.cha,
        hp, maxHp: hp, ac
    };
}

function generateCharacterKey() {
    return crypto.randomBytes(12).toString('hex'); // 24 hex characters
}

// Simple middleware: block a route unless someone is logged in
function requireLogin(req, res, next) {
    if (!req.session.playerId) {
        return res.status(401).json({ error: 'You must be logged in.' });
    }
    next();
}

/* ==========================================================================
   AUTH ENDPOINTS
   ========================================================================== */

// POST /api/register - create a new player account
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    try {
        const [existing] = await pool.query('SELECT id FROM players WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'That username is already taken.' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const [result] = await pool.query(
            'INSERT INTO players (username, password_hash) VALUES (?, ?)',
            [username, passwordHash]
        );

        req.session.playerId = result.insertId;
        req.session.username = username;
        res.status(201).json({ id: result.insertId, username });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Something went wrong registering.' });
    }
});

// POST /api/login - log into an existing account
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM players WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const player = rows[0];
        const passwordMatches = await bcrypt.compare(password, player.password_hash);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        req.session.playerId = player.id;
        req.session.username = player.username;
        res.json({ id: player.id, username: player.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Something went wrong logging in.' });
    }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

// GET /api/me - who's currently logged in, if anyone
app.get('/api/me', (req, res) => {
    if (!req.session.playerId) {
        return res.json({ loggedIn: false });
    }
    res.json({ loggedIn: true, id: req.session.playerId, username: req.session.username });
});

/* ==========================================================================
   CHARACTER ENDPOINTS
   ========================================================================== */

// GET /api/players - public roster/map data (no keys, no player_id exposed)
app.get('/api/players', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, class, str, dex, con, intel, wis, cha, hp, max_hp AS maxHp, ac, x, y FROM characters'
        );
        res.json(rows);
    } catch (err) {
        console.error('Fetch players error:', err);
        res.status(500).json({ error: 'Could not load characters.' });
    }
});

// GET /api/my-characters - the logged-in player's own characters (keys included)
app.get('/api/my-characters', requireLogin, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM characters WHERE player_id = ?',
            [req.session.playerId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Fetch my-characters error:', err);
        res.status(500).json({ error: 'Could not load your characters.' });
    }
});

// GET /api/players/key/:key - look up one character by its private key
app.get('/api/players/key/:key', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM characters WHERE char_key = ?', [req.params.key]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No character found for that key.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Key lookup error:', err);
        res.status(500).json({ error: 'Could not look up that key.' });
    }
});

// POST /api/players - create a new character for the logged-in player
app.post('/api/players', requireLogin, async (req, res) => {
    const { name, characterClass } = req.body;
    if (!name || !characterClass) {
        return res.status(400).json({ error: 'Missing character name or class.' });
    }
    if (!CLASS_STATS[characterClass]) {
        return res.status(400).json({ error: 'Unknown class.' });
    }

    try {
        const [countRows] = await pool.query(
            'SELECT COUNT(*) AS count FROM characters WHERE player_id = ?',
            [req.session.playerId]
        );
        if (countRows[0].count >= MAX_CHARACTERS_PER_PLAYER) {
            return res.status(403).json({
                error: `You've reached the limit of ${MAX_CHARACTERS_PER_PLAYER} characters.`
            });
        }

        const stats = generateStats(characterClass);
        const charKey = generateCharacterKey();

        const [result] = await pool.query(
            `INSERT INTO characters
                (player_id, char_key, name, class, str, dex, con, intel, wis, cha, hp, max_hp, ac, x, y)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 300, 300)`,
            [
                req.session.playerId, charKey, name, characterClass,
                stats.str, stats.dex, stats.con, stats.intel, stats.wis, stats.cha,
                stats.hp, stats.maxHp, stats.ac
            ]
        );

        res.status(201).json({
            id: result.insertId, key: charKey, name, class: characterClass,
            ...stats, x: 300, y: 300
        });
    } catch (err) {
        console.error('Create character error:', err);
        res.status(500).json({ error: 'Could not create character.' });
    }
});

// Catch-all route to serve the SPA frontend (Express 5 named-wildcard syntax)
app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`⚔️ D&D Campaign Server running at http://localhost:${PORT}`);
});
