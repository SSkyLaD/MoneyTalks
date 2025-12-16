from typing import Optional
from openai import OpenAI
from pydantic import BaseModel, Field
from datetime import datetime
import os

from custom_exception import LlmServiceError

MODEL_NAME = os.getenv("MODEL_NAME")
API_BASE_URL = os.getenv("API_BASE_URL")
API_KEY = os.getenv("API_KEY")

class DeleteInfo(BaseModel):
    """Thông tin chi tiết về yêu cầu xóa khoản thu chi"""
    delete_ids: list[int] = Field(default=None)
    start_date: Optional[str] = Field(default=None)
    end_date: Optional[str] = Field(default=None)

def extract_delete_req(user_input: str) -> DeleteInfo:
    now = datetime.now()

    system_message = {
        "role": "system",
        "content": """Bạn là một trợ lý AI chuyên phân tích câu truy vấn của người dùng tiếng Việt tự nhiên liên quan đến giao dịch tài chính.
        Nhiệm vụ của bạn là phân tích câu văn đầu vào và trích xuất thông tin thành một JSON phục vụ mục đích xóa dữ liệu với các trường sau:

        {
        "delete_ids": [id1, id2, ...]  (mảng các ID khoản thu chi cần xóa, định dạng số nguyên),
        "start_date": "YYYY-MM-DD" hoặc null nếu không có thông tin,
        "end_date": "YYYY-MM-DD" hoặc null nếu không có thông tin,
        }

        Hướng dẫn:
        1. **delete_ids**:
        - Đây là danh sách các ID của khoản thu chi cần xóa.
        - Nếu người dùng yêu cầu xóa một khoản thu chi cụ thể, trích xuất ID đó.
        - Nếu có nhiều khoản thu chi cần xóa, trích xuất tất cả các ID tương ứng.
        - Nếu không có thông tin về ID, gán mảng rỗng [].
        2. **start_date** và **end_date**:
        - Đây là ngày bắt đầu và kết thúc của truy vấn, có thể dựa vào cụm bây giờ là để lấy mốc thời gian hiện tại để tiến hành suy ra thời gian hợp lý.
        - Nếu người dùng yêu cầu xóa khoản thu chi trong một khoảng thời gian cụ thể, trích xuất ngày bắt đầu và kết thúc.
        - Nếu người dùng yêu cầu xóa 1 ngày cụ thể, gán start_date và end_date giống nhau.
        - Nếu có "hôm qua", tính ngày trước ngày "hôm nay". Nếu có "hôm kia", tính hai ngày trước.
        - Nếu có cụm từ như "từ ngày" hoặc "đến ngày", hoặc "tháng X", gán tương ứng (ví dụ: "tháng 6 năm 2025" → start_date: "2025-06-01", end_date: "2025-06-30").
        - Nếu không có thông tin ngày tháng, gán null.
        3. Xử lý các trường hợp thiếu thông tin bằng cách gán null hoặc [], không được bịa ra các thông tin không có thật, luôn dựa vào truy vấn của người dùng.
        Bạn luôn chỉ trả lời duy nhất dưới dạng JSON theo đúng cấu trúc sau (không thêm bất kỳ nội dung nào khác):

        {
          "delete_ids": [id1, id2, ...],
          "start_date": "YYYY-MM-DD" hoặc null,
          "end_date": "YYYY-MM-DD" hoặc null
        }
        """
    }

    try:
        message = [system_message, {"role": "user", "content": user_input + f",bây giờ là {now.strftime('%Y-%m-%d')})"}]
        client = OpenAI(base_url=API_BASE_URL, api_key=API_KEY)

        completion = client.beta.chat.completions.parse(
            model=MODEL_NAME,
            messages=message,
            response_format=DeleteInfo,
        )
        return completion.choices[0].message.parsed
        
    except Exception as e: 
        raise LlmServiceError(f"Error in LLM service: {str(e)}")