# src/main.py
import uvicorn
import json
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware  
from pydantic import BaseModel
from typing import List, Optional
import PyPDF2

# Import config
from .ai_config import genai

# ===== PDF PROCESSING =====

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from a PDF file"""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error reading PDF {pdf_path}: {e}")
        return ""

def load_reference_materials(folder_path: str, max_files: int = 5) -> str:
    """Load and combine text from multiple PDF files in a folder"""
    folder = Path(folder_path)
    if not folder.exists():
        print(f"Warning: Folder {folder_path} does not exist")
        return ""
    
    pdf_files = list(folder.glob("*.pdf"))[:max_files]
    
    if not pdf_files:
        print(f"Warning: No PDF files found in {folder_path}")
        return ""
    
    combined_text = ""
    for pdf_file in pdf_files:
        print(f"Loading: {pdf_file.name}")
        text = extract_text_from_pdf(str(pdf_file))
        combined_text += f"\n\n=== TÀI LIỆU: {pdf_file.name} ===\n{text}\n"
    
    return combined_text

# ===== PATHS CONFIGURATION =====

BASE_DIR = Path(__file__).parent.parent
EXERCISES_FOLDER = BASE_DIR / "reference_materials" / "exercises"
TESTS_FOLDER = BASE_DIR / "reference_materials" / "tests"

EXERCISES_FOLDER.mkdir(parents=True, exist_ok=True)
TESTS_FOLDER.mkdir(parents=True, exist_ok=True)

print(f"📁 Exercises folder: {EXERCISES_FOLDER}")
print(f"📁 Tests folder: {TESTS_FOLDER}")

# ===== SYSTEM INSTRUCTIONS =====

CHAT_SYSTEM_INSTRUCTION = """Bạn là một AI gia sư toán học THPT lớp 12 Việt Nam chuyên nghiệp, thân thiện và kiên nhẫn.

🎯 MỤC TIÊU CHÍNH:
- Giúp học sinh HIỂU BẢN CHẤT vấn đề, không chỉ ghi nhớ công thức
- Khuyến khích tư duy logic và phương pháp giải quyết vấn đề
- Xây dựng nền tảng vững chắc cho kỳ thi THPT Quốc gia

📚 PHẠM VI KIẾN THỨC:
- Giải tích 12: Hàm số, đạo hàm, khảo sát hàm số, tích phân, số phức
- Hình học không gian: Khối đa diện, mặt nón, mặt trụ, mặt cầu
- Xác suất thống kê: Xác suất, biến ngẫu nhiên

🔧 CÁCH TRÌNH BÀY:
1. **Phân tích đề bài**: Xác định dạng bài, yêu cầu cụ thể
2. **Hướng dẫn từng bước**: Giải thích logic đằng sau mỗi bước
3. **Sử dụng LaTeX**: Viết công thức toán học đẹp với $...$ (inline) hoặc $$...$$ (display)
4. **Kiểm tra lại**: Luôn verify đáp án cuối cùng

💡 PHONG CÁCH GIẢNG DẠY:
- Dùng ví dụ thực tế để minh họa khái niệm trừu tượng
- Chỉ ra các SAI LẦM THƯỜNG GẶP
- Cung cấp tips & tricks cho kỳ thi
- Khuyến khích học sinh đặt câu hỏi

⚠️ LƯU Ý:
- Không đưa ra đáp án trực tiếp ngay lập tức, hãy hướng dẫn
- Nếu học sinh mắc lỗi, chỉ ra nhẹ nhàng và giải thích tại sao
- Điều chỉnh độ khó phù hợp với từng học sinh

"Một AI gia sư giỏi không phải là người giải bài nhanh nhất, mà là người giúp học sinh TỰ TIN giải bài một mình!" 🎓"""

GEOGEBRA_SYSTEM_INSTRUCTION = """Bạn là một chuyên gia GeoGebra, chuyên chuyển đổi mô tả bằng ngôn ngữ tự nhiên thành các lệnh GeoGebra hợp lệ.

🎯 NHIỆM VỤ:
- Phân tích yêu cầu vẽ hình của người dùng
- Sinh ra danh sách các lệnh GeoGebra chính xác, có thứ tự logic
- Đảm bảo các lệnh tương thích với GeoGebra Classic

