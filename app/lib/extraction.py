import json
import re
import os
import logging
from datetime import datetime
from openai import OpenAI
from lib.db import (
    fetch_unprocessed_messages,
    fetch_unprocessed_count,
    mark_processed,
    insert_activities,
    check_duplicate_activity,
    insert_llm_usage,
)
from lib.prompts import get_system_prompt, build_user_prompt
from lib.text import normalize_title

logger = logging.getLogger(__name__)

def init_openai_client():
    """Initialize OpenAI client pointing to OpenCode."""
    api_key = os.getenv('OPENCODE_API_KEY')
    base_url = os.getenv('OPENCODE_BASE_URL', 'https://opencode.ai/zen/go/v1')
    model = os.getenv('OPENCODE_MODEL', 'deepseek-v4-flash')

    if not api_key:
        raise ValueError("OPENCODE_API_KEY is not set")

    return OpenAI(api_key=api_key, base_url=base_url), model

def extract_json_from_response(text):
    """Extract JSON object from LLM response, handling potential markdown wrapping."""
    # Try to find JSON block wrapped in markdown code fence
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
    if match:
        text = match.group(1).strip()

    # Try to parse as JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object pattern
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
    return None

def run_extraction(max_batches=10):
    """
    Extract activities from unprocessed messages.
    Processes up to max_batches * 30 messages per call.

    Returns:
        dict with keys:
            - total_tokens_used: int
            - activities_extracted: int
            - messages_processed: int
            - messages_remaining: int
            - errors: list of error messages
    """
    try:
        client, model = init_openai_client()
    except ValueError as e:
        return {
            "total_tokens_used": 0,
            "activities_extracted": 0,
            "messages_processed": 0,
            "messages_remaining": 0,
            "errors": [str(e)],
        }

    system_prompt = get_system_prompt()
    total_tokens = 0
    total_activities = 0
    total_messages_processed = 0
    errors = []

    for batch_num in range(max_batches):
        messages = fetch_unprocessed_messages(batch_size=30)
        if not messages:
            break

        message_ids = [msg['id'] for msg in messages]

        try:
            user_prompt = build_user_prompt(messages)

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
            )

            total_tokens += response.usage.prompt_tokens + response.usage.completion_tokens
            insert_llm_usage(model, response.usage.prompt_tokens, response.usage.completion_tokens, len(message_ids))

            response_text = response.choices[0].message.content

            data = extract_json_from_response(response_text)
            if not data or "items" not in data:
                logger.warning(f"Batch {batch_num + 1}: Invalid JSON response, marking as processed anyway")
                mark_processed(message_ids)
                total_messages_processed += len(message_ids)
                continue

            items = data.get("items", [])
            valid_items = []

            for item in items:
                # Validate required fields
                if not all(k in item for k in ["type", "title", "due_date", "source_message_id"]):
                    logger.warning(f"Item missing required fields: {item}")
                    continue

                # Validate source_message_id
                source_id = item["source_message_id"]
                if not isinstance(source_id, int) or source_id not in message_ids:
                    logger.warning(
                        f"Item source_message_id {source_id} not in batch, discarding"
                    )
                    continue

                # Validate type
                if item["type"] not in ["prova", "trabalho", "evento", "atividade"]:
                    logger.warning(f"Invalid type: {item['type']}")
                    continue

                # Validate confidence
                if item.get("confidence") not in ["alta", "media", "baixa"]:
                    item["confidence"] = "media"

                # Validate due_date format (ISO)
                try:
                    datetime.fromisoformat(item["due_date"])
                except ValueError:
                    logger.warning(f"Invalid due_date format: {item['due_date']}")
                    continue

                valid_items.append(item)

            # Dedup: check for similar existing activities
            deduplicated_items = []
            for item in valid_items:
                title_norm = normalize_title(item["title"])
                if check_duplicate_activity(item["type"], title_norm, item["due_date"]):
                    logger.info(f"Duplicate activity skipped: {item['title']}")
                    continue
                deduplicated_items.append(item)

            # Insert valid items
            if deduplicated_items:
                insert_activities(deduplicated_items)
                total_activities += len(deduplicated_items)

            # Mark batch as processed
            mark_processed(message_ids)
            total_messages_processed += len(message_ids)

        except Exception as e:
            error_msg = f"Batch {batch_num + 1} extraction error: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
            continue

    remaining = fetch_unprocessed_count()

    return {
        "total_tokens_used": total_tokens,
        "activities_extracted": total_activities,
        "messages_processed": total_messages_processed,
        "messages_remaining": remaining,
        "errors": errors,
    }
