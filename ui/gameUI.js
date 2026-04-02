import { state, persistState } from '../core/state.js';
import { submitAnswer, nextQuestion, deriveRunStats } from '../core/gameEngine.js';
import { resolveTypedAnswer } from '../core/questionEngine.js';

const STORE_ITEMS = [
  { id: 'shield', name: 'Ventilator', cost: 800, desc: 'Block one miss.', equipKey: 'vent' },
  { id: 'skip', name: 'MAC Blade', cost: 1200, desc: 'Skip one question.', equipKey: 'mac' },
  { id: 'reveal', name: 'VL Scope', cost: 600, desc: 'Show hint/eliminate.', equipKey: 'vl' },
  { id: 'time', name: 'Bougie', cost: 400, desc: 'Reserved for timed mode.', equipKey: 'bougie' },
];

let onBackToMenus = () => {};

export function initGameUI({ handleBackToMenus }) {
  onBackToMenus = handleBackToMenus;
  document.querySelector('#next-btn').addEventListener('click', handleNext);
  document.querySelector('#back-menu-btn').addEventListener('click', () => {
    document.querySelector('#result').classList.remove('on');
    document.querySelector('#game').classList.add('hidden');
    onBackToMenus();
  });
  document.querySelector('#type-submit').addEventListener('click', submitTyped);
  document.querySelector('#store-btn').addEventListener('click', openStore);
  document.querySelector('#store-close').addEventListener('click', closeStore);
  document.querySelector('#scn').addEventListener('click', handleSceneClick);
}

export function renderRun() {
  const run = state.run;
  if (!run) return;

  document.querySelector('#splash').classList.add('hidden');
  document.querySelector('#game').classList.remove('hidden');
  document.querySelector('#result').classList.remove('on');

  document.querySelector('#run-label').textContent = run.runLabel;
  document.querySelector('#course-label').textContent = state.activeCourse.shortLabel;
  document.querySelector('#qt').textContent = String(run.questions.length);

  const note = document.querySelector('#content-note');
  note.textContent = run.placeholderActive ? 'Placeholder content still active for some topics.' : '';
  const stats = deriveRunStats(state.run);
  updateHud();
  drawSRNAAvatar();
  renderAdaptiveLiveStats(stats);
  renderInlineHud(stats);
  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  const run = state.run;
  const question = run.questions[run.index];
  if (!question) return;

  document.querySelector('#qn').textContent = String(run.index + 1);
  const worldText = run.mode === 'progression' ? `WORLD ${findWorldIndex(run, question.section)}` : question.section.toUpperCase();
  document.querySelector('#chb').textContent = `${worldText} • W${question.week}`;
  document.querySelector('#ovs').textContent = `Difficulty: ${question.difficulty.toUpperCase()} • Topic: ${question.topic}`;
  document.querySelector('#qtxt').textContent = question.question;
  document.querySelector('#type-hint').textContent = '';

  const progress = (run.index / run.questions.length) * 100;
  document.querySelector('#prog-fill').style.width = `${progress}%`;

  const ansGrid = document.querySelector('#ans-grid');
  const typeArea = document.querySelector('#type-area');
  const clickInst = document.querySelector('#click-inst');
  ansGrid.innerHTML = '';
  typeArea.classList.add('hidden');
  clickInst.classList.add('hidden');

  if (question.type === 'mcq') {
    question.choices.forEach((choice, idx) => {
      const button = document.createElement('button');
      button.className = 'abtn';
      button.textContent = choice;
      button.addEventListener('click', () => finalizeAnswer(idx === question.answer));
      ansGrid.appendChild(button);
    });
    if (state.inventory.reveal > 0) addRevealButton(question);
  } else if (question.type === 'typed') {
    typeArea.classList.remove('hidden');
    document.querySelector('#type-input').value = '';
  } else if (question.type === 'click') {
    clickInst.classList.remove('hidden');
  }

  drawScene(question);
}

function submitTyped() {
  const run = state.run;
  const question = run.questions[run.index];
  const value = document.querySelector('#type-input').value;
  finalizeAnswer(resolveTypedAnswer(question, value));
}

