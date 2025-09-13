import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Activity,
  Settings,
  Database,
  Zap,
  BarChart3,
  Wrench,
  FileText,
  ChevronLeft,
  ChevronRight,
  Play,
  Home,
  Shield,
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const menuItems = [
  {
    title: "대시보드",
    href: "/",
    icon: Home,
    description: "시스템 현황 및 개요",
  },
  {
    title: "Power검사",
    href: "/inspection",
    icon: Play,
    description: "바코드 스캔 및 실시간 측정",
  },
  {
    title: "3대안전검사",
    href: "/safety-inspection",
    icon: Shield,
    description: "내전압, 절연저항, 접지연속 검사",
  },
  {
    title: "측정 데이터",
    href: "/measurements",
    icon: BarChart3,
    description: "측정 결과 조회 및 분석",
  },
  {
    title: "장비 관리",
    href: "/devices",
    icon: Zap,
    description: "계측 장비 연결 및 설정",
  },
  {
    title: "검사 모델",
    href: "/inspection-models",
    icon: Database,
    description: "검사 모델 관리",
  },
  {
    title: "테스트 설정",
    href: "/test-settings",
    icon: Settings,
    description: "검사 시간 및 조건 설정",
  },
  {
    title: "시스템 로그",
    href: "/logs",
    icon: FileText,
    description: "시스템 이벤트 로그",
  },
  {
    title: "시스템 설정",
    href: "/system-settings",
    icon: Wrench,
    description: "시스템 환경 설정",
  },
];

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "relative flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700/50 transition-all duration-300 shadow-2xl",
        isCollapsed ? "w-16" : "w-72"
      )}
    >
      {/* 메뉴 항목 */}
      <nav
        className={cn(
          "flex-1 space-y-3 overflow-y-auto",
          isCollapsed ? "p-2 pt-4" : "p-4 pt-6"
        )}
      >
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "group relative flex items-center rounded-xl transition-all duration-200 cursor-pointer mb-1",
                  isCollapsed
                    ? "justify-center px-2 py-3"
                    : "space-x-3 px-4 py-4",
                  isActive
                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 shadow-lg"
                    : "hover:bg-slate-700/50 hover:shadow-md"
                )}
              >
                {/* 활성 상태 표시 */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full" />
                )}

                {/* 아이콘 */}
                <div
                  className={cn(
                    "flex-shrink-0 rounded-lg transition-all duration-200",
                    isCollapsed ? "p-2" : "p-2",
                    isActive
                      ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg"
                      : "bg-slate-700/50 text-slate-400 group-hover:bg-slate-600/50 group-hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {/* 텍스트 */}
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 space-y-1">
                    <div
                      className={cn(
                        "text-sm font-semibold transition-colors duration-200 leading-tight",
                        isActive
                          ? "text-white"
                          : "text-slate-300 group-hover:text-white"
                      )}
                    >
                      {item.title}
                    </div>
                    <div
                      className={cn(
                        "text-xs transition-colors duration-200 truncate leading-tight",
                        isActive
                          ? "text-blue-200"
                          : "text-slate-500 group-hover:text-slate-300"
                      )}
                    >
                      {item.description}
                    </div>
                  </div>
                )}

                {/* 호버 효과 */}
                {!isCollapsed && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="h-2 w-2 bg-white/60 rounded-full" />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* 하단 상태 표시 */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-700/50">
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                <div className="absolute inset-0 h-3 w-3 rounded-full bg-green-500/30 animate-ping" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-green-400">
                  시스템 정상
                </div>
                <div className="text-xs text-green-300/80">
                  모든 서비스 동작 중
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 축소된 상태일 때 상태 표시 */}
      {isCollapsed && (
        <div className="p-2 border-t border-slate-700/50">
          <div className="flex justify-center">
            <div className="relative">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <div className="absolute inset-0 h-2 w-2 rounded-full bg-green-500/30 animate-ping" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
