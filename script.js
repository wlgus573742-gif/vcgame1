const gameArea = document.getElementById("gameArea");
const player = document.getElementById("player");
const pearl = document.getElementById("pearl");
const levelNotice = document.getElementById("levelNotice");
const obstacleOne = document.getElementById("obstacleOne");
const obstacleTwo = document.getElementById("obstacleTwo");
const obstacleThree = document.getElementById("obstacleThree");
const message = document.getElementById("message");

const scoreEl = document.getElementById("score");
const targetScoreEl = document.getElementById("targetScore");
const levelEl = document.getElementById("level");
const lifeEl = document.getElementById("life");
const gameStatusEl = document.getElementById("gameStatus");

const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const soundBtn = document.getElementById("soundBtn");
const bgmBtn = document.getElementById("bgmBtn");
const clearRankingBtn = document.getElementById("clearRankingBtn");
const rankingList = document.getElementById("rankingList");
const controlButtons = document.querySelectorAll(".control-btn");

const targetScore = 15;
const maxLevel = 3;
const scorePerLevel = 5;
const playerSize = 58;
const pearlSize = 52;
const obstacleSize = 58;
const groundHeight = 58;

let score = 0;
let life = 3;
let isPlaying = false;
let isInvincible = false;
let gameLoopId = null;
let lastFrameTime = 0;
let lastHitTime = 0;
let difficultyLevel = 1;
let currentLevel = 1;
let levelNoticeTimer = null;
let gameStartTime = 0;
let lastEndingRecord = null;

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false
};

const playerState = {
  x: 70,
  y: 205,
  speed: 260
};

const pearlState = {
  x: 600,
  y: 160
};

const obstacles = [
  {
    element: obstacleOne,
    x: 360,
    y: 100,
    vx: 80,
    vy: 54,
    isActive: true
  },
  {
    element: obstacleTwo,
    x: 520,
    y: 285,
    vx: -70,
    vy: 76,
    isActive: true
  },
  {
    element: obstacleThree,
    x: 190,
    y: 315,
    vx: 92,
    vy: -62,
    isActive: false
  }
];

const baseObstacleSettings = obstacles.map((obstacle) => ({
  x: obstacle.x,
  y: obstacle.y,
  vx: obstacle.vx,
  vy: obstacle.vy
}));

targetScoreEl.textContent = targetScore;

const rankingStorageKey = "vcgame1-ranking-top10";

const levelSettings = {
  1: {
    name: "1단계",
    description: "기본 속도 / 장애물 2개",
    playerSpeed: 275,
    obstacleSpeedBoost: 0.9,
    activeObstacles: 2,
    collisionPadding: 18,
    invincibleTime: 950,
    pearlSafeDistance: 125
  },
  2: {
    name: "2단계",
    description: "장애물 3개 / 이동 속도 증가",
    playerSpeed: 260,
    obstacleSpeedBoost: 1.18,
    activeObstacles: 3,
    collisionPadding: 14,
    invincibleTime: 850,
    pearlSafeDistance: 105
  },
  3: {
    name: "3단계",
    description: "최고 난이도 / 장애물 속도 증가",
    playerSpeed: 245,
    obstacleSpeedBoost: 1.52,
    activeObstacles: 3,
    collisionPadding: 10,
    invincibleTime: 720,
    pearlSafeDistance: 90
  }
};

const audio = {
  ctx: null,
  masterGain: null,
  bgmGain: null,
  sfxGain: null,
  bgmNodes: [],
  bgmIntervals: [],
  sfxEnabled: true,
  bgmEnabled: true,
  bgmStarted: false,
  lastMoveSoundTime: 0
};

function initAudio() {
  if (audio.ctx) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audio.ctx = new AudioContext();

  audio.masterGain = audio.ctx.createGain();
  audio.masterGain.gain.value = 0.82;
  audio.masterGain.connect(audio.ctx.destination);

  audio.bgmGain = audio.ctx.createGain();
  audio.bgmGain.gain.value = 0.26;
  audio.bgmGain.connect(audio.masterGain);

  audio.sfxGain = audio.ctx.createGain();
  audio.sfxGain.gain.value = 0.64;
  audio.sfxGain.connect(audio.masterGain);
}

function resumeAudio() {
  initAudio();

  if (audio.ctx.state === "suspended") {
    audio.ctx.resume();
  }
}

