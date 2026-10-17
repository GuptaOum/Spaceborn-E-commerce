from app.stream_filter import ThinkingFilter


def run(chunks: list[str]) -> str:
    f = ThinkingFilter()
    return "".join(f.feed(c) for c in chunks) + f.flush()


def test_passes_plain_text():
    assert run(["Hello ", "world"]) == "Hello world"


def test_removes_span_in_one_chunk():
    assert run(["<thinking>plan the search</thinking>Here you go"]) == "Here you go"


def test_removes_span_split_across_chunks_and_tags():
    assert run(["<thin", "king>secret", " plan</thi", "nking>\n\nAnswer", " text"]) == "Answer text"


def test_keeps_text_around_mid_span():
    assert run(["Sure. <thinking>x</thinking>Done."]) == "Sure. Done."


def test_unclosed_span_is_dropped_on_flush():
    assert run(["Visible <thinking>never closed"]) == "Visible "


def test_lone_angle_bracket_is_not_swallowed():
    assert run(["Use 3.3V <", " 5V"]) == "Use 3.3V < 5V"


def test_partial_tag_at_end_is_released_on_flush():
    assert run(["a <thin"]) == "a <thin"
