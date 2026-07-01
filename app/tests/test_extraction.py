import json
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.extraction import (
    normalize_title,
    extract_json_from_response,
)


def test_normalize_title():
    """Test title normalization."""
    assert normalize_title('Prova de Redes') == 'prova de redes'
    assert normalize_title('PROVA DE REDES') == 'prova de redes'

    assert normalize_title('Prova de Cálculo') == 'prova de calculo'
    assert normalize_title('Programação') == 'programacao'

    assert normalize_title('Prova') == 'prova'
    assert normalize_title('Prova de Pré-Cálculo') == 'prova de pre-calculo'


def test_extract_json_from_response_plain_json():
    """Test extracting plain JSON from response."""
    response = '{"items": [{"type": "prova", "title": "Test"}]}'
    result = extract_json_from_response(response)
    assert result is not None
    assert result['items'][0]['type'] == 'prova'


def test_extract_json_from_response_with_markdown():
    """Test extracting JSON from markdown code fence."""
    response = '```json\n{"items": [{"type": "prova"}]}\n```'
    result = extract_json_from_response(response)
    assert result is not None
    assert result['items'][0]['type'] == 'prova'


def test_extract_json_from_response_with_markdown_no_lang():
    """Test extracting JSON from markdown code fence without language."""
    response = '```\n{"items": [{"type": "trabalho"}]}\n```'
    result = extract_json_from_response(response)
    assert result is not None
    assert result['items'][0]['type'] == 'trabalho'


def test_extract_json_from_response_with_text_before():
    """Test extracting JSON with text before it."""
    response = 'Here is the analysis:\n```json\n{"items": []}\n```'
    result = extract_json_from_response(response)
    assert result is not None
    assert result['items'] == []


def test_extract_json_from_response_invalid():
    """Test handling invalid JSON."""
    response = 'This is not JSON'
    result = extract_json_from_response(response)
    assert result is None


def test_extract_json_from_response_with_nested():
    """Test extracting complex nested JSON."""
    response = '''```json
{
  "items": [
    {
      "type": "prova",
      "title": "Prova de Redes",
      "description": "Com conteúdo especial",
      "due_date": "2026-07-10",
      "source_message_id": 123,
      "confidence": "alta"
    }
  ]
}
```'''
    result = extract_json_from_response(response)
    assert result is not None
    assert len(result['items']) == 1
    assert result['items'][0]['title'] == 'Prova de Redes'
    assert result['items'][0]['source_message_id'] == 123


def test_extract_json_multiple_items():
    """Test extracting multiple items."""
    response = '''
{
  "items": [
    {"type": "prova", "title": "Prova 1", "due_date": "2026-07-10", "source_message_id": 1},
    {"type": "trabalho", "title": "Trabalho 1", "due_date": "2026-07-20", "source_message_id": 2},
    {"type": "evento", "title": "Evento 1", "due_date": "2026-08-01", "source_message_id": 3}
  ]
}
'''
    result = extract_json_from_response(response)
    assert result is not None
    assert len(result['items']) == 3
    assert result['items'][0]['type'] == 'prova'
    assert result['items'][1]['type'] == 'trabalho'
    assert result['items'][2]['type'] == 'evento'


if __name__ == '__main__':
    test_normalize_title()
    print("✓ test_normalize_title")

    test_extract_json_from_response_plain_json()
    print("✓ test_extract_json_from_response_plain_json")

    test_extract_json_from_response_with_markdown()
    print("✓ test_extract_json_from_response_with_markdown")

    test_extract_json_from_response_with_markdown_no_lang()
    print("✓ test_extract_json_from_response_with_markdown_no_lang")

    test_extract_json_from_response_with_text_before()
    print("✓ test_extract_json_from_response_with_text_before")

    test_extract_json_from_response_invalid()
    print("✓ test_extract_json_from_response_invalid")

    test_extract_json_from_response_with_nested()
    print("✓ test_extract_json_from_response_with_nested")

    test_extract_json_multiple_items()
    print("✓ test_extract_json_multiple_items")

    print("\nAll tests passed!")
