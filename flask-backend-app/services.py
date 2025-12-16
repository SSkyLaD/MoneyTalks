from datetime import datetime, timedelta, timezone
from PIL import Image
from flask import request, current_app 
import jwt
import os
import io
from models import User, Message, UserExpense, db
from sqlalchemy import func
from custom_exception import JWTMismatchError, NotFoundError
from dateutil.relativedelta import relativedelta
from llm_services.get_request_type_params import extract_request_type
from llm_services.get_insert_request_params import extract_insert_req
from llm_services.get_query_request_params import extract_query_req
from llm_services.get_update_request_params import extract_update_req
from llm_services.get_delete_request_params import extract_delete_req
from llm_services.other_message_process import other_message_process
from llm_services.get_insert_request_params_img import extract_insert_req_from_local_image

SECRET_KEY = os.getenv("SECRET_KEY")
JWT_EXPIRATION_TIME_D = int(os.getenv("JWT_EXPIRATION_TIME_D", 15))

GOOGLE_TOKEN_INFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

def jwt_token_verify(request_header):
    auth_header = request_header.get("Authorization", None)
    if not auth_header:
        raise ValueError("Missing Authorization header")

    parts = auth_header.split()
    if parts[0].lower() != "bearer" or len(parts) != 2:
        raise ValueError("Invalid Authorization header format")

    token = parts[1]
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    user_id = payload.get("user_id")
    user = User.query.get(user_id)
    if not user:
        raise NotFoundError("User not found")
    # if user.last_login_token != token:
    #     raise JWTMismatchError("JWT token mismatch")
    return user

#POST /api/v1/auth/google
def create_or_get_user(user_info):
    user = User.query.filter_by(google_id=user_info.get("sub")).first()
    if not user:
        user = User(
            google_id=user_info.get("sub"),
            email=user_info.get("email"),
            name=user_info.get("name"),
            picture=user_info.get("picture")
        )
        db.session.add(user)
        db.session.commit()
    else:
        user.name = user_info.get("name")
        user.picture = user_info.get("picture")
        db.session.commit()
    return user

def create_jwt(user):
    payload = {
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "exp": datetime.now(timezone.utc) + timedelta(days=15)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    user = User.query.filter_by(id=user.id).first()
    user.last_login_token = token
    db.session.commit()
    return token

#POST /api/v1/auth/logout
def logout(user):
    user.last_login_token = None
    db.session.commit()

#GET /api/v1/user/message?page=1&pageSize=20
def get_user_messages_paginated(user_id, limit, before_id):
    if limit > 50:
        limit = 50

    query = (
        Message.query
        .filter_by(user_id=user_id)
        .order_by(Message.id.desc())
    )

    if before_id:
        query = query.filter(Message.id < before_id)

    messages_with_extra = query.limit(limit + 1).all()

    has_more = len(messages_with_extra) > limit
    
    messages_to_return = messages_with_extra[:limit]

    next_cursor = None
    if has_more:
        next_cursor = messages_to_return[-1].id

    formatted_messages = [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat()
        } for msg in messages_to_return
    ]

    return {
        "messages": formatted_messages,
        "pagination": {
            "next_cursor": next_cursor,
            "has_more": has_more
        }
    }

