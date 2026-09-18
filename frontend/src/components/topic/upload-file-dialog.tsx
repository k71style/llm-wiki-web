"use client";

import { useState, useRef } from "react";
import {
  X,
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Folder,
} from "lucide-react";
import { uploadTopicFiles, UploadResultItem } from "@/lib/api";

interface UploadFileDialogProps {
  isOpen: boolean;
  topicId: string;
  topicTitle: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadFileDialog({
  isOpen,
  topicId,
  topicTitle,
  onClose,
  onUploaded,
}: UploadFileDialogProps) {
  const [targetDir, setTargetDir] = useState<string>("assets");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [overwrite, setOverwrite] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResultItem[] | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
      setError(null);
      setUploadResults(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
      setError(null);
      setUploadResults(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("업로드할 파일을 최소 1개 이상 선택해 주세요.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const res = await uploadTopicFiles(topicId, selectedFiles, targetDir, overwrite);
      if (res.uploaded && res.uploaded.length > 0) {
        setUploadResults(res.uploaded);
        onUploaded();
      }
      if (res.errors && res.errors.length > 0) {
        setError(`${res.errors.length}개 파일 업로드 실패: ${res.errors[0].error}`);
      }
    } catch (err: any) {
      setError(err.message || "파일 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const copyMarkdownLink = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext || "")) {
      return <ImageIcon className="w-4 h-4 text-emerald-400" />;
    }
    if (["md", "markdown", "txt"].includes(ext || "")) {
      return <FileText className="w-4 h-4 text-indigo-400" />;
    }
    return <File className="w-4 h-4 text-zinc-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">저장소 파일 직접 올리기</h2>
              <p className="text-xs text-muted-foreground">
                대상 주제: <span className="font-semibold text-foreground">{topicTitle}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Form */}
        {!uploadResults ? (
          <div className="mt-4 space-y-4">
            {/* Target Directory Selection */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5" />
                <span>저장할 대상 폴더</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "assets", label: "assets (이미지/에셋)", desc: "이미지, PDF, 첨부파일" },
                  { id: "concepts", label: "concepts (핵심 개념)", desc: "마크다운(.md) 지식" },
                  { id: "sources", label: "sources (참고 자료)", desc: "원천 자료, 텍스트" },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setTargetDir(d.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      targetDir === d.id
                        ? "border-primary bg-primary/10 text-foreground shadow-sm"
                        : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    }`}
                  >
                    <div className="text-xs font-semibold">{d.label}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/60 rounded-2xl p-6 text-center cursor-pointer bg-secondary/20 hover:bg-secondary/40 transition-all flex flex-col items-center justify-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                파일을 이곳으로 드래그하거나 <span className="text-primary underline underline-offset-2">클릭하여 선택</span>
              </p>
              <p className="text-xs text-muted-foreground">
                마크다운(.md), 이미지(.png, .jpg, .svg), 문서(.pdf, .txt) 지원 (최대 100MB)
              </p>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                <div className="text-xs font-semibold text-muted-foreground px-1 flex justify-between">
                  <span>선택된 파일 ({selectedFiles.length}개)</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-muted-foreground hover:text-destructive text-[11px] cursor-pointer"
                  >
                    전체 취소
                  </button>
                </div>
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getFileIcon(file.name)}
                      <span className="truncate text-foreground font-mono">{file.name}</span>
                      <span className="text-muted-foreground text-[11px]">({formatBytes(file.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Overwrite Option */}
            <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span>동일한 이름의 파일이 이미 존재하면 덮어쓰기</span>
            </label>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>업로드 중...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>{selectedFiles.length}개 파일 업로드</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Upload Success Screen */
          <div className="mt-4 space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                <strong>{uploadResults.length}개 파일</strong>이 <strong>{targetDir}/</strong> 경로에 성공적으로 업로드되었습니다!
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              <p className="text-xs font-semibold text-muted-foreground">마크다운 문서 삽입 링크:</p>
              {uploadResults.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-secondary/50 border border-border text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    {getFileIcon(item.filename)}
                    <span className="truncate font-mono text-foreground font-semibold">{item.filename}</span>
                    <span className="text-[11px] text-muted-foreground">({item.path})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyMarkdownLink(item.markdown_link, idx)}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary border border-border/80 hover:bg-secondary/80 text-foreground font-mono text-[11px] transition-all cursor-pointer"
                    title="마크다운 링크 복사"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">복사됨</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-muted-foreground" />
                        <span>링크 복사</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setSelectedFiles([]);
                  setUploadResults(null);
                }}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                + 추가 파일 업로드
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
