const gameArea = document.getElementById("gameArea");
const player = document.getElementById("player");
const pearl = document.getElementById("pearl");
const obstacleOne = document.getElementById("obstacleOne");
const obstacleTwo = document.getElementById("obstacleTwo");
const obstacleThree = document.getElementById("obstacleThree");
const message = document.getElementById("message");

const scoreEl = document.getElementById("score");
const targetScoreEl = document.getElementById("targetScore");
const lifeEl = document.getElementById("life");
const gameStatusEl = document.getElementById("gameStatus");

const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const soundBtn = document.getElementById("soundBtn");
const bgmBtn = document.getElementById("bgmBtn");
const controlButtons = document.querySelectorAll(".control-btn");

const targetScore = 15;
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
    vy: 54
  },
  {
    element: obstacleTwo,
    x: 520,
    y: 285,
    vx: -70,
    vy: 76
  },
  {
    element: obstacleThree,
    x: 190,
    y: 315,
    vx: 92,
    vy: -62
  }
];

targetScoreEl.textContent = targetScore;

const audio = {
  ctx: null,
  masterGain: null,
  bgmGain: null,
  sfxGain: null,
  bgmNodes: [],
  waterInterval: null,
  sparkleInterval: null,
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
  audio.bgmGain.gain.value = 0.22;
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
  detune = 0
}) {
  if (!audio.ctx || !destination) return;

  const now = audio.ctx.currentTime + startTime;
  const oscillator = audio.ctx.createOscillator();
  const gainNode = audio.ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
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

  const notes = [523, 659, 784, 1046, 1318];

  notes.forEach((note, index) => {
    playTone({
      frequency: note,
      startTime: index * 0.11,
      duration: 0.16,
      gain: 0.1,
      type: "triangle"
    });
  });
}

function playGameOverSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  const notes = [392, 294, 220, 147];

  notes.forEach((note, index) => {
    playTone({
      frequency: note,
      startTime: index * 0.13,
      duration: 0.18,
      gain: 0.12,
      type: "sine"
    });
  });

  playNoise({ startTime: 0.06, duration: 0.5, gain: 0.07, filterFrequency: 220 });
}

function startBgm() {
  if (!audio.bgmEnabled) return;

  resumeAudio();

  if (audio.bgmStarted) return;

  audio.bgmStarted = true;

  const now = audio.ctx.currentTime;

  const padOne = audio.ctx.createOscillator();
  const padOneGain = audio.ctx.createGain();
  padOne.type = "sine";
  padOne.frequency.setValueAtTime(261.63, now);
  padOneGain.gain.value = 0.035;
  padOne.connect(padOneGain);
  padOneGain.connect(audio.bgmGain);

  const padTwo = audio.ctx.createOscillator();
  const padTwoGain = audio.ctx.createGain();
  padTwo.type = "triangle";
  padTwo.frequency.setValueAtTime(392.0, now);
  padTwoGain.gain.value = 0.024;
  padTwo.connect(padTwoGain);
  padTwoGain.connect(audio.bgmGain);

  const lfo = audio.ctx.createOscillator();
  const lfoGain = audio.ctx.createGain();
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 8;
  lfo.connect(lfoGain);
  lfoGain.connect(padTwo.frequency);

  padOne.start();
  padTwo.start();
  lfo.start();

  audio.bgmNodes.push(padOne, padTwo, lfo);

  audio.waterInterval = setInterval(() => {
    if (!audio.bgmEnabled || !audio.bgmStarted) return;

    const delay = Math.random() * 0.7;
    const basePitch = 850 + Math.random() * 650;

    playTone({
      frequency: basePitch,
      startTime: delay,
      duration: 0.08,
      gain: 0.018,
      type: "sine",
      destination: audio.bgmGain,
      release: 0.16
    });

    playTone({
      frequency: basePitch * 1.5,
      startTime: delay + 0.08,
      duration: 0.05,
      gain: 0.012,
      type: "triangle",
      destination: audio.bgmGain,
      release: 0.12
    });

    playNoise({
      startTime: delay,
      duration: 0.28,
      gain: 0.012,
      filterFrequency: 2400,
      filterType: "highpass",
      destination: audio.bgmGain
    });
  }, 1450);

  audio.sparkleInterval = setInterval(() => {
    if (!audio.bgmEnabled || !audio.bgmStarted) return;

    const melody = [659, 784, 880, 988, 1175];
    const note = melody[Math.floor(Math.random() * melody.length)];

    playTone({
      frequency: note,
      duration: 0.18,
      gain: 0.014,
      type: "sine",
      destination: audio.bgmGain,
      release: 0.28
    });
  }, 3200);
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

  if (audio.waterInterval) {
    clearInterval(audio.waterInterval);
    audio.waterInterval = null;
  }

  if (audio.sparkleInterval) {
    clearInterval(audio.sparkleInterval);
    audio.sparkleInterval = null;
  }
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
    Math.abs(x - playerState.x) < 120 &&
    Math.abs(y - playerState.y) < 120
  );

  return { x, y };
}

function updateInfo() {
  scoreEl.textContent = score;
  lifeEl.textContent = life;
  gameStatusEl.textContent = isPlaying ? "진행 중" : "대기";
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

  obstacles.forEach((obstacle) => {
    applyPosition(obstacle.element, obstacle.x, obstacle.y);
  });
}

function startGame() {
  resumeAudio();
  playButtonSound();

  score = 0;
  life = 3;
  difficultyLevel = 1;
  isPlaying = true;
  isInvincible = false;
  lastFrameTime = 0;
  lastHitTime = 0;

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
  lastFrameTime = 0;
  lastHitTime = 0;

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

  showMessage("심해 진주 줍기", "게임 시작을 누른 뒤 방향키로 움직이세요.");
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
    showMessage("성공!", "목표 진주를 모두 모았습니다!");
    playWinSound();
  } else {
    gameStatusEl.textContent = "실패";
    showMessage("게임 오버", "장애물에 너무 많이 부딪혔습니다.");
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
  const speedBoost = 1 + (difficultyLevel - 1) * 0.08;

  obstacles.forEach((obstacle) => {
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
  }, 900);

  if (life <= 0) {
    endGame(false);
  }
}

function checkInteractions() {
  if (isRectColliding(player, pearl, 14)) {
    collectPearl();
  }

  obstacles.forEach((obstacle) => {
    if (isRectColliding(player, obstacle.element, 14)) {
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

resetGameObjects();
updateInfo();
updateSoundButtons();
