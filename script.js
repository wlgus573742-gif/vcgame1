const gameArea = document.getElementById("gameArea");
const player = document.getElementById("player");
const obstacle = document.getElementById("obstacle");
const pearl = document.getElementById("pearl");
const message = document.getElementById("message");

const scoreEl = document.getElementById("score");
const targetScoreEl = document.getElementById("targetScore");
const lifeEl = document.getElementById("life");
const gameStatusEl = document.getElementById("gameStatus");

const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const soundBtn = document.getElementById("soundBtn");
const bgmBtn = document.getElementById("bgmBtn");

const targetScore = 15;

let score = 0;
let life = 3;
let isPlaying = false;
let isJumping = false;
let isInvincible = false;
let collisionTimer = null;
let pearlTimer = null;
let difficultyTimer = null;
let obstacleSpeed = 2;
let pearlSpeed = 2.7;

targetScoreEl.textContent = targetScore;

const audio = {
  ctx: null,
  masterGain: null,
  bgmGain: null,
  sfxGain: null,
  bgmNodes: [],
  bubbleInterval: null,
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
  audio.masterGain.gain.value = 0.85;
  audio.masterGain.connect(audio.ctx.destination);

  audio.bgmGain = audio.ctx.createGain();
  audio.bgmGain.gain.value = 0.2;
  audio.bgmGain.connect(audio.masterGain);

  audio.sfxGain = audio.ctx.createGain();
  audio.sfxGain.gain.value = 0.65;
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
  gain = 0.2,
  destination = audio.sfxGain,
  attack = 0.01,
  release = 0.05,
  detune = 0
}) {
  if (!audio.ctx || !destination) return null;

  const now = audio.ctx.currentTime + startTime;
  const osc = audio.ctx.createOscillator();
  const gainNode = audio.ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  osc.detune.setValueAtTime(detune, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0001), now + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

  osc.connect(gainNode);
  gainNode.connect(destination);

  osc.start(now);
  osc.stop(now + duration + release + 0.03);

  return { osc, gainNode };
}

function playNoise({
  startTime = 0,
  duration = 0.25,
  gain = 0.18,
  filterFrequency = 500,
  destination = audio.sfxGain
}) {
  if (!audio.ctx || !destination) return;

  const now = audio.ctx.currentTime + startTime;
  const bufferSize = audio.ctx.sampleRate * duration;
  const buffer = audio.ctx.createBuffer(1, bufferSize, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = audio.ctx.createBufferSource();
  const filter = audio.ctx.createBiquadFilter();
  const gainNode = audio.ctx.createGain();

  filter.type = "lowpass";
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

  playTone({ frequency: 560, duration: 0.06, gain: 0.08 });
  playTone({ frequency: 760, startTime: 0.04, duration: 0.07, gain: 0.08 });
}

function playStartSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  playTone({ frequency: 180, duration: 0.15, gain: 0.12, type: "sine" });
  playTone({ frequency: 260, startTime: 0.08, duration: 0.18, gain: 0.13, type: "sine" });
  playTone({ frequency: 380, startTime: 0.18, duration: 0.22, gain: 0.12, type: "triangle" });
  playNoise({ startTime: 0, duration: 0.5, gain: 0.08, filterFrequency: 420 });
}

function playMoveSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  const nowMs = Date.now();

  if (nowMs - audio.lastMoveSoundTime < 140) return;

  audio.lastMoveSoundTime = nowMs;

  playTone({ frequency: 520, duration: 0.06, gain: 0.09, type: "sine" });
  playTone({ frequency: 720, startTime: 0.035, duration: 0.07, gain: 0.06, type: "triangle" });
  playNoise({ startTime: 0.02, duration: 0.12, gain: 0.035, filterFrequency: 1200 });
}

function playPearlSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  playTone({ frequency: 880, duration: 0.09, gain: 0.11, type: "triangle" });
  playTone({ frequency: 1175, startTime: 0.08, duration: 0.11, gain: 0.1, type: "triangle" });
  playTone({ frequency: 1568, startTime: 0.17, duration: 0.16, gain: 0.09, type: "sine" });
}

function playHitSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  playTone({ frequency: 130, duration: 0.18, gain: 0.18, type: "sawtooth" });
  playTone({ frequency: 82, startTime: 0.03, duration: 0.28, gain: 0.15, type: "sine" });
  playNoise({ startTime: 0, duration: 0.35, gain: 0.16, filterFrequency: 260 });
}

function playWinSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  const notes = [523, 659, 784, 1046];

  notes.forEach((note, index) => {
    playTone({
      frequency: note,
      startTime: index * 0.12,
      duration: 0.14,
      gain: 0.12,
      type: "triangle"
    });
  });
}

function playGameOverSound() {
  if (!audio.sfxEnabled) return;
  resumeAudio();

  const notes = [392, 294, 220, 130];

  notes.forEach((note, index) => {
    playTone({
      frequency: note,
      startTime: index * 0.13,
      duration: 0.18,
      gain: 0.13,
      type: "sine"
    });
  });

  playNoise({ startTime: 0.08, duration: 0.55, gain: 0.08, filterFrequency: 180 });
}

function startBgm() {
  if (!audio.bgmEnabled) return;

  resumeAudio();

  if (audio.bgmStarted) return;

  audio.bgmStarted = true;

  const now = audio.ctx.currentTime;

  const lowDrone = audio.ctx.createOscillator();
  const lowGain = audio.ctx.createGain();
  lowDrone.type = "sine";
  lowDrone.frequency.setValueAtTime(72, now);
  lowGain.gain.value = 0.16;
  lowDrone.connect(lowGain);
  lowGain.connect(audio.bgmGain);

  const softDrone = audio.ctx.createOscillator();
  const softGain = audio.ctx.createGain();
  softDrone.type = "triangle";
  softDrone.frequency.setValueAtTime(144, now);
  softGain.gain.value = 0.055;
  softDrone.connect(softGain);
  softGain.connect(audio.bgmGain);

  const lfo = audio.ctx.createOscillator();
  const lfoGain = audio.ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 18;
  lfo.connect(lfoGain);
  lfoGain.connect(softDrone.frequency);

  lowDrone.start();
  softDrone.start();
  lfo.start();

  audio.bgmNodes.push(lowDrone, softDrone, lfo);

  audio.bubbleInterval = setInterval(() => {
    if (!audio.bgmEnabled || !audio.bgmStarted) return;

    const randomDelay = Math.random() * 0.8;
    const randomPitch = 620 + Math.random() * 520;

    playTone({
      frequency: randomPitch,
      startTime: randomDelay,
      duration: 0.08,
      gain: 0.025,
      type: "sine",
      destination: audio.bgmGain
    });

    playTone({
      frequency: randomPitch * 1.35,
      startTime: randomDelay + 0.07,
      duration: 0.05,
      gain: 0.018,
      type: "triangle",
      destination: audio.bgmGain
    });
  }, 1800);
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

  if (audio.bubbleInterval) {
    clearInterval(audio.bubbleInterval);
    audio.bubbleInterval = null;
  }
}

function updateSoundButtons() {
  soundBtn.textContent = audio.sfxEnabled ? "효과음 ON" : "효과음 OFF";
  bgmBtn.textContent = audio.bgmEnabled ? "BGM ON" : "BGM OFF";

  soundBtn.classList.toggle("off", !audio.sfxEnabled);
  bgmBtn.classList.toggle("off", !audio.bgmEnabled);
}

