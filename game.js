const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  stageLabel: document.getElementById('stageLabel'),
  lapCurrent: document.getElementById('lapCurrent'),
  raceTime: document.getElementById('raceTime'),
  bestTime: document.getElementById('bestTime'),
  speedValue: document.getElementById('speedValue'),
  speedFill: document.getElementById('speedFill'),
  gearLabel: document.getElementById('gearLabel'),
  checkpointToast: document.getElementById('checkpointToast'),
  countdown: document.getElementById('countdown'),
  welcomePanel: document.getElementById('welcomePanel'),
  pausePanel: document.getElementById('pausePanel'),
  finishPanel: document.getElementById('finishPanel'),
  pauseButton: document.getElementById('pauseButton'),
  startButton: document.getElementById('startButton'),
  resumeButton: document.getElementById('resumeButton'),
  restartButton: document.getElementById('restartButton'),
  againButton: document.getElementById('againButton'),
  changeStageButton: document.getElementById('changeStageButton'),
  finalTime: document.getElementById('finalTime'),
  recordLabel: document.getElementById('recordLabel'),
  finishHeading: document.getElementById('finishHeading'),
  finishMessage: document.getElementById('finishMessage'),
  menuBest: document.getElementById('menuBest'),
  terrainLabel: document.getElementById('terrainLabel'),
  soundButton: document.getElementById('soundButton'),
  soundIcon: document.getElementById('soundIcon'),
  stageOptions: [...document.querySelectorAll('.stage-option')],
  touchControls: document.getElementById('touchControls'),
  touchButtons: [...document.querySelectorAll('[data-control]')]
};

const stageConfigs = [
  {
    name: 'Pine Valley',
    tag: 'STAGE 01',
    subtitle: 'THE FOREST IS CALLING',
    color: '#8de6a8',
    track: {
      roadWidth: 240,
      curves: [
        { x: 0.12, amplitude: 40, phase: 0.2, freq: 0.87 },
        { x: 0.38, amplitude: 86, phase: 1.8, freq: 0.63 },
        { x: 0.62, amplitude: 72, phase: 2.9, freq: 0.7 },
        { x: 0.8, amplitude: 56, phase: 4.2, freq: 0.58 }
      ]
    }
  },
  {
    name: 'Alpine Pass',
    tag: 'STAGE 02',
    subtitle: 'ICE IS YOUR ADVERSARY',
    color: '#bfe6ff',
    track: {
      roadWidth: 220,
      curves: [
        { x: 0.14, amplitude: 64, phase: 0.7, freq: 0.72 },
        { x: 0.32, amplitude: 98, phase: 2.2, freq: 0.58 },
        { x: 0.58, amplitude: 88, phase: 3.8, freq: 0.7 },
        { x: 0.82, amplitude: 74, phase: 5.2, freq: 0.62 }
      ]
    }
  },
  {
    name: 'Dust Canyon',
    tag: 'STAGE 03',
    subtitle: 'THE DESERT LEANS IN',
    color: '#ffd29f',
    track: {
      roadWidth: 260,
      curves: [
        { x: 0.18, amplitude: 76, phase: 0.8, freq: 0.8 },
        { x: 0.42, amplitude: 100, phase: 1.9, freq: 0.66 },
        { x: 0.62, amplitude: 118, phase: 3.1, freq: 0.56 },
        { x: 0.88, amplitude: 96, phase: 4.5, freq: 0.6 }
      ]
    }
  }
];

