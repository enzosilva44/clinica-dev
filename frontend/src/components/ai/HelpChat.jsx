import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import api from "../../services/api";

export default function HelpChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Olá! Sou o assistente do Iasoclin. Como posso te ajudar com o sistema?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/ai/chat", { messages: updated });
      setMessages([...updated, { role: "assistant", content: res.data.reply }]);
    } catch {
      setMessages([
        ...updated,
        { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Painel */}
      {open && (
        <div className="fixed bottom-20 right-5 w-80 bg-white border border-[#E5D8C5] rounded-2xl shadow-xl flex flex-col z-50 overflow-hidden"
          style={{ height: 420 }}>
          {/* Header */}
          <div className="bg-[#00704A] px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-white/80" />
              <span className="text-white font-semibold text-sm">Assistente Iasoclin</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] text-sm px-3 py-2 rounded-2xl leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#00704A] text-white rounded-br-sm"
                      : "bg-[#FAF7F2] border border-[#E5D8C5] text-[#00704A] rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl rounded-bl-sm px-4 py-2.5">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#00704A] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-[#00704A] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-[#00704A] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-[#E5D8C5] flex gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Como faço para…"
              className="flex-1 text-sm border border-[#C4895A] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="bg-[#00704A] hover:bg-[#0A3326] disabled:opacity-40 text-white p-2 rounded-xl transition"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 w-12 h-12 bg-[#00704A] hover:bg-[#0A3326] text-white rounded-full shadow-lg flex items-center justify-center transition z-50"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </>
  );
}
