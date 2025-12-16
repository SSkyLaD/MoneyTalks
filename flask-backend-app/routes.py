from flask import Blueprint, request, jsonify
from custom_exception import JWTMismatchError, NotFoundError, LlmServiceError
from jsonschema import validate, ValidationError
from services import create_or_get_user, create_jwt,jwt_token_verify, logout
from services import get_user_messages_paginated, process_user_text_message, process_user_image_message,process_assistant_response_message, delete_all_user_messages, delete_user_message
from services import get_user_expenses, get_user_single_expense, add_user_expenses, update_user_expense, delete_user_expense, delete_many_user_expenses
from services import get_user_statistics_summary, get_user_statistics_chart_data
import jwt
from models import db

login_schema = {
    "type": "object",
    "properties": {
        "sub": {"type": "string"},
        "email": {"type": "string", "format": "email"},
        "name": {"type": "string"},
        "picture": {"type": "string", "format": "uri"},
    },
    "required": ["sub", "email", "name", "picture"]
}
auth_bp = Blueprint("auth", __name__)
@auth_bp.route("/login", methods=["POST"])
def app_login():
    try: 
        data = request.get_json()
        validate(data, login_schema)
        
        user = create_or_get_user(data)

        jwt_token = create_jwt(user)

        return jsonify({
            "token": jwt_token,
            "user": {
                "email": user.email,
                "name": user.name,
                "picture": user.picture
            }
        })
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except NotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    

# @auth_bp.route("/logout", methods=["POST"])
# def app_logout():
#     try:
#         user = jwt_token_verify(request.headers)

#         user.last_login_token = None
#         logout(user)

#         return jsonify({"message": "Logged out successfully"}), 200
#     except JWTMismatchError as e:
#         return jsonify({"error": str(e)}), 434
#     except jwt.ExpiredSignatureError:
#         return jsonify({"error": "Token expired"}), 401
#     except jwt.InvalidTokenError:
#         return jsonify({"error": "Invalid token"}), 401
#     except Exception as e:
#         db.session.rollback()
#         return jsonify({"error": str(e)}), 500

user_bp = Blueprint("user", __name__)
@user_bp.route("/message", methods=["GET"])
def get_messages():
    try:
        user = jwt_token_verify(request.headers)
        
        limit = int(request.args.get("limit", 20))
        
        before_id_str = request.args.get("before_id")
        
        before_id = int(before_id_str) if before_id_str else None

        result = get_user_messages_paginated(user.id, limit, before_id)

        return jsonify({
            "msg": "Success",
            "messages": result["messages"],
            "pagination": result["pagination"]
        }), 200
    
    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@user_bp.route("/message", methods=["POST"])
def post_message():
    try:
        user = jwt_token_verify(request.headers)

        if request.is_json:
            data = request.get_json()
            role = data.get("role")
            data_type = data.get("data_type", "text")
            content = data.get("content", "")
        else:
            role = request.form.get("role")
            data_type = request.form.get("data_type", "image")

        if role not in ["user", "assistant"]:
            return jsonify({"error": "Invalid role!"}), 400
        if data_type not in ["text", "image"]:
            return jsonify({"error": "Invalid data_type!"}), 400

        if data_type == "text":
            if not content:
                return jsonify({"error": "Empty message!"}), 400
            if(role == "user"):
                response = process_user_text_message(user.id, content)
                return jsonify({"msg": "Success", "response": response}), 200
            if(role == "assistant"):
                response = process_assistant_response_message(user.id, content)
                return jsonify({"msg": "Success", "response": response}), 200
        elif data_type == "image":
            if "file" not in request.files:
                return jsonify({"error": "No file uploaded!"}), 400
            file = request.files["file"]
            message = process_user_image_message(user.id, file)
            return jsonify({"msg": "Success", "response": message}), 200

    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except LlmServiceError as e:
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@user_bp.route("/message/<int:message_id>", methods=["DELETE"])
def delete_message(message_id):
    try:
        user = jwt_token_verify(request.headers)
        message = delete_user_message(user.id, message_id)

        message_dict = {
            "id": message.id,
            "user_id": message.user_id,
            "role": message.role,
            "content": message.content,
            "timestamp": message.timestamp.isoformat()
        }

        return jsonify({"msg": "Success","deleted_message": message_dict}), 200
    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except NotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@user_bp.route("/message", methods=["DELETE"])
def delete_messages():
    try:
        user = jwt_token_verify(request.headers)
        delete_count = delete_all_user_messages(user.id)

        return jsonify({"msg": "Success","delete_count": delete_count}), 200
    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@user_bp.route("/expenses", methods=["GET"])
