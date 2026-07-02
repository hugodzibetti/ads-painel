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

    assert model == 'kimi-k2.7-code'
    assert str(client.base_url).rstrip('/') == 'https://opencode.ai/zen/go/v1'


def test_caption_image_sends_base64_and_returns_content():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '  Edital de prova N3, entrega dia 10/07  '
    mock_client.chat.completions.create.return_value = mock_response

    result = caption_image(mock_client, 'kimi-k2.7-code', b'fake-image-bytes', 'foto.jpg')

    assert result == 'Edital de prova N3, entrega dia 10/07'
    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert call_kwargs['model'] == 'kimi-k2.7-code'
    content = call_kwargs['messages'][0]['content']
    image_url = next(part['image_url']['url'] for part in content if part['type'] == 'image_url')
    assert image_url.startswith('data:image/jpeg;base64,')


def test_caption_image_strips_think_tags():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '<think>\nO usuário quer saber a cor.\n</think>\nEdital de prova N3'
    mock_client.chat.completions.create.return_value = mock_response

    result = caption_image(mock_client, 'minimax-m3', b'fake-image-bytes', 'foto.jpg')

    assert result == 'Edital de prova N3'


def make_response(content):
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = content
    return response


def test_caption_image_retries_on_empty_content():
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        make_response(''),
        make_response(None),
        make_response('Prova de Redes dia 15/07'),
    ]

    result = caption_image(mock_client, 'kimi-k2.7-code', b'fake-image-bytes', 'foto.jpg')

    assert result == 'Prova de Redes dia 15/07'
    assert mock_client.chat.completions.create.call_count == 3


def test_caption_image_raises_after_all_attempts_empty():
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = make_response('')

    try:
        caption_image(mock_client, 'kimi-k2.7-code', b'fake-image-bytes', 'foto.jpg', max_attempts=3)
        assert False, "should have raised"
    except RuntimeError as e:
        assert 'vazio' in str(e)
    assert mock_client.chat.completions.create.call_count == 3
