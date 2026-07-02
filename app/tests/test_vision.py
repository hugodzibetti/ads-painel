import sys
import os
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.vision import init_vision_client, caption_image


def test_init_vision_client_raises_without_api_key():
    os.environ.pop('OPENCODE_API_KEY', None)
    try:
        init_vision_client()
        assert False, "should have raised"
    except ValueError as e:
        assert 'OPENCODE_API_KEY' in str(e)


def test_init_vision_client_uses_defaults():
    os.environ['OPENCODE_API_KEY'] = 'test-key'
    os.environ.pop('OPENCODE_VISION_BASE_URL', None)
    os.environ.pop('OPENCODE_VISION_MODEL', None)

    client, model = init_vision_client()

    assert model == 'claude-haiku-4-5'
    assert str(client.base_url).rstrip('/') == 'https://opencode.ai/zen/v1'


def test_caption_image_sends_base64_and_returns_content():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '  Edital de prova N3, entrega dia 10/07  '
    mock_client.chat.completions.create.return_value = mock_response

    result = caption_image(mock_client, 'claude-haiku-4-5', b'fake-image-bytes', 'foto.jpg')

    assert result == 'Edital de prova N3, entrega dia 10/07'
    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert call_kwargs['model'] == 'claude-haiku-4-5'
    content = call_kwargs['messages'][0]['content']
    image_url = next(part['image_url']['url'] for part in content if part['type'] == 'image_url')
    assert image_url.startswith('data:image/jpeg;base64,')
