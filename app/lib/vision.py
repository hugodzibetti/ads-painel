import base64
import os
import re
from pathlib import Path
from openai import OpenAI

_MIME_BY_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
}


def init_vision_client():
    """Initialize a separate OpenAI-compatible client for image captioning (not the live text pipeline's client)."""
    api_key = os.getenv('OPENCODE_API_KEY')
    base_url = os.getenv('OPENCODE_VISION_BASE_URL', 'https://opencode.ai/zen/go/v1')
    model = os.getenv('OPENCODE_VISION_MODEL', 'kimi-k2.7-code')

    if not api_key:
        raise ValueError("OPENCODE_API_KEY is not set")

    return OpenAI(api_key=api_key, base_url=base_url, timeout=60.0, max_retries=1), model


def caption_image(client, model, image_bytes, filename):
    """Ask a vision-capable model for a short caption focused on academic deadlines."""
    mime = _MIME_BY_EXT.get(Path(filename).suffix.lower(), 'image/jpeg')
    b64 = base64.b64encode(image_bytes).decode('ascii')
    response = client.chat.completions.create(
        model=model,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "Descreva objetivamente esta imagem em até 2 frases, focando em datas, "
                        "prazos e avisos acadêmicos, se houver. Se for irrelevante (ex: meme, foto "
                        "pessoal), diga apenas 'imagem sem conteúdo acadêmico relevante'."
                    ),
                },
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ],
        }],
        max_tokens=150,
    )
    content = response.choices[0].message.content.strip()
    content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
    return content
