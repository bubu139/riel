// [CODE FILE: bubu139/riel/riel-2a4b2cece120923e18e17157e6b72954a9a9237d/frontend_nextjs/src/components/chat/GeoGebraModal.tsx]
'use client';

import { useState, useRef, useEffect, FormEvent, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Compass, Sparkles, Loader, Code, RefreshCw, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent } from '@/components/ui/card';
import { useSidebar } from '@/components/ui/sidebar';
import { API_BASE_URL } from '@/lib/utils';

// Khai báo GGBApplet trên window
declare global {
  interface Window {
    GGBApplet: any;
  }
}

interface GeoGebraModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeoGebraModal({ isOpen, onOpenChange }: GeoGebraModalProps) {
  // Toàn bộ state và logic của GeoGebra được chuyển vào đây
  const [geogebraPrompt, setGeogebraPrompt] = useState('');
  const [isGeogebraLoading, setIsGeogebraLoading] = useState(false);
  const [geogebraState, setGeogebraState] = useState<string | null>(null);
  const ggbAppletRef = useRef<any>(null);
  const [isGgbScriptLoaded, setIsGgbScriptLoaded] = useState(false);
  const [isGgbReady, setIsGgbReady] = useState(false);
  const [geogebraError, setGeogebraError] = useState<string | null>(null);
  const [resultCommands, setResultCommands] = useState<string | null>(null);
  const ggbContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const { state: sidebarState } = useSidebar();
  
  const isInitializingRef = useRef(false);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Logic tải Script
  useEffect(() => {
    const scriptSrc = 'https://www.geogebra.org/apps/deployggb.js';

    if (typeof window.GGBApplet !== 'undefined') {
      console.log('GeoGebra script (already defined) found');
      if (!isGgbScriptLoaded) {
        setIsGgbScriptLoaded(true);
      }
      return;
    }

    const handleScriptLoad = () => {
      console.log('GeoGebra script loaded (onload event)');
      setIsGgbScriptLoaded(true);
    };

    const handleScriptError = () => {
      console.error('Failed to load GeoGebra script');
      setGeogebraError("Không thể tải thư viện GeoGebra. Vui lòng kiểm tra kết nối mạng và thử lại.");
    };
    
    let script = document.querySelector(`script[src="${scriptSrc}"]`) as HTMLScriptElement;

    if (script) {
      if (script.dataset.ggbListenersAttached !== 'true') {
        script.addEventListener('load', handleScriptLoad);
        script.addEventListener('error', handleScriptError);
        script.dataset.ggbListenersAttached = 'true';
        console.log('Attached listeners to existing GeoGebra script.');
      }
    } else {
      console.log('Creating new GeoGebra script element.');
      script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      script.addEventListener('load', handleScriptLoad);
      script.addEventListener('error', handleScriptError);
      script.dataset.ggbListenersAttached = 'true';
      document.body.appendChild(script);
    }
  }, [isGgbScriptLoaded]);

  // Logic dọn dẹp (destroy)
  const destroyGeoGebraApplet = useCallback(() => {
    try {
      if (ggbAppletRef.current) {
        try {
          if (typeof ggbAppletRef.current.removeApplet === 'function') {
            ggbAppletRef.current.removeApplet();
          } else if (typeof ggbAppletRef.current.remove === 'function') {
            ggbAppletRef.current.remove();
          } else if (typeof (ggbAppletRef.current as any).destroy === 'function') {
            (ggbAppletRef.current as any).destroy();
          }
        } catch (inner) {
          console.warn('GeoGebra applet removal method threw:', inner);
        }
        ggbAppletRef.current = null;
      }

      if (ggbContainerRef.current) {
        const wrapper = ggbContainerRef.current.querySelector('.ggb-wrapper');
        if (wrapper && wrapper.parentNode === ggbContainerRef.current) {
          ggbContainerRef.current.removeChild(wrapper);
        } else if (wrapper && wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
        }
      }
    } catch (err) {
      console.error('Error destroying GeoGebra applet safely:', err);
    }
  }, []);

