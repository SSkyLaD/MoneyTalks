from typing import Optional
from openai import OpenAI
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import os
import base64

from custom_exception import LlmServiceError

MODEL_NAME = os.getenv("MODEL_NAME")
API_BASE_URL = os.getenv("API_BASE_URL")
API_KEY = os.getenv("API_KEY")

class Expense(BaseModel):
    description: Optional[str] = None
    amount: Optional[int] = None
    expense_date: Optional[str] = None
    
    @field_validator("amount", mode="before")
    def force_negative(cls, v):
        if v is None:
            return v
        return -abs(v)

class ResponseModel(BaseModel):
    expenses: Optional[list[Expense]] = Field(default=None)
    error: Optional[str] = Field(default=None)

def encode_image_to_base64(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def extract_insert_req_from_local_image(image_path: str) -> ResponseModel:
    now = datetime.now()
    image_base64 = encode_image_to_base64(image_path)

    system_message = {
        "role": "system",
        "content": """Bạn là nhà phân tích dữ liệu. Đầu vào là ảnh hóa đơn hoặc thông tin chuyển khoản.
        Nhiệm vụ: Trích xuất các khoản thu chi mới, chỉ lấy sản phẩm và giá từng sản phẩm, bỏ qua tổng tiền.

        Trả về danh sách JSON với cấu trúc sau (luôn chỉ trả lời JSON, không thêm nội dung khác):

        [
          {"description": "Mô tả" hoặc null, "amount": Số tiền âm hoặc null, "date": "YYYY-MM-DD" hoặc null},
          ...
        ]

        Quy tắc:
        - description: mô tả ngắn gọn sản phẩm/khoản chi.
        - amount: giá trị âm (ví dụ hóa đơn ghi 20000 → "amount": -20000), null nếu không rõ.
        - expense_date: ngày dạng YYYY-MM-DD, null nếu không rõ.
        - Nếu không phải hóa đơn/chuyển khoản → trả về:
          { "error": "Unaccpeted Image" }
        """
    }

    user_message = {
        "role": "user",
        "content": [
            {"type": "text", "text": f"Hãy phân tích ảnh sau, hôm nay là {now.strftime('%Y-%m-%d')}"},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
        ]
    }

    try:
        client = OpenAI(base_url=API_BASE_URL, api_key=API_KEY)

        completion = client.beta.chat.completions.parse(
            model=MODEL_NAME,
            messages=[system_message, user_message],
            response_format=ResponseModel,
            temperature=0
        )

        return completion.choices[0].message.parsed

    except Exception as e:
        raise LlmServiceError(f"Error in LLM service: {str(e)}")
