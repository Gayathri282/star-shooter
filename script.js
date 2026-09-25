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
  { knives: 6,  minToPass: 3, baseSpeed: 1.80, wait1st: false },   // Level 1: Speed starts at Level 8 baseline (1.80)!
  { knives: 6,  minToPass: 4, baseSpeed: 1.95, wait1st: true  },   // Level 2: Fast & dynamic
  { knives: 7,  minToPass: 4, baseSpeed: 2.10, wait1st: false },   // Level 3: Faster
  { knives: 7,  minToPass: 5, baseSpeed: 2.25, wait1st: true  },   // Level 4: Lightning pace
  { knives: 8,  minToPass: 5, baseSpeed: 2.40, wait1st: false },   // Level 5: High speed
  { knives: 8,  minToPass: 6, baseSpeed: 2.55, wait1st: true  },   // Level 6: Ultra fast
  { knives: 9,  minToPass: 6, baseSpeed: 2.70, wait1st: false },   // Level 7: Extreme speed
  { knives: 9,  minToPass: 7, baseSpeed: 2.85, wait1st: true  },   // Level 8: Hyper speed
  { knives: 10, minToPass: 7, baseSpeed: 3.00, wait1st: false },   // Level 9: Master speed
  { knives: 10, minToPass: 8, baseSpeed: 3.20, wait1st: true  },   // Level 10: Insane speed
];
function getLevelCfg(lvl) {
  if (lvl <= LEVELS.length) return LEVELS[lvl - 1];
  const extra = lvl - LEVELS.length;
  return {
    knives: 10 + Math.floor(extra / 2),
    minToPass: 8 + Math.floor(extra / 2),
    baseSpeed: 3.20 + extra * 0.20,
    wait1st: lvl % 2 === 0
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

  /**
   * Sound effect played when gaining points (knife sticking to wheel)
   */
  pointGain(n) {
    this._init();
    // Warm wooden thud + bright double chime on point gain
    this._tone(150, 0.12, 'triangle', 0.26);
    const scale = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51];
    const baseF = scale[Math.min(Math.max(0, n - 1), scale.length - 1)];
    setTimeout(() => this._tone(baseF, 0.18, 'sine', 0.22), 40);
    setTimeout(() => this._tone(baseF * 1.25, 0.18, 'sine', 0.18), 85);
  }

  /**
   * Playful "boing" chord when knife hits another knife on the spinner.
   */
  clash() {
    this._init();
    this._tone(880, 0.45, 'sine', 0.24, 180, 0);
    this._tone(523, 0.30, 'triangle', 0.18, null, 0.04);
    this._tone(659, 0.30, 'triangle', 0.15, null, 0.04);
    this._tone(784, 0.30, 'triangle', 0.12, null, 0.04);
    this._tone(440, 0.50, 'sine', 0.10, 100, 0.12);
    this._tone(1200, 0.18, 'sine', 0.13, 550, 0.32);
  }

  stoneHit() {
    this._init();
    // Heavy crunch sound on hitting rock obstacle
    this._tone(120, 0.35, 'sawtooth', 0.28, 40);
    this._tone(80, 0.40, 'square', 0.22, 30, 0.05);
  }

  bombHit() {
    this._init();
    // Low explosive boom + pitch dive on hitting bomb
    this._tone(300, 0.50, 'sawtooth', 0.35, 30);
    this._tone(150, 0.60, 'square', 0.30, 20, 0.04);
  }

  appleHit() {
    this._init();
    // Crisp slice chime for bonus apple
    this._tone(1200, 0.12, 'sine', 0.22, 1600);
    setTimeout(() => this._tone(1600, 0.15, 'triangle', 0.20), 40);
  }

  levelFail() {
    this._init();
    [392, 349, 311, 262].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.35, 'sawtooth', 0.18), i * 130)
    );
  }

  /**
   * Sound effect on levelling up - triumphant ascending fanfare
   */
  levelUp() {
    this._init();
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._tone(f, 0.32, 'sine', 0.24);
        this._tone(f * 0.5, 0.32, 'triangle', 0.14);
      }, i * 65);
    });
  }

  /**
   * Sound effect on game over - dramatic descending tone sweep
   */
  gameOver() {
    this._init();
    const notes = [587.33, 523.25, 466.16, 392.00, 311.13, 220.00];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._tone(f, 0.38, 'sawtooth', 0.20, f * 0.85);
        this._tone(f * 0.5, 0.40, 'triangle', 0.15);
      }, i * 140);
    });
  }

  /**
   * Engaging background music tone loop (BGM)
   */
  startBg() {
    if (this._bgTimer || this.muted) return;
    this._init();

    const melody = [
      523.25, 659.25, 783.99, 1046.50,
      587.33, 783.99, 880.00, 1174.66,
      659.25, 880.00, 987.77, 1318.51,
      698.46, 880.00, 1046.50, 1396.91
    ];

    const bass = [130.81, 98.00, 110.00, 87.31];

    this._bgStep = 0;
    this._bgTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const step = this._bgStep % 16;
      const bar  = Math.floor(step / 4);

      const noteFreq = melody[step];
      this._tone(noteFreq, 0.16, 'sine', 0.045);

      if (step % 4 === 0 || step % 4 === 2) {
        this._tone(bass[bar], 0.24, 'triangle', 0.055);
      }

      if (step % 4 === 3) {
        this._tone(noteFreq * 1.5, 0.09, 'sine', 0.022);
      }

      this._bgStep++;
    }, 120);
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

  const sfx = new Sound();

  /* ── Constants ──────────────────────────────────────────────────── */
  const SAFE_GAP_DEG  = 14;   // minimum angle gap between knives (degrees)
  const KNIFE_LEN     = 40;
  const KNIFE_BLADE   = 28;
  const KNIFE_W       = 7;
  // Speed ramp: wheel speeds up gradually within a level (fraction per frame)
  const SPEED_RAMP    = 0.00005;

  /* ── State ──────────────────────────────────────────────────────── */
  let score, level, best, stuckAngles, wheelAngle, wheelSpeed;
  let obstacles         = [];     // pre-placed obstacles (stone, bomb, shield, apple)
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
  let gameStartTime     = 0;      // tracks when game started
  let levelStartTime    = 0;      // tracks when level started for 3s hint
  let waitingForFirstHit= false;  // when true, wheel waits for 1st knife hit to start spinning
  let overlayMode       = 'START';// 'START', 'ADVANCE', or 'FAIL'
  let advanceTimeout    = null;   // timer for level advance transition
  let levelPending      = false;  // prevents duplicate level advance triggers
  let levelPendingTimeout = null; // timeout reference for level completion

  /* ── Obstacle Generator ─────────────────────────────────────────── */
  function generateObstacles(lvl) {
    const list = [];
    // Number of obstacles scaling with level (1 for L1, 2 for L2, up to 4 for L5+)
    let count = Math.min(1 + Math.floor((lvl - 1) / 1.5), 4);
    const types = ['stone', 'bomb', 'shield'];
    
    const safeGap = 34; // minimum degrees between obstacles
    let attempts = 0;
    
    while (list.length < count && attempts < 100) {
      attempts++;
      const angle = Math.floor(Math.random() * 360);
      
      // Avoid placing initial obstacles right at bottom 6 o'clock (90deg)
      let distFromBottom = Math.abs(angle - 90) % 360;
      if (distFromBottom > 180) distFromBottom = 360 - distFromBottom;
      if (distFromBottom < 35) continue;

      const tooClose = list.some(ob => {
        let d = Math.abs(ob.angle - angle) % 360;
        if (d > 180) d = 360 - d;
        return d < safeGap;
      });

      if (!tooClose) {
        const type = types[list.length % types.length];
        list.push({ angle, type });
      }
    }

    // Bonus sliceable apple target (+2 points bonus)
    if (lvl >= 2 && Math.random() > 0.25) {
      let appleAttempts = 0;
      while (appleAttempts < 40) {
        appleAttempts++;
        const angle = Math.floor(Math.random() * 360);
        const tooClose = list.some(ob => {
          let d = Math.abs(ob.angle - angle) % 360;
          if (d > 180) d = 360 - d;
          return d < 24;
        });
        if (!tooClose) {
          list.push({ angle, type: 'apple' });
          break;
        }
      }
    }

    return list;
  }

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
    if (advanceTimeout) { clearTimeout(advanceTimeout); advanceTimeout = null; }
    if (levelPendingTimeout) { clearTimeout(levelPendingTimeout); levelPendingTimeout = null; }
    levelPending = false;
    levelCfg     = getLevelCfg(level);
    stuckAngles  = [];
    obstacles    = generateObstacles(level);
    wheelAngle   = 0;
    flyingActive = false;
    flyDone      = true;
    busy         = false;
    flyingY      = H - 85;
    frameCount   = 0;
    knivesLeft   = levelCfg.knives;
    levelStartTime = Date.now();

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
    obstacles   = [];
    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    startLevel();
  }

  /* ── Spinner Color Themes (Target Spinner) ────────────────────────── */
  const SPINNER_THEMES = [
    { rings: ['#dc2626', '#ffffff', '#ef4444', '#ffffff', '#dc2626'], bullseye: '#991b1b', border: '#7f1d1d' }, // L1: Red & White Target
    { rings: ['#0284c7', '#ffffff', '#0ea5e9', '#ffffff', '#0284c7'], bullseye: '#075985', border: '#0c4a6e' }, // L2: Electric Blue & White
    { rings: ['#059669', '#ffffff', '#10b981', '#ffffff', '#059669'], bullseye: '#065f46', border: '#064e3b' }, // L3: Emerald Green & White
    { rings: ['#d97706', '#ffffff', '#f59e0b', '#ffffff', '#d97706'], bullseye: '#92400e', border: '#78350f' }, // L4: Golden Amber & White
    { rings: ['#7c3aed', '#ffffff', '#8b5cf6', '#ffffff', '#7c3aed'], bullseye: '#5b21b6', border: '#4c1d95' }, // L5: Royal Purple & White
    { rings: ['#db2777', '#ffffff', '#ec4899', '#ffffff', '#db2777'], bullseye: '#9d174d', border: '#831843' }, // L6: Neon Pink & White
  ];

  function getSpinnerTheme(lvl) {
    return SPINNER_THEMES[(lvl - 1) % SPINNER_THEMES.length];
  }

  /* ── Drawing helpers ────────────────────────────────────────────── */
  function drawWheel() {
    const r     = wheelR();
    const x     = cx(), y = cy();
    const theme = getSpinnerTheme(level);

    C.save();
    C.translate(x, y);

    // Outer glow shadow
    C.shadowColor   = theme.rings[0];
    C.shadowBlur    = 20;

    // Base container fill
    C.beginPath();
    C.arc(0, 0, r + 3, 0, Math.PI * 2);
    C.fillStyle = theme.border;
    C.fill();
    C.shadowBlur = 0;

    // Rotate contents for spinning effect
    C.rotate(wheelAngle * Math.PI / 180);

    // ── Concentric Target Rings (Outer -> Inner) ──
    const ringScales = [1.0, 0.78, 0.56, 0.35, 0.18];
    const ringColors = theme.rings;

    ringScales.forEach((s, i) => {
      C.beginPath();
      C.arc(0, 0, r * s, 0, Math.PI * 2);
      C.fillStyle = ringColors[i % ringColors.length];
      C.fill();
      C.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      C.lineWidth   = 1.5;
      C.stroke();
    });

    // ── Radial Target Wedges (subtle sectors for motion feedback) ──
    C.save();
    C.globalAlpha = 0.07;
    for (let a = 0; a < 360; a += 45) {
      C.beginPath();
      C.moveTo(0, 0);
      C.arc(0, 0, r, (a * Math.PI) / 180, ((a + 22.5) * Math.PI) / 180);
      C.closePath();
      C.fillStyle = '#000000';
      C.fill();
    }
    C.restore();

    // ── Center Bullseye & Gold Point Dot ──
    C.beginPath();
    C.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    C.fillStyle = theme.bullseye;
    C.fill();

    C.beginPath();
    C.arc(0, 0, r * 0.07, 0, Math.PI * 2);
    C.fillStyle = '#f59e0b'; // Gold center point
    C.fill();
    C.strokeStyle = '#ffffff';
    C.lineWidth   = 2;
    C.stroke();

    // ── Outer Rim Border & Metallic Studs ──
    C.beginPath();
    C.arc(0, 0, r, 0, Math.PI * 2);
    C.strokeStyle = theme.border;
    C.lineWidth   = 4;
    C.stroke();

    // Small brass rim studs around the edge
    for (let a = 0; a < 360; a += 30) {
      const rad = (a * Math.PI) / 180;
      const sx  = Math.cos(rad) * (r - 4);
      const sy  = Math.sin(rad) * (r - 4);
      C.beginPath();
      C.arc(sx, sy, 2.5, 0, Math.PI * 2);
      C.fillStyle = '#ffffff';
      C.fill();
    }

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

  // Draw obstacles (stone, bomb, shield, apple) pre-placed on spinner wheel rim
  function drawObstacles() {
    const r = wheelR();
    obstacles.forEach(ob => {
      const worldDeg = (ob.angle + wheelAngle + 360) % 360;
      const rad = worldDeg * Math.PI / 180;
      const tx = cx() + Math.cos(rad) * r;
      const ty = cy() + Math.sin(rad) * r;

      C.save();
      C.translate(tx, ty);
      C.rotate(rad + Math.PI / 2); // orient outwards

      if (ob.type === 'stone') {
        // 🪨 Rugged Stone Rock Obstacle
        C.shadowColor = 'rgba(0, 0, 0, 0.5)';
        C.shadowBlur = 6;

        C.beginPath();
        C.moveTo(-12, -8);
        C.lineTo(-6, -16);
        C.lineTo(8, -14);
        C.lineTo(14, -6);
        C.lineTo(10, 8);
        C.lineTo(-8, 10);
        C.closePath();

        const sg = C.createLinearGradient(-12, -16, 14, 10);
        sg.addColorStop(0, '#94a3b8');
        sg.addColorStop(0.5, '#64748b');
        sg.addColorStop(1, '#334155');
        C.fillStyle = sg;
        C.fill();
        C.strokeStyle = '#1e293b';
        C.lineWidth = 2;
        C.stroke();

        C.beginPath();
        C.moveTo(-4, -10); C.lineTo(2, -2); C.lineTo(-2, 4);
        C.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        C.lineWidth = 1.5;
        C.stroke();

      } else if (ob.type === 'bomb') {
        // 💣 Naval Danger Bomb
        C.shadowColor = 'rgba(239, 68, 68, 0.7)';
        C.shadowBlur = 10;

        C.beginPath();
        C.arc(0, 0, 13, 0, Math.PI * 2);
        const bg = C.createRadialGradient(-3, -3, 2, 0, 0, 13);
        bg.addColorStop(0, '#475569');
        bg.addColorStop(0.7, '#0f172a');
        bg.addColorStop(1, '#000000');
        C.fillStyle = bg;
        C.fill();
        C.strokeStyle = '#ef4444';
        C.lineWidth = 2;
        C.stroke();

        C.fillStyle = '#ef4444';
        C.font = '10px Fredoka One, sans-serif';
        C.textAlign = 'center';
        C.fillText('💀', 0, 4);

        const sparkY = -15 + Math.sin(frameCount * 0.3) * 2;
        C.beginPath();
        C.arc(0, sparkY, 3, 0, Math.PI * 2);
        C.fillStyle = frameCount % 6 < 3 ? '#ffe066' : '#ff4e4e';
        C.fill();

      } else if (ob.type === 'shield') {
        // 🛡️ Iron Shield
        C.shadowColor = 'rgba(148, 163, 184, 0.5)';
        C.shadowBlur = 8;

        C.beginPath();
        C.moveTo(0, -14);
        C.lineTo(12, -8);
        C.lineTo(10, 8);
        C.lineTo(0, 15);
        C.lineTo(-10, 8);
        C.lineTo(-12, -8);
        C.closePath();

        const shg = C.createLinearGradient(-12, -14, 12, 15);
        shg.addColorStop(0, '#e2e8f0');
        shg.addColorStop(0.5, '#94a3b8');
        shg.addColorStop(1, '#475569');
        C.fillStyle = shg;
        C.fill();
        C.strokeStyle = '#1e293b';
        C.lineWidth = 2;
        C.stroke();

        [-5, 5].forEach(rx => {
          C.beginPath();
          C.arc(rx, -4, 1.5, 0, Math.PI * 2);
          C.fillStyle = '#ffffff';
          C.fill();
        });

      } else if (ob.type === 'apple') {
        // 🍎 Sliceable Bonus Apple
        const pulse = Math.sin(frameCount * 0.1) * 1.5;
        C.shadowColor = 'rgba(239, 68, 68, 0.7)';
        C.shadowBlur = 8 + pulse;

        C.beginPath();
        C.arc(0, 2, 11, 0, Math.PI * 2);
        const ag = C.createRadialGradient(-3, -2, 2, 0, 2, 11);
        ag.addColorStop(0, '#f87171');
        ag.addColorStop(0.7, '#dc2626');
        ag.addColorStop(1, '#991b1b');
        C.fillStyle = ag;
        C.fill();

        C.beginPath();
        C.ellipse(3, -9, 4, 2, Math.PI / 4, 0, Math.PI * 2);
        C.fillStyle = '#22c55e';
        C.fill();

        C.beginPath();
        C.moveTo(0, -6);
        C.lineTo(-1, -11);
        C.strokeStyle = '#78350f';
        C.lineWidth = 2;
        C.stroke();
      }

      C.restore();
    });
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

    // Check if bottom 90deg hit zone is currently safe or blocked by a stuck knife or obstacle
    const isBlocked = stuckAngles.some(local => {
      const world = (local + wheelAngle + 360) % 360;
      let d = Math.abs(world - 90) % 360;
      if (d > 180) d = 360 - d;
      return d < SAFE_GAP_DEG + 2;
    }) || obstacles.some(ob => {
      if (ob.type === 'apple') return false;
      const world = (ob.angle + wheelAngle + 360) % 360;
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

    C.restore();
  }

  // The resting knife at launch position waiting to be thrown
  function drawReadyKnife() {
    if (!playing || flyingActive || knivesLeft <= 0) return;
    C.save();
    C.translate(cx(), H - 85);
    const pulse = Math.sin(frameCount * 0.1) * 3;
    C.shadowColor = 'rgba(232, 67, 147, 0.7)';
    C.shadowBlur = 10 + pulse;
    _knife(C, KNIFE_LEN, KNIFE_BLADE, KNIFE_W, true);
    C.restore();
  }

  // "Touch the knife to throw!" hint prompt (shows for 3 seconds then disappears)
  function drawTouchHint() {
    if (!playing || knivesLeft <= 0) return;
    const elapsed = Date.now() - levelStartTime;
    if (elapsed >= 3000) return; // Disappears completely after 3 seconds

    let opacity = 1;
    if (elapsed > 2000) {
      opacity = (3000 - elapsed) / 1000;
    }

    C.save();
    C.globalAlpha = Math.max(0, opacity);

    const bounce = Math.sin(frameCount * 0.12) * 3;
    const textY  = H - 145 + bounce;

    C.font = `900 ${Math.round(Math.min(S * 0.038, 16))}px Fredoka One, Nunito, sans-serif`;
    C.textAlign = 'center';

    const text = '👆 Touch the knife to throw!';
    const textWidth = C.measureText(text).width;

    C.fillStyle = 'rgba(255, 255, 255, 0.95)';
    C.shadowColor = 'rgba(232, 67, 147, 0.4)';
    C.shadowBlur = 10;

    C.beginPath();
    C.roundRect(cx() - textWidth / 2 - 14, textY - 18, textWidth + 28, 30, 15);
    C.fill();

    C.fillStyle = '#e84393';
    C.shadowBlur = 0;
    C.fillText(text, cx(), textY + 4);

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
    if (!playing || busy || !flyDone || levelPending) return;
    if (knivesLeft <= 0) return;
    busy         = true;
    flyDone      = false;
    flyingActive = true;
    flyingY      = H - 85;
    knivesLeft--;
    sfx.throw();
  }

  function updateFlying() {
    if (!flyingActive) return;
    flyingY -= Math.max(28, H * 0.055);

    const r    = wheelR();
    const dist = Math.abs(flyingY - cy());

    // Knife must reach the CIRCUMFERENCE of the wheel
    if (dist <= r + 4) {
      flyingActive = false;

      const hitWorld = 90;  // bottom 6 o'clock hit position in canvas coordinates
      const localHit = ((hitWorld - wheelAngle) % 360 + 360) % 360;

      // 1. Check for collision with pre-placed obstacles (stone, bomb, shield, apple)
      const obIdx = obstacles.findIndex(ob => {
        let d = Math.abs(ob.angle - localHit) % 360;
        if (d > 180) d = 360 - d;
        return d < (ob.type === 'apple' ? 18 : SAFE_GAP_DEG + 3);
      });

      if (obIdx !== -1) {
        const hitOb = obstacles[obIdx];
        if (hitOb.type === 'apple') {
          // 🍎 Sliced bonus apple!
          sfx.appleHit();
          score += 2;
          scoreEl.textContent = score;
          if (score > best) { best = score; bestEl.textContent = best; }

          const rad = (hitOb.angle + wheelAngle) * Math.PI / 180;
          burst(cx() + Math.cos(rad) * r, cy() + Math.sin(rad) * r, ['#ef4444', '#f87171', '#22c55e', '#ffe066'], 22);
          obstacles.splice(obIdx, 1);

          // Knife stabs into wheel at localHit
          stuckAngles.push(localHit);
          sfx.pointGain(stuckAngles.length);
          burst(cx(), cy() + r, ['#ffd700','#ff69b4','#00e5ff'], 12);

          const cfg     = getLevelCfg(level);
          const allDone = stuckAngles.length >= cfg.knives;
          const noLeft  = knivesLeft <= 0;

          if (allDone || noLeft) {
            levelPending = true;
            busy = true;
            if (levelPendingTimeout) clearTimeout(levelPendingTimeout);
            levelPendingTimeout = setTimeout(() => {
              levelPendingTimeout = null;
              stuckAngles.length >= cfg.minToPass ? advanceLevel() : showLevelFail();
            }, 600);
            flyDone = true;
          } else {
            flyingY = S - 30;
            flyDone = true;
            busy    = false;
          }
          return;
        } else {
          // 🪨 💣 🛡️ Hit a dangerous obstacle! GAME OVER!
          shakeFrames  = 26;
          clashFlash   = 35;
          levelPending = true;
          busy         = true;

          const rad  = (hitOb.angle + wheelAngle) * Math.PI / 180;
          const hitX = cx() + Math.cos(rad) * r;
          const hitY = cy() + Math.sin(rad) * r;

          if (hitOb.type === 'bomb') {
            sfx.bombHit();
            burst(hitX, hitY, ['#ef4444', '#f97316', '#eab308', '#000000'], 35);
          } else {
            sfx.stoneHit();
            burst(hitX, hitY, ['#94a3b8', '#64748b', '#334155', '#ffe066'], 28);
          }

          if (levelPendingTimeout) clearTimeout(levelPendingTimeout);
          levelPendingTimeout = setTimeout(() => {
            levelPendingTimeout = null;
            showObstacleGameOver(hitOb.type);
          }, 700);
          flyDone = true;
          return;
        }
      }

      // 2. Check for clash with any knife already on the circumference
      const clashIdx = stuckAngles.findIndex(a => {
        let d = Math.abs(a - localHit) % 360;
        if (d > 180) d = 360 - d;
        return d < SAFE_GAP_DEG;
      });

      if (clashIdx !== -1) {
        // ── Hit another knife! ──────────────────────────────────────
        shakeFrames = 22;
        clashFlash  = 30;  // trigger rainbow flash
        levelPending = true;
        busy = true;

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
        if (levelPendingTimeout) clearTimeout(levelPendingTimeout);
        levelPendingTimeout = setTimeout(() => {
          levelPendingTimeout = null;
          qualified ? advanceLevel() : showGameOver();
        }, 700);
        flyDone = true;

      } else {
        // ── Knife sticks to circumference! ──────────────────────────
        stuckAngles.push(localHit);
        score++;
        scoreEl.textContent = score;
        if (score > best) { best = score; bestEl.textContent = best; }

        sfx.pointGain(stuckAngles.length);
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
          levelPending = true;
          busy = true;
          // No more knives available — evaluate result
          if (levelPendingTimeout) clearTimeout(levelPendingTimeout);
          levelPendingTimeout = setTimeout(() => {
            levelPendingTimeout = null;
            if (stuckAngles.length >= cfg.minToPass) {
              advanceLevel();
            } else {
              sfx.levelFail();
              showLevelFail();
            }
          }, 600);
          flyDone = true;
        } else {
          flyingY = S - 30;
          flyDone = true;
          busy    = false;
        }
      }
    }
  }

  function advanceLevel() {
    if (overlayMode === 'ADVANCE' && !overlay.classList.contains('hidden')) return;
    if (levelPendingTimeout) { clearTimeout(levelPendingTimeout); levelPendingTimeout = null; }
    levelPending = false;
    busy = false;

    level++;
    // Pause the game state and stop background music while closing / overlay screen is shown
    playing = false;
    sfx.stopBg();
    if (raf) { cancelAnimationFrame(raf); raf = null; }

    sfx.levelUp();
    burst(cx(), cy(), ['#ffd700','#7cfc00','#ff69b4','#00e5ff'], 40);

    overlayMode = 'ADVANCE';
    overlayEmoji.textContent = '🎉';
    overlayTitle.textContent = `Level ${level}!`;
    overlaySub.textContent   = `Speed up! Land ${getLevelCfg(level).minToPass}+ knives to pass`;
    playBtn.textContent      = 'GO! 🚀';
    overlay.classList.remove('hidden');

    if (advanceTimeout) clearTimeout(advanceTimeout);
    advanceTimeout = setTimeout(() => {
      if (overlayMode === 'ADVANCE' && !overlay.classList.contains('hidden')) {
        continueToNextLevel();
      }
    }, 1000);
  }

  function showLevelFail() {
    overlayMode = 'FAIL';
    playing = false;
    sfx.stopBg();
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    sfx.levelFail();
    draw();
    overlayEmoji.textContent = '😢';
    overlayTitle.textContent = 'Level Failed!';
    overlaySub.textContent   = `Needed ${levelCfg.minToPass}, got ${stuckAngles.length}. Score: ${score}`;
    playBtn.textContent      = 'TRY AGAIN! 🎮';
    overlay.classList.remove('hidden');
  }

  function showObstacleGameOver(type) {
    overlayMode = 'FAIL';
    playing = false;
    sfx.stopBg();
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    sfx.gameOver();
    draw();
    if (type === 'bomb') {
      overlayEmoji.textContent = '💣';
      overlayTitle.textContent = 'BOOM!';
      overlaySub.textContent   = `You hit a Bomb! Score: ${score}  Best: ${best}`;
    } else if (type === 'shield') {
      overlayEmoji.textContent = '🛡️';
      overlayTitle.textContent = 'DEFLECTED!';
      overlaySub.textContent   = `Knife bounced off Iron Shield! Score: ${score}  Best: ${best}`;
    } else {
      overlayEmoji.textContent = '🪨';
      overlayTitle.textContent = 'CRASH!';
      overlaySub.textContent   = `You hit a Stone Obstacle! Score: ${score}  Best: ${best}`;
    }
    playBtn.textContent      = 'PLAY AGAIN! 🎮';
    overlay.classList.remove('hidden');
  }

  function showGameOver() {
    overlayMode = 'FAIL';
    playing = false;
    sfx.stopBg();
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    sfx.gameOver();
    draw();
    overlayEmoji.textContent = '💥';
    overlayTitle.textContent = 'CLASH!';
    overlaySub.textContent   = `Knife hit a knife! Score: ${score}  Best: ${best}`;
    playBtn.textContent      = 'PLAY AGAIN! 🎮';
    overlay.classList.remove('hidden');
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

    // 2. Draw obstacles on the spinner wheel
    drawObstacles();

    // 3. Draw stuck knives ON TOP of the log so blades stab into the rim and handles stick out
    stuckAngles.forEach(local => {
      const world = (local + wheelAngle + 360) % 360;
      drawStuckKnife(world);
    });

    // 3. Draw aiming laser & target reticle (shows where to aim)
    drawAimingGuide();

    // 4. Draw ready knife at bottom launch position & flying knife
    if (!flyingActive && flyDone && knivesLeft > 0) {
      drawReadyKnife();
    }
    if (flyingActive || !flyDone) {
      drawFlyingKnife();
    }

    // 5. Draw 3-second touch prompt
    drawTouchHint();

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
      const maxSpd  = Math.abs(cfg.baseSpeed) * 1.5;  // cap at 1.5× base
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
    playing        = true;
    gameStartTime  = Date.now();
    levelStartTime = Date.now();
    overlay.classList.add('hidden');
    sfx._init();
    sfx.startBg();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function continueToNextLevel() {
    if (advanceTimeout) { clearTimeout(advanceTimeout); advanceTimeout = null; }
    if (levelPendingTimeout) { clearTimeout(levelPendingTimeout); levelPendingTimeout = null; }
    levelPending   = false;
    busy           = false;
    playing        = true;
    levelStartTime = Date.now();
    overlay.classList.add('hidden');
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
    } else if (overlayMode === 'PAUSE') {
      playing        = true;
      levelStartTime = Date.now();
      overlay.classList.add('hidden');
      sfx._init();
      sfx.startBg();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    } else {
      startGame();
    }
  }

  /* ── Tab Visibility Pause Handler ──────────────────────────────────── */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing) {
      playing = false;
      sfx.stopBg();
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      overlayMode = 'PAUSE';
      overlayEmoji.textContent = '⏸️';
      overlayTitle.textContent = 'Game Paused';
      overlaySub.textContent   = 'Tap play to continue!';
      playBtn.textContent      = 'RESUME ▶️';
      overlay.classList.remove('hidden');
    }
  });

  /* ── Events ─────────────────────────────────────────────────────── */
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
})();
