import React, { useState } from 'react';
import {
  Database,
  X,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { SUPABASE_SQL_PATCHES } from '../services/hybridSyncEngine';

interface SupabaseSqlHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedPatches: Record<string, boolean>;
  onTogglePatchCompleted: (version: string) => void;
}

export const SupabaseSqlHubModal: React.FC<SupabaseSqlHubModalProps> = ({
  isOpen,
  onClose,
  completedPatches,
  onTogglePatchCompleted,
}) => {
  const [copiedVersion, setCopiedVersion] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopySql = (sql: string, versionKey: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedVersion(versionKey);
    setTimeout(() => setCopiedVersion(null), 2000);
  };

  const handleCopyAllPatches = () => {
    const combinedSql = SUPABASE_SQL_PATCHES.map((p) => p.sqlCode).join('\n\n');
    handleCopySql(combinedSql, 'ALL_PATCHES');
  };

  const completedCount = SUPABASE_SQL_PATCHES.filter(
    (p) => completedPatches[p.version]
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl cyber-glass border border-cyan-500/40 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#070A12] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 text-white flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                مركز أكواد وتحديثات قاعدة بيانات Supabase (Versioned SQL Migration Hub)
              </h2>
              <p className="text-xs text-slate-400">
                أكواد PostgreSQL مقسمة إلى إصدارات متسلسلة (v1.0 إلى v1.4) لنسخها وتشغيلها في Supabase SQL Editor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyAllPatches}
              className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedVersion === 'ALL_PATCHES' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تم نسخ جميع الحزم!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ جميع الأكواد معاً (v1.0–v1.4)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-5 py-3 bg-[#090D18] border-b border-white/10 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>
              حالة تطبيق الحزم في مشروعك على Supabase: {completedCount} من أصل {SUPABASE_SQL_PATCHES.length} مكتمل
            </span>
          </div>
          <span className="text-[11px] text-cyan-400 font-mono">
            Supabase PostgreSQL + RLS Ready
          </span>
        </div>

        {/* Scrollable SQL Patches List */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {SUPABASE_SQL_PATCHES.map((patch) => {
            const isDone = Boolean(completedPatches[patch.version]);
            const isCopied = copiedVersion === patch.version;

            return (
              <div
                key={patch.version}
                className={`rounded-2xl border p-4 sm:p-5 space-y-3 transition-all ${
                  isDone
                    ? 'bg-emerald-950/15 border-emerald-500/40'
                    : 'bg-[#070A12] border-indigo-500/40 shadow-lg shadow-indigo-950/40'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-mono text-xs font-extrabold">
                        {patch.version}
                      </span>
                      <h3 className="text-sm sm:text-base font-extrabold text-white">
                        {patch.titleAr}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {patch.descriptionAr}
                    </p>
                  </div>

                  {/* Glowing Status Badge */}
                  <div className="shrink-0">
                    {isDone ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-extrabold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>تم التنفيذ في Supabase ✅</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-extrabold animate-pulse">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>{patch.badgeTextAr}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Tables chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400">الجداول والسياسات المشمولة:</span>
                  {patch.tablesIncluded.map((tbl) => (
                    <span
                      key={tbl}
                      className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-cyan-300"
                      dir="ltr"
                    >
                      {tbl}
                    </span>
                  ))}
                </div>

                {/* SQL Code Pre Block */}
                <div className="relative rounded-xl bg-[#04060B] border border-white/10 overflow-hidden">
                  <div className="px-3.5 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400" dir="ltr">
                      sql_migration_{patch.version.replace('.', '_')}.sql
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopySql(patch.sqlCode, patch.version)}
                        className="px-3 py-1 rounded-lg bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>تم نسخ كود SQL!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ كود SQL</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <pre
                    className="p-3.5 text-xs font-mono text-cyan-300 overflow-x-auto max-h-56 leading-relaxed"
                    dir="ltr"
                  >
                    {patch.sqlCode}
                  </pre>
                </div>

                {/* Confirmation Checkbox Row */}
                <div className="pt-1 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2.5 text-xs font-bold text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => onTogglePatchCompleted(patch.version)}
                      className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                    />
                    <span>تأكيد: تم التنفيذ في Supabase ✅ (حفظ حالة هذا التحديث)</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
