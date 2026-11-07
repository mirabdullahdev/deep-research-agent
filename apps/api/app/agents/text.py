import re

TITLE_MAX_CHARS = 160
HEADING_MAX_CHARS = 80
HEADING_MAX_WORDS = 10


def plain(text: str) -> str:
    text = re.sub(r"\s*—\s*", ", ", text)
    text = re.sub(r"\s+–\s+", ", ", text)
    return re.sub(r",\s*,", ",", text)


def strip_citations(text: str) -> str:
    return re.sub(r"[ \t]*(?:\[\d+\])+", "", text)


def _looks_like_heading(line: str) -> bool:
    return (
        3 <= len(line) <= HEADING_MAX_CHARS
        and len(line.split()) <= HEADING_MAX_WORDS
        and line[0].isupper()
        and line[-1] not in ".!?:;,"
        and line[0] not in "#>*|-0123456789"
    )


def ensure_headings(text: str) -> str:
    out: list[str] = []
    first = True
    previous_blank = True
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            previous_blank = True
            out.append(line)
            continue
        if first:
            first = False
            plain_title = not stripped.startswith("#") and len(stripped) <= TITLE_MAX_CHARS
            if plain_title and stripped[-1] not in ".!?":
                line = f"# {stripped}"
        elif previous_blank and _looks_like_heading(stripped):
            line = f"## {stripped}"
        previous_blank = False
        out.append(line)
    return "\n".join(out)