# POST /api/v1/user/message
def process_user_text_message(user_id, content):
    user_message = Message(
        user_id=user_id,
        role="user",
        content={"type": "message", "message": content},
        timestamp=datetime.now(timezone.utc)
    )
    db.session.add(user_message)
    db.session.commit()

    request_type_result = extract_request_type(content)

    match request_type_result.request_type:
        case "insert_expenses":
            insert_params = extract_insert_req(content)

            assistance_message = Message(
                user_id=user_id,
                role="assistant",
                content={
                    "type": "comfirmation_request",
                    "request_type": "insert_expenses",
                    "data": {
                        "message": "Các khoản dưới đây đã được ghi nhận, bạn có muốn thêm không?",
                        "data": insert_params.model_dump()
                    }
                },
                timestamp=datetime.now(timezone.utc)
            )

        case "query_expenses":
            query_params = extract_query_req(content)

            assistance_message = Message(
                user_id=user_id,
                role="assistant",
                content={
                    "type": "comfirmation_request",
                    "request_type": "query_expenses",
                    "data": {
                        "message": "Bạn đang muốn tìm kiếm các khoản thu chi theo các tiêu chí dưới đây, bạn có muốn tìm không?",
                        "data": query_params.model_dump()
                    }
                },
                timestamp=datetime.now(timezone.utc)
            )
            
        case "update_expenses":
            update_params = extract_update_req(content)
            

            update_data = update_params.model_dump()
            update_id = update_data['id']

            expense = UserExpense.query.filter_by(user_id=user_id, id=update_id).first()

            if not expense:
                assistance_message = Message(
                    user_id=user_id,
                    role="assistant",
                    content={
                        "type": "message",
                        "request_type": "update_expenses",
                        "data": {
                            "message": "Không tìm thấy khoản thu chi có ID này, hãy kiểm tra lại.",
                        }
                    },
                    timestamp=datetime.now(timezone.utc)
                )
            else:
                assistance_message = Message(
                    user_id=user_id,
                    role="assistant",
                    content={
                        "type": "comfirmation_request",
                        "request_type": "update_expenses",
                        "data": {
                            "message": "Khoản thu chi dưới đây sẽ được sửa với các tham số dưới đây, bạn có chắc không?",
                            "data": update_data 
                        }
                    },
                    timestamp=datetime.now(timezone.utc)
                )

        case "delete_expenses":
                delete_params = extract_delete_req(content)
                delete_data = delete_params.model_dump()

                delete_ids = delete_data.get("delete_ids")
                start_date = delete_data.get("start_date")
                end_date = delete_data.get("end_date")

                base_query = UserExpense.query.filter(UserExpense.user_id == user_id)
                
                query_filters = []
                expenses_found = []

                if delete_ids:
                    query_filters.append(UserExpense.id.in_(delete_ids))
                
                elif start_date or end_date:
                    if start_date:
                        query_filters.append(UserExpense.expense_date >= start_date)
                    if end_date:
                        query_filters.append(UserExpense.expense_date <= end_date)
                
                if not query_filters:
                    assistance_message = Message(
                        user_id=user_id,
                        role="assistant",
                        content={
                            "type": "message",
                            "request_type": "delete_expenses",
                            "data": {"message": "Bạn cần cung cấp (danh sách ID) hoặc (khoảng ngày) để xóa."}
                        },
                        timestamp=datetime.now(timezone.utc)
                    )
                else:
                    expenses_found = base_query.filter(*query_filters).all()

                    if not expenses_found:
                        assistance_message = Message(
                            user_id=user_id,
                            role="assistant",
                            content={
                                "type": "message",
                                "data": {"message": "Không tìm thấy khoản chi nào khớp với tiêu chí của bạn."}
                            },
                            timestamp=datetime.now(timezone.utc)
                        )
                    else:
                        delete_expense_data = []
                        for expense in expenses_found:
                            delete_expense_data.append({
                                "id": expense.id,
                                "description": expense.description,
                                "amount": expense.amount,
                                "expense_date": expense.expense_date.isoformat()
                            })
                        
                        message_text = f"Tìm thấy {len(delete_expense_data)} khoản chi. Bạn có chắc chắn muốn xóa chúng không?"

                        assistance_message = Message(
                            user_id=user_id,
                            role="assistant",
                            content={
                                "type": "comfirmation_request",
                                "request_type": "delete_expenses",
                                "data": {
                                    "message": message_text,
                                    "data": delete_expense_data
                                }
                            },
                            timestamp=datetime.now(timezone.utc)
                        )


        case "other":
            other_reponse = other_message_process(content)

            assistance_message = Message(
                user_id=user_id,
                role="assistant",
                content={
                    "type": "message",
                    "request_type": "other",
                    "data": {"message": other_reponse.response}
                },
                timestamp=datetime.now(timezone.utc)
            )

            
        case _:
            raise ValueError("Unknown request type")

    db.session.add(assistance_message)
    db.session.commit()

    return {
        "user_message": {
            "id": user_message.id,
            "role": user_message.role,
            "content": user_message.content,
            "timestamp": user_message.timestamp.isoformat()
        },
        "assistant_message": {
            "id": assistance_message.id,
            "role": assistance_message.role,
            "content": assistance_message.content,
            "timestamp": assistance_message.timestamp.isoformat()
        }
    }