  // Logic khởi tạo
  const initializeGeoGebra = useCallback(() => {
    if (isInitializingRef.current || ggbAppletRef.current || !ggbContainerRef.current || !isGgbScriptLoaded) {
      return;
    }

    console.log('Initializing GeoGebra...');
    isInitializingRef.current = true;
    setIsGgbReady(false);
    setGeogebraError(null);

    destroyGeoGebraApplet();

    initTimeoutRef.current = setTimeout(() => {
      if (!ggbContainerRef.current) {
        console.error('Container ref lost during initialization');
        isInitializingRef.current = false;
        return;
      }

      try {
        let wrapper = ggbContainerRef.current.querySelector('.ggb-wrapper') as HTMLDivElement | null;
        if (!wrapper) {
          wrapper = document.createElement('div');
          wrapper.className = 'ggb-wrapper';
          wrapper.style.width = '100%';
          wrapper.style.height = '100%';
          wrapper.style.position = 'absolute';
          wrapper.style.inset = '0';
          ggbContainerRef.current.appendChild(wrapper);
        } else {
          wrapper.innerHTML = '';
        }

        const isMobile = window.innerWidth < 640;
        const containerWidth = wrapper.clientWidth || ggbContainerRef.current.clientWidth;
        const containerHeight = wrapper.clientHeight || ggbContainerRef.current.clientHeight;

        const parameters = {
          appName: "classic",
          width: containerWidth || 800,
          height: containerHeight || 600,
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
            if (geogebraState) {
              api.setXML(geogebraState);
            }
          },
          error: (err: any) => {
            console.error('GeoGebra initialization error:', err);
            setGeogebraError("Lỗi khởi tạo GeoGebra. Vui lòng thử lại.");
            isInitializingRef.current = false;
          }
        };

        const applet = new window.GGBApplet(parameters, true);
        applet.inject(wrapper);

      } catch (error) {
        console.error('Error creating GeoGebra applet:', error);
        setGeogebraError("Lỗi khởi tạo GeoGebra. Vui lòng tải lại trang.");
        isInitializingRef.current = false;
      }
    }, 100);
  }, [isGgbScriptLoaded, destroyGeoGebraApplet, geogebraState]);

  // Kích hoạt khởi tạo khi modal mở
  useEffect(() => {
    if (isOpen && isGgbScriptLoaded && !ggbAppletRef.current && !isInitializingRef.current) {
      initializeGeoGebra();
    }
  }, [isOpen, isGgbScriptLoaded, initializeGeoGebra]);

  // Logic Resize
  useEffect(() => {
    if (!isGgbReady || !ggbContainerRef.current || !ggbAppletRef.current) {
      return;
    }
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
    resizeObserverRef.current = new ResizeObserver((entries) => {
      if (entries[0] && ggbAppletRef.current) {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
          resizeTimeoutRef.current = setTimeout(() => {
            if (ggbAppletRef.current) {
              try {
                ggbAppletRef.current.setSize(width, height);
              } catch (err) {
                console.warn('Failed to set GeoGebra size:', err);
              }
            }
          }, 150);
        }
      }
    });
    resizeObserverRef.current.observe(ggbContainerRef.current);

    return () => {
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [isGgbReady]);

  // Logic Resize khi sidebar thay đổi
  useEffect(() => {
    if (ggbAppletRef.current && isOpen && isGgbReady && ggbContainerRef.current) {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      
      resizeTimeoutRef.current = setTimeout(() => {
        if (ggbContainerRef.current && ggbAppletRef.current) {
          const wrapper = ggbContainerRef.current.querySelector('.ggb-wrapper') as HTMLDivElement | null;
          const width = (wrapper ? wrapper.clientWidth : ggbContainerRef.current.clientWidth);
          const height = (wrapper ? wrapper.clientHeight : ggbContainerRef.current.clientHeight);
          if (width > 0 && height > 0) {
            try {
              ggbAppletRef.current.setSize(width, height);
            } catch (err) {
              console.warn('Failed to set GeoGebra size on sidebar change:', err);
            }
          }
        }
      }, 350);
    }
  }, [sidebarState, isOpen, isGgbReady]);

  // Logic dọn dẹp khi đóng modal
  useEffect(() => {
    if (!isOpen) {
      if (ggbAppletRef.current) {
        setGeogebraState(ggbAppletRef.current.getXML());
      }
      destroyGeoGebraApplet();

      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    }
  }, [isOpen, destroyGeoGebraApplet]);

  // Logic dọn dẹp khi unmount
  useEffect(() => {
    return () => {
      try {
        if (ggbAppletRef.current) {
          setGeogebraState(ggbAppletRef.current.getXML());
        }
        destroyGeoGebraApplet();
      } catch (err) {
        console.warn('Error during unmount destroyGeoGebraApplet', err);
      }
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    };
  }, [destroyGeoGebraApplet]);

  // Các hàm xử lý sự kiện
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
        for (const command of result.commands) {
          try {
            if (ggbAppletRef.current) {
              ggbAppletRef.current.evalCommand(command);
            }
          } catch (cmdError) {
            console.error('Error executing GeoGebra command:', command, cmdError);
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
      } catch (error) {
        console.error('Error resetting GeoGebra:', error);
      }
    }
    setGeogebraPrompt('');
    setGeogebraError(null);
    setResultCommands(null);
  };
  
  const handleRetryLoad = () => {
    setGeogebraError(null);
    setIsGgbScriptLoaded(false); // Reset để trigger useEffect tải script
    destroyGeoGebraApplet();
    ggbAppletRef.current = null;
    isInitializingRef.current = false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-0 gap-0 border-2 border-blue-200">
        <DialogHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 flex flex-row items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0">
              <Compass className="text-blue-500 w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-white truncate">GeoGebra AI</DialogTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="text-white hover:text-blue-100 static right-auto top-auto">
            <X />
          </Button>
        </DialogHeader>

        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          {/* Bảng điều khiển bên trái */}
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
            </ScrollArea>
            
            <div className='p-4 border-t border-blue-200'>
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

          {/* Vùng canvas bên phải */}
          <div className="flex-1 p-4 bg-gradient-to-b from-white to-blue-50 overflow-hidden flex flex-col">
            <div 
              ref={ggbContainerRef} 
              className="w-full h-full min-h-[300px] bg-white rounded-xl shadow-inner border border-blue-100 relative"
            >
              {(!isGgbScriptLoaded || !isGgbReady || geogebraError) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 z-10 rounded-xl">
                  <div className='flex flex-col items-center gap-4 text-center p-4'>
                    {geogebraError ? (
                      <>
                        <X className="text-destructive" size={48} />
                        <p className='text-destructive-foreground font-semibold'>Lỗi tải GeoGebra</p>
                        <p className='text-muted-foreground text-sm'>{geogebraError}</p>
                        <Button 
                          onClick={handleRetryLoad} // Sử dụng hàm retry đã tạo
                          variant="outline"
                        >
                          Thử lại
                        </Button>
                      </>
                    ) : (
                      <>
                        <Loader className="animate-spin text-primary" size={48} />
                        <p className='text-muted-foreground'>Đang tải công cụ vẽ hình...</p>
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
  );
}