function handleSceneClick(event) {
  const run = state.run;
  if (!run) return;
  const question = run.questions[run.index];
  if (question?.type !== 'click' || !question.scene) return;

  const rect = event.target.getBoundingClientRect();
  const x = ((event.clientX - rect.left) * 720) / rect.width;
  const y = ((event.clientY - rect.top) * 320) / rect.height;

  const target = question.scene.hotspots.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
  if (!target) return;
  finalizeAnswer(target.id === question.answer);
}

function finalizeAnswer(isCorrect) {
  const run = state.run;
  const question = run.questions[run.index];

  const hasShield = !isCorrect && state.inventory.shield > 0;
  if (hasShield) {
    state.inventory.shield -= 1;
    isCorrect = true;
  }

  submitAnswer(isCorrect);
  const stats = deriveRunStats(state.run);
  updateHud();
  drawSRNAAvatar();
  renderAdaptiveLiveStats(stats);
  renderInlineHud(stats);
  showResult(isCorrect, question);
  persistState();
}

function showResult(correct, question) {
  const result = document.querySelector('#result');
  result.classList.add('on');
  document.querySelector('#r-v').textContent = correct ? 'CORRECT' : 'NOT THIS TIME';
  document.querySelector('#r-q').textContent = question.question;
  document.querySelector('#r-ex').textContent = question.explanation;
  document.querySelector('#next-btn').textContent = state.run.done ? 'END RUN' : 'NEXT CHALLENGE →';

  const summary = document.querySelector('#run-summary');
  if (state.run.done) {
    const stats = deriveRunStats(state.run);
    const accuracyText = stats.accuracy !== null ? `${Math.round(stats.accuracy * 100)}%` : '—';
    const summaryHTML = `
      <div>
        <h3>Run Summary</h3>
        <div>Accuracy: ${accuracyText}</div>
        <div>Best Streak: ${stats.bestStreak}</div>
        <div>Correct: ${stats.totalCorrect}</div>
        <div>Incorrect: ${stats.totalIncorrect}</div>
        <h4>Weak Topics</h4>
        ${stats.weakestTopics.map((t) => `<div>${t.name} (${Math.round(t.accuracy * 100)}%)</div>`).join('') || '<div>—</div>'}
        <h4>Strong Topics</h4>
        ${stats.strongestTopics.map((t) => `<div>${t.name} (${Math.round(t.accuracy * 100)}%)</div>`).join('') || '<div>—</div>'}
      </div>
    `;
    summary.innerHTML = summaryHTML;
    summary.style.display = 'block';
  } else {
    summary.style.display = 'none';
  }
}

function handleNext() {
  if (!state.run) return;
  if (state.run.done) {
    document.querySelector('#result').classList.remove('on');
    document.querySelector('#game').classList.add('hidden');
    onBackToMenus();
    return;
  }
  nextQuestion();
  document.querySelector('#result').classList.remove('on');
  renderCurrentQuestion();
}

function updateHud() {
  const run = state.run;
  document.querySelector('#lives-label').textContent = String(Math.max(0, run.lives));
  document.querySelector('#points-label').textContent = String(run.score);
  document.querySelector('#bank-label').textContent = state.bankedPoints.toLocaleString();
}

function renderAdaptiveLiveStats(stats = deriveRunStats(state.run)) {
  updatePerformancePanel(stats);
  updateFocusHint(stats);
  updateAnswerFeedback(stats);
}

function renderInlineHud(stats = deriveRunStats(state.run)) {
  const accuracyText = stats.accuracy !== null ? `${Math.round(stats.accuracy * 100)}%` : '—';
  const hudHTML = `
    <div id="adaptive-inline-hud" style="margin-top:10px; font-size:14px; color:#ccc;">
      <div>Accuracy: ${accuracyText}</div>
      <div>🔥 Streak: ${stats.currentStreak}</div>
      <div>🏆 Best: ${stats.bestStreak}</div>
      <div>Focus: ${stats.weakestSection?.name || '—'}</div>
      <div>Strength: ${stats.strongestSection?.name || '—'}</div>
    </div>
  `;
  const container = document.querySelector('#ch-card');
  const existing = document.querySelector('#adaptive-inline-hud');
  if (existing) existing.remove();
  container.insertAdjacentHTML('beforeend', hudHTML);
}

