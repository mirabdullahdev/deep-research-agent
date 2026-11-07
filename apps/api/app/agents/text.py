import re


def plain(text: str) -> str:
    text = re.sub(r"\s*—\s*", ", ", text)
    text = re.sub(r"\s+–\s+", ", ", text)
    return re.sub(r",\s*,", ",", text)


def strip_citations(text: str) -> str:
    return re.sub(r"[ \t]*(?:\[\d+\])+", "", text)
