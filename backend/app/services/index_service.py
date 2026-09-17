import math
import re
import logging
from collections import Counter
from typing import Optional
from backend.app.db.database import db
from backend.app.models.schemas import SearchResultItem
import json

logger = logging.getLogger("llm_wiki.index_service")

def tokenize(text: str) -> list[str]:
    # Extract alphanumeric and Korean/CJK terms
    return [t.lower() for t in re.findall(r'[\w\uac00-\ud7a3]+', text) if len(t) > 1]

def compute_tf_idf_similarity(query: str, doc_content: str, corpus_docs: list[str]) -> float:
    q_tokens = tokenize(query)
    if not q_tokens:
        return 0.0
        
    doc_tokens = tokenize(doc_content)
    if not doc_tokens:
        return 0.0
        
    doc_len = len(doc_tokens)
    doc_counter = Counter(doc_tokens)
    num_docs = max(len(corpus_docs), 1)
    
    score = 0.0
    for qt in q_tokens:
        tf = doc_counter[qt] / doc_len
        # Document frequency
        df = sum(1 for d in corpus_docs if qt in d.lower())
        idf = math.log((num_docs + 1) / (df + 1)) + 1.0
        score += tf * idf
        
    return score

class IndexService:
    async def search(
        self,
        topic_id: str,
        query: str,
        mode: str = "hybrid",  # "keyword" | "semantic" | "hybrid"
        limit: int = 15
    ) -> list[SearchResultItem]:
        query = query.strip()
        if not query:
            return []

        database = await db.get_db()
        
        # 1. Keyword Search via FTS5
        keyword_results: list[SearchResultItem] = []
        try:
            # Escape query for FTS5 (support simple terms or prefix)
            clean_query = " ".join([f'"{term}"*' for term in re.findall(r'[\w\uac00-\ud7a3]+', query)])
            if not clean_query:
                clean_query = f'"{query}"'
                
            async with database.execute("""
                SELECT 
                    f.page_id, f.topic_id, f.title, f.tags,
                    snippet(pages_fts, 1, '<mark>', '</mark>', '...', 25) as snippet,
                    rank,
                    p.path
                FROM pages_fts f
                JOIN pages p ON f.page_id = p.id
                WHERE f.topic_id = ? AND pages_fts MATCH ?
                ORDER BY rank
                LIMIT ?
            """, (topic_id, clean_query, limit * 2)) as cursor:
                rows = await cursor.fetchall()
                for rank_idx, r in enumerate(rows):
                    tags = []
                    try:
                        tags = json.loads(r["tags"]) if r["tags"].startswith("[") else r["tags"].split()
                    except Exception:
                        tags = r["tags"].split() if r["tags"] else []
                        
                    keyword_results.append(SearchResultItem(
                        page_id=r["page_id"],
                        topic_id=r["topic_id"],
                        path=r["path"],
                        title=r["title"],
                        snippet=r["snippet"] or "",
                        score=float(1.0 / (rank_idx + 1)),
                        match_type="keyword",
                        tags=tags
                    ))
        except Exception as e:
            logger.warning(f"FTS5 search error: {e}")

        if mode == "keyword":
            return keyword_results[:limit]

        # 2. Semantic Vector / TF-IDF Similarity Search
        semantic_results: list[SearchResultItem] = []
        async with database.execute("""
            SELECT f.page_id, f.topic_id, f.title, f.content, f.tags, p.path
            FROM pages_fts f
            JOIN pages p ON f.page_id = p.id
            WHERE f.topic_id = ?
        """, (topic_id,)) as cursor:
            all_pages = await cursor.fetchall()

        if all_pages:
            corpus = [r["content"] for r in all_pages]
            scored_pages = []
            for r in all_pages:
                sim = compute_tf_idf_similarity(query, r["content"] + " " + r["title"], corpus)
                if sim > 0:
                    scored_pages.append((sim, r))
            
            scored_pages.sort(key=lambda x: x[0], reverse=True)
            for sim, r in scored_pages[:limit * 2]:
                tags = []
                try:
                    tags = json.loads(r["tags"]) if r["tags"].startswith("[") else r["tags"].split()
                except Exception:
                    tags = r["tags"].split() if r["tags"] else []
                    
                snippet = r["content"][:180].replace("\n", " ") + "..."
                semantic_results.append(SearchResultItem(
                    page_id=r["page_id"],
                    topic_id=r["topic_id"],
                    path=r["path"],
                    title=r["title"],
                    snippet=snippet,
                    score=float(sim),
                    match_type="semantic",
                    tags=tags
                ))

        if mode == "semantic":
            return semantic_results[:limit]

        # 3. Hybrid Search: Reciprocal Rank Fusion (RRF)
        rrf_scores: dict[str, float] = {}
        page_dict: dict[str, SearchResultItem] = {}

        k = 60
        for rank, item in enumerate(keyword_results):
            rrf_scores[item.page_id] = rrf_scores.get(item.page_id, 0.0) + (1.0 / (k + rank + 1))
            page_dict[item.page_id] = item

        for rank, item in enumerate(semantic_results):
            rrf_scores[item.page_id] = rrf_scores.get(item.page_id, 0.0) + (1.0 / (k + rank + 1))
            if item.page_id not in page_dict:
                page_dict[item.page_id] = item
            else:
                # Combined match
                page_dict[item.page_id].match_type = "hybrid"

        sorted_pages = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        final_results = []
        for page_id, score in sorted_pages[:limit]:
            item = page_dict[page_id]
            item.score = round(score, 4)
            final_results.append(item)

        return final_results

index_service = IndexService()
