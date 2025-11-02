// frontend_nextjs/src/types/test-history.ts
export interface TestAttempt {
    id?: string;
    userId: string;
    testId: string;
    testTitle: string;
    topic: string;
    difficulty: string;
    
    // Kết quả chi tiết
    score: number; // Điểm tổng (0-100)
    totalQuestions: number;
    correctAnswers: number;
    
    // Phân tích theo loại câu hỏi
    multipleChoiceScore: number; // % đúng
    trueFalseScore: number;
    shortAnswerScore: number;
    
    // Phân tích theo chủ đề (nếu có)
    topicBreakdown?: {
      [topicName: string]: {
        correct: number;
        total: number;
        percentage: number;
      };
    };
    
    // Chi tiết câu trả lời
    answers: {
      questionId: string;
      questionType: 'multiple-choice' | 'true-false' | 'short-answer';
      userAnswer: any;
      correctAnswer: any;
      isCorrect: boolean;
      topic?: string; // Chủ đề của câu hỏi
    }[];
    
    // Metadata
    startedAt: Date;
    completedAt: Date;
    timeSpent: number; // Giây
  }
  
  export interface UserProgress {
    userId: string;
    
    // Thống kê tổng quan
    totalTests: number;
    averageScore: number;
    totalTimeSpent: number;
    
    // Điểm mạnh/yếu
    strongTopics: string[]; // Chủ đề đạt >80%
    weakTopics: string[]; // Chủ đề <60%
    
    // Xu hướng
    recentScores: number[]; // 5 lần gần nhất
    improvementRate: number; // % cải thiện
    
    // Đề xuất
    recommendedTopics: string[];
    recommendedDifficulty: 'easy' | 'medium' | 'hard';
    
    lastUpdated: Date;
  }
  
  export interface TestRecommendation {
    topic: string;
    difficulty: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }