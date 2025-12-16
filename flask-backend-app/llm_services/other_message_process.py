from typing import Optional
from openai import OpenAI
from pydantic import BaseModel, Field
from datetime import datetime
import os

from custom_exception import LlmServiceError

MODEL_NAME = os.getenv("MODEL_NAME")
API_BASE_URL = os.getenv("API_BASE_URL")
API_KEY = os.getenv("API_KEY")

class Response(BaseModel):
    """Thông tin phản hồi chung từ LLM"""
    response: Optional[str] = Field(default=None)

def other_message_process(user_input: str) -> Response:
    now = datetime.now()

    system_message = {
        "role": "system",
        "content": """
            Bạn là một trợ lý tài chính cá nhân thông minh. Người dùng đang hỏi một câu hỏi không liên quan đến tài chính cá nhân.
            Nhiệm vụ của bạn là đọc yêu cầu từ người dùng, trả lời một cách ngắn gọn, đầy đủ về thông tin không liên quan ấy.
        """
    }

    try:
        message = [system_message, {"role": "user", "content": user_input + f",bây giờ là {now.strftime('%Y-%m-%d')})"}]
        client = OpenAI(base_url=API_BASE_URL, api_key=API_KEY)

        completion = client.beta.chat.completions.parse(
            model=MODEL_NAME,
            messages=message,
            response_format=Response,
            temperature=0.5
        )

        return completion.choices[0].message.parsed
    
    except Exception as e: 
        raise LlmServiceError(f"Error in LLM service: {str(e)}")
