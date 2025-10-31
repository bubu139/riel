'use client';

import { Question as QuestionType } from '@/types/test-schema';
import { MultipleChoiceQuestionComponent } from './MultipleChoiceQuestion';
import { TrueFalseQuestionComponent } from './TrueFalseQuestion';
import { ShortAnswerQuestionComponent } from './ShortAnswerQuestion';

interface Props {
  question: QuestionType;
  questionNumber: number;
  isSubmitted: boolean;
  userAnswer: any;
  onAnswerChange: (answer: any) => void;
}

export function QuestionComponent({ question, questionNumber, isSubmitted, userAnswer, onAnswerChange }: Props) {
  switch (question.type) {
    case 'multiple-choice':
      return <MultipleChoiceQuestionComponent 
        question={question} 
        questionNumber={questionNumber}
        isSubmitted={isSubmitted}
        userAnswer={userAnswer}
        onAnswerChange={onAnswerChange}
      />;
    case 'true-false':
      return <TrueFalseQuestionComponent
        question={question}
        questionNumber={questionNumber}
        isSubmitted={isSubmitted}
        userAnswer={userAnswer}
        onAnswerChange={onAnswerChange}
      />;
    case 'short-answer':
      return <ShortAnswerQuestionComponent
        question={question}
        questionNumber={questionNumber}
        isSubmitted={isSubmitted}
        userAnswer={userAnswer}
        onAnswerChange={onAnswerChange}
       />;
    default:
      return <div>Unknown question type</div>;
  }
}