function updateInfo() {
  scoreEl.textContent = score;
  lifeEl.textContent = life;

  if (!isPlaying) {
    gameStatusEl.textContent = "대기";
  } else {
    gameStatusEl.textContent = "진행 중";
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

function resetPositions() {
  obstacle.classList.remove("move");
  pearl.classList.remove("move");

  obstacle.style.animation = "none";
  pearl.style.animation = "none";

  void obstacle.offsetWidth;
  void pearl.offsetWidth;

  obstacle.style.animation = "";
  pearl.style.animation = "";
}

function startMovingObjects() {
  obstacle.classList.add("move");
  pearl.classList.add("move");

  obstacle.style.animationDuration = `${obstacleSpeed}s`;
  pearl.style.animationDuration = `${pearlSpeed}s`;
}

function startGame() {
  resumeAudio();
  playButtonSound();

  score = 0;
  life = 3;
  obstacleSpeed = 2;
  pearlSpeed = 2.7;
  isPlaying = true;
  isJumping = false;
  isInvincible = false;

  updateInfo();
  hideMessage();
  resetPositions();
  startMovingObjects();
  startBgm();
  playStartSound();

  startBtn.disabled = true;

  clearInterval(collisionTimer);
  clearInterval(pearlTimer);
  clearInterval(difficultyTimer);

  collisionTimer = setInterval(checkCollision, 40);
  pearlTimer = setInterval(checkPearl, 40);
  difficultyTimer = setInterval(increaseDifficulty, 4500);
}

function resetGame() {
  playButtonSound();

  isPlaying = false;
  isJumping = false;
  isInvincible = false;
  score = 0;
  life = 3;
  obstacleSpeed = 2;
  pearlSpeed = 2.7;

  clearInterval(collisionTimer);
  clearInterval(pearlTimer);
  clearInterval(difficultyTimer);

  collisionTimer = null;
  pearlTimer = null;
  difficultyTimer = null;

  player.classList.remove("jump");
  resetPositions();
  updateInfo();

  startBtn.disabled = false;

  showMessage("심해 진주 줍기", "시작 버튼을 눌러 게임을 시작하세요.");
}

function endGame(isWin) {
  isPlaying = false;

  clearInterval(collisionTimer);
  clearInterval(pearlTimer);
  clearInterval(difficultyTimer);

  collisionTimer = null;
  pearlTimer = null;
  difficultyTimer = null;

  obstacle.classList.remove("move");
  pearl.classList.remove("move");
  startBtn.disabled = false;

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

function jump() {
  if (!isPlaying || isJumping) return;

  isJumping = true;
  player.classList.add("jump");
  playMoveSound();

  setTimeout(() => {
    player.classList.remove("jump");
    isJumping = false;
  }, 620);
}

function isColliding(a, b, padding = 10) {
  const rectA = a.getBoundingClientRect();
  const rectB = b.getBoundingClientRect();

  return !(
    rectA.right - padding < rectB.left + padding ||
    rectA.left + padding > rectB.right - padding ||
    rectA.bottom - padding < rectB.top + padding ||
    rectA.top + padding > rectB.bottom - padding
  );
}

function checkCollision() {
  if (!isPlaying || isInvincible) return;

  if (isColliding(player, obstacle, 14)) {
    life -= 1;
    isInvincible = true;

    playHitSound();
    updateInfo();

    player.style.opacity = "0.45";

    setTimeout(() => {
      player.style.opacity = "1";
      isInvincible = false;
    }, 850);

    if (life <= 0) {
      endGame(false);
    }
  }
}

function checkPearl() {
  if (!isPlaying) return;

  if (isColliding(player, pearl, 16)) {
    score += 1;
    updateInfo();
    playPearlSound();

    pearl.classList.remove("move");
    void pearl.offsetWidth;
    pearl.classList.add("move");

    pearl.style.animationDuration = `${pearlSpeed}s`;

    if (score >= targetScore) {
      endGame(true);
    }
  }
}

function increaseDifficulty() {
  if (!isPlaying) return;

  obstacleSpeed = Math.max(1.15, obstacleSpeed - 0.12);
  pearlSpeed = Math.max(1.55, pearlSpeed - 0.08);

  obstacle.style.animationDuration = `${obstacleSpeed}s`;
  pearl.style.animationDuration = `${pearlSpeed}s`;
}

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

gameArea.addEventListener("click", () => {
  if (!isPlaying) return;
  jump();
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();

    if (!isPlaying) {
      startGame();
      return;
    }

    jump();
  }
});

updateInfo();
updateSoundButtons();