function updatePerformancePanel(stats = deriveRunStats(state.run)) {

  document.querySelector('#perf-acc').textContent = `Accuracy: ${stats.accuracy === null ? '—' : `${Math.round(stats.accuracy * 100)}%`}`;
  const streakNode = document.querySelector('#perf-streak');
  streakNode.textContent = `🔥 Streak: ${stats.currentStreak}`;
  streakNode.classList.toggle('streak-hot', stats.currentStreak >= 3);

  document.querySelector('#perf-best-streak').textContent = `🏆 Best: ${stats.bestStreak}`;
  document.querySelector('#perf-weak').textContent = `Weakest: ${formatBucket(stats.weakestSection)}`;
  document.querySelector('#perf-strong').textContent = `Strongest: ${formatBucket(stats.strongestSection)}`;
}

function formatBucket(bucket) {
  if (!bucket) return '—';
  return `${bucket.name} (${Math.round(bucket.accuracy * 100)}%)`;
}

function updateFocusHint(stats = deriveRunStats(state.run)) {
  const focusText = stats.weakestSection ? `Focus: ${stats.weakestSection.name}` : 'Focus: —';
  const strengthText = stats.strongestSection ? `Strength: ${stats.strongestSection.name}` : 'Strength: —';
  document.querySelector('#focus-hint').textContent = `${focusText} • ${strengthText}`;
}

function updateAnswerFeedback(stats = deriveRunStats(state.run)) {
  let feedback = 'Building baseline';
  if (stats.currentStreak >= 3) {
    feedback = "You're heating up";
  } else if (stats.weakestSection) {
    feedback = `Focus: ${stats.weakestSection.name}`;
  }
  document.querySelector('#answer-feedback').textContent = feedback;
  const ov = document.querySelector('#ov-character');
  if (ov) ov.textContent = `💀 OVERLORD: "${feedback}"`;
  const ovBubble = document.querySelector('#ov-bubble');
  if (ovBubble) ovBubble.textContent = feedback;
}

function buildEndRunSummary(stats = deriveRunStats(state.run)) {

  const weakestTopics = stats.weakestTopics
    .map((entry) => `${entry.name} (${Math.round(entry.accuracy * 100)}%)`)
    .join(' | ') || '—';

  const strongestTopics = stats.strongestTopics
    .map((entry) => `${entry.name} (${Math.round(entry.accuracy * 100)}%)`)
    .join(' | ') || '—';

  // TODO: Add spaced repetition scheduling suggestions.
  // TODO: Add adaptive difficulty scaling signals per section/topic.
  // TODO: Add higher-intensity reward feedback for streak milestones.
  // TODO: Add exam simulation mode summary block with timed performance stats.
  return `
    <strong>Final Accuracy:</strong> ${stats.accuracy === null ? '—' : `${Math.round(stats.accuracy * 100)}%`}<br/>
    <strong>Best Streak:</strong> ${stats.bestStreak}<br/>
    <strong>Total Correct:</strong> ${stats.totalCorrect} • <strong>Total Incorrect:</strong> ${stats.totalIncorrect}<br/>
    <strong>Top 3 Weakest Topics:</strong> ${weakestTopics}<br/>
    <strong>Top 3 Strongest Topics:</strong> ${strongestTopics}
  `;
}

