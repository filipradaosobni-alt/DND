-- Run this once against your empty `dnd_vtt` database
-- e.g. mysql -u root -p dnd_vtt < schema.sql

CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS characters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    char_key CHAR(24) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    class VARCHAR(20) NOT NULL,
    str INT NOT NULL,
    dex INT NOT NULL,
    con INT NOT NULL,
    intel INT NOT NULL,   -- named `intel`, not `int`, to avoid clashing with the SQL type keyword
    wis INT NOT NULL,
    cha INT NOT NULL,
    hp INT NOT NULL,
    max_hp INT NOT NULL,
    ac INT NOT NULL,
    x INT NOT NULL DEFAULT 300,
    y INT NOT NULL DEFAULT 300,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