const state = {
  selectedStage: 0,
  running: false,
  paused: false,
  completed: false,
  countdownValue: 0,
  countdownTimer: null,
  countdownId: 0,
  startedAt: 0,
  lapStart: 0,
  raceTime: 0,
  bestTime: Number.POSITIVE_INFINITY,
  lap: 1,
  totalLaps: 3,
  checkpointIndex: 0,
  stageProgress: 0,
  stageDistance: 0,
  worldTime: 0,
  lastTs: 0,
  particles: [],
  cameraShake: 0,
  soundOn: true,
  audioCtx: null,
  driftPast: 0,
  resetPending: false,
  triggeredFinish: false,
  controls: {
    left: false,
    right: false,
    gas: false,
    brake: false,
    drift: false
  },
  input: {
    left: false,
    right: false,
    gas: false,
    brake: false,
    drift: false
  },
  car: {
    x: 0,
    y: 0,
    speed: 0,
    maxSpeed: 0,
    steer: 0,
    heading: 0,
    drift: 0,
    wheelSpin: 0,
    routeProgress: 0,
    direction: 1,
    laneOffset: 0,
    boost: 0,
    lastCheckpoint: 0
  }
};

const track = { totalDistance: 0, checkpoints: [], road: [] };

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function formatTime(ms) {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const hundredths = Math.floor((total % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

function getCurrentStage() {
  return stageConfigs[state.selectedStage];
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function createTrack(stageIndex) {
  const stage = stageConfigs[stageIndex];
  const points = [];
  const total = 1600;
  const curves = stage.track.curves;
  for (let i = 0; i <= total; i += 1) {
    const t = i / total;
    let center = 0;
    for (const curve of curves) {
      center += Math.sin(t * (Math.PI * 2.2) * curve.freq + curve.phase) * curve.amplitude * (1 / (curves.length * 0.9));
    }
    const x = t * (stage.track.roadWidth * 1.3);
    const y = center + (Math.sin(t * 18 + stageIndex) * 18);
    points.push({ x, y, t });
  }

  const checkpoints = [];
  const checkpointCount = 5;
  for (let i = 0; i < checkpointCount; i += 1) {
    const t = (i + 1) / checkpointCount;
    checkpoints.push({ t, x: t * 100, y: 0 });
  }

  const road = [];
  for (let i = 0; i <= total; i += 1) {
    const p = points[i];
    const multiplier = (i / total) * 1.2 + 0.35;
    const width = stage.track.roadWidth * multiplier;
    const segment = {
      x: p.x,
      y: p.y,
      width,
      t: p.t,
      angle: Math.atan2((points[Math.min(i + 1, total)].y - p.y), 0.7),
    };
    road.push(segment);
  }

  TrackHelper.buildRuntimeRoad(stage, road, checkpoints);
  track.totalDistance = total;
  track.checkpoints = checkpoints;
  track.road = road;
}

const TrackHelper = {
  buildRuntimeRoad(stage, road, checkpoints) {
    const roadWidthBase = stage.track.roadWidth;
    for (let i = 0; i < checkpoints.length; i += 1) {
      const cp = checkpoints[i];
      const index = Math.floor(cp.t * (road.length - 1));
      cp.x = road[index].x;
      cp.y = road[index].y;
      cp.width = roadWidthBase * (0.8 + i * 0.12);
      cp.angle = road[index].angle;
    }
  }
};

function getRoadAt(progress) {
  const safeProgress = clamp(progress, 0, track.totalDistance);
  const index = Math.floor((safeProgress / track.totalDistance) * (track.road.length - 1));
  return track.road[Math.min(index, track.road.length - 1)] || track.road[0];
}

function setStage(stageIndex) {
  state.selectedStage = clamp(stageIndex, 0, stageConfigs.length - 1);
  ui.stageOptions.forEach((button, index) => {
    button.classList.toggle('selected', index === state.selectedStage);
  });
  const stage = getCurrentStage();
  ui.stageLabel.textContent = stage.name.toUpperCase();
  ui.terrainLabel.textContent = stage.subtitle;
  document.title = `Rally Rush — ${stage.name}`;
  createTrack(state.selectedStage);
  applySavedBest();
  resetRace(true);
}

function makeParticles(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 30 + Math.random() * 35,
      size: 2 + Math.random() * 4,
      color
    });
  }
}

function playTone(type = 'tick', volume = 0.04) {
  if (!state.soundOn) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!state.audioCtx) state.audioCtx = new AudioCtx();
  if (state.audioCtx.state === 'suspended') state.audioCtx.resume();

  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();
  osc.connect(gain);
  gain.connect(state.audioCtx.destination);

  const settings = {
    tick: { freq: 220, end: 120, time: 0.07 },
    drift: { freq: 90, end: 58, time: 0.12 },
    checkpoint: { freq: 420, end: 280, time: 0.12 },
    crash: { freq: 70, end: 42, time: 0.16 },
    win: { freq: 580, end: 340, time: 0.22 }
  }[type] || settings.tick;

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(settings.freq, state.audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(settings.end, state.audioCtx.currentTime + settings.time);
  gain.gain.setValueAtTime(volume, state.audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + settings.time);
  osc.start();
  osc.stop(state.audioCtx.currentTime + settings.time + 0.01);
}

function setCountdown(value) {
  if (!value) {
    ui.countdown.textContent = '';
    ui.countdown.classList.remove('visible');
    return;
  }
  ui.countdown.textContent = value;
  ui.countdown.classList.add('visible');
}

function cancelCountdown() {
  state.countdownId += 1;
  if (state.countdownTimer !== null) {
    clearTimeout(state.countdownTimer);
    state.countdownTimer = null;
  }
  state.countdownValue = 0;
  setCountdown(0);
}

function showCheckpointToast(index, force = false) {
  if (!force && index === state.checkpointIndex) return;
  ui.checkpointToast.innerHTML = `CHECKPOINT <b>${String(index).padStart(2,'0')}</b>`;
  ui.checkpointToast.classList.add('visible');
  clearTimeout(showCheckpointToast.timeout);
  showCheckpointToast.timeout = setTimeout(() => {
    ui.checkpointToast.classList.remove('visible');
  }, 900);
}

function resetRace(showMenu = true) {
  cancelCountdown();
  const stage = getCurrentStage();
  state.running = false;
  state.paused = false;
  state.completed = false;
  state.resetPending = false;
  state.triggeredFinish = false;
  state.startedAt = 0;
  state.lapStart = 0;
  state.raceTime = 0;
  state.lap = 1;
  state.checkpointIndex = 0;
  state.stageProgress = 0;
  state.worldTime = 0;
  state.particles = [];
  state.cameraShake = 0;
  state.driftPast = 0;
  state.input.left = false;
  state.input.right = false;
  state.input.gas = false;
  state.input.brake = false;
  state.input.drift = false;
  syncInputs();
  state.car.x = 0;
  state.car.y = 0;
  state.car.speed = 0;
  state.car.maxSpeed = 210 + stageIndexToSpeedBonus(state.selectedStage);
  state.car.steer = 0;
  state.car.heading = 0;
  state.car.drift = 0;
  state.car.wheelSpin = 0;
  state.car.routeProgress = 0;
  state.car.direction = 1;
  state.car.laneOffset = 0;
  state.car.boost = 0;
  state.car.lastCheckpoint = 0;
  ui.raceTime.textContent = '00:00.00';
  ui.lapCurrent.textContent = String(state.lap);
  ui.speedValue.textContent = '000';
  ui.gearLabel.textContent = 'GEAR 1';
  ui.speedFill.style.width = '0%';
  ui.bestTime.textContent = `BEST ${state.bestTime === Number.POSITIVE_INFINITY ? '—' : formatTime(state.bestTime)}`;
  ui.pauseButton.classList.add('hidden');
  ui.pausePanel.classList.add('hidden');
  try {
    ui.finishPanel.classList.add('hidden');
  } catch (e) {}
  if (showMenu) {
    ui.welcomePanel.classList.remove('hidden');
  } else {
    ui.welcomePanel.classList.add('hidden');
  }
  ui.finalTime.textContent = '00:00.00';
  ui.recordLabel.textContent = 'PERSONAL BEST';
}

function stageIndexToSpeedBonus(index) {
  return [0, 12, 26][index] || 0;
}

function startCountdown() {
  const stage = getCurrentStage();
  const countdownId = ++state.countdownId;
  ui.pauseButton.classList.add('hidden');
  ui.welcomePanel.classList.add('hidden');
  ui.finishPanel.classList.add('hidden');
  ui.pausePanel.classList.add('hidden');
  state.running = false;
  state.paused = false;
  let count = 3;
  state.countdownValue = count;
  setCountdown(count);

  const tick = () => {
    if (countdownId !== state.countdownId) return;
    count -= 1;
    if (count > 0) {
      state.countdownValue = count;
      setCountdown(count);
      state.countdownTimer = setTimeout(tick, 600);
      return;
    }

    state.countdownValue = 0;
    setCountdown('GO');
    state.countdownTimer = setTimeout(() => {
      if (countdownId !== state.countdownId) return;
      state.countdownTimer = null;
      setCountdown(0);
      state.running = true;
      state.startedAt = performance.now();
      state.lapStart = state.startedAt;
      state.worldTime = 0;
      state.stageProgress = 0;
      state.lastTs = state.startedAt;
      state.checkpointIndex = 0;
      ui.stageLabel.textContent = stage.name.toUpperCase();
      ui.pauseButton.classList.remove('hidden');
      showCheckpointToast(1, true);
      playTone('checkpoint', 0.06);
      state.car.speed = 0;
    }, 400);
  };

  state.countdownTimer = setTimeout(tick, 600);
}

function startRace() {
  resetRace(false);
  startCountdown();
}

function updateHUD() {
  const speedPct = clamp((state.car.speed / state.car.maxSpeed) * 100, 0, 100);
  ui.speedValue.textContent = String(Math.round(Math.abs(state.car.speed) * 1.4)).padStart(3, '0');
  ui.speedFill.style.width = `${speedPct}%`;
  const gear = Math.max(1, Math.min(6, Math.floor(Math.abs(state.car.speed) / 28) + 1));
  ui.gearLabel.textContent = `GEAR ${gear}`;
  ui.raceTime.textContent = formatTime(state.raceTime);
  ui.lapCurrent.textContent = String(state.lap);
  if (state.bestTime !== Number.POSITIVE_INFINITY) {
    ui.bestTime.textContent = `BEST ${formatTime(state.bestTime)}`;
  } else {
    ui.bestTime.textContent = 'BEST —';
  }
}

function getProgressPercent() {
  return clamp((state.car.routeProgress / (track.totalDistance * state.totalLaps)) * 100, 0, 100);
}

function updateTrackProgress() {
  const totalLength = track.totalDistance * state.totalLaps;
  const progress = state.car.routeProgress;
  state.stageProgress = progress;
  const lapProgress = progress % track.totalDistance;
  const currentLap = Math.min(state.totalLaps, Math.floor(progress / track.totalDistance) + 1);

  if (state.running && !state.paused) {
    if (currentLap > state.lap) {
      state.lap = currentLap;
      state.lapStart = performance.now();
      state.checkpointIndex = 0;
      playTone('checkpoint', 0.06);
    }

    const checkpointT = (state.checkpointIndex + 1) / 5;
    if (state.checkpointIndex < 4 && lapProgress > checkpointT * track.totalDistance) {
      state.checkpointIndex += 1;
      showCheckpointToast(state.checkpointIndex + 1, true);
      playTone('checkpoint', 0.08);
    }
  }

  if (state.running && !state.paused && progress >= totalLength && !state.triggeredFinish) {
    finishRace();
  }
}

function alwaysPositiveAngle(a) {
  let result = a % (Math.PI * 2);
  if (result < 0) result += Math.PI * 2;
  return result;
}

function updateCar(dt) {
  const inputs = state.controls;
  const stage = getCurrentStage();
  const targetMaxSpeed = 210 + stageIndexToSpeedBonus(state.selectedStage);
  let accel = 0;
  if (inputs.gas) accel += 1.5;
  if (inputs.brake) accel -= 1.9;
  if (!inputs.gas && !inputs.brake) accel -= 0.26;
  state.car.speed += accel * dt * 26;
  state.car.speed = clamp(state.car.speed, -50, targetMaxSpeed);

  let steering = 0;
  if (inputs.left) steering -= 1;
  if (inputs.right) steering += 1;
  if (inputs.drift) {
    state.car.drift = lerp(state.car.drift, 1, 0.14);
    state.car.speed *= 0.998;
    playTone('drift', 0.014);
  } else {
    state.car.drift = lerp(state.car.drift, 0, 0.12);
  }
  if (!inputs.gas && !inputs.brake && Math.abs(state.car.speed) < 12) {
    state.car.speed = lerp(state.car.speed, 0, 0.12);
  }

  const turnRate = 1.3 + Math.abs(state.car.speed) * 0.012;
  const roadBend = getRoadAt(state.car.routeProgress).angle * 0.08;
  state.car.heading += (steering * turnRate + roadBend) * dt * 0.7 * (0.4 + Math.abs(state.car.speed) / 180);
  state.car.heading = ((state.car.heading + Math.PI * 2) % (Math.PI * 2));

  const forward = { x: Math.cos(state.car.heading), y: Math.sin(state.car.heading) };
  const laneBias = (Math.sin(state.car.routeProgress * 0.02) * 18) + (state.car.laneOffset * 10);
  const roadPoint = getRoadAt(state.car.routeProgress);
  const roadX = roadPoint.x + Math.sin(state.car.routeProgress * 0.04 + state.selectedStage) * 20;
  state.car.x = roadX + forward.x * (state.car.speed * 0.12) + laneBias * 0.2;
  state.car.y = roadPoint.y + forward.y * (state.car.speed * 0.12) + Math.cos(state.car.routeProgress * 0.03) * 16;

  state.car.routeProgress += state.car.speed * dt * 1.4;
  state.car.routeProgress = clamp(state.car.routeProgress, 0, track.totalDistance * state.totalLaps);
  state.car.laneOffset = clamp(state.car.laneOffset + steering * dt * 0.8, -1, 1);

  if (state.car.speed > 20 && inputs.drift) {
    state.car.wheelSpin += dt * (state.car.speed / 12);
  }

  if (Math.abs(state.car.speed) > 0.2) {
    state.cameraShake = lerp(state.cameraShake, state.car.drift * 3 + Math.abs(state.car.speed) * 0.02, 0.08);
  }

}

function finishRace() {
  state.running = false;
  state.completed = true;
  state.triggeredFinish = true;
  state.raceTime = performance.now() - state.startedAt;
  const stageTime = Math.max(1, state.raceTime);
  const isNewBest = stageTime < state.bestTime;
  if (isNewBest) {
    state.bestTime = stageTime;
    localStorage.setItem(`rally-rush-best-${state.selectedStage}`, String(stageTime));
  }

  ui.finalTime.textContent = formatTime(state.raceTime);
  ui.recordLabel.textContent = isNewBest ? 'NEW PERSONAL BEST' : 'PERSONAL BEST';
  ui.menuBest.textContent = formatTime(state.bestTime);

  const stage = getCurrentStage();
  ui.finishHeading.innerHTML = `${stage.name.split(' ')[0].toUpperCase()}<br /><span>${stage.name.toUpperCase().split(' ')[1] || 'RACE'}</span>`;
  ui.finishMessage.textContent = isNewBest
    ? 'Perfect apexes. Clean braking. Total control.'
    : 'A strong finish. One more run could get you the record.';
  ui.finishPanel.classList.remove('hidden');
  ui.pauseButton.classList.add('hidden');
  playTone('win', 0.12);
}

function applySavedBest() {
  const stored = Number(localStorage.getItem(`rally-rush-best-${state.selectedStage}`) || 'Infinity');
  state.bestTime = Number.isFinite(stored) ? stored : Number.POSITIVE_INFINITY;
  ui.bestTime.textContent = `BEST ${state.bestTime === Number.POSITIVE_INFINITY ? '—' : formatTime(state.bestTime)}`;
  ui.menuBest.textContent = state.bestTime === Number.POSITIVE_INFINITY ? '—' : formatTime(state.bestTime);
}

function drawBackground() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const stage = getCurrentStage();
  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#1b302d');
  sky.addColorStop(0.5, '#101d1b');
  sky.addColorStop(1, '#060d0d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const hillColors = [
    'rgba(90, 131, 112, 0.9)',
    'rgba(54, 90, 75, 0.85)',
    'rgba(32, 58, 50, 0.95)'
  ];
  for (let i = 0; i < hillColors.length; i += 1) {
    ctx.fillStyle = hillColors[i];
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 80) {
      const y = height * (0.52 + i * 0.16) + Math.sin((x + i * 400) * 0.008) * (26 + i * 18);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  const roadStartY = height * 0.62;
  const roadBottomY = height * 0.85;
  ctx.fillStyle = 'rgba(18, 18, 17, 0.9)';
  ctx.fillRect(0, roadStartY, width, roadBottomY - roadStartY);

  for (let i = 0; i < 16; i += 1) {
    const x = (i / 16) * width;
    const stripe = (i % 2 === 0) ? stage.color : 'rgba(255,255,255,0.26)';
    ctx.fillStyle = stripe;
    ctx.fillRect(x, roadStartY, 18, roadBottomY - roadStartY);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i += 1) {
    const y = roadStartY + (i / 10) * (roadBottomY - roadStartY);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(15, 17, 18, 0.75)';
  ctx.fillRect(0, roadBottomY, width, height - roadBottomY);
}

function drawRoad() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const road = track.road;
  if (!road.length) return;

  const viewStart = Math.max(0, state.car.routeProgress - 50);
  const viewEnd = Math.min(track.totalDistance * state.totalLaps, state.car.routeProgress + 220);
  const worldToScreen = (progress, offset) => {
    const x = ((progress - viewStart) / (viewEnd - viewStart)) * width;
    const roadCurve = getRoadAt(progress).x;
    const y = height * 0.62 + (offset * 0.7) + (roadCurve * 0.2);
    return { x, y };
  };

  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let i = 0; i <= 120; i += 1) {
    const progress = lerp(viewStart, viewEnd, i / 120);
    const p = getRoadAt(progress);
    const x = ((progress - viewStart) / (viewEnd - viewStart)) * width;
    const y = height * 0.62 + (p.y * 0.7);
    if (i === 0) ctx.moveTo(x, y);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = 'rgba(38, 39, 37, 0.96)';
  ctx.fill();

  for (let i = 0; i < 90; i += 1) {
    const progress = lerp(viewStart, viewEnd, i / 90);
    const p = getRoadAt(progress);
    const x = ((progress - viewStart) / (viewEnd - viewStart)) * width;
    const y = height * 0.62 + (p.y * 0.7);
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.18)';
    ctx.fillRect(x - 4, y - 18, 8, 36);
  }

  const carScreenX = width * 0.5;
  const carScreenY = height * 0.64 + state.car.y * 0.08;
  const carRotation = state.car.heading;
  const carLength = 40;
  const carWidth = 18;
  ctx.save();
  ctx.translate(carScreenX, carScreenY);
  ctx.rotate(carRotation);
  ctx.fillStyle = '#f6f6f6';
  ctx.fillRect(-carLength / 2, -carWidth / 2, carLength, carWidth);
  ctx.fillStyle = '#d24d44';
  ctx.fillRect(carLength / 2 - 8, -carWidth / 2 + 3, 10, carWidth - 6);
  ctx.fillStyle = '#1c1f1f';
  ctx.fillRect(-carLength / 2 + 6, -carWidth / 2 + 3, 18, 4);
  ctx.fillRect(-carLength / 2 + 6, carWidth / 2 - 7, 18, 4);
  ctx.restore();
}

