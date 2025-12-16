from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import os

load_dotenv()

from models import db  
from routes import auth_bp, user_bp

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY")
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)  

app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
app.register_blueprint(user_bp, url_prefix="/api/v1/user")

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True)
