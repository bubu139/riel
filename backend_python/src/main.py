# src/main.py
import uvicorn
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware  
from pydantic import BaseModel, Field
from typing import List, Optional

# Import config
from .ai_config import genai

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

📊 VÍ DỤ:
Input: "Vẽ parabol y = x^2 - 4x + 3"
Output: {"commands": ["f(x) = x^2 - 4*x + 3"]}

Input: "Vẽ tam giác ABC với A(1,2), B(3,4), C(5,1)"
Output: {"commands": ["A = (1, 2)", "B = (3, 4)", "C = (5, 1)", "Polygon(A, B, C)"]}

Input: "Vẽ đường tròn tâm O bán kính 3"
Output: {"commands": ["O = (0, 0)", "Circle(O, 3)"]}

⚠️ LƯU Ý:
- KHÔNG thêm giải thích, chỉ trả về lệnh
- KHÔNG sử dụng ký tự đặc biệt Việt Nam trong tên biến
- Đảm bảo cú pháp 100% chính xác
- Trả về JSON object với key "commands" là array

🎯 OUTPUT FORMAT:
{
  "commands": ["command1", "command2", ...]
}"""

EXERCISE_SYSTEM_INSTRUCTION = """Bạn là một chuyên gia biên soạn đề thi toán THPT Quốc gia Việt Nam.

🎯 NHIỆM VỤ:
- Tạo bài tập chất lượng cao về chủ đề được yêu cầu
- Đảm bảo độ khó phù hợp với trình độ lớp 12
- Cung cấp lời giải chi tiết, dễ hiểu

📝 CẤU TRÚC BÀI TẬP:
Mỗi bài tập phải có:
1. **Đề bài**: Rõ ràng, không gây nhầm lẫn, sử dụng LaTeX cho công thức
2. **Hướng dẫn giải**: Từng bước logic, giải thích tại sao
3. **Đáp án**: Chính xác, có đơn vị (nếu cần)
4. **Gợi ý**: Tips để giải nhanh hoặc tránh sai lầm

💡 YÊU CẦU:
- Độ khó tăng dần (dễ → trung bình → khó)
- Đa dạng dạng bài
- Gần gũi với đề thi thật
- Sử dụng ngôn ngữ Việt Nam chuẩn
- Sử dụng LaTeX cho công thức toán: $x^2$ hoặc $$x^2 + y^2 = r^2$$

📊 OUTPUT FORMAT (JSON):
{
  "exercises": [
    {
      "id": "ex1",
      "question": "Đề bài với LaTeX: $x^2 + 2x + 1 = 0$",
      "solution": "**Bước 1:** Nhận dạng dạng bài\\n\\n**Bước 2:** Áp dụng công thức...",
      "answer": "Đáp án cuối cùng",
      "hint": "Gợi ý hữu ích"
    }
  ]
}"""

TEST_SYSTEM_INSTRUCTION = """Bạn là một chuyên gia biên soạn đề thi THPT Quốc gia môn Toán.

🎯 NHIỆM VỤ:
- Tạo đề thi đầy đủ theo cấu trúc chuẩn
- Đảm bảo độ khó phân bố hợp lý
- Câu hỏi đa dạng, bao phủ kiến thức

📝 CẤU TRÚC ĐỀ THI:
1. **Phần 1: Trắc nghiệm** (4 câu)
   - Mỗi câu 4 đáp án A, B, C, D
   - Chỉ 1 đáp án đúng
   - Độ khó: 2 dễ, 1 trung bình, 1 khó

2. **Phần 2: Đúng/Sai** (1 câu - 4 mệnh đề)
   - 4 mệnh đề liên quan cùng chủ đề
   - Mỗi mệnh đề đúng hoặc sai
   - Độ khó: 2 dễ, 2 trung bình

3. **Phần 3: Trả lời ngắn** (1 câu)
   - Đáp án là số (tối đa 6 ký tự)
   - Có thể là số nguyên, thập phân, hoặc âm

💡 YÊU CẦU:
- Sử dụng LaTeX cho công thức
- Đáp án chính xác tuyệt đối
- Các đáp án nhiễu hợp lý (sai lầm phổ biến)
- Ngôn ngữ rõ ràng, không gây nhầm lẫn

📊 OUTPUT FORMAT: Tuân thủ schema test_schema.py với cấu trúc JSON đầy đủ"""

SUMMARIZE_SYSTEM_INSTRUCTION = """Bạn là một giảng viên toán học chuyên tóm tắt kiến thức một cách súc tích.

🎯 NHIỆM VỤ:
- Tóm tắt chủ đề toán học một cách dễ hiểu
- Nêu bật các điểm then chốt
- Cung cấp công thức quan trọng

📝 CẤU TRÚC TÓM TẮT:
1. **Định nghĩa**: Khái niệm cốt lõi
2. **Công thức chính**: LaTeX format
3. **Tính chất quan trọng**: Liệt kê rõ ràng
4. **Phương pháp giải**: Các bước cơ bản
5. **Lưu ý**: Các điểm hay nhầm lẫn

