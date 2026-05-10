// controllers/gradingController.js
const { Task, TaskSubmission, Student } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/apiResponse');
const notificationService = require('../utils/notificationService');

/**
 * @desc    Get task submissions for grading (single aggregated query)
 * @route   GET /api/teacher/grading/task/:taskId
 * @access  Private (Teacher)
 */
const getTaskSubmissions = asyncHandler(async (req, res) => {
  const { taskId }   = req.params;
  const teacherId    = req.user.profileId;

  const task = await Task.findOne({ _id: taskId, assignedBy: teacherId }).lean();
  if (!task) return error(res, 404, 'Task not found or unauthorized');

  // Single query: submissions + not-submitted students fetched in parallel
  const [submissions, notSubmitted] = await Promise.all([
    TaskSubmission.find({ taskId })
      .populate('studentId', 'name rollNumber class section')
      .sort({ submittedAt: -1 })
      .lean(),
    // Students who are assigned but have NOT submitted
    (async () => {
      const submittedIds = await TaskSubmission.find({ taskId }).distinct('studentId');
      return Student.find({
        _id: { $in: task.assignedTo, $nin: submittedIds },
      }).select('name rollNumber class section').lean();
    })(),
  ]);

  const gradedSubmissions = submissions.filter((s) => s.score !== undefined);
  const avgScore = gradedSubmissions.length
    ? (gradedSubmissions.reduce((sum, s) => sum + s.score, 0) / gradedSubmissions.length).toFixed(2)
    : 0;

  const stats = {
    total:        task.assignedTo.length,
    submitted:    submissions.length,
    graded:       submissions.filter((s) => s.status === 'graded').length,
    pending:      submissions.filter((s) => ['submitted', 'late'].includes(s.status)).length,
    notSubmitted: notSubmitted.length,
    averageScore: avgScore,
  };

  return success(res, 200, 'Submissions fetched', {
    task: {
      _id:         task._id,
      title:       task.title,
      description: task.description,
      totalMarks:  task.totalMarks,
      dueDate:     task.dueDate,
    },
    submissions,
    notSubmitted,
    stats,
  });
});

/**
 * @desc    Grade a single submission
 * @route   POST /api/teacher/grading/grade/:submissionId
 * @access  Private (Teacher)
 */
const gradeSubmission = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const { score, feedback } = req.body;
  const teacherId = req.user.profileId;

  if (score === undefined) return error(res, 400, 'Score is required');

  const submission = await TaskSubmission.findById(submissionId)
    .populate('taskId')
    .populate('studentId', 'name rollNumber');

  if (!submission) return error(res, 404, 'Submission not found');
  if (submission.taskId.assignedBy.toString() !== teacherId.toString()) {
    return error(res, 403, 'Not authorized to grade this submission');
  }
  if (score < 0 || score > submission.taskId.totalMarks) {
    return error(res, 400, `Score must be between 0 and ${submission.taskId.totalMarks}`);
  }

  submission.score    = score;
  submission.feedback = feedback || '';
  submission.gradedBy = teacherId;
  submission.gradedAt = new Date();
  submission.status   = 'graded';
  await submission.save();

  // Notify student
  notificationService.notifyTaskGraded(
    submission.studentId,
    submission.taskId.title,
    score,
    submission.taskId.totalMarks
  ).catch(() => {});

  return success(res, 200, 'Submission graded successfully', submission);
});

/**
 * @desc    Bulk-grade multiple submissions
 * @route   POST /api/teacher/grading/bulk-grade
 * @access  Private (Teacher)
 */
const bulkGradeSubmissions = asyncHandler(async (req, res) => {
  const { grades } = req.body;
  const teacherId  = req.user.profileId;

  if (!Array.isArray(grades) || grades.length === 0) {
    return error(res, 400, 'Invalid grades data');
  }

  const results = { success: [], failed: [] };

  for (const gradeData of grades) {
    try {
      const submission = await TaskSubmission.findById(gradeData.submissionId).populate('taskId');
      if (!submission) {
        results.failed.push({ submissionId: gradeData.submissionId, reason: 'Submission not found' });
        continue;
      }
      if (submission.taskId.assignedBy.toString() !== teacherId.toString()) {
        results.failed.push({ submissionId: gradeData.submissionId, reason: 'Not authorized' });
        continue;
      }
      if (gradeData.score < 0 || gradeData.score > submission.taskId.totalMarks) {
        results.failed.push({ submissionId: gradeData.submissionId, reason: 'Invalid score' });
        continue;
      }
      submission.score    = gradeData.score;
      submission.feedback = gradeData.feedback || '';
      submission.gradedBy = teacherId;
      submission.gradedAt = new Date();
      submission.status   = 'graded';
      await submission.save();
      results.success.push(submission._id);
    } catch (err) {
      results.failed.push({ submissionId: gradeData.submissionId, reason: err.message });
    }
  }

  return success(res, 200, `Graded ${results.success.length} submissions`, results);
});

/**
 * @desc    Get student's graded tasks
 * @route   GET /api/student/grading/my-grades
 * @access  Private (Student)
 */
const getMyGrades = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;

  const gradedSubmissions = await TaskSubmission.find({ studentId, status: 'graded' })
    .populate('taskId', 'title subject totalMarks dueDate')
    .populate('gradedBy', 'name')
    .sort({ gradedAt: -1 })
    .limit(50)
    .lean();

  const stats = {
    totalGraded:       gradedSubmissions.length,
    averageScore:      0,
    averagePercentage: 0,
    highestScore:      0,
    lowestScore:       0,
    subjectWise:       {},
  };

  if (gradedSubmissions.length > 0) {
    const scores      = gradedSubmissions.map((s) => s.score);
    const percentages = gradedSubmissions.map((s) => (s.score / s.taskId.totalMarks) * 100);

    stats.averageScore      = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
    stats.averagePercentage = (percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(2);
    stats.highestScore      = Math.max(...scores);
    stats.lowestScore       = Math.min(...scores);

    for (const s of gradedSubmissions) {
      const subj = s.taskId.subject;
      if (!stats.subjectWise[subj]) {
        stats.subjectWise[subj] = { count: 0, totalScore: 0, totalMarks: 0 };
      }
      stats.subjectWise[subj].count++;
      stats.subjectWise[subj].totalScore += s.score;
      stats.subjectWise[subj].totalMarks += s.taskId.totalMarks;
    }

    for (const [subj, data] of Object.entries(stats.subjectWise)) {
      data.percentage = ((data.totalScore / data.totalMarks) * 100).toFixed(2);
    }
  }

  return success(res, 200, 'Grades fetched', { submissions: gradedSubmissions, stats });
});

module.exports = { getTaskSubmissions, gradeSubmission, bulkGradeSubmissions, getMyGrades };
