from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.theme import get_urgency
from datetime import date, timedelta


def _iso(days_offset):
    return (date.today() + timedelta(days=days_offset)).isoformat()


def test_overdue_is_red():
    emoji, label, bg, fg = get_urgency(_iso(-2))
    assert label == "Atrasado"
    assert emoji == "🔴"


def test_today_is_orange():
    _, label, _, _ = get_urgency(_iso(0))
    assert label == "Hoje"


def test_within_three_days_is_yellow():
    for offset in (1, 2, 3):
        _, label, _, _ = get_urgency(_iso(offset))
        assert label == "Esta semana"


def test_far_future_is_calm_gray():
    _, label, bg, fg = get_urgency(_iso(10))
    assert label == "Tranquilo"
    assert bg == "#F4F4F5"


def test_unparseable_date_is_neutral():
    _, label, _, _ = get_urgency(None)
    assert label == "Sem prazo"

    _, label, _, _ = get_urgency("not-a-date")
    assert label == "Sem prazo"
