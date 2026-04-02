const SAVE_KEY = 'hemodynamic_overlord_v5_save';

function blankPerformance() {
  return { attempted: 0, correct: 0, incorrect: 0 };
}

export const state = {
  playerName: '',
  bankedPoints: 0,
  inventory: { shield: 0, skip: 0, reveal: 0, time: 0 },
  equipment: { vent: false, mac: false, vl: false, bougie: false },
  completedLevels: {},
  bestScores: {},
  lastSelectedCourse: 'biol500',
  lastSelectedStudyMode: 'progression',
  missedQuestions: [],
  topicPerformance: {},
  sectionPerformance: {},
  examPerformance: {},
  questionStats: {},
  activeCourse: null,
  activeMode: null,
  run: null,
};

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved) return;
    Object.assign(state, saved);
    state.missedQuestions = saved.missedQuestions || [];
    state.topicPerformance = saved.topicPerformance || {};
    state.sectionPerformance = saved.sectionPerformance || {};
    state.examPerformance = saved.examPerformance || {};
    state.questionStats = saved.questionStats || {};
  } catch {
    // TODO: Optional telemetry hook for local-storage parse failures.
  }
}

export function persistState() {
  const payload = {
    playerName: state.playerName,
    bankedPoints: state.bankedPoints,
    inventory: state.inventory,
    equipment: state.equipment,
    completedLevels: state.completedLevels,
    bestScores: state.bestScores,
    lastSelectedCourse: state.lastSelectedCourse,
    lastSelectedStudyMode: state.lastSelectedStudyMode,
    missedQuestions: state.missedQuestions,
    topicPerformance: state.topicPerformance,
    sectionPerformance: state.sectionPerformance,
    examPerformance: state.examPerformance,
    questionStats: state.questionStats,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

export function setPlayerName(name) {
  state.playerName = name.trim();
  persistState();
}

export function setSelections(courseId, modeId) {
  state.lastSelectedCourse = courseId;
  state.lastSelectedStudyMode = modeId;
  persistState();
}

export function recordAnswerPerformance(question, isCorrect) {
  const topicKey = question.topic || 'unknown-topic';
  const sectionKey = question.section || 'unknown-section';
  const examKey = question.examBlock || 'unknown-exam';

  if (!state.topicPerformance[topicKey]) state.topicPerformance[topicKey] = blankPerformance();
  if (!state.sectionPerformance[sectionKey]) state.sectionPerformance[sectionKey] = blankPerformance();
  if (!state.examPerformance[examKey]) state.examPerformance[examKey] = blankPerformance();
  if (!state.questionStats[question.id]) state.questionStats[question.id] = { attempted: 0, correct: 0, incorrect: 0 };

  [state.topicPerformance[topicKey], state.sectionPerformance[sectionKey], state.examPerformance[examKey], state.questionStats[question.id]].forEach((bucket) => {
    bucket.attempted += 1;
    if (isCorrect) bucket.correct += 1;
    else bucket.incorrect += 1;
  });

  if (!isCorrect && !state.missedQuestions.includes(question.id)) {
    state.missedQuestions.push(question.id);
  }

  if (isCorrect && state.missedQuestions.includes(question.id)) {
    const stat = state.questionStats[question.id];
    if (stat.correct >= 2) {
      state.missedQuestions = state.missedQuestions.filter((id) => id !== question.id);
    }
  }

  persistState();
}

export function recordRunCompletion({ courseId, modeKey, score }) {
  const key = `${courseId}:${modeKey}`;
  state.bestScores[key] = Math.max(state.bestScores[key] || 0, score);
  state.completedLevels[key] = true;
  state.bankedPoints += score;
  persistState();
}
