import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Image as ImageIcon,
  Mic,
  Square,
  Smile,
  Crown,
  BadgeCheck,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import {
  AppLanguage,
  ManagedUserAccount,
  SiteCmsConfig,
  SupportConversation,
  SupportChatMessage,
} from '../types';
import { useAutoTranslate } from '../services/dynamicTranslator';

interface SupportChatWidgetProps {
  lang?: AppLanguage;
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
  authToken: string;
  user: ManagedUserAccount;
  cmsConfig: SiteCmsConfig;
  onNewAdminMessage?: (msg: SupportChatMessage) => void;
}

const EMOJI_PALETTE = [
  '👋', '😊', '🙏', '✅', '🔥', '💯', '⚡', '📱',
  '💳', '🛠️', '❓', '👍', '❤️', '🎉', '⏳', '📩',
];

const SUPPORT_COPY: Record<
  AppLanguage,
  {
    defaultAdminName: string;
    defaultBadgeTitle: string;
    defaultWelcome: string;
    sendErr: string;
    connErr: string;
    imgInvalid: string;
    imgTooBig: string;
    micUnsupported: string;
    audioTooBig: string;
    micPermission: string;
    emojiTitle: string;
    attachImgTitle: string;
    stopVoiceTitle: string;
    recVoiceTitle: string;
    recordingNow: string;
    placeholder: string;
    imgAlt: string;
  }
> = {
  ar: {
    defaultAdminName: 'إدارة الدعم الفني',
    defaultBadgeTitle: 'المدير العام · دعم فوري',
    defaultWelcome:
      'أهلاً بك في الدعم الفني المباشر! يمكنك مراسلتنا بالنص أو الصور أو الرسائل الصوتية وسنرد عليك فوراً.',
    sendErr: 'تعذر إرسال الرسالة',
    connErr: 'تعذر الاتصال بخادم الدعم.',
    imgInvalid: 'يرجى اختيار ملف صورة صالح فقط.',
    imgTooBig: 'الحد الأقصى لحجم الصورة هو 2 ميجابايت.',
    micUnsupported: 'المتصفح لا يدعم تسجيل الرسائل الصوتية.',
    audioTooBig: 'التسجيل الصوتي طويل جداً، الحد الأقصى 2.5 ميجابايت.',
    micPermission: 'يرجى السماح بصلاحية الميكروفون لإرسال رسالة صوتية.',
    emojiTitle: 'إيموجي',
    attachImgTitle: 'إرفاق صورة',
    stopVoiceTitle: 'إيقاف وإرسال الصوت',
    recVoiceTitle: 'تسجيل رسالة صوتية',
    recordingNow: 'جاري التسجيل...',
    placeholder: 'اكتب رسالتك للدعم الفني...',
    imgAlt: 'مرفق صورة',
  },
  tr: {
    defaultAdminName: 'Canlı Destek Ekibi',
    defaultBadgeTitle: 'Yönetici · Anlık Destek',
    defaultWelcome:
      'Canlı desteğe hoş geldiniz! Bize metin, görsel veya sesli mesaj gönderebilirsiniz, hemen yanıt vereceğiz.',
    sendErr: 'Mesaj gönderilemedi',
    connErr: 'Destek sunucusuna bağlanılamadı.',
    imgInvalid: 'Lütfen yalnızca geçerli bir resim dosyası seçin.',
    imgTooBig: 'Maksimum resim boyutu 2 MB.',
    micUnsupported: 'Tarayıcı ses kaydını desteklemiyor.',
    audioTooBig: 'Ses kaydı çok uzun, maksimum 2.5 MB.',
    micPermission: 'Sesli mesaj göndermek için mikrofon izni verin.',
    emojiTitle: 'Emoji',
    attachImgTitle: 'Görsel ekle',
    stopVoiceTitle: 'Kaydı durdur ve gönder',
    recVoiceTitle: 'Sesli mesaj kaydet',
    recordingNow: 'Kaydediliyor...',
    placeholder: 'Destek mesajınızı yazın...',
    imgAlt: 'Ekli görsel',
  },
  en: {
    defaultAdminName: 'Live Support Team',
    defaultBadgeTitle: 'Admin · Instant Support',
    defaultWelcome:
      'Welcome to live support! Send us text, images, or voice messages and we will reply right away.',
    sendErr: 'Could not send message',
    connErr: 'Could not connect to support server.',
    imgInvalid: 'Please select a valid image file only.',
    imgTooBig: 'Maximum image size is 2 MB.',
    micUnsupported: 'Your browser does not support voice recording.',
    audioTooBig: 'Voice note is too large, maximum is 2.5 MB.',
    micPermission: 'Please allow microphone access to send a voice note.',
    emojiTitle: 'Emoji',
    attachImgTitle: 'Attach image',
    stopVoiceTitle: 'Stop & send audio',
    recVoiceTitle: 'Record voice message',
    recordingNow: 'Recording...',
    placeholder: 'Write your message to support...',
    imgAlt: 'Image attachment',
  },
};

