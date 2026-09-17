"use client";

import { useEffect, useState, useId } from "react";
import mermaid from "mermaid";

interface MermaidBlockProps {
  chart: string;
}

export function MermaidBlock({ chart }: MermaidBlockProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const rawId = useId();
  const safeId = "mermaid-" + rawId.replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      if (!chart.trim()) return;

      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          fontFamily: "inherit",
          suppressErrorRendering: true,
        });

        // Unique ID for mermaid render
        const uniqueId = `${safeId}-${Math.random().toString(36).substring(2, 7)}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, chart.trim());

        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "다이어그램 렌더링에 실패했습니다.");
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart, safeId]);

  if (error) {
    return (
      <div className="p-3 my-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-mono">
        <div className="font-semibold mb-1 flex items-center gap-1.5">
          <span>⚠️ Mermaid 다이어그램 렌더링 오류</span>
        </div>
        <pre className="whitespace-pre-wrap text-[11px] opacity-90 overflow-x-auto">{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="p-4 my-4 text-center text-xs text-muted-foreground bg-secondary/30 rounded-xl border border-border/60 animate-pulse">
        다이어그램 렌더링 중...
      </div>
    );
  }

  return (
    <div
      className="mermaid-container flex justify-center my-6 overflow-x-auto p-4 bg-card/60 rounded-xl border border-border/80 shadow-xs"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
