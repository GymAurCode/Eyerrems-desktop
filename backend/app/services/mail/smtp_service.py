"""
SMTP Service — Send emails via SMTP.
"""
import json
import smtplib
import ssl
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional, Tuple


class SmtpService:

    @staticmethod
    def test_connection(
        host: str,
        port: int,
        use_tls: bool,
        username: str,
        password: str,
    ) -> Tuple[bool, Optional[str]]:
        """Test SMTP connectivity. Returns (success, error_message)."""
        try:
            context = ssl.create_default_context()
            if port == 465:
                # SSL from the start
                with smtplib.SMTP_SSL(host, port, context=context, timeout=10) as server:
                    server.login(username, password)
            else:
                with smtplib.SMTP(host, port, timeout=10) as server:
                    server.ehlo()
                    if use_tls:
                        server.starttls(context=context)
                        server.ehlo()
                    server.login(username, password)
            return True, None
        except Exception as exc:
            return False, str(exc)

    @staticmethod
    def send(
        host: str,
        port: int,
        use_tls: bool,
        username: str,
        password: str,
        from_address: str,
        from_name: str,
        to_addresses: List[str],
        cc_addresses: List[str],
        bcc_addresses: List[str],
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        attachments: Optional[List[dict]] = None,
    ) -> str:
        """
        Send an email via SMTP.
        attachments: list of {"filename": str, "content_type": str, "data": bytes}
        Returns the Message-ID header value.
        """
        msg = MIMEMultipart("alternative") if not attachments else MIMEMultipart("mixed")

        from_header = f"{from_name} <{from_address}>" if from_name else from_address
        msg["From"] = from_header
        msg["To"] = ", ".join(to_addresses)
        if cc_addresses:
            msg["Cc"] = ", ".join(cc_addresses)
        msg["Subject"] = subject

        # Build alternative part (text + html)
        alt_part = MIMEMultipart("alternative")
        if body_text:
            alt_part.attach(MIMEText(body_text, "plain", "utf-8"))
        alt_part.attach(MIMEText(body_html, "html", "utf-8"))

        if attachments:
            msg.attach(alt_part)
            for att in attachments:
                part = MIMEBase(*att["content_type"].split("/", 1))
                part.set_payload(att["data"])
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=att["filename"],
                )
                msg.attach(part)
        else:
            # No attachments — attach text/html directly
            if body_text:
                msg.attach(MIMEText(body_text, "plain", "utf-8"))
            msg.attach(MIMEText(body_html, "html", "utf-8"))

        all_recipients = to_addresses + cc_addresses + bcc_addresses

        context = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=30) as server:
                server.login(username, password)
                server.sendmail(from_address, all_recipients, msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=30) as server:
                server.ehlo()
                if use_tls:
                    server.starttls(context=context)
                    server.ehlo()
                server.login(username, password)
                server.sendmail(from_address, all_recipients, msg.as_string())

        return msg.get("Message-ID", "")
