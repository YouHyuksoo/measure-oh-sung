"use client"

import { useState, useEffect } from "react"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import { cn } from "@/lib/utils"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // 모바일 화면 감지
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true)
      }
    }

    checkIsMobile()
    window.addEventListener("resize", checkIsMobile)

    return () => {
      window.removeEventListener("resize", checkIsMobile)
    }
  }, [])

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <Header 
        onMenuToggle={handleSidebarToggle}
        isMenuCollapsed={sidebarCollapsed}
      />

      <div className="flex">
        {/* 사이드바 */}
        <aside
          className={cn(
            "fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] transition-transform duration-300",
            isMobile && sidebarCollapsed && "-translate-x-full",
            "lg:translate-x-0"
          )}
        >
          <Sidebar 
            isCollapsed={sidebarCollapsed}
            onToggle={handleSidebarToggle}
          />
        </aside>

        {/* 모바일에서 사이드바가 열린 경우 오버레이 */}
        {isMobile && !sidebarCollapsed && (
          <div
            className="fixed inset-0 top-14 z-20 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={handleSidebarToggle}
          />
        )}

        {/* 메인 콘텐츠 */}
        <main
          className={cn(
            "flex-1 transition-all duration-300",
            isMobile 
              ? "ml-0" 
              : sidebarCollapsed 
                ? "ml-16" 
                : "ml-72"
          )}
        >
          <div className="w-full p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}