function playTone({
  frequency = 440,
  type = "sine",
  startTime = 0,
  duration = 0.2,
  gain = 0.18,
  destination = audio.sfxGain,
  attack = 0.01,
  release = 0.08,
  detune = 0,
  endFrequency = null
}) {
  if (!audio.ctx || !destination) return;

  const now = audio.ctx.currentTime + startTime;
  const oscillator = audio.ctx.createOscillator();
  const gainNode = audio.ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(endFrequency, 1),
      now + duration
    );
  }

  oscillator.detune.setValueAtTime(detune, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0001), now + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

  oscillator.connect(gainNode);
  gainNode.connect(destination);

  oscillator.start(now);
  oscillator.stop(now + duration + release + 0.03);
}

function playNoise({
  startTime = 0,
  duration = 0.25,
  gain = 0.12,
  filterFrequency = 900,
  filterType = "lowpass",
  destination = audio.sfxGain
}) {
  if (!audio.ctx || !destination) return;

  const now = audio.ctx.currentTime + startTime;
  const bufferSize = Math.max(1, Math.floor(audio.ctx.sampleRate * duration));
  const buffer = audio.ctx.createBuffer(1, bufferSize, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    const fade = 1 - i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * fade;
  }

  const source = audio.ctx.createBufferSource();
  const filter = audio.ctx.createBiquadFilter();
  const gainNode = audio.ctx.createGain();

  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFrequency, now);

  gainNode.gain.setValueAtTime(gain, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);

  source.start(now);
  source.stop(now + duration);
}

function createLoopingWaterNoise() {
  const duration = 5.5;
  const sampleRate = audio.ctx.sampleRate;
  const bufferSize = Math.floor(sampleRate * duration);
  const buffer = audio.ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  let value = 0;

  for (let i = 0; i < bufferSize; i += 1) {
    value += (Math.random() * 2 - 1) * 0.035;
    value *= 0.985;
    data[i] = value * 0.45;
  }

  const source = audio.ctx.createBufferSource();
  const highpass = audio.ctx.createBiquadFilter();
  const lowpass = audio.ctx.createBiquadFilter();
  const flowGain = audio.ctx.createGain();
  const lfo = audio.ctx.createOscillator();
  const lfoGain = audio.ctx.createGain();

  source.buffer = buffer;
  source.loop = true;

  highpass.type = "highpass";
  highpass.frequency.value = 260;

  lowpass.type = "lowpass";
  lowpass.frequency.value = 3200;

  flowGain.gain.value = 0.035;

  lfo.type = "sine";
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.012;

  lfo.connect(lfoGain);
  lfoGain.connect(flowGain.gain);

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(flowGain);
  flowGain.connect(audio.bgmGain);

  source.start();
  lfo.start();

  audio.bgmNodes.push(source, lfo);
}

function playAquariumDrop(delay = 0, volume = 1) {
  const base = 880 + Math.random() * 760;
  const second = base * (1.32 + Math.random() * 0.18);

  playTone({
    frequency: base,
    endFrequency: base * 0.72,
    startTime: delay,
    duration: 0.09,
    gain: 0.026 * volume,
    type: "sine",
    destination: audio.bgmGain,
    attack: 0.004,
    release: 0.18
  });

  playTone({
    frequency: second,
    endFrequency: second * 0.8,
    startTime: delay + 0.055,
    duration: 0.065,
    gain: 0.016 * volume,
    type: "triangle",
    destination: audio.bgmGain,
    attack: 0.004,
    release: 0.14
  });

  playNoise({
    startTime: delay,
    duration: 0.18,
    gain: 0.012 * volume,
    filterFrequency: 2600 + Math.random() * 900,
    filterType: "highpass",
    destination: audio.bgmGain
  });
}

function playSoftWaterRipple(delay = 0) {
  playNoise({
    startTime: delay,
    duration: 0.55,
    gain: 0.018,
    filterFrequency: 1800 + Math.random() * 1200,
    filterType: "bandpass",
    destination: audio.bgmGain
  });

  playTone({
    frequency: 620 + Math.random() * 260,
    startTime: delay + 0.12,
    duration: 0.2,
    gain: 0.01,
    type: "sine",
    destination: audio.bgmGain,
    release: 0.28
  });
}

function playButtonSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  playTone({ frequency: 620, duration: 0.06, gain: 0.07, type: "sine" });
  playTone({ frequency: 850, startTime: 0.04, duration: 0.08, gain: 0.06, type: "triangle" });
}

function playStartSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  playTone({ frequency: 392, duration: 0.12, gain: 0.09, type: "sine" });
  playTone({ frequency: 523, startTime: 0.08, duration: 0.15, gain: 0.09, type: "triangle" });
  playTone({ frequency: 784, startTime: 0.18, duration: 0.2, gain: 0.08, type: "sine" });
  playNoise({ startTime: 0, duration: 0.45, gain: 0.045, filterFrequency: 1500 });
}

function playMoveSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  const nowMs = Date.now();

  if (nowMs - audio.lastMoveSoundTime < 135) return;

  audio.lastMoveSoundTime = nowMs;

  playTone({ frequency: 680, duration: 0.045, gain: 0.045, type: "sine" });
  playTone({ frequency: 980, startTime: 0.035, duration: 0.055, gain: 0.035, type: "triangle" });
  playNoise({ startTime: 0.01, duration: 0.12, gain: 0.025, filterFrequency: 1900 });
}


function playLevelUpSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  playTone({ frequency: 523, duration: 0.1, gain: 0.08, type: "triangle" });
  playTone({ frequency: 784, startTime: 0.1, duration: 0.12, gain: 0.09, type: "triangle" });
  playTone({ frequency: 1174, startTime: 0.22, duration: 0.16, gain: 0.08, type: "sine" });

  playNoise({
    startTime: 0.08,
    duration: 0.32,
    gain: 0.025,
    filterFrequency: 3000,
    filterType: "highpass"
  });
}

function playPearlSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  playTone({ frequency: 988, duration: 0.09, gain: 0.1, type: "triangle" });
  playTone({ frequency: 1318, startTime: 0.08, duration: 0.11, gain: 0.09, type: "triangle" });
  playTone({ frequency: 1760, startTime: 0.17, duration: 0.17, gain: 0.08, type: "sine" });
}

function playHitSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  playTone({ frequency: 150, duration: 0.17, gain: 0.16, type: "sawtooth" });
  playTone({ frequency: 95, startTime: 0.03, duration: 0.24, gain: 0.12, type: "sine" });
  playNoise({ startTime: 0, duration: 0.32, gain: 0.12, filterFrequency: 300 });
}

function playWinSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  // 승리 엔딩 사운드: 맑은 물방울 팡파르 + 반짝이는 상승 멜로디
  const fanfareNotes = [
    { frequency: 523, startTime: 0.00, duration: 0.16, gain: 0.10 },
    { frequency: 659, startTime: 0.12, duration: 0.16, gain: 0.10 },
    { frequency: 784, startTime: 0.24, duration: 0.18, gain: 0.11 },
    { frequency: 1046, startTime: 0.38, duration: 0.22, gain: 0.12 },
    { frequency: 1318, startTime: 0.58, duration: 0.28, gain: 0.10 }
  ];

  fanfareNotes.forEach((note) => {
    playTone({
      frequency: note.frequency,
      startTime: note.startTime,
      duration: note.duration,
      gain: note.gain,
      type: "triangle",
      release: 0.22
    });
  });

  // 진주를 모두 모았을 때의 반짝임
  [0.08, 0.2, 0.34, 0.52, 0.72].forEach((delay, index) => {
    playTone({
      frequency: 1400 + index * 180,
      startTime: delay,
      duration: 0.08,
      gain: 0.045,
      type: "sine",
      release: 0.2
    });
  });

  // 맑은 물방울이 위로 올라가는 느낌
  [0.16, 0.3, 0.46, 0.64, 0.86].forEach((delay) => {
    playTone({
      frequency: 900 + Math.random() * 500,
      endFrequency: 1500 + Math.random() * 600,
      startTime: delay,
      duration: 0.12,
      gain: 0.035,
      type: "sine",
      release: 0.18
    });

    playNoise({
      startTime: delay,
      duration: 0.2,
      gain: 0.018,
      filterFrequency: 2800,
      filterType: "highpass"
    });
  });
}

function playGameOverSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  // 패배 엔딩 사운드: 물속에서 가라앉는 듯한 하강음 + 둔탁한 충돌음
  const failNotes = [
    { frequency: 392, startTime: 0.00, duration: 0.2, gain: 0.11 },
    { frequency: 294, startTime: 0.18, duration: 0.22, gain: 0.11 },
    { frequency: 220, startTime: 0.36, duration: 0.24, gain: 0.10 },
    { frequency: 147, startTime: 0.58, duration: 0.34, gain: 0.12 }
  ];

  failNotes.forEach((note) => {
    playTone({
      frequency: note.frequency,
      endFrequency: note.frequency * 0.72,
      startTime: note.startTime,
      duration: note.duration,
      gain: note.gain,
      type: "sine",
      release: 0.22
    });
  });

  // 마지막 충돌감
  playTone({
    frequency: 95,
    endFrequency: 52,
    startTime: 0.62,
    duration: 0.42,
    gain: 0.15,
    type: "sawtooth",
    release: 0.28
  });

  playNoise({
    startTime: 0.08,
    duration: 0.55,
    gain: 0.075,
    filterFrequency: 240,
    filterType: "lowpass"
  });

  playNoise({
    startTime: 0.66,
    duration: 0.85,
    gain: 0.095,
    filterFrequency: 180,
    filterType: "lowpass"
  });

  // 힘이 빠지며 작은 기포가 사라지는 느낌
  [0.72, 0.86, 1.02, 1.2].forEach((delay, index) => {
    playTone({
      frequency: 420 - index * 55,
      endFrequency: 260 - index * 35,
      startTime: delay,
      duration: 0.1,
      gain: 0.025,
      type: "sine",
      release: 0.2
    });
  });
}

function startBgm() {
  if (!audio.bgmEnabled) return;

  resumeAudio();

  if (audio.bgmStarted) return;

  audio.bgmStarted = true;

  createLoopingWaterNoise();

  const shimmerOne = audio.ctx.createOscillator();
  const shimmerOneGain = audio.ctx.createGain();
  const shimmerTwo = audio.ctx.createOscillator();
  const shimmerTwoGain = audio.ctx.createGain();
  const shimmerLfo = audio.ctx.createOscillator();
  const shimmerLfoGain = audio.ctx.createGain();

  shimmerOne.type = "sine";
  shimmerOne.frequency.value = 783.99;
  shimmerOneGain.gain.value = 0.006;

  shimmerTwo.type = "triangle";
  shimmerTwo.frequency.value = 1174.66;
  shimmerTwoGain.gain.value = 0.004;

  shimmerLfo.frequency.value = 0.035;
  shimmerLfoGain.gain.value = 5;

  shimmerLfo.connect(shimmerLfoGain);
  shimmerLfoGain.connect(shimmerTwo.frequency);

  shimmerOne.connect(shimmerOneGain);
  shimmerTwo.connect(shimmerTwoGain);
  shimmerOneGain.connect(audio.bgmGain);
  shimmerTwoGain.connect(audio.bgmGain);

  shimmerOne.start();
  shimmerTwo.start();
  shimmerLfo.start();

  audio.bgmNodes.push(shimmerOne, shimmerTwo, shimmerLfo);

  const dropInterval = setInterval(() => {
    if (!audio.bgmEnabled || !audio.bgmStarted) return;

    const count = Math.random() < 0.38 ? 2 : 1;

    for (let i = 0; i < count; i += 1) {
      playAquariumDrop(i * (0.08 + Math.random() * 0.08), 0.85 + Math.random() * 0.45);
    }
  }, 620 + Math.random() * 280);

  const rippleInterval = setInterval(() => {
    if (!audio.bgmEnabled || !audio.bgmStarted) return;

    playSoftWaterRipple(Math.random() * 0.4);
  }, 2300);

  const sparkleInterval = setInterval(() => {
    if (!audio.bgmEnabled || !audio.bgmStarted) return;

    const notes = [659, 784, 880, 987, 1174, 1318];
    const note = notes[Math.floor(Math.random() * notes.length)];

    playTone({
      frequency: note,
      duration: 0.16,
      gain: 0.008,
      type: "sine",
      destination: audio.bgmGain,
      attack: 0.01,
      release: 0.42
    });
  }, 4200);

  audio.bgmIntervals.push(dropInterval, rippleInterval, sparkleInterval);
}

