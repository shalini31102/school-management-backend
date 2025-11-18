// controllers/freePeriodController.js
const { Student, Task, Timetable, FreePeriodTaskCompletion, CustomFreePeriodTask } = require('../models');

/**
 * Task library organized by interests and career goals
 */
const TASK_LIBRARY = {
  // Interest-based tasks
  interests: {
    coding: [
      {
        title: 'Build a Simple Calculator',
        description: 'Create a basic calculator using HTML, CSS, and JavaScript',
        difficulty: 'easy',
        estimatedTime: 30,
        subject: 'Computer Science',
        resources: ['MDN Web Docs', 'W3Schools'],
      },
      {
        title: 'Learn Python Basics',
        description: 'Complete an interactive Python tutorial on variables and loops',
        difficulty: 'medium',
        estimatedTime: 45,
        subject: 'Programming',
        resources: ['Python.org', 'Codecademy'],
      },
      {
        title: 'Debug Challenge',
        description: 'Find and fix 5 bugs in provided code snippets',
        difficulty: 'hard',
        estimatedTime: 40,
        subject: 'Computer Science',
        resources: ['LeetCode', 'HackerRank'],
      },
    ],
    art: [
      {
        title: 'Sketch Practice: Perspective',
        description: 'Practice one-point and two-point perspective drawing',
        difficulty: 'easy',
        estimatedTime: 30,
        subject: 'Art',
        resources: ['YouTube Art Tutorials', 'Drawabox.com'],
      },
      {
        title: 'Color Theory Study',
        description: 'Learn about complementary colors and create a color wheel',
        difficulty: 'medium',
        estimatedTime: 45,
        subject: 'Art',
        resources: ['Khan Academy', 'Color Matters'],
      },
    ],
    music: [
      {
        title: 'Rhythm Practice',
        description: 'Practice clapping different rhythm patterns',
        difficulty: 'easy',
        estimatedTime: 20,
        subject: 'Music',
        resources: ['musictheory.net', 'YouTube'],
      },
      {
        title: 'Learn a New Song',
        description: 'Learn the basics of a popular song on your instrument',
        difficulty: 'medium',
        estimatedTime: 45,
        subject: 'Music',
        resources: ['Ultimate Guitar', 'Flowkey'],
      },
    ],
    sports: [
      {
        title: 'Fitness Circuit',
        description: 'Complete a 15-minute bodyweight workout circuit',
        difficulty: 'easy',
        estimatedTime: 15,
        subject: 'Physical Education',
        resources: ['Nike Training Club', 'FitnessBlender'],
      },
      {
        title: 'Learn Sports Rules',
        description: 'Study the official rules of your favorite sport',
        difficulty: 'medium',
        estimatedTime: 30,
        subject: 'Sports',
        resources: ['Official Sport Websites'],
      },
    ],
    reading: [
      {
        title: 'Speed Reading Practice',
        description: 'Practice speed reading techniques with a short article',
        difficulty: 'easy',
        estimatedTime: 25,
        subject: 'English',
        resources: ['Spreeder', 'ReadTheory'],
      },
      {
        title: 'Book Summary',
        description: 'Read a chapter and write a brief summary',
        difficulty: 'medium',
        estimatedTime: 45,
        subject: 'English',
        resources: ['Project Gutenberg', 'SparkNotes'],
      },
    ],
    science: [
      {
        title: 'Science Experiment Video',
        description: 'Watch and understand a famous science experiment',
        difficulty: 'easy',
        estimatedTime: 20,
        subject: 'Science',
        resources: ['Khan Academy', 'Crash Course'],
      },
      {
        title: 'Periodic Table Quiz',
        description: 'Test your knowledge of elements and their properties',
        difficulty: 'medium',
        estimatedTime: 30,
        subject: 'Chemistry',
        resources: ['ptable.com', 'Quizlet'],
      },
    ],
  },

  // Career-oriented tasks
  careers: {
    'software-engineer': [
      {
        title: 'Algorithm Challenge',
        description: 'Solve 3 easy-level coding problems',
        difficulty: 'medium',
        estimatedTime: 45,
        subject: 'Computer Science',
        resources: ['LeetCode', 'CodeChef'],
      },
      {
        title: 'Learn Git Basics',
        description: 'Understand version control with Git and GitHub',
        difficulty: 'easy',
        estimatedTime: 30,
        subject: 'Programming',
        resources: ['GitHub Learning Lab', 'Git-SCM'],
      },
    ],
    doctor: [
      {
        title: 'Human Anatomy Study',
        description: 'Learn about a specific body system in detail',
        difficulty: 'medium',
        estimatedTime: 40,
        subject: 'Biology',
        resources: ['Khan Academy', 'Visible Body'],
      },
      {
        title: 'Medical Terminology',
        description: 'Learn 20 new medical terms and their meanings',
        difficulty: 'easy',
        estimatedTime: 25,
        subject: 'Biology',
        resources: ['Quizlet Medical Terms'],
      },
    ],
    engineer: [
      {
        title: 'Physics Problem Set',
        description: 'Solve practical physics problems related to engineering',
        difficulty: 'medium',
        estimatedTime: 35,
        subject: 'Physics',
        resources: ['Khan Academy Physics', 'HyperPhysics'],
      },
      {
        title: 'CAD Design Intro',
        description: 'Learn basic CAD software interface and tools',
        difficulty: 'easy',
        estimatedTime: 30,
        subject: 'Engineering',
        resources: ['Tinkercad', 'Fusion 360'],
      },
    ],
    teacher: [
      {
        title: 'Lesson Plan Practice',
        description: 'Create a simple lesson plan for teaching a concept',
        difficulty: 'medium',
        estimatedTime: 40,
        subject: 'Education',
        resources: ['Edutopia', 'TeachThought'],
      },
    ],
    artist: [
      {
        title: 'Portfolio Piece',
        description: 'Create a small artwork for your portfolio',
        difficulty: 'medium',
        estimatedTime: 45,
        subject: 'Art',
        resources: ['Behance', 'ArtStation'],
      },
    ],
    entrepreneur: [
      {
        title: 'Business Idea Brainstorm',
        description: 'Identify a problem and brainstorm business solutions',
        difficulty: 'easy',
        estimatedTime: 30,
        subject: 'Business Studies',
        resources: ['Y Combinator', 'Startup School'],
      },
    ],
  },

  // Performance-level tasks
  performance: {
    weak: [
      {
        title: 'Foundation Review',
        description: 'Review and practice basic concepts from previous chapters',
        difficulty: 'easy',
        estimatedTime: 30,
        subject: 'General',
      },
      {
        title: 'Study Technique Practice',
        description: 'Learn and practice effective study methods',
        difficulty: 'easy',
        estimatedTime: 25,
        subject: 'General',
      },
    ],
    medium: [
      {
        title: 'Practice Problem Set',
        description: 'Solve medium-difficulty problems to strengthen understanding',
        difficulty: 'medium',
        estimatedTime: 35,
        subject: 'General',
      },
      {
        title: 'Concept Connection',
        description: 'Connect concepts across different subjects',
        difficulty: 'medium',
        estimatedTime: 30,
        subject: 'General',
      },
    ],
    strong: [
      {
        title: 'Advanced Challenge',
        description: 'Tackle advanced problems and olympiad-level questions',
        difficulty: 'hard',
        estimatedTime: 45,
        subject: 'General',
      },
      {
        title: 'Peer Teaching',
        description: 'Prepare to explain a complex topic to classmates',
        difficulty: 'hard',
        estimatedTime: 40,
        subject: 'General',
      },
    ],
  },
};

