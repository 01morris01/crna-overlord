import { loadState, state } from './core/state.js';
import { loadCourses, loadCourseData, getCoverageReport } from './core/questionEngine.js';
import { startGameMode } from './core/gameEngine.js';
import {
  renderMainMenu,
  renderCourseHub,
  renderSectionSelect,
  renderLessonSelect,
  renderExamSelect,
  renderAdaptiveMenu,
} from './ui/menus.js';
import { initGameUI, renderRun } from './ui/gameUI.js';

let courses = [];
let selectedCourse = null;
let selectedCourseData = null;
let selectedCoverage = null;

boot();

async function boot() {
  loadState();
  animateBackground();
  initGameUI({ handleBackToMenus: showMainMenu });

  courses = await loadCourses();
  const fallback = courses.find((c) => c.id === state.lastSelectedCourse) || courses[0];
  await setCourseContext(fallback);
  showMainMenu();
}

async function setCourseContext(course) {
  selectedCourse = course;
  selectedCourseData = await loadCourseData(course);
  selectedCoverage = getCoverageReport(selectedCourseData);
}

function showMainMenu() {
  const splash = document.querySelector('#splash');
  splash.classList.remove('hidden');
  renderMainMenu(splash, courses, async (course) => {
    await setCourseContext(course);
    showCourseHub();
  }, selectedCoverage);
}

function showCourseHub() {
  renderCourseHub(document.querySelector('#splash'), selectedCourse, {
    onSections: showSections,
    onExams: showExams,
    onAdaptive: showAdaptive,
    onFull: () => startAndRender('full-cumulative'),
    onBack: showMainMenu,
  }, selectedCoverage);
}

function showSections() {
  renderSectionSelect(document.querySelector('#splash'), selectedCourseData, {
    onSection: (sectionId) => showLessons(sectionId),
    onBack: showCourseHub,
  }, selectedCoverage);
}

function showLessons(sectionId) {
  renderLessonSelect(document.querySelector('#splash'), selectedCourseData, sectionId, {
    onLesson: (sid, lesson) => startAndRender('lesson-run', { sectionId: sid, lessonId: lesson.id, lessonName: lesson.name }),
    onSectionCumulative: (sid) => startAndRender('section-cumulative', { sectionId: sid }),
    onBack: showSections,
  }, selectedCoverage);
}

function showExams() {
  renderExamSelect(document.querySelector('#splash'), selectedCourseData, {
    onExam: (examBlock) => startAndRender('exam-cumulative', { examBlock }),
    onBack: showCourseHub,
  }, selectedCoverage);
}

function showAdaptive() {
  renderAdaptiveMenu(document.querySelector('#splash'), {
    onMode: (mode) => startAndRender(mode),
    onBack: showCourseHub,
  }, selectedCoverage);
}

function startAndRender(mode, options = {}) {
  // TODO: Import real lesson names/content from class materials.
  // TODO: Restore deeper legacy overlord animation behaviors.
  // TODO: Add section boss-level encounters.
  // TODO: Add exam simulation mode presets.
  startGameMode(mode, { course: selectedCourse, courseData: selectedCourseData, ...options });
  renderRun();
}

function animateBackground() {
  const canvas = document.querySelector('#bg');
  const ctx = canvas.getContext('2d');

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const stars = Array.from({ length: 120 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.6 + 0.2, s: Math.random() * 0.4 + 0.1 }));
  (function tick() {
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
  }());
}
