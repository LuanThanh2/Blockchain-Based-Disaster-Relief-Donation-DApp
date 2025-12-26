# backend/app/services/email_service.py

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL

logger = logging.getLogger("uvicorn.error")


def send_otp_email(to_email: str, username: str, otp_code: str) -> bool:
    """
    Gửi email chứa OTP code để reset password
    
    Args:
        to_email: Email người nhận
        username: Username của người dùng
        otp_code: Mã OTP 6 chữ số
        
    Returns:
        True nếu gửi thành công, False nếu thất bại
    """
    try:
        # Kiểm tra cấu hình SMTP
        if not SMTP_USER or not SMTP_PASSWORD:
            logger.error("SMTP_USER hoặc SMTP_PASSWORD chưa được cấu hình trong .env")
            return False
        
        # Tạo email message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "🔐 Mã OTP Reset Mật Khẩu - ReliefChain"
        msg["From"] = SMTP_FROM_EMAIL
        msg["To"] = to_email
        
        # Email body (HTML)
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }}
                .content {{
                    background: white;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }}
                .otp-box {{
                    background: #f0f0f0;
                    border: 2px dashed #667eea;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 20px 0;
                }}
                .otp-code {{
                    font-size: 32px;
                    font-weight: bold;
                    color: #667eea;
                    letter-spacing: 5px;
                }}
                .warning {{
                    background: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin: 20px 0;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 12px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🌍 ReliefChain</h1>
                    <p>Reset Mật Khẩu</p>
                </div>
                <div class="content">
                    <p>Xin chào <strong>{username}</strong>,</p>
                    
                    <p>Bạn đã yêu cầu reset mật khẩu cho tài khoản của mình. Vui lòng sử dụng mã OTP sau đây:</p>
                    
                    <div class="otp-box">
                        <p style="margin: 0; color: #666;">Mã OTP của bạn:</p>
                        <div class="otp-code">{otp_code}</div>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ Lưu ý:</strong>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            <li>Mã OTP này có hiệu lực trong <strong>15 phút</strong></li>
                            <li>Mã OTP chỉ có thể sử dụng <strong>1 lần</strong></li>
                            <li>Nếu bạn không yêu cầu reset mật khẩu, vui lòng bỏ qua email này</li>
                        </ul>
                    </div>
                    
                    <p>Nếu bạn không yêu cầu reset mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ReliefChain - Blockchain-Based Disaster Relief Donation DApp</p>
                    <p>Email này được gửi tự động, vui lòng không trả lời.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version (fallback)
        text_body = f"""
        ReliefChain - Reset Mật Khẩu
        
        Xin chào {username},
        
        Bạn đã yêu cầu reset mật khẩu cho tài khoản của mình.
        
        Mã OTP của bạn: {otp_code}
        
        Mã OTP này có hiệu lực trong 15 phút và chỉ có thể sử dụng 1 lần.
        
        Nếu bạn không yêu cầu reset mật khẩu, vui lòng bỏ qua email này.
        
        © 2024 ReliefChain
        """
        
        # Attach parts
        part1 = MIMEText(text_body, "plain", "utf-8")
        part2 = MIMEText(html_body, "html", "utf-8")
        
        msg.attach(part1)
        msg.attach(part2)
        
        # Gửi email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()  # Enable TLS
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"OTP email sent successfully to {to_email} for user {username}")
        return True
        
    except Exception as e:
        logger.exception(f"Failed to send OTP email to {to_email}: {e}")
        return False




