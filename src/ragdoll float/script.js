const pl = planck, Vec2 = pl.Vec2;
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WORLD_SCALE = 30; // pixels per meter
let world, ground;
let obstacles = [];
// Add at the top near variables
let panX = 0;
let panY = 0;

// For smooth pan speed
const PAN_SPEED = 10;

const panKeys = { left: false, right: false, up: false, down: false };

// CPU control toggle flag
let cpuEnabled = false;

// Keys state
const keys = {
  player1: { left: false, right: false, jump: false },
  player2: { left: false, right: false, jump: false }
};

let jumpCooldowns = {
  player1: false,
  player2: false
};

let player1Score = 0;
let player2Score = 0;
let gameOver = false;

const cpuToggleBtn = document.createElement("button");
cpuToggleBtn.id = "toggleCPU";
cpuToggleBtn.textContent = "Enable CPU for Player 2";
cpuToggleBtn.style.margin = "10px";
document.getElementById("editor").appendChild(cpuToggleBtn);

cpuToggleBtn.addEventListener("click", () => {
  cpuEnabled = !cpuEnabled;
  cpuToggleBtn.textContent = cpuEnabled
    ? "Disable CPU for Player 2"
    : "Enable CPU for Player 2";

  // Reset player2 keys when toggling
  keys.player2.left = false;
  keys.player2.right = false;
  keys.player2.jump = false;
});

window.addEventListener("keydown", (e) => {
  if (e.shiftKey) { // Using Shift + arrow keys for panning
    if (e.code === "ArrowLeft") panKeys.left = true;
    if (e.code === "ArrowRight") panKeys.right = true;
    if (e.code === "ArrowUp") panKeys.up = true;
    if (e.code === "ArrowDown") panKeys.down = true;
    return; // Do not process player controls if shift held for pan
  }

  if (e.code === "KeyA") keys.player1.left = true;
  if (e.code === "KeyD") keys.player1.right = true;
  if (e.code === "KeyW") keys.player1.jump = true;

  if (!cpuEnabled) {
    if (e.code === "ArrowLeft") keys.player2.left = true;
    if (e.code === "ArrowRight") keys.player2.right = true;
    if (e.code === "ArrowUp") keys.player2.jump = true;
  }
});
window.addEventListener("keyup", (e) => {
  if (e.shiftKey) {
    if (e.code === "ArrowLeft") panKeys.left = false;
    if (e.code === "ArrowRight") panKeys.right = false;
    if (e.code === "ArrowUp") panKeys.up = false;
    if (e.code === "ArrowDown") panKeys.down = false;
    return;
  }

  if (e.code === "KeyA") keys.player1.left = false;
  if (e.code === "KeyD") keys.player1.right = false;
  if (e.code === "KeyW") keys.player1.jump = false;

  if (!cpuEnabled) {
    if (e.code === "ArrowLeft") keys.player2.left = false;
    if (e.code === "ArrowRight") keys.player2.right = false;
    if (e.code === "ArrowUp") keys.player2.jump = false;
  }
});

function createWorld() {
  world = new pl.World(Vec2(0,5));
  ground = world.createBody();
  ground.createFixture(pl.Edge(Vec2(0, 19), Vec2(30, 19)), { friction: 0.9 });
  obstacles = [];
}

// Create ragdoll function
function createRagdoll(x, y) {
  const torso = world.createDynamicBody(Vec2(x, y));
  torso.createFixture(pl.Box(0.3, 0.5), { density: 1.0, friction: 0.3 });
  const head = world.createDynamicBody(Vec2(x, y - 0.8));
  head.createFixture(pl.Circle(0.25), { density: 0.5, friction: 0.3 });

  const leftArm = world.createDynamicBody(Vec2(x - 0.5, y));
  leftArm.createFixture(pl.Box(0.15, 0.4), { density: 0.5, friction: 0.3 });
  const rightArm = world.createDynamicBody(Vec2(x + 0.5, y));
  rightArm.createFixture(pl.Box(0.15, 0.4), { density: 0.5, friction: 0.3 });

  const leftLeg = world.createDynamicBody(Vec2(x - 0.2, y + 1));
  leftLeg.createFixture(pl.Box(0.2, 0.5), { density: 0.7, friction: 0.5 });
  const rightLeg = world.createDynamicBody(Vec2(x + 0.2, y + 1));
  rightLeg.createFixture(pl.Box(0.2, 0.5), { density: 0.7, friction: 0.5 });

  world.createJoint(pl.RevoluteJoint({}, torso, head, Vec2(x, y - 0.3)));
  world.createJoint(pl.RevoluteJoint({}, torso, leftArm, Vec2(x - 0.3, y)));
  world.createJoint(pl.RevoluteJoint({}, torso, rightArm, Vec2(x + 0.3, y)));
  world.createJoint(pl.RevoluteJoint({}, torso, leftLeg, Vec2(x - 0.1, y + 0.5)));
  world.createJoint(pl.RevoluteJoint({}, torso, rightLeg, Vec2(x + 0.1, y + 0.5)));

  return { torso, head, leftArm, rightArm, leftLeg, rightLeg };
}

