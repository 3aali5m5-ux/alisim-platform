import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import { AppLanguage, HeroSlideItem, SliderTransitionStyle } from '../types';
import { useAutoTranslateBatch } from '../services/dynamicTranslator';

interface HeroSliderProps {
  slides: HeroSlideItem[];
  autoPlay?: boolean;
  autoPlayMs?: number;
  transitionStyle?: SliderTransitionStyle;
  lang?: AppLanguage;
  onQuickNavigate: (section: 'sms' | 'esim' | 'wallet' | 'history') => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({
  slides,
  autoPlay = true,
  autoPlayMs = 5500,
  transitionStyle = 'cube3d',
  lang = 'ar',
  onQuickNavigate,
}) => {
  const activeSlides = useMemo(() => {
    return [...(slides || [])]
      .filter((s) => s.isEnabled && Boolean(s.imageUrl?.trim()))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [slides]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const touchStartXRef = useRef<number | null>(null);
  const isRtl = lang === 'ar';

  const slideTexts = useMemo(
    () => activeSlides.flatMap((s) => [s.titleAr, s.subtitleAr, s.ctaLabelAr]),
    [activeSlides]
  );
  const translateCms = useAutoTranslateBatch(slideTexts, lang);

  useEffect(() => {
    if (currentIdx >= activeSlides.length) {
      setCurrentIdx(0);
    }
  }, [activeSlides.length, currentIdx]);

  useEffect(() => {
    if (!autoPlay || isHovered || activeSlides.length <= 1) return;
    const ms = Math.max(2500, autoPlayMs || 5500);
    const timer = window.setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % activeSlides.length);
    }, ms);
    return () => window.clearInterval(timer);
  }, [autoPlay, autoPlayMs, isHovered, activeSlides.length]);

  if (activeSlides.length === 0) {
    return null;
  }

