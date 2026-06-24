const express    = require('express');
const AuditLog   = require('../models/AuditLog');
const Submission = require('../models/Submission');
const QAAnswer   = require('../models/QAAnswer');
const QAQuestion = require('../models/QAQuestion');
const User       = require('../models/User');

const router = express.Router();
// Note: authenticate + requireRole('teacher','admin') are applied at mount time
// in server.js, so every handler here can trust req.user.

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Resolve which students the requester may see.
//   admin   → null  (means "everyone")
//   teacher → array of clientIds for students enrolled in their class
async function resolveScope(user) {
  if (user.role === 'admin') return null;
  const students = await User.find({ assignedTeacherId: user.id, role: 'student' }).select('clientId');
  return students.map(s => s.clientId);
}

// Apply a studentId scope to a Mongo query object (field name varies by model).
function scoped(query, ids, field = 'studentId') {
  if (ids === null) return query;          // admin — no restriction
  return { ...query, [field]: { $in: ids } };
}

const STAGES = ['Measurement', 'Heating', 'Emulsification', 'Cooling', 'Other'];

// Classify a milestone detail string into a lab stage.
function classifyStage(detail) {
  const d = detail.toLowerCase();
  if (/cool/.test(d))                                   return 'Cooling';
  if (/stir|emulsif|combined|phases|mixing/.test(d))    return 'Emulsification';
  if (/°c|temperature|heat|melt|overheat/.test(d))      return 'Heating';
  if (/weigh|pour/.test(d))                             return 'Measurement';
  return 'Other';
}

