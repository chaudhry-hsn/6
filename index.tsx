import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// --- Types ---
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image';
  imageData?: string;
};

type AppMode = 'chat' | 'image-gen' | 'about';

// --- Components ---

const App = () => {
  const [mode, setMode] = useState<AppMode>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      type: 'text'
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

      if (mode === 'chat') {
        const history = messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }));

        const chat = ai.chats.create({
          model: 'gemini-3-flash-preview',
          config: {
            systemInstruction: "You are a helpful, creative, and highly intelligent AI assistant. Keep responses concise and insightful."
          }
        });

        // Add history here if we want persistent context beyond current turn
        // For simplicity in this demo, we'll just send the current message
        const responseStream = await chat.sendMessageStream({ message: inputText });
        
        const assistantId = (Date.now() + 1).toString();
        let fullText = "";
        
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: "", type: 'text' }]);

        for await (const chunk of responseStream) {
          const text = chunk.text;
          fullText += text;
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m));
        }
      } else if (mode === 'image-gen') {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: inputText }] },
          config: {
            imageConfig: { aspectRatio }
          }
        });

        let imageUrl = '';
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Generated: ${inputText}`,
            type: 'image',
            imageData: imageUrl
          }]);
        } else {
          throw new Error("No image was generated.");
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred.'}`,
        type: 'text'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 glass border-r border-white/5 flex flex-col p-4 space-y-2 hidden md:flex">
        <div className="flex items-center space-x-2 px-2 py-4 mb-4">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white">G</div>
          <span className="font-bold text-xl tracking-tight">Gemini Suite</span>
        </div>
        
        <button 
          onClick={() => setMode('chat')}
          className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all ${mode === 'chat' ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20 text-white' : 'hover:bg-white/5 text-slate-400'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
          <span className="font-medium">AI Chat</span>
        </button>

        <button 
          onClick={() => setMode('image-gen')}
          className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all ${mode === 'image-gen' ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20 text-white' : 'hover:bg-white/5 text-slate-400'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          <span className="font-medium">Image Studio</span>
        </button>

        <div className="mt-auto pt-4 border-t border-white/5 px-2">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-4">Powered by Gemini</p>
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>System Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header (Mobile) */}
        <header className="md:hidden glass border-b border-white/5 p-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center font-bold text-white text-xs">G</div>
            <span className="font-bold">Gemini</span>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => setMode('chat')} className={`p-2 rounded ${mode === 'chat' ? 'text-indigo-400' : 'text-slate-500'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg></button>
            <button onClick={() => setMode('image-gen')} className={`p-2 rounded ${mode === 'image-gen' ? 'text-indigo-400' : 'text-slate-500'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></button>
          </div>
        </header>

        {/* Message Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth scrollbar-hide"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20 mb-4">
                <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white">How can I help you today?</h2>
              <p className="text-slate-400 max-w-md">Experience the power of {mode === 'chat' ? 'Gemini 3 Flash' : 'Gemini 2.5 Image'}. Try asking for a story, a complex coding solution, or a stunning visual.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 w-full max-w-xl">
                 <button onClick={() => setInputText("Explain quantum computing like I'm five.")} className="p-4 glass rounded-xl border border-white/5 hover:border-indigo-500/50 transition-all text-sm text-left">Explain quantum computing...</button>
                 <button onClick={() => setInputText("Write a creative landing page headline.")} className="p-4 glass rounded-xl border border-white/5 hover:border-indigo-500/50 transition-all text-sm text-left">Write a creative landing page...</button>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in`}
            >
              <div className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                  : 'glass text-slate-200 border border-white/10'
              }`}>
                {msg.type === 'text' ? (
                  <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{msg.content}</p>
                ) : (
                  <div className="space-y-3">
                    <img src={msg.imageData} alt="AI Generated" className="rounded-lg w-full h-auto shadow-2xl" />
                    <p className="text-xs text-slate-400 font-medium italic">{msg.content}</p>
                    <button 
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = msg.imageData!;
                        link.download = 'generated-gemini.png';
                        link.click();
                      }}
                      className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors flex items-center space-x-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      <span>Download</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start animate-in">
              <div className="glass p-4 rounded-2xl border border-white/10 flex space-x-2 items-center">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 md:p-8 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
          <div className="max-w-4xl mx-auto space-y-4">
            {mode === 'image-gen' && (
              <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                {(['1:1', '16:9', '9:16', '4:3'] as const).map(ratio => (
                  <button 
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${aspectRatio === ratio ? 'bg-indigo-500 border-indigo-500 text-white' : 'glass border-white/10 text-slate-400'}`}
                  >
                    {ratio} Ratio
                  </button>
                ))}
              </div>
            )}
            <div className="relative glass rounded-2xl border border-white/10 shadow-2xl p-1 flex items-center">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={mode === 'chat' ? "Ask me anything..." : "Describe the image you want to create..."}
                className="w-full bg-transparent border-none focus:ring-0 text-slate-100 placeholder-slate-500 px-4 py-3 text-sm md:text-base"
              />
              <button 
                onClick={handleSend}
                disabled={!inputText.trim() || isTyping}
                className={`p-2 md:p-3 rounded-xl transition-all ${!inputText.trim() || isTyping ? 'text-slate-600' : 'text-indigo-400 hover:bg-white/5 active:scale-95'}`}
              >
                <svg className="w-6 h-6 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-center text-slate-500 uppercase tracking-[0.2em] font-medium">Gemini Pro Suite &bull; {mode.toUpperCase()} MODE</p>
          </div>
        </div>
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
