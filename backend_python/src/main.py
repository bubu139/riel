# src/main.py
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Import config
from .ai_config import genai

app = FastAPI(title="Math Tutor API")

# ===== SCHEMAS =====
class ChatInputSchema(BaseModel):
    message: str
    history: list = []

class GenerateExercisesInput(BaseModel):
    topic: str
    difficulty: str = "medium"
    count: int = 5

class GenerateTestInput(BaseModel):
    topic: str
    difficulty: str = "medium"
    question_count: int = 10

class SummarizeTopicInput(BaseModel):
    topic: str
    detail_level: str = "medium"

class GeogebraInputSchema(BaseModel):
    description: str
    graph_type: str = "function"

# ===== HELPER FUNCTIONS =====
async def stream_generator(text_generator):
    """Convert generator to async generator for streaming"""
    for chunk in text_generator:
        if hasattr(chunk, 'text') and chunk.text:
            yield chunk.text

# ===== ENDPOINTS =====
@app.get("/")
async def root():
    return {
        "status": "ok", 
        "message": "Math Tutor API is running",
        "endpoints": [
            "/api/chat",
            "/api/generate-exercises", 
            "/api/generate-test",
            "/api/summarize-topic",
            "/api/geogebra"
        ]
    }

@app.post("/api/chat")
async def handle_chat(request: ChatInputSchema):
    """Handle chat with streaming response"""
    try:
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(
            request.message,
            stream=True
        )
        
        return StreamingResponse(
            stream_generator(response),
            media_type="text/plain; charset=utf-8"
        )
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-exercises")
async def handle_generate_exercises(request: GenerateExercisesInput):
    """Generate math exercises"""
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""Generate {request.count} math exercises about "{request.topic}" 
        with difficulty level: {request.difficulty}.
        
        Return as JSON array with this exact format:
        [
            {{
                "question": "question text",
                "answer": "answer text",
                "hint": "helpful hint",
                "solution": "step by step solution"
            }}
        ]
        """
        
        response = model.generate_content(prompt)
        
        return {
            "topic": request.topic,
            "difficulty": request.difficulty,
            "exercises": response.text
        }
    except Exception as e:
        print(f"Generate exercises error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-test")
async def handle_generate_test(request: GenerateTestInput):
    """Generate a test with multiple questions"""
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""Create a test about "{request.topic}" with {request.question_count} questions.
        Difficulty level: {request.difficulty}
        
        Include multiple choice, true/false, and short answer questions.
        Return as JSON with this format:
        {{
            "title": "Test title",
            "questions": [
                {{
                    "type": "multiple_choice|true_false|short_answer",
                    "question": "question text",
                    "options": ["A", "B", "C", "D"],  // only for multiple choice
                    "correct_answer": "answer",
                    "explanation": "why this is correct"
                }}
            ]
        }}
        """
        
        response = model.generate_content(prompt)
        
        return {
            "topic": request.topic,
            "test": response.text
        }
    except Exception as e:
        print(f"Generate test error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/summarize-topic")
async def handle_summarize_topic(request: SummarizeTopicInput):
    """Summarize a math topic"""
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        detail_map = {
            "brief": "a brief overview in 2-3 sentences",
            "medium": "a comprehensive summary with key concepts",
            "detailed": "a detailed explanation with examples and applications"
        }
        
        detail_instruction = detail_map.get(request.detail_level, detail_map["medium"])
        
        prompt = f"""Provide {detail_instruction} of the math topic: "{request.topic}"
        
        Include:
        - Main concepts
        - Key formulas (if applicable)
        - Common applications
        - Tips for understanding
        """
        
        response = model.generate_content(prompt)
        
        return {
            "topic": request.topic,
            "detail_level": request.detail_level,
            "summary": response.text
        }
    except Exception as e:
        print(f"Summarize topic error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/geogebra")
async def handle_geogebra(request: GeogebraInputSchema):
    """Generate GeoGebra commands"""
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""Generate GeoGebra commands to create: {request.description}
        Graph type: {request.graph_type}
        
        Return ONLY valid GeoGebra commands, one per line.
        Example commands:
        - f(x) = x^2
        - A = (2, 3)
        - Circle(A, 5)
        
        Do not include explanations, just the commands.
        """
        
        response = model.generate_content(prompt)
        
        return {
            "description": request.description,
            "commands": response.text
        }
    except Exception as e:
        print(f"Geogebra error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)