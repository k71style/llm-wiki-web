"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import mermaid from "mermaid";
import { Edit3, Clock, Tag, ExternalLink, ArrowLeftRight } from "lucide-react";
import { PageDetail } from "@/types";
import { BacklinksContent } from "./backlinks-panel";

interface WikiViewerProps {
  page: PageDetail;
  onEdit: () => void;
  onNavigateWikilink: (target: string) => void;
}

export function WikiViewer({
  page,
  onEdit,
  onNavigateWikilink,
}: WikiViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
    });
    
    // Render mermaid diagrams
    if (containerRef.current) {
      const codeBlocks = containerRef.current.querySelectorAll("pre code.language-mermaid");
      codeBlocks.forEach((block, index) => {
        const id = `mermaid-${index}-${Date.now()}`;
        const graphDefinition = block.textContent || "";
        const parent = block.parentElement;
        if (parent && graphDefinition.trim()) {
          const div = document.createElement("div");
          div.id = id;
          div.className = "mermaid flex justify-center my-4 overflow-x-auto";
          div.textContent = graphDefinition;
          parent.replaceWith(div);
          mermaid.run({ nodes: [div] }).catch((err) => {
            console.warn("Mermaid render error:", err);
          });
        }
      });
    }
  }, [page.content]);

  // Transform [[wikilinks]] to clickable HTML or markdown format
  const processWikilinks = (content: string) => {
    return content.replace(/\[\[(.*?)\]\]/g, (match, p1) => {
      let target = p1;
      let label = p1;
      if (p1.includes("|")) {
        const parts = p1.split("|");
        target = parts[0].trim();
        label = parts[1].trim();
      }
      return `[${label}](#wikilink:${encodeURIComponent(target)})`;
    });
  };

  const processedContent = processWikilinks(page.content);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full">
      {/* Page Header */}
      <div className="pb-5 sm:pb-6 mb-6 sm:mb-8 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground break-words flex-1">
            {page.title}
          </h1>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border transition shrink-0 shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>편집</span>
          </button>
        </div>

        {/* Metadata badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 font-mono text-[11px] bg-secondary/50 px-2 py-0.5 rounded border border-border/50">
            <span className="text-foreground/80">{page.path}</span>
          </div>

          {page.updated_at && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(page.updated_at).toLocaleDateString()}</span>
            </div>
          )}

          <div className="text-foreground/60">
            {page.word_count} 단어
          </div>

          {page.tags && page.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap sm:ml-auto">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              {page.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Markdown Content */}
      <div ref={containerRef} className="markdown-body text-foreground">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            a: ({ href, children, ...props }) => {
              if (href && href.startsWith("#wikilink:")) {
                const target = decodeURIComponent(href.replace("#wikilink:", ""));
                return (
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigateWikilink(target);
                    }}
                    className="wikilink inline-flex items-center gap-0.5"
                  >
                    <span>{children}</span>
                    <ExternalLink className="w-2.5 h-2.5 inline opacity-60 ml-0.5" />
                  </span>
                );
              }
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  {...props}
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>

      {/* Backlinks Panel (Visible only on Mobile at the bottom of the article) */}
      <div className="md:hidden mt-12 pt-6 border-t border-border/80">
        <div className="flex items-center gap-2 pb-3 mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
          <span>연결된 지식 (Links)</span>
        </div>
        <BacklinksContent page={page} onNavigate={onNavigateWikilink} />
      </div>
    </div>
  );
}
