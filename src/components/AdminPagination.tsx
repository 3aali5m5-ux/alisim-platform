import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface AdminPaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export const AdminPagination: React.FC<AdminPaginationProps> = ({
  totalItems,
  currentPage,
  pageSize = 10,
  onPageChange,
  itemLabel = 'عنصر',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  // Build smart compact page list with ellipses
  const buildPages = (): (number | 'ellipsis-left' | 'ellipsis-right')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [1];
    if (safePage > 3) pages.push('ellipsis-left');
    const winStart = Math.max(2, safePage - 1);
    const winEnd = Math.min(totalPages - 1, safePage + 1);
    for (let p = winStart; p <= winEnd; p++) {
      pages.push(p);
    }
    if (safePage < totalPages - 2) pages.push('ellipsis-right');
    pages.push(totalPages);
    return pages;
  };

  const pages = buildPages();

  return (
    <div className="pt-3 mt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5 text-[11px]">
      <div className="text-slate-400 font-mono tabular-nums">
        عرض <strong className="text-white">{startIdx}</strong>–<strong className="text-white">{endIdx}</strong> من أصل{' '}
        <strong className="text-cyan-300">{totalItems}</strong> {itemLabel} (صفحة {safePage} / {totalPages})
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span>السابق</span>
          </button>

          {pages.map((item) =>
            typeof item === 'string' ? (
              <span key={item} className="px-1.5 text-slate-500 font-mono">
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`min-w-[30px] h-[30px] px-2 rounded-lg font-mono font-extrabold transition-colors cursor-pointer ${
                  item === safePage
                    ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300'
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <span>التالي</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
