/**
 * Knife Toss! – Child-friendly canvas game
 * Rules: tap to throw a knife → it sticks to the spinning wheel's edge.
 *        If it hits another knife already stuck → Game Over.
 *        Score as many as you can!
 */

/* ─── Sound Engine (no UI button – plays automatically) ─────────── */
class Sound {
  constructor() {
    this.ctx   = null;
    this.muted = false;
    this._bgTimer = null;
    this._bgStep  = 0;
  }

  _init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  _tone(freq, dur, type = 'sine', vol = 0.15, endFreq = null) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type  = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(now); osc.stop(now + dur);
    } catch (_) {}
  }

  throw()  {
    this._init();
    // Swish sound
    this._tone(900, 0.10, 'sawtooth', 0.16, 300);
  }

  stick(n) {
    this._init();
    // Satisfying thunk + rising ping
    this._tone(130, 0.15, 'triangle', 0.28);
    const freqs = [523, 587, 659, 698, 784, 880, 988, 1047];
    const f = freqs[Math.min(n - 1, freqs.length - 1)];
    setTimeout(() => this._tone(f, 0.20, 'sine', 0.18), 55);
  }

  clash() {
    this._init();
    this._tone(280, 0.08, 'square', 0.3, 180);
    setTimeout(() => this._tone(140, 0.22, 'sawtooth', 0.22, 80), 60);
  }

  levelUp() {
    this._init();
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.28, 'sine', 0.22), i * 70)
    );
  }

  gameOver() {
    this._init();
    [440, 370, 311, 247].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.4, 'triangle', 0.2), i * 170)
    );
  }

  startBg() {
    if (this._bgTimer) return;
    const notes = [392, 440, 392, 349, 392, 440, 392, 330];
    this._bgTimer = setInterval(() => {
      if (this.ctx) this._tone(notes[this._bgStep++ % notes.length], 0.22, 'sine', 0.03);
    }, 360);
  }

  stopBg() {
    clearInterval(this._bgTimer);
    this._bgTimer = null;
  }
}