function drawSRNAAvatar() {
  const cvs = document.querySelector('#srna-cvs');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const w = cvs.width;
  const h = cvs.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(4, 8, 26, 0.9)';
  ctx.fillRect(0, 0, w, h);

  const x = 55;
  const y = 120;
  ctx.fillStyle = '#2266aa';
  ctx.fillRect(x - 14, y - 62, 28, 10);
  ctx.beginPath();
  ctx.arc(x, y - 45, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#ddaa88';
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.fillRect(x - 7, y - 48, 4, 4);
  ctx.fillRect(x + 3, y - 48, 4, 4);
  ctx.fillStyle = '#88bbdd';
  ctx.fillRect(x - 10, y - 40, 20, 8);
  ctx.fillStyle = '#2266aa';
  ctx.fillRect(x - 18, y - 28, 36, 45);
  ctx.fillStyle = '#1a5588';
  ctx.fillRect(x - 16, y + 17, 14, 35);
  ctx.fillRect(x + 2, y + 17, 14, 35);
  ctx.fillStyle = '#333';
  ctx.fillRect(x - 16, y + 52, 14, 6);
  ctx.fillRect(x + 2, y + 52, 14, 6);
  ctx.fillStyle = '#ddaa88';
  ctx.fillRect(x - 26, y - 25, 10, 30);
  ctx.fillRect(x + 16, y - 25, 10, 30);
  ctx.fillStyle = '#6688aa';
  ctx.font = 'bold 8px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(state.playerName || 'SRNA', x, h - 18);
  ctx.fillStyle = '#445566';
  ctx.fillText('OVERLORD TRAINEE', x, h - 8);
}

function addRevealButton(question) {
  const ansGrid = document.querySelector('#ans-grid');
  const revealButton = document.createElement('button');
  revealButton.className = 'abtn';
  revealButton.textContent = '📺 REVEAL';
  revealButton.addEventListener('click', () => {
    if (state.inventory.reveal <= 0) return;
    state.inventory.reveal -= 1;
    const wrongIdx = question.choices.findIndex((_, i) => i !== question.answer);
    const buttons = [...ansGrid.querySelectorAll('.abtn')];
    if (buttons[wrongIdx]) {
      buttons[wrongIdx].disabled = true;
      buttons[wrongIdx].classList.add('wrong');
      buttons[wrongIdx].textContent += ' (elim)';
    }
    persistState();
  });
  ansGrid.appendChild(revealButton);
}

function drawScene(question) {
  const canvas = document.querySelector('#scn');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 720, 320);

  ctx.fillStyle = '#050014';
  ctx.fillRect(0, 0, 720, 320);
  ctx.strokeStyle = '#662233';
  ctx.strokeRect(4, 4, 712, 312);

  if (question.type !== 'click' || !question.scene) {
    ctx.fillStyle = '#889';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText('Study Scene Standby', 260, 160);
    return;
  }

  // Compatible adapter layer for click-on-scene style questions.
  question.scene.hotspots.forEach((spot) => {
    ctx.fillStyle = 'rgba(100, 100, 180, 0.25)';
    ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
    ctx.strokeStyle = '#88aaff';
    ctx.strokeRect(spot.x, spot.y, spot.w, spot.h);
    ctx.fillStyle = '#dbe4ff';
    ctx.font = 'bold 12px Courier New';
    ctx.fillText(spot.label, spot.x + 8, spot.y + 18);
  });
}

function findWorldIndex(run, sectionId) {
  if (!run.worlds?.length) return 1;
  const idx = run.worlds.findIndex((w) => w.id === sectionId);
  return idx >= 0 ? run.worlds[idx].index : 1;
}

function openStore() {
  const modal = document.querySelector('#store-modal');
  modal.classList.add('on');
  document.querySelector('#store-pts-val').textContent = state.bankedPoints.toLocaleString();

  const grid = document.querySelector('#store-grid');
  grid.innerHTML = '';
  STORE_ITEMS.forEach((item) => {
    const wrap = document.createElement('div');
    wrap.className = 'store-item';
    const canBuy = state.bankedPoints >= item.cost;
    wrap.innerHTML = `
      <div class="si-name">${item.name}</div>
      <div class="si-desc">${item.desc}</div>
      <div class="si-cost">${item.cost} pts</div>
      <button class="si-buy" ${canBuy ? '' : 'disabled'}>BUY</button>
    `;
    wrap.querySelector('.si-buy').addEventListener('click', () => {
      if (state.bankedPoints < item.cost) return;
      state.bankedPoints -= item.cost;
      state.inventory[item.id] += 1;
      state.equipment[item.equipKey] = true;
      persistState();
      openStore();
      updateHud();
    });
    grid.appendChild(wrap);
  });
}

function closeStore() {
  document.querySelector('#store-modal').classList.remove('on');
}
