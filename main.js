const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreVal = document.getElementById('score-val');
const highScoreVal = document.getElementById('high-score-val');
const startScreen = document.getElementById('start-screen');
const deathScreen = document.getElementById('death-screen');
const finalScore = document.getElementById('final-score');

let width, height, lastTime;
let gameState = 'START';
let score = 0;
let highScore = localStorage.getItem('neon_high_score') || 0;
highScoreVal.textContent = highScore;

const CONFIG = {
    gravity: 0.8,
    jumpForce: -16,
    speed: 7,
    maxSpeed: 15,
    acceleration: 0.0005,
    coyoteTime: 100,
    jumpBuffer: 100,
    playerSize: 40,
    groundHeight: 100
};

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.02;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

class Player {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = 100;
        this.y = height - CONFIG.groundHeight - CONFIG.playerSize;
        this.vy = 0;
        this.isGrounded = true;
        this.canDoubleJump = true;
        this.lastGroundedTime = 0;
        this.lastJumpRequestTime = 0;
        this.particles = [];
        this.shake = 0;
    }
    jump() {
        const now = Date.now();
        const canCoyote = now - this.lastGroundedTime < CONFIG.coyoteTime;
        
        if (this.isGrounded || canCoyote) {
            this.vy = CONFIG.jumpForce;
            this.isGrounded = false;
            this.createJumpParticles();
        } else if (this.canDoubleJump) {
            this.vy = CONFIG.jumpForce * 0.8;
            this.canDoubleJump = false;
            this.createJumpParticles('#ff00ff');
        } else {
            this.lastJumpRequestTime = now;
        }
    }
    createJumpParticles(color = '#00ffff') {
        for(let i=0; i<10; i++) this.particles.push(new Particle(this.x + CONFIG.playerSize/2, this.y + CONFIG.playerSize, color));
    }
    update() {
        this.vy += CONFIG.gravity;
        this.y += this.vy;

        const groundY = height - CONFIG.groundHeight - CONFIG.playerSize;
        if (this.y > groundY) {
            this.y = groundY;
            this.vy = 0;
            if (!this.isGrounded) {
                this.isGrounded = true;
                this.canDoubleJump = true;
                this.lastGroundedTime = Date.now();
                if (Date.now() - this.lastJumpRequestTime < CONFIG.jumpBuffer) this.jump();
            }
        } else {
            this.isGrounded = false;
        }

        if (Math.random() > 0.5) {
            this.particles.push(new Particle(this.x, this.y + CONFIG.playerSize/2, '#00ffff'));
        }
        this.particles.forEach((p, i) => {
            p.update();
            if (p.life <= 0) this.particles.splice(i, 1);
        });

        if (this.shake > 0) this.shake *= 0.9;
    }
    draw() {
        this.particles.forEach(p => p.draw());
        
        ctx.save();
        if (this.shake > 1) {
            ctx.translate((Math.random()-0.5)*this.shake, (Math.random()-0.5)*this.shake);
        }
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ffff';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x, this.y, CONFIG.playerSize, CONFIG.playerSize);
        
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.fillRect(this.x, this.y, CONFIG.playerSize, CONFIG.playerSize);
        ctx.restore();
    }
}

class Obstacle {
    constructor(x, type) {
        this.x = x;
        this.type = type; // 0: Ground, 1: Air
        this.width = 30 + Math.random() * 40;
        this.height = 40 + Math.random() * 60;
        this.y = type === 0 ? height - CONFIG.groundHeight - this.height : height - CONFIG.groundHeight - 120 - Math.random() * 100;
        this.color = '#ff00ff';
    }
    update(speed) {
        this.x -= speed;
    }
    draw() {
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = 'rgba(255, 0, 255, 0.1)';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Bonus {
    constructor(x) {
        this.x = x;
        this.y = height - CONFIG.groundHeight - 150 - Math.random() * 100;
        this.size = 20;
        this.collected = false;
        this.angle = 0;
    }
    update(speed) {
        this.x -= speed;
        this.angle += 0.1;
    }
    draw() {
        if (this.collected) return;
        ctx.save();
        ctx.translate(this.x + this.size/2, this.y + this.size/2);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffd700';
        ctx.strokeStyle = '#ffd700';
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.restore();
    }
}

let player, obstacles, bonuses, currentSpeed;

function init() {
    resize();
    player = new Player();
    obstacles = [];
    bonuses = [];
    currentSpeed = CONFIG.speed;
    score = 0;
    scoreVal.textContent = '0';
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

window.addEventListener('resize', resize);

function spawnManager() {
    if (obstacles.length === 0 || width - obstacles[obstacles.length-1].x > 400 + Math.random() * 300) {
        obstacles.push(new Obstacle(width + 100, Math.random() > 0.7 ? 1 : 0));
    }
    if (Math.random() < 0.005) {
        bonuses.push(new Bonus(width + 100));
    }
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function gameOver() {
    gameState = 'DEAD';
    deathScreen.classList.remove('hidden');
    finalScore.textContent = `SCORE: ${Math.floor(score)}`;
    if (score > highScore) {
        highScore = Math.floor(score);
        localStorage.setItem('neon_high_score', highScore);
        highScoreVal.textContent = highScore;
    }
}

function update(dt) {
    if (gameState !== 'PLAYING') return;

    currentSpeed = Math.min(CONFIG.maxSpeed, currentSpeed + CONFIG.acceleration * dt);
    score += currentSpeed * 0.01;
    scoreVal.textContent = Math.floor(score);

    player.update();
    spawnManager();

    obstacles.forEach((obs, i) => {
        obs.update(currentSpeed);
        if (checkCollision({x: player.x, y: player.y, width: CONFIG.playerSize, height: CONFIG.playerSize}, obs)) {
            player.shake = 20;
            gameOver();
        }
        if (obs.x + obs.width < 0) obstacles.splice(i, 1);
    });

    bonuses.forEach((b, i) => {
        b.update(currentSpeed);
        if (!b.collected && checkCollision({x: player.x, y: player.y, width: CONFIG.playerSize, height: CONFIG.playerSize}, {x: b.x, y: b.y, width: b.size, height: b.size})) {
            b.collected = true;
            score += 500;
            player.createJumpParticles('#ffd700');
        }
        if (b.x + b.size < 0) bonuses.splice(i, 1);
    });
}

function draw() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    // Ground
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ffff';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height - CONFIG.groundHeight);
    ctx.lineTo(width, height - CONFIG.groundHeight);
    ctx.stroke();

    // Grid effect
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<width; i+=50) {
        ctx.beginPath();
        ctx.moveTo(i - (score % 50), height - CONFIG.groundHeight);
        ctx.lineTo(i - (score % 50) - 200, height);
        ctx.stroke();
    }

    obstacles.forEach(obs => obs.draw());
    bonuses.forEach(b => b.draw());
    player.draw();
}

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    update(dt);
    draw();
    requestAnimationFrame(loop);
}

function handleInput() {
    if (gameState === 'START') {
        gameState = 'PLAYING';
        startScreen.classList.add('hidden');
        init();
    } else if (gameState === 'PLAYING') {
        player.jump();
    } else if (gameState === 'DEAD') {
        gameState = 'PLAYING';
        deathScreen.classList.add('hidden');
        init();
    }
}

window.addEventListener('keydown', e => { if (e.code === 'Space') handleInput(); });
window.addEventListener('touchstart', e => { e.preventDefault(); handleInput(); }, {passive: false});
window.addEventListener('mousedown', handleInput);

init();
requestAnimationFrame(loop);
