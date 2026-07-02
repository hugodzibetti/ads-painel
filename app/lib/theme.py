import streamlit as st
from datetime import datetime, date

TEXT = "#27272A"
TEXT_MUTED = "#71717A"
BORDER = "#E4E4E7"
BG_SECONDARY = "#FAFAF9"

# (max days-until this tier applies, emoji, label, background, foreground)
# Calm states stay neutral gray; color is reserved for what needs attention.
_URGENCY_TIERS = [
    (-1, "🔴", "Atrasado", "#FEF2F2", "#B42318"),
    (0, "🟠", "Hoje", "#FFF7ED", "#B45309"),
    (3, "🟡", "Esta semana", "#FEFCE8", "#854D0E"),
]
_URGENCY_CALM = ("⚪", "Tranquilo", "#F4F4F5", "#71717A")
_URGENCY_UNKNOWN = ("⚪", "Sem prazo", "#F4F4F5", "#A1A1AA")


def get_urgency(due_date_str):
    """Returns (emoji, label, bg, fg) for a due_date string (YYYY-MM-DD or ISO).

    Unparseable/missing dates fall back to a neutral 'Sem prazo' badge.
    """
    try:
        due_date = datetime.fromisoformat(due_date_str).date()
    except (ValueError, AttributeError, TypeError):
        return _URGENCY_UNKNOWN

    days_until = (due_date - date.today()).days
    for threshold, emoji, label, bg, fg in _URGENCY_TIERS:
        if days_until <= threshold:
            return (emoji, label, bg, fg)
    return _URGENCY_CALM


def urgency_badge_html(due_date_str):
    """Renders an urgency badge as an HTML string for st.markdown(unsafe_allow_html=True)."""
    emoji, label, bg, fg = get_urgency(due_date_str)
    return f'<span class="urgency-badge" style="background:{bg};color:{fg};">{emoji} {label}</span>'


def inject_css():
    """Injects the shared grayscale visual theme. Call once near the top of each page."""
    st.markdown(
        """
        <style>
        .urgency-badge {
            font-size: 12px;
            font-weight: 600;
            padding: 2px 10px;
            border-radius: 999px;
            display: inline-block;
            white-space: nowrap;
        }
        div[data-testid="stVerticalBlockBorderWrapper"] {
            border-radius: 10px !important;
            border-color: #E4E4E7 !important;
        }
        div[data-testid="stMetric"] {
            background: #FAFAF9;
            border: 1px solid #E4E4E7;
            border-radius: 10px;
            padding: 12px 16px;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
