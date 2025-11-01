'use client';

import { useState, useMemo } from 'react';
import type { Test, Question } from '@/types/test-schema';
import { QuestionComponent } from './Question';
import { TestControls } from './TestControls';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type UserAnswers = {
  [questionId: string]: any;
};

interface Props {
  testData: Test;
  onRetry: () => void;
}

export function TestRenderer({ testData, onRetry }: Props) {
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

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

  // Initialize answers state
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

  const calculateScore = () => {
    let correctCount = 0;
    allQuestions.forEach(q => {
        const userAnswer = currentAnswers[q.id];
        if(q.type === 'multiple-choice' || q.type === 'short-answer') {
            const isCorrect = q.type === 'short-answer' 
                ? userAnswer.join('') === q.answer
                : userAnswer === q.answer;
            if(isCorrect) correctCount++;
        } else if (q.type === 'true-false') {
            let allStatementsCorrect = true;
            for(let i = 0; i < q.answer.length; i++){
                if(userAnswer[i] !== q.answer[i]) {
                    allStatementsCorrect = false;
                    break;
                }
            }
            if(allStatementsCorrect) correctCount++;
        }
    });
    return (correctCount / allQuestions.length) * 100;
  }

  const answeredCount = useMemo(() => {
      return Object.values(currentAnswers).filter(answer => {
          if(Array.isArray(answer)) {
              return answer.every(val => val !== null && val !== '');
          }
          return answer !== null && answer !== '';
      }).length;
  }, [currentAnswers]);
  const progress = (answeredCount / allQuestions.length) * 100;
  const canSubmit = answeredCount === allQuestions.length;


  const handleSubmit = () => {
    setIsSubmitted(true);
    // Here you would typically save the results to a backend
    console.log("Final Answers:", currentAnswers);
    console.log("Score:", calculateScore());
  };

  const handleReset = () => {
    onRetry();
  }

  return (
    <div className="space-y-8">
        {!isSubmitted && (
            <Card>
                <CardContent className="p-4 flex items-center gap-4">
                    <Progress value={progress} className="flex-1" />
                    <div className="text-sm text-muted-foreground">
                        {answeredCount}/{allQuestions.length} câu
                    </div>
                </CardContent>
            </Card>
        )}

      {isSubmitted && (
          <Card className="bg-gradient-to-r from-blue-50 to-cyan-50">
              <CardHeader>
                  <CardTitle>Kết quả bài làm</CardTitle>
                  <CardDescription>Bạn đã hoàn thành bài kiểm tra.</CardDescription>
              </CardHeader>
              <CardContent>
                  <p className="text-4xl font-bold text-center text-primary">
                      {calculateScore().toFixed(2)}/100
                  </p>
              </CardContent>
          </Card>
      )}

      {/* Part 1 */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold border-b pb-2">{testData.parts.multipleChoice.title}</h2>
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

      {/* Part 2 */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold border-b pb-2">{testData.parts.trueFalse.title}</h2>
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

      {/* Part 3 */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold border-b pb-2">{testData.parts.shortAnswer.title}</h2>
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

      <TestControls 
        onSubmit={handleSubmit}
        onRetry={handleReset}
        isSubmitted={isSubmitted}
        canSubmit={canSubmit}
      />
    </div>
  );
}
