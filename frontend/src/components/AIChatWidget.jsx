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
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {isOpen && <section
        aria-label="Asisten virtual LPK BYE"
        className="flex h-[600px] max-h-[calc(100vh_-_7rem)] w-[calc(100vw_-_2.5rem)] max-w-[390px] flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_24px_80px_-20px_rgba(20,25,48,.35)]"
      >
        <header className="relative overflow-hidden bg-gradient-to-br from-[#4c1729] via-[#68263c] to-[#873e50] px-5 pb-5 pt-5 text-white">
          <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/5"/>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-inner">
                <Bot size={23}/>
              </div>
              <div>
                <p className="font-semibold tracking-tight">Asisten LPK BYE</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/75">
                  <span className={`h-1.5 w-1.5 rounded-full ${WEBHOOK_URL ? 'bg-emerald-300' : 'bg-amber-300'}`}/>
                  {WEBHOOK_URL ? 'Siap membantu · AI' : 'Asisten sedang disiapkan'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup chat"
              className="grid h-9 w-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X size={19}/>
            </button>
          </div>
          <p className="relative mt-4 text-xs leading-5 text-white/75">
            Tanyakan program, jadwal, atau proses pendaftaran. Kami akan bantu arahkan.
          </p>
        </header>

        <div ref={messagesRef} aria-live="polite" className="flex-1 space-y-4 overflow-y-auto bg-[#fbfaf9] px-4 py-5">
          <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[10px] text-slate-400">
            <Sparkles size={12} className="text-wine-500"/> LPK BYE · Bandung
          </div>
          {messages.map((message) => <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-3 text-[13px] leading-5 shadow-sm ${
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
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 text-slate-400 shadow-sm" aria-label="Asisten sedang mengetik">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine-500"/>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine-500 [animation-delay:120ms]"/>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine-500 [animation-delay:240ms]"/>
            </div>
          </div>}
          {!WEBHOOK_URL && <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Chat AI sedang disiapkan. Untuk bantuan sekarang, silakan hubungi admin LPK BYE.
            <a
              href="https://wa.me/6283820943475"
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex w-fit items-center gap-1.5 font-semibold text-wine-700 underline decoration-wine-300 underline-offset-2"
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
              className="rounded-full border border-wine-100 bg-white px-3 py-2 text-left text-[11px] font-medium text-wine-700 transition hover:border-wine-500 hover:bg-wine-50 disabled:opacity-50"
            >
              {prompt}
            </button>)}
          </div>}
        </div>

        <form onSubmit={submit} className="border-t border-slate-100 bg-white p-3">
          <div className={`flex items-end gap-2 rounded-2xl border bg-slate-50 p-2 transition focus-within:border-wine-500 focus-within:ring-4 focus-within:ring-wine-50 ${!WEBHOOK_URL ? 'opacity-60' : 'border-slate-200'}`}>
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
              className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!WEBHOOK_URL || isSending || !input.trim()}
              aria-label="Kirim pesan"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-wine-700 text-white transition hover:bg-wine-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send size={17}/>
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">Balasan dibantu AI. Jangan kirim data pribadi atau rahasia.</p>
        </form>
      </section>}

      <button
        type="button"
        aria-label={isOpen ? 'Tutup asisten virtual' : 'Buka asisten virtual'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="group flex items-center gap-2.5 rounded-full bg-wine-700 py-3 pl-4 pr-3.5 text-white shadow-[0_10px_30px_-8px_rgba(104,38,60,.65)] transition duration-200 hover:-translate-y-0.5 hover:bg-wine-900 hover:shadow-[0_14px_35px_-8px_rgba(104,38,60,.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wine-600"
      >
        <span className="relative grid h-8 w-8 place-items-center rounded-full bg-white/15">
          {isOpen ? <X size={18}/> : <MessageCircle size={19}/>}
          {!isOpen && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-wine-700 bg-emerald-400"/>}
        </span>
        <span className="pr-1 text-left">
          <span className="block text-xs font-semibold">{isOpen ? 'Tutup chat' : 'Tanya asisten AI'}</span>
          <span className="mt-0.5 block text-[10px] text-white/70">LPK BYE siap membantu</span>
        </span>
      </button>
    </div>
  );
}