📐 CÚ PHÁP GEOGEBRA CƠ BẢN:
1. **Điểm**: A = (2, 3) hoặc Point({2, 3})
2. **Đường thẳng**: y = 2x + 1 hoặc Line(A, B)
3. **Đường tròn**: Circle((0,0), 3) hoặc Circle(A, r)
4. **Hàm số**: f(x) = x^2 - 4x + 3
5. **Parabol**: y = a*x^2 + b*x + c
6. **Vector**: v = Vector(A, B)
7. **Đa giác**: Polygon(A, B, C)
8. **Góc**: Angle(A, B, C)
9. **Text**: Text("Label", A)

🔧 QUY TẮC QUAN TRỌNG:
- Định nghĩa các đối tượng cơ bản trước (điểm, hệ số)
- Sử dụng tên biến ngắn gọn (A, B, C cho điểm)
- Tránh xung đột tên biến
- Các lệnh phải độc lập, không phụ thuộc biến ngoài

⚠️ LƯU Ý:
- KHÔNG thêm giải thích, chỉ trả về lệnh
- KHÔNG sử dụng ký tự đặc biệt Việt Nam trong tên biến
- Đảm bảo cú pháp 100% chính xác

🎯 OUTPUT FORMAT: {"commands": ["command1", "command2", ...]}"""

EXERCISE_SYSTEM_INSTRUCTION = """Bạn là một chuyên gia biên soạn bài tập toán THPT lớp 12 Việt Nam."""

TEST_SYSTEM_INSTRUCTION = """Bạn là một chuyên gia biên soạn đề kiểm tra/thi THPT Quốc gia môn Toán."""

SUMMARIZE_SYSTEM_INSTRUCTION = """Bạn là một giảng viên toán học chuyên tóm tắt kiến thức một cách súc tích."""

# ===== FASTAPI APP =====

app = FastAPI(title="Math Tutor API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== SCHEMAS =====

class MediaPart(BaseModel):
    url: str

class ChatInputSchema(BaseModel):
    message: str
    history: List = []
    media: Optional[List[MediaPart]] = None

class GenerateExercisesInput(BaseModel):
    topic: str
    difficulty: str = "medium"
    count: int = 3

class GenerateTestInput(BaseModel):
    topic: str
    difficulty: str = "medium"

class SummarizeTopicInput(BaseModel):
    topic: str
    detail_level: str = "medium"

class GeogebraInputSchema(BaseModel):
    request: str
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
        "message": "Math Tutor API with PDF Reference Integration",
        "model": "gemini-2.0-flash-exp",
        "endpoints": [
            "/api/chat",
            "/api/generate-exercises", 
            "/api/generate-test",
            "/api/summarize-topic",
            "/api/geogebra"
        ],
        "reference_folders": {
            "exercises": str(EXERCISES_FOLDER),
            "tests": str(TESTS_FOLDER)
        }
    }

@app.post("/api/chat")
async def handle_chat(request: ChatInputSchema):
    """Handle chat with streaming response"""
    try:
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
        }
        
        model = genai.GenerativeModel(
            'gemini-2.0-flash-exp',
            generation_config=generation_config,
            system_instruction=CHAT_SYSTEM_INSTRUCTION
        )
        
        if request.media:
            prompt_parts = [request.message]
            response = model.generate_content(prompt_parts, stream=True)
        else:
            response = model.generate_content(request.message, stream=True)
        
        return StreamingResponse(
            stream_generator(response),
            media_type="text/plain; charset=utf-8"
        )
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-exercises")
async def handle_generate_exercises(request: GenerateExercisesInput):
    """Generate math exercises based on PDF reference materials"""
    try:
        print(f"📚 Loading exercise reference materials for topic: {request.topic}")
        reference_text = load_reference_materials(str(EXERCISES_FOLDER), max_files=3)
        
        generation_config = {
            "temperature": 0.7,
            "response_mime_type": "application/json",
        }
        
        model = genai.GenerativeModel(
            'gemini-2.0-flash-exp',
            generation_config=generation_config,
            system_instruction=EXERCISE_SYSTEM_INSTRUCTION
        )
        
        prompt = f"""Tạo {request.count} bài tập toán học về chủ đề: "{request.topic}"
Độ khó: {request.difficulty}

