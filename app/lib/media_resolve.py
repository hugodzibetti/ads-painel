from pathlib import Path
import fitz
import shutil
import subprocess
import tempfile

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


def pick_whisper_device():
    """Pick the fastest available faster-whisper device/compute_type without requiring torch."""
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return 'cuda', 'float16'
    except Exception:
        pass
    return 'cpu', 'int8'


def resolve_audio(path, whisper_model):
    """Transcribe an audio file locally via an injected faster-whisper model instance."""
    segments, _info = whisper_model.transcribe(str(path))
    return ' '.join(segment.text for segment in segments).strip()


def extract_audio_track(video_path, output_wav_path):
    """Extract the audio track of a video to a 16kHz mono WAV via ffmpeg."""
    if shutil.which('ffmpeg') is None:
        raise RuntimeError(
            'ffmpeg não encontrado no PATH — instale com "apt install ffmpeg" antes de importar vídeos.'
        )
    result = subprocess.run(
        ['ffmpeg', '-y', '-i', str(video_path), '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', str(output_wav_path)],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f'ffmpeg falhou ao extrair áudio de {video_path}: {result.stderr.decode(errors="replace")}')


def resolve_video(path, whisper_model):
    """Resolve a video file to text by transcribing its audio track; visual frames are ignored."""
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / 'audio.wav'
        extract_audio_track(path, wav_path)
        return resolve_audio(wav_path, whisper_model)