  const goPrev = () => {
    setCurrentIdx((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  const goNext = () => {
    setCurrentIdx((prev) => (prev + 1) % activeSlides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || activeSlides.length <= 1) return;
    const delta = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) {
      goPrev();
    } else {
      goNext();
    }
  };

  const handleCtaClick = (slide: HeroSlideItem) => {
    if (!slide.ctaAction || slide.ctaAction === 'none') return;
    if (slide.ctaAction === 'external') {
      const url = (slide.ctaExternalUrl || '').trim();
      if (url.startsWith('https://') || url.startsWith('http://')) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      }
      return;
    }
    onQuickNavigate(slide.ctaAction);
  };

  // Compute relative circular position (-1 = prev, 0 = active, +1 = next)
  const getRelativeOffset = (idx: number): number => {
    const total = activeSlides.length;
    if (total <= 1) return 0;
    let diff = idx - currentIdx;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  };

  const getSlide3DStyle = (offset: number): React.CSSProperties => {
    const isCurrent = offset === 0;
    const sign = offset >= 0 ? 1 : -1;

    switch (transitionStyle) {
      case 'coverflow3d': {
        if (isCurrent) {
          return {
            transform: 'translate3d(0%, 0, 0px) rotateY(0deg) scale(1)',
            opacity: 1,
            zIndex: 20,
            filter: 'brightness(1)',
          };
        }
        const clamped = Math.max(-2, Math.min(2, offset));
        return {
          transform: `translate3d(${clamped * 58}%, 0, -180px) rotateY(${-clamped * 38}deg) scale(0.84)`,
          opacity: Math.abs(offset) <= 1 ? 0.52 : 0,
          zIndex: 10 - Math.abs(offset),
          filter: 'brightness(0.6)',
        };
      }

      case 'flip3d': {
        if (isCurrent) {
          return {
            transform: 'translate3d(0, 0, 0) rotateY(0deg) scale(1)',
            opacity: 1,
            zIndex: 20,
          };
        }
        return {
          transform: `translate3d(0, 0, -120px) rotateY(${sign * 180}deg) scale(0.92)`,
          opacity: 0,
          zIndex: 5,
        };
      }

      case 'depthZoom3d': {
        if (isCurrent) {
          return {
            transform: 'translate3d(0, 0, 0) rotateX(0deg) scale(1)',
            opacity: 1,
            zIndex: 20,
            filter: 'blur(0px)',
          };
        }
        return {
          transform:
            offset > 0
              ? 'translate3d(0, 12%, -320px) rotateX(-16deg) scale(0.82)'
              : 'translate3d(0, -10%, 160px) rotateX(12deg) scale(1.12)',
          opacity: 0,
          zIndex: 5,
          filter: 'blur(4px)',
        };
      }

      case 'tiltSlide3d': {
        if (isCurrent) {
          return {
            transform: 'translate3d(0%, 0, 0) rotateY(0deg) rotateZ(0deg) scale(1)',
            opacity: 1,
            zIndex: 20,
          };
        }
        return {
          transform: `translate3d(${sign * 92}%, 4%, -160px) rotateY(${-sign * 26}deg) rotateZ(${sign * 3}deg) scale(0.88)`,
          opacity: 0,
          zIndex: 5,
        };
      }

      case 'cube3d':
      default: {
        if (isCurrent) {
          return {
            transform: 'translate3d(0%, 0, 0) rotateY(0deg) scale(1)',
            opacity: 1,
            zIndex: 20,
          };
        }
        return {
          transform: `translate3d(${sign * 50}%, 0, -240px) rotateY(${sign * 88}deg) scale(0.94)`,
          opacity: 0,
          zIndex: 5,
        };
      }
    }
  };

  return (
    <section
      className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0A0F1C] shadow-lg select-none keep-dark-card slider-3d-stage"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label={
        lang === 'tr'
          ? 'Öne Çıkan Kampanyalar'
          : lang === 'en'
          ? 'Featured Promotions'
          : 'العروض والإعلانات الرئيسية'
      }
    >
      <div className="relative w-full h-[175px] sm:h-[220px] lg:h-[255px]" style={{ transformStyle: 'preserve-3d' }}>
        {activeSlides.map((slide, idx) => {
          const offset = getRelativeOffset(idx);
          const isCurrent = offset === 0;
          const hasTitle = Boolean(slide.titleAr && slide.titleAr.trim());
          const hasSubtitle = Boolean(slide.subtitleAr && slide.subtitleAr.trim());
          const hasCta =
            Boolean(slide.ctaLabelAr && slide.ctaLabelAr.trim()) &&
            slide.ctaAction &&
            slide.ctaAction !== 'none';
          const hasAnyTextOverlay = hasTitle || hasSubtitle || hasCta;
          const imgFailed = Boolean(failedImages[slide.id]);

          return (
            <div
              key={slide.id}
              style={getSlide3DStyle(offset)}
              onClick={!isCurrent ? () => setCurrentIdx(idx) : undefined}
              className={`slider-3d-slide absolute inset-0 rounded-2xl overflow-hidden ${
                isCurrent ? '' : transitionStyle === 'coverflow3d' ? 'cursor-pointer' : 'pointer-events-none'
              }`}
            >
              {imgFailed ? (
                <div className="w-full h-full bg-gradient-to-l from-indigo-950 via-[#0B1224] to-cyan-950" />
              ) : (
                <img
                  src={slide.imageUrl}
                  alt={slide.titleAr || `Slide ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedImages((prev) => ({
                      ...prev,
                      [slide.id]: true,
                    }))
                  }
                  className="w-full h-full object-cover object-center"
                />
              )}

              {/* Optional Text & CTA Overlay — ZERO scrim if admin leaves text empty! */}
              {hasAnyTextOverlay && (
                <div
                  className={`absolute inset-0 ${
                    isRtl
                      ? 'bg-gradient-to-l from-[#06080E]/88 via-[#06080E]/55 to-transparent'
                      : 'bg-gradient-to-r from-[#06080E]/88 via-[#06080E]/55 to-transparent'
                  } flex items-center`}
                >
                  <div className="w-full max-w-xl px-5 sm:px-8 lg:px-10 space-y-2 sm:space-y-2.5 text-start">
                    {hasTitle && (
                      <h2 className="text-base sm:text-xl lg:text-2xl font-black text-white leading-snug drop-shadow">
                        {translateCms(slide.titleAr)}
                      </h2>
                    )}
                    {hasSubtitle && (
                      <p className="text-[11px] sm:text-xs lg:text-sm text-slate-200 leading-relaxed line-clamp-2">
                        {translateCms(slide.subtitleAr)}
                      </p>
                    )}
                    {hasCta && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleCtaClick(slide)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-extrabold shadow-md cursor-pointer transition-transform active:scale-95 btn-solid-white"
                        >
                          <span>{translateCms(slide.ctaLabelAr)}</span>
                          {isRtl ? (
                            <ArrowUpLeft className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Navigation Arrows */}
        {activeSlides.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label={lang === 'tr' ? 'Önceki slayt' : lang === 'en' ? 'Previous slide' : 'الشريحة السابقة'}
              className={`absolute ${
                isRtl ? 'right-2.5 sm:right-3.5' : 'left-2.5 sm:left-3.5'
              } top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black/45 hover:bg-black/70 border border-white/15 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer`}
            >
              {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={lang === 'tr' ? 'Sonraki slayt' : lang === 'en' ? 'Next slide' : 'الشريحة التالية'}
              className={`absolute ${
                isRtl ? 'left-2.5 sm:left-3.5' : 'right-2.5 sm:right-3.5'
              } top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black/45 hover:bg-black/70 border border-white/15 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer`}
            >
              {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {/* Pagination Dots */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/10">
              {activeSlides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  aria-label={`Slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentIdx
                      ? 'w-5 bg-cyan-400'
                      : 'w-1.5 bg-white/45 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
