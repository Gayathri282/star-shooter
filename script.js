/**
 * Star Toss - Kids Arcade Game Logic & Web Audio Engine
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.bgTimer = null;
    this.bgStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBgMusic();
    } else {
      this.startBgMusic();
    }
    return this.isMuted;
  }

  playTone(freq, duration, type = 'sine', gainVal = 0.15, pitchDecay = 0) {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(freq, now);
      if (pitchDecay !== 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + pitchDecay), now + duration);
      }
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  playToss() {
    this.init();
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  playScore(combo) {
    this.init();
    const baseFreq = 523.25; // C5
    const semitones = [0, 2, 4, 7, 9, 12, 14, 16];
    const index = Math.min(combo, semitones.length - 1);
    const freq = baseFreq * Math.pow(2, semitones[index] / 12);
    
    // Play main chime + harmonic synth
    this.playTone(freq, 0.25, 'triangle', 0.2);
    setTimeout(() => this.playTone(freq * 1.5, 0.2, 'sine', 0.1), 40);
  }

  playMiss() {
    this.init();
    this.playTone(180, 0.25, 'sawtooth', 0.12, -80);
  }

  playLevelUp() {
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 0.3, 'sine', 0.25);
      }, idx * 80);
    });
  }

  playGameOver() {
    this.init();
    const notes = [440, 392, 349.23, 293.66]; // A4, G4, F4, D4
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 0.4, 'triangle', 0.2, -30);
      }, idx * 160);
    });
  }

  startBgMusic() {
    if (this.bgTimer || this.isMuted) return;
    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46]; // C major / F major melody tones
    this.bgTimer = setInterval(() => {
      if (!this.isMuted && this.ctx) {
        const freq = melody[this.bgStep % melody.length];
        this.playTone(freq, 0.18, 'sine', 0.04);
        this.bgStep++;
      }
    }, 320);
  }

  stopBgMusic() {
    if (this.bgTimer) {
      clearInterval(this.bgTimer);
      this.bgTimer = null;
    }
  }
}

(() => {
  // UI Elements
  const arena = document.getElementById('arena');
  const target = document.getElementById('target');
  const projectile = document.getElementById('projectile');
  const scoreEl = document.getElementById('score');
  const comboEl = document.getElementById('combo');
  const levelEl = document.getElementById('level');
  const livesEl = document.getElementById('lives');
  const message = document.getElementById('message');
  const throwBtn = document.getElementById('throw');
  const againBtn = document.getElementById('again');
  const audioBtn = document.getElementById('audioBtn');
  const audioIcon = document.getElementById('audioIcon');
  const audioText = document.getElementById('audioText');

  // Sound Engine
  const sound = new SoundEngine();

  // Game State
  let score = 0;
  let combo = 0;
  let level = 1;
  let lives = 3;
  let busy = false;
  let playing = true;
  let angle = 0;
  let speed = 0.8;
  let raf = null;

  function initAudio() {
    sound.init();
    sound.startBgMusic();
  }

  function toggleSound() {
    const isMuted = sound.toggleMute();
    audioIcon.textContent = isMuted ? '🔇' : '🔊';
    audioText.textContent = isMuted ? 'Sound OFF' : 'Sound ON';
  }

  function reset() {
    score = 0;
    combo = 0;
    level = 1;
    lives = 3;
    busy = false;
    playing = true;
    speed = 0.8;
    angle = 0;

    scoreEl.textContent = '0';
    comboEl.textContent = '0';
    levelEl.textContent = '1';
    livesEl.textContent = '3';

    message.classList.add('hidden');
    throwBtn.classList.remove('hidden');
    againBtn.classList.add('hidden');
    projectile.style.bottom = '35px';

    if (raf) cancelAnimationFrame(raf);
    loop();
    sound.startBgMusic();
  }

  function loop() {
    if (!playing) return;
    angle += speed;
    target.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    raf = requestAnimationFrame(loop);
  }

  function popup(text, x, y, isLevelUp = false) {
    const p = document.createElement('div');
    p.className = 'pop' + (isLevelUp ? ' level-up' : '');
    p.textContent = text;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    arena.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }

  function checkLevelUp(newScore) {
    const calculatedLevel = Math.floor(newScore / 500) + 1;
    if (calculatedLevel > level) {
      level = calculatedLevel;
      levelEl.textContent = level;
      speed += 0.25;
      sound.playLevelUp();
      const arenaRect = arena.getBoundingClientRect();
      popup(`LEVEL UP! ${level} ⭐`, arenaRect.width / 2, arenaRect.height / 3, true);
    }
  }

  function gameOver() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    sound.stopBgMusic();
    sound.playGameOver();

    message.classList.remove('hidden');
    message.querySelector('h2').textContent = 'Great Try! 🌟';
    message.querySelector('p').textContent = `Final Score: ${score} (Level ${level})`;
    throwBtn.classList.add('hidden');
    againBtn.classList.remove('hidden');
  }

  function toss() {
    initAudio();
    if (!playing || busy) return;
    busy = true;

    sound.playToss();
    projectile.style.transition = 'bottom 0.20s cubic-bezier(0.25, 0.9, 0.3, 1)';
    projectile.style.bottom = '58%';

    setTimeout(() => {
      const targetRect = target.getBoundingClientRect();
      const arenaRect = arena.getBoundingClientRect();
      
      const targetCenterX = targetRect.left + targetRect.width / 2 - arenaRect.left;
      const targetCenterY = targetRect.top + targetRect.height / 2 - arenaRect.top;

      const projX = arenaRect.width / 2;
      const projY = arenaRect.height - 35 - 40; // Center tip of projectile

      const distance = Math.hypot(projX - targetCenterX, projY - targetCenterY);
      const isHit = distance < targetRect.width * 0.52;

      if (isHit) {
        combo++;
        const pointsGained = 100 + combo * 25;
        score += pointsGained;
        speed = Math.min(3.2, speed + 0.04);

        scoreEl.textContent = score;
        comboEl.textContent = combo;

        sound.playScore(combo);
        popup(`+${pointsGained}`, targetCenterX, targetCenterY);

        target.classList.remove('flash');
        void target.offsetWidth; // Trigger reflow for animation restart
        target.classList.add('flash');

        checkLevelUp(score);
      } else {
        combo = 0;
        lives--;
        comboEl.textContent = '0';
        livesEl.textContent = lives;

        sound.playMiss();
        popup('Oops!', projX, projY);

        if (lives <= 0) {
          setTimeout(gameOver, 250);
        }
      }

      projectile.style.bottom = '35px';
      setTimeout(() => {
        busy = false;
      }, 140);
    }, 210);
  }

  // Event Listeners
  throwBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    toss();
  });

  arena.addEventListener('pointerdown', (e) => {
    if (playing && e.target !== throwBtn && e.target !== audioBtn && !audioBtn.contains(e.target)) {
      toss();
    }
  });

  againBtn.addEventListener('click', () => {
    initAudio();
    reset();
  });

  audioBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    toggleSound();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      initAudio();
      if (playing) {
        toss();
      } else {
        reset();
      }
    }
  });

  // Start initial game state
  reset();
})();
