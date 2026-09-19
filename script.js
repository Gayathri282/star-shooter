/**
 * Knife Toss! – Canvas game
 *
 * Features:
 *  - Each level gives you a LIMITED number of knives
 *  - You must land at least MIN_TO_PASS knives to advance to the next level
 *  - Wheel speed increases each level AND slowly ramps up during a level (time pressure)
 *  - Hitting a knife already on the spinner → playful musical "boing" chord + rainbow flash
 *  - Knives must hit the circumference (edge) of the spinner
 */

/* ─── Level Config ─────────────────────────────────────────────────── */
const LEVELS = [
  { knives: 6,  minToPass: 3, baseSpeed: 0.70, wait1st: false },   // Level 1: Smooth start
  { knives: 7,  minToPass: 4, baseSpeed: 1.05, wait1st: true  },   // Level 2: Faster + Waits for 1st knife!
  { knives: 8,  minToPass: 5, baseSpeed: 1.45, wait1st: false },   // Level 3: Faster spinning
  { knives: 9,  minToPass: 6, baseSpeed: 1.90, wait1st: true  },   // Level 4: Fast + Waits for 1st knife!
  { knives: 10, minToPass: 7, baseSpeed: 2.40, wait1st: true  },   // Level 5: Extra Fast + Waits for 1st knife!
];
function getLevelCfg(lvl) {
  if (lvl <= LEVELS.length) return LEVELS[lvl - 1];
  const extra = lvl - LEVELS.length;
  return {
    knives: 10 + extra,
    minToPass: 7 + extra,
    baseSpeed: 2.40 + extra * 0.45,
    wait1st: lvl % 2 === 0 || lvl % 3 === 0
  };
}

