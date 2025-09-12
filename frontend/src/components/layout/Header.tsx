import { Menu, Settings, Activity, Bell, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

interface HeaderProps {
  onMenuToggle: () => void;
  isMenuCollapsed: boolean;
}

export function Header({ onMenuToggle, isMenuCollapsed }: HeaderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // 온라인 상태 감지
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 시간 업데이트
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(timer);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700/50 backdrop-blur-xl shadow-lg">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="md:hidden lg:flex h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all duration-200"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">메뉴 토글</span>
          </Button>

          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Measure OS</h1>
              <p className="text-xs text-slate-400">계측 시스템 v1.0</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          {/* 현재 시간 */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-2 bg-slate-700/50 rounded-lg">
            <div className="text-sm font-mono text-slate-300">
              {currentTime.toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
          </div>

          {/* 연결 상태 */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-slate-700/50 rounded-lg">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-400" />
            )}
            <Badge
              className={`text-xs border-0 ${
                isOnline
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : "bg-red-500/20 text-red-400 border-red-500/30"
              }`}
            >
              {isOnline ? "온라인" : "오프라인"}
            </Badge>
          </div>

          {/* 알림 */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all duration-200"
          >
            <Bell className="h-5 w-5" />
            <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs bg-gradient-to-r from-red-500 to-pink-500 border-0">
              3
            </Badge>
            <span className="sr-only">알림</span>
          </Button>

          {/* 설정 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all duration-200"
          >
            <Settings className="h-5 w-5" />
            <span className="sr-only">설정</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
