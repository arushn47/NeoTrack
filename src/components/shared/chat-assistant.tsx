'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Calendar,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

const SUGGESTIONS = [
  'Mark Value Labs as shortlisted',
  'What are my upcoming tests?',
  'Show shortlisted companies',
  'What is the CTC for Value Labs?',
];

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "👋 Hi Arush! I'm your Placement Assistant. You can chat with me to update drive statuses (e.g. *\"Mark Value Labs as shortlisted\"*) or check upcoming tests and CTC details!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || input;
    if (!messageText.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: data.reply || "I couldn't process that request. Please try again!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);

      // If status was updated, trigger a subtle page reload or state refresh if needed
      if (data.action === 'status_updated') {
        window.dispatchEvent(new Event('placement_status_updated'));
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'bot',
          text: '⚠️ Something went wrong connecting to the assistant. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-6 right-6 z-40 p-3.5 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-300 group',
          isOpen
            ? 'bg-bg-elevated border border-border-default text-text-primary scale-90'
            : 'bg-gradient-to-tr from-accent to-accent-hover text-white shadow-accent/25 hover:scale-105 hover:shadow-2xl'
        )}
        aria-label="Open Placement Assistant"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <Bot className="w-6 h-6 group-hover:rotate-6 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-bg-surface ring-2 ring-emerald-400/30" />
          </div>
        )}
      </button>

      {/* Chat Drawer Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] bg-bg-surface/95 backdrop-blur-xl border border-border-default rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-bg-elevated/80 border-b border-border-default">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Placement Assistant</h3>
                <p className="text-[11px] text-text-tertiary flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Online · Instant Commands
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2.5 text-xs',
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.sender === 'bot' && (
                  <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[80%] px-3.5 py-2.5 rounded-2xl whitespace-pre-wrap leading-relaxed shadow-sm',
                    msg.sender === 'user'
                      ? 'bg-accent text-white rounded-br-none font-medium'
                      : 'bg-bg-elevated border border-border-default/80 text-text-primary rounded-bl-none'
                  )}
                >
                  {msg.text}
                  <span
                    className={cn(
                      'block text-[9px] mt-1 text-right',
                      msg.sender === 'user' ? 'text-white/70' : 'text-text-tertiary'
                    )}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 text-xs justify-start items-center">
                <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-bg-elevated border border-border-default/80 text-text-tertiary text-xs">
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Chips */}
          <div className="px-3 py-2 border-t border-border-default/40 bg-bg-elevated/30 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(s)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-bg-surface hover:bg-bg-surface-hover text-text-secondary hover:text-text-primary border border-border-default whitespace-nowrap transition-all"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Message Input Box */}
          <div className="p-3 bg-bg-elevated/80 border-t border-border-default flex items-center gap-2">
            <input
              type="text"
              placeholder="Tell me to update status or ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 px-3.5 py-2 bg-bg-surface border border-border-default rounded-xl text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-all"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-all flex-shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
