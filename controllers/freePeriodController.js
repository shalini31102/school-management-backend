// controllers/freePeriodController.js
const Groq = require('groq-sdk');
const { Student, Timetable, FreePeriodTaskCompletion, DailyStudyPlan, ClassFreePeriodSession, Task, TaskSubmission } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/apiResponse');
const notificationService = require('../utils/notificationService');

// ── Helpers ───────────────────────────────────────────────────────────────────

const getActiveFreePeriod = async (student) => {
  const timetable = await Timetable.findOne({
    class:    student.class,
    section:  student.section,
    isActive: true,
  }).lean();
  if (!timetable) return null;

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today       = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const todaySchedule = timetable.schedule.find((s) => s.day === today);
  if (!todaySchedule) return null;

  return (
    todaySchedule.periods.find(
      (p) => p.isFree === true && currentTime >= p.startTime && currentTime <= p.endTime
    ) || null
  );
};

const generateAISuggestions = async (student, freePeriodSubject, duration = null) => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const systemPrompt =
    'You are an educational AI assistant for a school management system. ' +
    'Generate personalized, actionable learning tasks for students during free periods. ' +
    'Respond with valid JSON only — no markdown, no explanation outside the JSON.';

  const durationLine = duration ? `- Available time: ${duration} minutes (all tasks must fit within this time)` : '';

  const userPrompt = `Generate exactly 6 personalized free-period task suggestions for this student.

Student Profile:
- Name: ${student.name}
- Class: ${student.class}, Section: ${student.section}
- Interests: ${student.interests?.length ? student.interests.join(', ') : 'not specified'}
- Career Goals: ${student.careerGoals?.length ? student.careerGoals.join(', ') : 'not specified'}
- Performance Level: ${student.performanceLevel || 'medium'}
- Learning Pace: ${student.learningPace || 'medium'}
${freePeriodSubject ? `- Free Period Subject: ${freePeriodSubject}` : ''}
${durationLine}

Rules:
1. Return exactly 6 tasks.
2. Each task must be completable independently in 20–45 minutes (or within duration if provided).
3. Calibrate difficulty to performance level.
4. If a free period subject is provided, at least 2 tasks should relate to it.
5. matchReason must be one sentence explaining why this task suits this student.

Respond with exactly this JSON shape:
{
  "suggestions": [
    {
      "title": "concise task title",
      "description": "clear description",
      "subject": "subject area",
      "estimatedTime": 30,
      "difficulty": "easy",
      "matchReason": "one sentence"
    }
  ]
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens:  1500,
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
    throw new Error('Groq returned an unexpected response format');
  }
  return parsed.suggestions.slice(0, 6);
};

/**
 * Generate and store a daily study plan for a student.
 * Called by the 7AM cron job and on-demand if no plan exists.
 */
const generateDailyPlanForStudent = async (student) => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Fetch pending tasks + recent grades in parallel
  const [pendingTasks, recentGrades] = await Promise.allSettled([
    Task.find({ assignedTo: student._id, isActive: true })
      .sort({ dueDate: 1 }).limit(10).lean()
      .then(async (tasks) => {
        const taskIds = tasks.map((t) => t._id);
        const submitted = await TaskSubmission.find({ taskId: { $in: taskIds }, studentId: student._id }).distinct('taskId');
        const submittedSet = new Set(submitted.map(String));
        return tasks.filter((t) => !submittedSet.has(String(t._id)));
      }),
    TaskSubmission.find({ studentId: student._id, status: 'graded' })
      .populate('taskId', 'subject totalMarks')
      .sort({ gradedAt: -1 }).limit(20).lean(),
  ]);

  const tasks = pendingTasks.status === 'fulfilled' ? pendingTasks.value : [];
  const grades = recentGrades.status === 'fulfilled' ? recentGrades.value : [];

  // Compute weak subjects
  const subjectMap = {};
  grades.forEach((g) => {
    const subj = g.taskId?.subject || 'General';
    if (!subjectMap[subj]) subjectMap[subj] = { total: 0, count: 0 };
    subjectMap[subj].total += (g.score / (g.taskId?.totalMarks || 10)) * 100;
    subjectMap[subj].count++;
  });
  const weakSubjects = Object.entries(subjectMap)
    .map(([s, d]) => ({ subject: s, avg: d.total / d.count }))
    .filter((s) => s.avg < 60)
    .map((s) => s.subject);

  const pendingList = tasks.slice(0, 5).map((t) => `${t.title} (due ${new Date(t.dueDate).toLocaleDateString()})`).join('; ');
  const weakList = weakSubjects.join(', ') || 'none';
  const goalList = student.careerGoals?.join(', ') || 'not specified';

  const userPrompt = `Generate a daily study plan with exactly 3 priority tasks for today.

