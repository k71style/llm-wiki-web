"use client";

import { useState, useEffect } from "react";
import { X, Shield, Lock, Globe, UserPlus, Check, AlertCircle, Loader2 } from "lucide-react";
import { TopicInfo } from "@/types";
import { updateTopicPermissions } from "@/lib/api";

interface TopicPermissionsDialogProps {
  isOpen: boolean;
  topic: TopicInfo | null;
  onClose: () => void;
  onUpdated: (updatedTopic: TopicInfo) => void;
}

export function TopicPermissionsDialog({
  isOpen,
  topic,
  onClose,
  onUpdated,
}: TopicPermissionsDialogProps) {
  const [isPublic, setIsPublic] = useState(false);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (topic) {
      setIsPublic(Boolean(topic.is_public));
      setAssignedUsers(topic.assigned_users || []);
      setError(null);
      setSuccessMsg(null);
      setNewUsername("");
    }
  }, [topic, isOpen]);

  if (!isOpen || !topic) return null;

  const handleAddUser = () => {
    const trimmed = newUsername.trim().toLowerCase();
    if (!trimmed) return;
    if (assignedUsers.includes(trimmed)) {
      setError(`'${trimmed}' 사용자는 이미 목록에 있습니다.`);
      return;
    }
    setAssignedUsers((prev) => [...prev, trimmed]);
    setNewUsername("");
    setError(null);
  };

  const handleRemoveUser = (username: string) => {
    setAssignedUsers((prev) => prev.filter((u) => u !== username));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddUser();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updated = await updateTopicPermissions(topic.id, {
        is_public: isPublic,
        assigned_users: assignedUsers,
      });
      setSuccessMsg("위키 접근 권한이 성공적으로 저장되었습니다.");
      onUpdated(updated);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err.message || "권한 업데이트에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">위키 접근 권한 설정</h2>
              <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                {topic.title} ({topic.name})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {error && (
            <div className="flex items-center gap-2 p-3 text-destructive bg-destructive/10 rounded-lg text-xs border border-destructive/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 text-emerald-400 bg-emerald-500/10 rounded-lg text-xs border border-emerald-500/20">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Public Toggle Card */}
          <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Globe className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-400" />
                )}
                <div>
                  <span className="font-semibold text-foreground">전체 공개 (Public)</span>
                  <p className="text-[11px] text-muted-foreground">
                    {isPublic
                      ? "모든 사용자(로그인한 계정)가 이 위키를 열람할 수 있습니다."
                      : "비공개: 관리자 및 할당된 사용자만 이 위키를 열람할 수 있습니다."}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>

          {/* Assigned Users Section */}
          <div className="space-y-2">
            <label className="block font-semibold text-foreground">
              할당된 사용자 목록 ({assignedUsers.length}명)
            </label>
            <p className="text-[11px] text-muted-foreground">
              이 위키에 접근할 수 있는 일반 사용자(zzooni4 username)를 추가하세요.
            </p>

            {/* Input & Add Button */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="사용자명 입력 (예: user1)"
                className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleAddUser}
                className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-lg border border-border transition text-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>추가</span>
              </button>
            </div>

            {/* User Badges */}
            <div className="min-h-[70px] max-h-[140px] overflow-y-auto p-2 bg-secondary/20 border border-border/80 rounded-lg flex flex-wrap gap-1.5 content-start">
              {assignedUsers.length === 0 ? (
                <span className="text-[11px] text-muted-foreground p-1">
                  할당된 사용자가 없습니다. (비공개 시 관리자만 접근 가능)
                </span>
              ) : (
                assignedUsers.map((username) => (
                  <span
                    key={username}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border/80 text-[11px] font-medium"
                  >
                    <span>{username}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(username)}
                      className="text-muted-foreground hover:text-destructive transition"
                      title="사용자 제거"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-border bg-secondary/20">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>저장 중...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>권한 저장</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
