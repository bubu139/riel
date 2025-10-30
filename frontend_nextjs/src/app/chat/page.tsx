'use client';
import { useState, useRef, useEffect, FormEvent } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Paperclip, Send, Bot, User, Sparkles, X, File as FileIcon, Compass, Loader, Code, RefreshCw, Sigma } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent } from '@/components/ui/card';
// import { generateGeogebraCommands } from '@/ai/flows/geogebra-flow'; // DÒNG NÀY BỊ XÓA
import { useSidebar } from '@/components/ui/sidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_BASE_URL } from '@/lib/utils'; // <-- THÊM DÒNG NÀY

type Message = {
  text: string;
  isUser: boolean;
  files?: { name: string, type: string, content: string }[];
};

type AttachedFile = {
  name: string;
  type: string;
  content: string; // base64 encoded
};

declare global {
  interface Window {
    GGBApplet: any;
  }
}

const latexSymbols = [
  { label: 'Toán tử', symbols: ['+', '-', '\\pm', '\\times', '\\div', '=', '\\neq', '>', '<', '\\geq', '\\leq'] },
  { label: 'Ký hiệu', symbols: ['\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\theta', '\\pi', '\\lambda', '\\mu', '\\sigma', '\\omega', '\\infty', '\\forall', '\\exists', '\\in', '\\notin', '\\cup', '\\cap', '\\subset', '\\supset', '\\approx'] },
  { label: 'Cấu trúc', symbols: ['\\frac{a}{b}', 'a^b', 'a_b', '\\sqrt{x}', '\\sqrt[n]{x}', '\\int_{a}^{b}', '\\sum_{i=1}^{n}', '\\lim_{x\\to\\infty}', '\\vec{a}', '\\log_{a}(b)'] }
];

