const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// HUD & controls
let deathCount = 0;
const deathCounterElement = document.getElementById('deathCount');
const playAgainButton = document.getElementById('playAgainButton');
const resetLevelButton = document.getElementById('resetLevelButton');
const winOverlay = document.getElementById('winOverlay');
const overlayPlayAgain = document.getElementById('overlayPlayAgain');
const startButton = document.getElementById('startButton');
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeButton = document.getElementById('resumeButton');
const recalibButton = document.getElementById('recalibButton');
// Start paused; pressing Start Game will unpause and trigger initial flash
let gamePaused = true;
let started = false;
let nextLevelIndex = null;
let walls = [];

// Audio
const deathSound = new Audio('./assets/death.mp3');
deathSound.preload = 'auto';
deathSound.volume = 0.6;

// audio controls
let soundEnabled = true;
const victorySound = new Audio('./assets/victory.mp3');
victorySound.preload = 'auto';
victorySound.volume = 0.4;
const soundToggleButton = document.getElementById('soundToggleButton');
let victoryPlayed = false;
const toastElement = document.getElementById('toast');
let toastTimeout = null;

// Microphone / Sound Wave settings
let audioContext = null;
let analyser = null;
let microphone = null;
let micEnabled = false;
let volumeThreshold = 80; // Adjust this based on testing (0-100 scale) - raised to avoid triggering on breaths

// Sound wave animation state
let soundWaveActive = false;
let soundWaveStartTime = 0;
let soundWaveDuration = 1500; // 1.5 second animation (slower expansion)
let soundWaveCooldown = 1500; // 1.5 second cooldown
let soundWaveLastUsed = 0;
let soundWaveMaxRadius = 200; // Maximum radius of the sound wave (smaller area)

function showToast(message, duration = 2000) {
    if (!toastElement) return;
    toastElement.innerText = message;
    toastElement.style.display = 'block';
    // debounce animation
    toastElement.classList.remove('show');
    // force reflow
    void toastElement.offsetWidth;
    toastElement.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastElement.classList.remove('show');
        // keep for animation duration then hide
        setTimeout(() => {
            if (toastElement) toastElement.style.display = 'none';
        }, 200);
    }, duration);
}

// Initialize microphone access
async function initMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        microphone.connect(analyser);

        micEnabled = true;
        showToast('Microphone enabled! Speak to reveal enemies', 2000);

        // Start monitoring volume
        monitorVolume();
    } catch (error) {
        console.error('Microphone access denied:', error);
        showToast('Microphone access denied. Please allow microphone access.', 3000);
        micEnabled = false;
    }
}

// Monitor microphone volume and trigger sound wave
function monitorVolume() {
    if (!micEnabled || !analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function checkVolume() {
        if (!micEnabled) return;

        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Trigger sound wave if volume exceeds threshold and cooldown has passed
        const now = Date.now();
        if (average > volumeThreshold && !soundWaveActive &&
            now - soundWaveLastUsed > soundWaveDuration + soundWaveCooldown) {
            triggerSoundWave();
        }

        requestAnimationFrame(checkVolume);
    }

    // Walls (obstacles) - reveal them same as enemies using revealRadius / sound wave
    walls.forEach(wall => {
        // find nearest point distance from player to rectangle
        const closestX = Math.max(wall.x, Math.min(player.x, wall.x + wall.width));
        const closestY = Math.max(wall.y, Math.min(player.y, wall.y + wall.height));
        const dx = player.x - closestX;
        const dy = player.y - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= revealRadius || (soundWaveActive && dist <= soundWaveRadius)) {
            wall.visible = true;
            wall.lastRevealed = now;
        }

        if (wall.visible && now - wall.lastRevealed <= revealTime) {
            ctx.fillStyle = 'rgba(200,200,200,0.95)';
            ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
            ctx.strokeStyle = 'rgba(150,150,150,1)';
            ctx.lineWidth = 2;
            ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
        }
    });

    checkVolume();
}

// Trigger the sound wave animation
function triggerSoundWave() {
    if (!started || gamePaused) return;

    soundWaveActive = true;
    soundWaveStartTime = Date.now();
    soundWaveLastUsed = soundWaveStartTime;
}

