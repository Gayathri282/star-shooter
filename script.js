/**
 * Knife Toss! – Hyper-Casual Canvas Game
 * Playfield-First Minimal UI with Always-Enabled Mobile Audio Context
 * Robust Collision Animation & Crash Prevention
 */

/* ─── Level Config ─────────────────────────────────────────────────── */
const LEVELS = [
  { knives: 6,  minToPass: 3, baseSpeed: 0.85, wait1st: false },   // Level 1
  { knives: 6,  minToPass: 4, baseSpeed: 1.00, wait1st: true  },   // Level 2
  { knives: 7,  minToPass: 4, baseSpeed: 1.15, wait1st: false },   // Level 3
  { knives: 7,  minToPass: 5, baseSpeed: 1.30, wait1st: true  },   // Level 4
  { knives: 8,  minToPass: 5, baseSpeed: 1.45, wait1st: false },   // Level 5
  { knives: 8,  minToPass: 6, baseSpeed: 1.60, wait1st: true  },   // Level 6
  { knives: 9,  minToPass: 6, baseSpeed: 1.75, wait1st: false },   // Level 7
  { knives: 9,  minToPass: 7, baseSpeed: 1.90, wait1st: true  },   // Level 8: Obstacles start
  { knives: 10, minToPass: 7, baseSpeed: 2.05, wait1st: false },   // Level 9
  { knives: 10, minToPass: 8, baseSpeed: 2.20, wait1st: true  },   // Level 10
];

function getLevelCfg(lvl) {
  if (lvl <= LEVELS.length) return LEVELS[lvl - 1];
  const extra = lvl - LEVELS.length;
  return {
    knives: 10 + Math.floor(extra / 2),
    minToPass: 8 + Math.floor(extra / 2),
    baseSpeed: 2.20 + extra * 0.15,
    wait1st: lvl % 2 === 0
  };
}

/* ─── Always-Enabled Sound Engine ───────────────────────────────────── */
class Sound {
  constructor() {
    this.ctx      = null;
    this._bgTimer = null;
    this._bgStep  = 0;
  }

