import { state, recordAnswerPerformance, recordRunCompletion, setSelections } from './state.js';
import { selectQuestions, shuffle } from './questionEngine.js';

const DIFFICULTY_ORDER = { easy: 1, medium: 2, hard: 3 };

function buildProgressionRun(courseData) {
  const sectionOrder = Object.keys(courseData.sections || {});
  const worlds = [];
  let combinedQuestions = [];
  let placeholderActive = false;

  sectionOrder.forEach((sectionId, idx) => {
    const sectionPool = (courseData.questions || [])
      .filter((q) => q.section === sectionId)
      .sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] || 99) - (DIFFICULTY_ORDER[b.difficulty] || 99));

    const sectionPick = sectionPool.slice(0, Math.max(3, Math.min(6, sectionPool.length)));
    const selected = selectQuestions(
      { questions: sectionPick, sections: courseData.sections, examBlocks: courseData.examBlocks },
      { kind: 'section', sectionId, minimum: 3 },
      state,
    );

    if (selected.placeholderActive) placeholderActive = true;
    worlds.push({ id: sectionId, name: courseData.sections[sectionId].label, index: idx + 1, questionCount: selected.questions.length });
    combinedQuestions = combinedQuestions.concat(selected.questions);
  });

  return { questions: shuffle(combinedQuestions), worlds, placeholderActive };
}

export function startGameMode(mode, options = {}) {
  const { course, courseData } = options;
  if (!course || !courseData) throw new Error('Missing course context');

  let runLabel = 'Cumulative';
  let modeKey = mode;
  let runPayload = { questions: [], placeholderActive: false, worlds: [] };

  switch (mode) {
    case 'progression':
      runLabel = 'Progression';
      runPayload = buildProgressionRun(courseData);
      modeKey = 'progression';
      break;
    case 'full-cumulative':
      runLabel = 'Full Course';
      runPayload = selectQuestions(courseData, { kind: 'full', minimum: 10 }, state);
      break;
    case 'exam-cumulative':
      runLabel = (courseData.examBlocks[options.examBlock] || {}).label || 'Exam';
      runPayload = selectQuestions(courseData, { kind: 'exam', examBlock: options.examBlock, minimum: 8 }, state);
      modeKey = `${mode}:${options.examBlock}`;
      break;
    case 'section-cumulative':
      runLabel = (courseData.sections[options.sectionId] || {}).label || 'Section';
      runPayload = selectQuestions(courseData, { kind: 'section', sectionId: options.sectionId, minimum: 8 }, state);
      modeKey = `${mode}:${options.sectionId}`;
      break;
    case 'lesson-run':
      runLabel = options.lessonName || 'Lesson';
      runPayload = selectQuestions(courseData, { kind: 'lesson', lessonId: options.lessonId, minimum: 6 }, state);
      modeKey = `${mode}:${options.lessonId}`;
      break;
    case 'random-10':
      runLabel = 'Random 10';
      runPayload = selectQuestions(courseData, { kind: 'full', count: 10, minimum: 10 }, state);
      break;
    case 'weak-areas':
      runLabel = 'Weak Areas';
      runPayload = selectQuestions(courseData, { kind: 'full', count: 12, minimum: 10, weighted: true }, state);
      break;
    case 'missed-only':
      runLabel = 'Missed Questions';
      runPayload = selectQuestions(courseData, { kind: 'missed', count: 12, minimum: 6, weighted: true }, state);
      break;
    case 'adaptive-mixed':
      runLabel = 'Adaptive Mixed';
      runPayload = selectQuestions(courseData, { kind: 'full', count: 15, minimum: 10, weighted: true }, state);
      break;
    default:
      throw new Error(`Unsupported mode: ${mode}`);
  }

  const run = {
    mode,
    modeKey,
    runLabel,
    courseId: course.id,
    questions: runPayload.questions,
    worlds: runPayload.worlds,
    placeholderActive: runPayload.placeholderActive,
    index: 0,
    score: 0,
    lives: 3,
    done: false,
    currentStreak: 0,
    bestStreak: 0,
    correctCount: 0,
    incorrectCount: 0,
    sectionTally: {},
    topicTally: {},
  };

  state.run = run;
  state.activeCourse = course;
  state.activeMode = mode;
  setSelections(course.id, mode);
  return run;
}

export function submitAnswer(isCorrect) {
  const run = state.run;
  if (!run || run.done) return run;

  const currentQuestion = run.questions?.[run.index];
  if (isCorrect) run.score += 100;
  else run.lives -= 1;

  if (currentQuestion) {
    recordAnswerPerformance(currentQuestion, isCorrect);

    run.currentStreak = isCorrect ? run.currentStreak + 1 : 0;
    run.bestStreak = Math.max(run.bestStreak, run.currentStreak);
    if (isCorrect) run.correctCount += 1;
    else run.incorrectCount += 1;

    const sectionKey = currentQuestion.section || 'unknown-section';
    const topicKey = currentQuestion.topic || 'unknown-topic';
    if (!run.sectionTally[sectionKey]) run.sectionTally[sectionKey] = { attempted: 0, correct: 0, incorrect: 0 };
    if (!run.topicTally[topicKey]) run.topicTally[topicKey] = { attempted: 0, correct: 0, incorrect: 0 };

    [run.sectionTally[sectionKey], run.topicTally[topicKey]].forEach((bucket) => {
      bucket.attempted += 1;
      if (isCorrect) bucket.correct += 1;
      else bucket.incorrect += 1;
    });

    // TODO: Remove this debug log after adaptive tracking validation is complete.
    console.log('[Adaptive Debug]', {
      questionId: currentQuestion.id,
      isCorrect,
      topic: currentQuestion.topic,
      topicStats: state.topicPerformance[currentQuestion.topic] || null,
    });
  }

  if (run.lives <= 0 || run.index >= run.questions.length - 1) {
    run.done = true;
    recordRunCompletion({ courseId: run.courseId, modeKey: run.modeKey, score: Math.max(0, run.score) });
  }

  return run;
}


function rankBucketsByAccuracy(bucketMap = {}) {
  return Object.entries(bucketMap)
    .filter(([, perf]) => perf && perf.attempted > 0)
    .map(([name, perf]) => ({
      name,
      attempted: perf.attempted,
      correct: perf.correct,
      incorrect: perf.incorrect,
      accuracy: perf.correct / Math.max(perf.attempted, 1),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

export function deriveRunStats(run) {
  const safeRun = run || {};
  const totalCorrect = safeRun.correctCount || 0;
  const totalIncorrect = safeRun.incorrectCount || 0;
  const totalAttempted = totalCorrect + totalIncorrect;
  const accuracy = totalAttempted ? totalCorrect / totalAttempted : null;

  const rankedSections = rankBucketsByAccuracy(safeRun.sectionTally || {});
  const rankedTopics = rankBucketsByAccuracy(safeRun.topicTally || {});

  return {
    totalAttempted,
    totalCorrect,
    totalIncorrect,
    accuracy,
    currentStreak: safeRun.currentStreak || 0,
    bestStreak: safeRun.bestStreak || 0,
    weakestSection: rankedSections[0] || null,
    strongestSection: rankedSections[rankedSections.length - 1] || null,
    weakestTopics: rankedTopics.slice(0, 3),
    strongestTopics: [...rankedTopics].reverse().slice(0, 3),
  };
}

export function nextQuestion() {
  const run = state.run;
  if (!run || run.done) return run;
  run.index += 1;
  if (run.index >= run.questions.length) run.done = true;
  return run;
}
