import pytest
from backend.app.services.wiki_parser import parse_markdown, extract_wikilinks, extract_tags

def test_parse_markdown_frontmatter_and_links():
    content = """---
title: Test Concept Page
tags: [ai, machine-learning]
---

# Test Concept Page

This is a test document explaining [[Vector Search]] and [[RAG Systems|Retrieval-Augmented Generation]].
It also has #neural-networks tag and a code block:

```python
# This is a comment [[Not A Link]] and #not-a-tag
print("Hello")
```

See also [[concepts/deep-learning.md]].
"""
    parsed = parse_markdown(content, fallback_name="fallback")
    assert parsed.title == "Test Concept Page"
    assert "ai" in parsed.tags
    assert "machine-learning" in parsed.tags
    assert "neural-networks" in parsed.tags
    assert "not-a-tag" not in parsed.tags

    targets = [link["target"] for link in parsed.outgoing_links]
    assert "Vector Search" in targets
    assert "RAG Systems" in targets
    assert "concepts/deep-learning.md" in targets
    assert "Not A Link" not in targets
    assert parsed.word_count > 10

def test_extract_wikilinks_with_aliases():
    text = "Check out [[Deep Research|Autonomous Agent]] for more details."
    links = extract_wikilinks(text)
    assert len(links) == 1
    assert links[0]["target"] == "Deep Research"
    assert links[0]["label"] == "Autonomous Agent"
