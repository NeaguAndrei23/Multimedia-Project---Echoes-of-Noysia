const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// HUD & controls
let deathCount = 0;
const deathCounterElement = document.getElementById('deathCount');
const playAgainButton = document.getElementById('playAgainButton');
const winOverlay = document.getElementById('winOverlay');
const overlayPlayAgain = document.getElementById('overlayPlayAgain');
const startButton = document.getElementById('startButton');
// Start paused; pressing Start Game will unpause and trigger initial flash
let gamePaused = true;
let started = false;
let nextLevelIndex = null;

// Audio
const deathSound = new Audio('./assets/death.mp3');
deathSound.preload = 'auto';
deathSound.volume = 0.6;

// audio controls
let soundEnabled = true;
const victorySound = new Audio('./assets/victory.mp3');
victorySound.preload = 'auto';
victorySound.volume = 0.9;
const soundToggleButton = document.getElementById('soundToggleButton');
let victoryPlayed = false;

function updateHUD() {
    if (deathCounterElement) deathCounterElement.innerText = deathCount;
}

// initialize HUD display
updateHUD();

// Initialize sound toggle label
if (soundToggleButton) soundToggleButton.innerText = soundEnabled ? 'Sound: On' : 'Sound: Off';


// Player
const player = {
    x: 50,
    y: canvas.height - 50,
    radius: 25,
    color: '#ffcc00',
    speed: 6,
    startX: 50,
    startY: canvas.height - 50
};

// Respawn/flash settings
player.respawnedAt = 0; // timestamp when player was moved to start
player.respawnFlashDuration = 2000; // ms to flash after respawn
player.respawnFlashInterval = 150; // ms per flash toggle
// Enemy properties
const enemySize = 40;
const revealRadius = 100;
const revealTime = 3000;

// Spawn / goal area visuals
const spawnAreaSize = 80; // square size in px
const spawnAreaColor = 'rgba(0, 123, 255, 0.25)'; // blue-ish
const goalAreaColor = 'rgba(255, 193, 7, 0.25)'; // yellow-ish