💡 YÊU CẦU:
- Ngắn gọn nhưng đầy đủ
- Dùng bullet points và số thứ tự
- LaTeX cho công thức: $x^2$ hoặc $$\\int f(x)dx$$
- Dễ đọc, dễ nhớ

📊 OUTPUT FORMAT (JSON):
{
  "summary": "Nội dung tóm tắt với markdown và LaTeX"
}"""

# ===== FASTAPI APP =====

app = FastAPI(title="Math Tutor API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Trong production, chỉ định cụ thể domain
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
    count: int = 5

class GenerateTestInput(BaseModel):
    topic: str
    difficulty: str = "medium"
    question_count: int = 10

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
        "message": "Math Tutor API is running with Gemini 2.0 Flash",
        "model": "gemini-2.0-flash-exp",
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
        
        # Build prompt with media if provided
        if request.media:
            # For multimodal input with images
            prompt_parts = [request.message]
            # Note: You may need to handle media URLs differently based on Gemini API requirements
            response = model.generate_content(
                prompt_parts,
                stream=True
            )
        else:
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

Trả về JSON với format:
{{
  "exercises": [
    {{
      "id": "ex1",
      "question": "Đề bài (sử dụng LaTeX)",
      "solution": "Lời giải chi tiết",
      "answer": "Đáp án",
      "hint": "Gợi ý"
    }}
  ]
}}"""
        
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        
        return {
            "topic": request.topic,
            "difficulty": request.difficulty,
            "count": request.count,
            **result
        }
    except Exception as e:
        print(f"Generate exercises error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-test")
async def handle_generate_test(request: GenerateTestInput):
    """Generate a test with multiple questions"""
    try:
        generation_config = {
            "temperature": 0.6,
            "response_mime_type": "application/json",
        }
        
        model = genai.GenerativeModel(
            'gemini-2.0-flash-exp',
            generation_config=generation_config,
            system_instruction=TEST_SYSTEM_INSTRUCTION
        )
        
        prompt = f"""Tạo đề thi về chủ đề: "{request.topic}"
Độ khó: {request.difficulty}

Cấu trúc đề thi:
- 4 câu trắc nghiệm (4 đáp án, 1 đúng)
- 1 câu đúng/sai (4 mệnh đề)
- 1 câu trả lời ngắn (đáp án số, max 6 ký tự)

Trả về JSON theo format:
{{
  "title": "Đề kiểm tra...",
  "parts": {{
    "multipleChoice": {{
      "title": "Phần 1: Trắc nghiệm",
      "questions": [
        {{
          "id": "mc1",
          "type": "multiple-choice",
          "prompt": "Câu hỏi (LaTeX)",
          "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
          "answer": 0
        }}
      ]
    }},
    "trueFalse": {{
      "title": "Phần 2: Đúng/Sai",
      "questions": [
        {{
          "id": "tf1",
          "type": "true-false",
          "prompt": "Cho biết các mệnh đề sau đúng hay sai:",
          "statements": ["Mệnh đề 1", "Mệnh đề 2", "Mệnh đề 3", "Mệnh đề 4"],
          "answer": [true, false, true, false]
        }}
      ]
    }},
    "shortAnswer": {{
      "title": "Phần 3: Trả lời ngắn",
      "questions": [
        {{
          "id": "sa1",
          "type": "short-answer",
          "prompt": "Câu hỏi (LaTeX)",
          "answer": "123.45"
        }}
      ]
    }}
  }}
}}"""
        
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        
        return result
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
            "brief": "ngắn gọn trong 2-3 câu",
            "medium": "đầy đủ với các khái niệm chính",
            "detailed": "chi tiết với ví dụ và ứng dụng"
        }
        
        detail_instruction = detail_map.get(request.detail_level, detail_map["medium"])
        
        prompt = f"""Tóm tắt {detail_instruction} về chủ đề toán học: "{request.topic}"

Bao gồm:
- Định nghĩa chính
- Công thức quan trọng (LaTeX)
- Tính chất cơ bản
- Phương pháp giải
- Lưu ý quan trọng

Trả về JSON:
{{
  "summary": "Nội dung tóm tắt markdown với LaTeX"
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
            "temperature": 0.3,  # Thấp để output chính xác
            "response_mime_type": "application/json",
        }
        
        model = genai.GenerativeModel(
            'gemini-2.0-flash-exp',
            generation_config=generation_config,
            system_instruction=GEOGEBRA_SYSTEM_INSTRUCTION
        )
        
        prompt = f"""Tạo lệnh GeoGebra cho yêu cầu sau: {request.request}

Loại đồ thị: {request.graph_type}

Trả về JSON format chính xác:
{{
  "commands": ["command1", "command2", ...]
}}

Chỉ trả về các lệnh GeoGebra hợp lệ, không thêm giải thích."""
        
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        
        # Validate response has commands array
        if "commands" not in result or not isinstance(result["commands"], list):
            raise ValueError("Invalid response format: missing 'commands' array")
        
        return result
        
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        print(f"Response text: {response.text}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response as JSON")
    except Exception as e:
        print(f"Geogebra error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)