// Recalibrate microphone (adjust threshold)
function recalibrateMicrophone() {
    if (!micEnabled) {
        initMicrophone();
        return;
    }

    showToast('Recalibrating... Speak at normal volume', 2000);

    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const samples = [];

    // Collect volume samples for 2 seconds
    const sampleInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        samples.push(sum / dataArray.length);
    }, 100);

    setTimeout(() => {
        clearInterval(sampleInterval);
        if (samples.length > 0) {
            const avgVolume = samples.reduce((a, b) => a + b) / samples.length;
            const calculatedThreshold = avgVolume * 1.5; // Set threshold to 1.5x average
            const minThreshold = 45; // Minimum threshold to prevent too-sensitive calibration

            // Use the higher of calculated threshold or minimum threshold
            volumeThreshold = Math.max(calculatedThreshold, minThreshold);

            if (calculatedThreshold < minThreshold) {
                showToast(`Too quiet! Using minimum threshold ${minThreshold}`, 2500);
            } else {
                showToast(`Calibrated! Threshold set to ${volumeThreshold.toFixed(1)}`, 2000);
            }
        }
    }, 2000);
}

// Helper to set paused state and show/hide pause overlay (don't show pause overlay if win overlay is visible)
function setPaused(paused) {
    gamePaused = paused;
    if (paused) {
        if (winOverlay && winOverlay.style.display === 'flex') {
            if (pauseOverlay) pauseOverlay.style.display = 'none';
        } else {
            // Only show pause overlay when the game has actually started
            if (started) {
                if (pauseOverlay) pauseOverlay.style.display = 'flex';
            } else {
                if (pauseOverlay) pauseOverlay.style.display = 'none';
            }
        }
    } else {
        if (pauseOverlay) pauseOverlay.style.display = 'none';
    }
}

function updateHUD() {
    if (deathCounterElement) deathCounterElement.innerText = deathCount;
}

// Helper: circle-rect collision (player circle vs wall rect)
function circleRectCollision(cx, cy, r, rect) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= (r * r);
}

// Helper: test whether a proposed player center (x,y) would collide any wall
function wouldCollideWithWalls(x, y, radius) {
    for (let w of walls) {
        if (circleRectCollision(x, y, radius, w)) return true;
    }
    return false;
}

// initialize HUD display
updateHUD();

// Initialize sound toggle label
if (soundToggleButton) soundToggleButton.innerText = soundEnabled ? 'Sound: On' : 'Sound: Off';

// Ensure initial pause overlay if starting paused
setPaused(gamePaused);


// Player
const player = {
    x: 50,
    y: canvas.height - 50,
    radius: 25,
    color: '#ffcc00',
    speed: 1.75,
    startX: 50,
    startY: canvas.height - 50
};

