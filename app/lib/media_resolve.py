from pathlib import Path
import fitz

_EXTENSION_MAP = {
    '.pdf': 'pdf',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.opus': 'audio',
    '.mp4': 'video',
    '.webp': 'sticker',
}


def classify_media(filename):
    """Classify a media filename by extension into a coarse processing category."""
    return _EXTENSION_MAP.get(Path(filename).suffix.lower(), 'other')


def extract_pdf_text(path):
    """Extract text from all pages of a PDF. Returns '' if there is no extractable text."""
    doc = fitz.open(path)
    try:
        return '\n'.join(page.get_text() for page in doc).strip()
    finally:
        doc.close()


def render_pdf_first_page(path):
    """Render the first page of a PDF to PNG bytes, for vision fallback on scanned PDFs."""
    doc = fitz.open(path)
    try:
        pixmap = doc[0].get_pixmap()
        return pixmap.tobytes('png')
    finally:
        doc.close()


def resolve_pdf(path, caption_image_bytes_fn):
    """Resolve a PDF to text: extracted text if present, else a vision caption of page 1."""
    text = extract_pdf_text(path)
    if text:
        return text
    png_bytes = render_pdf_first_page(path)
    return caption_image_bytes_fn(png_bytes, f'{Path(path).stem}-page1.png')


def resolve_image(path, caption_image_bytes_fn):
    """Resolve an image file to a short text caption via the injected vision function."""
    image_bytes = Path(path).read_bytes()
    return caption_image_bytes_fn(image_bytes, Path(path).name)