/**
 * Get current free period if any
 */
const getCurrentFreePeriod = async (studentId) => {
  try {
    const student = await Student.findById(studentId);
    if (!student) return null;

    const timetable = await Timetable.findOne({
      class: student.class,
      section: student.section,
      isActive: true,
    });

    if (!timetable) return null;

    // Get current day and time
    const now = new Date();
    const dayIndex = now.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = dayNames[dayIndex];

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Find today's schedule
    const todaySchedule = timetable.schedule.find(s => s.day === today);
    if (!todaySchedule) return null;

    // Find current period
    const currentPeriod = todaySchedule.periods.find(period => {
      return currentTime >= period.startTime && 
             currentTime <= period.endTime && 
             period.isFree === true;
    });

    return currentPeriod;
  } catch (error) {
    console.error('Get current free period error:', error);
    return null;
  }
};

const generateTaskSuggestions = async (student, freePeriod) => {
  const suggestions = [];
  const availableTime = freePeriod ? 45 : 30; // minutes

  // 1. Get custom tasks from teachers (50% priority)
  const customTasks = await CustomFreePeriodTask.find({
    isActive: true,
    $or: [
      // Tasks for all students
      { targetClass: null, targetSection: null },
      // Tasks for specific class/section
      { targetClass: student.class, targetSection: student.section },
      // Tasks for this specific student
      { targetStudents: student._id },
    ],
    estimatedTime: { $lte: availableTime },
  }).limit(3);

  customTasks.forEach(task => {
    suggestions.push({
      title: task.title,
      description: task.description,
      difficulty: task.difficulty,
      estimatedTime: task.estimatedTime,
      subject: task.subject,
      resources: task.resources,
      instructions: task.instructions,
      category: task.category,
      matchReason: '✨ Custom task from your teacher',
      priority: 4, // Highest priority
      isCustom: true,
    });
  });

  // 2. Interest-based tasks (40% weight)
  if (student.interests && student.interests.length > 0) {
    student.interests.forEach(interest => {
      const interestTasks = TASK_LIBRARY.interests[interest.toLowerCase()];
      if (interestTasks) {
        const suitableTasks = interestTasks.filter(
          task => task.estimatedTime <= availableTime
        );
        suggestions.push(...suitableTasks.map(task => ({
          ...task,
          category: 'interest',
          matchReason: `Based on your interest in ${interest}`,
          priority: 2,
        })));
      }
    });
  }

  // 3. Career-oriented tasks (30% weight)
  if (student.careerGoals && student.careerGoals.length > 0) {
    student.careerGoals.forEach(career => {
      const careerTasks = TASK_LIBRARY.careers[career.toLowerCase()];
      if (careerTasks) {
        const suitableTasks = careerTasks.filter(
          task => task.estimatedTime <= availableTime
        );
        suggestions.push(...suitableTasks.map(task => ({
          ...task,
          category: 'career',
          matchReason: `Aligned with your career goal: ${career}`,
          priority: 3,
        })));
      }
    });
  }

  // 4. Performance-level tasks (30% weight)
  const performanceLevel = student.performanceLevel || 'medium';
  const performanceTasks = TASK_LIBRARY.performance[performanceLevel];
  if (performanceTasks) {
    suggestions.push(...performanceTasks.map(task => ({
      ...task,
      category: 'improvement',
      matchReason: `Tailored for your current performance level`,
      priority: 1,
    })));
  }

  // Sort by priority (higher first) and shuffle within same priority
  const sorted = suggestions.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return Math.random() - 0.5;
  });

  // Return top 8 suggestions (increased from 6 to include custom tasks)
  return sorted.slice(0, 8);
};