  _init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _tone(freq, dur, type = 'sine', vol = 0.15, endFreq = null, delay = 0) {
    this._init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      const now = this.ctx.currentTime + delay;
      osc.type  = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    } catch (_) {}
  }

  throw() {
    this._tone(900, 0.10, 'sawtooth', 0.16, 300);
  }

  pointGain(n) {
    this._tone(150, 0.12, 'triangle', 0.26);
    const scale = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51];
    const baseF = scale[Math.min(Math.max(0, n - 1), scale.length - 1)];
    setTimeout(() => this._tone(baseF, 0.18, 'sine', 0.22), 40);
    setTimeout(() => this._tone(baseF * 1.25, 0.18, 'sine', 0.18), 85);
  }

  clash() {
    this._tone(880, 0.45, 'sine', 0.24, 180, 0);
    this._tone(523, 0.30, 'triangle', 0.18, null, 0.04);
    this._tone(659, 0.30, 'triangle', 0.15, null, 0.04);
    this._tone(784, 0.30, 'triangle', 0.12, null, 0.04);
    this._tone(440, 0.50, 'sine', 0.10, 100, 0.12);
    this._tone(1200, 0.18, 'sine', 0.13, 550, 0.32);
  }

  stoneHit() {
    this._tone(120, 0.35, 'sawtooth', 0.28, 40);
    this._tone(80, 0.40, 'square', 0.22, 30, 0.05);
  }

  bombHit() {
    this._tone(300, 0.50, 'sawtooth', 0.35, 30);
    this._tone(150, 0.60, 'square', 0.30, 20, 0.04);
  }

  appleHit() {
    this._tone(1200, 0.12, 'sine', 0.22, 1600);
    setTimeout(() => this._tone(1600, 0.15, 'triangle', 0.20), 40);
  }

  levelFail() {
    [392, 349, 311, 262].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.35, 'sawtooth', 0.18), i * 130)
    );
  }

  levelUp() {
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._tone(f, 0.32, 'sine', 0.24);
        this._tone(f * 0.5, 0.32, 'triangle', 0.14);
      }, i * 65);
    });
  }

  gameOver() {
    const notes = [587.33, 523.25, 466.16, 392.00, 311.13, 220.00];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._tone(f, 0.38, 'sawtooth', 0.20, f * 0.85);
        this._tone(f * 0.5, 0.40, 'triangle', 0.15);
      }, i * 140);
    });
  }

  startBg() {
    if (this._bgTimer) return;
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
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
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

/* ─── Game Loop & Logic ─────────────────────────────────────────────── */
(() => {
  /* DOM Elements */
  const canvas        = document.getElementById('arena');
  const C             = canvas.getContext('2d');
  const scoreEl       = document.getElementById('score');
  const levelEl       = document.getElementById('level');
  const bestEl        = document.getElementById('best');
  const helpBtn       = document.getElementById('helpBtn');
  const helpModal     = document.getElementById('helpModal');
  const closeHelpBtn  = document.getElementById('closeHelpBtn');
  const gameOverModal = document.getElementById('gameOverModal');
  const gameOverEmoji = document.getElementById('gameOverEmoji');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const gameOverSub   = document.getElementById('gameOverSub');
  const finalScore    = document.getElementById('finalScore');
  const finalBest     = document.getElementById('finalBest');
  const retryBtn      = document.getElementById('retryBtn');

  const sfx = new Sound();

  /* ── Constants ──────────────────────────────────────────────────── */
  const SAFE_GAP_DEG  = 14;   // min angle gap between knives (deg)
  const KNIFE_LEN     = 40;
  const KNIFE_BLADE   = 28;
  const KNIFE_W       = 7;
  const SPEED_RAMP    = 0.00005;

  /* ── State ──────────────────────────────────────────────────────── */
  let score, level, best, stuckAngles, wheelAngle, wheelSpeed;
  let obstacles           = [];
  let flyingY, flyingActive, flyDone, busy;
  let playing             = true;
  let raf                 = null;
  let S = 0, W = 0, H = 0, dpr = 1;
  let knivesLeft          = 0;
  let levelCfg            = null;
  let frameCount          = 0;
  let clashFlash          = 0;
  let particles           = [];
  let notifications       = [];
  let shakeFrames         = 0;
  let gameStartTime       = 0;
  let levelStartTime      = 0;
  let waitingForFirstHit  = false;
  let levelPending        = false;
  let levelPendingTimeout = null;

  /* ── Obstacle Generator ─────────────────────────────────────────── */
  function generateObstacles(lvl) {
    const list = [];
    if (lvl < 8) {
      if (lvl >= 3 && Math.random() > 0.35) {
        let appleAttempts = 0;
        while (appleAttempts < 40) {
          appleAttempts++;
          const angle = Math.floor(Math.random() * 360);
          let distFromBottom = Math.abs(angle - 90) % 360;
          if (distFromBottom > 180) distFromBottom = 360 - distFromBottom;
          if (distFromBottom < 30) continue;
          list.push({ angle, type: 'apple' });
          break;
        }
      }
      return list;
    }

    const count = Math.min(lvl - 7, 3);
    const types = ['stone', 'bomb', 'shield'];
    const safeGap = 36;
    let attempts = 0;

    while (list.length < count && attempts < 100) {
      attempts++;
      const angle = Math.floor(Math.random() * 360);
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

    if (Math.random() > 0.3) {
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

  function wheelR() { return Math.min(W * 0.34, H * 0.23, 140); }
  function cx()     { return W / 2; }
  function cy()     { return H * 0.36; }

  /* ── Level init ─────────────────────────────────────────────────── */
  function startLevel() {
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
    if (levelPendingTimeout) { clearTimeout(levelPendingTimeout); levelPendingTimeout = null; }
    levelPending = false;
    busy        = false;
    score       = 0;
    level       = 1;
    particles   = [];
    notifications = [];
    shakeFrames = 0;
    clashFlash  = 0;
    obstacles   = [];
    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    startLevel();
  }

  /* ── Spinner Color Themes ────────────────────────────────────────── */
  const SPINNER_THEMES = [
    { rings: ['#dc2626', '#ffffff', '#ef4444', '#ffffff', '#dc2626'], bullseye: '#991b1b', border: '#7f1d1d' },
    { rings: ['#0284c7', '#ffffff', '#0ea5e9', '#ffffff', '#0284c7'], bullseye: '#075985', border: '#0c4a6e' },
    { rings: ['#059669', '#ffffff', '#10b981', '#ffffff', '#059669'], bullseye: '#065f46', border: '#064e3b' },
    { rings: ['#d97706', '#ffffff', '#f59e0b', '#ffffff', '#d97706'], bullseye: '#92400e', border: '#78350f' },
    { rings: ['#7c3aed', '#ffffff', '#8b5cf6', '#ffffff', '#7c3aed'], bullseye: '#5b21b6', border: '#4c1d95' },
    { rings: ['#db2777', '#ffffff', '#ec4899', '#ffffff', '#db2777'], bullseye: '#9d174d', border: '#831843' },
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

    C.shadowColor = theme.rings[0];
    C.shadowBlur  = 20;

    C.beginPath();
    C.arc(0, 0, r + 3, 0, Math.PI * 2);
    C.fillStyle = theme.border;
    C.fill();
    C.shadowBlur = 0;

    C.rotate(wheelAngle * Math.PI / 180);

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

    C.beginPath();
    C.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    C.fillStyle = theme.bullseye;
    C.fill();

    C.beginPath();
    C.arc(0, 0, r * 0.07, 0, Math.PI * 2);
    C.fillStyle = '#f59e0b';
    C.fill();
    C.strokeStyle = '#ffffff';
    C.lineWidth   = 2;
    C.stroke();

    C.beginPath();
    C.arc(0, 0, r, 0, Math.PI * 2);
    C.strokeStyle = theme.border;
    C.lineWidth   = 4;
    C.stroke();

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

  function _knife(C, len, bladeLen, w) {
    const handleLen = len - bladeLen;

    C.beginPath();
    C.moveTo(0, -bladeLen);
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

    C.beginPath();
    C.moveTo(w * 0.05, -bladeLen + 4);
    C.lineTo(w * 0.35, -4);
    C.strokeStyle = 'rgba(255,255,255,0.65)';
    C.lineWidth   = 1.5;
    C.stroke();

    C.fillStyle = '#9ab0c8';
    C.beginPath();
    C.roundRect(-w * 0.75, -2, w * 1.5, 5, 2);
    C.fill();

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

    C.strokeStyle = 'rgba(0,0,0,0.2)';
    C.lineWidth   = 1;
    for (let g = 6; g < handleLen - 3; g += 5) {
      C.beginPath();
      C.moveTo(-w * 0.55, 2 + g);
      C.lineTo( w * 0.55, 2 + g);
      C.stroke();
    }
  }

  function drawStuckKnife(worldDeg) {
    const r   = wheelR();
    const rad = worldDeg * Math.PI / 180;
    const tx  = cx() + Math.cos(rad) * r;
    const ty  = cy() + Math.sin(rad) * r;

    C.save();
    C.translate(tx, ty);
    C.rotate(rad - Math.PI / 2);

    C.strokeStyle = '#8b4513';
    C.lineWidth = 1.5;
    C.beginPath();
    C.moveTo(-5, -2); C.lineTo(-9, -7);
    C.moveTo(5, -2);  C.lineTo(9, -7);
    C.stroke();

    C.shadowColor = 'rgba(0,0,0,0.25)';
    C.shadowBlur = 4;
    C.shadowOffsetY = 3;

    _knife(C, KNIFE_LEN, KNIFE_BLADE, KNIFE_W);
    C.restore();
  }

  function drawObstacles() {
    const r = wheelR();
    obstacles.forEach(ob => {
      const worldDeg = (ob.angle + wheelAngle + 360) % 360;
      const rad = worldDeg * Math.PI / 180;
      const tx = cx() + Math.cos(rad) * r;
      const ty = cy() + Math.sin(rad) * r;

      C.save();
      C.translate(tx, ty);
      C.rotate(rad + Math.PI / 2);

      if (ob.type === 'stone') {
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

  function drawAimingGuide() {
    if (!playing || flyingActive) return;
    const elapsed = Date.now() - gameStartTime;
    if (elapsed > 8000) return;

    let opacity = 1;
    if (elapsed > 6000) {
      opacity = (8000 - elapsed) / 2000;
    }

    const r       = wheelR();
    const targetY = cy() + r;
    const startY  = H - 75;

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
    C.globalAlpha = Math.max(0, opacity * 0.7);

    C.beginPath();
    C.setLineDash([5, 5]);
    C.lineDashOffset = -frameCount * 1.5;
    C.moveTo(cx(), startY);
    C.lineTo(cx(), targetY);
    C.strokeStyle = guideColor;
    C.lineWidth   = 1.5;
    C.stroke();
    C.setLineDash([]);

    const pulse = Math.sin(frameCount * 0.15) * 1.5;
    C.beginPath();
    C.arc(cx(), targetY, 10 + pulse, 0, Math.PI * 2);
    C.strokeStyle = guideColor;
    C.lineWidth   = 2;
    C.stroke();

    C.restore();
  }

  function drawReadyKnife() {
    if (!playing || flyingActive || knivesLeft <= 0) return;
    C.save();
    C.translate(cx(), H - 85);
    const pulse = Math.sin(frameCount * 0.1) * 2;
    C.shadowColor = 'rgba(232, 67, 147, 0.6)';
    C.shadowBlur = 8 + pulse;
    _knife(C, KNIFE_LEN, KNIFE_BLADE, KNIFE_W);
    C.restore();
  }

  function drawFlyingKnife() {
    C.save();
    C.translate(cx(), flyingY);
    _knife(C, KNIFE_LEN, KNIFE_BLADE, KNIFE_W);
    C.restore();
  }

  /* ── Particles ──────────────────────────────────────────────────── */
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

  /* ── Temporary Floating Notifications (Small & Non-Intrusive) ───── */
  function addNotification(text, color = '#ffffff', fontSize = 16) {
    notifications.push({
      text,
      x: cx(),
      y: cy() + wheelR() + 35,
      vy: -1.2,
      opacity: 1.0,
      color,
      fontSize,
      life: 45,
      maxLife: 45
    });
  }

  function drawNotifications() {
    notifications = notifications.filter(n => n.life > 0);
    notifications.forEach(n => {
      n.y += n.vy;
      n.life--;
      n.opacity = n.life / n.maxLife;

      C.save();
      C.globalAlpha = Math.max(0, n.opacity);
      C.font = `900 ${n.fontSize}px 'Fredoka One', Nunito, sans-serif`;
      C.textAlign = 'center';
      C.shadowColor = 'rgba(0, 0, 0, 0.6)';
      C.shadowBlur = 6;
      C.fillStyle = n.color;
      C.fillText(n.text, n.x, n.y);
      C.restore();
    });
  }

  /* ── Extremely Compact Bottom HUD (Knives Left & Quick Status) ───── */
  function drawHUD() {
    const remaining = knivesLeft;
    if (remaining > 0) {
      const gap    = 16;
      const startX = cx() - ((remaining - 1) * gap) / 2;
      const y      = H - 24;
      for (let i = 0; i < remaining; i++) {
        C.save();
        C.translate(startX + i * gap, y);
        C.scale(0.26, 0.26);
        _knife(C, KNIFE_LEN, KNIFE_BLADE, KNIFE_W);
        C.restore();
      }
    }

    if (levelCfg) {
      const stuck   = stuckAngles.length;
      const minPass = levelCfg.minToPass;
      C.save();
      C.font      = `bold 12px Nunito, sans-serif`;
      C.textAlign = 'center';
      C.fillStyle = stuck >= minPass ? '#4ade80' : 'rgba(255,255,255,0.7)';
      C.fillText(`${stuck}/${minPass} landed`, cx(), H - 46);
      C.restore();
    }

    // Speed arc indicator
    const maxSpeed = (levelCfg ? levelCfg.baseSpeed : 0.55) * 2.5;
    const speedPct = Math.min(Math.abs(wheelSpeed) / maxSpeed, 1);
    const r = wheelR();
    C.save();
    C.beginPath();
    C.arc(cx(), cy(), r + 7, -Math.PI / 2, -Math.PI / 2 + speedPct * Math.PI * 2);
    C.strokeStyle = `hsl(${Math.round((1 - speedPct) * 120)}, 90%, 52%)`;
    C.lineWidth   = 3.5;
    C.lineCap     = 'round';
    C.stroke();
    C.restore();
  }

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

  /* ── Throw & Game Logic ─────────────────────────────────────────── */
  function doThrow() {
    sfx._init();
    sfx.startBg();
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

    if (dist <= r + 4) {
      flyingActive = false;

      const hitWorld = 90;
      const localHit = ((hitWorld - wheelAngle) % 360 + 360) % 360;

      // Obstacle collision check
      const obIdx = obstacles.findIndex(ob => {
        let d = Math.abs(ob.angle - localHit) % 360;
        if (d > 180) d = 360 - d;
        return d < (ob.type === 'apple' ? 18 : SAFE_GAP_DEG + 3);
      });

      if (obIdx !== -1) {
        const hitOb = obstacles[obIdx];
        if (hitOb.type === 'apple') {
          sfx.appleHit();
          score += 2;
          scoreEl.textContent = score;
          if (score > best) { best = score; bestEl.textContent = best; }

          addNotification('+2 🍎', '#f43f5e', 18);
          const rad = (hitOb.angle + wheelAngle) * Math.PI / 180;
          burst(cx() + Math.cos(rad) * r, cy() + Math.sin(rad) * r, ['#ef4444', '#f87171', '#22c55e', '#ffe066'], 22);
          obstacles.splice(obIdx, 1);

          stuckAngles.push(localHit);
          sfx.pointGain(stuckAngles.length);
          burst(cx(), cy() + r, ['#ffd700','#ff69b4','#00e5ff'], 12);

          checkLevelProgress();
          return;
        } else {
          // Hit stone / bomb / shield
          shakeFrames  = 26;
          clashFlash   = 35;
          levelPending = true;
          busy         = true;

          const rad  = (hitOb.angle + wheelAngle) * Math.PI / 180;
          const hitX = cx() + Math.cos(rad) * r;
          const hitY = cy() + Math.sin(rad) * r;

          let emoji = '🪨', title = 'CRASH!', desc = 'You hit a Stone Obstacle!';
          if (hitOb.type === 'bomb') {
            sfx.bombHit();
            burst(hitX, hitY, ['#ef4444', '#f97316', '#eab308', '#000000'], 35);
            emoji = '💣'; title = 'BOOM!'; desc = 'You hit a dangerous bomb!';
          } else if (hitOb.type === 'shield') {
            sfx.stoneHit();
            burst(hitX, hitY, ['#e2e8f0', '#94a3b8', '#ffe066'], 28);
            emoji = '🛡️'; title = 'DEFLECTED!'; desc = 'Blade bounced off Iron Shield!';
          } else {
            sfx.stoneHit();
            burst(hitX, hitY, ['#94a3b8', '#64748b', '#334155', '#ffe066'], 28);
          }

          if (levelPendingTimeout) clearTimeout(levelPendingTimeout);
          levelPendingTimeout = setTimeout(() => {
            levelPendingTimeout = null;
            showGameOverModal(emoji, title, desc);
          }, 600);
          flyDone = true;
          return;
        }
      }

      // Blade clash check
      const clashIdx = stuckAngles.findIndex(a => {
        let d = Math.abs(a - localHit) % 360;
        if (d > 180) d = 360 - d;
        return d < SAFE_GAP_DEG;
      });

      if (clashIdx !== -1) {
        shakeFrames = 22;
        clashFlash  = 30;
        levelPending = true;
        busy = true;

        const hitRad = (stuckAngles[clashIdx] + wheelAngle) * Math.PI / 180;
        burst(cx() + Math.cos(hitRad) * r, cy() + Math.sin(hitRad) * r, ['#ff4e4e','#ff9900','#ff0066','#ffe066','#00e5ff'], 28);
        sfx.clash();
        addNotification('CLASH! 💥', '#ef4444', 20);

        const qualified = stuckAngles.length >= (levelCfg ? levelCfg.minToPass : 3);
        if (levelPendingTimeout) clearTimeout(levelPendingTimeout);
        levelPendingTimeout = setTimeout(() => {
          levelPendingTimeout = null;
          if (qualified) {
            advanceLevelSeamless();
          } else {
            showGameOverModal('💥', 'CLASH!', 'Blade hit another blade!');
          }
        }, 600);
        flyDone = true;

      } else {
        // Successful blade hit!
        stuckAngles.push(localHit);
        score++;
        scoreEl.textContent = score;
        if (score > best) { best = score; bestEl.textContent = best; }

        sfx.pointGain(stuckAngles.length);
        addNotification('+1', '#4ade80', 16);
        burst(cx(), cy() + r, ['#ffd700','#ff69b4','#00e5ff','#8b4513','#d2691e'], 14);

        if (waitingForFirstHit) {
          waitingForFirstHit = false;
          const dir = level % 2 === 0 ? -1 : 1;
          wheelSpeed = dir * levelCfg.baseSpeed;
          burst(cx(), cy(), ['#00e5ff', '#ffd700', '#ff69b4', '#7cfc00'], 24);
        }

        checkLevelProgress();
      }
    }
  }

  function checkLevelProgress() {
    const cfg     = getLevelCfg(level);
    const allDone = stuckAngles.length >= cfg.knives;
    const noLeft  = knivesLeft <= 0;

    if (allDone || noLeft) {
      levelPending = true;
      busy = true;
      if (levelPendingTimeout) clearTimeout(levelPendingTimeout);
      levelPendingTimeout = setTimeout(() => {
        levelPendingTimeout = null;
        if (stuckAngles.length >= cfg.minToPass) {
          advanceLevelSeamless();
        } else {
          sfx.levelFail();
          showGameOverModal('😢', 'Level Failed!', `Needed ${cfg.minToPass} blades, got ${stuckAngles.length}`);
        }
      }, 600);
      flyDone = true;
    } else {
      flyingY = S - 30;
      flyDone = true;
      busy    = false;
    }
  }

  /* ── Seamless Hyper-Casual Level Advance (Non-Blocking) ────────────── */
  function advanceLevelSeamless() {
    levelPending = false;
    busy = false;
    level++;

    sfx.levelUp();
    burst(cx(), cy(), ['#ffd700','#7cfc00','#ff69b4','#00e5ff'], 35);
    addNotification(`LEVEL ${level}! 🚀`, '#facc15', 22);

    startLevel();
  }

  function showGameOverModal(emoji, title, desc) {
    if (levelPendingTimeout) { clearTimeout(levelPendingTimeout); levelPendingTimeout = null; }
    playing = false;
    sfx.stopBg();
    sfx.gameOver();

    gameOverEmoji.textContent = emoji;
    gameOverTitle.textContent = title;
    gameOverSub.textContent   = desc;
    finalScore.textContent    = score;
    finalBest.textContent     = best;

    gameOverModal.classList.remove('hidden');
    draw();
  }

  /* ── Draw frame ─────────────────────────────────────────────────── */
  function draw() {
    C.clearRect(0, 0, W, H);

    drawClashFlash();

    let didShakeSave = false;
    if (shakeFrames > 0) {
      const dx = (Math.random() - 0.5) * 8;
      const dy = (Math.random() - 0.5) * 8;
      C.save();
      C.translate(dx, dy);
      shakeFrames--;
      didShakeSave = true;
    }

    drawBgDots();
    drawWheel();
    drawObstacles();

    stuckAngles.forEach(local => {
      const world = (local + wheelAngle + 360) % 360;
      drawStuckKnife(world);
    });

    drawAimingGuide();

    if (!flyingActive && flyDone && knivesLeft > 0) {
      drawReadyKnife();
    }
    if (flyingActive || !flyDone) {
      drawFlyingKnife();
    }

    drawParticles();
    drawNotifications();
    drawHUD();

    if (didShakeSave) {
      C.restore();
    }
  }

  /* ── Main Game Loop ─────────────────────────────────────────────── */
  function loop() {
    if (!playing) return;

    frameCount++;
    if (!waitingForFirstHit) {
      const sign    = wheelSpeed >= 0 ? 1 : -1;
      const cfg     = levelCfg || getLevelCfg(level);
      const maxSpd  = Math.abs(cfg.baseSpeed) * 1.5;
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

  /* ── Mobile Audio & Visibility Handlers ──────────────────────────── */
  const unlockAudio = () => {
    sfx._init();
    if (playing && !sfx._bgTimer) {
      sfx.startBg();
    }
  };

  ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sfx.stopBg();
    } else {
      sfx._init();
      if (playing) {
        sfx.startBg();
      }
    }
  });

  /* ── Event Listeners ────────────────────────────────────────────── */
  // Direct Playfield Touch / Click to Throw
  canvas.addEventListener('pointerdown', () => {
    if (playing) {
      doThrow();
    }
  });

  // Help Modal Toggle (?)
  helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    playing = false;
    sfx.stopBg();
    helpModal.classList.remove('hidden');
  });

  closeHelpBtn.addEventListener('click', () => {
    helpModal.classList.add('hidden');
    playing = true;
    sfx.startBg();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  });

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      helpModal.classList.add('hidden');
      playing = true;
      sfx.startBg();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }
  });

  // Retry Button
  retryBtn.addEventListener('click', () => {
    gameOverModal.classList.add('hidden');
    fullReset();
    playing = true;
    sfx.startBg();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  });

  // Keyboard controls
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (playing) {
        doThrow();
      } else if (!gameOverModal.classList.contains('hidden')) {
        retryBtn.click();
      }
    }
  });

  window.addEventListener('resize', () => {
    resize();
    if (!playing) draw();
  });

  /* ── Immediate Direct Start (Playfield First) ───────────────────── */
  best = 0;
  resize();
  fullReset();
  gameStartTime  = Date.now();
  levelStartTime = Date.now();
  playing        = true;
  sfx.startBg();
  if (raf) cancelAnimationFrame(raf);
  raf            = requestAnimationFrame(loop);
})();
