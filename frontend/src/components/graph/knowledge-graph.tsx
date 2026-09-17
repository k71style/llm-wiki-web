"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { KnowledgeGraphData, GraphNode } from "@/types";
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from "lucide-react";

// Dynamic import to avoid SSR Canvas errors
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface KnowledgeGraphProps {
  data: KnowledgeGraphData;
  onNodeClick: (node: GraphNode) => void;
  onRefresh: () => void;
}

const GROUP_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Violet
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#6366f1", // Indigo
];

export function KnowledgeGraph({
  data,
  onNodeClick,
  onRefresh,
}: KnowledgeGraphProps) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleZoomIn = () => {
    if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() * 1.3, 400);
  };

  const handleZoomOut = () => {
    if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() / 1.3, 400);
  };

  const handleFit = () => {
    if (fgRef.current) fgRef.current.zoomToFit(400, 50);
  };

  return (
    <div ref={containerRef} className="relative flex-1 h-full w-full bg-card overflow-hidden">
      {/* Floating Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-secondary/80 backdrop-blur-md p-1.5 rounded-lg border border-border shadow-lg">
        <button
          onClick={handleZoomIn}
          title="확대"
          className="p-1.5 hover:bg-card rounded-md text-foreground/80 hover:text-foreground transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="축소"
          className="p-1.5 hover:bg-card rounded-md text-foreground/80 hover:text-foreground transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFit}
          title="화면 맞춤"
          className="p-1.5 hover:bg-card rounded-md text-foreground/80 hover:text-foreground transition"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-border my-auto" />
        <button
          onClick={onRefresh}
          title="그래프 새로고침"
          className="p-1.5 hover:bg-card rounded-md text-foreground/80 hover:text-foreground transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Info Badge */}
      <div className="absolute bottom-4 left-4 z-10 bg-secondary/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs text-muted-foreground flex items-center gap-3 select-none">
        <span>노드: <b className="text-foreground">{data.nodes.length}</b></span>
        <span>연결: <b className="text-foreground">{data.links.length}</b></span>
      </div>

      {/* 2D Canvas Force Graph */}
      {dimensions.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={data}
          nodeLabel="title"
          nodeColor={(node: any) => GROUP_COLORS[Math.abs(node.group || 1) % GROUP_COLORS.length]}
          nodeRelSize={5}
          linkColor={() => "rgba(120, 140, 180, 0.35)"}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleWidth={2}
          onNodeClick={(node: any) => onNodeClick(node as GraphNode)}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.title || node.id;
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            
            // Node circle
            const r = Math.max(3, Math.sqrt(node.val || 1) * 3);
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = GROUP_COLORS[Math.abs(node.group || 1) % GROUP_COLORS.length];
            ctx.fill();
            ctx.lineWidth = 1.5 / globalScale;
            ctx.strokeStyle = "#ffffff";
            ctx.stroke();

            // Text Label
            if (globalScale > 0.8) {
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = "#e2e8f0";
              ctx.fillText(label, node.x, node.y + r + fontSize);
            }
          }}
        />
      )}
    </div>
  );
}