/* ─── Game ───────────────────────────────────────────────────────── */
(() => {
  /* DOM */
  const canvas      = document.getElementById('arena');
  const C           = canvas.getContext('2d');
  const scoreEl     = document.getElementById('score');
  const levelEl     = document.getElementById('level');
  const bestEl      = document.getElementById('best');
  const overlay     = document.getElementById('overlay');
  const overlayEmoji= document.getElementById('overlayEmoji');
  const overlayTitle= document.getElementById('overlayTitle');
  const overlaySub  = document.getElementById('overlaySub');
  const playBtn     = document.getElementById('playBtn');
  const throwBtn    = document.getElementById('throwBtn');

  const sfx = new Sound();

  /* ── Constants ──────────────────────────────────────────────────── */
  const KNIVES_PER_LEVEL = 7;   // knives to complete a level (increases)
  const SAFE_GAP_DEG     = 15;  // minimum angle gap between knives (degrees)
  const KNIFE_LEN        = 40;  // total visual knife length
  const KNIFE_BLADE      = 28;  // blade portion
  const KNIFE_W          = 7;

  /* ── State ──────────────────────────────────────────────────────── */
  let score, level, best, stuckAngles, wheelAngle, wheelSpeed;
  let flyingY, flyingActive, flyDone, busy;
  let playing = false;
  let raf     = null;
  let S       = 0;   // canvas logical size (square)
  let dpr     = 1;
  let particles = [];
  let shakeFrames = 0;

  /* ── Resize (square canvas) ─────────────────────────────────────── */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    S   = Math.round(rect.width);
    canvas.width  = S * dpr;
    canvas.height = S * dpr;
    C.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function wheelR() { return S * 0.28; }
  function cx()     { return S / 2; }
  function cy()     { return S * 0.40; }    // wheel a bit above centre

  /* ── Level init ─────────────────────────────────────────────────── */
  function startLevel() {
    stuckAngles  = [];
    wheelAngle   = 0;
    flyingActive = false;
    flyDone      = true;
    busy         = false;
    flyingY      = S - 30;
    // Alternate spin direction; speed grows with level
    const dir    = level % 2 === 0 ? -1 : 1;
    wheelSpeed   = dir * (0.55 + (level - 1) * 0.15);
  }

  function fullReset() {
    score        = 0;
    level        = 1;
    particles    = [];
    shakeFrames  = 0;
    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    startLevel();
  }

  /* ── Drawing helpers ────────────────────────────────────────────── */
  function drawWheel() {
    const r   = wheelR();
    const x   = cx(), y = cy();

    C.save();
    C.translate(x, y);
    C.rotate(wheelAngle * Math.PI / 180);

    // Shadow
    C.shadowColor   = 'rgba(180,100,220,0.25)';
    C.shadowBlur    = 18;

    // Outer ring
    C.beginPath();
    C.arc(0, 0, r, 0, Math.PI * 2);
    C.fillStyle = '#ffb347';
    C.fill();

    C.shadowBlur = 0;

    // Inner rings (decorative)
    [0.78, 0.55, 0.32].forEach((s, i) => {
      const colors = ['#ff8c42', '#ff6b35', '#ff4e1a'];
      C.beginPath();
      C.arc(0, 0, r * s, 0, Math.PI * 2);
      C.fillStyle = colors[i];
      C.fill();
    });

    // Center circle
    C.beginPath();
    C.arc(0, 0, r * 0.14, 0, Math.PI * 2);
    C.fillStyle = '#fff3e0';
    C.fill();
    C.strokeStyle = '#cc5500';
    C.lineWidth   = 2.5;
    C.stroke();

    // Outer border
    C.beginPath();
    C.arc(0, 0, r, 0, Math.PI * 2);
    C.strokeStyle = '#cc5500';
    C.lineWidth   = 3.5;
    C.stroke();

    C.restore();
  }

  // Draw a knife given: tip position (tx,ty), pointing upward (rotate by angle)
  function _knife(C, len, bladeLen, w, highlight) {
    const handleLen = len - bladeLen;

    // Blade (triangle pointing up)
    C.beginPath();
    C.moveTo(0, -bladeLen);          // tip
    C.lineTo( w / 2,  0);
    C.lineTo(-w / 2,  0);
    C.closePath();
    const bg = C.createLinearGradient(-w / 2, 0, w / 2, 0);
    bg.addColorStop(0,   '#b0cce8');
    bg.addColorStop(0.45,'#e8f4ff');
    bg.addColorStop(1,   '#7aaac8');
    C.fillStyle   = bg;
    C.fill();
    C.strokeStyle = '#4a80a8';
    C.lineWidth   = 1;
    C.stroke();

    // Shine
    C.beginPath();
    C.moveTo(w * 0.05, -bladeLen + 4);
    C.lineTo(w * 0.35, -4);
    C.strokeStyle = 'rgba(255,255,255,0.65)';
    C.lineWidth   = 1.5;
    C.stroke();

    // Bolster
    C.fillStyle   = '#9ab0c8';
    C.beginPath();
    C.roundRect(-w * 0.75, -2, w * 1.5, 5, 2);
    C.fill();

    // Handle
    const hg = C.createLinearGradient(-w * 0.8, 0, w * 0.8, 0);
    hg.addColorStop(0,   '#d35400');
    hg.addColorStop(0.5, '#e67e22');
    hg.addColorStop(1,   '#d35400');
    C.beginPath();
    C.roundRect(-w * 0.75, 2, w * 1.5, handleLen, 3);
    C.fillStyle   = hg;
    C.fill();
    C.strokeStyle = '#7a2900';
    C.lineWidth   = 1;
    C.stroke();

    // Handle grip lines
    C.strokeStyle = 'rgba(0,0,0,0.2)';
    C.lineWidth   = 1;
    for (let g = 6; g < handleLen - 3; g += 5) {
      C.beginPath();
      C.moveTo(-w * 0.55, 2 + g);
      C.lineTo( w * 0.55, 2 + g);
      C.stroke();
    }
  }

  // Draw a knife stuck at angle `worldDeg` on the wheel circumference
  function drawStuckKnife(worldDeg) {
    const r   = wheelR();
    const rad = (worldDeg - 90) * Math.PI / 180;
    const tx  = cx() + Math.cos(rad) * r;
    const ty  = cy() + Math.sin(rad) * r;

    C.save();
    C.translate(tx, ty);
    C.rotate((worldDeg - 90) * Math.PI / 180 + Math.PI / 2);
    // Knife tip is at (0,0), handle goes downward (+y)
    _knife(C, KNIFE_LEN, KNIFE_BLADE, KNIFE_W, false);
    C.restore();
  }

  // The knife flying upward from the bottom
  function drawFlyingKnife() {
    C.save();
    C.translate(cx(), flyingY);
    _knife(C, KNIFE_LEN, KNIFE_BLADE, KNIFE_W, true);
    C.restore();
  }

  function drawParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.18;
      p.life--;
      C.save();
      C.globalAlpha = p.life / p.maxLife;
      C.fillStyle   = p.col;
      C.beginPath();
      C.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      C.fill();
      C.restore();
    });
  }

  function burst(x, y, cols, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const v = 2 + Math.random() * 3.5;
      particles.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2,
        r: 3 + Math.random() * 4,
        col: cols[i % cols.length],
        life: 30 + Math.floor(Math.random() * 20), maxLife: 50,
      });
    }
  }

  // Draw small knife icons as "knife count" indicator at bottom
  function drawKnifeCount() {
    const remaining = (KNIVES_PER_LEVEL + Math.floor((level - 1) / 2)) - stuckAngles.length;
    if (remaining <= 0) return;
    const iconW = 16, gap = 20;
    const total = remaining;
    const startX = cx() - ((total - 1) * gap) / 2;
    const y = S - 18;
    for (let i = 0; i < total; i++) {
      C.save();
      C.translate(startX + i * gap, y);
      C.scale(0.32, 0.32);
      _knife(C, KNIFE_LEN, KNIFE_BLADE, KNIFE_W, false);
      C.restore();
    }
  }

  /* ── Game Logic ─────────────────────────────────────────────────── */
  function doThrow() {
    sfx._init(); sfx.startBg();
    if (!playing || busy || !flyDone) return;
    busy        = true;
    flyDone     = false;
    flyingActive= true;
    flyingY     = S - 30;
    sfx.throw();
  }

  function updateFlying() {
    if (!flyingActive) return;
    flyingY -= S * 0.025;   // move knife upward ~2.5% of canvas per frame

    const r    = wheelR();
    const dist = Math.abs(flyingY - cy());

    if (dist <= r + 4) {
      // Knife reached wheel
      flyingActive = false;

      // Compute angle at which the knife hits the wheel.
      // The knife flies straight up from the center-x of canvas.
      // On the circle, the "top" is 270° in standard math, or -90°.
      // We want the angle in wheel-local space (subtract current wheelAngle).
      let hitWorld = 270;  // knife always comes from directly below centre
      let localHit = ((hitWorld - wheelAngle) % 360 + 360) % 360;

      // Check for clash: any stuck knife within SAFE_GAP_DEG
      const clash = stuckAngles.some(a => {
        let d = Math.abs(a - localHit) % 360;
        if (d > 180) d = 360 - d;
        return d < SAFE_GAP_DEG;
      });

      if (clash) {
        shakeFrames = 18;
        sfx.clash();
        burst(cx(), cy() - r, ['#ff4e4e','#ff9900','#ff0066'], 22);
        setTimeout(showGameOver, 500);
        flyDone = true;
        busy    = false;
      } else {
        // Stick!
        stuckAngles.push(localHit);
        score++;
        scoreEl.textContent = score;
        if (score > best) { best = score; bestEl.textContent = best; }

        sfx.stick(stuckAngles.length);
        burst(cx(), cy() - r, ['#ffd700','#ff69b4','#00e5ff'], 10);

        // Check if level cleared
        const needed = KNIVES_PER_LEVEL + Math.floor((level - 1) / 2);
        if (stuckAngles.length >= needed) {
          level++;
          levelEl.textContent = level;
          sfx.levelUp();
          burst(cx(), cy(), ['#ffd700','#7cfc00','#ff69b4','#00e5ff'], 30);
          setTimeout(() => { startLevel(); flyDone = true; busy = false; }, 700);
        } else {
          flyingY = S - 30;
          flyDone = true;
          busy    = false;
        }
      }
    }
  }

  function showGameOver() {
    playing = false;
    sfx.stopBg();
    sfx.gameOver();
    cancelAnimationFrame(raf);

    // Final render with crash state
    draw();

    overlayEmoji.textContent = '💥';
    overlayTitle.textContent = 'Game Over!';
    overlaySub.textContent   = `You scored ${score} 🔪  Best: ${best}`;
    playBtn.textContent      = 'PLAY AGAIN! 🎮';
    overlay.classList.remove('hidden');
    throwBtn.classList.add('hidden');
  }

  /* ── Draw frame ─────────────────────────────────────────────────── */
  function draw() {
    C.clearRect(0, 0, S, S);

    // Shake effect on clash
    if (shakeFrames > 0) {
      const dx = (Math.random() - 0.5) * 8;
      const dy = (Math.random() - 0.5) * 8;
      C.save(); C.translate(dx, dy); shakeFrames--;
    }

    // Background dots (fun, child-friendly)
    drawBgDots();

    // Stuck knives – their world angle = local angle + current wheelAngle
    stuckAngles.forEach(local => {
      const world = (local + wheelAngle + 360) % 360;
      drawStuckKnife(world);
    });

    drawWheel();

    if (flyingActive || !flyDone) drawFlyingKnife();

    drawParticles();
    drawKnifeCount();

    if (shakeFrames >= 0 && shakeFrames < 18) C.restore?.();
  }

  function drawBgDots() {
    const dotPositions = [
      [0.1,0.1,'#ffe0f0'], [0.9,0.12,'#e0f0ff'], [0.05,0.6,'#fff0d0'],
      [0.92,0.55,'#e8ffe0'], [0.5,0.08,'#ffe8f0'], [0.18,0.88,'#f0e0ff'],
      [0.82,0.90,'#fff0c0'], [0.3,0.72,'#d0f0ff'],
    ];
    dotPositions.forEach(([rx,ry,col]) => {
      C.beginPath();
      C.arc(rx * S, ry * S, S * 0.05, 0, Math.PI * 2);
      C.fillStyle = col;
      C.fill();
    });
  }

  /* ── Loop ───────────────────────────────────────────────────────── */
  function loop() {
    if (!playing) return;
    wheelAngle = (wheelAngle + wheelSpeed + 360) % 360;
    updateFlying();
    draw();
    raf = requestAnimationFrame(loop);
  }

  /* ── Start ──────────────────────────────────────────────────────── */
  function startGame() {
    fullReset();
    playing = true;
    overlay.classList.add('hidden');
    throwBtn.classList.remove('hidden');
    sfx._init();
    sfx.startBg();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  /* ── Events ─────────────────────────────────────────────────────── */
  throwBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    doThrow();
  });

  canvas.addEventListener('pointerdown', () => {
    if (playing) doThrow();
  });

  playBtn.addEventListener('click', startGame);

  document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (playing) doThrow();
      else startGame();
    }
  });

  window.addEventListener('resize', () => {
    resize();
    if (!playing) draw();
  });

  /* ── Init ───────────────────────────────────────────────────────── */
  best = 0;
  resize();
  fullReset();
  draw();  // draw initial state
  // Show start screen
  overlayEmoji.textContent = '🔪';
  overlayTitle.textContent = 'Knife Toss!';
  overlaySub.textContent   = 'Throw knives on the spinning wheel!';
  playBtn.textContent      = 'START! 🎮';
  overlay.classList.remove('hidden');
  throwBtn.classList.add('hidden');
})();