// Track which keys are currently pressed
const keys = {
    left: false,
    right: false,
    up: false,
    down: false
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
    // Level 1 - horizontal lanes with a blocking wall
    {
        enemies: [
            { x: 50, y: 100, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 200, y: 100, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 350, y: 100, vx: 1, vy: 0, visible: false, lastRevealed: 0 },

            { x: 50, y: 200, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 200, y: 200, vx: 1, vy: 0, visible: false, lastRevealed: 0 }
        ],
        walls: [
            { x: 120, y: 140, width: 560, height: 12, visible: false, lastRevealed: 0 },
            { x: 380, y: 60, width: 12, height: 80, visible: false, lastRevealed: 0 }
        ]
    },

    // Level 2 - vertical lanes with a vertical wall
    {
        enemies: [
            { x: 150, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 150, y: 150, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 150, y: 250, vx: 0, vy: 1, visible: false, lastRevealed: 0 },

            { x: 300, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 300, y: 150, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 300, y: 250, vx: 0, vy: 1, visible: false, lastRevealed: 0 }
        ],
        walls: [
            { x: 240, y: 20, width: 12, height: 300, visible: false, lastRevealed: 0 }
        ]
    },

    // Level 3 - central barrier with two pillars
    {
        enemies: [
            { x: 50, y: 120, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 200, y: 120, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 400, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 400, y: 200, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 600, y: 150, vx: 0, vy: 1, visible: false, lastRevealed: 0 }
        ],
        walls: [
            { x: 180, y: 140, width: 440, height: 12, visible: false, lastRevealed: 0 },
            { x: 340, y: 40, width: 12, height: 40, visible: false, lastRevealed: 0 },
            { x: 460, y: 140, width: 12, height: 40, visible: false, lastRevealed: 0 }
        ]
    },

    // Level 4 - staggered small pillars forming corridors
    {
        enemies: [
            { x: 50, y: 80, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 180, y: 80, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 310, y: 80, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 440, y: 150, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 570, y: 150, vx: 1, vy: 0, visible: false, lastRevealed: 0 }
        ],
        walls: [
            { x: 140, y: 30, width: 16, height: 60, visible: false, lastRevealed: 0 },
            { x: 260, y: 100, width: 16, height: 60, visible: false, lastRevealed: 0 },
            { x: 380, y: 30, width: 16, height: 60, visible: false, lastRevealed: 0 }
        ]
    },

    // Level 5 - vertical lanes with alternating horizontal blockers
    {
        enemies: [
            { x: 120, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 120, y: 150, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 120, y: 250, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 300, y: 100, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 300, y: 200, vx: 0, vy: 1, visible: false, lastRevealed: 0 }
        ],
        walls: [
            { x: 60, y: 110, width: 120, height: 10, visible: false, lastRevealed: 0 },
            { x: 260, y: 170, width: 120, height: 10, visible: false, lastRevealed: 0 }
        ]
    },

    // Level 6 - diagonal flowing enemies with staircase walls
    {
        enemies: [
            { x: 50, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
            { x: 150, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
            { x: 250, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
            { x: 400, y: 100, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
            { x: 500, y: 100, vx: 1, vy: 1, visible: false, lastRevealed: 0 }
        ],
        walls: [
            { x: 120, y: 80, width: 12, height: 60, visible: false, lastRevealed: 0 },
            { x: 200, y: 140, width: 12, height: 60, visible: false, lastRevealed: 0 },
            { x: 280, y: 80, width: 12, height: 60, visible: false, lastRevealed: 0 }
        ]
    },

    // Level 7 - U-shaped wall guarding the goal side
    {
        enemies: [
            { x: 50, y: 100, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 200, y: 100, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 400, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 400, y: 150, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 600, y: 100, vx: 0, vy: 1, visible: false, lastRevealed: 0 }
        ],
        walls: [
            { x: 480, y: 20, width: 12, height: 180, visible: false, lastRevealed: 0 },
            { x: 360, y: 20, width: 12, height: 180, visible: false, lastRevealed: 0 },
            { x: 360, y: 20, width: 132, height: 12, visible: false, lastRevealed: 0 }
        ]
    },

    // Level 8 - center maze corridor
    {
        enemies: [
            { x: 50, y: 60, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 150, y: 60, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 250, y: 60, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 350, y: 120, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 450, y: 120, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 550, y: 120, vx: 1, vy: 0, visible: false, lastRevealed: 0 }
        ],
        walls: [
            { x: 260, y: 20, width: 12, height: 160, visible: false, lastRevealed: 0 },
            { x: 340, y: 60, width: 12, height: 160, visible: false, lastRevealed: 0 },
            { x: 300, y: 100, width: 80, height: 12, visible: false, lastRevealed: 0 }
        ]
    },

    // Level 9 - tighter vertical with narrow passages
    {
        enemies: [
            { x: 100, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 100, y: 120, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 100, y: 190, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 200, y: 50, vx: 0, vy: 1, visible: false, lastRevealed: 0 },
            { x: 200, y: 120, vx: 0, vy: 1, visible: false, lastRevealed: 0 }
        ],
        walls: [
            { x: 140, y: 0, width: 12, height: 220, visible: false, lastRevealed: 0 },
            { x: 260, y: 80, width: 12, height: 220, visible: false, lastRevealed: 0 }
        ]
    },

    // Level 10 - mixed with boxed center
    {
        enemies: [
            { x: 50, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
            { x: 150, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
            { x: 250, y: 50, vx: 1, vy: 1, visible: false, lastRevealed: 0 },
            { x: 400, y: 150, vx: 1, vy: 0, visible: false, lastRevealed: 0 },
            { x: 500, y: 150, vx: 1, vy: 0, visible: false, lastRevealed: 0 }
        ],
        walls: [
            { x: 300, y: 40, width: 12, height: 140, visible: false, lastRevealed: 0 },
            { x: 380, y: 40, width: 12, height: 140, visible: false, lastRevealed: 0 },
            { x: 300, y: 40, width: 92, height: 12, visible: false, lastRevealed: 0 },
            { x: 300, y: 172, width: 92, height: 12, visible: false, lastRevealed: 0 }
        ]
    }
];


// Random starting level
let currentLevel = Math.floor(Math.random() * levels.length);
// Initialize enemies and walls for the selected level
let enemies = [];
walls = [];
resetLevel(currentLevel);

// Goal (flag image)
const goalImage = new Image();
goalImage.src = 'assets/flag.png';
const goal = { x: canvas.width - 70, y: 20, width: 50, height: 50 };

// Enemy sprites (saw blades) - oscillate between two frames for animation
const enemySprite1 = new Image();
const enemySprite2 = new Image();
// For now, we'll use placeholder paths - you'll replace these with your actual saw sprites
enemySprite1.src = 'assets/saw1.png';
enemySprite2.src = 'assets/saw2.png';

// Animation settings for enemy sprite oscillation
const enemySpriteAnimationSpeed = 150; // ms per frame (faster = more spinning effect)
let enemySpriteFrame = 0; // Track which frame to show (0 or 1)

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

    // Draw ability cooldown indicator (purple filling circle)
    const timeSinceLastWave = now - soundWaveLastUsed;
    const totalCooldownTime = soundWaveDuration + soundWaveCooldown;
    if (soundWaveLastUsed > 0 && timeSinceLastWave < totalCooldownTime) {
        // Calculate cooldown progress (0 to 1)
        const cooldownProgress = timeSinceLastWave / totalCooldownTime;

        // Draw expanding purple circle from center
        ctx.save();
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius * cooldownProgress, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(147, 51, 234, 0.5)'; // Purple with 50% transparency
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    }

    // Check if sound wave is active and calculate its radius
    let soundWaveRadius = 0;
    if (soundWaveActive) {
        const elapsed = now - soundWaveStartTime;
        if (elapsed < soundWaveDuration) {
            // Sound wave is expanding
            soundWaveRadius = (elapsed / soundWaveDuration) * soundWaveMaxRadius;
        } else {
            // Sound wave animation complete
            soundWaveActive = false;
            soundWaveRadius = 0;
        }
    }

    // Draw sound wave if active
    if (soundWaveActive && soundWaveRadius > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(player.x, player.y, soundWaveRadius, 0, Math.PI * 2);
        // Create gradient effect for the wave
        const gradient = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, soundWaveRadius);
        gradient.addColorStop(0, 'rgba(0, 200, 255, 0)');
        gradient.addColorStop(0.7, 'rgba(0, 200, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 200, 255, 0.6)');
        ctx.fillStyle = gradient;
        ctx.fill();
        // Draw outer ring
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
    }

    // Enemies
    const invincible = player.respawnedAt && now - player.respawnedAt < player.respawnFlashDuration;

    // Update animation frame for sprite oscillation
    const spritePhase = Math.floor(now / enemySpriteAnimationSpeed) % 2;
    const currentEnemySprite = spritePhase === 0 ? enemySprite1 : enemySprite2;

    enemies.forEach(enemy => {
        const dx = player.x - (enemy.x + enemySize / 2);
        const dy = player.y - (enemy.y + enemySize / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Reveal enemy ONLY if within sound wave
        if (soundWaveActive && dist <= soundWaveRadius) {
            enemy.visible = true;
            enemy.lastRevealed = now;
        }

        // Draw enemy if visible within reveal time OR if player is invincible
        if ((enemy.visible && now - enemy.lastRevealed <= revealTime) || invincible) {
            // Try to draw sprite, fallback to red rectangle if sprites not loaded
            if (currentEnemySprite.complete && currentEnemySprite.naturalWidth > 0) {
                ctx.drawImage(currentEnemySprite, enemy.x, enemy.y, enemySize, enemySize);
            } else {
                // Fallback: draw red rectangle if sprites aren't loaded yet
                ctx.fillStyle = 'red';
                ctx.fillRect(enemy.x, enemy.y, enemySize, enemySize);
            }
        }
    });

    // Walls (obstacles) - reveal them ONLY with sound wave
    walls.forEach(wall => {
        // Find nearest point distance from player to rectangle
        const closestX = Math.max(wall.x, Math.min(player.x, wall.x + wall.width));
        const closestY = Math.max(wall.y, Math.min(player.y, wall.y + wall.height));
        const dx = player.x - closestX;
        const dy = player.y - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Reveal wall ONLY if within sound wave
        if (soundWaveActive && dist <= soundWaveRadius) {
            wall.visible = true;
            wall.lastRevealed = now;
        }

        // Draw wall if visible within reveal time OR if player is invincible
        if ((wall.visible && now - wall.lastRevealed <= revealTime) || invincible) {
            ctx.fillStyle = 'rgba(240, 240, 240, 0.95)';
            ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
            ctx.strokeStyle = 'rgba(200, 200, 200, 1)';
            ctx.lineWidth = 2;
            ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
        }
    });

    // Draw goal image
    ctx.drawImage(goalImage, goal.x, goal.y, goal.width, goal.height);
}

// Update enemy positions
function updateEnemies() {
    // Define spawn area boundaries
    const spawnLeft = player.startX - spawnAreaSize / 2;
    const spawnRight = player.startX + spawnAreaSize / 2;
    const spawnTop = player.startY - spawnAreaSize / 2;
    const spawnBottom = player.startY + spawnAreaSize / 2;

    enemies.forEach(enemy => {
        // Store old position for collision resolution
        const oldX = enemy.x;
        const oldY = enemy.y;

        // Move enemy
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;

        // Check canvas boundary collisions
        if (enemy.x < 0 || enemy.x + enemySize > canvas.width) {
            enemy.vx *= -1;
            enemy.x = oldX; // Reset to old position to prevent getting stuck
        }
        if (enemy.y < 0 || enemy.y + enemySize > canvas.height) {
            enemy.vy *= -1;
            enemy.y = oldY; // Reset to old position to prevent getting stuck
        }

        // Check wall collisions for enemies (AABB collision)
        for (let w of walls) {
            const enemyLeft = enemy.x;
            const enemyRight = enemy.x + enemySize;
            const enemyTop = enemy.y;
            const enemyBottom = enemy.y + enemySize;
            const wallLeft = w.x;
            const wallRight = w.x + w.width;
            const wallTop = w.y;
            const wallBottom = w.y + w.height;
            if (!(enemyRight < wallLeft || enemyLeft > wallRight || enemyBottom < wallTop || enemyTop > wallBottom)) {
                // collision: reverse direction and revert
                enemy.vx *= -1;
                enemy.vy *= -1;
                enemy.x = oldX;
                enemy.y = oldY;
                break;
            }
        }

        // Check spawn area collision (AABB collision detection)
        const enemyLeft = enemy.x;
        const enemyRight = enemy.x + enemySize;
        const enemyTop = enemy.y;
        const enemyBottom = enemy.y + enemySize;

        // Check if enemy overlaps with spawn area
        if (enemyRight > spawnLeft && enemyLeft < spawnRight &&
            enemyBottom > spawnTop && enemyTop < spawnBottom) {

            // Calculate overlap on each side
            const overlapLeft = enemyRight - spawnLeft;
            const overlapRight = spawnRight - enemyLeft;
            const overlapTop = enemyBottom - spawnTop;
            const overlapBottom = spawnBottom - enemyTop;

            // Find the minimum overlap (which side is closest)
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

            // Push enemy out on the side with minimum overlap and reverse velocity
            if (minOverlap === overlapLeft) {
                // Enemy hit from left side of spawn area
                enemy.x = spawnLeft - enemySize;
                enemy.vx = -Math.abs(enemy.vx); // Move left
            } else if (minOverlap === overlapRight) {
                // Enemy hit from right side of spawn area
                enemy.x = spawnRight;
                enemy.vx = Math.abs(enemy.vx); // Move right
            } else if (minOverlap === overlapTop) {
                // Enemy hit from top side of spawn area
                enemy.y = spawnTop - enemySize;
                enemy.vy = -Math.abs(enemy.vy); // Move up
            } else {
                // Enemy hit from bottom side of spawn area
                enemy.y = spawnBottom;
                enemy.vy = Math.abs(enemy.vy); // Move down
            }
        }
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
        setPaused(true);
    }
}

// Reset to a level (deep copy enemy definitions) and reset player position
function resetLevel(levelIndex) {
    currentLevel = levelIndex;
    // Support legacy array-based levels or object-based with enemies/walls
    const lvl = levels[currentLevel];
    if (Array.isArray(lvl)) {
        enemies = JSON.parse(JSON.stringify(lvl));
        walls = [];
    } else {
        enemies = JSON.parse(JSON.stringify(lvl.enemies || []));
        walls = JSON.parse(JSON.stringify(lvl.walls || []));
        // initialize visibility metadata for walls
        walls.forEach(w => { w.visible = w.visible || false; w.lastRevealed = w.lastRevealed || 0; });
    }
    player.x = player.startX;
    player.y = player.startY;
    // allow victory sound to play again on this new level
    victoryPlayed = false;
}

// Keyboard input handlers
document.addEventListener('keydown', (e) => {
    // Allow Escape to toggle pause/unpause only if the game has started
    if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        // If the game hasn't been started by the Start button yet, ignore Escape
        if (!started) return;

        if (gamePaused) {
            // Unpause
            if (winOverlay) winOverlay.style.display = 'none';
            setPaused(false);
            if (startButton) startButton.innerText = 'Pause';
        } else {
            // Pause
            setPaused(true);
            if (startButton) startButton.innerText = 'Resume';
        }
        updateHUD();
        return;
    }

    // If win overlay is shown, allow Enter/Space to trigger Play again
    if (winOverlay && winOverlay.style.display === 'flex') {
        if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar') {
            e.preventDefault();
            if (overlayPlayAgain) overlayPlayAgain.click();
        }
        return;
    }
    // If the game isn't started yet, allow Enter/Space to start it
    if (!started && (e.key === 'Enter' || e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar')) {
        e.preventDefault();
        player.respawnedAt = Date.now();
        started = true;
        setPaused(false);
        if (startButton) startButton.innerText = 'Pause';
        updateHUD();
        return;
    }

    // Track movement keys
    switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
            e.preventDefault();
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            e.preventDefault();
            keys.right = true;
            break;
        case 'ArrowUp':
        case 'w':
        case 'W':
            e.preventDefault();
            keys.up = true;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            e.preventDefault();
            keys.down = true;
            break;
    }
});

document.addEventListener('keyup', (e) => {
    // Release movement keys
    switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            keys.right = false;
            break;
        case 'ArrowUp':
        case 'w':
        case 'W':
            keys.up = false;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            keys.down = false;
            break;
    }
});

// Update player position based on held keys
function updatePlayerMovement() {
    if (gamePaused || !started) return;

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

    // Apply movement based on held keys
    if (keys.left) {
        const newX = Math.max(minX, player.x - player.speed);
        if (!wouldCollideWithWalls(newX, player.y, player.radius)) player.x = newX;
    }
    if (keys.right) {
        const newX = Math.min(maxX, player.x + player.speed);
        if (!wouldCollideWithWalls(newX, player.y, player.radius)) player.x = newX;
    }
    if (keys.up) {
        const newY = Math.max(minY, player.y - player.speed);
        if (!wouldCollideWithWalls(player.x, newY, player.radius)) player.y = newY;
    }
    if (keys.down) {
        const newY = Math.min(maxY, player.y + player.speed);
        if (!wouldCollideWithWalls(player.x, newY, player.radius)) player.y = newY;
    }
}

// Animation loop
function animate() {
    // Always draw the current frame so canvas stays visible while paused
    draw();
    if (!gamePaused) {
        updatePlayerMovement();
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
        if (!started || gamePaused) {
                // unpause: hide overlay and resume
                if (winOverlay) winOverlay.style.display = 'none';
                // If this is the first time starting the game, trigger initial respawn flash + immunity
                if (!started) {
                    player.respawnedAt = Date.now();
                    started = true;
                }
                setPaused(false);
                startButton.innerText = 'Pause';
            } else {
            // pause the game
            setPaused(true);
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
        // Start the level: mark as started and show respawn flash
        started = true;
        player.respawnedAt = Date.now();
        setPaused(false);
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

// Wire up HUD Reset level button
if (resetLevelButton) {
    resetLevelButton.addEventListener('click', () => {
        // Reset the current level only; do not reset death count
        if (winOverlay) winOverlay.style.display = 'none';
        resetLevel(currentLevel);
        // Ensure the game is paused and not in 'started' state
        // Make the game not started and ensure overlays are hidden
        started = false;
        setPaused(false);
        if (startButton) startButton.innerText = 'Start Game';
        // Cancel any respawn flash set earlier
        player.respawnedAt = 0;
        victoryPlayed = false;
        // Show brief toast message confirming the reset
        showToast('Level reset', 1500);
        updateHUD();
    });
}

// Wire up pause overlay resume button
if (resumeButton) {
    resumeButton.addEventListener('click', () => {
        if (!started) { player.respawnedAt = Date.now(); started = true; }
        setPaused(false);
        if (startButton) startButton.innerText = 'Pause';
        updateHUD();
    });
}

// Wire up recalibrate microphone button
if (recalibButton) {
    recalibButton.addEventListener('click', () => {
        recalibrateMicrophone();
    });
}

// Initialize microphone on page load
initMicrophone();