/* ─── Sound Engine ──────────────────────────────────────────────────── */
class Sound {
  constructor() {
    this.ctx      = null;
    this.muted    = false;
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

  _tone(freq, dur, type = 'sine', vol = 0.15, endFreq = null, delay = 0) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      const now = this.ctx.currentTime + delay;
      osc.type  = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(now); osc.stop(now + dur);
    } catch (_) {}
  }

  throw() {
    this._init();
    this._tone(900, 0.10, 'sawtooth', 0.16, 300);
  }

  stick(n) {
    this._init();
    this._tone(130, 0.15, 'triangle', 0.28);
    const freqs = [523, 587, 659, 698, 784, 880, 988, 1047];
    const f = freqs[Math.min(n - 1, freqs.length - 1)];
    setTimeout(() => this._tone(f, 0.20, 'sine', 0.18), 55);
  }

  /**
   * Playful "boing" chord when knife hits another knife on the spinner.
   * Uses a descending sine sweep + harmonic major chord for a fun, kid-friendly feel.
   */
  clash() {
    this._init();
    // Descending boing sweep
    this._tone(880, 0.45, 'sine', 0.24, 180, 0);
    // Major chord (C5 + E5 + G5) – happy, playful
    this._tone(523, 0.30, 'triangle', 0.18, null, 0.04);
    this._tone(659, 0.30, 'triangle', 0.15, null, 0.04);
    this._tone(784, 0.30, 'triangle', 0.12, null, 0.04);
    // Spring wobble resonance
    this._tone(440, 0.50, 'sine', 0.10, 100, 0.12);
    // High cheerful ping
    this._tone(1200, 0.18, 'sine', 0.13, 550, 0.32);
  }

  levelFail() {
    this._init();
    [392, 349, 311, 262].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.35, 'sawtooth', 0.18), i * 130)
    );
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
    if (this._bgTimer || this.muted) return;
    this._init();

    // Upbeat, cheerful 16-step melody loop (Hz)
    const melody = [
      523, 659, 784, 1047,  // C5, E5, G5, C6
      587, 784, 880, 1175,  // D5, G5, A5, D6
      440, 523, 659, 880,   // A4, C5, E5, A5
      349, 440, 523, 698    // F4, A4, C5, F5
    ];

    // Warm bass line (C3, G2, A2, F2)
    const bass = [130.81, 98.00, 110.00, 87.31];

    this._bgStep = 0;
    this._bgTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const step = this._bgStep % 16;
      const bar  = Math.floor(step / 4);

      // Lead melody tone
      const noteFreq = melody[step];
      this._tone(noteFreq, 0.16, 'sine', 0.045);

      // Playful bass pulse on downbeats (steps 0, 4, 8, 12)
      if (step % 4 === 0) {
        this._tone(bass[bar], 0.26, 'triangle', 0.06);
      }

      // High cheerful bell sparkle on syncopated 16th beats
      if (step % 4 === 2) {
        this._tone(noteFreq * 1.5, 0.08, 'sine', 0.02);
      }

      this._bgStep++;
    }, 180);
  }

  stopBg() {
    if (this._bgTimer) {
      clearInterval(this._bgTimer);
      this._bgTimer = null;
    }
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
  const SAFE_GAP_DEG  = 14;   // minimum angle gap between knives (degrees)
  const KNIFE_LEN     = 40;
  const KNIFE_BLADE   = 28;
  const KNIFE_W       = 7;
  // Speed ramp: wheel speeds up gradually within a level (fraction per frame)
  const SPEED_RAMP    = 0.00008;

  /* ── State ──────────────────────────────────────────────────────── */
  let score, level, best, stuckAngles, wheelAngle, wheelSpeed;
  let flyingY, flyingActive, flyDone, busy;
  let playing       = false;
  let raf           = null;
  let S             = 0;
  let W             = 0;
  let H             = 0;
  let dpr           = 1;
  let knivesLeft    = 0;      // knives remaining to throw this level
  let levelCfg      = null;   // current level config
  let frameCount    = 0;      // frame counter for speed ramp
  let clashFlash        = 0;      // rainbow flash frames remaining after a clash
  let particles         = [];
  let shakeFrames       = 0;
  let gameStartTime     = 0;      // tracks when game started to hide guide after 10s
  let waitingForFirstHit= false;  // when true, wheel waits for 1st knife hit to start spinning
  let overlayMode       = 'START';// 'START', 'ADVANCE', or 'FAIL'
  let advanceTimeout    = null;   // timer for level advance transition

  /* ── Resize (fullscreen canvas) ─────────────────────────────────── */
  function resize() {
    dpr = window.devicePixelRatio || 1;
    W   = window.innerWidth;
    H   = window.innerHeight;
    S   = Math.min(W, H);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    C.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function wheelR() { return Math.min(W * 0.32, H * 0.22, 135); }
  function cx()     { return W / 2; }
  function cy()     { return H * 0.36; }    // wheel centered in upper section

  /* ── Level init ─────────────────────────────────────────────────── */
  function startLevel() {
    levelCfg     = getLevelCfg(level);
    stuckAngles  = [];
    wheelAngle   = 0;
    flyingActive = false;
    flyDone      = true;
    busy         = false;
    flyingY      = H - 75;
    frameCount   = 0;
    knivesLeft   = levelCfg.knives;

    // Check if this level waits for the 1st knife to start spinning
    waitingForFirstHit = !!levelCfg.wait1st;
    if (waitingForFirstHit) {
      wheelSpeed = 0;
    } else {
      const dir  = level % 2 === 0 ? -1 : 1;
      wheelSpeed = dir * levelCfg.baseSpeed;
    }

    levelEl.textContent = level;
  }

  function fullReset() {
    score       = 0;
    level       = 1;
    particles   = [];
    shakeFrames = 0;
    clashFlash  = 0;
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
    const rad = worldDeg * Math.PI / 180;
    const tx  = cx() + Math.cos(rad) * r;
    const ty  = cy() + Math.sin(rad) * r;

    C.save();
    C.translate(tx, ty);
    C.rotate(rad - Math.PI / 2);

    // Wood crack lines around penetration site
    C.strokeStyle = '#8b4513';
    C.lineWidth = 1.5;
    C.beginPath();
    C.moveTo(-5, -2); C.lineTo(-9, -7);
    C.moveTo(5, -2);  C.lineTo(9, -7);
    C.stroke();

    // Knife shadow on log
    C.shadowColor = 'rgba(0,0,0,0.25)';
    C.shadowBlur = 4;
    C.shadowOffsetY = 3;

    // Knife tip is at (0,0), handle goes downward (+y)
    _knife(C, KNIFE_LEN, KNIFE_BLADE, KNIFE_W, false);
    C.restore();
  }

  // Draw laser trajectory line & timing reticle so user knows where & when to throw (Active for first 10 seconds only)
  function drawAimingGuide() {
    if (!playing || flyingActive) return;

    // Show guide only for the first 10 seconds of gameplay
    const elapsed = Date.now() - gameStartTime;
    if (elapsed > 10000) return; // Hide completely after 10 seconds

    // Smoothly fade out guide during the last 2 seconds (between 8s and 10s)
    let opacity = 1;
    if (elapsed > 8000) {
      opacity = (10000 - elapsed) / 2000;
    }

    const r       = wheelR();
    const targetY = cy() + r;
    const startY  = H - 75;

    // Check if bottom 90deg hit zone is currently safe or blocked by a stuck knife
    const isBlocked = stuckAngles.some(local => {
      const world = (local + wheelAngle + 360) % 360;
      let d = Math.abs(world - 90) % 360;
      if (d > 180) d = 360 - d;
      return d < SAFE_GAP_DEG + 2;
    });

    const guideColor = isBlocked ? '#ef4444' : '#22c55e';

    C.save();
    C.globalAlpha = Math.max(0, opacity);

    // 1. Dashed Trajectory Aiming Line (Where to throw)
    C.beginPath();
    C.setLineDash([6, 6]);
    C.lineDashOffset = -frameCount * 1.5;
    C.moveTo(cx(), startY);
    C.lineTo(cx(), targetY);
    C.strokeStyle = guideColor;
    C.lineWidth   = 2;
    C.stroke();
    C.setLineDash([]);

    // 2. Landing Target Reticle at 6 o'clock (When to throw)
    const pulse = Math.sin(frameCount * 0.15) * 2;
    C.shadowColor = guideColor;
    C.shadowBlur  = isBlocked ? 12 : 8;

    // Outer target ring
    C.beginPath();
    C.arc(cx(), targetY, 13 + pulse, 0, Math.PI * 2);
    C.strokeStyle = guideColor;
    C.lineWidth   = 2.5;
    C.stroke();

    // Inner target dot
    C.beginPath();
    C.arc(cx(), targetY, 3, 0, Math.PI * 2);
    C.fillStyle = guideColor;
    C.fill();

    // Target crosshair ticks
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach(angle => {
      const x1 = cx() + Math.cos(angle) * (15 + pulse);
      const y1 = targetY + Math.sin(angle) * (15 + pulse);
      const x2 = cx() + Math.cos(angle) * (20 + pulse);
      const y2 = targetY + Math.sin(angle) * (20 + pulse);
      C.beginPath();
      C.moveTo(x1, y1);
      C.lineTo(x2, y2);
      C.stroke();
    });

    // Timing state text badge
    C.font      = `900 ${Math.round(S * 0.026)}px Nunito, sans-serif`;
    C.textAlign = 'center';
    C.fillStyle = guideColor;
    C.fillText(
      isBlocked ? '⚠️ WAIT!' : '🎯 THROW NOW!',
      cx(), targetY + 34
    );

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

  /* ── HUD: knives remaining + qualification label + speed ring ───── */
  function drawHUD() {
    // ── Knives remaining icons (bottom strip) ──
    const remaining = knivesLeft;
    if (remaining > 0) {
      const gap    = 18;
      const startX = cx() - ((remaining - 1) * gap) / 2;
      const y      = H - 24;
      for (let i = 0; i < remaining; i++) {
        C.save();
        C.translate(startX + i * gap, y);
        C.scale(0.30, 0.30);
        _knife(C, KNIFE_LEN, KNIFE_BLADE, KNIFE_W);
        C.restore();
      }
    }

    // ── Qualification status label ──
    if (levelCfg) {
      const stuck   = stuckAngles.length;
      const minPass = levelCfg.minToPass;
      C.save();
      C.font      = `bold ${Math.round(Math.min(S * 0.038, 16))}px Nunito, sans-serif`;
      C.textAlign = 'center';
      C.fillStyle = stuck >= minPass ? '#22c55e' : '#f59e0b';
      C.fillText(
        stuck >= minPass
          ? `✓ ${stuck}/${minPass} – Keep going!`
          : `Need ${minPass - stuck} more to advance`,
        cx(), H - 48
      );
      C.restore();
    }

    // ── Notice when spinner is waiting for 1st hit to start ──
    if (waitingForFirstHit && stuckAngles.length === 0) {
      C.save();
      C.font        = `900 ${Math.round(Math.min(S * 0.04, 18))}px Fredoka One, Nunito, sans-serif`;
      C.textAlign   = 'center';
      C.fillStyle   = '#e84393';
      C.shadowColor = 'rgba(232, 67, 147, 0.4)';
      C.shadowBlur  = 10;
      C.fillText('🎯 Stab 1st knife to start spinning!', cx(), cy() - wheelR() - 16);
      C.restore();
    }

    // ── Speed indicator arc around wheel (green→red as speed grows) ──
    const maxSpeed = (levelCfg ? levelCfg.baseSpeed : 0.55) * 2.5;
    const speedPct = Math.min(Math.abs(wheelSpeed) / maxSpeed, 1);
    const r = wheelR();
    C.save();
    C.beginPath();
    C.arc(cx(), cy(), r + 9, -Math.PI / 2, -Math.PI / 2 + speedPct * Math.PI * 2);
    C.strokeStyle = `hsl(${Math.round((1 - speedPct) * 120)}, 90%, 52%)`;
    C.lineWidth   = 5;
    C.lineCap     = 'round';
    C.stroke();
    C.restore();
  }

  /* ── Clash rainbow flash ─────────────────────────────────────────── */
  function drawClashFlash() {
    if (clashFlash <= 0) return;
    const hue = (clashFlash * 42) % 360;
    C.save();
    C.globalAlpha = (clashFlash / 30) * 0.32;
    C.fillStyle   = `hsl(${hue}, 100%, 62%)`;
    C.fillRect(0, 0, W, H);
    C.restore();
    clashFlash--;
  }

  /* ── Game Logic ─────────────────────────────────────────────────── */
  function doThrow() {
    sfx._init(); sfx.startBg();
    if (!playing || busy || !flyDone) return;
    if (knivesLeft <= 0) return;
    busy         = true;
    flyDone      = false;
    flyingActive = true;
    flyingY      = H - 75;
    knivesLeft--;
    sfx.throw();
  }

  function updateFlying() {
    if (!flyingActive) return;
    flyingY -= Math.max(12, H * 0.022);

    const r    = wheelR();
    const dist = Math.abs(flyingY - cy());

    // Knife must reach the CIRCUMFERENCE of the wheel
    if (dist <= r + 4) {
      flyingActive = false;

      const hitWorld = 90;  // bottom 6 o'clock hit position in canvas coordinates
      const localHit = ((hitWorld - wheelAngle) % 360 + 360) % 360;

      // Check for clash with any knife already on the circumference
      const clashIdx = stuckAngles.findIndex(a => {
        let d = Math.abs(a - localHit) % 360;
        if (d > 180) d = 360 - d;
        return d < SAFE_GAP_DEG;
      });

      if (clashIdx !== -1) {
        // ── Hit another knife! ──────────────────────────────────────
        shakeFrames = 22;
        clashFlash  = 30;  // trigger rainbow flash

        // Burst at the struck knife's world position
        const hitRad = (stuckAngles[clashIdx] + wheelAngle) * Math.PI / 180;
        burst(
          cx() + Math.cos(hitRad) * r,
          cy() + Math.sin(hitRad) * r,
          ['#ff4e4e','#ff9900','#ff0066','#ffe066','#00e5ff'], 28
        );
        burst(cx(), cy(), ['#ff69b4','#ffd700'], 10);

        // Playful boing chord
        sfx.clash();

        // Even if we clashed, check if we already qualified — reward player
        const qualified = stuckAngles.length >= (levelCfg ? levelCfg.minToPass : 3);
        setTimeout(() => qualified ? advanceLevel() : showGameOver(), 700);
        flyDone = true;
        busy    = false;

      } else {
        // ── Knife sticks to circumference! ──────────────────────────
        stuckAngles.push(localHit);
        score++;
        scoreEl.textContent = score;
        if (score > best) { best = score; bestEl.textContent = best; }

        sfx.stick(stuckAngles.length);
        // Wood chip particle burst where knife stabs into wheel log
        burst(cx(), cy() + r, ['#ffd700','#ff69b4','#00e5ff','#8b4513','#d2691e'], 16);

        // If level was waiting for 1st hit to start spinning:
        if (waitingForFirstHit) {
          waitingForFirstHit = false;
          const dir = level % 2 === 0 ? -1 : 1;
          wheelSpeed = dir * levelCfg.baseSpeed;
          // Spin start celebratory particle burst
          burst(cx(), cy(), ['#00e5ff', '#ffd700', '#ff69b4', '#7cfc00'], 24);
        }

        const cfg     = getLevelCfg(level);
        const allDone = stuckAngles.length >= cfg.knives;  // used all knives
        const noLeft  = knivesLeft <= 0;

        if (allDone || noLeft) {
          // No more knives available — evaluate result
          if (stuckAngles.length >= cfg.minToPass) {
            setTimeout(advanceLevel, 600);
          } else {
            sfx.levelFail();
            setTimeout(showLevelFail, 600);
          }
          flyDone = true;
          busy    = false;
        } else {
          flyingY = S - 30;
          flyDone = true;
          busy    = false;
        }
      }
    }
  }

  function advanceLevel() {
    level++;
    sfx.levelUp();
    burst(cx(), cy(), ['#ffd700','#7cfc00','#ff69b4','#00e5ff'], 40);

    overlayMode = 'ADVANCE';
    overlayEmoji.textContent = '🎉';
    overlayTitle.textContent = `Level ${level}!`;
    overlaySub.textContent   = `Speed up! Land ${getLevelCfg(level).minToPass}+ knives to pass`;
    playBtn.textContent      = 'GO! 🚀';
    overlay.classList.remove('hidden');
    throwBtn.classList.add('hidden');

    if (advanceTimeout) clearTimeout(advanceTimeout);
    advanceTimeout = setTimeout(() => {
      if (overlayMode === 'ADVANCE' && !overlay.classList.contains('hidden')) {
        continueToNextLevel();
      }
    }, 1800);
  }

  function showLevelFail() {
    overlayMode = 'FAIL';
    playing = false;
    sfx.stopBg();
    cancelAnimationFrame(raf);
    draw();
    overlayEmoji.textContent = '😢';
    overlayTitle.textContent = 'Level Failed!';
    overlaySub.textContent   = `Needed ${levelCfg.minToPass}, got ${stuckAngles.length}. Score: ${score}`;
    playBtn.textContent      = 'TRY AGAIN! 🎮';
    overlay.classList.remove('hidden');
    throwBtn.classList.add('hidden');
  }

  function showGameOver() {
    overlayMode = 'FAIL';
    playing = false;
    sfx.stopBg();
    sfx.gameOver();
    cancelAnimationFrame(raf);
    draw();
    overlayEmoji.textContent = '💥';
    overlayTitle.textContent = 'CLASH!';
    overlaySub.textContent   = `Knife hit a knife! Score: ${score}  Best: ${best}`;
    playBtn.textContent      = 'PLAY AGAIN! 🎮';
    overlay.classList.remove('hidden');
    throwBtn.classList.add('hidden');
  }

  /* ── Draw frame ─────────────────────────────────────────────────── */
  function draw() {
    C.clearRect(0, 0, W, H);

    // Rainbow flash effect on clash
    drawClashFlash();

    // Screen shake on clash
    if (shakeFrames > 0) {
      const dx = (Math.random() - 0.5) * 9;
      const dy = (Math.random() - 0.5) * 9;
      C.save(); C.translate(dx, dy); shakeFrames--;
    }

    drawBgDots();

    // 1. Draw spinner log wheel first
    drawWheel();

    // 2. Draw stuck knives ON TOP of the log so blades stab into the rim and handles stick out
    stuckAngles.forEach(local => {
      const world = (local + wheelAngle + 360) % 360;
      drawStuckKnife(world);
    });

    // 3. Draw aiming laser & target reticle (shows where & when to throw)
    drawAimingGuide();

    // 4. Draw flying knife
    if (flyingActive || !flyDone) drawFlyingKnife();

    drawParticles();
    drawHUD();

    if (shakeFrames >= 0 && shakeFrames < 22) C.restore?.();
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

    // Time-based speed ramp: wheel spins faster the longer you play a level
    frameCount++;
    if (!waitingForFirstHit) {
      const sign    = wheelSpeed >= 0 ? 1 : -1;
      const cfg     = levelCfg || getLevelCfg(level);
      const maxSpd  = Math.abs(cfg.baseSpeed) * 2.5;  // cap at 2.5× base
      const ramped  = Math.abs(cfg.baseSpeed) + frameCount * SPEED_RAMP * Math.abs(cfg.baseSpeed);
      wheelSpeed    = sign * Math.min(ramped, maxSpd);
    } else {
      wheelSpeed = 0;
    }

    wheelAngle = (wheelAngle + wheelSpeed + 360) % 360;
    updateFlying();
    draw();
    raf = requestAnimationFrame(loop);
  }

  /* ── Start & Continuation Handlers ────────────────────────────────────────── */
  function startGame() {
    if (advanceTimeout) clearTimeout(advanceTimeout);
    overlayMode = 'START';
    fullReset();
    playing       = true;
    gameStartTime = Date.now();
    overlay.classList.add('hidden');
    throwBtn.classList.remove('hidden');
    sfx._init();
    sfx.startBg();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function continueToNextLevel() {
    if (advanceTimeout) clearTimeout(advanceTimeout);
    playing       = true;
    overlay.classList.add('hidden');
    throwBtn.classList.remove('hidden');
    sfx._init();
    sfx.startBg();
    startLevel();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function onPlayBtnClick() {
    if (advanceTimeout) clearTimeout(advanceTimeout);
    if (overlayMode === 'ADVANCE') {
      continueToNextLevel();
    } else {
      startGame();
    }
  }

  /* ── Audio Button Handler ────────────────────────────────────────── */
  const audioBtn  = document.getElementById('audioBtn');
  const audioIcon = document.getElementById('audioIcon');
  if (audioBtn) {
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx.muted = !sfx.muted;
      if (sfx.muted) {
        sfx.stopBg();
        if (audioIcon) audioIcon.textContent = '🔇';
      } else {
        if (playing) sfx.startBg();
        if (audioIcon) audioIcon.textContent = '🔊';
      }
    });
  }

  /* ── Events ─────────────────────────────────────────────────────── */
  throwBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    doThrow();
  });

  canvas.addEventListener('pointerdown', () => {
    if (playing) doThrow();
  });

  playBtn.addEventListener('click', onPlayBtnClick);

  document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (playing) doThrow();
      else onPlayBtnClick();
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
  overlayMode = 'START';
  overlayEmoji.textContent = '🔪';
  overlayTitle.textContent = 'Knife Toss!';
  overlaySub.textContent   = 'Throw knives on the spinning wheel!';
  playBtn.textContent      = 'START! 🎮';
  overlay.classList.remove('hidden');
  throwBtn.classList.add('hidden');
})();