// Classify the outcome encoded in the milestone marker glyphs.
function classifyOutcome(detail) {
  if (detail.includes('✗')) return 'error';
  if (detail.includes('⚠')) return 'warning';
  if (detail.includes('✓')) return 'success';
  return 'info';
}

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1));
  return d;
}

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);   // YYYY-MM-DD
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/heatmap — per-stage outcome breakdown from lab milestones
// ─────────────────────────────────────────────────────────────────────────────
router.get('/heatmap', async (req, res) => {
  try {
    // Accept either an hours-based window (?hours=24, capped at 7 days) or a
    // days-based window (?days=30, capped at 180 days). Hours takes precedence.
    const hoursParam = parseInt(req.query.hours);
    const useHours   = Number.isFinite(hoursParam) && hoursParam > 0;
    const hours      = useHours ? Math.min(hoursParam, 168) : null;
    const days       = Math.min(parseInt(req.query.days) || 30, 180);
    const since      = useHours ? new Date(Date.now() - hours * 3600000) : daysAgo(days);
    const ids        = await resolveScope(req.user);

    const query = scoped(
      { action: 'lab_milestone', createdAt: { $gte: since } },
      ids, 'actorId'
    );

    const events = await AuditLog.find(query).select('detail').lean();

    const stages = Object.fromEntries(
      STAGES.map(s => [s, { stage: s, total: 0, success: 0, warning: 0, error: 0, info: 0 }])
    );

    for (const e of events) {
      const stage   = classifyStage(e.detail);
      const outcome = classifyOutcome(e.detail);
      stages[stage].total += 1;
      stages[stage][outcome] += 1;
    }

    res.json({
      days:  useHours ? null : days,
      hours: useHours ? hours : null,
      totalEvents: events.length,
      stages: STAGES.map(s => stages[s]),
    });
  } catch (err) {
    console.error('Heatmap analytics error:', err);
    res.status(500).json({ error: 'Failed to build step heatmap' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/activity — daily lab activity over the last N days
// ─────────────────────────────────────────────────────────────────────────────
router.get('/activity', async (req, res) => {
  try {
    const days  = Math.min(parseInt(req.query.days) || 14, 90);
    const ids   = await resolveScope(req.user);
    const since = daysAgo(days);

    const query = scoped(
      { action: { $in: ['lab_started', 'lab_evaluated'] }, createdAt: { $gte: since } },
      ids, 'actorId'
    );
    const events = await AuditLog.find(query).select('action createdAt').lean();

    // Seed every day in the window so the chart has no gaps.
    const buckets = {};
    for (let i = 0; i < days; i++) {
      const key = dayKey(new Date(since.getTime() + i * 86400000));
      buckets[key] = { date: key, started: 0, evaluated: 0 };
    }
    for (const e of events) {
      const key = dayKey(e.createdAt);
      if (!buckets[key]) continue;
      if (e.action === 'lab_started')   buckets[key].started   += 1;
      if (e.action === 'lab_evaluated') buckets[key].evaluated += 1;
    }

    res.json({ days, series: Object.values(buckets) });
  } catch (err) {
    console.error('Activity analytics error:', err);
    res.status(500).json({ error: 'Failed to build activity series' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/error-trend — daily warning/error milestone counts
// ─────────────────────────────────────────────────────────────────────────────
router.get('/error-trend', async (req, res) => {
  try {
    const days  = Math.min(parseInt(req.query.days) || 14, 90);
    const ids   = await resolveScope(req.user);
    const since = daysAgo(days);

    const query = scoped(
      { action: 'lab_milestone', createdAt: { $gte: since } },
      ids, 'actorId'
    );
    const events = await AuditLog.find(query).select('detail createdAt').lean();

    const buckets = {};
    for (let i = 0; i < days; i++) {
      const key = dayKey(new Date(since.getTime() + i * 86400000));
      buckets[key] = { date: key, warning: 0, error: 0 };
    }
    // Tally which error/warning kinds occur most often, by stage.
    const byStage = {};
    for (const e of events) {
      const outcome = classifyOutcome(e.detail);
      if (outcome !== 'warning' && outcome !== 'error') continue;
      const key = dayKey(e.createdAt);
      if (buckets[key]) buckets[key][outcome] += 1;
      const stage = classifyStage(e.detail);
      byStage[stage] = byStage[stage] || { stage, warning: 0, error: 0 };
      byStage[stage][outcome] += 1;
    }

    const topStages = Object.values(byStage)
      .sort((a, b) => (b.warning + b.error) - (a.warning + a.error));

    res.json({ days, series: Object.values(buckets), byStage: topStages });
  } catch (err) {
    console.error('Error-trend analytics error:', err);
    res.status(500).json({ error: 'Failed to build error trend' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/funnel — registered → started → submitted → passed
// ─────────────────────────────────────────────────────────────────────────────
router.get('/funnel', async (req, res) => {
  try {
    const ids = await resolveScope(req.user);

    // Registered = students in scope.
    const registered = ids === null
      ? await User.countDocuments({ role: 'student' })
      : ids.length;

    // Started = distinct students with at least one lab_started event.
    const startedIds = await AuditLog.distinct('actorId',
      scoped({ action: 'lab_started' }, ids, 'actorId'));

    // Submitted = distinct students with at least one submission.
    const submittedIds = await Submission.distinct('studentId',
      scoped({ submitterRole: 'student' }, ids, 'studentId'));

    // Passed = distinct students with at least one PASS submission.
    const passedIds = await Submission.distinct('studentId',
      scoped({ submitterRole: 'student', result: 'PASS' }, ids, 'studentId'));

    res.json({
      funnel: [
        { stage: 'Registered', count: registered },
        { stage: 'Started lab', count: startedIds.length },
        { stage: 'Submitted',   count: submittedIds.length },
        { stage: 'Passed',      count: passedIds.length },
      ],
    });
  } catch (err) {
    console.error('Funnel analytics error:', err);
    res.status(500).json({ error: 'Failed to build funnel' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/at-risk — students flagged for follow-up
// ─────────────────────────────────────────────────────────────────────────────
router.get('/at-risk', async (req, res) => {
  try {
    const ids = await resolveScope(req.user);

    const userQuery = ids === null
      ? { role: 'student', status: 'active' }
      : { role: 'student', status: 'active', clientId: { $in: ids } };
    const students = await User.find(userQuery)
      .select('clientId fullName email regNumber lastLogin createdAt').lean();

    const subQuery = scoped({ submitterRole: 'student' }, ids, 'studentId');
    const subs = await Submission.find(subQuery)
      .select('studentId scorePct result submittedAt').lean();

    // Group submissions per student.
    const byStudent = {};
    for (const s of subs) {
      (byStudent[s.studentId] = byStudent[s.studentId] || []).push(s);
    }

    const now = Date.now();
    const INACTIVE_DAYS = 14;

    const flagged = [];
    for (const stu of students) {
      const list = byStudent[stu.clientId] || [];
      const reasons = [];

      const attempts = list.length;
      const avgScore = attempts
        ? Math.round(list.reduce((a, s) => a + s.scorePct, 0) / attempts)
        : 0;
      const failCount = list.filter(s => s.result === 'FAIL').length;
      const lastSub   = list.reduce((m, s) =>
        Math.max(m, new Date(s.submittedAt).getTime()), 0);
      const lastSeen  = Math.max(
        stu.lastLogin ? new Date(stu.lastLogin).getTime() : 0, lastSub);
      const idleDays  = lastSeen ? Math.floor((now - lastSeen) / 86400000) : null;

      if (attempts === 0)                         reasons.push('No lab attempts yet');
      if (attempts > 0 && avgScore < 50)          reasons.push(`Low average (${avgScore}%)`);
      if (failCount >= 2)                          reasons.push(`${failCount} failed attempts`);
      if (idleDays !== null && idleDays >= INACTIVE_DAYS)
        reasons.push(`Inactive ${idleDays} days`);
      else if (idleDays === null)
        reasons.push('Never active');

      if (reasons.length === 0) continue;

      // Simple severity: more reasons / lower score = higher risk.
      const severity = reasons.length >= 2 || avgScore < 40 ? 'high'
                     : reasons.length === 1 && attempts > 0  ? 'medium'
                     : 'medium';

      flagged.push({
        studentId: stu.clientId,
        name:      stu.fullName,
        email:     stu.email,
        regNumber: stu.regNumber || null,
        attempts,
        avgScore,
        failCount,
        idleDays,
        reasons,
        severity,
      });
    }

    // Highest risk first.
    const rank = { high: 0, medium: 1, low: 2 };
    flagged.sort((a, b) => (rank[a.severity] - rank[b.severity]) || (a.avgScore - b.avgScore));

    res.json({ total: students.length, flaggedCount: flagged.length, students: flagged });
  } catch (err) {
    console.error('At-risk analytics error:', err);
    res.status(500).json({ error: 'Failed to build at-risk list' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/item-analysis — per-question correctness for the Q&A bank
// ─────────────────────────────────────────────────────────────────────────────
router.get('/item-analysis', async (req, res) => {
  try {
    const { practicalId } = req.query;
    const ids = await resolveScope(req.user);

    const ansQuery = scoped({}, ids, 'studentId');
    if (practicalId) ansQuery.practicalId = practicalId;
    const answers = await QAAnswer.find(ansQuery)
      .select('questionId practicalId isCorrect').lean();

    const qIds = [...new Set(answers.map(a => a.questionId))];
    const questions = await QAQuestion.find({ clientId: { $in: qIds } })
      .select('clientId question type practicalId points').lean();
    const qMap = Object.fromEntries(questions.map(q => [q.clientId, q]));

    const stats = {};
    for (const a of answers) {
      const s = stats[a.questionId] = stats[a.questionId] || {
        questionId: a.questionId,
        text:        qMap[a.questionId]?.question || '(question removed)',
        type:        qMap[a.questionId]?.type || 'unknown',
        practicalId: a.practicalId,
        answered: 0, correct: 0, wrong: 0, pending: 0,
      };
      s.answered += 1;
      if (a.isCorrect === true)  s.correct += 1;
      else if (a.isCorrect === false) s.wrong += 1;
      else s.pending += 1;
    }

    const items = Object.values(stats).map(s => {
      const graded = s.correct + s.wrong;
      return { ...s, correctPct: graded ? Math.round((s.correct / graded) * 100) : null };
    });
    // Hardest (lowest correct %) first; nulls (ungraded) last.
    items.sort((a, b) => {
      if (a.correctPct === null) return 1;
      if (b.correctPct === null) return -1;
      return a.correctPct - b.correctPct;
    });

    res.json({ totalAnswers: answers.length, items });
  } catch (err) {
    console.error('Item-analysis error:', err);
    res.status(500).json({ error: 'Failed to build item analysis' });
  }
});

module.exports = router;