export const SupportChatWidget: React.FC<SupportChatWidgetProps> = ({
  lang = 'ar',
  isOpen,
  onClose,
  onUnreadChange,
  authToken,
  user,
  cmsConfig,
  onNewAdminMessage,
}) => {
  const c = SUPPORT_COPY[lang];
  const isRtl = lang === 'ar';
  const locale = lang === 'ar' ? 'ar-SY' : lang === 'tr' ? 'tr-TR' : 'en-US';

  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [textInput, setTextInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unreadBadge, setUnreadBadge] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  const onNewAdminMessageRef = useRef(onNewAdminMessage);
  const onUnreadChangeRef = useRef(onUnreadChange);

  useEffect(() => {
    onNewAdminMessageRef.current = onNewAdminMessage;
  }, [onNewAdminMessage]);

  useEffect(() => {
    onUnreadChangeRef.current = onUnreadChange;
  }, [onUnreadChange]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadBadge(0);
    }
  }, [isOpen]);

  useEffect(() => {
    onUnreadChangeRef.current?.(unreadBadge);
  }, [unreadBadge]);

  // Fetch initial conversation
  useEffect(() => {
    if (!authToken) return;
    fetch('/api/support/my-conversation', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.conversation) {
          setConversation(data.conversation);
        }
      })
      .catch(() => {});
  }, [authToken]);

  // Real-time WebSocket subscription
  useEffect(() => {
    if (!authToken) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/support?token=${encodeURIComponent(
      authToken
    )}`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload.type === 'chat:message' && payload.message) {
            const msg: SupportChatMessage = payload.message;
            setConversation((prev) => {
              if (!prev) return payload.conversation || prev;
              if (prev.messages.some((m) => m.id === msg.id)) return prev;
              return {
                ...prev,
                messages: [...prev.messages, msg],
                updatedAt: msg.createdAt,
              };
            });
            if (msg.senderRole === 'ADMIN' || msg.senderRole === 'MODERATOR') {
              if (!isOpenRef.current) {
                setUnreadBadge((prev) => prev + 1);
              }
              onNewAdminMessageRef.current?.(msg);
            }
          } else if (payload.type === 'chat:status' && payload.status) {
            setConversation((prev) =>
              prev ? { ...prev, status: payload.status } : prev
            );
          }
        } catch {
          // ignore malformed frame
        }
      };
    } catch {
      // ignore ws init failure
    }
    return () => {
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [authToken]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages.length, isOpen]);

  const sendMessage = async (payload: {
    type: 'text' | 'image' | 'audio';
    text?: string;
    mediaDataUrl?: string;
    audioDurationSec?: number;
  }) => {
    setErrorMsg(null);
    setSending(true);
    try {
      const res = await fetch('/api/support/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          conversationId: conversation?.id,
          ...payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || c.sendErr);
        return;
      }
      if (data.conversation) {
        setConversation(data.conversation);
      }
      setTextInput('');
      setShowEmoji(false);
    } catch {
      setErrorMsg(c.connErr);
    } finally {
      setSending(false);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || sending) return;
    sendMessage({ type: 'text', text: textInput.trim() });
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg(c.imgInvalid);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg(c.imgTooBig);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        sendMessage({ type: 'image', mediaDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg(c.micUnsupported);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      let sec = 0;
      setRecordSeconds(0);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 2.5 * 1024 * 1024) {
          setErrorMsg(c.audioTooBig);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            sendMessage({
              type: 'audio',
              mediaDataUrl: reader.result,
              audioDurationSec: Math.max(1, sec),
            });
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      recordTimerRef.current = window.setInterval(() => {
        sec += 1;
        setRecordSeconds(sec);
        if (sec >= 60) {
          recorder.stop();
          setRecording(false);
        }
      }, 1000);
    } catch {
      setErrorMsg(c.micPermission);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const translatedAdminName = useAutoTranslate(
    cmsConfig.supportAdminDisplayName || c.defaultAdminName,
    lang
  );
  const translatedAdminBadge = useAutoTranslate(
    cmsConfig.supportAdminBadgeTitle || c.defaultBadgeTitle,
    lang
  );
  const translatedWelcome = useAutoTranslate(
    cmsConfig.supportWelcomeMessage || c.defaultWelcome,
    lang
  );

  // Controlled drawer ONLY — never floats a persistent button over page content
  if (!isOpen) return null;

  const adminDisplayName = translatedAdminName || c.defaultAdminName;
  const adminBadgeTitle = translatedAdminBadge || c.defaultBadgeTitle;
  const welcomeMessage = translatedWelcome || c.defaultWelcome;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-end justify-end bg-black/55 backdrop-blur-[2px] p-3 sm:p-5">
      <div
        className="w-full sm:w-[400px] h-[540px] max-h-[82vh] rounded-2xl dropdown-solid border border-cyan-500/45 shadow-2xl flex flex-col overflow-hidden"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Prestigious Admin Support Header */}
        <div className="px-4 py-3 bg-gradient-to-l from-indigo-950 via-[#0C1324] to-cyan-950 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 keep-dark-card">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 text-slate-950 flex items-center justify-center shadow-md border border-amber-200/70">
                <Crown className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#0C1324]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white flex items-center gap-1 truncate">
                <span>{adminDisplayName}</span>
                <BadgeCheck className="w-4 h-4 text-amber-400 shrink-0" />
              </div>
              <div className="text-[10px] text-amber-300 font-bold truncate">
                {adminBadgeTitle}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {(!conversation || conversation.messages.length === 0) && (
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200/70">
                <Crown className="w-3.5 h-3.5" />
              </div>
              <div className="max-w-[82%] p-3 rounded-2xl rounded-tr-sm bg-gradient-to-bl from-amber-500/15 to-indigo-500/15 border border-amber-400/35 space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-black text-amber-300">
                  <span>{adminDisplayName}</span>
                  <BadgeCheck className="w-3 h-3 text-amber-400" />
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{welcomeMessage}</p>
              </div>
            </div>
          )}

          {(conversation?.messages || []).map((msg) => {
            const isAdmin = msg.senderRole === 'ADMIN';
            const isModerator = msg.senderRole === 'MODERATOR';
            const isStaff = isAdmin || isModerator;
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2 ${isStaff ? '' : 'flex-row-reverse'}`}
              >
                {isAdmin ? (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200/70 shadow-sm">
                    <Crown className="w-3.5 h-3.5" />
                  </div>
                ) : isModerator ? (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200/70 shadow-sm">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                ) : user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={msg.senderName}
                    className="w-7 h-7 rounded-lg object-cover shrink-0 mt-0.5 border border-cyan-400/40"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-cyan-500 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    {msg.senderName.charAt(0)}
                  </div>
                )}

                <div
                  className={`max-w-[80%] p-2.5 rounded-2xl space-y-1.5 ${
                    isAdmin
                      ? 'rounded-tr-sm bg-amber-500/15 border border-amber-400/40'
                      : isModerator
                      ? 'rounded-tr-sm bg-emerald-500/15 border border-emerald-400/40'
                      : 'rounded-tl-sm bg-indigo-600 text-white btn-solid-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span
                      className={`font-black flex items-center gap-1 ${
                        isAdmin
                          ? 'text-amber-300'
                          : isModerator
                          ? 'text-emerald-300'
                          : 'text-cyan-100'
                      }`}
                    >
                      <span>{msg.senderName}</span>
                      {isAdmin && <BadgeCheck className="w-3 h-3 text-amber-400" />}
                      {isModerator && <ShieldCheck className="w-3 h-3 text-emerald-400" />}
                    </span>
                    <span className="opacity-70 font-mono text-[9px]">
                      {new Date(msg.createdAt).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {msg.text && (
                    <p
                      className={`text-xs leading-relaxed whitespace-pre-wrap break-words ${
                        isStaff ? 'text-slate-100' : 'text-white'
                      }`}
                    >
                      {msg.text}
                    </p>
                  )}

                  {msg.type === 'image' && msg.mediaDataUrl && (
                    <img
                      src={msg.mediaDataUrl}
                      alt={c.imgAlt}
                      className="rounded-xl max-h-48 w-auto object-contain border border-white/15"
                    />
                  )}

                  {msg.type === 'audio' && msg.mediaDataUrl && (
                    <div className="pt-1">
                      <audio controls src={msg.mediaDataUrl} className="h-8 max-w-[220px]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {errorMsg && (
          <div className="px-3 py-1.5 bg-rose-500/20 text-rose-300 text-[11px] font-bold text-center">
            {errorMsg}
          </div>
        )}

        {showEmoji && (
          <div className="px-3 py-2 bg-[#070A12] border-t border-white/10 grid grid-cols-8 gap-1">
            {EMOJI_PALETTE.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setTextInput((prev) => `${prev}${em}`)}
                className="h-8 rounded-lg hover:bg-white/10 text-base flex items-center justify-center cursor-pointer"
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {/* Composer Bar */}
        <form
          onSubmit={handleSendText}
          className="p-2.5 bg-[#070A12] border-t border-white/10 flex items-center gap-1.5 shrink-0"
        >
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-amber-400 flex items-center justify-center cursor-pointer shrink-0"
            title={c.emojiTitle}
          >
            <Smile className="w-4 h-4" />
          </button>

          {cmsConfig.supportAllowImages !== false && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 flex items-center justify-center cursor-pointer shrink-0"
                title={c.attachImgTitle}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImagePick}
                className="hidden"
              />
            </>
          )}

          {cmsConfig.supportAllowVoice !== false && (
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={sending}
              className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer shrink-0 ${
                recording
                  ? 'bg-rose-600 text-white'
                  : 'bg-white/5 hover:bg-white/10 text-emerald-400'
              }`}
              title={recording ? c.stopVoiceTitle : c.recVoiceTitle}
            >
              {recording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {recording ? (
            <div className="flex-1 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold flex items-center justify-between">
              <span>{c.recordingNow}</span>
              <span>00:{String(recordSeconds).padStart(2, '0')}</span>
            </div>
          ) : (
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={c.placeholder}
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-[#0B0F1A] border border-white/10 text-white focus:outline-none focus:border-cyan-400"
            />
          )}

          <button
            type="submit"
            disabled={sending || recording || !textInput.trim()}
            className="w-9 h-9 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 disabled:opacity-40 text-white flex items-center justify-center cursor-pointer shrink-0 btn-solid-white"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
