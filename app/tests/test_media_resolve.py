import sys
import tempfile
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import fitz
from lib.media_resolve import (
    classify_media,
    extract_pdf_text,
    render_pdf_first_page,
    resolve_pdf,
    resolve_image,
)


def make_test_pdf(text):
    fd, path = tempfile.mkstemp(suffix='.pdf')
    os.close(fd)
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    doc.save(path)
    doc.close()
    return path


def test_classify_media():
    assert classify_media('EDITAL.pdf') == 'pdf'
    assert classify_media('foto.JPG') == 'image'
    assert classify_media('foto.png') == 'image'
    assert classify_media('audio.opus') == 'audio'
    assert classify_media('video.mp4') == 'video'
    assert classify_media('figurinha.webp') == 'sticker'
    assert classify_media('planilha.xlsx') == 'other'


def test_extract_pdf_text_returns_text():
    path = make_test_pdf('Prova de Redes dia 10/07')
    try:
        text = extract_pdf_text(path)
        assert 'Prova de Redes' in text
    finally:
        os.unlink(path)


def test_render_pdf_first_page_returns_png_bytes():
    path = make_test_pdf('conteudo qualquer')
    try:
        png_bytes = render_pdf_first_page(path)
        assert png_bytes[:8] == b'\x89PNG\r\n\x1a\n'
    finally:
        os.unlink(path)


def test_resolve_pdf_uses_extracted_text_when_present():
    path = make_test_pdf('Edital de prova N3')
    try:
        result = resolve_pdf(path, caption_image_bytes_fn=lambda b, f: 'NUNCA DEVE SER CHAMADO')
        assert 'Edital de prova N3' in result
    finally:
        os.unlink(path)


def test_resolve_pdf_falls_back_to_vision_when_empty():
    fd, path = tempfile.mkstemp(suffix='.pdf')
    os.close(fd)
    doc = fitz.open()
    doc.new_page()  # blank page, no text
    doc.save(path)
    doc.close()
    try:
        result = resolve_pdf(path, caption_image_bytes_fn=lambda b, f: 'legenda da imagem')
        assert result == 'legenda da imagem'
    finally:
        os.unlink(path)


def test_resolve_image_calls_caption_fn_with_bytes_and_filename():
    fd, path = tempfile.mkstemp(suffix='.jpg')
    os.write(fd, b'fake-jpeg-bytes')
    os.close(fd)

    captured = {}

    def fake_caption(image_bytes, filename):
        captured['bytes'] = image_bytes
        captured['filename'] = filename
        return 'legenda'

    try:
        result = resolve_image(path, caption_image_bytes_fn=fake_caption)
        assert result == 'legenda'
        assert captured['bytes'] == b'fake-jpeg-bytes'
        assert captured['filename'] == Path(path).name
    finally:
        os.unlink(path)
