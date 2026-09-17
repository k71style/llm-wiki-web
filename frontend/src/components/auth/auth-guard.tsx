"use client";

import React from "react";
import { useAuth } from "@/contexts/auth-context";
import { Lock, ShieldCheck, LogIn, Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm">인증 세션을 확인하는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 px-4 text-center">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
            <Lock className="h-8 w-8" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
            LLM-Wiki 접근 인증 필요
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            본 시스템은 <span className="font-semibold text-zinc-200">k71style.xyz</span> 통합 계정 보안 체계로 보호되고 있습니다. 
            문서 열람 및 Claude Code AI 기능을 사용하시려면 로그인해 주세요.
          </p>

          <div className="mt-8 space-y-3">
            <button
              onClick={login}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              <span>k71style.xyz 통합 로그인</span>
            </button>

            <div className="flex items-center justify-center gap-1.5 pt-2 text-xs text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>JWT SSO 보안 세션 자동 연동</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
