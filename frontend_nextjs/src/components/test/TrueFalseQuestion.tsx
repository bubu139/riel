'use client';

import type { TrueFalseQuestion } from '@/types/test-schema';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, CheckCircle, X, XCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';

interface Props {
  question: TrueFalseQuestion;
  questionNumber: number;
  isSubmitted: boolean;
  userAnswer: (boolean | null)[];
  onAnswerChange: (answer: (boolean | null)[]) => void;
}

export function TrueFalseQuestionComponent({ question, questionNumber, isSubmitted, userAnswer, onAnswerChange }: Props) {
  
  const handleSelect = (statementIndex: number, value: boolean) => {
    if (isSubmitted) return;
    const newAnswers = [...userAnswer];
    newAnswers[statementIndex] = value;
    onAnswerChange(newAnswers);
  };

  const getButtonClass = (statementIndex: number, buttonValue: boolean) => {
    const selected = userAnswer[statementIndex];
    
    if (!isSubmitted) {
        return selected === buttonValue ? 'bg-blue-100 border-blue-400' : 'bg-background hover:bg-muted/50';
    }

    const isCorrect = question.answer[statementIndex];
    if (buttonValue === isCorrect) {
        return 'bg-green-100 border-green-500 text-green-900';
    }
    if (selected === buttonValue) {
        return 'bg-red-100 border-red-500 text-red-900';
    }
    return 'bg-background';
  }

  const isQuestionCorrect = isSubmitted && JSON.stringify(userAnswer) === JSON.stringify(question.answer);


  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 font-bold text-primary">Câu {questionNumber}:</div>
            <div className="flex-1 prose prose-sm max-w-none">
                 <ReactMarkdown remarkPlugins={[remarkMath]}>{question.prompt}</ReactMarkdown>
            </div>
            {isSubmitted && (
                <div className="ml-auto flex-shrink-0">
                    {isQuestionCorrect ? <CheckCircle className="text-green-500" /> : <XCircle className="text-red-500" />}
                </div>
            )}
        </div>
        
        <div className="space-y-4 mt-4">
          {question.statements.map((statement, index) => (
            <div key={index} className="p-4 border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkMath]}>{index+1}. {statement}</ReactMarkdown>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <Button 
                    variant="outline"
                    className={cn("w-24", getButtonClass(index, true))}
                    onClick={() => handleSelect(index, true)}
                    disabled={isSubmitted}
                >
                    <Check className="mr-2 h-4 w-4"/> Đúng
                </Button>
                <Button 
                    variant="outline" 
                    className={cn("w-24", getButtonClass(index, false))}
                    onClick={() => handleSelect(index, false)}
                    disabled={isSubmitted}
                >
                    <X className="mr-2 h-4 w-4"/> Sai
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
