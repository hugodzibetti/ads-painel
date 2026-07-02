import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.whatsapp_export import parse_export, synthetic_message_id


def test_parse_simple_message():
    text = "01/07/2026 10:15 - Maria: Prova de redes dia 10/07!!"
    messages = parse_export(text, "alunos")
    assert len(messages) == 1
    msg = messages[0]
    assert msg["group_label"] == "alunos"
    assert msg["author"] == "Maria"
    assert msg["raw_body"] == "Prova de redes dia 10/07!!"
    assert msg["media_ref"] is None
    assert msg["media_hidden"] is False
    assert msg["timestamp"].startswith("2026-07-01T13:15")  # 10:15 BRT -> 13:15 UTC


def test_parse_multiline_message():
    text = (
        "01/07/2026 10:15 - Maria: Primeira linha\n"
        "segunda linha continua aqui\n"
        "01/07/2026 10:16 - João: outra mensagem"
    )
    messages = parse_export(text, "alunos")
    assert len(messages) == 2
    assert messages[0]["raw_body"] == "Primeira linha\nsegunda linha continua aqui"
    assert messages[1]["author"] == "João"


def test_parse_system_line_discarded():
    text = (
        "01/07/2026 09:00 - +55 11 90000-0000 criou o grupo \"ADS\"\n"
        "01/07/2026 10:15 - Maria: mensagem real"
    )
    messages = parse_export(text, "alunos")
    assert len(messages) == 1
    assert messages[0]["author"] == "Maria"


def test_parse_media_oculta():
    text = "01/07/2026 10:15 - Maria: <Mídia oculta>"
    messages = parse_export(text, "alunos")
    assert messages[0]["media_ref"] is None
    assert messages[0]["media_hidden"] is True


def test_parse_arquivo_anexado():
    text = "01/07/2026 10:15 - Maria: ‎EDITAL-PROVA.pdf (arquivo anexado)"
    messages = parse_export(text, "profs")
    assert messages[0]["media_ref"] == "EDITAL-PROVA.pdf"
    assert messages[0]["media_hidden"] is False


def test_synthetic_message_id_deterministic():
    id1 = synthetic_message_id("alunos", "2026-07-01T13:15:00+00:00", "Maria", "corpo")
    id2 = synthetic_message_id("alunos", "2026-07-01T13:15:00+00:00", "Maria", "corpo")
    assert id1 == id2
    assert id1.startswith("import:")


def test_synthetic_message_id_differs_by_body():
    id1 = synthetic_message_id("alunos", "2026-07-01T13:15:00+00:00", "Maria", "corpo A")
    id2 = synthetic_message_id("alunos", "2026-07-01T13:15:00+00:00", "Maria", "corpo B")
    assert id1 != id2