def get_expenses():
    try:
        user = jwt_token_verify(request.headers)

        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("pageSize", 20))
        
        filters = {
            "sort":{
                "field": request.args.get("sortField", "expense_date"),
                "order": request.args.get("sortOrder", "desc")
            },
            "keyword": request.args.get("keyword", ""),
            "start_date": request.args.get("startDate", ""),
            "end_date": request.args.get("endDate", ""),
            "min_amount": request.args.get("minAmount", ""),
            "max_amount": request.args.get("maxAmount", "")
        }

        result = get_user_expenses(user.id, filters, page, page_size)
        return jsonify({
            "msg": "Success",
            "expenses": result["expenses"],
            "page": result["current_page"],
            "page_size": result["page_size"],
            "total_pages": result["total_pages"],
            "total_records": result["total_records"]
        }), 200

    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@user_bp.route("/expenses/<int:expense_id>", methods=["GET"])
def get_single_expense(expense_id):
    try:
        user = jwt_token_verify(request.headers)

        result = get_user_single_expense(user.id, expense_id)
        return jsonify({
            "msg": "Success",
            "expense": result,
        }), 200

    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except NotFoundError:
        return jsonify({"error": "User or ID not found"}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

add_expenses_schema = {
    "type": "object",
    "properties": {
        "expenses": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number"},
                    "description": {"type": "string"},
                    "expense_date": {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"}
                },
                "required": ["amount", "description", "expense_date"]
            }
        }
    },
    "required": ["expenses"]
}

@user_bp.route("/expenses", methods=["POST"])
def add_expenses():
    try:
        user = jwt_token_verify(request.headers)
        data = request.get_json()
        validate(data, add_expenses_schema)
        expenses = add_user_expenses(user.id, data["expenses"])

        return jsonify({"msg": "Success","added_expenses": expenses}), 200

    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

update_expenses_schema = {
    "type": "object",
    "properties": {
        "amount": {"type": "number"},
        "description": {"type": "string"},
        "expense_date": {"type": "string", "format": "date-time"}
    },
    "minProperties": 1
}

@user_bp.route("/expenses/<int:expenses_id>", methods=["PUT"])
def update_expense(expenses_id):
    try:
        user = jwt_token_verify(request.headers)
        data = request.get_json()
        validate(data, update_expenses_schema)
        expense = update_user_expense(user.id, expenses_id, data)

        return jsonify({"msg": "Success","updated_expense": expense}), 200

    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except NotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@user_bp.route("/expenses/<int:expenses_id>", methods=["DELETE"])
def delete_expense(expenses_id):
    try:
        user = jwt_token_verify(request.headers)
        expense = delete_user_expense(user.id, expenses_id)

        expense_dict = {
            "id": expense.id,
            "amount": expense.amount,
            "description": expense.description,
            "expense_date": expense.expense_date.isoformat(),
            "created_at": expense.created_at.isoformat(),
            "updated_at": expense.updated_at.isoformat()
        }

        return jsonify({"msg": "Success","deleted_expense": expense_dict}), 200

    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except NotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@user_bp.route("/expenses", methods=["PUT"])
def delete_multiple_expenses():
    try:
        user = jwt_token_verify(request.headers)
        data = request.get_json()
        if not data or "delete_ids" not in data:
            return jsonify({"error": "Phải cung cấp 'delete_ids' trong body"}), 400

        delete_ids = data["delete_ids"] 

        if not delete_ids:
             return jsonify({"msg": "Không có ID nào được chọn", "deleted_count": 0}), 200

        deleted_count = delete_many_user_expenses(user.id, delete_ids)

        return jsonify({"msg": "Success", "deleted_count": deleted_count}), 200

    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except NotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@user_bp.route("/statistics/summary", methods=["GET"])
def get_statistics_summary():
    try:
        user = jwt_token_verify(request.headers)
        range = request.args.get("range","today")

        if range not in ["today", "7d", "30d", "1y"]:
            range = "today"

        top = request.args.get("top", "10")
        if int(top) <= 0:
            top = "10"

        response = get_user_statistics_summary(user.id, range, top)

        return jsonify({"msg": "Success",**response})
    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except NotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@user_bp.route("/statistics/chart", methods=["GET"])
def get_statistics_chart_data():
    try:
        user = jwt_token_verify(request.headers)
        user_id = user.id

        range = request.args.get("range", "7d")
        if range not in ["7d", "30d", "1y"]:
            range = "7d"

        response = get_user_statistics_chart_data(user_id, range)
        return jsonify({"msg": "Success",**response})
    except JWTMismatchError as e:
        return jsonify({"error": str(e)}), 434
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except NotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500