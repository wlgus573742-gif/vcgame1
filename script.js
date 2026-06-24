const gameArea = document.getElementById("gameArea");
const player = document.getElementById("player");
const pearl = document.getElementById("pearl");
const jellyfish = document.getElementById("jellyfish");

const scoreText = document.getElementById("score");
const timeText = document.getElementById("time");
const statusText = document.getElementById("status");

const messagePanel = document.getElementById("messagePanel");
const messageTitle = document.getElementById("messageTitle");
const messageText = document.getElementById("messageText");
const startButton = document.getElementById("startButton");

const game = {
  isPlaying: false,
  score: 0,
  targetScore: 10,
  timeLeft: 30,
  playerX: 80,
  playerY: 200,
  playerSpeed: 5,
  objectSize: 48,
  keys: {},
  timerId: null,
  animationId: null,
  jellyfishX: 340,
  jellyfishY: 150,
  jellyfishSpeedX: 2.2,
  jellyfishSpeedY: 1.8
};

function getGameBounds() {
  return {
    width: gameArea.clientWidth,
    height: gameArea.clientHeight
  };
}

function setPosition(element, x, y) {
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
}

function randomPosition() {
  const bounds = getGameBounds();
  const padding = 24;

  return {
    x: Math.floor(Math.random() * (bounds.width - game.objectSize - padding * 2)) + padding,
    y: Math.floor(Math.random() * (bounds.height - game.objectSize - padding * 2)) + padding
  };
}

function movePearl() {
  const position = randomPosition();
  setPosition(pearl, position.x, position.y);
}

function resetGame() {
  game.isPlaying = true;
  game.score = 0;
  game.timeLeft = 30;
  game.playerX = 80;
  game.playerY = 200;
  game.jellyfishX = 340;
  game.jellyfishY = 150;
  game.jellyfishSpeedX = 2.2;
  game.jellyfishSpeedY = 1.8;
  game.keys = {};

  scoreText.textContent = game.score;
  timeText.textContent = game.timeLeft;
  statusText.textContent = "진행 중";

  setPosition(player, game.playerX, game.playerY);
  setPosition(jellyfish, game.jellyfishX, game.jellyfishY);
  movePearl();

  messagePanel.classList.add("hidden");
}

function startGame() {
  clearInterval(game.timerId);
  cancelAnimationFrame(game.animationId);

  resetGame();

  game.timerId = setInterval(() => {
    game.timeLeft -= 1;
    timeText.textContent = game.timeLeft;

    if (game.timeLeft <= 0) {
      endGame(false, "시간 초과! 진주를 충분히 모으지 못했습니다.");
    }
  }, 1000);

  gameLoop();
}

function endGame(isWin, resultMessage) {
  game.isPlaying = false;

  clearInterval(game.timerId);
  cancelAnimationFrame(game.animationId);

  statusText.textContent = isWin ? "승리" : "패배";

  messageTitle.textContent = isWin ? "승리!" : "패배!";
  messageText.textContent = resultMessage;
  startButton.textContent = "다시 시작";

  messagePanel.classList.remove("hidden");
}

function getRect(element) {
  return element.getBoundingClientRect();
}

function isColliding(elementA, elementB) {
  const a = getRect(elementA);
  const b = getRect(elementB);

  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

function updatePlayer() {
  const bounds = getGameBounds();

  if (game.keys.ArrowLeft) {
    game.playerX -= game.playerSpeed;
  }

  if (game.keys.ArrowRight) {
    game.playerX += game.playerSpeed;
  }

  if (game.keys.ArrowUp) {
    game.playerY -= game.playerSpeed;
  }

  if (game.keys.ArrowDown) {
    game.playerY += game.playerSpeed;
  }

  game.playerX = Math.max(0, Math.min(bounds.width - game.objectSize, game.playerX));
  game.playerY = Math.max(0, Math.min(bounds.height - game.objectSize, game.playerY));

  setPosition(player, game.playerX, game.playerY);
}

function updateJellyfish() {
  const bounds = getGameBounds();

  game.jellyfishX += game.jellyfishSpeedX;
  game.jellyfishY += game.jellyfishSpeedY;

  if (game.jellyfishX <= 0 || game.jellyfishX >= bounds.width - game.objectSize) {
    game.jellyfishSpeedX *= -1;
  }

  if (game.jellyfishY <= 0 || game.jellyfishY >= bounds.height - game.objectSize) {
    game.jellyfishSpeedY *= -1;
  }

  setPosition(jellyfish, game.jellyfishX, game.jellyfishY);
}

function checkGameRules() {
  if (isColliding(player, pearl)) {
    game.score += 1;
    scoreText.textContent = game.score;
    movePearl();

    if (game.score >= game.targetScore) {
      endGame(true, "성공! 제한 시간 안에 진주 10개를 모두 모았습니다.");
    }
  }

  if (isColliding(player, jellyfish)) {
    endGame(false, "해파리에 닿았습니다. 다시 도전해보세요!");
  }
}

function gameLoop() {
  if (!game.isPlaying) {
    return;
  }

  updatePlayer();
  updateJellyfish();
  checkGameRules();

  game.animationId = requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    game.keys[event.key] = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    game.keys[event.key] = false;
  }
});

startButton.addEventListener("click", startGame);

window.addEventListener("resize", () => {
  if (!game.isPlaying) {
    return;
  }

  const bounds = getGameBounds();

  game.playerX = Math.max(0, Math.min(bounds.width - game.objectSize, game.playerX));
  game.playerY = Math.max(0, Math.min(bounds.height - game.objectSize, game.playerY));
  game.jellyfishX = Math.max(0, Math.min(bounds.width - game.objectSize, game.jellyfishX));
  game.jellyfishY = Math.max(0, Math.min(bounds.height - game.objectSize, game.jellyfishY));

  setPosition(player, game.playerX, game.playerY);
  setPosition(jellyfish, game.jellyfishX, game.jellyfishY);
});

setPosition(player, game.playerX, game.playerY);
setPosition(jellyfish, game.jellyfishX, game.jellyfishY);
movePearl();
