const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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

// Enemy properties
const enemySize = 40;
const revealRadius = 100;
const revealTime = 3000;

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
let enemies = levels[currentLevel];

// Goal (flag image)
const goalImage = new Image();
goalImage.src = 'assets/flag.png';
const goal = { x: canvas.width - 70, y: 20, width: 50, height: 50 };

// Draw everything
function draw() {
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Player
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.closePath();

    // Enemies
    const now = Date.now();
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
    for (let enemy of enemies) {
        if (
            player.x + player.radius > enemy.x &&
            player.x - player.radius < enemy.x + enemySize &&
            player.y + player.radius > enemy.y &&
            player.y - player.radius < enemy.y + enemySize
        ) {
            player.x = player.startX;
            player.y = player.startY;
        }
    }

    // Goal reached
    if (
        player.x + player.radius > goal.x &&
        player.x - player.radius < goal.x + goal.width &&
        player.y + player.radius > goal.y &&
        player.y - player.radius < goal.y + goal.height
    ) {
        alert(`Level ${currentLevel + 1} Complete!`);
        currentLevel++;
        if (currentLevel >= levels.length) currentLevel = 0;
        enemies = levels[currentLevel];
        player.x = player.startX;
        player.y = player.startY;
    }
}

// Player movement
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowLeft': player.x = Math.max(player.radius, player.x - player.speed); break;
        case 'ArrowRight': player.x = Math.min(canvas.width - player.radius, player.x + player.speed); break;
        case 'ArrowUp': player.y = Math.max(player.radius, player.y - player.speed); break;
        case 'ArrowDown': player.y = Math.min(canvas.height - player.radius, player.y + player.speed); break;
    }
});

// Animation loop
function animate() {
    updateEnemies();
    draw();
    checkCollisions();
    requestAnimationFrame(animate);
}

// Ensure flag image loads first
goalImage.onload = animate;