YÊU CẦU:
- Bài tập phải BÁM SÁT các dạng bài trong tài liệu tham khảo
- Đảm bảo độ chính xác theo chương trình Toán 12 Việt Nam
- Cung cấp lời giải chi tiết từng bước

TÀI LIỆU THAM KHẢO:
{reference_text if reference_text else "Không có tài liệu. Tạo bài tập theo kiến thức chuẩn."}

Trả về JSON format:
{{
  "exercises": [
    {{
      "id": "ex1",
      "question": "Đề bài",
      "solution": "Lời giải",
      "answer": "Đáp án"
    }}
  ]
}}"""
        
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        
        return {
            "topic": request.topic,
            "difficulty": request.difficulty,
            "count": request.count,
            "has_reference": bool(reference_text),
            **result
        }
    except Exception as e:
        print(f"Generate exercises error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-test")
async def handle_generate_test(request: GenerateTestInput):
    """Generate a test based on PDF reference materials"""
    try:
        print(f"📝 Loading test reference materials for topic: {request.topic}")
        reference_text = load_reference_materials(str(TESTS_FOLDER), max_files=3)
        
        generation_config = {
            "temperature": 0.6,
            "response_mime_type": "application/json",
        }
        
        model = genai.GenerativeModel(
            'gemini-2.0-flash-exp',
            generation_config=generation_config,
            system_instruction=TEST_SYSTEM_INSTRUCTION
        )
        
        prompt = f"""Tạo đề kiểm tra về chủ đề: "{request.topic}"
Độ khó: {request.difficulty}

CẤU TRÚC:
- PHẦN 1: 4 câu trắc nghiệm
- PHẦN 2: 1 câu đúng/sai (4 mệnh đề)
- PHẦN 3: 1 câu trả lời ngắn

TÀI LIỆU THAM KHẢO:
{reference_text if reference_text else "Không có tài liệu. Tạo đề theo chuẩn THPT QG."}

Trả về JSON với cấu trúc đầy đủ."""
        
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        
        return {
            "topic": request.topic,
            "difficulty": request.difficulty,
            "has_reference": bool(reference_text),
            **result
        }
    except Exception as e:
        print(f"Generate test error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/summarize-topic")
async def handle_summarize_topic(request: SummarizeTopicInput):
    """Summarize a math topic"""
    try:
        generation_config = {
            "temperature": 0.5,
            "response_mime_type": "application/json",
        }
        
        model = genai.GenerativeModel(
            'gemini-2.0-flash-exp',
            generation_config=generation_config,
            system_instruction=SUMMARIZE_SYSTEM_INSTRUCTION
        )
        
        detail_map = {
            "brief": "ngắn gọn",
            "medium": "đầy đủ",
            "detailed": "chi tiết"
        }
        
        detail_instruction = detail_map.get(request.detail_level, "đầy đủ")
        
        prompt = f"""Tóm tắt {detail_instruction} về: "{request.topic}"

Trả về JSON:
{{
  "summary": "Nội dung tóm tắt"
}}"""
        
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        
        return {
            "topic": request.topic,
            "detail_level": request.detail_level,
            **result
        }
    except Exception as e:
        print(f"Summarize topic error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/geogebra")
async def handle_geogebra(request: GeogebraInputSchema):
    """Generate GeoGebra commands"""
    try:
        generation_config = {
            "temperature": 0.3,
            "response_mime_type": "application/json",
        }
        
        model = genai.GenerativeModel(
            'gemini-2.0-flash-exp',
            generation_config=generation_config,
            system_instruction=GEOGEBRA_SYSTEM_INSTRUCTION
        )
        
        prompt = f"""Tạo lệnh GeoGebra cho: {request.request}

Trả về JSON:
{{
  "commands": ["command1", "command2"]
}}"""
        
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        
        if "commands" not in result or not isinstance(result["commands"], list):
            raise ValueError("Invalid response format")
        
        return result
        
    except Exception as e:
        print(f"Geogebra error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 Starting Math Tutor API Server")
    print("="*60)
    print(f"📁 Exercises folder: {EXERCISES_FOLDER}")
    print(f"📁 Tests folder: {TESTS_FOLDER}")
    print("\n⚠️  NOTE: Place your PDF files in these folders")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
