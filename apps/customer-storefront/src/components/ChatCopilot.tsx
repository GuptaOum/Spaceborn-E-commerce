'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Check, Loader2, MapPin, Send, Sparkles, Square, Trash2, X } from 'lucide-react';
import { ApiError, streamEvents } from '@spaceborn/web-core/api';
import { formatInr } from '@spaceborn/web-core/format';
import type { CatalogOffer } from '@spaceborn/web-core/types';
import { toProduct, useStore } from '../context/StoreContext';
import type { Product } from '../types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAVIGABLE = /^\/(cart|checkout|orders|fabrication|catalog|compare|wishlist|datasheets|contact|warranty|profile|product\/[0-9a-f-]{36})$/;
const STORAGE_KEY = 'spaceborn_copilot_v1';
const MAX_KEPT_MESSAGES = 30;
const MAX_INPUT = 1000;

const SUGGESTIONS = [
  'ESP32 board under ₹600',
  'Driver for a 12V DC motor',
  'Is my cart missing anything?',
  'Where is my order?',
];

type CartProposal = { productId: string; quantity: number; product: Product; state: 'pending' | 'added' | 'dismissed' };

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products: Product[];
  proposals: CartProposal[];
  links: string[];
  error?: string;
  degraded?: boolean;
}

type ServerEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'token'; text: string }
  | { type: 'products'; products: CatalogOffer[] }
  | { type: 'action'; action: { kind: 'navigate'; path: string } | { kind: 'add_to_cart'; productId: string; quantity: number; product: CatalogOffer } }
  | { type: 'error'; message: string }
  | { type: 'done'; mode: 'copilot' | 'fallback' };

interface Stored {
  owner: string | null;
  conversationId: string | null;
  messages: Message[];
}

const newId = () => crypto.randomUUID();

const PAGE_LABEL: Record<string, string> = {
  cart: 'Open cart', checkout: 'Go to checkout', orders: 'Open my orders', fabrication: 'Open 3D printing & CNC',
  catalog: 'Browse catalog', compare: 'Open compare', wishlist: 'Open wishlist', datasheets: 'Open datasheets',
  contact: 'Contact support', warranty: 'Warranty policy', profile: 'Open profile', product: 'View product',
};

// The model writes a little markdown. It is rendered as React text, never as HTML.
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={i} className="rounded bg-sb-ink/10 px-1 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, b) => {
        const lines = block.split('\n').filter((l) => l.trim());
        const bullets = lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (bullets && lines.length > 0) {
          return (
            <ul key={b} className="my-1 list-disc space-y-0.5 pl-4">
              {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>)}
            </ul>
          );
        }
        return (
          <p key={b} className="my-1 whitespace-pre-wrap">
            {inline(block.replace(/^#{1,6}\s+/gm, ''))}
          </p>
        );
      })}
    </>
  );
}

function ProductStrip({ products, onOpen, onAdd }: { products: Product[]; onOpen: (p: Product) => void; onAdd: (p: Product) => void }) {
  return (
    <div className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
      {products.map((p) => (
        <div key={p.id} className="w-36 shrink-0 snap-start rounded-xl border border-sb-ink/10 bg-white p-2 shadow-sm">
          <button onClick={() => onOpen(p)} className="block w-full text-left" title={p.name}>
            <img src={p.image} alt="" className="mb-1.5 h-20 w-full rounded-lg bg-sb-canvas object-contain" loading="lazy" />
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-sb-ink">{p.name}</span>
          </button>
          <div className="mt-1 flex items-center justify-between gap-1">
            <span className="font-mono text-xs font-black text-sb-ink">{formatInr(p.price)}</span>
            {p.stock > 0 ? (
              <button onClick={() => onAdd(p)} className="rounded-md border border-sb-brand px-2 py-0.5 text-[10px] font-black uppercase text-sb-brand hover:bg-sb-brand hover:text-white">
                Add
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-red-600">Out of stock</span>
            )}
          </div>
          {p.stock > 0 && <p className="mt-0.5 text-[10px] text-sb-muted">⚡ {p.deliveryMins} min</p>}
        </div>
      ))}
    </div>
  );
}

