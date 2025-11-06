"""
Custom Django email backend for Resend REST API.

This backend uses Resend's REST API instead of SMTP, which is useful for
platforms like Railway that block SMTP ports.
"""
import logging
from typing import Any, Optional

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.message import EmailMessage, EmailMultiAlternatives

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


class ResendEmailBackend(BaseEmailBackend):
    """
    Email backend that sends emails via Resend's REST API.

    Required settings:
    - RESEND_API_KEY: Your Resend API key
    - EMAIL_FROM: Sender email address (must be verified in Resend)

    Optional settings:
    - RESEND_API_URL: Override the Resend API URL (default: https://api.resend.com/emails)
    """

    def __init__(
        self,
        fail_silently: bool = False,
        **kwargs: Any,
    ) -> None:
        super().__init__(fail_silently=fail_silently)
        self.api_key = getattr(settings, "RESEND_API_KEY", None)
        self.api_url = getattr(settings, "RESEND_API_URL", RESEND_API_URL)
        self.from_email = getattr(settings, "EMAIL_FROM", None)

        if not self.api_key:
            if not fail_silently:
                raise ValueError(
                    "RESEND_API_KEY setting is required for ResendEmailBackend"
                )
            logger.warning("RESEND_API_KEY not set, email sending will fail")

        if not self.from_email:
            if not fail_silently:
                raise ValueError(
                    "EMAIL_FROM setting is required for ResendEmailBackend"
                )
            logger.warning("EMAIL_FROM not set, email sending will fail")

    def send_messages(self, email_messages: list[EmailMessage]) -> int:
        """
        Send one or more EmailMessage objects and return the number of emails sent.
        """
        if not email_messages:
            return 0

        if not self.api_key or not self.from_email:
            if not self.fail_silently:
                raise ValueError(
                    "RESEND_API_KEY and EMAIL_FROM must be set to send emails"
                )
            return 0

        num_sent = 0
        for message in email_messages:
            try:
                self._send_message(message)
                num_sent += 1
            except Exception as e:
                if not self.fail_silently:
                    raise
                logger.error(
                    "Failed to send email via Resend: %s",
                    e,
                    exc_info=True,
                )

        return num_sent

    def _send_message(self, message: EmailMessage) -> None:
        """
        Send a single EmailMessage via Resend API.
        """
        # Extract recipients
        to_emails = message.to if isinstance(message.to, list) else [message.to]
        cc_emails = message.cc if isinstance(message.cc, list) else (message.cc or [])
        bcc_emails = (
            message.bcc if isinstance(message.bcc, list) else (message.bcc or [])
        )

        # Use the message's from_email if set, otherwise fall back to settings
        from_email = message.from_email or self.from_email

        # Prepare the payload
        payload: dict[str, Any] = {
            "from": from_email,
            "to": to_emails,
            "subject": message.subject,
        }

        # Add CC and BCC if present
        if cc_emails:
            payload["cc"] = cc_emails
        if bcc_emails:
            payload["bcc"] = bcc_emails

        # Handle reply-to
        if message.reply_to:
            reply_to = (
                message.reply_to
                if isinstance(message.reply_to, list)
                else [message.reply_to]
            )
            payload["reply_to"] = reply_to

        # Handle email body
        # Resend supports both text and HTML
        if isinstance(message, EmailMultiAlternatives):
            # Check for HTML alternative
            html_content = None
            text_content = None

            for content, content_type in message.alternatives:
                if content_type == "text/html":
                    html_content = content
                elif content_type == "text/plain":
                    text_content = content

            # If no explicit text/plain alternative, use the body
            if not text_content:
                text_content = message.body

            if html_content:
                payload["html"] = html_content
            if text_content:
                payload["text"] = text_content
        else:
            # Regular EmailMessage - check content_subtype
            if message.content_subtype == "html":
                payload["html"] = message.body
            else:
                payload["text"] = message.body

        # Log the send attempt
        logger.info(
            "Sending email via Resend API: from=%s, to=%s, subject=%s",
            from_email,
            to_emails,
            message.subject,
        )

        # Make the API request
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(
                self.api_url,
                json=payload,
                headers=headers,
                timeout=getattr(settings, "EMAIL_TIMEOUT", 10),
            )
            response.raise_for_status()

            result = response.json()
            logger.info(
                "Email sent successfully via Resend: id=%s",
                result.get("id"),
            )

        except requests.exceptions.RequestException as e:
            error_msg = f"Resend API error: {e}"
            if hasattr(e, "response") and e.response is not None:
                try:
                    error_detail = e.response.json()
                    error_msg = f"Resend API error: {error_detail}"
                except Exception:
                    error_msg = f"Resend API error: {e.response.status_code} {e.response.text}"

            logger.error(error_msg)
            raise Exception(error_msg) from e

