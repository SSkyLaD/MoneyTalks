from typing import Literal
from openai import OpenAI
from custom_exception import LlmServiceError
from pydantic import BaseModel, Field
import os

MODEL_NAME = os.getenv("MODEL_NAME")
API_BASE_URL = os.getenv("API_BASE_URL")
API_KEY = os.getenv("API_KEY")

class DatabaseRequestType(BaseModel):
    request_type: Literal["insert_expenses", "query_expenses", "update_expenses","delete_expenses", "other"] = Field(
        description="Loại yêu cầu đến cơ sở dữ liệu"
    )

def extract_request_type(user_input: str) -> DatabaseRequestType:
    system_message = {
        "role": "system",
        "content": """
            Bạn là một trợ lý tài chính cá nhân thông minh.
            Nhiệm vụ của bạn là đọc yêu cầu từ người dùng và phân loại yêu cầu đó vào một trong các nhóm sau:    
                - "other": Nếu yêu cầu của người dùng mơ hồ, không có nghĩa hoặc không thuộc một trong các nhóm dưới đây.
                - "insert_expenses": Nếu người dùng ghi nhận thêm một khoản chi tiêu mới.
                - "delete_expenses": Nếu người dùng muốn xóa một khoản chi tiêu đã ghi.
                - "update_expenses": Nếu người dùng muốn cập nhật hoặc chỉnh sửa thông tin của một khoản chi.
                - "query_expenses": Nếu người dùng muốn truy vấn thông tin về các khoản chi tiêu đã ghi.

            Bạn luôn chỉ trả lời duy nhất dưới dạng JSON theo đúng cấu trúc sau (không thêm bất kỳ nội dung nào khác):

            {"request_type": Nhóm được phân loại} (ví dụ: {"request_type": "insert_expenses"}).
            """
    }

    try:
        client = OpenAI(base_url=API_BASE_URL, api_key=API_KEY)

        message = [system_message, {"role": "user", "content": user_input }]


        completion = client.beta.chat.completions.parse(
            model=MODEL_NAME,
            messages=message,
            response_format=DatabaseRequestType,
            temperature=0
        )

        return completion.choices[0].message.parsed
    except Exception as e: 
        raise LlmServiceError(f"Error in LLM service: {str(e)}")


    