function readStored(): Stored | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export const ChatCopilot: React.FC = () => {
  const router = useRouter();
  const { location, cart, addToCart, currentUser, setSelectedProduct, authLoading } = useStore();
  const owner = currentUser?.id ?? null;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<string | null | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A conversation belongs to whoever started it: signing in or out starts a fresh one.
  useEffect(() => {
    if (authLoading) return;
    const stored = readStored();
    if (stored && stored.owner === owner) {
      setMessages(stored.messages ?? []);
      setConversationId(stored.conversationId);
    } else {
      abortRef.current?.abort();
      setMessages([]);
      setConversationId(null);
    }
    setHydratedFor(owner);
  }, [owner, authLoading]);

  useEffect(() => {
    if (hydratedFor === undefined || hydratedFor !== owner || busy) return;
    const kept: Stored = { owner, conversationId, messages: messages.slice(-MAX_KEPT_MESSAGES) };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
    } catch {
      // Storage full or disabled: the chat still works for this page view.
    }
  }, [messages, conversationId, owner, hydratedFor, busy]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const patchLast = useCallback((id: string, patch: (m: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));
  }, []);

  const go = useCallback(
    (path: string) => {
      if (!NAVIGABLE.test(path)) return;
      router.push(path);
      if (window.matchMedia('(max-width: 767px)').matches) setOpen(false);
    },
    [router],
  );

  const openProduct = (p: Product) => {
    setSelectedProduct(p);
    go(`/product/${p.id}`);
  };

  const ready = hydratedFor === owner;

  const send = async (raw: string) => {
    const message = raw.trim().slice(0, MAX_INPUT);
    // Hydration restores this visitor's conversation. Sending earlier would be wiped when it lands.
    if (!message || busy || !ready) return;
    setInput('');
    const assistantId = newId();
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'user', text: message, products: [], proposals: [], links: [] },
      { id: assistantId, role: 'assistant', text: '', products: [], proposals: [], links: [] },
    ]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const cartLines = cart
      .filter((i) => UUID.test(i.product.id) && i.quantity > 0)
      .slice(0, 40)
      .map((i) => ({ productId: i.product.id, quantity: Math.min(50, i.quantity) }));

    try {
      const events = streamEvents<ServerEvent>(
        '/ai/chat',
        {
          message,
          conversationId: conversationId ?? undefined,
          lat: location.latitude,
          lng: location.longitude,
          areaLabel: (location.area || location.label || '').slice(0, 120) || undefined,
          cart: cartLines,
        },
        controller.signal,
      );
      for await (const event of events) {
        switch (event.type) {
          case 'meta':
            if (UUID.test(event.conversationId)) setConversationId(event.conversationId);
            break;
          case 'token':
            if (typeof event.text === 'string' && event.text) patchLast(assistantId, (m) => ({ ...m, text: m.text + event.text }));
            break;
          case 'products': {
            const incoming = Array.isArray(event.products) ? event.products : [];
            const products = incoming.flatMap((offer) => {
              try {
                return [toProduct(offer)];
              } catch {
                return [];
              }
            });
            patchLast(assistantId, (m) => ({
              ...m,
              products: [...m.products, ...products.filter((p) => !m.products.some((x) => x.id === p.id))].slice(0, 12),
            }));
            break;
          }
          case 'action': {
            const action = event.action;
            // A button, not an immediate redirect: navigating now would close the
            // drawer on a phone and hide the answer that is still streaming.
            if (action.kind === 'navigate' && NAVIGABLE.test(action.path)) {
              patchLast(assistantId, (m) => ({ ...m, links: m.links.includes(action.path) ? m.links : [...m.links, action.path] }));
            } else if (action.kind === 'add_to_cart' && UUID.test(action.productId)) {
              let product: Product;
              try {
                product = toProduct(action.product);
              } catch {
                break;
              }
              patchLast(assistantId, (m) => ({
                ...m,
                proposals: [
                  ...m.proposals.filter((p) => p.productId !== action.productId),
                  { productId: action.productId, quantity: action.quantity, product, state: 'pending' },
                ],
              }));
            }
            break;
          }
          case 'error':
            patchLast(assistantId, (m) => ({ ...m, error: event.message }));
            break;
          case 'done':
            if (event.mode === 'fallback') patchLast(assistantId, (m) => ({ ...m, degraded: true }));
            break;
        }
      }
    } catch (err) {
      const e = err as ApiError;
      const retry = (e.details as { retryAfter?: number } | undefined)?.retryAfter;
      const text = e.status === 429 && retry ? `${e.message} (about ${Math.ceil(retry / 60)} min)` : e.message || 'Something went wrong.';
      patchLast(assistantId, (m) => ({ ...m, error: text }));
    } finally {
      if (controller.signal.aborted) patchLast(assistantId, (m) => (m.error ? m : { ...m, error: 'Stopped.' }));
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  };

  const confirm = (messageId: string, proposal: CartProposal) => {
    addToCart(proposal.product, proposal.quantity);
    patchLast(messageId, (m) => ({
      ...m,
      proposals: m.proposals.map((p) => (p.productId === proposal.productId ? { ...p, state: 'added' } : p)),
    }));
  };

  const dismiss = (messageId: string, productId: string) =>
    patchLast(messageId, (m) => ({ ...m, proposals: m.proposals.map((p) => (p.productId === productId ? { ...p, state: 'dismissed' } : p)) }));

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
  };

  const areaName = location.area || location.label;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask the Spaceborn assistant"
          className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-sb-ink px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-sb-ink/30 transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:left-6 md:right-auto"
        >
          <Sparkles className="h-4 w-4 text-[#f8cb46]" />
          <span>Ask Spaceborn</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Spaceborn assistant"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[88vh] flex-col overflow-hidden rounded-t-3xl border border-sb-ink/10 bg-[#fff8f1] shadow-2xl md:inset-x-auto md:bottom-6 md:left-6 md:h-[640px] md:max-h-[calc(100vh-3rem)] md:w-[410px] md:rounded-3xl"
        >
          <header className="flex items-center gap-3 border-b border-sb-ink/10 bg-sb-ink px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Bot className="h-5 w-5 text-[#f8cb46]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">Spaceborn Assistant</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-white/75">
                <MapPin className="h-3 w-3 shrink-0" /> Stock near {areaName}
              </p>
            </div>
            {messages.length > 0 && (
              <button onClick={reset} title="New conversation" className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4 text-sm text-sb-ink">
            {!ready && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-sb-muted" aria-label="Loading conversation" />
              </div>
            )}
            {ready && messages.length === 0 && (
              <div className="px-1">
                <p className="font-bold">Hi{currentUser ? ` ${currentUser.fullName.split(' ')[0]}` : ''}! What are you building?</p>
                <p className="mt-1 text-xs text-sb-muted">
                  I only suggest parts that shops near {areaName} have in stock right now, and I can check your cart for missing pieces.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => void send(s)} className="rounded-full border border-sb-ink/15 bg-white px-3 py-1.5 text-xs font-semibold hover:border-sb-ink/40">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ready && messages.map((m, idx) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-sb-ink px-3 py-2 text-white">{m.text}</p>
                </div>
              ) : (
                <div key={m.id} className="max-w-[95%]">
                  {m.products.length > 0 && <ProductStrip products={m.products} onOpen={openProduct} onAdd={(p) => addToCart(p, 1)} />}
                  {(m.text || (busy && idx === messages.length - 1)) && (
                    <div className="mt-1 rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-sm">
                      {m.text ? <RichText text={m.text} /> : <Loader2 className="h-4 w-4 animate-spin text-sb-muted" aria-label="Thinking" />}
                    </div>
                  )}
                  {m.proposals.map((p) => (
                    <div key={p.productId} className="mt-2 flex items-center gap-2 rounded-xl border border-sb-brand/30 bg-sb-brand/5 p-2">
                      <img src={p.product.image} alt="" className="h-10 w-10 rounded-lg bg-white object-contain" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{p.product.name}</p>
                        <p className="text-[11px] text-sb-muted">
                          {p.quantity} × {formatInr(p.product.price)}
                        </p>
                      </div>
                      {p.state === 'pending' && (
                        <>
                          <button onClick={() => dismiss(m.id, p.productId)} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-sb-muted hover:bg-black/5">
                            No
                          </button>
                          <button onClick={() => confirm(m.id, p)} className="rounded-lg bg-sb-brand px-2.5 py-1 text-[11px] font-black uppercase text-white hover:bg-sb-brand-strong">
                            Confirm
                          </button>
                        </>
                      )}
                      {p.state === 'added' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sb-brand">
                          <Check className="h-3.5 w-3.5" /> Added
                        </span>
                      )}
                      {p.state === 'dismissed' && <span className="text-[11px] text-sb-muted">Skipped</span>}
                    </div>
                  ))}
                  {m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.links.map((path) => (
                        <button key={path} onClick={() => go(path)} className="rounded-full bg-[#f8cb46] px-3 py-1 text-[11px] font-bold text-sb-ink">
                          {PAGE_LABEL[path.split('/')[1] ?? ''] ?? 'Open'} →
                        </button>
                      ))}
                    </div>
                  )}
                  {m.error && <p className="mt-1 text-xs font-semibold text-red-600">{m.error}</p>}
                  {m.degraded && !m.error && <p className="mt-1 text-[10px] text-sb-muted">Showing search results while the assistant recovers.</p>}
                </div>
              ),
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 border-t border-sb-ink/10 bg-white p-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder={ready ? 'Ask about parts, projects or your order…' : 'Loading conversation…'}
              disabled={!ready}
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-sb-ink/15 bg-[#fff8f1] px-3 py-2 text-sm outline-none focus:border-sb-ink/40 disabled:opacity-60"
            />
            {busy ? (
              <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop" className="flex h-10 w-10 items-center justify-center rounded-xl bg-sb-muted text-white">
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button type="submit" disabled={!ready || !input.trim()} aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-xl bg-sb-ink text-white disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
        </section>
      )}
    </>
  );
};
