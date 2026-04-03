const cache = new Map();

export async function loadCourses() {
  const res = await fetch('./data/courses.json');
  if (!res.ok) throw new Error('Unable to load courses');
  return res.json();
}

export async function loadCourseData(course) {
  if (cache.has(course.id)) return cache.get(course.id);
  const res = await fetch(course.dataFile);
  if (!res.ok) throw new Error(`Unable to load ${course.id}`);
  const data = await res.json();
  cache.set(course.id, data);
  return data;
}

export function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function metricWeight(perf = { attempted: 0, correct: 0 }) {
  if (!perf.attempted) return 1.2;
  const accuracy = perf.correct / perf.attempted;
  return Math.max(0.4, 1.4 - accuracy);
}

function questionWeight(question, playerState) {
  let weight = 1;
  if (playerState.missedQuestions.includes(question.id)) weight += 2.2;

  weight += metricWeight(playerState.topicPerformance[question.topic]);
  weight += metricWeight(playerState.sectionPerformance[question.section]);
  weight += metricWeight(playerState.examPerformance[question.examBlock]);

  const qStats = playerState.questionStats[question.id] || { attempted: 0, correct: 0 };
  if (qStats.correct >= 3 && qStats.correct > qStats.incorrect) weight -= 0.8;
  if (!qStats.attempted) weight += 0.4;

  return Math.max(0.2, weight);
}

function weightedSample(questions, count, playerState) {
  const pool = questions.map((question) => ({ question, weight: questionWeight(question, playerState) }));
  const picked = [];

  while (pool.length > 0 && picked.length < count) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    let pickIndex = 0;

    for (let i = 0; i < pool.length; i += 1) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        pickIndex = i;
        break;
      }
    }

    picked.push(pool[pickIndex].question);
    pool.splice(pickIndex, 1);
  }

  return picked;
}

function withPlaceholders(questions, minCount, context = 'course') {
  const output = [...questions];
  for (let i = questions.length; i < minCount; i += 1) {
    output.push({
      id: `placeholder-${context}-${i + 1}`,
      course: 'placeholder',
      section: context,
      topic: 'Placeholder Topic',
      week: 0,
      examBlock: 'placeholder',
      difficulty: 'easy',
      type: 'mcq',
      question: `Placeholder content still active for ${context}. Which action keeps your study momentum going?`,
      choices: ['Keep practicing the available set', 'Wait for perfect content', 'Skip studying entirely'],
      answer: 0,
      explanation: 'Use available reps now; swap in real class content as it is added.',
      tags: ['placeholder'],
      placeholder: true,
    });
  }
  return output;
}

export function selectQuestions(courseData, modeConfig, playerState) {
  const questions = courseData.questions || [];
  const count = modeConfig.count || questions.length;

  let pool = [...questions];
  if (modeConfig.kind === 'exam') pool = pool.filter((q) => q.examBlock === modeConfig.examBlock);
  if (modeConfig.kind === 'section') pool = pool.filter((q) => q.section === modeConfig.sectionId);
  if (modeConfig.kind === 'lesson') pool = pool.filter((q) => q.lesson === modeConfig.lessonId);
  if (modeConfig.kind === 'missed') pool = pool.filter((q) => playerState.missedQuestions.includes(q.id));

  if (!pool.length) {
    return { questions: withPlaceholders([], Math.max(5, count), modeConfig.kind), placeholderActive: true };
  }

  let selected;
  if (modeConfig.weighted) selected = weightedSample(pool, Math.min(count, pool.length), playerState);
  else selected = shuffle(pool).slice(0, Math.min(count, pool.length));

  const needMin = modeConfig.minimum || selected.length;
  const filled = withPlaceholders(selected, needMin, modeConfig.kind);
  const placeholderActive = filled.some((q) => q.placeholder);

  return { questions: shuffle(filled), placeholderActive };
}

export function getCoverageReport(courseData) {
  const report = { bySection: {}, byExam: {}, byTopic: {} };

  (courseData.questions || []).forEach((q) => {
    report.bySection[q.section] = (report.bySection[q.section] || 0) + 1;
    report.byExam[q.examBlock] = (report.byExam[q.examBlock] || 0) + 1;
    report.byTopic[q.topic] = (report.byTopic[q.topic] || 0) + 1;
  });

  return report;
}

export function resolveTypedAnswer(question, input) {
  const normalized = input.trim().toLowerCase();
  const answer = String(question.answer).trim().toLowerCase();
  const aliases = (question.aliases || []).map((a) => a.toLowerCase());
  return normalized === answer || aliases.includes(normalized);
}
