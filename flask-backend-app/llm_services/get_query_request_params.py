from typing import Optional
from openai import OpenAI
from pydantic import BaseModel, Field
from datetime import datetime
import os

from custom_exception import LlmServiceError

MODEL_NAME = os.getenv("MODEL_NAME")
API_BASE_URL = os.getenv("API_BASE_URL")
API_KEY = os.getenv("API_KEY")

class Query(BaseModel):
    """Thông tin chi tiết về một truy vấn tài chính"""
    start_date: Optional[str] = Field(default=None)
    end_date: Optional[str] = Field(default=None)
    min_amount: Optional[int] = Field(default=None)
    max_amount: Optional[int] = Field(default=None)
    key_words: list[str] = Field(default=None)

def extract_query_req(user_input: str) -> Query:
    now = datetime.now()

    system_message = {
        "role": "system",
        "content": """
            Bạn là một trợ lý AI chuyên phân tích câu truy vấn của người dùng tiếng Việt tự nhiên liên quan đến giao dịch tài chính, bao gồm cả thu (số dương) và chi (số âm). Nhiệm vụ của bạn là trích xuất thông tin thành JSON:

            {
            "start_date": "YYYY-MM-DD" hoặc null,
            "end_date": "YYYY-MM-DD" hoặc null,
            "min_amount": số nguyên (VND) hoặc null,
            "max_amount": số nguyên (VND) hoặc null,
            "key_words": mảng chuỗi hoặc []
            }

            Hướng dẫn chi tiết:

            1. **start_date** và **end_date**:
            - Xử lý các mốc thời gian tương đối: "hôm qua", "hôm kia", "tuần trước", "tháng trước" dựa trên ngày hiện tại được cung cấp.
            - Xử lý khoảng thời gian: "tháng 6 năm 2025" → start: 2025-06-01, end: 2025-06-30.
            - Nếu là một ngày cụ thể: start_date = end_date.

            2. **min_amount** và **max_amount** (QUAN TRỌNG):
            - **Quy tắc chung:** THU NHẬP là số DƯƠNG (+), CHI TIÊU là số ÂM (-).
            - Đơn vị: Chuyển đổi k, tr, tỷ thành số nguyên (10k = 10000, 1tr = 1000000).
            
            - **Xử lý THU NHẬP (Dương):**
                + "Thu trên/hơn X": min_amount: X, max_amount: null.
                + "Thu dưới/ít hơn X": min_amount: 0, max_amount: X.
                + "Thu từ X đến Y": min_amount: X, max_amount: Y.

            - **Xử lý CHI TIÊU (Âm) - Lưu ý kỹ logic trục số:**
                + "Chi X đồng": min_amount: -X, max_amount: -X.
                + "Chi từ X đến Y": min_amount: -Y, max_amount: -X (Ví dụ: 100k đến 500k -> min: -500000, max: -100000).
                + **"Chi DƯỚI/ÍT HƠN X" (tức là rẻ, gần số 0)**: min_amount: -X, max_amount: 0 (Ví dụ: dưới 50k -> min: -50000, max: 0).
                + **"Chi TRÊN/HƠN X" (tức là đắt, xa số 0)**: min_amount: null, max_amount: -X (Ví dụ: trên 500k -> min: null, max: -500000).
            
            - **Tìm kiếm chung:**
                + Chỉ tìm "thu": min: 0, max: null.
                + Chỉ tìm "chi": min: null, max: 0.

            3. **key_words**:
            - Trích xuất danh từ/động từ chính mô tả giao dịch (ví dụ: "ăn sáng", "Grab", "lương", "chuyển khoản").
            - Loại bỏ các từ dừng: "khoản chi", "tìm", "liệt kê", "của", "trong", "vào".
            - KHÔNG đưa từ "chi", "thu", "tiêu", "tiền" vào keywords trừ khi không còn từ nào khác.

            4. **Xử lý Null**: Nếu không xác định được thông tin nào, trả về null hoặc [] tương ứng.
        """
    }

    try:
        message = [system_message, {"role": "user", "content": user_input + f",bây giờ là {now.strftime('%Y-%m-%d')})"}]
        client = OpenAI(base_url=API_BASE_URL, api_key=API_KEY)

        completion = client.beta.chat.completions.parse(
            model=MODEL_NAME,
            messages=message,
            response_format=Query,
            temperature=0
        )

        return completion.choices[0].message.parsed
    
    except Exception as e: 
        raise LlmServiceError(f"Error in LLM service: {str(e)}")
