import { loadState, state } from './core/state.js';
import { loadCourses, loadCourseData, getCoverageReport } from './core/questionEngine.js';
import { startGameMode } from './core/gameEngine.js';
import { renderCourseSelect, renderModeSelect, renderQuickStudyMenu } from './ui/menus.js';
import { initGameUI, renderRun } from './ui/gameUI.js';

let courses = [];
let selectedCourse = null;
let selectedCourseData = null;
let selectedCoverage = null;

boot();

async function boot() {
  loadState();
  animateBackground();
  initGameUI({ handleBackToMenus: showCourseMenu });

  courses = await loadCourses();
  const fallbackCourse = courses.find((c) => c.id === state.lastSelectedCourse) || courses[0];
  selectedCourse = fallbackCourse;
  await setCourseContext(selectedCourse);

  showCourseMenu();
}

async function setCourseContext(course) {
  selectedCourse = course;
  selectedCourseData = await loadCourseData(selectedCourse);
  selectedCoverage = getCoverageReport(selectedCourseData);
  console.log(`[Coverage] ${selectedCourse.id}`, selectedCoverage);
}

function showCourseMenu() {
  const splash = document.querySelector('#splash');
  splash.classList.remove('hidden');
  renderCourseSelect(
    splash,
    courses,
    async (course) => {
      await setCourseContext(course);
      showModeMenu();
    },
    selectedCoverage,
  );
}

function showModeMenu() {
  const splash = document.querySelector('#splash');
  renderModeSelect(
    splash,
    selectedCourse,
    (mode) => {
      if (mode === 'progression') startAndRender('progression');
      else showQuickStudyMenu();
    },
    showCourseMenu,
    selectedCoverage,
  );
}

function showQuickStudyMenu() {
  const splash = document.querySelector('#splash');
  renderQuickStudyMenu(
    splash,
    selectedCourseData,
    (mode, options = {}) => startAndRender(mode, options),
    showModeMenu,
    selectedCoverage,
  );
}

function startAndRender(mode, options = {}) {
  // TODO: Add missed-question scheduling windows (spaced repetition) on top of adaptive weights.
  // TODO: Add adaptive-difficulty pre-run options.
  // TODO: Add AI tutor/chat launcher after each run summary.
  startGameMode(mode, {
    course: selectedCourse,
    courseData: selectedCourseData,
    ...options,
  });
  renderRun();
}

function animateBackground() {
  const canvas = document.querySelector('#bg');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.6 + 0.2,
    s: Math.random() * 0.4 + 0.1,
  }));

  function tick() {
    ctx.fillStyle = 'rgba(2,4,18,0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stars.forEach((star) => {
      star.y += star.s;
      if (star.y > canvas.height) star.y = 0;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,50,70,0.6)';
      ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  tick();
}

// TODO: Add support for additional courses by extending /data/courses.json.
// TODO: Migrate remaining legacy BIOL-500 hardcoded question bank into /data/biol500.json.
// TODO: Import more real class content in batches with coverage validation.
