"""Convert markdown content to TipTap-friendly HTML.

TipTap (ProseMirror) expects HTML, not raw markdown.  When agents or
webhooks push markdown, this helper ensures the editor renders
paragraphs, headings, code blocks, and lists correctly.
"""

import re

_FULL_WIDTH_SPACE = "\u3000"  # 전각 공백 (Munpia indent)


def _is_html(text: str) -> bool:
    """Heuristic: content already looks like HTML."""
    stripped = text.strip()
    return stripped.startswith("<") and ("</p>" in stripped or "</h" in stripped or "</div>" in stripped)


def md_to_html(content: str) -> str:
    """Best-effort markdown → HTML for TipTap rendering.

    If *content* already looks like HTML it is returned as-is.
    """
    if not content or not content.strip():
        return "<p></p>"

    if _is_html(content):
        return content

    # Strip full-width spaces (Munpia formatting)
    content = content.replace(_FULL_WIDTH_SPACE, "")

    lines = content.split("\n")
    parts: list[str] = []
    in_code = False
    code_buf: list[str] = []

    for line in lines:
        # --- code fences ---
        if line.strip().startswith("```"):
            if in_code:
                parts.append("<pre><code>" + "\n".join(code_buf) + "</code></pre>")
                code_buf.clear()
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_buf.append(line)
            continue

        stripped = line.strip()

        # empty → spacer (deduplicated)
        if not stripped:
            if parts and parts[-1] != "<p><br></p>":
                parts.append("<p><br></p>")
            continue

        # horizontal rule
        if stripped in ("***", "* * *", "---"):
            parts.append("<hr>")
            continue

        # headings
        for level in (3, 2, 1):
            prefix = "#" * level + " "
            if stripped.startswith(prefix):
                parts.append(f"<h{level}>{_inline(stripped[len(prefix):])}</h{level}>")
                break
        else:
            # table rows → render as plain text paragraphs
            if stripped.startswith("|") and stripped.endswith("|"):
                cells = [c.strip() for c in stripped.strip("|").split("|")]
                if all(set(c) <= set("- :") for c in cells):
                    continue  # skip separator row
                parts.append("<p>" + " · ".join(_inline(c) for c in cells if c) + "</p>")
                continue

            # list items
            if stripped.startswith("- "):
                parts.append(f"<ul><li>{_inline(stripped[2:])}</li></ul>")
                continue

            # numbered list
            m = re.match(r"^(\d+)\.\s+", stripped)
            if m:
                parts.append(f"<ol start=\"{m.group(1)}\"><li>{_inline(stripped[m.end():])}</li></ol>")
                continue

            # default paragraph
            parts.append(f"<p>{_inline(stripped)}</p>")

    # close any open code block
    if in_code and code_buf:
        parts.append("<pre><code>" + "\n".join(code_buf) + "</code></pre>")

    return "\n".join(parts)


def _inline(text: str) -> str:
    """Handle inline formatting: bold, code, italic."""
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return text