#POST /api/v1/user/message
def process_assistant_response_message(user_id, content):
    assistance_message = Message(
        user_id=user_id,
        role="assistant",
        content={
            "type": "message",
            "data": {"message": content}
        },
        timestamp=datetime.now(timezone.utc)
    )
    db.session.add(assistance_message)
    db.session.commit()

    return {"assistant_message": {
        "id": assistance_message.id,
        "role": assistance_message.role,
        "content": assistance_message.content,
        "timestamp": assistance_message.timestamp.isoformat()
    }}


# POST /api/v1/user/message
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
MAX_FILE_SIZE = 2 * 1024 * 1024 
def process_user_image_message(user_id, image_file):
    UPLOAD_FOLDER = os.path.join(current_app.root_path, 'static', 'uploads')
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    image = Image.open(image_file)
    img_format = image.format.upper()

    if img_format not in ["JPEG", "PNG"]:
        raise Exception("Định dạng ảnh không được hỗ trợ")

    image_file.seek(0, io.SEEK_END)
    size_bytes = image_file.tell()
    image_file.seek(0)  

    ext = "jpg" if img_format == "JPEG" else "png"
    
    filename = f"{int(datetime.now(timezone.utc).timestamp()*1000)}_{user_id}_bill_image.{ext}"
    save_path = os.path.join(UPLOAD_FOLDER, filename)

    if size_bytes > MAX_FILE_SIZE:
        buffer = io.BytesIO()
        save_args = {"format": img_format, "optimize": True}
        
        if img_format == "JPEG":
            save_args["quality"] = 70  
            
        image.save(buffer, **save_args)
        buffer.seek(0)
        with open(save_path, "wb") as f:
            f.write(buffer.read())
    else:
        image_file.save(save_path) 


    public_url = f"/static/uploads/{filename}"

    user_message = Message(
        user_id=user_id,
        role="user",
        content={
            "type": "image_url",
            "data": public_url  
        },
    )
    db.session.add(user_message)
    db.session.commit()

    model_response = extract_insert_req_from_local_image(save_path)

    if model_response.error == "Unaccpeted Image":
        assistance_message = Message(
            user_id=user_id,
            role="assistant",
            content={
                "type": "message",
                "request_type": "other",
                "data": {"message": "Hình ảnh không hợp lệ, vui lòng thử lại với hình ảnh khác."}
            },
            timestamp=datetime.now(timezone.utc)
        )
        db.session.add(assistance_message)
        db.session.commit()
        return {        
            "assistant_message": {
                "id": assistance_message.id,
                "role": assistance_message.role,
                "content": assistance_message.content,
                "timestamp": assistance_message.timestamp.isoformat()
            }
        }

    assistance_message = Message(
        user_id=user_id,
        role="assistant",
        content={
            "type": "comfirmation_request",
            "request_type": "insert_expenses",
            "data": {
                "message": "Các khoản dưới đây đã được ghi nhận, bạn có muốn thêm không?",
                "data": model_response.model_dump()
            }
        },
        timestamp=datetime.now(timezone.utc)
    )
    db.session.add(assistance_message)
    db.session.commit()

    return {
        "user_message": {
            "id": user_message.id,
            "role": user_message.role,
            "content": user_message.content,
            "timestamp": user_message.timestamp.isoformat()
        },
        "assistant_message": {
            "id": assistance_message.id,
            "role": assistance_message.role,
            "content": assistance_message.content,
            "timestamp": assistance_message.timestamp.isoformat()
        }
    }
    

    # ##OCR TEST
    # import cv2
    # import easyocr
    # img = cv2.imread(save_path, cv2.IMREAD_COLOR)

    # img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    # img = clahe.apply(img)

    # scale = 2
    # img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    # cv2.imwrite("processed_image.png", img)

    # reader = easyocr.Reader(['vi','en'], gpu=True) 
    # results = reader.readtext(img, detail=0, paragraph=True)

    # print("\n".join(results))

