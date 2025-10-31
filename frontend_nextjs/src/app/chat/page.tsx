'use client';
import { useState, useRef, useEffect, FormEvent, useCallback } from 'react';
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
import { useSidebar } from '@/components/ui/sidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_BASE_URL } from '@/lib/utils';

type Message = {
  text: string;
  isUser: boolean;
  files?: { name: string, type: string, content: string }[];
};

type AttachedFile = {
  name: string;
  type: string;
  content: string;
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  
  // scroll refs
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  // GeoGebra states
  const [geogebraPrompt, setGeogebraPrompt] = useState('');
  const [isGeogebraLoading, setIsGeogebraLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [geogebraState, setGeogebraState] = useState<string | null>(null);
  const ggbAppletRef = useRef<any>(null);
  const [isGgbScriptLoaded, setIsGgbScriptLoaded] = useState(false);
  const [isGgbReady, setIsGgbReady] = useState(false);
  const [geogebraError, setGeogebraError] = useState<string | null>(null);
  const [resultCommands, setResultCommands] = useState<string | null>(null);
  const ggbContainerRef = useRef<HTMLDivElement>(null);
  const { state: sidebarState } = useSidebar();
  
  const isInitializingRef = useRef(false);

  useEffect(() => {
    setMessages([{ 
      text: "Xin chào! Hãy đặt câu hỏi toán học để bắt đầu. Tôi hỗ trợ công thức LaTeX!\n\nVí dụ: Giải phương trình $x^2 - 5x + 6 = 0$", 
      isUser: false 
    }]);
  }, []);

  // Load GeoGebra script
  useEffect(() => {
    if (typeof window !== 'undefined' && !isGgbScriptLoaded) {
      const existingScript = document.querySelector('script[src="https://www.geogebra.org/apps/deployggb.js"]');
      
      if (existingScript && typeof window.GGBApplet !== 'undefined') {
        console.log('GeoGebra script already loaded');
        setIsGgbScriptLoaded(true);
        return;
      }

      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://www.geogebra.org/apps/deployggb.js';
        script.async = true;
        script.onload = () => {
          console.log('GeoGebra script loaded successfully');
          setIsGgbScriptLoaded(true);
        };
        script.onerror = () => {
          console.error('Failed to load GeoGebra script');
          setGeogebraError("Không thể tải thư viện GeoGebra. Vui lòng kiểm tra kết nối mạng.");
        };
        document.body.appendChild(script);
      }
    }
  }, [isGgbScriptLoaded]);

  // Destroy GeoGebra applet safely
  const destroyGeoGebraApplet = useCallback(() => {
    console.log('Destroying GeoGebra applet...');
    try {
      if (ggbAppletRef.current) {
        console.log('Removing applet instance');
        ggbAppletRef.current = null;
      }

      if (ggbContainerRef.current) {
        console.log('Clearing container');
        ggbContainerRef.current.innerHTML = '';
      }
      
      setIsGgbReady(false);
      isInitializingRef.current = false;
    } catch (err) {
      console.error('Error destroying GeoGebra applet:', err);
    }
  }, []);

  // Initialize GeoGebra when modal opens
  const initializeGeoGebra = useCallback(() => {
    if (isInitializingRef.current || !ggbContainerRef.current || !isGgbScriptLoaded || typeof window === 'undefined') {
      console.log('Cannot initialize:', { 
        isInitializing: isInitializingRef.current, 
        hasContainer: !!ggbContainerRef.current, 
        scriptLoaded: isGgbScriptLoaded 
      });
      return;
    }

    console.log('Starting GeoGebra initialization...');
    isInitializingRef.current = true;
    setIsGgbReady(false);
    setGeogebraError(null);

    // Clear any existing content
    destroyGeoGebraApplet();

    setTimeout(() => {
      try {
        if (!ggbContainerRef.current) {
          console.error('Container disappeared during initialization');
          isInitializingRef.current = false;
          return;
        }

        const container = ggbContainerRef.current;
        const isMobile = window.innerWidth < 640;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        console.log('Container dimensions:', { width, height, isMobile });

        const parameters = {
          appName: "classic",
          width: width,
          height: height,
          showToolBar: !isMobile,
          showAlgebraInput: true,
          showMenuBar: !isMobile,
          enableShiftDragZoom: true,
          showResetIcon: true,
          language: "vi",
          appletOnLoad: (api: any) => {
            console.log('GeoGebra applet loaded successfully');
            ggbAppletRef.current = api;
            setIsGgbReady(true);
            isInitializingRef.current = false;
            
            // Restore state if exists
            if (geogebraState) {
              try {
                api.setXML(geogebraState);
                console.log('State restored');
              } catch (err) {
                console.error('Failed to restore state:', err);
              }
            }
          },
          error: (err: any) => {
            console.error('GeoGebra initialization error:', err);
            setGeogebraError("Lỗi khởi tạo GeoGebra. Vui lòng thử lại.");
            isInitializingRef.current = false;
          }
        };

        console.log('Creating GGBApplet with parameters:', parameters);
        const applet = new window.GGBApplet(parameters, true);
        console.log('Injecting applet into container');
        applet.inject(container);

      } catch (error) {
        console.error('Error creating GeoGebra applet:', error);
        setGeogebraError("Lỗi khởi tạo GeoGebra. Vui lòng tải lại trang.");
        isInitializingRef.current = false;
      }
    }, 100);
  }, [isGgbScriptLoaded, destroyGeoGebraApplet, geogebraState]);

  // Initialize when modal opens and script is ready
  useEffect(() => {
    if (isModalOpen && isGgbScriptLoaded && !ggbAppletRef.current && !isInitializingRef.current) {
      console.log('Modal opened, initializing GeoGebra...');
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initializeGeoGebra();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen, isGgbScriptLoaded, initializeGeoGebra]);

  // Handle sidebar resize
  useEffect(() => {
    if (ggbAppletRef.current && isModalOpen && isGgbReady && ggbContainerRef.current) {
      const timer = setTimeout(() => {
        if (ggbContainerRef.current && ggbAppletRef.current) {
          const width = ggbContainerRef.current.clientWidth;
          const height = ggbContainerRef.current.clientHeight;
          console.log('Resizing GeoGebra:', { width, height });
          try {
            ggbAppletRef.current.setSize(width, height);
          } catch (err) {
            console.warn('Failed to resize GeoGebra:', err);
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [sidebarState, isModalOpen, isGgbReady]);

  // Cleanup on modal close
  useEffect(() => {
    if (!isModalOpen && ggbAppletRef.current) {
      console.log('Modal closed, saving state and cleaning up');
      try {
        const xml = ggbAppletRef.current.getXML();
        setGeogebraState(xml);
      } catch (err) {
        console.warn('Failed to save state:', err);
      }
      destroyGeoGebraApplet();
    }
  }, [isModalOpen, destroyGeoGebraApplet]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Component unmounting, cleaning up');
      destroyGeoGebraApplet();
    };
  }, [destroyGeoGebraApplet]);

  const openModal = () => {
    console.log('Opening GeoGebra modal');
    setIsModalOpen(true);
  };

  const handleGeogebraSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!geogebraPrompt.trim() || !isGgbReady) {
      console.log('Cannot submit:', { prompt: geogebraPrompt.trim(), ready: isGgbReady });
      return;
    }

    setIsGeogebraLoading(true);
    setGeogebraError(null);
    setResultCommands(null);

    try {
      console.log('Sending request to backend:', geogebraPrompt);
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
      console.log('Received commands:', result);

      if (result && result.commands && Array.isArray(result.commands)) {
        setResultCommands(result.commands.join('\n'));
        
        // Execute commands
        for (const command of result.commands) {
          try {
            console.log('Executing command:', command);
            if (ggbAppletRef.current) {
              ggbAppletRef.current.evalCommand(command);
            }
          } catch (cmdError) {
            console.error('Error executing command:', command, cmdError);
          }
        }
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
      try {
        ggbAppletRef.current.reset();
        console.log('GeoGebra reset');
      } catch (error) {
        console.error('Error resetting GeoGebra:', error);
      }
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

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, media }),
      });

      if (!response.ok) {
        let errorText = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
        try {
          const errorResult = await response.json();
          errorText = errorResult.detail || errorResult.error || errorText;
        } catch (e) {
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
        if (lastMessage && !lastMessage.isUser) {
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

  // Auto-scroll
  useEffect(() => {
    if (!scrollAreaRef.current) return;
    
    const scrollContainer = scrollAreaRef.current;
    
    const t = window.setTimeout(() => {
      try {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      } catch {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }, 50);

    return () => clearTimeout(t);
  }, [messages]);

  // Adjust padding
  useEffect(() => {
    const adjustPadding = () => {
      if (inputContainerRef.current && scrollAreaRef.current) {
        const height = inputContainerRef.current.clientHeight;
        scrollAreaRef.current.style.paddingBottom = `${height}px`;
      }
    };

    adjustPadding();
    window.addEventListener('resize', adjustPadding);

    const observer = new ResizeObserver(adjustPadding);
    if (textareaRef.current) {
      observer.observe(textareaRef.current);
    }

    return () => {
      window.removeEventListener('resize', adjustPadding);
      observer.disconnect();
    };
  }, [attachedFiles, input]);

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
      
      let cursorPosition = start + symbol.length;
      if (symbol.includes('{')) {
        cursorPosition = start + symbol.indexOf('{') + 1;
      } else {
        symbol += ' ';
        cursorPosition = start + symbol.length;
      }

      const newValue = text.substring(0, start) + symbol + text.substring(end);
      
      setInput(newValue);
      
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(cursorPosition, cursorPosition);
      }, 0);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-blue-100 relative">
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

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-blue-50" ref={scrollAreaRef}>
        <div className="p-6 flex flex-col gap-6">
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
            <div ref={endRef} />
           </div>
      </div>

      <div ref={inputContainerRef} className="fixed bottom-0 left-0 right-0 p-4 sm:px-6 sm:py-5 bg-white border-t border-blue-100 z-10">
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

      <Button 
        onClick={openModal} 
        size="lg" 
        className="fixed bottom-28 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center justify-center z-50 hover:scale-110"
      >
        <Compass className="w-7 h-7" />
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0 gap-0 border-2 border-blue-200">
          <DialogHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 flex flex-row items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                <Compass className="text-blue-500 w-6 h-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-white truncate">GeoGebra AI</DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
            {/* Control Panel */}
            <div className="w-full lg:w-96 bg-gradient-to-b from-blue-50 to-white border-b lg:border-b-0 lg:border-r border-blue-200 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-blue-200 bg-white flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Sparkles className="text-blue-500 w-5 h-5" />
                  Vẽ hình tự động
                </h3>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-4">
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

                  <form onSubmit={handleGeogebraSubmit} className="space-y-4">
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
                        disabled={isGeogebraLoading || !isGgbReady}
                      />
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={isGeogebraLoading || !geogebraPrompt.trim() || !isGgbReady}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg"
                    >
                      {isGeogebraLoading ? (
                        <>
                          <Loader className="animate-spin mr-2" />
                          Đang xử lý...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2" />
                          Vẽ hình
                        </>
                      )}
                    </Button>

                    {geogebraError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                        {geogebraError}
                      </div>
                    )}
                    
                    {resultCommands && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-green-800 mb-1 flex items-center gap-2">
                          <Code className="w-4 h-4" /> 
                          Lệnh GeoGebra:
                        </p>
                        <pre className="text-xs bg-white p-2 rounded border border-green-300 overflow-x-auto text-gray-800">
                          {resultCommands}
                        </pre>
                      </div>
                    )}
                  </form>
                </div>
              </ScrollArea>
              
              <div className='p-4 border-t border-blue-200 flex-shrink-0'>
                <Button
                  onClick={handleGeogebraClear}
                  variant="outline"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700"
                  disabled={isGeogebraLoading || !isGgbReady}
                >
                  <RefreshCw className="mr-2" />
                  Xóa tất cả
                </Button>
              </div>
            </div>

            {/* GeoGebra Canvas */}
            <div className="flex-1 p-4 bg-gradient-to-b from-white to-blue-50 overflow-hidden flex flex-col min-h-0">
              <div 
                ref={ggbContainerRef}
                id="geogebra-container"
                className="w-full h-full min-h-[400px] bg-white rounded-xl shadow-inner border border-blue-100 relative overflow-hidden"
              >
                {/* Loading/Error Overlay */}
                {(!isGgbScriptLoaded || !isGgbReady || geogebraError) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 backdrop-blur-sm z-10 rounded-xl">
                    <div className='flex flex-col items-center gap-4 text-center p-4 max-w-md'>
                      {geogebraError ? (
                        <>
                          <X className="text-destructive" size={48} />
                          <p className='text-destructive-foreground font-semibold text-lg'>Lỗi tải GeoGebra</p>
                          <p className='text-muted-foreground text-sm'>{geogebraError}</p>
                          <Button 
                            onClick={() => {
                              setGeogebraError(null);
                              setIsGgbScriptLoaded(false);
                              destroyGeoGebraApplet();
                              // Trigger reload by closing and reopening modal
                              setIsModalOpen(false);
                              setTimeout(() => setIsModalOpen(true), 100);
                            }}
                            variant="outline"
                          >
                            Thử lại
                          </Button>
                        </>
                      ) : !isGgbScriptLoaded ? (
                        <>
                          <Loader className="animate-spin text-primary" size={48} />
                          <p className='text-muted-foreground font-medium'>Đang tải thư viện GeoGebra...</p>
                          <p className='text-muted-foreground text-xs'>Vui lòng đợi trong giây lát</p>
                        </>
                      ) : (
                        <>
                          <Loader className="animate-spin text-primary" size={48} />
                          <p className='text-muted-foreground font-medium'>Đang khởi tạo công cụ vẽ hình...</p>
                          <p className='text-muted-foreground text-xs'>Sắp hoàn tất</p>
                        </>
                      )}
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
