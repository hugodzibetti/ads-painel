import unicodedata

def normalize_title(title):
    """Normalize title for dedup: lowercase + remove accents."""
    title = title.lower()
    title = ''.join(
        c for c in unicodedata.normalize('NFD', title)
        if unicodedata.category(c) != 'Mn'
    )
    return title
