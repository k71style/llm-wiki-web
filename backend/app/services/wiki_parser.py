import re
from typing import Any, Tuple
import frontmatter

WIKILINK_REGEX = re.compile(r'\[\[(.*?)\]\]')
HASHTAG_REGEX = re.compile(r'(?<!\w)#([a-zA-Z0-9_\-\uac00-\ud7a3]+)')
HEADING_REGEX = re.compile(r'^#\s+(.+)$', re.MULTILINE)
CODE_BLOCK_REGEX = re.compile(r'```[\s\S]*?```')
INLINE_CODE_REGEX = re.compile(r'`[^`]+`')

class ParsedPage:
    def __init__(
        self,
        title: str,
        content: str,
        raw_content: str,
        frontmatter_data: dict[str, Any],
        tags: list[str],
        outgoing_links: list[dict[str, str]], # [{"target": "...", "label": "...", "snippet": "..."}]
        word_count: int
    ):
        self.title = title
        self.content = content
        self.raw_content = raw_content
        self.frontmatter_data = frontmatter_data
        self.tags = tags
        self.outgoing_links = outgoing_links
        self.word_count = word_count

def clean_text_for_parsing(text: str) -> str:
    """Removes fenced code blocks so code comments don't trigger false positive links or tags."""
    return CODE_BLOCK_REGEX.sub('', text)

def extract_title(text: str, frontmatter_data: dict[str, Any], fallback_name: str) -> str:
    # 1. Frontmatter
    if "title" in frontmatter_data and str(frontmatter_data["title"]).strip():
        return str(frontmatter_data["title"]).strip()
    
    # 2. First H1 (# Heading)
    heading_match = HEADING_REGEX.search(text)
    if heading_match:
        return heading_match.group(1).strip()
    
    # 3. Fallback to file basename
    clean_name = fallback_name.replace("-", " ").replace("_", " ")
    return clean_name.title()

def extract_tags(text: str, frontmatter_data: dict[str, Any]) -> list[str]:
    tags_set = set()
    
    # From frontmatter
    fm_tags = frontmatter_data.get("tags") or frontmatter_data.get("tag")
    if isinstance(fm_tags, list):
        for t in fm_tags:
            if t:
                tags_set.add(str(t).strip().lstrip("#"))
    elif isinstance(fm_tags, str):
        for t in fm_tags.split(","):
            if t.strip():
                tags_set.add(t.strip().lstrip("#"))
                
    # From body text (outside code blocks)
    clean = clean_text_for_parsing(text)
    for match in HASHTAG_REGEX.finditer(clean):
        tag = match.group(1).strip()
        # Avoid treating hex colors or pure numbers as tags
        if not re.match(r'^[0-9a-fA-F]{3,8}$', tag) and not tag.isdigit():
            tags_set.add(tag)
            
    return sorted(list(tags_set))

def extract_wikilinks(text: str) -> list[dict[str, str]]:
    links = []
    clean = clean_text_for_parsing(text)
    lines = clean.split('\n')
    
    for line in lines:
        for match in WIKILINK_REGEX.finditer(line):
            raw_link = match.group(1).strip()
            if not raw_link:
                continue
                
            if '|' in raw_link:
                target, label = raw_link.split('|', 1)
                target = target.strip()
                label = label.strip()
            else:
                target = raw_link
                label = raw_link
                
            # Clean snippet from line
            snippet = line.strip()
            if len(snippet) > 150:
                snippet = snippet[:147] + "..."
                
            links.append({
                "target": target,
                "label": label,
                "snippet": snippet
            })
            
    return links

def parse_markdown(raw_content: str, fallback_name: str = "Untitled") -> ParsedPage:
    try:
        post = frontmatter.loads(raw_content)
        fm_data = post.metadata or {}
        content = post.content
    except Exception:
        fm_data = {}
        content = raw_content

    title = extract_title(content, fm_data, fallback_name)
    tags = extract_tags(content, fm_data)
    outgoing_links = extract_wikilinks(content)
    
    # Calculate word count (English words + CJK characters)
    words = len(re.findall(r'[\w\uac00-\ud7a3]+', content))

    return ParsedPage(
        title=title,
        content=content,
        raw_content=raw_content,
        frontmatter_data=fm_data,
        tags=tags,
        outgoing_links=outgoing_links,
        word_count=words
    )
