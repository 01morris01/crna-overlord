import { state, setPlayerName } from '../core/state.js';

function coverageMarkup(coverage) {
  if (!coverage) return '';
  const bySection = Object.entries(coverage.bySection || {}).map(([k, v]) => `${k}: ${v}`).join(' • ');
  const byExam = Object.entries(coverage.byExam || {}).map(([k, v]) => `${k}: ${v}`).join(' • ');
  return `<div class="saved-info">Coverage — Sections: ${bySection || 'none'} | Exams: ${byExam || 'none'}</div>`;
}

function splashShell(coverage) {
  return `
    <div class="sp-title">HEMODYNAMIC<br>OVERLORD</div>
    <div class="sp-sub">⚡ SRNA survival simulator ⚡</div>
    <div class="sp-tag">Burned out but still grinding? <b>Quick Study</b> is now adaptive and prioritizes weak areas + missed questions.</div>
    <div class="name-area">
      <label>YOUR SRNA NAME</label>
      <input id="name-input" placeholder="Enter your name, rookie..." maxlength="20" value="${state.playerName || ''}" />
      <div class="saved-info">Banked points: ${state.bankedPoints.toLocaleString()}</div>
      ${coverageMarkup(coverage)}
    </div>
    <div class="menu-stack" id="menu-stack"></div>
  `;
}

export function renderCourseSelect(root, courses, onCourseSelected, coverage) {
  root.innerHTML = splashShell(coverage);
  const stack = root.querySelector('#menu-stack');
  stack.innerHTML = `<h3>Course Select</h3><div class="menu-grid"></div>`;
  const grid = stack.querySelector('.menu-grid');

  courses.forEach((course) => {
    const button = document.createElement('button');
    button.className = 'mode-btn';
    button.innerHTML = `<strong>${course.shortLabel}</strong><br/><small>${course.name}</small>`;
    button.addEventListener('click', () => onCourseSelected(course));
    grid.appendChild(button);
  });

  root.querySelector('#name-input').addEventListener('change', (event) => {
    setPlayerName(event.target.value || 'Rookie');
  });
}

export function renderModeSelect(root, course, onModeSelected, onBack, coverage) {
  root.innerHTML = splashShell(coverage);
  const stack = root.querySelector('#menu-stack');
  stack.innerHTML = `
    <h3>${course.shortLabel} — Mode Select</h3>
    <div class="menu-grid">
      <button class="mode-btn" data-mode="progression">Progression Mode<br/><small>Section worlds + rising challenge</small></button>
      <button class="mode-btn" data-mode="quick-study">Quick Study<br/><small>Bypass level grind</small></button>
    </div>
    <button class="big-btn" id="back-btn">← Back</button>
  `;

  stack.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => onModeSelected(button.dataset.mode));
  });
  stack.querySelector('#back-btn').addEventListener('click', onBack);
}

export function renderQuickStudyMenu(root, courseData, onPick, onBack, coverage) {
  const sections = Object.entries(courseData.sections);
  root.innerHTML = splashShell(coverage);
  const stack = root.querySelector('#menu-stack');

  stack.innerHTML = `
    <h3>Quick Study — Pick Run Type</h3>
    <div class="menu-grid" id="quick-grid"></div>
    <div class="menu-grid" id="section-grid"></div>
    <button class="big-btn" id="back-btn">← Back</button>
  `;

  const quickItems = [
    ['Full Course Cumulative', () => onPick('full-cumulative')],
    ['Exam 1 Cumulative', () => onPick('exam-cumulative', { examBlock: 'exam1' })],
    ['Exam 2 Cumulative', () => onPick('exam-cumulative', { examBlock: 'exam2' })],
    ['Exam 3 Cumulative', () => onPick('exam-cumulative', { examBlock: 'exam3' })],
    ['Final Review', () => onPick('exam-cumulative', { examBlock: 'final' })],
    ['Random 10', () => onPick('random-10')],
    ['Weak Areas', () => onPick('weak-areas')],
    ['Missed Questions', () => onPick('missed-only')],
    ['Adaptive Mixed', () => onPick('adaptive-mixed')],
  ];

  const quickGrid = stack.querySelector('#quick-grid');
  quickItems.forEach(([label, handler]) => {
    const button = document.createElement('button');
    button.className = 'mode-btn';
    button.textContent = label;
    button.addEventListener('click', handler);
    quickGrid.appendChild(button);
  });

  const sectionGrid = stack.querySelector('#section-grid');
  const sectionHeader = document.createElement('div');
  sectionHeader.style.gridColumn = '1 / -1';
  sectionHeader.textContent = 'Section Cumulative';
  sectionGrid.appendChild(sectionHeader);

  sections.forEach(([id, section]) => {
    const button = document.createElement('button');
    button.className = 'mode-btn';
    button.textContent = `${section.label} (${section.weeks.join(', ')})`;
    button.addEventListener('click', () => onPick('section-cumulative', { sectionId: id }));
    sectionGrid.appendChild(button);
  });

  stack.querySelector('#back-btn').addEventListener('click', onBack);
}