Student: ${student.name}, Class ${student.class}-${student.section}
Performance: ${student.performanceLevel || 'medium'}, Pace: ${student.learningPace || 'medium'}
Pending tasks (due soon): ${pendingList || 'none'}
Weak subjects (below 60% avg): ${weakList}
Career goals: ${goalList}
Interests: ${student.interests?.join(', ') || 'not specified'}

Focus priority: 1) help with pending deadlines, 2) improve weak subjects, 3) align with goals.
Each task: specific, actionable, 20-60 minutes.

Return this JSON:
{
  "tasks": [
    {
      "title": "task title",
      "description": "what to do specifically",
      "subject": "subject",
      "estimatedTime": 30,
      "difficulty": "medium",
      "priority": 1
    }
  ]
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are an educational AI. Respond with valid JSON only.' },
      { role: 'user',   content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
    max_tokens: 800,
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  const planTasks = (parsed.tasks || []).slice(0, 3);

  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  // Upsert: delete existing then create (avoids duplicate key on retry)
  await DailyStudyPlan.deleteOne({ studentId: student._id, date: todayUTC });
  const plan = await DailyStudyPlan.create({
    studentId: student._id,
    date:      todayUTC,
    tasks:     planTasks,
    aiContext: `pendingTasks:${pendingList}|weakSubjects:${weakList}`,
    generatedAt: new Date(),
  });

  return plan;
};

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * @desc    Get AI-powered task suggestions (priority: class session → daily plan → on-demand)
 * @route   GET /api/student/free-period-suggestions?duration=30
 * @access  Private (Student)
 */
const getFreePeriodSuggestions = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;
  const duration  = req.query.duration ? parseInt(req.query.duration, 10) : null;

  const student = await Student.findById(studentId).lean();
  if (!student) return error(res, 404, 'Student not found');

  // ── 1. Check active class free period session (teacher started) ──────────
  const activeSession = await ClassFreePeriodSession.findOne({
    class:    student.class,
    section:  student.section.toUpperCase(),
    isActive: true,
    endsAt:   { $gt: new Date() },
  }).lean();

  if (activeSession) {
    let tasks = activeSession.tasks;
    if (duration) tasks = tasks.filter((t) => (t.estimatedTime || 0) <= duration);
    return success(res, 200, 'Class session suggestions', {
      source:       'class_session',
      sessionInfo:  {
        teacherNote:   activeSession.note,
        missedSubject: activeSession.missedSubject,
        duration:      activeSession.duration,
        endsAt:        activeSession.endsAt,
      },
      isFreePeriod:  true,
      suggestions:   tasks,
      totalSuggestions: tasks.length,
      studentProfile: {
        name: student.name, performanceLevel: student.performanceLevel,
        interests: student.interests, careerGoals: student.careerGoals, learningPace: student.learningPace,
      },
    });
  }

  // ── 2. Check today's daily plan ───────────────────────────────────────────
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const dailyPlan = await DailyStudyPlan.findOne({ studentId, date: todayUTC }).lean();

  if (dailyPlan) {
    let tasks = dailyPlan.tasks;
    if (duration) tasks = tasks.filter((t) => (t.estimatedTime || 0) <= duration);
    if (!dailyPlan.isViewed) {
      await DailyStudyPlan.updateOne({ _id: dailyPlan._id }, { isViewed: true });
    }
    return success(res, 200, 'Daily plan suggestions', {
      source:          'daily_plan',
      isFreePeriod:    !!(await getActiveFreePeriod(student)),
      suggestions:     tasks,
      totalSuggestions: tasks.length,
      studentProfile: {
        name: student.name, performanceLevel: student.performanceLevel,
        interests: student.interests, careerGoals: student.careerGoals, learningPace: student.learningPace,
      },
    });
  }

  // ── 3. Fallback: on-demand AI generation ─────────────────────────────────
  const currentFreePeriod = await getActiveFreePeriod(student);
  const freePeriodSubject  = currentFreePeriod?.subject || null;

  const suggestions = await generateAISuggestions(student, freePeriodSubject, duration);

  return success(res, 200, 'On-demand AI suggestions', {
    source:          'ai_generated',
    isFreePeriod:    !!currentFreePeriod,
    currentPeriod:   currentFreePeriod,
    suggestions,
    totalSuggestions: suggestions.length,
    studentProfile: {
      name: student.name, performanceLevel: student.performanceLevel,
      interests: student.interests, careerGoals: student.careerGoals, learningPace: student.learningPace,
    },
  });
});

