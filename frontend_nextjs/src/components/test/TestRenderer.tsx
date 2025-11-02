// frontend_nextjs/src/components/test/TestRenderer.tsx
'use client';

import { useState, useMemo } from 'react';
import type { Test, Question } from '@/types/test-schema';
import type { TestAttempt } from '@/types/test-history';
import { QuestionComponent } from './Question';
import { TestControls } from './TestControls';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { TestHistoryService } from '@/services/test-history.service';
import { useToast } from '@/hooks/use-toast';
import { Clock, Target, Award, TrendingUp } from 'lucide-react';

type UserAnswers = {
  [questionId: string]: any;
};

interface Props {
  testData: Test;
  onRetry: () => void;
  testId?: string;
  topic?: string;
  difficulty?: string;
}

export function TestRenderer({ 
  testData, 
  onRetry, 
  testId = 'custom', 
  topic = 'Tổng hợp', 
  difficulty = 'medium' 
}: Props) {
  const [startTime] = useState(new Date());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const allQuestions = useMemo(() => [
    ...testData.parts.multipleChoice.questions,
    ...testData.parts.trueFalse.questions,
    ...testData.parts.shortAnswer.questions,
  ], [testData]);
  
  const getInitialAnswer = (question: Question) => {
    switch (question.type) {
      case 'multiple-choice': return null;
      case 'true-false': return Array(question.statements.length).fill(null);
      case 'short-answer': return Array(6).fill('');
      default: return null;
    }
  }

  const initialAnswers = useMemo(() => {
    const answers: UserAnswers = {};
    allQuestions.forEach(q => {
      answers[q.id] = getInitialAnswer(q);
    });
    return answers;
  }, [allQuestions]);

  const [currentAnswers, setCurrentAnswers] = useState<UserAnswers>(initialAnswers);

  const handleAnswerChange = (questionId: string, answer: any) => {
    setCurrentAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const calculateDetailedScore = () => {
    let totalCorrect = 0;
    let mcCorrect = 0, mcTotal = 0;
    let tfCorrect = 0, tfTotal = 0;
    let saCorrect = 0, saTotal = 0;
    
    const detailedAnswers: TestAttempt['answers'] = [];
    
    allQuestions.forEach(q => {
      const userAnswer = currentAnswers[q.id];
      let isCorrect = false;
      
      if (q.type === 'multiple-choice') {
        isCorrect = userAnswer === q.answer;
        mcTotal++;
        if (isCorrect) { mcCorrect++; totalCorrect++; }
      } else if (q.type === 'true-false') {
        isCorrect = JSON.stringify(userAnswer) === JSON.stringify(q.answer);
        tfTotal++;
        if (isCorrect) { tfCorrect++; totalCorrect++; }
      } else if (q.type === 'short-answer') {
        isCorrect = userAnswer.join('') === q.answer;
        saTotal++;
        if (isCorrect) { saCorrect++; totalCorrect++; }
      }
      
      detailedAnswers.push({
        questionId: q.id,
        questionType: q.type,
        userAnswer,
        correctAnswer: q.answer,
        isCorrect,
        topic
      });
    });
    
    return {
      score: (totalCorrect / allQuestions.length) * 100,
      totalCorrect,
      detailedAnswers,
      multipleChoiceScore: mcTotal > 0 ? (mcCorrect / mcTotal) * 100 : 0,
      trueFalseScore: tfTotal > 0 ? (tfCorrect / tfTotal) * 100 : 0,
      shortAnswerScore: saTotal > 0 ? (saCorrect / saTotal) * 100 : 0
    };
  }

  const answeredCount = useMemo(() => {
    return Object.values(currentAnswers).filter(answer => {
      if (Array.isArray(answer)) {
        return answer.every(val => val !== null && val !== '');
      }
      return answer !== null && answer !== '';
    }).length;
  }, [currentAnswers]);
  
  const progress = (answeredCount / allQuestions.length) * 100;
  const canSubmit = answeredCount === allQuestions.length;

  const handleSubmit = async () => {
    setIsSubmitted(true);
    const endTime = new Date();
    const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    const scoreData = calculateDetailedScore();
    
    // Lưu vào Firestore nếu user đã đăng nhập
    if (user) {
      setIsSaving(true);
      try {
        const historyService = new TestHistoryService(firestore);
        
        const attempt: Omit<TestAttempt, 'id'> = {
          userId: user.uid,
          testId,
          testTitle: testData.title,
          topic,
          difficulty,
          score: scoreData.score,
          totalQuestions: allQuestions.length,
          correctAnswers: scoreData.totalCorrect,
          multipleChoiceScore: scoreData.multipleChoiceScore,
          trueFalseScore: scoreData.trueFalseScore,
          shortAnswerScore: scoreData.shortAnswerScore,
          answers: scoreData.detailedAnswers,
          startedAt: startTime,
          completedAt: endTime,
          timeSpent
        };
        
        await historyService.saveTestAttempt(attempt);
        
        toast({
          title: "✅ Đã lưu kết quả!",
          description: `Điểm: ${scoreData.score.toFixed(1)}/100 - Thời gian: ${formatTime(timeSpent)}`
        });
      } catch (error) {
        console.error("Error saving test attempt:", error);
        toast({
          variant: "destructive",
          title: "Lỗi lưu kết quả",
          description: "Không thể lưu kết quả bài làm. Vui lòng thử lại."
        });
      } finally {
        setIsSaving(false);
      }
    } else {
      toast({
        title: "💡 Mẹo nhỏ",
        description: "Đăng nhập để lưu lại kết quả và theo dõi tiến độ học tập!",
        variant: "default"
      });
    }
  };

  const handleReset = () => {
    onRetry();
  }
  
  const scoreData = isSubmitted ? calculateDetailedScore() : null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return { label: 'Xuất sắc', color: 'bg-green-500', emoji: '🏆' };
    if (score >= 80) return { label: 'Giỏi', color: 'bg-blue-500', emoji: '🎯' };
    if (score >= 70) return { label: 'Khá', color: 'bg-yellow-500', emoji: '⭐' };
    if (score >= 60) return { label: 'Trung bình', color: 'bg-orange-500', emoji: '💪' };
    return { label: 'Cần cố gắng', color: 'bg-red-500', emoji: '📚' };
  };

  return (
    <div className="space-y-8">
      {/* Progress Bar - Only show when not submitted */}
      {!isSubmitted && (
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Progress value={progress} className="flex-1" />
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {answeredCount}/{allQuestions.length} câu
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Card - Show after submission */}
      {isSubmitted && scoreData && (
        <Card className="bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-950 dark:via-cyan-950 dark:to-teal-950 border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Kết quả bài làm</CardTitle>
                <CardDescription className="mt-2">
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Đang lưu kết quả...
                    </span>
                  ) : user ? (
                    <span className="text-green-600 dark:text-green-400">✅ Kết quả đã được lưu vào hồ sơ của bạn</span>
                  ) : (
                    <span className="text-muted-foreground">💡 Đăng nhập để lưu kết quả và theo dõi tiến độ</span>
                  )}
                </CardDescription>
              </div>
              {scoreData && (
                <Badge className={`${getScoreGrade(scoreData.score).color} text-white text-lg px-4 py-2`}>
                  {getScoreGrade(scoreData.score).emoji} {getScoreGrade(scoreData.score).label}
                </Badge>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Main Score */}
            <div className="text-center py-6 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Award className="w-8 h-8 text-primary" />
                <p className="text-6xl font-bold text-primary">
                  {scoreData.score.toFixed(1)}
                </p>
                <span className="text-2xl text-muted-foreground">/100</span>
              </div>
              <p className="text-muted-foreground mt-2">
                {scoreData.totalCorrect}/{allQuestions.length} câu đúng
              </p>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <p className="text-sm font-medium text-muted-foreground">Trắc nghiệm</p>
                </div>
                <p className="text-3xl font-bold text-blue-600">
                  {scoreData.multipleChoiceScore.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {testData.parts.multipleChoice.questions.length} câu
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <p className="text-sm font-medium text-muted-foreground">Đúng/Sai</p>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {scoreData.trueFalseScore.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {testData.parts.trueFalse.questions.length} câu
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <p className="text-sm font-medium text-muted-foreground">Trả lời ngắn</p>
                </div>
                <p className="text-3xl font-bold text-purple-600">
                  {scoreData.shortAnswerScore.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {testData.parts.shortAnswer.questions.length} câu
                </p>
              </div>
            </div>

            {/* Time Stats */}
            <div className="flex items-center justify-center gap-6 p-4 bg-white dark:bg-gray-900 rounded-lg border">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Thời gian làm bài</p>
                  <p className="text-lg font-semibold">
                    {formatTime(Math.floor((new Date().getTime() - startTime.getTime()) / 1000))}
                  </p>
                </div>
              </div>
              
              <div className="w-px h-12 bg-border" />
              
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Độ chính xác</p>
                  <p className="text-lg font-semibold">
                    {((scoreData.totalCorrect / allQuestions.length) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Part 1: Multiple Choice */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
            1
          </div>
          <h2 className="text-xl font-bold">{testData.parts.multipleChoice.title}</h2>
          <Badge variant="secondary">{testData.parts.multipleChoice.questions.length} câu</Badge>
        </div>
        {testData.parts.multipleChoice.questions.map((q, index) => (
          <QuestionComponent
            key={q.id}
            question={q}
            questionNumber={index + 1}
            isSubmitted={isSubmitted}
            userAnswer={currentAnswers[q.id]}
            onAnswerChange={(answer) => handleAnswerChange(q.id, answer)}
          />
        ))}
      </div>

      {/* Part 2: True/False */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 dark:text-green-400 font-bold">
            2
          </div>
          <h2 className="text-xl font-bold">{testData.parts.trueFalse.title}</h2>
          <Badge variant="secondary">{testData.parts.trueFalse.questions.length} câu</Badge>
        </div>
        {testData.parts.trueFalse.questions.map((q, index) => (
          <QuestionComponent
            key={q.id}
            question={q}
            questionNumber={testData.parts.multipleChoice.questions.length + index + 1}
            isSubmitted={isSubmitted}
            userAnswer={currentAnswers[q.id]}
            onAnswerChange={(answer) => handleAnswerChange(q.id, answer)}
          />
        ))}
      </div>

      {/* Part 3: Short Answer */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
            3
          </div>
          <h2 className="text-xl font-bold">{testData.parts.shortAnswer.title}</h2>
          <Badge variant="secondary">{testData.parts.shortAnswer.questions.length} câu</Badge>
        </div>
        {testData.parts.shortAnswer.questions.map((q, index) => (
          <QuestionComponent
            key={q.id}
            question={q}
            questionNumber={
              testData.parts.multipleChoice.questions.length + 
              testData.parts.trueFalse.questions.length + 
              index + 1
            }
            isSubmitted={isSubmitted}
            userAnswer={currentAnswers[q.id]}
            onAnswerChange={(answer) => handleAnswerChange(q.id, answer)}
          />
        ))}
      </div>

      {/* Controls */}
      <TestControls 
        onSubmit={handleSubmit}
        onRetry={handleReset}
        isSubmitted={isSubmitted}
        canSubmit={canSubmit}
      />
    </div>
  );
}