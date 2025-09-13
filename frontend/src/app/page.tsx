"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Zap,
  Database,
  Clock,
  RefreshCw,
  AlertCircle,
  Play,
} from "lucide-react";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import Link from "next/link";

interface DashboardStats {
  inspectionStatus: string;
  connectedDevices: number;
  totalDevices: number;
  activeModels: number;
  todayInspections: {
    total: number;
    pass: number;
    fail: number;
  };
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>({
    inspectionStatus: "idle",
    connectedDevices: 0,
    totalDevices: 0,
    activeModels: 0,
    todayInspections: { total: 0, pass: 0, fail: 0 },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/inspection";
  const { isConnected: wsConnected, lastMessage } = useWebSocket(wsUrl);

  // 실시간 데이터 업데이트
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === "inspection_status") {
        setStats((prev) => ({
          ...prev,
          inspectionStatus: lastMessage.data.is_listening ? "running" : "idle",
        }));
        setLastUpdated(new Date());
      }
    }
  }, [lastMessage]);

  // 주기적 데이터 로드
  useEffect(() => {
    loadDashboardData();

    const interval = setInterval(loadDashboardData, 30000); // 30초마다
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      const [
        inspectionStatus,
        devicesResponse,
        modelsResponse,
        measurementsResponse,
      ] = await Promise.all([
        apiClient.getInspectionStatus().catch(() => ({ is_listening: false })),
        apiClient.getDevices().catch(() => []),
        apiClient.getInspectionModelsAll().catch(() => []),
        apiClient.getMeasurements().catch(() => []),
      ]);

      // API 응답에서 배열 추출
      const typedDevices = Array.isArray(devicesResponse)
        ? devicesResponse
        : (devicesResponse as any)?.devices || [];
      const typedModels = Array.isArray(modelsResponse)
        ? modelsResponse
        : (modelsResponse as any)?.models || [];
      const typedMeasurements = Array.isArray(measurementsResponse)
        ? measurementsResponse
        : (measurementsResponse as any)?.measurements || [];

      // 오늘 날짜 계산
      const today = new Date().toDateString();
      const todayMeasurements = typedMeasurements.filter(
        (m: any) => new Date(m.timestamp).toDateString() === today
      );

      setStats({
        inspectionStatus: (inspectionStatus as any).is_listening
          ? "running"
          : "idle",
        connectedDevices: typedDevices.filter(
          (d: any) => d.connection_status === "CONNECTED"
        ).length,
        totalDevices: typedDevices.length,
        activeModels: typedModels.filter((m: any) => m.is_active).length,
        todayInspections: {
          total: todayMeasurements.length,
          pass: todayMeasurements.filter((m: any) => m.result === "PASS")
            .length,
          fail: todayMeasurements.filter((m: any) => m.result === "FAIL")
            .length,
        },
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error("대시보드 데이터 로드 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!wsConnected) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          연결 끊김
        </Badge>
      );
    }

    switch (stats.inspectionStatus) {
      case "running":
        return <Badge variant="success">검사 중</Badge>;
      default:
        return <Badge variant="secondary">대기 중</Badge>;
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="space-y-6 p-4">
        {/* 페이지 헤더 - 컴팩트하게 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              대시보드
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              계측 시스템 현황 모니터링
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <div className="text-right text-xs">
                <p className="text-slate-500 dark:text-slate-400">
                  마지막 업데이트
                </p>
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {lastUpdated.toLocaleTimeString("ko-KR")}
                </p>
              </div>
            )}
            <Button
              onClick={loadDashboardData}
              variant="outline"
              size="icon"
              disabled={isLoading}
              className="h-8 w-8 rounded-full"
            >
              <RefreshCw
                className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* 상태 카드들 - 컴팩트하게 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 검사 상태 카드 */}
          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  검사 상태
                </CardTitle>
                <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {getStatusBadge()}
              <p className="text-xs text-blue-600 dark:text-blue-400">
                {stats.inspectionStatus === "running" ? "진행 중" : "대기 중"}
              </p>
            </CardContent>
          </Card>

          {/* 연결된 장비 카드 */}
          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-green-700 dark:text-green-300">
                  연결된 장비
                </CardTitle>
                <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {stats.connectedDevices}
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">
                총 {stats.totalDevices}대 중 연결됨
              </p>
            </CardContent>
          </Card>

          {/* 검사 모델 카드 */}
          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                  검사 모델
                </CardTitle>
                <Database className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {stats.activeModels}
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                활성 모델 수
              </p>
            </CardContent>
          </Card>

          {/* 오늘 검사 카드 */}
          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                  오늘 검사
                </CardTitle>
                <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {stats.todayInspections.total}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-600 dark:text-green-400">
                    {stats.todayInspections.pass}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-600 dark:text-red-400">
                    {stats.todayInspections.fail}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 빠른 시작 섹션 - 컴팩트하게 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 빠른 시작 카드 */}
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4">
              <CardTitle className="text-lg font-bold text-white mb-1">
                빠른 시작
              </CardTitle>
              <CardDescription className="text-indigo-100 text-sm">
                검사를 시작하기 위한 단계별 가이드
              </CardDescription>
            </div>
            <CardContent className="p-4 space-y-4">
              {/* 단계별 진행 상황 - 컴팩트하게 */}
              <div className="space-y-2">
                {/* 1단계 */}
                <div className="flex items-center space-x-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-green-800 dark:text-green-200">
                      장비 연결 확인
                    </h4>
                  </div>
                  <Badge className="bg-green-500 text-white border-0 text-xs px-2 py-0">
                    완료
                  </Badge>
                </div>

                {/* 2단계 */}
                <div className="flex items-center space-x-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-green-800 dark:text-green-200">
                      검사 모델 선택
                    </h4>
                  </div>
                  <Badge className="bg-green-500 text-white border-0 text-xs px-2 py-0">
                    완료
                  </Badge>
                </div>

                {/* 3단계 */}
                <div className="flex items-center space-x-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                      바코드 스캔
                    </h4>
                  </div>
                  <Badge variant="outline" className="border-blue-300 text-blue-600 dark:text-blue-400 text-xs px-2 py-0">
                    대기 중
                  </Badge>
                </div>
              </div>

              {/* 검사 시작 버튼 */}
              <Link href="/inspection" className="block">
                <Button className="w-full h-10 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200">
                  <Play className="h-4 w-4 mr-2" />
                  검사 시작하기
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 시스템 정보 카드 */}
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 p-4">
              <CardTitle className="text-lg font-bold text-white mb-1">
                시스템 정보
              </CardTitle>
              <CardDescription className="text-slate-200 text-sm">
                현재 시스템 상태 및 연결 정보
              </CardDescription>
            </div>
            <CardContent className="p-4">
              {/* 시스템 상태 항목들 - 컴팩트하게 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      백엔드 서버
                    </span>
                  </div>
                  <Badge className="bg-green-500 text-white border-0 text-xs px-2 py-0">
                    정상
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      데이터베이스
                    </span>
                  </div>
                  <Badge className="bg-green-500 text-white border-0 text-xs px-2 py-0">
                    연결됨
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      WebSocket
                    </span>
                  </div>
                  <Badge className="bg-green-500 text-white border-0 text-xs px-2 py-0">
                    활성
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      활성 세션
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    1개
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
