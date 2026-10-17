"""Removes <thinking>...</thinking> spans that Nova models emit around tool use, across chunk boundaries."""

OPEN = "<thinking>"
CLOSE = "</thinking>"


def _partial_suffix(text: str, tag: str) -> int:
    """Length of the longest tail of `text` that is a proper prefix of `tag`."""
    for k in range(min(len(tag) - 1, len(text)), 0, -1):
        if text.endswith(tag[:k]):
            return k
    return 0


class ThinkingFilter:
    def __init__(self) -> None:
        self._buf = ""
        self._inside = False
        self._started = False

    def feed(self, text: str) -> str:
        self._buf += text
        out: list[str] = []
        while True:
            tag = CLOSE if self._inside else OPEN
            idx = self._buf.find(tag)
            if idx >= 0:
                if not self._inside:
                    out.append(self._buf[:idx])
                self._buf = self._buf[idx + len(tag):]
                self._inside = not self._inside
                continue
            keep = _partial_suffix(self._buf, tag)
            if not self._inside:
                out.append(self._buf[: len(self._buf) - keep])
            self._buf = self._buf[len(self._buf) - keep:]
            break
        return self._trim_start("".join(out))

    def flush(self) -> str:
        rest = "" if self._inside else self._buf
        self._buf = ""
        self._inside = False
        return self._trim_start(rest)

    def _trim_start(self, text: str) -> str:
        # Whitespace left behind by a removed span at the very start would render as a blank line.
        if not self._started:
            text = text.lstrip()
            if text:
                self._started = True
        return text
