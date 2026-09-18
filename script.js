/**
 * Knife Hit – Blade Thrower
 * Canvas-based knife-throwing game with Web Audio API sound engine
 */

/* ─── Sound Engine ───────────────────────────────────────────────── */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.bgNode = null;
    this.bgGain = null;
    this.bgStep = 0;
    this.bgTimer = null;
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) this._stopBg();
    else this._startBg();
    return this.isMuted;
  }

  _tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + dur);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(now); osc.stop(now + dur);
    } catch (_) {}
  }

  // Knife throw: sharp metallic swish
  playThrow() {
    this.init();
    this._tone(1400, 0.12, 'sawtooth', 0.18, -900);
    setTimeout(() => this._tone(800, 0.06, 'square', 0.08), 60);
  }

  // Knife sticks: thunk + chime
  playStick(combo) {
    this.init();
    // Low thunk
    this._tone(110, 0.18, 'triangle', 0.3, -30);
    // Bright ping scaled by combo
    const semitones = [0, 3, 5, 7, 10, 12, 14, 17];
    const idx = Math.min(combo - 1, semitones.length - 1);
    const freq = 880 * Math.pow(2, semitones[idx] / 12);
    setTimeout(() => this._tone(freq, 0.22, 'sine', 0.18), 60);
  }

  // Knife-on-knife collision: harsh clash
  playClash() {
    this.init();
    this._tone(300, 0.08, 'sawtooth', 0.3, 100);
    this._tone(200, 0.12, 'square',   0.25, -80);
    setTimeout(() => this._tone(150, 0.25, 'triangle', 0.2, -60), 80);
  }

  // Level up: victorious chord burst
  playLevelUp() {
    this.init();
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.3, 'sine', 0.25), i * 75)
    );
  }

  // Game over: dramatic descend
  playGameOver() {
    this.init();
    [440, 370, 311, 246.94].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.45, 'triangle', 0.22, -30), i * 180)
    );
  }

  // Background: tense atmospheric pulse
  _startBg() {
    if (this.bgTimer || this.isMuted) return;
    const notes = [110, 130.81, 110, 98, 110, 123.47, 110, 103.83];
    this.bgTimer = setInterval(() => {
      if (!this.isMuted && this.ctx) {
        this._tone(notes[this.bgStep % notes.length], 0.28, 'sine', 0.035);
        this.bgStep++;
      }
    }, 380);
  }

  _stopBg() {
    clearInterval(this.bgTimer);
    this.bgTimer = null;
  }

  startBg() { this._startBg(); }
  stopBg()  { this._stopBg(); }
}