/**
 * @desc    Get today's daily AI study plan (generate on-demand if missing)
 * @route   GET /api/student/daily-plan
 * @access  Private (Student)
 */
const getDailyPlan = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;

  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  let plan = await DailyStudyPlan.findOne({ studentId, date: todayUTC }).lean();

  if (!plan) {
    const student = await Student.findById(studentId).lean();
    if (!student) return error(res, 404, 'Student not found');
    try {
      plan = await generateDailyPlanForStudent(student);
      plan = plan.toObject ? plan.toObject() : plan;
    } catch (err) {
      return error(res, 500, 'Could not generate daily plan: ' + err.message);
    }
  }

  if (!plan.isViewed) {
    await DailyStudyPlan.updateOne({ _id: plan._id }, { isViewed: true });
  }

  return success(res, 200, 'Daily plan fetched', plan);
});

/**
 * @desc    Mark a suggested task as completed
 * @route   POST /api/student/free-period-tasks/complete
 * @access  Private (Student)
 */
const markTaskComplete = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;
  const { taskTitle, taskCategory, difficulty, subject, estimatedTime, rating, notes, wasHelpful } = req.body;

  if (!taskTitle || !taskCategory || !difficulty || !estimatedTime) {
    return error(res, 400, 'Missing required fields');
  }

  const completion = await FreePeriodTaskCompletion.create({
    studentId,
    taskTitle,
    taskCategory,
    difficulty,
    subject:    subject    || 'General',
    estimatedTime,
    rating:     rating     || undefined,
    notes:      notes      || undefined,
    wasHelpful: wasHelpful !== undefined ? wasHelpful : true,
  });

  return success(res, 201, 'Task marked as completed!', completion);
});

/**
 * @desc    Get student's completed free-period tasks
 * @route   GET /api/student/free-period-tasks/completed
 * @access  Private (Student)
 */
const getCompletedTasks = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;

  const [completedTasks, stats] = await Promise.all([
    FreePeriodTaskCompletion.find({ studentId }).sort({ completedAt: -1 }).limit(50).lean(),
    FreePeriodTaskCompletion.getStudentStats(studentId),
  ]);

  return success(res, 200, 'Completed tasks fetched', { completedTasks, stats });
});

/**
 * @desc    Get task completion statistics
 * @route   GET /api/student/free-period-tasks/stats
 * @access  Private (Student)
 */
const getTaskStats = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;
  const stats = await FreePeriodTaskCompletion.getStudentStats(studentId);
  return success(res, 200, 'Stats fetched', stats);
});

module.exports = {
  getFreePeriodSuggestions,
  getDailyPlan,
  markTaskComplete,
  getCompletedTasks,
  getTaskStats,
  generateAISuggestions,
  generateDailyPlanForStudent,
};