# DELETE /api/v1/user/message/<message_id>
def delete_user_message(user_id, message_id):
    message = Message.query.filter_by(id=message_id, user_id=user_id).first()
    if not message:
        raise NotFoundError("Message not found or does not belong to the user")
    db.session.delete(message)
    db.session.commit()
    return message

# DELETE /api/v1/user/message
def delete_all_user_messages(user_id):
    delete_count = Message.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return delete_count

# GET /api/v1/user/expenses?page=1&pageSize=20&keyword=&start_date=&end_date=&min_amount=&max_amount=
def get_user_expenses(user_id, filters, page=1, page_size=20):
    try:
        query = UserExpense.query.filter_by(user_id=user_id)

        if filters.get("keyword"):
            query = query.filter(UserExpense.description.ilike(f"%{filters['keyword']}%"))

        start_date_str = filters.get("start_date")
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                query = query.filter(UserExpense.expense_date >= start_date)
            except ValueError:
                return {"error": "Invalid start_date format. Use YYYY-MM-DD."}, 400

        end_date_str = filters.get("end_date")
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                query = query.filter(UserExpense.expense_date <= end_date)
            except ValueError:
                return {"error": "Invalid end_date format. Use YYYY-MM-DD."}, 400

        min_amount = filters.get("min_amount")
        if min_amount:
            try:
                min_amount = float(min_amount)
                query = query.filter(UserExpense.amount >= min_amount)
            except ValueError:
                return {"error": "Invalid min_amount format. Must be a number."}, 400

        max_amount = filters.get("max_amount")
        if max_amount:
            try:
                max_amount = float(max_amount)
                query = query.filter(UserExpense.amount <= max_amount)
            except ValueError:
                return {"error": "Invalid max_amount format. Must be a number."}, 400

        if page < 1:
            page = 1
        if page_size < 1 or page_size > 50:
            page_size = 20 

        total_records = query.count()

        total_pages = (total_records + page_size - 1) // page_size

        sort_info = filters.get("sort", {})
        sort_field_name = sort_info.get("field", "expense_date") 
        sort_order = sort_info.get("order", "desc")

        sortable_fields = {
            "expense_date": UserExpense.expense_date,
            "amount": UserExpense.amount
        }

        sort_column = sortable_fields.get(sort_field_name, UserExpense.expense_date)

        if sort_order.lower() == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc()) 

        expenses = (
            query
                 .offset((page - 1) * page_size)
                 .limit(page_size)
                 .all()
        )

        return {
            "expenses": [
                {
                    "id": exp.id,
                    "amount": exp.amount,
                    "description": exp.description,
                    "expense_date": exp.expense_date.isoformat(),
                    "created_at": exp.created_at.isoformat(),
                    "updated_at": exp.updated_at.isoformat(),
                } for exp in expenses
            ],
            "total_pages": total_pages,
            "current_page": page,
            "page_size": page_size,
            "total_records": total_records,
        }

    except Exception as e:
        return {"error": f"An error occurred: {str(e)}"}, 500