function drawParticles() {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    ctx.fillStyle = p.color.replace(')', `, ${clamp(p.life / 60, 0, 1)})`).replace('rgb', 'rgba');
    ctx.fillRect(p.x, p.y, p.size, p.size);
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function drawScene() {
  drawBackground();
  drawRoad();
  drawParticles();
}

function gameLoop(ts) {
  const dt = Math.min((ts - state.lastTs) / 1000 || 0.016, 0.033);
  state.lastTs = ts;

  if (state.running && !state.paused) {
    state.raceTime = ts - state.startedAt;
    state.worldTime += dt;
    updateCar(dt);
    updateTrackProgress();
    if (state.car.speed > 42 && Math.random() < 0.24) {
      const dustX = canvas.clientWidth * 0.5 + (Math.random() - 0.5) * 55;
      const dustY = canvas.clientHeight * 0.64 + (Math.random() - 0.5) * 14;
      makeParticles(dustX, dustY, 2, 'rgba(194, 163, 101, 0.7)');
    }
  }
  updateHUD();
  drawScene();
  requestAnimationFrame(gameLoop);
}

function syncInputs() {
  state.controls.left = state.input.left;
  state.controls.right = state.input.right;
  state.controls.gas = state.input.gas;
  state.controls.brake = state.input.brake;
  state.controls.drift = state.input.drift;
}

function togglePause(force) {
  if (!state.running) return;
  state.paused = typeof force === 'boolean' ? force : !state.paused;
  ui.pausePanel.classList.toggle('hidden', !state.paused);
  ui.pauseButton.classList.toggle('hidden', state.paused);
}

function bindControl(control, pressed) {
  state.input[control] = pressed;
  syncInputs();
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') bindControl('gas', true);
  if (key === 's' || key === 'arrowdown') bindControl('brake', true);
  if (key === 'a' || key === 'arrowleft') bindControl('left', true);
  if (key === 'd' || key === 'arrowright') bindControl('right', true);
  if (key === ' ') {
    event.preventDefault();
    bindControl('drift', true);
  }
  if (key === 'p' || key === 'escape') {
    if (state.running && !state.completed) togglePause();
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') bindControl('gas', false);
  if (key === 's' || key === 'arrowdown') bindControl('brake', false);
  if (key === 'a' || key === 'arrowleft') bindControl('left', false);
  if (key === 'd' || key === 'arrowright') bindControl('right', false);
  if (key === ' ') bindControl('drift', false);
});

ui.startButton.addEventListener('click', () => {
  startRace();
});
ui.resumeButton.addEventListener('click', () => {
  togglePause(false);
});
ui.restartButton.addEventListener('click', () => {
  state.running = false;
  ui.pausePanel.classList.add('hidden');
  startRace();
});
ui.againButton.addEventListener('click', () => {
  state.completed = false;
  ui.finishPanel.classList.add('hidden');
  startRace();
});
ui.changeStageButton.addEventListener('click', () => {
  ui.finishPanel.classList.add('hidden');
  ui.welcomePanel.classList.remove('hidden');
  state.running = false;
  state.completed = false;
  resetRace(true);
});
ui.pauseButton.addEventListener('click', () => togglePause(true));

ui.stageOptions.forEach((button) => {
  button.addEventListener('click', () => {
    const index = Number(button.dataset.stage);
    setStage(index);
  });
});

ui.soundButton.addEventListener('click', () => {
  state.soundOn = !state.soundOn;
  ui.soundIcon.textContent = state.soundOn ? '♪' : '🔇';
  if (state.soundOn) playTone('tick', 0.05);
});

ui.touchButtons.forEach((button) => {
  const control = button.dataset.control;
  const hold = (pressed) => {
    if (control === 'left') bindControl('left', pressed);
    if (control === 'right') bindControl('right', pressed);
    if (control === 'gas') bindControl('gas', pressed);
    if (control === 'brake') bindControl('brake', pressed);
    if (control === 'drift') bindControl('drift', pressed);
  };
  button.addEventListener('pointerdown', () => hold(true));
  button.addEventListener('pointerup', () => hold(false));
  button.addEventListener('pointerleave', () => hold(false));
  button.addEventListener('pointercancel', () => hold(false));
});

window.addEventListener('resize', resizeCanvas);

function init() {
  resizeCanvas();
  setStage(0);
  applySavedBest();
  requestAnimationFrame(gameLoop);
}

init();
