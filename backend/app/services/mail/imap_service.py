"""
IMAP Service — Fetch and sync emails from IMAP server.
"""
import email
import imaplib
import json
import re
from datetime import datetime
from email.header import decode_header
from email.utils import parseaddr, parsedate_to_datetime
from typing import List, Optional, Tuple


def _decode_str(value: str | bytes | None) -> str:
    """Decode an encoded email header value to a plain string."""
    if value is None:
        return ""
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    parts = decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def _get_body(msg: email.message.Message) -> Tuple[Optional[str], Optional[str]]:
    """Extract plain text and HTML body from a message."""
    text_body = None
    html_body = None

    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if "attachment" in cd:
                continue
            charset = part.get_content_charset() or "utf-8"
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            decoded = payload.decode(charset, errors="replace")
            if ct == "text/plain" and text_body is None:
                text_body = decoded
            elif ct == "text/html" and html_body is None:
                html_body = decoded
    else:
        ct = msg.get_content_type()
        charset = msg.get_content_charset() or "utf-8"
        payload = msg.get_payload(decode=True)
        if payload:
            decoded = payload.decode(charset, errors="replace")
            if ct == "text/html":
                html_body = decoded
            else:
                text_body = decoded

    return text_body, html_body


def _get_attachments(msg: email.message.Message) -> List[dict]:
    """Extract attachment metadata from a message."""
    attachments = []
    if msg.is_multipart():
        for part in msg.walk():
            cd = str(part.get("Content-Disposition", ""))
            if "attachment" not in cd:
                continue
            filename = _decode_str(part.get_filename() or "")
            ct = part.get_content_type() or "application/octet-stream"
            data = part.get_payload(decode=True) or b""
            attachments.append({
                "filename": filename,
                "content_type": ct,
                "data": data,
                "size_bytes": len(data),
            })
    return attachments


class ImapService:

    @staticmethod
    def test_connection(
        host: str,
        port: int,
        use_ssl: bool,
        username: str,
        password: str,
    ) -> Tuple[bool, Optional[str]]:
        """Test IMAP connectivity. Returns (success, error_message)."""
        try:
            if use_ssl:
                conn = imaplib.IMAP4_SSL(host, port)
            else:
                conn = imaplib.IMAP4(host, port)
            conn.login(username, password)
            conn.logout()
            return True, None
        except Exception as exc:
            return False, str(exc)

    @staticmethod
    def fetch_messages(
        host: str,
        port: int,
        use_ssl: bool,
        username: str,
        password: str,
        folder: str = "INBOX",
        since_uid: Optional[int] = None,
        max_count: int = 100,
    ) -> List[dict]:
        """
        Fetch messages from an IMAP folder.
        Returns a list of parsed message dicts.
        """
        if use_ssl:
            conn = imaplib.IMAP4_SSL(host, port)
        else:
            conn = imaplib.IMAP4(host, port)

        try:
            conn.login(username, password)
            conn.select(folder, readonly=True)

            if since_uid:
                status, data = conn.uid("search", None, f"UID {since_uid}:*")
            else:
                status, data = conn.uid("search", None, "ALL")

            if status != "OK" or not data[0]:
                return []

            uid_list = data[0].split()
            # Take the most recent max_count
            uid_list = uid_list[-max_count:]

            messages = []
            for uid_bytes in uid_list:
                uid = int(uid_bytes)
                if since_uid and uid <= since_uid:
                    continue

                status, msg_data = conn.uid("fetch", uid_bytes, "(RFC822)")
                if status != "OK" or not msg_data or not msg_data[0]:
                    continue

                raw = msg_data[0][1]
                if not isinstance(raw, bytes):
                    continue

                msg = email.message_from_bytes(raw)

                # Parse date
                date_str = msg.get("Date", "")
                try:
                    msg_date = parsedate_to_datetime(date_str)
                    # Convert to naive UTC
                    msg_date = msg_date.replace(tzinfo=None)
                except Exception:
                    msg_date = datetime.utcnow()

                from_raw = msg.get("From", "")
                from_name, from_addr = parseaddr(from_raw)
                from_name = _decode_str(from_name)

                to_raw = msg.get("To", "")
                cc_raw = msg.get("Cc", "")
                bcc_raw = msg.get("Bcc", "")

                to_list = [addr.strip() for addr in to_raw.split(",") if addr.strip()]
                cc_list = [addr.strip() for addr in cc_raw.split(",") if addr.strip()] if cc_raw else []
                bcc_list = [addr.strip() for addr in bcc_raw.split(",") if addr.strip()] if bcc_raw else []

                text_body, html_body = _get_body(msg)
                attachments = _get_attachments(msg)

                messages.append({
                    "imap_uid": uid,
                    "message_id": msg.get("Message-ID", "").strip(),
                    "from_address": from_addr,
                    "from_name": from_name,
                    "to_addresses": json.dumps(to_list),
                    "cc_addresses": json.dumps(cc_list) if cc_list else None,
                    "bcc_addresses": json.dumps(bcc_list) if bcc_list else None,
                    "subject": _decode_str(msg.get("Subject", "(no subject)")),
                    "body_text": text_body,
                    "body_html": html_body,
                    "date": msg_date,
                    "attachments": attachments,
                })

            return messages

        finally:
            try:
                conn.logout()
            except Exception:
                pass

    @staticmethod
    def get_folders(
        host: str,
        port: int,
        use_ssl: bool,
        username: str,
        password: str,
    ) -> List[str]:
        """List available IMAP folders."""
        if use_ssl:
            conn = imaplib.IMAP4_SSL(host, port)
        else:
            conn = imaplib.IMAP4(host, port)
        try:
            conn.login(username, password)
            status, folders = conn.list()
            result = []
            if status == "OK":
                for f in folders:
                    if isinstance(f, bytes):
                        parts = f.decode().split('"')
                        if parts:
                            result.append(parts[-1].strip())
            return result
        finally:
            try:
                conn.logout()
            except Exception:
                pass