# GET /api/v1/user/expenses/{id}
def get_user_single_expense(user_id, expense_id):
    exp = UserExpense.query.filter_by(user_id=user_id, id=expense_id).first()
    if not exp:
        raise NotFoundError("Expense not found or does not belong to the user")
    return {
        "id": exp.id,
        "amount": exp.amount,
        "description": exp.description,
        "expense_date": exp.expense_date.isoformat(),
        "created_at": exp.created_at.isoformat(),
        "updated_at": exp.updated_at.isoformat(),
    }

# POST /api/v1/user/expenses
def add_user_expenses(user_id, data):
    added_expenses = []
    for expense in data:
        new_expense = UserExpense(
            user_id=user_id,
            amount=expense["amount"],
            description=expense["description"],
            expense_date=datetime.strptime(expense["expense_date"], "%Y-%m-%d").date(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.session.add(new_expense)
        db.session.commit()
        added_expenses.append({
            "id": new_expense.id,
            "amount": new_expense.amount,
            "description": new_expense.description,
            "expense_date": new_expense.expense_date.isoformat(),
            "created_at": new_expense.created_at.isoformat(),
            "updated_at": new_expense.updated_at.isoformat()
        })
    return added_expenses

# PUT /api/v1/user/expenses/<expense_id>
def update_user_expense(user_id, expense_id, data):
    expense = UserExpense.query.filter_by(id=expense_id, user_id=user_id).first()
    if not expense:
        raise NotFoundError("Expense not found or does not belong to the user")

    if "amount" in data:
        expense.amount = data["amount"]
    if "description" in data:
        expense.description = data["description"]
    if "expense_date" in data:
        expense.expense_date = datetime.strptime(data["expense_date"], "%Y-%m-%d").date()

    expense.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return {
        "id": expense.id,
        "amount": expense.amount,
        "description": expense.description,
        "expense_date": expense.expense_date.isoformat(),
        "created_at": expense.created_at.isoformat(),
        "updated_at": expense.updated_at.isoformat()
    }

# DELETE /api/v1/user/expenses/<expense_id>
def delete_user_expense(user_id, expense_id):
    expense = UserExpense.query.filter_by(id=expense_id, user_id=user_id).first()
    if not expense:
        raise NotFoundError("Expense not found or does not belong to the user")
    db.session.delete(expense)
    db.session.commit()
    return expense

# DELETE /api/v1/user/expenses/<expense_id>
def delete_many_user_expenses(user_id, expense_ids):
    expenses_to_delete = UserExpense.query.filter(
        UserExpense.user_id == user_id,
        UserExpense.id.in_(expense_ids)
    ).all()
    
    deleted_count = len(expenses_to_delete)
        
    for expense in expenses_to_delete:
        db.session.delete(expense) 
    db.session.commit()
    
    return deleted_count

#GET /api/v1/user/statistics/summary
def get_date_range(range_str):
    today = datetime.now(timezone.utc)
    end_date = today.replace(hour=23, minute=59, second=59, microsecond=999999)
    start_date = None

    if range_str == "today":
        start_date = today.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_str == "7d":
        start_date = (today - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_str == "30d":
        start_date = (today - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_str == "1y":
        start_date = (today - relativedelta(years=1) + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = today.replace(hour=0, minute=0, second=0, microsecond=0)

    return start_date, end_date

def get_user_statistics_summary(user_id, range, top):

    start_date, end_date = get_date_range(range)

    base_query = db.session.query(UserExpense).filter(
            UserExpense.user_id == user_id,
            UserExpense.expense_date >= start_date,
            UserExpense.expense_date <= end_date
        )
    
    income_query = base_query.filter(UserExpense.amount > 0).with_entities(
            func.coalesce(func.sum(UserExpense.amount), 0)
        )
    expense_query = base_query.filter(UserExpense.amount < 0).with_entities(
        func.coalesce(func.sum(UserExpense.amount), 0)
    )

    total_income = income_query.scalar()
    total_expense = expense_query.scalar()

    top_incomes = base_query.filter(UserExpense.amount > 0)\
                                .order_by(UserExpense.amount.desc())\
                                .limit(top).all()
                                
    top_expenses = base_query.filter(UserExpense.amount < 0)\
                                 .order_by(UserExpense.amount.asc())\
                                 .limit(top).all()
    
    def serialize_expense(expense):
            return {
                "id": expense.id,
                "description": expense.description,
                "amount": expense.amount,
                "expense_date": expense.expense_date.isoformat(),
                "created_at": expense.created_at.isoformat(),
                "updated_at": expense.updated_at.isoformat()
            }
    
    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "top_incomes": [serialize_expense(exp) for exp in top_incomes],
        "top_expenses": [serialize_expense(exp) for exp in top_expenses],
    }
    
#GET /api/v1/user/statistics/chart

def process_chart_data(results, start_date, end_date, group_by_format):
    data_map = {}
    current_date = start_date
    
    while current_date <= end_date:
        if group_by_format == 'day':
            key = current_date.strftime('%Y-%m-%d')
        elif group_by_format == 'month':
            key = current_date.strftime('%Y-%m')
        data_map[key] = 0
        
        if group_by_format == 'day':
            current_date += timedelta(days=1)
        elif group_by_format == 'month':
            next_month = current_date.replace(day=28) + timedelta(days=4)
            current_date = next_month.replace(day=1)


    for row in results:
        key = row[0] 
        value = row[1] 
        if key in data_map:
            data_map[key] = value
    
    sorted_map = dict(sorted(data_map.items()))
    return list(sorted_map.keys()), list(sorted_map.values())

def get_user_statistics_chart_data(user_id, range):
    start_date, end_date = get_date_range(range)

    unit = "k"
    divider = 1000.0
    group_by_format = 'day' 
    group_by_field = func.date(UserExpense.expense_date)

    if range == "1y":
        unit = "tr" 
        divider = 1000000.0 
        group_by_format = 'month'
        group_by_field = func.to_char(UserExpense.expense_date, 'YYYY-MM')

    base_query = db.session.query(
            group_by_field.label('key'),
            func.sum(UserExpense.amount).label('total')
        ).filter(
            UserExpense.user_id == user_id,
            UserExpense.expense_date >= start_date,
            UserExpense.expense_date <= end_date
        ).group_by('key')

    income_results = base_query.filter(UserExpense.amount > 0).all()
    expense_results = base_query.filter(UserExpense.amount < 0).all()

    total_income_raw = sum(float(row[1]) for row in income_results)
    total_expense_raw = sum(float(abs(row[1])) for row in expense_results)

    income_raw = [(str(row[0]), float(row[1] / divider)) for row in income_results]
    expense_raw = [(str(row[0]), float(abs(row[1]) / divider)) for row in expense_results]

    income_labels, income_data = process_chart_data(income_raw, start_date, end_date, group_by_format)
    expense_labels, expense_data = process_chart_data(expense_raw, start_date, end_date, group_by_format)
    

    final_labels = []
    if range == '7d':
        final_labels = [datetime.strptime(label, '%Y-%m-%d').strftime('%d/%m') for label in income_labels]

    elif range == '30d':
        for i, label in enumerate(income_labels):
            day_num = datetime.strptime(label, '%Y-%m-%d').day

            if day_num % 5 == 0 or day_num == 1:
                final_labels.append(datetime.strptime(label, '%Y-%m-%d').strftime('%d/%m'))
            else:
                final_labels.append("")
    elif range == '1y':
        last_index = len(income_labels) - 1
        for i, label in enumerate(income_labels):
            if i % 6 == 0 or i == last_index:
                formatted_label = datetime.strptime(label, '%Y-%m').strftime('%m/%Y')
                final_labels.append(formatted_label)
            else:
                final_labels.append("")

    return {
        "lineData": {
            "labels": final_labels,
            "datasets": [
                { "data": income_data, "type": "income" },
                { "data": expense_data, "type": "expense" }
            ]
        },
        "total_income": total_income_raw,
        "total_expense": total_expense_raw,
        "unit": unit 
    }