/**
 * @desc    Get smart task suggestions for free period
 * @route   GET /api/student/free-period-suggestions
 * @access  Private (Student)
 */
const getFreePeriodSuggestions = async (req, res) => {
  try {
    const studentId = req.user.profileId;

    // Get student data
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if currently in free period
    const currentFreePeriod = await getCurrentFreePeriod(studentId);

    // Generate suggestions
    const suggestions = await generateTaskSuggestions(student, currentFreePeriod);

    res.status(200).json({
      success: true,
      data: {
        isFreePeriod: !!currentFreePeriod,
        currentPeriod: currentFreePeriod,
        studentProfile: {
          name: student.name,
          performanceLevel: student.performanceLevel,
          interests: student.interests,
          careerGoals: student.careerGoals,
          learningPace: student.learningPace,
        },
        suggestions,
        totalSuggestions: suggestions.length,
      },
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating suggestions',
      error: error.message,
    });
  }
};


/**
 * @desc    Mark a suggested task as completed
 * @route   POST /api/student/free-period-tasks/complete
 * @access  Private (Student)
 */
const markTaskComplete = async (req, res) => {
  try {
    const studentId = req.user.profileId;
    const {
      taskTitle,
      taskCategory,
      difficulty,
      subject,
      estimatedTime,
      rating,
      notes,
      wasHelpful,
    } = req.body;

    if (!taskTitle || !taskCategory || !difficulty || !estimatedTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const completion = await FreePeriodTaskCompletion.create({
      studentId,
      taskTitle,
      taskCategory,
      difficulty,
      subject: subject || 'General',
      estimatedTime,
      rating: rating || undefined,
      notes: notes || undefined,
      wasHelpful: wasHelpful !== undefined ? wasHelpful : true,
    });

    res.status(201).json({
      success: true,
      message: 'Task marked as completed!',
      data: completion,
    });
  } catch (error) {
    console.error('Mark task complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking task as complete',
      error: error.message,
    });
  }
};

/**
 * @desc    Get student's completed tasks
 * @route   GET /api/student/free-period-tasks/completed
 * @access  Private (Student)
 */
const getCompletedTasks = async (req, res) => {
  try {
    const studentId = req.user.profileId;

    const completedTasks = await FreePeriodTaskCompletion.find({ studentId })
      .sort({ completedAt: -1 })
      .limit(50);

    const stats = await FreePeriodTaskCompletion.getStudentStats(studentId);

    res.status(200).json({
      success: true,
      data: {
        completedTasks,
        stats,
      },
    });
  } catch (error) {
    console.error('Get completed tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching completed tasks',
      error: error.message,
    });
  }
};

/**
 * @desc    Get task completion statistics
 * @route   GET /api/student/free-period-tasks/stats
 * @access  Private (Student)
 */
const getTaskStats = async (req, res) => {
  try {
    const studentId = req.user.profileId;
    const stats = await FreePeriodTaskCompletion.getStudentStats(studentId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message,
    });
  }
};

module.exports = {
  getFreePeriodSuggestions,
  markTaskComplete,
  getCompletedTasks,
  getTaskStats,
};
