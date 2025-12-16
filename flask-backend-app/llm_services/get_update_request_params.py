from typing import Optional
from openai import OpenAI
from pydantic import BaseModel, Field
import os

from custom_exception import LlmServiceError

MODEL_NAME = os.getenv("MODEL_NAME")
API_BASE_URL = os.getenv("API_BASE_URL")
API_KEY = os.getenv("API_KEY")


class UpdateInfo(BaseModel):
    """Thông tin chi tiết về cập nhật khoản thu chi"""
    id: Optional[int] = Field(default=None)
    updated_description: Optional[str] = Field(default=None)
    updated_amount: Optional[int] = Field(default=None)
    updated_date: Optional[str] = Field(default=None)

def extract_update_req(user_input: str) -> UpdateInfo:

    system_message = {
        "role": "system",
        "content": """Bạn là một trợ lý AI chuyên phân tích câu truy vấn của người dùng tiếng Việt tự nhiên liên quan đến giao dịch tài chính.
        Nhiệm vụ của bạn là phân tích câu văn đầu vào và trích xuất thông tin thành một JSON phục vụ mục đích thay đổi, chỉnh sửa dữ liệu với các trường sau:

        {
        "id": id (số nguyên, ID của khoản thu chi cần cập nhật),
        "updated_description": "Mô tả mới" hoặc null nếu không có thông tin
        "updated_amount": Số tiền mới (dương hoặc âm) hoặc null nếu không có thông tin,
        "updated_date": "YYYY-MM-DD" hoặc null nếu không có thông tin
        }
        Hướng dẫn:
        1. **id**:
        - Đây là ID của khoản thu chi cần cập nhật.
        - Nếu người dùng yêu cầu cập nhật một khoản thu chi cụ thể, trích xuất ID đó.
        - Nếu không có thông tin về ID, gán null.
        2. **updated_description**:
        - Đây là mô tả mới của khoản thu chi.
        - Nếu người dùng yêu cầu cập nhật mô tả, trích xuất mô tả mới.
        - Nếu không có thông tin mô tả mới, gán null.
        3. **updated_amount**:
        - Đây là số tiền mới của khoản thu chi.
        - Nếu người dùng yêu cầu cập nhật số tiền, trích xuất số tiền mới.
        - Nếu không có thông tin số tiền mới, gán null.
        4. Xử lý các trường hợp thiếu thông tin bằng cách gán null, không được bịa ra các thông tin không có thật, luôn dựa vào truy vấn của người dùng.
        Bạn luôn chỉ trả lời duy nhất dưới dạng JSON theo đúng cấu trúc trên (không thêm bất kỳ nội dung nào khác):

        VD: User: "Cập nhật lại khoản chi có mã 123, sửa mô tả thành 'Ăn uống cuối tuần', số tiền mới là 200000"

        {
            "id": 123,
            "updated_description": "Ăn uống cuối tuần",
            "updated_amount": 200000,
        }
        """
    }

    try:
        message = [system_message, {"role": "user", "content": user_input }]
        client = OpenAI(base_url=API_BASE_URL, api_key=API_KEY)

        completion = client.beta.chat.completions.parse(
            model=MODEL_NAME,
            messages=message,
            response_format=UpdateInfo,
        )
        return completion.choices[0].message.parsed
        
    except Exception as e: 
        raise LlmServiceError(f"Error in LLM service: {str(e)}")