/* ─── Game ───────────────────────────────────────────────────────── */
(() => {
  /* DOM refs */
  const canvas    = document.getElementById('arena');
  const ctx       = canvas.getContext('2d');
  const scoreEl   = document.getElementById('score');
  const levelEl   = document.getElementById('level');
  const knivesEl  = document.getElementById('knivesLeft');
  const message   = document.getElementById('message');
  const msgTitle  = document.getElementById('msgTitle');
  const msgBody   = document.getElementById('msgBody');
  const throwBtn  = document.getElementById('throw');
  const againBtn  = document.getElementById('again');
  const audioBtn  = document.getElementById('audioBtn');
  const audioIcon = document.getElementById('audioIcon');

  /* Sound */
  const sound = new SoundEngine();

  /* Config */
  const KNIFE_PER_LEVEL = 5;   // knives to clear a log (increases per level)
  const LOG_RADIUS      = 70;  // base log radius (px, virtual)
  const KNIFE_W         = 6;
  const KNIFE_H         = 56;
  const KNIFE_HANDLE_H  = 18;
  const HIT_ANGLE_TOL   = 14;  // degrees – how close knives can be before clash

  /* State */
  let score, level, knivesLeft, stuckKnives, logAngle, logSpeed;
  let flying, flyY, flyDone, busy, playing;
  let raf, dpr, W, H, cx, cy, logY;
  let combo;
  let levelFlash = 0;
  let particles  = [];

  /* ── Resize canvas ─────────────────────────────────────────────── */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W   = rect.width;
    H   = rect.height;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx   = W / 2;
    logY = H * 0.35;
  }

  /* ── Reset / Init ──────────────────────────────────────────────── */
  function initLevel() {
    stuckKnives = [];
    logAngle    = 0;
    flying      = false;
    flyDone     = true;
    busy        = false;
    flyY        = H - 80;
    // Speed ramps per level; alternates direction
    const dir   = level % 2 === 0 ? -1 : 1;
    logSpeed    = dir * (0.9 + (level - 1) * 0.18);
    knivesLeft  = KNIFE_PER_LEVEL + Math.floor((level - 1) / 2);
    knivesEl.textContent = knivesLeft;
  }

  function reset() {
    score       = 0;
    level       = 1;
    combo       = 0;
    playing     = true;
    particles   = [];
    levelFlash  = 0;
    scoreEl.textContent  = '0';
    levelEl.textContent  = '1';
    message.classList.add('hidden');
    throwBtn.classList.remove('hidden');
    againBtn.classList.add('hidden');
    initLevel();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(gameLoop);
    sound.startBg();
  }

  /* ── Drawing ───────────────────────────────────────────────────── */
  function drawLog() {
    const r = logRadius();
    ctx.save();
    ctx.translate(cx, logY);
    ctx.rotate(logAngle * Math.PI / 180);

    // Wood grain rings
    for (let ring = r; ring > 10; ring -= 14) {
      ctx.beginPath();
      ctx.arc(0, 0, ring, 0, Math.PI * 2);
      ctx.strokeStyle = ring === r ? '#5C3D20' : `rgba(92,61,32,${0.3 - ring / (r * 5)})`;
      ctx.lineWidth   = ring === r ? 4 : 1.5;
      ctx.stroke();
    }

    // Base log fill
    const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
    grad.addColorStop(0,   '#C4885A');
    grad.addColorStop(0.55,'#8B5E3C');
    grad.addColorStop(1,   '#4A2C10');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Dark outline
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#3a1e08';
    ctx.lineWidth   = 3;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#3a1e08';
    ctx.fill();

    ctx.restore();
  }

  function drawStuckKnife(angleDeg) {
    const r    = logRadius();
    const rad  = angleDeg * Math.PI / 180;
    const tipX = cx + Math.cos(rad - Math.PI / 2) * r;
    const tipY = logY + Math.sin(rad - Math.PI / 2) * r;

    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(rad);
    _drawKnifePath(true);
    ctx.restore();
  }

  function drawFlyingKnife() {
    ctx.save();
    ctx.translate(cx, flyY);
    _drawKnifePath(false);
    ctx.restore();
  }

  function _drawKnifePath(stuck) {
    // Blade
    const bladeLen = KNIFE_H - KNIFE_HANDLE_H;
    const bladeW   = KNIFE_W;
    ctx.beginPath();
    ctx.moveTo(0, -bladeLen);          // tip
    ctx.lineTo(bladeW / 2, 0);
    ctx.lineTo(-bladeW / 2, 0);
    ctx.closePath();
    const bladeGrad = ctx.createLinearGradient(-bladeW / 2, 0, bladeW / 2, 0);
    bladeGrad.addColorStop(0,   '#8aafcc');
    bladeGrad.addColorStop(0.45,'#d8eaf7');
    bladeGrad.addColorStop(1,   '#6090b0');
    ctx.fillStyle = bladeGrad;
    ctx.fill();
    // Edge shimmer
    ctx.beginPath();
    ctx.moveTo(0, -bladeLen);
    ctx.lineTo(bladeW * 0.4, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Bolster (guard)
    ctx.beginPath();
    ctx.rect(-bladeW * 0.7, -2, bladeW * 1.4, 6);
    ctx.fillStyle = '#9aafc4';
    ctx.fill();

    // Handle
    const hG = ctx.createLinearGradient(-bladeW * 0.8, 0, bladeW * 0.8, 0);
    hG.addColorStop(0,  '#5c2e0a');
    hG.addColorStop(0.5,'#8B4513');
    hG.addColorStop(1,  '#5c2e0a');
    ctx.beginPath();
    ctx.roundRect(-bladeW * 0.8, 2, bladeW * 1.6, KNIFE_HANDLE_H, 3);
    ctx.fillStyle = hG;
    ctx.fill();
    ctx.strokeStyle = '#3a1500';
    ctx.lineWidth   = 1;
    ctx.stroke();
  }

  function drawParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.life--;
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 1.5 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        r: 2 + Math.random() * 3,
        color,
        life: 28 + Math.floor(Math.random() * 20),
        maxLife: 48,
      });
    }
  }

  function drawLevelFlash() {
    if (levelFlash <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, levelFlash / 20) * 0.45;
    ctx.fillStyle   = '#ffb830';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    levelFlash--;
  }

  function drawHUD() {
    // Knife queue at bottom
    const spacing = 22;
    const startX  = cx - ((knivesLeft - 1) * spacing) / 2;
    const y       = H - 30;
    for (let i = 0; i < knivesLeft; i++) {
      ctx.save();
      ctx.translate(startX + i * spacing, y);
      ctx.scale(0.45, 0.45);
      _drawKnifePath(false);
      ctx.restore();
    }
  }

  /* ── Game Logic ─────────────────────────────────────────────────── */
  function logRadius() {
    return Math.min(LOG_RADIUS, W * 0.22);
  }

  function throwKnife() {
    sound.init();
    sound.startBg();
    if (!playing || busy || !flyDone) return;
    busy    = true;
    flyDone = false;
    flying  = true;
    flyY    = H - 80;
    sound.playThrow();
  }

  function updateFlying() {
    if (!flying) return;
    flyY -= 14; // upward speed

    const r    = logRadius();
    const dist = Math.abs(flyY - logY);

    if (dist <= r + 2) {
      // Arrived at log – check collision
      flying = false;
      const tipAngle = (logAngle + 90) % 360; // direction pointing "up" from log center

      // Compute angle where knife hits the log circumference
      // The knife flies from the bottom (cx, bottom) straight up to (cx, logY - r)
      // So the hit point on the log is at 270° in world space → adjust for log rotation
      let hitAngleDeg = (270 - logAngle) % 360;
      if (hitAngleDeg < 0) hitAngleDeg += 360;

      // Check if any stuck knife is too close
      const clash = stuckKnives.some(a => {
        let diff = Math.abs(a - hitAngleDeg) % 360;
        if (diff > 180) diff = 360 - diff;
        return diff < HIT_ANGLE_TOL;
      });

      if (clash) {
        // Knife hits another knife
        sound.playClash();
        spawnParticles(cx, logY - r, '#ff4e4e', 18);
        lives_lost();
      } else {
        // Knife sticks!
        stuckKnives.push(hitAngleDeg);
        combo++;
        const pts = 10 + combo * 5;
        score += pts;
        scoreEl.textContent = score;
        sound.playStick(combo);
        spawnParticles(cx, logY - r, '#ffd700', 8);

        knivesLeft--;
        knivesEl.textContent = knivesLeft;

        if (knivesLeft <= 0) {
          // Cleared the log → next level
          setTimeout(nextLevel, 600);
        } else {
          flyY    = H - 80;
          flyDone = true;
          busy    = false;
        }
      }
    }
  }

  function lives_lost() {
    // In Knife Hit style: one clash = game over
    setTimeout(gameOver, 350);
    flyDone = true;
    busy    = false;
  }

  function nextLevel() {
    level++;
    levelEl.textContent = level;
    levelFlash = 40;
    sound.playLevelUp();
    spawnParticles(cx, logY, '#ffb830', 30);
    initLevel();
    flyDone = true;
    busy    = false;
  }

  function gameOver() {
    playing = false;
    cancelAnimationFrame(raf);
    sound.stopBg();
    sound.playGameOver();
    setTimeout(() => {
      message.classList.remove('hidden');
      msgTitle.textContent = '💀 Game Over!';
      msgBody.textContent  = `Score: ${score}  |  Level ${level}`;
      throwBtn.classList.add('hidden');
      againBtn.classList.remove('hidden');
    }, 400);
  }

  /* ── Game Loop ──────────────────────────────────────────────────── */
  function gameLoop() {
    ctx.clearRect(0, 0, W, H);

    if (!playing) return;

    // Rotate log
    logAngle = (logAngle + logSpeed + 360) % 360;

    // Draw background subtle grid
    drawBgGrid();

    // Draw stuck knives (rotate with log)
    stuckKnives.forEach(a => {
      const worldAngle = (a + logAngle) % 360;
      drawStuckKnifeWorld(worldAngle);
    });

    // Draw log
    drawLog();

    // Flying knife
    if (flying) updateFlying();
    if (!flyDone) drawFlyingKnife();

    drawParticles();
    drawLevelFlash();
    drawHUD();

    raf = requestAnimationFrame(gameLoop);
  }

  function drawBgGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth   = 1;
    for (let x = 0; x < W; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawStuckKnifeWorld(angleDeg) {
    // Knife tip is at the log perimeter; knife points outward
    const r   = logRadius();
    const rad = angleDeg * Math.PI / 180;
    const tipX = cx  + Math.cos(rad - Math.PI / 2) * r;
    const tipY = logY + Math.sin(rad - Math.PI / 2) * r;

    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(rad);
    _drawKnifePath(true);
    ctx.restore();
  }

  /* ── Events ─────────────────────────────────────────────────────── */
  function initAudio() {
    sound.init();
    sound.startBg();
  }

  throwBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    initAudio();
    throwKnife();
  });

  canvas.addEventListener('pointerdown', e => {
    if (playing) { initAudio(); throwKnife(); }
  });

  againBtn.addEventListener('click', () => {
    initAudio();
    reset();
  });

  audioBtn.addEventListener('click', e => {
    e.stopPropagation();
    initAudio();
    const muted = sound.toggleMute();
    audioIcon.textContent = muted ? '🔇' : '🔊';
  });

  document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      initAudio();
      if (playing) throwKnife();
      else reset();
    }
  });

  window.addEventListener('resize', () => {
    resize();
  });

  /* ── Start ──────────────────────────────────────────────────────── */
  resize();
  reset();
})();