let player1, player2;

// Check if the player is on ground or obstacle below
function isPlayerOnGround(player) {
  const torso = player.torso;
  const p = torso.getPosition();
  let onGround = false;

  const start = Vec2(p.x, p.y + 0.05);
  const end = Vec2(p.x, p.y + 0.15);

  world.rayCast(start, end, (fixture, point, normal, fraction) => {
    if (fixture.getBody() !== torso) {
      onGround = true;
      return 0; // hit detected, stop raycast
    }
    return 1;
  });

  return onGround;
}

function applyControls(player, controls, id) {
  const torso = player.torso;

  if (controls.left) {
    torso.applyForceToCenter(Vec2(-50, -5.9));
  }
  if (controls.right) {
    torso.applyForceToCenter(Vec2(50, -5.9));
  }

  if (controls.jump && !jumpCooldowns[id] && isPlayerOnGround(player)) {
    torso.applyLinearImpulse(Vec2(0, -20), torso.getWorldCenter(), true);
    jumpCooldowns[id] = true;
    setTimeout(() => {
      jumpCooldowns[id] = false;
    }, 300);
  }
}

function drawBody(body, color) {
  ctx.fillStyle = color || "#3498db";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;

  for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
    const shape = fixture.getShape();
    if (shape.getType() === "circle") {
      const pos = body.getPosition();
      const r = shape.getRadius() * WORLD_SCALE;
      ctx.beginPath();
      ctx.arc(pos.x * WORLD_SCALE, pos.y * WORLD_SCALE, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    } else if (shape.getType() === "polygon") {
      const vertices = shape.m_vertices;
      ctx.beginPath();
      vertices.forEach((v, i) => {
        const worldPoint = body.getWorldPoint(v);
        const x = worldPoint.x * WORLD_SCALE;
        const y = worldPoint.y * WORLD_SCALE;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shape.getType() === "edge") {
      const v1 = body.getWorldPoint(shape.m_vertex1);
      const v2 = body.getWorldPoint(shape.m_vertex2);
      ctx.beginPath();
      ctx.moveTo(v1.x * WORLD_SCALE, v1.y * WORLD_SCALE);
      ctx.lineTo(v2.x * WORLD_SCALE, v2.y * WORLD_SCALE);
      ctx.stroke();
    }
  }
}

function addObstacle(x, y, width = 2, height = 0.5) {
  const body = world.createBody({
    position: Vec2(x, y),
    type: "static"
  });
  body.createFixture(pl.Box(width / 2, height / 2));
  obstacles.push(body);
}

function drawObstacles() {
  ctx.fillStyle = "#8e44ad";
  ctx.strokeStyle = "#512b65";
  ctx.lineWidth = 2;
  obstacles.forEach((body) => {
    const fixture = body.getFixtureList();
    if (!fixture) return;
    const shape = fixture.getShape();
    const pos = body.getPosition();

    let w = 0;
    let h = 0;
    if(shape.getType() === "polygon") {
      w = Math.abs(shape.m_vertices[2].x - shape.m_vertices[0].x) * WORLD_SCALE;
      h = Math.abs(shape.m_vertices[2].y - shape.m_vertices[0].y) * WORLD_SCALE;
    }

    ctx.save();
    ctx.translate(pos.x * WORLD_SCALE, pos.y * WORLD_SCALE);
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

// Level Editor
const addObstacleBtn = document.getElementById("addObstacle");
const resetLevelBtn = document.getElementById("resetLevel");
let placingObstacle = false;

addObstacleBtn.addEventListener("click", () => {
  placingObstacle = true;
  addObstacleBtn.textContent = "Click on canvas to place obstacle";
});

resetLevelBtn.addEventListener("click", () => {
  obstacles.forEach((o) => world.destroyBody(o));
  obstacles = [];
  placingObstacle = false;
  addObstacleBtn.textContent = "Add Obstacle";
});

canvas.addEventListener("click", (e) => {
  if (!placingObstacle) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / WORLD_SCALE;
  const y = (e.clientY - rect.top) / WORLD_SCALE;
  addObstacle(x, y);
  placingObstacle = false;
  addObstacleBtn.textContent = "Add Obstacle";
});

// Built-in levels
const builtInLevels = [
  [
    { x: 15, y: 18, w: 10, h: 1.5 },
    { x: 22, y: 17, w: 3, h: 0.5 },
    { x: 28, y: 16, w: 2, h: 0.5 }
  ],
  [
    { x: 8, y: 18.5, w: 6, h: 0.5 },
    { x: 16, y: 17.5, w: 4, h: 0.5 },
    { x: 22, y: 16, w: 3, h: 0.5 },
    { x: 26, y: 15, w: 2, h: 0.5 }
  ],
  [
    { x: 10, y: 18, w: 5, h: 1 },
    { x: 15, y: 17, w: 3, h: 1 },
    { x: 19, y: 16, w: 3, h: 1 },
    { x: 23, y: 15, w: 2, h: 1 }
  ]
];

function loadLevel(levelIndex) {
  obstacles.forEach(o => world.destroyBody(o));
  obstacles = [];

  const lvl = builtInLevels[levelIndex];
  lvl.forEach(o => addObstacle(o.x, o.y, o.w, o.h));

  resetPlayers();
}

function resetPlayers() {
  [player1, player2].forEach(p => {
    if (!p) return;
    Object.values(p).forEach(b => world.destroyBody(b));
  });
  player1 = createRagdoll(5, 15);
  player2 = createRagdoll(10, 15);
}

// Updated CPU control for player2: chase player1 and jump to “get” them
function cpuControl() {
  if (!player2 || !player1) return;

  const torso2 = player2.torso;
  const torso1 = player1.torso;
  const pos2 = torso2.getPosition();
  const pos1 = torso1.getPosition();

  keys.player2.left = false;
  keys.player2.right = false;
  keys.player2.jump = false;

  // Move horizontally towards player1's x position with some buffer
  if (pos2.x < pos1.x - 0.5) {
    keys.player2.right = true;
  } else if (pos2.x > pos1.x + 0.5) {
    keys.player2.left = true;
  }

  // Determine forward direction for raycast (toward movement)
  let direction = 0;
  if (keys.player2.right) direction = 1;
  else if (keys.player2.left) direction = -1;

  // Raycast for obstacles in front
  let obstacleAhead = false;
  if (direction !== 0) {
    const start = Vec2(pos2.x + 0.6 * direction, pos2.y);
    const end = Vec2(pos2.x + 0.6 * direction, pos2.y - 1);

    world.rayCast(start, end, (fixture, point, normal, fraction) => {
      if (fixture.getBody() !== torso2) {
        obstacleAhead = true;
        return 0;
      }
      return 1;
    });
  }

  // Jump if obstacle ahead or if player1 is above and close horizontally
  if ((obstacleAhead && isPlayerOnGround(player2)) ||
      (pos1.y + 1 < pos2.y && Math.abs(pos1.x - pos2.x) < 1 && isPlayerOnGround(player2))) {
    keys.player2.jump = true;
  }
}

function update() {
  if (gameOver) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(panX, panY);

    drawBody(ground, "#666");
    drawObstacles();

    const colors = ["#e74c3c", "#2980b9"];
    [player1, player2].forEach((player, index) => {
      Object.values(player).forEach((body) => drawBody(body, colors[index]));
    });

    displayScores();

    ctx.restore();

    ctx.fillStyle = "black";
    ctx.font = "40px Arial";
    ctx.textAlign = "center";
    const winner =
      player1Score >= 20 ? "Player 1 Wins!" : "Player 2 Wins!";
    ctx.fillText(winner, canvas.width / 2, canvas.height / 2);
    return; // Stop game loop
  }

  // Pan movement update
  if (panKeys.left) panX += PAN_SPEED;
  if (panKeys.right) panX -= PAN_SPEED;
  if (panKeys.up) panY += PAN_SPEED;
  if (panKeys.down) panY -= PAN_SPEED;

  if (cpuEnabled) {
    cpuControl();
  }

  applyControls(player1, keys.player1, "player1");
  applyControls(player2, keys.player2, "player2");

  world.step(1 / 60);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(panX, panY);

  drawBody(ground, "#666");
  drawObstacles();

  const colors = ["#e74c3c", "#2980b9"];
  [player1, player2].forEach((player, index) => {
    Object.values(player).forEach((body) => drawBody(body, colors[index]));
  });

  ctx.restore();

  // Check scoring (when torso passes right edge x=29)
  if (player1.torso.getPosition().x > 29) {
    player1Score++;
    resetPlayers();
  }
  if (player2.torso.getPosition().x > 29) {
    player2Score++;
    resetPlayers();
  }

  if (player1Score >= 20 || player2Score >= 20) {
    gameOver = true;
  }

  displayScores();

  requestAnimationFrame(update);
}

document.querySelectorAll("#levels button")?.forEach(btn => {
  btn.addEventListener("click", () => {
    createWorld();
    loadLevel(Number(btn.dataset.level));
    player1Score = 0;
    player2Score = 0;
    gameOver = false;
  });
});

createWorld();
loadLevel(0);

function displayScores() {
  ctx.fillStyle = 'black';
  ctx.font = '20px Arial';
  ctx.fillText(`Player 1 Score: ${player1Score}`, 20, 30);
  ctx.fillText(`Player 2 Score: ${player2Score}`, 650, 30);
}

update();
