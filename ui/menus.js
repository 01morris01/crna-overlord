import { state, setPlayerName } from '../core/state.js';

function shell(coverage) {
  const sectionCov = Object.entries(coverage?.bySection || {}).map(([k, v]) => `${k}:${v}`).join(' • ') || 'none';
  return `
    <div class="sp-title">HEMODYNAMIC<br/>OVERLORD</div>
    <div class="sp-sub">⚡ CRNA STUDY GAUNTLET ⚡</div>
    <div class="sp-tag"><b>THE OVERLORD:</b> “Answer fast, answer right, or your pretend patient codes.”</div>
    <div class="ov-guide">💀 OVERLORD GUIDE: Pick your battlefield — lessons, section runs, exams, or adaptive punishment.</div>
    <div class="name-area">
      <label>SRNA CALLSIGN</label>
      <input id="name-input" value="${state.playerName || ''}" placeholder="Rookie name..." maxlength="20" />
      <div class="saved-info">Banked: ${state.bankedPoints.toLocaleString()} • Coverage: ${sectionCov}</div>
    </div>
    <div class="menu-stack" id="menu-stack"></div>
  `;
}

function wireName(root) {
  root.querySelector('#name-input')?.addEventListener('change', (e) => setPlayerName(e.target.value || 'Rookie'));
}

export function renderMainMenu(root, courses, onCoursePick, coverage) {
  root.innerHTML = shell(coverage);
  const stack = root.querySelector('#menu-stack');
  stack.innerHTML = `<h3>Main Menu</h3><div class="menu-grid" id="course-grid"></div>`;
  const grid = stack.querySelector('#course-grid');
  courses.forEach((course) => {
    const b = document.createElement('button');
    b.className = 'mode-btn';
    b.innerHTML = `<strong>Course Select:</strong><br/>${course.shortLabel}`;
    b.addEventListener('click', () => onCoursePick(course));
    grid.appendChild(b);
  });
  wireName(root);
}

export function renderCourseHub(root, course, handlers, coverage) {
  root.innerHTML = shell(coverage);
  const stack = root.querySelector('#menu-stack');
  stack.innerHTML = `
    <h3>${course.shortLabel} Control Deck</h3>
    <div class="menu-grid">
      <button class="mode-btn" data-action="sections">📚 Section Select</button>
      <button class="mode-btn" data-action="exams">🧪 Exam Select</button>
      <button class="mode-btn" data-action="adaptive">🎯 Adaptive / Quick Study</button>
      <button class="mode-btn" data-action="full">⚡ Full Course Cumulative</button>
    </div>
    <button class="big-btn" id="back-btn">← Main Menu</button>
  `;
  stack.querySelector('[data-action="sections"]').addEventListener('click', handlers.onSections);
  stack.querySelector('[data-action="exams"]').addEventListener('click', handlers.onExams);
  stack.querySelector('[data-action="adaptive"]').addEventListener('click', handlers.onAdaptive);
  stack.querySelector('[data-action="full"]').addEventListener('click', handlers.onFull);
  stack.querySelector('#back-btn').addEventListener('click', handlers.onBack);
  wireName(root);
}

export function renderSectionSelect(root, courseData, handlers, coverage) {
  root.innerHTML = shell(coverage);
  const stack = root.querySelector('#menu-stack');
  stack.innerHTML = `<h3>Section Select</h3><div class="menu-grid" id="sections"></div><button class="big-btn" id="back-btn">← Back</button>`;
  const grid = stack.querySelector('#sections');
  Object.entries(courseData.sections || {}).forEach(([id, section]) => {
    const b = document.createElement('button');
    b.className = 'mode-btn';
    b.innerHTML = `<strong>${section.label}</strong><br/>Lesson Select + Cumulative`;
    b.addEventListener('click', () => handlers.onSection(id));
    grid.appendChild(b);
  });
  stack.querySelector('#back-btn').addEventListener('click', handlers.onBack);
  wireName(root);
}

export function renderLessonSelect(root, courseData, sectionId, handlers, coverage) {
  const section = courseData.sections[sectionId];
  root.innerHTML = shell(coverage);
  const stack = root.querySelector('#menu-stack');
  stack.innerHTML = `
    <h3>${section.label} — Lesson Select</h3>
    <div class="menu-grid" id="lessons"></div>
    <div class="menu-grid"><button class="mode-btn" id="section-cum">📚 Section Cumulative</button></div>
    <button class="big-btn" id="back-btn">← Back</button>
  `;
  const grid = stack.querySelector('#lessons');
  (section.lessons || []).forEach((lesson) => {
    const b = document.createElement('button');
    b.className = 'mode-btn';
    b.textContent = lesson.name;
    b.addEventListener('click', () => handlers.onLesson(sectionId, lesson));
    grid.appendChild(b);
  });
  stack.querySelector('#section-cum').addEventListener('click', () => handlers.onSectionCumulative(sectionId));
  stack.querySelector('#back-btn').addEventListener('click', handlers.onBack);
  wireName(root);
}

export function renderExamSelect(root, courseData, handlers, coverage) {
  root.innerHTML = shell(coverage);
  const stack = root.querySelector('#menu-stack');
  stack.innerHTML = `<h3>Exam Select</h3><div class="menu-grid" id="exams"></div><button class="big-btn" id="back-btn">← Back</button>`;
  const grid = stack.querySelector('#exams');
  Object.entries(courseData.examBlocks || {}).forEach(([id, exam]) => {
    const b = document.createElement('button');
    b.className = 'mode-btn';
    b.textContent = `${exam.label} Cumulative`;
    b.addEventListener('click', () => handlers.onExam(id));
    grid.appendChild(b);
  });
  stack.querySelector('#back-btn').addEventListener('click', handlers.onBack);
  wireName(root);
}

export function renderAdaptiveMenu(root, handlers, coverage) {
  root.innerHTML = shell(coverage);
  const stack = root.querySelector('#menu-stack');
  stack.innerHTML = `
    <h3>Adaptive / Quick Study</h3>
    <div class="menu-grid">
      <button class="mode-btn" data-m="random-10">Random 10</button>
      <button class="mode-btn" data-m="weak-areas">Weak Areas</button>
      <button class="mode-btn" data-m="missed-only">Missed Questions</button>
      <button class="mode-btn" data-m="adaptive-mixed">Adaptive Mixed</button>
    </div>
    <button class="big-btn" id="back-btn">← Back</button>
  `;
  stack.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => handlers.onMode(b.dataset.m)));
  stack.querySelector('#back-btn').addEventListener('click', handlers.onBack);
  wireName(root);
}
