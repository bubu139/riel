// [CODE FILE: bubu139/riel/riel-f4de1f56e545348352c306da2d48610a40fae0d9/frontend_nextjs/src/components/chat/GeoGebraModal.tsx]
'use client';

import { useState, useRef, useEffect, FormEvent, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Compass, Sparkles, Loader, Code, RefreshCw, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent } from '@/components/ui/card';
import { useSidebar } from '@/components/ui/sidebar';
// import { API_BASE_URL } from '@/lib/utils'; // <-- ĐÃ XÓA: Không còn gọi backend

// Khai báo GGBApplet trên window
declare global {
  interface Window {
    GGBApplet: any;
  }
}

// ========================================================================
// !!! CẢNH BÁO BẢO MẬT: KHÔNG BAO GIỜ ĐỂ API KEY Ở FRONTEND !!!
// API Key này sẽ bị lộ cho bất kỳ ai xem trang web của bạn.
// Đây là lý do tại sao kiến trúc ban đầu của bạn (gọi đến backend Python) 
// là cách làm đúng và an toàn hơn.
// 
// Áp dụng thay đổi này theo yêu cầu của bạn, nhưng RẤT KHUYẾN NGHỊ
// quay lại sử dụng backend và chỉ thay đổi PROMPT ở file main.py.
// ========================================================================
const API_KEY = 'AIzaSyAt0EJWAJSp55AbEYaQpR86dqmX99byTjI'; // <-- Key từ script của bạn
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;

// System prompt từ script của bạn
const SYSTEM_PROMPT = `Bạn là trợ lý thông minh chuyên vẽ hình học với GeoGebra.

NHIỆM VỤ: 
1. Phân tích yêu cầu người dùng
2. Suy nghĩ cách vẽ hợp lý (xác định các điểm, đường, hình cần thiết)
3. Chuyển đổi sang lệnh GeoGebra chính xác

QUY TRÌNH LÀM VIỆC:
Bước 1 - SUY NGHĨ (trong <thinking>):
- Phân tích yêu cầu: Cần vẽ gì?
- Xác định các thành phần: Điểm nào? Đường nào? Hình nào?
- Lên kế hoạch: Vẽ theo thứ tự nào? Cần tính toán gì?
- Chọn tọa độ/giá trị hợp lý để hình đẹp, cân đối

Bước 2 - XUẤT LỆNH:
- Chỉ trả về lệnh GeoGebra thuần túy
- Mỗi lệnh một dòng
- Không có chú thích hay giải thích

CÚ PHÁP GEOGEBRA:
# Cơ bản
- Điểm: A = (1, 2)
- Đường thẳng qua 2 điểm: Line(A, B)
- Đường thẳng từ phương trình: f: y = 2x + 1
- Đoạn thẳng: Segment(A, B)
- Đường tròn: Circle((0,0), 3) hoặc Circle(A, B)
- Vector: v = Vector((1,2)) hoặc Vector(A, B)

# Đa giác
- Tam giác: Polygon(A, B, C)
- Tứ giác: Polygon(A, B, C, D)
- Đa giác đều: RegularPolygon(A, B, 6)

# Hàm số
- Parabol: f: y = x^2 - 4x + 3
- Lượng giác: g: y = sin(x)
- Mũ/Log: h: y = e^x
- Phân thức: k: y = 1/x

# Nâng cao
- Giao điểm: E = Intersect(f, g)
- Trung điểm: M = Midpoint(A, B)
- Vuông góc: PerpendicularLine(A, f)
- Song song: Line(A, Vector(f))
- Tiếp tuyến: Tangent(A, c)

# Màu sắc và kiểu
- SetColor(A, "Red")
- SetPointSize(A, 5)
- SetLineThickness(f, 3)

VÍ DỤ:

Input: "Vẽ tam giác đều"
<thinking>
Cần vẽ tam giác đều. Chọn cách:
- Đặt đỉnh A, B trên trục hoành cách đều
- Tính đỉnh C sao cho AB = BC = CA
- A = (0,0), B = (4,0), C = (2, 2√3) ≈ (2, 3.46)
</thinking>
Output:
A = (0, 0)
B = (4, 0)
C = (2, 3.46)
Polygon(A, B, C)

Input: "Vẽ hình vuông và đường tròn nội tiếp"
<thinking>
Hình vuông: 4 đỉnh cách đều, tâm O
Đường tròn nội tiếp: tâm trùng tâm hình vuông, bán kính = cạnh/2
Chọn hình vuông cạnh 4, tâm (0,0)
Các đỉnh: (-2,-2), (2,-2), (2,2), (-2,2)
Bán kính đường tròn: 2
</thinking>
Output:
A = (-2, -2)
B = (2, -2)
C = (2, 2)
D = (-2, 2)
Polygon(A, B, C, D)
O = (0, 0)
Circle(O, 2)

Input: "Vẽ đồ thị hàm sin và cos trên cùng một hệ trục"
<thinking>
Vẽ 2 hàm lượng giác cơ bản
Dùng màu khác nhau để phân biệt
</thinking>
Output:
f: y = sin(x)
g: y = cos(x)
SetColor(f, "Blue")
SetColor(g, "Red")

LƯU Ý:
- Với yêu cầu mơ hồ, hãy tự quyết định tọa độ/kích thước hợp lý
- Ưu tiên tạo hình đẹp, cân đối, dễ nhìn
- Với hình phức tạp, chia nhỏ thành các bước đơn giản
- Đặt tên biến có ý nghĩa: A, B, C cho điểm; f, g, h cho hàm
- Luôn bắt đầu với <thinking> để suy nghĩ, sau đó xuất lệnh

CHỈ TRẢ VỀ: <thinking>...</thinking> sau đó là các lệnh GeoGebra thuần túy, không có text thừa.`;
// ========================================================================


