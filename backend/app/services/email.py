import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib
from app.core.config import settings

logger = logging.getLogger(__name__)

async def send_email(to_email: str, subject: str, html_content: str):
    """
    Sends an email using the SMTP settings. 
    If SMTP credentials are not configured, it logs the email to the console as a mock delivery.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(
            f"\n--- [MOCK EMAIL SENT] ---\n"
            f"From: {settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"Body:\n{html_content}\n"
            f"-------------------------\n"
        )
        return True

    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        message["Subject"] = subject

        # Attach HTML content
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)

        # Connect and send
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_PORT == 465,
            start_tls=settings.SMTP_PORT == 587,
        )
        logger.info(f"Email sent successfully to {to_email} with subject: '{subject}'")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email} due to: {str(e)}")
        # Return True anyway to prevent blocking business flow if email server has issues
        return False

# ── Templates ─────────────────────────────────────────────────────────────────

def get_base_html(title: str, content: str) -> str:
    """Base HTML wrapper template with modern grayscale branding matching AutoCrafERP UI."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>{title}</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #f4f4f5;
                color: #18181b;
                margin: 0;
                padding: 40px 20px;
            }}
            .container {{
                max-width: 500px;
                margin: 0 auto;
                background: #ffffff;
                border: 1px solid #e4e4e7;
                border-radius: 8px;
                padding: 32px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }}
            .header {{
                text-align: center;
                border-bottom: 1px solid #e4e4e7;
                padding-bottom: 20px;
                margin-bottom: 24px;
            }}
            .logo {{
                font-weight: 800;
                font-size: 20px;
                letter-spacing: -0.05em;
                color: #000000;
                text-transform: uppercase;
            }}
            .title {{
                font-size: 18px;
                font-weight: 700;
                margin-top: 10px;
                color: #27272a;
            }}
            .content {{
                font-size: 14px;
                line-height: 1.6;
                color: #52525b;
            }}
            .footer {{
                text-align: center;
                margin-top: 32px;
                font-size: 11px;
                color: #a1a1aa;
                border-top: 1px solid #e4e4e7;
                padding-top: 16px;
                font-family: monospace;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <span class="logo">AutoCrafERP</span>
                <div class="title">{title}</div>
            </div>
            <div class="content">
                {content}
            </div>
            <div class="footer">
                © 2026 AutoCrafERP · Automated Resource Systems
            </div>
        </div>
    </body>
    </html>
    """

async def send_verification_email(email: str, name: str, code: str):
    title = "Verify Your Account"
    content = f"""
    <p>Hi <strong>{name}</strong>,</p>
    <p>Thank you for registering on AutoCrafERP. Please use the verification code below to verify your email address and activate your account:</p>
    <div style="background-color: #f4f4f5; border: 1px solid #e4e4e7; padding: 16px; text-align: center; font-size: 24px; font-weight: 800; letter-spacing: 4px; border-radius: 6px; margin: 20px 0; font-family: monospace; color: #18181b;">
        {code}
    </div>
    <p>This code is valid for 15 minutes. If you did not request this, you can safely ignore this email.</p>
    """
    html = get_base_html(title, content)
    await send_email(email, f"AutoCrafERP — Verification Code: {code}", html)

async def send_password_reset_email(email: str, name: str, code: str):
    title = "Reset Your Password"
    content = f"""
    <p>Hi <strong>{name}</strong>,</p>
    <p>We received a request to reset the password for your AutoCrafERP account. Use the code below to complete the reset process:</p>
    <div style="background-color: #f4f4f5; border: 1px solid #e4e4e7; padding: 16px; text-align: center; font-size: 24px; font-weight: 800; letter-spacing: 4px; border-radius: 6px; margin: 20px 0; font-family: monospace; color: #18181b;">
        {code}
    </div>
    <p>This code is valid for 15 minutes. If you did not request a password reset, please secure your account credentials immediately.</p>
    """
    html = get_base_html(title, content)
    await send_email(email, f"AutoCrafERP — Password Reset Code: {code}", html)

async def send_sales_order_confirmation_email(email: str, name: str, order_number: str, total_amount: float):
    title = "Sales Order Confirmed"
    content = f"""
    <p>Hi <strong>{name}</strong>,</p>
    <p>Your sales order <strong>{order_number}</strong> has been successfully confirmed!</p>
    <p><strong>Order Details:</strong></p>
    <ul>
        <li><strong>Order Reference:</strong> {order_number}</li>
        <li><strong>Total Amount:</strong> ₹{total_amount:,.2f}</li>
        <li><strong>Status:</strong> Confirmed & Stock Reserved</li>
    </ul>
    <p>Our team is now preparing the fulfillment. You can track your order status live on the Customer Portal.</p>
    """
    html = get_base_html(title, content)
    await send_email(email, f"AutoCrafERP — Order Confirmed: {order_number}", html)

async def send_purchase_order_confirmation_email(email: str, name: str, order_number: str, total_amount: float):
    title = "Purchase Order Placed"
    content = f"""
    <p>Hi <strong>{name}</strong>,</p>
    <p>We are pleased to confirm that purchase order <strong>{order_number}</strong> has been issued to you:</p>
    <p><strong>Order Details:</strong></p>
    <ul>
        <li><strong>PO Reference:</strong> {order_number}</li>
        <li><strong>Total Value:</strong> ₹{total_amount:,.2f}</li>
        <li><strong>Status:</strong> Sent to Vendor</li>
    </ul>
    <p>Please prepare the items for delivery according to the agreed terms. Thank you for your partnership.</p>
    """
    html = get_base_html(title, content)
    await send_email(email, f"AutoCrafERP — Purchase Order Issued: {order_number}", html)
