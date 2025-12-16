from typing import Optional
from openai import OpenAI
from pydantic import BaseModel, Field
from datetime import datetime
import os

from custom_exception import LlmServiceError

MODEL_NAME = os.getenv("MODEL_NAME")
API_BASE_URL = os.getenv("API_BASE_URL")
API_KEY = os.getenv("API_KEY")

class Expense(BaseModel):
    """Thông tin chi tiết về một khoản thu chi"""
    description: Optional[str] = Field(default=None)
    amount: Optional[int] = Field(default=None)
    expense_date: Optional[str] = Field(default=None)

class NewExpenses(BaseModel):
    """Thông tin chi tiết về yêu cầu thêm khoản thu chi mới"""
    expenses : list[Expense] = Field(default=None)

def extract_insert_req(user_input: str) -> NewExpenses:
    now = datetime.now()

    system_message = {
        "role": "system",
        "content": """Bạn là một trợ lý tài chính cá nhân thông minh.
        Nhiệm vụ của bạn là đọc yêu cầu từ người dùng và trích xuất các tham số cần thiết để ghi nhận các khoản thu chi mới.

        Bạn cần trích xuất các tham số sau từ yêu cầu:
        - "description": Mô tả ngắn gọn về khoản thu chi.
        - "amount": Số tiền của khoản thu chi. (Nếu khoản chi thì là âm, khoản thu thì là dương), null nếu không rõ ràng số tiền
        - "expense_date": Ngày tháng của khoản thu chi (định dạng YYYY-MM-DD), null nếu không rõ ràng ngày tháng.


        Nếu thông tin nào không được nêu rõ hoặc không xác định được, hãy gán giá trị đó là `null`, không được phép bịa ra thông tin nếu trong câu chưa có.

        Bạn luôn chỉ trả lời duy nhất dưới dạng JSON theo đúng cấu trúc sau (không thêm bất kỳ nội dung nào khác):

        [
          {"description": "Mô tả" hoặc null,"amount": Số tiền hoặc null, "date": "YYYY-MM-DD" hoặc null},
          ...
        ]

        Nếu chỉ có một khoản thu chi, bạn vẫn trả về danh sách chứa một phần tử.
        """
    }

    try:
        message = [system_message, {"role": "user", "content": user_input + f",hôm nay là {now.strftime('%Y-%m-%d')})"}]
        client = OpenAI(base_url=API_BASE_URL, api_key=API_KEY)

        completion = client.beta.chat.completions.parse(
            model=MODEL_NAME,
            messages=message,
            response_format=NewExpenses,
            temperature=0
        )
        return completion.choices[0].message.parsed
        
    except Exception as e: 
        raise LlmServiceError(f"Error in LLM service: {str(e)}")