interface GeoGebraModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeoGebraModal({ isOpen, onOpenChange }: GeoGebraModalProps) {
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

  // Logic tải Script (Giữ nguyên, logic này đã đúng)
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

  // Logic dọn dẹp (destroy) (Giữ nguyên)
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

  // Logic khởi tạo (Giữ nguyên)
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

  // Kích hoạt khởi tạo khi modal mở (Giữ nguyên)
  useEffect(() => {
    if (isOpen && isGgbScriptLoaded && !ggbAppletRef.current && !isInitializingRef.current) {
      initializeGeoGebra();
    }
  }, [isOpen, isGgbScriptLoaded, initializeGeoGebra]);

  // Logic Resize (Giữ nguyên)
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

  // Logic Resize khi sidebar thay đổi (Giữ nguyên)
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

  // Logic dọn dẹp khi đóng modal (Giữ nguyên)
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

  // Logic dọn dẹp khi unmount (Giữ nguyên)
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

  // ========================================================================
  // THAY THẾ HÀM NÀY BẰNG LOGIC TỪ SCRIPT CỦA BẠN
  // ========================================================================
  const handleGeogebraSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!geogebraPrompt.trim() || !isGgbReady) return;

    setIsGeogebraLoading(true);
    setGeogebraError(null);
    setResultCommands(null);

    try {
      // THAY ĐỔI: Gọi trực tiếp Google AI (Không an toàn!)
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: [{
            role: "user",
            parts: [{ text: geogebraPrompt }]
          }]
        }),
      });

      if (!response.ok) {
         let errorText = 'API request failed';
        try {
            const err = await response.json();
            errorText = err.detail || err.error?.message || 'Không thể xử lý yêu cầu API.';
        } catch (e) {
            console.error("Failed to parse error response JSON", e);
            errorText = response.statusText;
        }
        throw new Error(errorText);
      }
      
      const data = await response.json();

      // THAY ĐỔI: Lấy text từ response của Google AI
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts[0]) {
        throw new Error('Định dạng phản hồi từ AI không hợp lệ.');
      }
      const aiResponseText = data.candidates[0].content.parts[0].text.trim();

      // THAY ĐỔI: Phân tích text để lấy lệnh
      // Lọc bỏ block <thinking> và các dòng trống
      const commandLines = aiResponseText
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0 && !line.startsWith('<thinking>') && !line.startsWith('</thinking>'));
      
      if (commandLines.length === 0) {
          throw new Error('AI không trả về lệnh nào hợp lệ.');
      }

      setResultCommands(commandLines.join('\n'));
      for (const command of commandLines) {
        try {
          if (ggbAppletRef.current) {
            ggbAppletRef.current.evalCommand(command);
          }
        } catch (cmdError) {
          console.error('Error executing GeoGebra command:', command, cmdError);
          // Tùy chọn: Hiển thị lỗi từng lệnh cho người dùng
        }
      }
    } catch (error: any) {
      console.error('Error in handleGeogebraSubmit:', error);
      setGeogebraError(error.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    } finally {
      setIsGeogebraLoading(false);
    }
  };
  // ========================================================================
  // KẾT THÚC THAY THẾ
  // ========================================================================


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
                    {/* Thêm cảnh báo nếu là lỗi CORS */}
                    {geogebraError.includes('fetch') && (
                        <p className="mt-2 text-xs"><b>Gợi ý:</b> Lỗi này thường xảy ra do trình duyệt chặn yêu cầu (CORS) hoặc API key không hợp lệ. Hãy kiểm tra Console của trình duyệt (F12) và xem xét lại việc sử dụng backend an toàn.</p>
                    )}
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