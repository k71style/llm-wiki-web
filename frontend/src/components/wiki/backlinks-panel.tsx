"use client";

import { Link2, ArrowLeftRight, ExternalLink } from "lucide-react";
import { PageDetail } from "@/types";

interface BacklinksPanelProps {
  page: PageDetail;
  onNavigate: (pathOrTitle: string) => void;
  className?: string;
}

export function BacklinksContent({ page, onNavigate }: { page: PageDetail; onNavigate: (path: string) => void }) {
  const hasIncoming = page.incoming_links && page.incoming_links.length > 0;
  const hasOutgoing = page.outgoing_links && page.outgoing_links.length > 0;

  return (
    <div className="space-y-6">
      {/* Incoming Backlinks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-foreground">
          <span className="flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-primary" />
            <span>역방향 링크 (Backlinks)</span>
          </span>
          <span className="text-[11px] px-1.5 py-0.2 bg-secondary rounded text-muted-foreground font-mono">
            {page.incoming_links?.length || 0}
          </span>
        </div>

        {!hasIncoming ? (
          <p className="text-xs text-muted-foreground/70 py-1">
            이 문서를 참조하는 다른 문서가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {page.incoming_links.map((link, idx) => (
              <div
                key={idx}
                onClick={() => onNavigate(link.source_path)}
                className="p-2.5 rounded-lg bg-secondary/40 hover:bg-secondary border border-border/60 hover:border-primary/40 cursor-pointer transition group"
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground group-hover:text-primary">
                  <Link2 className="w-3 h-3 shrink-0 text-primary/70" />
                  <span className="truncate">{link.source_title}</span>
                </div>
                {link.context_snippet && (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed italic bg-background/50 p-1.5 rounded">
                    "{link.context_snippet}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outgoing Links */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-foreground">
          <span className="flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            <span>참조 중인 문서 (Outgoing)</span>
          </span>
          <span className="text-[11px] px-1.5 py-0.2 bg-secondary rounded text-muted-foreground font-mono">
            {page.outgoing_links?.length || 0}
          </span>
        </div>

        {!hasOutgoing ? (
          <p className="text-xs text-muted-foreground/70 py-1">
            다른 문서를 참조하는 위키링크가 없습니다.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {page.outgoing_links.map((target, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate(target)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary/70 hover:bg-primary hover:text-primary-foreground text-xs text-foreground/90 border border-border/80 transition"
              >
                <span className="truncate max-w-[180px]">{target}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function BacklinksPanel({ page, onNavigate, className = "" }: BacklinksPanelProps) {
  return (
    <aside className={`hidden md:flex w-72 bg-card/60 border-l border-border flex-col h-full shrink-0 overflow-y-auto p-4 select-none ${className}`}>
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
        <span>연결된 지식 (Links)</span>
      </div>

      <BacklinksContent page={page} onNavigate={onNavigate} />
    </aside>
  );
}