function stopBgm() {
  if (!audio.ctx) return;

  audio.bgmNodes.forEach((node) => {
    try {
      node.stop();
      node.disconnect();
    } catch (error) {
      // 이미 정지된 노드는 무시합니다.
    }
  });

  audio.bgmNodes = [];
  audio.bgmStarted = false;

  audio.bgmIntervals.forEach((intervalId) => {
    clearInterval(intervalId);
  });

  audio.bgmIntervals = [];
}

function updateSoundButtons() {
  soundBtn.textContent = audio.sfxEnabled ? "효과음 ON" : "효과음 OFF";
  bgmBtn.textContent = audio.bgmEnabled ? "BGM ON" : "BGM OFF";

  soundBtn.classList.toggle("off", !audio.sfxEnabled);
  bgmBtn.classList.toggle("off", !audio.bgmEnabled);
}

function getBounds() {
  return {
    width: gameArea.clientWidth,
    height: gameArea.clientHeight
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function applyPosition(element, x, y) {
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
}

function randomPosition(size, avoidPlayer = true) {
  const bounds = getBounds();
  let x = 0;
  let y = 0;
  let attempt = 0;

  do {
    x = Math.random() * (bounds.width - size - 24) + 12;
    y = Math.random() * (bounds.height - groundHeight - size - 24) + 12;
    attempt += 1;
  } while (
    avoidPlayer &&
    attempt < 30 &&
    Math.abs(x - playerState.x) < getCurrentLevelSettings().pearlSafeDistance &&
    Math.abs(y - playerState.y) < getCurrentLevelSettings().pearlSafeDistance
  );

  return { x, y };
}

function updateInfo() {
  scoreEl.textContent = score;
  levelEl.textContent = currentLevel;
  lifeEl.textContent = life;

  if (isPlaying) {
    gameStatusEl.textContent = `${currentLevel}단계 진행 중`;
  } else {
    gameStatusEl.textContent = "대기";
  }
}

function showMessage(title, text) {
  message.classList.remove("hide");
  message.innerHTML = `
    <strong>${title}</strong>
    <span>${text}</span>
  `;
}

function hideMessage() {
  message.classList.add("hide");
}


function getCurrentLevelSettings() {
  return levelSettings[currentLevel] || levelSettings[1];
}

function getLevelByScore(value) {
  return Math.min(maxLevel, Math.floor(value / scorePerLevel) + 1);
}

function showLevelNotice(text) {
  if (!levelNotice) return;

  clearTimeout(levelNoticeTimer);

  levelNotice.textContent = text;
  levelNotice.classList.add("show");

  levelNoticeTimer = setTimeout(() => {
    levelNotice.classList.remove("show");
  }, 1500);
}

function applyLevelSettings(shouldResetVelocity = false) {
  const settings = getCurrentLevelSettings();

  playerState.speed = settings.playerSpeed;

  obstacles.forEach((obstacle, index) => {
    const base = baseObstacleSettings[index];
    const shouldBeActive = index < settings.activeObstacles;
    const wasInactive = !obstacle.isActive;

    obstacle.isActive = shouldBeActive;
    obstacle.element.style.display = shouldBeActive ? "flex" : "none";

    if (shouldResetVelocity) {
      obstacle.x = base.x;
      obstacle.y = base.y;
      obstacle.vx = base.vx;
      obstacle.vy = base.vy;
    }

    if (shouldBeActive && wasInactive && !shouldResetVelocity) {
      const position = randomPosition(obstacleSize, true);
      obstacle.x = position.x;
      obstacle.y = position.y;
      obstacle.vx = base.vx * (Math.random() < 0.5 ? 1 : -1);
      obstacle.vy = base.vy * (Math.random() < 0.5 ? 1 : -1);
    }

    applyPosition(obstacle.element, obstacle.x, obstacle.y);
  });
}

function checkLevelProgression() {
  const nextLevel = getLevelByScore(score);

  if (nextLevel === currentLevel) return;

  currentLevel = nextLevel;
  applyLevelSettings(false);
  updateInfo();

  const settings = getCurrentLevelSettings();
  showLevelNotice(`${settings.name} 진입!`);
  playLevelUpSound();
}

function formatPlayTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}초`;
  }

  return `${minutes}분 ${seconds}초`;
}

function getRankings() {
  try {
    const saved = localStorage.getItem(rankingStorageKey);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch (error) {
    return [];
  }
}

function saveRankings(rankings) {
  localStorage.setItem(rankingStorageKey, JSON.stringify(rankings.slice(0, 10)));
}

function sortRankings(rankings) {
  return rankings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    if (a.result !== b.result) {
      return a.result === "성공" ? -1 : 1;
    }

    if ((b.level || 1) !== (a.level || 1)) {
      return (b.level || 1) - (a.level || 1);
    }

    return a.playTime - b.playTime;
  });
}

function renderRankings() {
  const rankings = getRankings();

  if (!rankingList) return;

  if (rankings.length === 0) {
    rankingList.innerHTML = `<li class="empty-ranking">아직 기록이 없습니다.</li>`;
    return;
  }

  rankingList.innerHTML = rankings
    .map((rank, index) => {
      return `
        <li>
          <span class="ranking-name">${index + 1}. ${rank.nickname}</span>
          <span class="ranking-result"> ${rank.result}</span>
          <br />
          <span class="ranking-meta">
            점수 ${rank.score}점 · 도달 단계 ${rank.level || 1}/3 · 생명 ${rank.life} · 플레이 시간 ${formatPlayTime(rank.playTime)} · ${rank.date}
          </span>
        </li>
      `;
    })
    .join("");
}

function sanitizeNickname(value) {
  return value
    .trim()
    .replace(/[<>&"']/g, "")
    .slice(0, 10);
}

function saveEndingRecord() {
  const input = document.getElementById("nicknameInput");

  if (!input || !lastEndingRecord) return;

  const nickname = sanitizeNickname(input.value);

  if (!nickname) {
    input.focus();
    input.placeholder = "닉네임을 입력해주세요";
    return;
  }

  const rankings = getRankings();

  rankings.push({
    ...lastEndingRecord,
    nickname
  });

  const sorted = sortRankings(rankings).slice(0, 10);
  saveRankings(sorted);
  renderRankings();

  showMessage(
    "기록 저장 완료!",
    `${nickname}님의 플레이 로그가 TOP 10 랭킹에 저장되었습니다.`
  );

  lastEndingRecord = null;
}

function showEndingMessage(isWin) {
  const resultText = isWin ? "성공" : "실패";
  const title = isWin ? "성공!" : "게임 오버";
  const description = isWin
    ? "목표 진주를 모두 모았습니다!"
    : "장애물에 너무 많이 부딪혔습니다.";

  const playTime = Date.now() - gameStartTime;

  lastEndingRecord = {
    result: resultText,
    score,
    level: currentLevel,
    life,
    playTime,
    date: new Date().toLocaleString("ko-KR")
  };

  message.classList.remove("hide");
  message.innerHTML = `
    <strong>${title}</strong>
    <span>${description}</span>
    <span class="level-badge">도달 단계: ${currentLevel} / 3</span>
    <span class="save-hint">
      닉네임을 남기면 이번 플레이 로그가 랭킹에 저장됩니다.
    </span>
    <div class="nickname-form">
      <input
        id="nicknameInput"
        type="text"
        maxlength="10"
        placeholder="닉네임 입력"
        autocomplete="off"
      />
      <button id="saveRankingBtn" type="button">기록 저장</button>
    </div>
  `;

  const saveRankingBtn = document.getElementById("saveRankingBtn");
  const nicknameInput = document.getElementById("nicknameInput");

  saveRankingBtn.addEventListener("click", saveEndingRecord);

  nicknameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveEndingRecord();
    }
  });

  setTimeout(() => {
    nicknameInput.focus();
  }, 80);
}

function resetKeys() {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
}

function resetGameObjects() {
  playerState.x = 70;
  playerState.y = 205;

  const pearlPosition = randomPosition(pearlSize, false);
  pearlState.x = pearlPosition.x;
  pearlState.y = pearlPosition.y;

  obstacles[0].x = 360;
  obstacles[0].y = 100;
  obstacles[0].vx = 80;
  obstacles[0].vy = 54;

  obstacles[1].x = 520;
  obstacles[1].y = 285;
  obstacles[1].vx = -70;
  obstacles[1].vy = 76;

  obstacles[2].x = 190;
  obstacles[2].y = 315;
  obstacles[2].vx = 92;
  obstacles[2].vy = -62;

  applyPosition(player, playerState.x, playerState.y);
  applyPosition(pearl, pearlState.x, pearlState.y);

  applyLevelSettings(true);
}

function startGame() {
  resumeAudio();
  playButtonSound();

  score = 0;
  life = 3;
  difficultyLevel = 1;
  currentLevel = 1;
  isPlaying = true;
  isInvincible = false;
  lastFrameTime = 0;
  lastHitTime = 0;
  gameStartTime = Date.now();
  lastEndingRecord = null;

  resetKeys();
  resetGameObjects();
  updateInfo();
  hideMessage();
  startBgm();
  playStartSound();

  startBtn.disabled = true;

  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
  }

  gameLoopId = requestAnimationFrame(gameLoop);
}

function resetGame() {
  playButtonSound();

  isPlaying = false;
  isInvincible = false;
  score = 0;
  life = 3;
  difficultyLevel = 1;
  currentLevel = 1;
  lastFrameTime = 0;
  lastHitTime = 0;
  gameStartTime = Date.now();
  lastEndingRecord = null;

  resetKeys();
  resetGameObjects();
  updateInfo();

  startBtn.disabled = false;
  player.classList.remove("moving");
  player.style.opacity = "1";

  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }

  showMessage("심해 진주 줍기", "1단계부터 시작해 진주를 모을수록 2단계, 3단계로 어려워집니다.");
}

function endGame(isWin) {
  isPlaying = false;
  resetKeys();

  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }

  startBtn.disabled = false;
  player.classList.remove("moving");

  if (isWin) {
    gameStatusEl.textContent = "성공";
    showEndingMessage(true);
    playWinSound();
  } else {
    gameStatusEl.textContent = "실패";
    showEndingMessage(false);
    playGameOverSound();
  }
}

function isMovingKeyPressed() {
  return (
    keys.ArrowUp ||
    keys.ArrowDown ||
    keys.ArrowLeft ||
    keys.ArrowRight ||
    keys.KeyW ||
    keys.KeyA ||
    keys.KeyS ||
    keys.KeyD
  );
}

function movePlayer(deltaTime) {
  let dx = 0;
  let dy = 0;

  if (keys.ArrowLeft || keys.KeyA) dx -= 1;
  if (keys.ArrowRight || keys.KeyD) dx += 1;
  if (keys.ArrowUp || keys.KeyW) dy -= 1;
  if (keys.ArrowDown || keys.KeyS) dy += 1;

  if (dx === 0 && dy === 0) {
    player.classList.remove("moving");
    return;
  }

  const length = Math.hypot(dx, dy) || 1;
  dx /= length;
  dy /= length;

  const bounds = getBounds();
  const distance = playerState.speed * deltaTime;

  playerState.x = clamp(playerState.x + dx * distance, 6, bounds.width - playerSize - 6);
  playerState.y = clamp(playerState.y + dy * distance, 6, bounds.height - groundHeight - playerSize - 6);

  applyPosition(player, playerState.x, playerState.y);
  player.classList.add("moving");
  playMoveSound();
}

function moveObstacles(deltaTime) {
  const bounds = getBounds();
  const settings = getCurrentLevelSettings();
  const scorePressure = Math.min(score * 0.012, 0.18);
  const speedBoost = settings.obstacleSpeedBoost + scorePressure;

  obstacles.forEach((obstacle) => {
    if (!obstacle.isActive) return;

    obstacle.x += obstacle.vx * speedBoost * deltaTime;
    obstacle.y += obstacle.vy * speedBoost * deltaTime;

    if (obstacle.x <= 0 || obstacle.x >= bounds.width - obstacleSize) {
      obstacle.vx *= -1;
      obstacle.x = clamp(obstacle.x, 0, bounds.width - obstacleSize);
    }

    if (obstacle.y <= 0 || obstacle.y >= bounds.height - groundHeight - obstacleSize) {
      obstacle.vy *= -1;
      obstacle.y = clamp(obstacle.y, 0, bounds.height - groundHeight - obstacleSize);
    }

    applyPosition(obstacle.element, obstacle.x, obstacle.y);
  });
}

function isRectColliding(a, b, padding = 8) {
  const rectA = a.getBoundingClientRect();
  const rectB = b.getBoundingClientRect();

  return !(
    rectA.right - padding < rectB.left + padding ||
    rectA.left + padding > rectB.right - padding ||
    rectA.bottom - padding < rectB.top + padding ||
    rectA.top + padding > rectB.bottom - padding
  );
}

function collectPearl() {
  score += 1;
  difficultyLevel = 1 + Math.floor(score / 4) * 0.35;
  checkLevelProgression();

  const nextPosition = randomPosition(pearlSize, true);
  pearlState.x = nextPosition.x;
  pearlState.y = nextPosition.y;
  applyPosition(pearl, pearlState.x, pearlState.y);

  updateInfo();
  playPearlSound();

  if (score >= targetScore) {
    endGame(true);
  }
}

function hitObstacle() {
  const nowMs = Date.now();

  if (isInvincible || nowMs - lastHitTime < 900) return;

  lastHitTime = nowMs;
  isInvincible = true;
  life -= 1;

  player.style.opacity = "0.42";
  playHitSound();
  updateInfo();

  setTimeout(() => {
    player.style.opacity = "1";
    isInvincible = false;
  }, getCurrentLevelSettings().invincibleTime);

  if (life <= 0) {
    endGame(false);
  }
}

function checkInteractions() {
  if (isRectColliding(player, pearl, 14)) {
    collectPearl();
  }

  obstacles.forEach((obstacle) => {
    if (!obstacle.isActive) return;

    if (isRectColliding(player, obstacle.element, getCurrentLevelSettings().collisionPadding)) {
      hitObstacle();
    }
  });
}

function gameLoop(timestamp) {
  if (!isPlaying) return;

  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.04);
  lastFrameTime = timestamp;

  movePlayer(deltaTime);
  moveObstacles(deltaTime);
  checkInteractions();

  gameLoopId = requestAnimationFrame(gameLoop);
}

function normalizeKey(code) {
  if (code === "KeyW") return "ArrowUp";
  if (code === "KeyA") return "ArrowLeft";
  if (code === "KeyS") return "ArrowDown";
  if (code === "KeyD") return "ArrowRight";

  return code;
}

function setKeyState(code, value) {
  if (Object.prototype.hasOwnProperty.call(keys, code)) {
    keys[code] = value;
  }

  const normalized = normalizeKey(code);

  if (Object.prototype.hasOwnProperty.call(keys, normalized)) {
    keys[normalized] = value;
  }
}

document.addEventListener("keydown", (event) => {
  if (
    event.code === "ArrowUp" ||
    event.code === "ArrowDown" ||
    event.code === "ArrowLeft" ||
    event.code === "ArrowRight" ||
    event.code === "KeyW" ||
    event.code === "KeyA" ||
    event.code === "KeyS" ||
    event.code === "KeyD"
  ) {
    event.preventDefault();

    if (!isPlaying) {
      startGame();
    }

    setKeyState(event.code, true);
  }
});

document.addEventListener("keyup", (event) => {
  setKeyState(event.code, false);

  if (!isMovingKeyPressed()) {
    player.classList.remove("moving");
  }
});

controlButtons.forEach((button) => {
  const key = button.dataset.key;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    if (!isPlaying) {
      startGame();
    }

    setKeyState(key, true);
  });

  button.addEventListener("pointerup", () => {
    setKeyState(key, false);
  });

  button.addEventListener("pointerleave", () => {
    setKeyState(key, false);
  });

  button.addEventListener("pointercancel", () => {
    setKeyState(key, false);
  });
});

startBtn.addEventListener("click", startGame);
resetBtn.addEventListener("click", resetGame);

soundBtn.addEventListener("click", () => {
  resumeAudio();
  audio.sfxEnabled = !audio.sfxEnabled;
  updateSoundButtons();

  if (audio.sfxEnabled) {
    playButtonSound();
  }
});

bgmBtn.addEventListener("click", () => {
  resumeAudio();
  audio.bgmEnabled = !audio.bgmEnabled;
  updateSoundButtons();

  if (audio.bgmEnabled) {
    startBgm();
  } else {
    stopBgm();
  }
});

window.addEventListener("blur", () => {
  resetKeys();
  player.classList.remove("moving");
});

clearRankingBtn.addEventListener("click", () => {
  const shouldClear = confirm("저장된 TOP 10 랭킹을 모두 삭제할까요?");

  if (!shouldClear) return;

  localStorage.removeItem(rankingStorageKey);
  renderRankings();
  playButtonSound();
});

resetGameObjects();
updateInfo();
updateSoundButtons();
renderRankings();
