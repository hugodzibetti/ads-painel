import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.prompts import get_system_prompt, build_user_prompt


def test_get_system_prompt():
    """Test system prompt generation."""
    prompt = get_system_prompt()
    assert prompt is not None
    assert len(prompt) > 0
    assert 'Você é um assistente' in prompt
    assert 'atividades acadêmicas' in prompt
    assert 'prova' in prompt
    assert 'trabalho' in prompt
    assert 'evento' in prompt
    assert 'atividade' in prompt
    assert 'JSON' in prompt


def test_get_system_prompt_contains_instructions():
    """Test that system prompt contains critical instructions."""
    prompt = get_system_prompt()
    assert 'Datas Relativas' in prompt
    assert 'Tipos Válidos' in prompt
    assert 'Confiança' in prompt
    assert 'Formato de Saída' in prompt
    assert 'PADRÕES A IGNORAR' in prompt
    assert 'PADRÕES A PRIORIZAR' in prompt


def test_build_user_prompt_empty():
    """Test building user prompt with no messages."""
    prompt = build_user_prompt([])
    assert prompt is not None
    assert len(prompt) > 0
    assert 'Data/hora atual' in prompt
    assert 'mensagens' in prompt.lower()
    assert 'JSON' in prompt


def test_build_user_prompt_single_message():
    """Test building user prompt with one message."""
    messages = [
        {
            'id': 1,
            'group_label': 'alunos',
            'author': 'João',
            'body': 'Prova de redes amanhã?',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    ]

    prompt = build_user_prompt(messages)
    assert prompt is not None
    assert '[id=1]' in prompt
    assert '[alunos]' in prompt
    assert 'João' in prompt
    assert 'Prova de redes amanhã?' in prompt


def test_build_user_prompt_multiple_messages():
    """Test building user prompt with multiple messages."""
    messages = [
        {
            'id': 1,
            'group_label': 'alunos',
            'author': 'João',
            'body': 'Prova de redes na sexta',
            'timestamp': datetime.now(timezone.utc).isoformat()
        },
        {
            'id': 2,
            'group_label': 'profs',
            'author': 'Prof. Silva',
            'body': 'Trabalho entrega até terça',
            'timestamp': datetime.now(timezone.utc).isoformat()
        },
        {
            'id': 3,
            'group_label': 'alunos',
            'author': 'Maria',
            'body': 'Alguém sabe as respostas?',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    ]

    prompt = build_user_prompt(messages)
    assert prompt is not None
    assert '[id=1]' in prompt
    assert '[id=2]' in prompt
    assert '[id=3]' in prompt
    assert 'João' in prompt
    assert 'Prof. Silva' in prompt
    assert 'Maria' in prompt


def test_build_user_prompt_contains_json_format():
    """Test that user prompt includes JSON format instructions."""
    messages = [
        {
            'id': 1,
            'group_label': 'alunos',
            'author': 'João',
            'body': 'Prova de redes',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    ]

    prompt = build_user_prompt(messages)
    assert 'JSON válido' in prompt
    assert '"items"' in prompt
    assert '"type"' in prompt
    assert '"title"' in prompt
    assert '"due_date"' in prompt
    assert '"source_message_id"' in prompt
    assert '"confidence"' in prompt


def test_build_user_prompt_handles_invalid_timestamp():
    """Regression test: a malformed timestamp must not blow up the whole batch."""
    messages = [
        {
            'id': 1,
            'group_label': 'alunos',
            'author': 'João',
            'body': 'Prova de redes na sexta',
            'timestamp': 'not-a-date'
        },
        {
            'id': 2,
            'group_label': 'profs',
            'author': 'Prof. Silva',
            'body': 'Trabalho entrega até terça',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    ]

    prompt = build_user_prompt(messages)
    assert prompt is not None
    assert '[id=1]' in prompt
    assert '[id=2]' in prompt
    assert 'Prova de redes na sexta' in prompt
    assert 'Trabalho entrega até terça' in prompt


def test_build_user_prompt_date_context():
    """Test that user prompt includes date/time context."""
    messages = [
        {
            'id': 1,
            'group_label': 'alunos',
            'author': 'João',
            'body': 'Teste',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    ]

    prompt = build_user_prompt(messages)
    assert 'Data/hora atual' in prompt
    assert 'America/Sao_Paulo' in prompt


if __name__ == '__main__':
    test_get_system_prompt()
    print("✓ test_get_system_prompt")

    test_get_system_prompt_contains_instructions()
    print("✓ test_get_system_prompt_contains_instructions")

    test_build_user_prompt_empty()
    print("✓ test_build_user_prompt_empty")

    test_build_user_prompt_single_message()
    print("✓ test_build_user_prompt_single_message")

    test_build_user_prompt_multiple_messages()
    print("✓ test_build_user_prompt_multiple_messages")

    test_build_user_prompt_handles_invalid_timestamp()
    print("✓ test_build_user_prompt_handles_invalid_timestamp")

    test_build_user_prompt_contains_json_format()
    print("✓ test_build_user_prompt_contains_json_format")

    test_build_user_prompt_date_context()
    print("✓ test_build_user_prompt_date_context")

    print("\nAll tests passed!")