const loadScript = (src: string, onLoad: () => void, onError: () => void) => {
  if (document.querySelector(`script[src="${src}"]`)) {
    if (typeof window.GGBApplet !== 'undefined') {
      onLoad();
    } else {
      // If script exists but GGBApplet is not ready, poll for it
      const interval = setInterval(() => {
        if (typeof window.GGBApplet !== 'undefined') {
          clearInterval(interval);
          onLoad();
        }
      }, 100);
    }
    return;
  }
  
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.onload = onLoad;
  script.onerror = onError;
  document.body.appendChild(script);
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // GeoGebra states
  const [geogebraPrompt, setGeogebraPrompt] = useState('');
  const [isGeogebraLoading, setIsGeogebraLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const ggbAppletRef = useRef<any>(null);
  const [isGgbScriptLoaded, setIsGgbScriptLoaded] = useState(false);
  const [isGgbReady, setIsGgbReady] = useState(false);
  const [geogebraError, setGeogebraError] = useState<string | null>(null);
  const [resultCommands, setResultCommands] = useState<string | null>(null);
  const ggbContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const { state: sidebarState } = useSidebar();

  useEffect(() => {
    // Initial chat greeting
    setMessages([{ text: "Xin chào! Hãy đặt câu hỏi toán học để bắt đầu. Tôi hỗ trợ công thức LaTeX!\n\nVí dụ: Giải phương trình $x^2 - 5x + 6 = 0$", isUser: false }]);
  }, []);
  
  useEffect(() => {
    if(isModalOpen && !isGgbScriptLoaded) {
      loadScript(
        'https://www.geogebra.org/apps/deployggb.js', 
        () => setIsGgbScriptLoaded(true),
        () => setGeogebraError("Không thể tải thư viện GeoGebra. Vui lòng kiểm tra kết nối mạng và thử lại.")
      );
    }
    
    if (isModalOpen && isGgbScriptLoaded && !ggbAppletRef.current) {
        initializeGeoGebra();
    }
    
    // Cleanup the observer on component unmount or when modal closes
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [isModalOpen, isGgbScriptLoaded]);

  // Effect to re-render GeoGebra on sidebar toggle
  useEffect(() => {
    if (ggbAppletRef.current && isModalOpen) {
       // A small delay allows the layout to settle before resizing
      setTimeout(() => {
        if (ggbContainerRef.current) {
          ggbAppletRef.current.setSize(ggbContainerRef.current.clientWidth, ggbContainerRef.current.clientHeight);
        }
      }, 300); // 300ms matches the sidebar transition duration
    }
  }, [sidebarState, isModalOpen]);

  const initializeGeoGebra = () => {
    if (!ggbContainerRef.current || !isGgbScriptLoaded || ggbAppletRef.current) return;
    
    setIsGgbReady(false);
    const isMobile = window.innerWidth < 640;
    const parameters = {
      "appName": "classic",
      "width": ggbContainerRef.current.clientWidth,
      "height": ggbContainerRef.current.clientHeight,
      "showToolBar": !isMobile,
      "showAlgebraInput": true,
      "showMenuBar": !isMobile,
      "enableShiftDragZoom": true,
      "showResetIcon": true,
      "language": "vi",
      "appletOnLoad": (api: any) => {
        ggbAppletRef.current = api;
        setIsGgbReady(true);
        console.log('GeoGebra applet loaded successfully.');
      }
    };

    const applet = new window.GGBApplet(parameters, true);
    applet.inject(ggbContainerRef.current);

    // Setup ResizeObserver
    if(ggbContainerRef.current){
        resizeObserverRef.current = new ResizeObserver(entries => {
            if (entries[0] && ggbAppletRef.current) {
                const { width, height } = entries[0].contentRect;
                ggbAppletRef.current.setSize(width, height);
            }
        });
        resizeObserverRef.current.observe(ggbContainerRef.current);
    }
  };
  
  const openModal = () => {
    setIsModalOpen(true);
  };

  const handleGeogebraSubmit = async (e: FormEvent) => {
  e.preventDefault();
  if (!geogebraPrompt.trim() || !isGgbReady) return;

  setIsGeogebraLoading(true);
  setGeogebraError(null);
  setResultCommands(null);

  try {
    const response = await fetch(`${API_BASE_URL}/api/geogebra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        request: geogebraPrompt,
        graph_type: 'function' 
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Không thể xử lý yêu cầu.');
    }
    
    const result = await response.json();

    if (result && result.commands && Array.isArray(result.commands)) {
      setResultCommands(result.commands.join('\n'));
      result.commands.forEach((command: string) => {
        try {
          if (ggbAppletRef.current) {
            ggbAppletRef.current.evalCommand(command);
          }
        } catch (cmdError) {
          console.error('Error executing GeoGebra command:', command, cmdError);
        }
      });
    } else {
      throw new Error('Invalid response format from server');
    }
  } catch (error: any) {
    console.error('Error generating GeoGebra commands:', error);
    setGeogebraError(error.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.");
  } finally {
    setIsGeogebraLoading(false);
  }
};
  const handleGeogebraClear = () => {
    if (ggbAppletRef.current) {
      ggbAppletRef.current.reset();
    }
    setGeogebraPrompt('');
    setGeogebraError(null);
    setResultCommands(null);
  };


  const handleSend = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0) return;

    const userMessageText = input.trim() || '📎 Đã gửi file đính kèm';
    const userMessage: Message = { text: userMessageText, isUser: true, files: attachedFiles };
    
    setIsLoading(true);
    setMessages(prev => [...prev, userMessage, { text: '', isUser: false }]);
    
    const currentInput = input;
    const currentFiles = attachedFiles;
    setInput('');
    setAttachedFiles([]);
    
    try {
      const media = currentFiles.map(file => ({ url: file.content }));

      // --- THAY ĐỔI URL FETCH ĐẾN BACKEND PYTHON ---
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, media }),
      });
      // --- KẾT THÚC THAY ĐỔI ---

      if (!response.ok) {
        let errorText = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
        try {
            const errorResult = await response.json();
            errorText = errorResult.detail || errorResult.error || errorText;
        } catch (e) {
             console.error("Failed to parse error response JSON", e);
             errorText = response.statusText;
        }
        throw new Error(errorText);
      }
      
      if (!response.body) {
        throw new Error('Response body is empty.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && !lastMessage.isUser) {
                newMessages[newMessages.length - 1] = { ...lastMessage, text: lastMessage.text + chunk };
            }
            return newMessages;
        });
      }
    } catch (error: any) {
      console.error('Error fetching chat response:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if(lastMessage && !lastMessage.isUser) {
            newMessages[newMessages.length - 1].text = `Đã có lỗi xảy ra: ${error.message}`;
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const filePromises = Array.from(files).map(file => {
      return new Promise<AttachedFile>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            name: file.name,
            type: file.type,
            content: e.target?.result as string,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(filePromises).then(newFiles => {
      setAttachedFiles(prev => [...prev, ...newFiles]);
    });

    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };


  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if(viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const insertLatex = (symbol: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = textareaRef.current.value;
      
      // For structures like \frac{a}{b}, we want to place the cursor inside the first bracket
      let cursorPosition = start + symbol.length;
      if (symbol.includes('{')) {
          cursorPosition = start + symbol.indexOf('{') + 1;
      } else {
        symbol += ' ';
        cursorPosition = start + symbol.length;
      }


      const newValue = text.substring(0, start) + symbol + text.substring(end);
      
      setInput(newValue);
      
      // Focus and set cursor position
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(cursorPosition, cursorPosition);
      }, 0);
    }
  };


  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-blue-100">
      <header className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-5 flex items-center gap-4 shadow-lg">
          <div className="relative">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md">
                  <Bot className="w-7 h-7 text-blue-500" />
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
          </div>
          <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white truncate">📚 CVT AI - Giải Toán THPT</h1>
              <p className="text-blue-100 text-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Đang hoạt động
              </p>
          </div>
          <Sparkles className="w-6 h-6 text-orange-200 animate-pulse" />
      </header>

      <ScrollArea className="flex-1 bg-gradient-to-b from-white to-blue-50" ref={scrollAreaRef}>
        <div className="space-y-6 p-6">
          {messages.map((message, index) => (
            <div key={index} className={cn("flex items-start gap-3", message.isUser ? "justify-end" : "justify-start")}>
               {!message.isUser && (
                <Avatar className="w-10 h-10 border-2 border-white shadow-md">
                  <AvatarFallback className="bg-gradient-to-br from-blue-400 to-cyan-500">
                    <Bot className="w-6 h-6 text-white" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={cn("max-w-[75%] rounded-2xl p-4 shadow-md", 
                message.isUser ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white" : "bg-white border border-blue-100",
                !message.text && !message.isUser && "hidden"
                )}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} className="prose dark:prose-invert max-w-none text-sm leading-relaxed prose-p:my-2"
                  components={{ p: ({node, ...props}) => <p style={{margin: 0}} {...props} /> }}
                  >
                      {message.text}
                  </ReactMarkdown>

                  {message.files && message.files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                          {message.files.map((file, idx) => (
                              <div key={idx} className="bg-white/30 px-3 py-1 rounded-lg text-xs flex items-center gap-2">
                                  <FileIcon className="w-3 h-3" />
                                  <span className="truncate max-w-[150px]">{file.name}</span>
                              </div>
                          ))}
                      </div>
                  )}

                {isLoading && !message.isUser && index === messages.length - 1 && (
                     <div className="flex gap-2 items-center mt-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                )}
              </div>
              {message.isUser && (
                <Avatar className="w-10 h-10 border-2 border-white shadow-md">
                  <AvatarFallback className='bg-gradient-to-br from-gray-600 to-gray-700'>
                    <User className="w-6 h-6 text-white" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 sm:px-6 sm:py-5 bg-white border-t border-blue-100">
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachedFiles.map((file, index) => (
              <div key={index} className="bg-blue-50 px-3 py-2 rounded-lg text-sm flex items-center gap-2 border border-blue-200">
                <FileIcon className="w-4 h-4 text-blue-600" />
                <span className="text-gray-700 truncate max-w-[150px]">{file.name}</span>
                <Button variant="ghost" size="icon" className="w-5 h-5 ml-1" onClick={() => removeFile(index)}>
                  <X className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-3 items-end">
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              className="hidden" 
            />
            <Button 
              type="button" 
              variant="default"
              className="flex-shrink-0 w-12 h-12 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
                <Paperclip className="w-5 h-5" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  type="button" 
                  variant="default"
                  className="flex-shrink-0 w-12 h-12 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl"
                  disabled={isLoading}
                >
                    <Sigma className="w-5 h-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  {latexSymbols.map((group) => (
                    <div key={group.label}>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">{group.label}</h4>
                      <div className="grid grid-cols-5 gap-1">
                        {group.symbols.map((symbol) => (
                          <Button key={symbol} variant="ghost" size="sm" className="h-auto text-base" onClick={() => insertLatex(symbol)}>
                            <ReactMarkdown remarkPlugins={[remarkMath]}>{`$${symbol}$`}</ReactMarkdown>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex-1 relative min-w-0">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Nhập câu hỏi của bạn..."
                  rows={1}
                  className="w-full px-5 py-3 pr-12 bg-blue-50 border-2 border-blue-200 rounded-2xl focus:border-blue-400 focus:bg-white resize-none transition-all"
                  style={{ minHeight: '50px', maxHeight: '150px' }}
                  disabled={isLoading}
                />
            </div>
            <Button 
                type="submit" 
                className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
            >
              <Send className="w-5 h-5" />
            </Button>
        </form>
         <p className="text-xs text-gray-400 mt-3 text-center">
            Nhấn Enter để gửi • Shift + Enter để xuống dòng
        </p>
      </div>

       <Button onClick={openModal} size="lg" className="h-auto fixed bottom-28 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center justify-center z-50 cursor-grab active:cursor-grabbing hover:scale-110">
         <Compass className="w-7 h-7" />
       </Button>

       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-0 gap-0 border-2 border-blue-200">
                <DialogHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 flex flex-row items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                            <Compass className="text-blue-500 w-6 h-6" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-white truncate">GeoGebra AI</DialogTitle>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="text-white hover:text-blue-100 static right-auto top-auto">
                        <X />
                    </Button>
                </DialogHeader>

                <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
                    <div className="w-full sm:w-96 bg-gradient-to-b from-blue-50 to-white border-b sm:border-b-0 sm:border-r border-blue-200 flex flex-col">
                        <div className="px-4 py-3 border-b border-blue-200 bg-white">
                            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                <Sparkles className="text-blue-500 w-5 h-5" />
                                Vẽ hình tự động
                            </h3>
                        </div>

                        <ScrollArea className="flex-1">
                            <form onSubmit={handleGeogebraSubmit} className="p-4 space-y-4">
                                <Card className="bg-blue-50 border border-blue-100">
                                    <CardHeader className='p-3 pb-2'>
                                        <CardTitleComponent className="text-sm text-blue-800">💡 Ví dụ:</CardTitleComponent>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0 text-sm text-gray-700">
                                        <ul className="space-y-1 list-disc list-inside">
                                            <li>Vẽ đường tròn tâm O bán kính 3</li>
                                            <li>Vẽ parabol y = x² - 4x + 3</li>
                                            <li>Vẽ tam giác ABC với A(1,2), B(3,4), C(5,1)</li>
                                        </ul>
                                    </CardContent>
                                </Card>

                                <div>
                                    <label htmlFor='ggb-ai-input' className="block text-sm font-medium text-gray-700 mb-2">
                                        Nhập yêu cầu vẽ hình:
                                    </label>
                                    <Textarea
                                        id="ggb-ai-input"
                                        value={geogebraPrompt}
                                        onChange={(e) => setGeogebraPrompt(e.target.value)}
                                        placeholder="VD: Vẽ đồ thị hàm số y = x² - 2x + 1"
                                        className="h-32 text-sm border-2 border-blue-200 rounded-lg focus:border-blue-400"
                                        disabled={isGeogebraLoading}
                                    />
                                </div>
                                
                                <Button
                                    type="submit"
                                    disabled={isGeogebraLoading || !geogebraPrompt.trim() || !isGgbReady}
                                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg"
                                >
                                    {isGeogebraLoading ? <Loader className="animate-spin" /> : <Send className="mr-2" />}
                                    {isGeogebraLoading ? "Đang xử lý..." : "Vẽ hình"}
                                </Button>

                                {geogebraError && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                                        {geogebraError}
                                    </div>
                                )}
                                {resultCommands && (
                                     <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                        <p className="text-sm font-medium text-green-800 mb-1 flex items-center gap-2"><Code /> Lệnh GeoGebra:</p>
                                        <pre className="text-xs bg-white p-2 rounded border border-green-300 overflow-x-auto text-gray-800">{resultCommands}</pre>
                                    </div>
                                )}
                            </form>
                        </ScrollArea>
                        <div className='p-4 border-t border-blue-200'>
                             <Button
                                onClick={handleGeogebraClear}
                                variant="outline"
                                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700"
                                disabled={isGeogebraLoading}
                            >
                                <RefreshCw className="mr-2" />
                                Xóa tất cả
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 p-4 bg-gradient-to-b from-white to-blue-50 overflow-hidden flex flex-col">
                        <div ref={ggbContainerRef} className="w-full h-full min-h-[300px] bg-white rounded-xl shadow-inner border border-blue-100 relative">
                          {(!isGgbScriptLoaded || !isGgbReady || geogebraError) && (
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 z-10 rounded-xl">
                                  <div className='flex flex-col items-center gap-4 text-center p-4'>
                                      {geogebraError ? <>
                                        <X className="text-destructive" size={48} />
                                        <p className='text-destructive-foreground font-semibold'>Lỗi tải GeoGebra</p>
                                        <p className='text-muted-foreground text-sm'>{geogebraError}</p>
                                      </> : <>
                                        <Loader className="animate-spin text-primary" size={48} />
                                        <p className='text-muted-foreground'>Đang tải công cụ vẽ hình...</p>
                                      </>}
                                  </div>
                              </div>
                          )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}