// Levels setup with positions, movement, visibility
const levels = [
    // Level 1 - horizontal lanes, 5 enemies
    [
        { x: 50, y: 100, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 200, y: 100, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 350, y: 100, vx: 1, vy: 0, visible: false, lastRevealed: 0 },

        { x: 50, y: 200, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 200, y: 200, vx: 1, vy: 0, visible: false, lastRevealed: 0 }
    ],

    // Level 2 - vertical lanes, 6 enemies
    [
        { x: 150, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 150, y: 150, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 150, y: 250, vx: 0, vy: 1, visible: false, lastRevealed: 0 },

        { x: 300, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 300, y: 150, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 300, y: 250, vx: 0, vy: 1, visible: false, lastRevealed: 0 }
    ],

    // Level 3 - mix of horizontal and vertical lanes
    [
        { x: 50, y: 120, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 200, y: 120, vx: 1, vy: 0, visible: false, lastRevealed: 0 },

        { x: 400, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 400, y: 200, vx: 0, vy: 1, visible: false, lastRevealed: 0 },

        { x: 600, y: 150, vx: 0, vy: 1, visible: false, lastRevealed: 0 }
    ],

    // Level 4 - horizontal lanes, tighter spacing
    [
        { x: 50, y: 80, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 180, y: 80, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 310, y: 80, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 440, y: 150, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 570, y: 150, vx: 1, vy: 0, visible: false, lastRevealed: 0 }
    ],

    // Level 5 - vertical lanes with staggered x
    [
        { x: 120, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 120, y: 150, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 120, y: 250, vx: 0, vy: 1, visible: false, lastRevealed: 0 },

        { x: 300, y: 100, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 300, y: 200, vx: 0, vy: 1, visible: false, lastRevealed: 0 }
    ],

    // Level 6 - diagonal lanes
    [
        { x: 50, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
        { x: 150, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
        { x: 250, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },

        { x: 400, y: 100, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
        { x: 500, y: 100, vx: 1, vy: 1, visible: false, lastRevealed: 0 }
    ],

    // Level 7 - mix horizontal and vertical lanes
    [
        { x: 50, y: 100, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 200, y: 100, vx: 1, vy: 0, visible: false, lastRevealed: 0 },

        { x: 400, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 400, y: 150, vx: 0, vy: 1, visible: false, lastRevealed: 0 },

        { x: 600, y: 100, vx: 0, vy: 1, visible: false, lastRevealed: 0 }
    ],

    // Level 8 - horizontal lines, more enemies
    [
        { x: 50, y: 60, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 150, y: 60, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 250, y: 60, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 350, y: 120, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 450, y: 120, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 550, y: 120, vx: 1, vy: 0, visible: false, lastRevealed: 0 }
    ],

    // Level 9 - vertical lanes, tighter spacing
    [
        { x: 100, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 100, y: 120, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 100, y: 190, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 200, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
        { x: 200, y: 120, vx: 0, vy: 1, visible: false, lastRevealed: 0 }
    ],

    // Level 10 - mix diagonal and horizontal
    [
        { x: 50, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
        { x: 150, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
        { x: 250, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },

        { x: 400, y: 150, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
        { x: 500, y: 150, vx: 1, vy: 0, visible: false, lastRevealed: 0 }
    ]
];


// Random starting level
let currentLevel = Math.floor(Math.random() * levels.length);
// Use a deep copy so original level definitions remain unchanged when enemies move
let enemies = JSON.parse(JSON.stringify(levels[currentLevel]));

// Goal (flag image)
const goalImage = new Image();
goalImage.src = 'assets/flag.png';
const goal = { x: canvas.width - 70, y: 20, width: 50, height: 50 };

// Draw everything
function draw() {
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const now = Date.now();

    // Draw spawn area square behind the player start
    const spawnX = player.startX - spawnAreaSize / 2;
    const spawnY = player.startY - spawnAreaSize / 2;
    ctx.fillStyle = spawnAreaColor;
    ctx.fillRect(spawnX, spawnY, spawnAreaSize, spawnAreaSize);

    // Draw goal area square behind the goal
    const goalPad = 6;
    ctx.fillStyle = goalAreaColor;
    ctx.fillRect(goal.x - goalPad, goal.y - goalPad, goal.width + goalPad * 2, goal.height + goalPad * 2);

    // Player (with respawn flash)
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    // determine fill color based on respawn flash state
    let fillColor = player.color;
    if (player.respawnedAt && now - player.respawnedAt < player.respawnFlashDuration) {
        const elapsed = now - player.respawnedAt;
        const phase = Math.floor(elapsed / player.respawnFlashInterval) % 2;
        if (phase === 0) {
            fillColor = '#4caf50'; // green when flashing on
        } else {
            fillColor = player.color; // original color when flashing off
        }
    }
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.closePath();

    // Enemies
    enemies.forEach(enemy => {
        const dx = player.x - (enemy.x + enemySize / 2);
        const dy = player.y - (enemy.y + enemySize / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= revealRadius) {
            enemy.visible = true;
            enemy.lastRevealed = now;
        }

        if (enemy.visible && now - enemy.lastRevealed <= revealTime) {
            ctx.fillStyle = 'red';
            ctx.fillRect(enemy.x, enemy.y, enemySize, enemySize);
        }
    });

    // Draw goal image
    ctx.drawImage(goalImage, goal.x, goal.y, goal.width, goal.height);
}

// Update enemy positions
function updateEnemies() {
    enemies.forEach(enemy => {
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;

        if (enemy.x < 0 || enemy.x + enemySize > canvas.width) enemy.vx *= -1;
        if (enemy.y < 0 || enemy.y + enemySize > canvas.height) enemy.vy *= -1;
    });
}

// Collision detection
function checkCollisions() {
    const now = Date.now();
    const invincible = player.respawnedAt && now - player.respawnedAt < player.respawnFlashDuration;
    for (let enemy of enemies) {
        // If player is flashing after respawn, they are temporarily immune
        if (invincible) continue;
        if (
            player.x + player.radius > enemy.x &&
            player.x - player.radius < enemy.x + enemySize &&
            player.y + player.radius > enemy.y &&
            player.y - player.radius < enemy.y + enemySize
        ) {
            // Increment death counter and reset player to start
            deathCount++;
            updateHUD();
            // play death sound (safe: ignore promise rejections)
            if (soundEnabled && deathSound && typeof deathSound.play === 'function') {
                try {
                    deathSound.currentTime = 0;
                    deathSound.play().catch(() => {});
                } catch (e) {
                    // ignore play error
                }
            }
            player.x = player.startX;
            player.y = player.startY;
            player.respawnedAt = Date.now();
        }
    }

    // Goal reached - show win overlay and pause, advance after player clicks overlay Play again
    if (
        player.x + player.radius > goal.x &&
        player.x - player.radius < goal.x + goal.width &&
        player.y + player.radius > goal.y &&
        player.y - player.radius < goal.y + goal.height
    ) {
        // Prepare next level index
        nextLevelIndex = currentLevel + 1;
        if (nextLevelIndex >= levels.length) nextLevelIndex = 0;
        // Show overlay
        if (winOverlay) winOverlay.style.display = 'flex';
        // play victory sound
        if (!victoryPlayed && soundEnabled && victorySound && typeof victorySound.play === 'function') {
            try {
                victorySound.currentTime = 0;
                victorySound.play().catch(() => {});
            } catch (e) {
                // ignore
            }
        }
        victoryPlayed = true;
        gamePaused = true;
    }
}

// Reset to a level (deep copy enemy definitions) and reset player position
function resetLevel(levelIndex) {
    currentLevel = levelIndex;
    enemies = JSON.parse(JSON.stringify(levels[currentLevel]));
    player.x = player.startX;
    player.y = player.startY;
    // show respawn flash when resetting level
    player.respawnedAt = Date.now();
    // allow victory sound to play again on this new level
    victoryPlayed = false;
}

// Player movement
document.addEventListener('keydown', (e) => {
    // Ignore movement input while game is paused
    if (gamePaused) return;

    const now = Date.now();
    const invincible = player.respawnedAt && now - player.respawnedAt < player.respawnFlashDuration;

    // Default bounds are the canvas edges
    let minX = player.radius;
    let maxX = canvas.width - player.radius;
    let minY = player.radius;
    let maxY = canvas.height - player.radius;
    if (invincible) {
        // Restrict movement to spawn area when immune
        minX = player.startX - spawnAreaSize / 2 + player.radius;
        maxX = player.startX + spawnAreaSize / 2 - player.radius;
        minY = player.startY - spawnAreaSize / 2 + player.radius;
        maxY = player.startY + spawnAreaSize / 2 - player.radius;
    }

    switch (e.key) {
        case 'ArrowLeft': player.x = Math.max(minX, player.x - player.speed); break;
        case 'ArrowRight': player.x = Math.min(maxX, player.x + player.speed); break;
        case 'ArrowUp': player.y = Math.max(minY, player.y - player.speed); break;
        case 'ArrowDown': player.y = Math.min(maxY, player.y + player.speed); break;
    }
});

// Animation loop
function animate() {
    // Always draw the current frame so canvas stays visible while paused
    draw();
    if (!gamePaused) {
        updateEnemies();
        checkCollisions();
    }
    requestAnimationFrame(animate);
}

// Ensure flag image loads first
goalImage.onload = animate;

// Wire up HUD Reset deaths button
if (playAgainButton) {
    playAgainButton.addEventListener('click', () => {
        deathCount = 0;
        updateHUD();
    });
}

// Wire up Start Game button: toggle pause/unpause and update label
if (startButton) {
    startButton.addEventListener('click', () => {
        if (gamePaused) {
                // unpause: hide overlay and resume
                if (winOverlay) winOverlay.style.display = 'none';
                // If this is the first time starting the game, trigger initial respawn flash + immunity
                if (!started) {
                    player.respawnedAt = Date.now();
                    started = true;
                }
                gamePaused = false;
                startButton.innerText = 'Pause';
            } else {
            // pause the game
            gamePaused = true;
            startButton.innerText = 'Resume';
        }
        updateHUD();
    });
}

// Wire up overlay Play again button (advance to next level, keep death count)
if (overlayPlayAgain) {
    overlayPlayAgain.addEventListener('click', () => {
        if (winOverlay) winOverlay.style.display = 'none';
        const target = (nextLevelIndex !== null) ? nextLevelIndex : ((currentLevel + 1) % levels.length);
        resetLevel(target);
        gamePaused = false;
        if (startButton) startButton.innerText = 'Pause';
        victoryPlayed = false;
        updateHUD();
    });
}

// Wire up sound toggle button
if (soundToggleButton) {
    soundToggleButton.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundToggleButton.innerText = soundEnabled ? 'Sound: On' : 'Sound: Off';
    });
}