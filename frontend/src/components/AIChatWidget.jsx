import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Phone, Send, Sparkles, X } from 'lucide-react';

const WEBHOOK_URL = (import.meta.env.VITE_N8N_CHAT_WEBHOOK_URL || '').trim();
const QUICK_PROMPTS = [
  'Program apa saja yang tersedia?',
  'Bagaimana cara mendaftar?',
  'Apa saja persyaratannya?'
];

function getReply(payload) {
  if (typeof payload === 'string') return payload.trim();
  const candidates = Array.isArray(payload) ? payload : [payload];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    for (const key of ['output', 'text', 'response', 'reply', 'answer', 'message']) {
      if (typeof candidate[key] === 'string' && candidate[key].trim()) return candidate[key].trim();
    }
    if (candidate.data) {
      const nestedReply = getReply(candidate.data);
      if (nestedReply) return nestedReply;
    }
  }
  return '';
}

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId] = useState(createSessionId);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Halo! Saya asisten virtual LPK BYE. Ada yang ingin kamu ketahui tentang program atau pendaftaran?'
    }
  ]);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [isOpen, isSending, messages]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  async function sendMessage(rawMessage) {
    const message = rawMessage.trim();
    if (!message || isSending || !WEBHOOK_URL) return;

    setInput('');
    setIsSending(true);
    setMessages((current) => [...current, {
      id: createSessionId(),
      role: 'user',
      content: message
    }]);

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', chatInput: message, sessionId })
      });
      if (!response.ok) throw new Error('Asisten AI sedang tidak dapat dihubungi. Silakan coba lagi.');

      const responseText = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let reply = responseText.trim();
      if (contentType.includes('json')) {
        try {
          reply = getReply(JSON.parse(responseText));
        } catch {
          throw new Error('Balasan asisten tidak dapat dibaca. Silakan coba lagi.');
        }
      }
      if (!reply) throw new Error('Asisten belum memberikan balasan. Silakan coba lagi.');

      setMessages((current) => [...current, {
        id: createSessionId(),
        role: 'assistant',
        content: reply
      }]);
    } catch (error) {
      const message = error instanceof TypeError
        ? 'Koneksi ke asisten terputus. Silakan coba lagi atau hubungi admin melalui WhatsApp.'
        : error.message;
      setMessages((current) => [...current, {
        id: createSessionId(),
        role: 'error',
        content: message
      }]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function submit(event) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="fixed bottom-3 right-3 z-[60] flex flex-col items-end gap-2 sm:bottom-7 sm:right-7 sm:gap-3">
      {isOpen && <section
        aria-label="Asisten virtual LPK BYE"
        className="flex h-[560px] max-h-[calc(100vh_-_6.25rem)] w-[calc(100vw_-_1.5rem)] max-w-[340px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_80px_-20px_rgba(20,25,48,.35)] sm:h-[600px] sm:max-h-[calc(100vh_-_7rem)] sm:w-[min(360px,calc(100vw_-_2rem))] sm:max-w-[390px] sm:rounded-[24px]"
      >
        <header className="relative overflow-hidden bg-gradient-to-br from-[#4c1729] via-[#68263c] to-[#873e50] px-4 pb-3 pt-3.5 text-white sm:px-5 sm:pb-5 sm:pt-5">
          <div className="absolute -right-8 -top-12 h-28 w-28 rounded-full bg-white/5 sm:h-36 sm:w-36"/>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/10 shadow-inner sm:h-11 sm:w-11 sm:rounded-2xl">
                <Bot size={20} className="sm:hidden"/>
                <Bot size={23} className="hidden sm:block"/>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight sm:text-base">Asisten LPK BYE</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/75 sm:mt-1 sm:text-[11px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${WEBHOOK_URL ? 'bg-emerald-300' : 'bg-amber-300'}`}/>
                  {WEBHOOK_URL ? 'Siap membantu · AI' : 'Asisten sedang disiapkan'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup chat"
              className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white sm:h-9 sm:w-9"
            >
              <X size={17} className="sm:hidden"/>
              <X size={19} className="hidden sm:block"/>
            </button>
          </div>
          <p className="relative mt-4 hidden text-xs leading-5 text-white/75 sm:block">
            Tanyakan program, jadwal, atau proses pendaftaran. Kami akan bantu arahkan.
          </p>
        </header>

        <div ref={messagesRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-[#fbfaf9] px-3 py-3 sm:space-y-4 sm:px-4 sm:py-5">
          <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[10px] text-slate-400">
            <Sparkles size={12} className="text-wine-500"/> LPK BYE · Bandung
          </div>
          {messages.map((message) => <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2.5 text-[12px] leading-[1.45] shadow-sm sm:max-w-[85%] sm:px-3.5 sm:py-3 sm:text-[13px] sm:leading-5 ${
              message.role === 'user'
                ? 'rounded-br-md bg-wine-700 text-white'
                : message.role === 'error'
                  ? 'rounded-bl-md border border-amber-200 bg-amber-50 text-amber-900'
                  : 'rounded-bl-md border border-slate-100 bg-white text-slate-700'
            }`}>
              {message.content}
            </div>
          </div>)}
          {isSending && <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-100 bg-white px-3 py-2.5 text-slate-400 shadow-sm sm:px-4 sm:py-3" aria-label="Asisten sedang mengetik">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine-500"/>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine-500 [animation-delay:120ms]"/>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine-500 [animation-delay:240ms]"/>
            </div>
          </div>}
          {!WEBHOOK_URL && <div className="rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-[11px] leading-4 text-amber-900 sm:p-3 sm:text-xs sm:leading-5">
            Chat AI sedang disiapkan. Untuk bantuan sekarang, silakan hubungi admin LPK BYE.
            <a
              href="https://wa.me/6283820943475"
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 flex w-fit items-center gap-1.5 font-semibold text-wine-700 underline decoration-wine-300 underline-offset-2 sm:mt-2"
            >
              <Phone size={13}/> Hubungi admin
            </a>
          </div>}
          {messages.length === 1 && WEBHOOK_URL && <div className="flex flex-wrap gap-2 pl-1">
            {QUICK_PROMPTS.map((prompt) => <button
              key={prompt}
              type="button"
              disabled={isSending}
              onClick={() => sendMessage(prompt)}
              className="rounded-full border border-wine-100 bg-white px-2.5 py-1.5 text-left text-[10px] font-medium text-wine-700 transition hover:border-wine-500 hover:bg-wine-50 disabled:opacity-50 sm:px-3 sm:py-2 sm:text-[11px]"
            >
              {prompt}
            </button>)}
          </div>}
        </div>

        <form onSubmit={submit} className="border-t border-slate-100 bg-white p-2 sm:p-3">
          <div className={`flex items-end gap-1.5 rounded-xl border bg-slate-50 p-1.5 transition focus-within:border-wine-500 focus-within:ring-4 focus-within:ring-wine-50 sm:gap-2 sm:rounded-2xl sm:p-2 ${!WEBHOOK_URL ? 'opacity-60' : 'border-slate-200'}`}>
            <textarea
              ref={inputRef}
              rows={1}
              maxLength={1000}
              value={input}
              disabled={!WEBHOOK_URL || isSending}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit(event);
                }
              }}
              placeholder={WEBHOOK_URL ? 'Tulis pesan kamu...' : 'Chat belum tersedia'}
              aria-label="Pesan untuk asisten"
              className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed sm:min-h-10 sm:py-2 sm:text-sm"
            />
            <button
              type="submit"
              disabled={!WEBHOOK_URL || isSending || !input.trim()}
              aria-label="Kirim pesan"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-wine-700 text-white transition hover:bg-wine-900 disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-10 sm:w-10 sm:rounded-xl"
            >
              <Send size={15} className="sm:hidden"/>
              <Send size={17} className="hidden sm:block"/>
            </button>
          </div>
          <p className="mt-1.5 text-center text-[9px] text-slate-400 sm:mt-2 sm:text-[10px]">Balasan dibantu AI. Jangan kirim data pribadi atau rahasia.</p>
        </form>
      </section>}

      <button
        type="button"
        aria-label={isOpen ? 'Tutup asisten virtual' : 'Buka asisten virtual'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="group flex items-center gap-2 rounded-full bg-wine-700 py-2 pl-2.5 pr-2.5 text-white shadow-[0_10px_30px_-8px_rgba(104,38,60,.65)] transition duration-200 hover:-translate-y-0.5 hover:bg-wine-900 hover:shadow-[0_14px_35px_-8px_rgba(104,38,60,.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wine-600 sm:gap-2.5 sm:py-3 sm:pl-4 sm:pr-3.5"
      >
        <span className="relative grid h-7 w-7 place-items-center rounded-full bg-white/15 sm:h-8 sm:w-8">
          {isOpen ? <X size={16} className="sm:hidden"/> : <MessageCircle size={17} className="sm:hidden"/>}
          {isOpen ? <X size={18} className="hidden sm:block"/> : <MessageCircle size={19} className="hidden sm:block"/>}
          {!isOpen && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-wine-700 bg-emerald-400"/>}
        </span>
        <span className="pr-0.5 text-left sm:pr-1">
          <span className="block text-[11px] font-semibold sm:text-xs">{isOpen ? 'Tutup chat' : 'Tanya asisten AI'}</span>
          <span className="mt-0.5 block text-[9px] text-white/70 sm:text-[10px]">LPK BYE siap membantu</span>
        </span>
      </button>
    </div>
  );
}
