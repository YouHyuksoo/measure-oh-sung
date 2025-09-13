"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
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
  TrendingUp,
  TrendingDown,
  Activity,
  Pause,
  Play,
  RotateCcw,
  Target,
} from "lucide-react";

interface MeasurementPoint {
  timestamp: string;
  time: string;
  value: number;
  barcode?: string;
  result?: "PASS" | "FAIL" | "PENDING";
}

interface PhaseChartProps {
  data: MeasurementPoint[];
  phase: "P1" | "P2" | "P3";
  title: string;
  limits?: {
    lower: number;
    upper: number;
  };
  maxDataPoints?: number;
  isRealTime?: boolean;
  onTogglePause?: () => void;
  onClear?: () => void;
  // 자동 검사 관련 props
  isActive?: boolean;      // 현재 활성화된 단계인지
  isCompleted?: boolean;   // 완료된 단계인지
  isPending?: boolean;     // 대기 중인 단계인지
}

export function PhaseChart({
  data = [],
  phase,
  title,
  limits,
  maxDataPoints = 20,
  isRealTime = true,
  onTogglePause,
  onClear,
  isActive = false,
  isCompleted = false,
  isPending = false,
}: PhaseChartProps) {
  const [chartData, setChartData] = useState<MeasurementPoint[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [statistics, setStatistics] = useState({
    avg: 0,
    min: 0,
    max: 0,
    count: 0,
    passRate: 0,
    trend: "stable" as "up" | "down" | "stable",
  });

  // 단계별 색상 설정 - 활성 상태에 따라 동적 결정
  const getPhaseColor = () => {
    // 자동 검사 상태에 따른 색상 결정
    if (isActive) {
      // 현재 활성 단계 - 레인보우 테두리 + 애니메이션
      return {
        main: "#3b82f6",
        bg: "bg-gradient-to-br from-blue-100 to-purple-100",
        border: "border-4 border-blue-600",
        text: "text-blue-900 font-bold",
      };
    }
    
    if (isCompleted) {
      // 완료된 단계 - 밝은 초록
      return {
        main: "#059669",
        bg: "bg-gradient-to-br from-emerald-100 to-green-100",
        border: "border-4 border-emerald-600",
        text: "text-emerald-900 font-bold",
      };
    }
    
    if (isPending) {
      // 대기 중인 단계 - 밝은 주황
      return {
        main: "#ea580c",
        bg: "bg-gradient-to-br from-orange-100 to-yellow-100",
        border: "border-4 border-orange-500",
        text: "text-orange-900 font-bold",
      };
    }
    
    // 기본 상태 - 깔끔한 회색
    return {
      main: "#6b7280",
      bg: "bg-gray-50",
      border: "border-2 border-gray-300",
      text: "text-gray-700",
    };
  };

  const colors = getPhaseColor();

  // 데이터 업데이트
  useEffect(() => {
    if (!isPaused && isRealTime) {
      const limitedData = data.slice(-maxDataPoints);
      setChartData(limitedData);
      calculateStatistics(limitedData);
    }
  }, [data, maxDataPoints, isPaused, isRealTime]);

  // 통계 계산
  const calculateStatistics = (data: MeasurementPoint[]) => {
    if (data.length === 0) {
      setStatistics({
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
        passRate: 0,
        trend: "stable",
      });
      return;
    }

    const values = data.map((d) => d.value).filter((v) => v !== undefined);

    if (values.length > 0) {
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      // 합격률 계산
      const passCount = data.filter((d) => d.result === "PASS").length;
      const passRate = data.length > 0 ? (passCount / data.length) * 100 : 0;

      // 트렌드 계산 (최근 5개 데이터점 기준)
      let trend: "up" | "down" | "stable" = "stable";
      if (values.length >= 5) {
        const recent = values.slice(-5);
        const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
        const secondHalf = recent.slice(Math.floor(recent.length / 2));
        const firstAvg =
          firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg =
          secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

        const diff = secondAvg - firstAvg;
        const threshold = (max - min) * 0.05; // 변동폭의 5%를 임계값으로
        trend =
          Math.abs(diff) < threshold ? "stable" : diff > 0 ? "up" : "down";
      }

      setStatistics({
        avg: parseFloat(avg.toFixed(2)),
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2)),
        count: data.length,
        passRate: parseFloat(passRate.toFixed(1)),
        trend,
      });
    }
  };

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    onTogglePause?.();
  };

  const handleClear = () => {
    setChartData([]);
    onClear?.();
  };

  const formatTooltip = (value: number) => {
    return [`${value.toFixed(2)}`, `${phase} 측정값`];
  };

  const formatXAxisLabel = (tickItem: string) => {
    return new Date(tickItem).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getTrendIcon = () => {
    switch (statistics.trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTrendColor = () => {
    switch (statistics.trend) {
      case "up":
        return "text-green-600";
      case "down":
        return "text-red-600";
      default:
        return "text-blue-600";
    }
  };

  const getCardClass = () => {
    let baseClass = `${colors.bg} ${colors.border} transition-all duration-500 rounded-lg`;
    
    if (isActive) {
      // 활성 단계: 강렬한 파란색 + 맥박 효과 + 글로우
      baseClass += " animate-pulse shadow-2xl shadow-blue-400 ring-4 ring-blue-500 ring-opacity-50 transform scale-105";
    } else if (isCompleted) {
      // 완료 단계: 초록색 글로우
      baseClass += " shadow-xl shadow-emerald-300 ring-2 ring-emerald-400 ring-opacity-30";
    } else if (isPending) {
      // 대기 단계: 주황색 글로우
      baseClass += " shadow-lg shadow-orange-300 ring-2 ring-orange-400 ring-opacity-30";
    } else {
      // 기본 상태: 부드러운 그림자
      baseClass += " hover:shadow-md shadow-sm";
    }
    
    return baseClass;
  };

  return (
    <Card className={getCardClass()}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={`flex items-center gap-2 ${colors.text}`}>
              <Target className="h-5 w-5" />
              {title}
              {isRealTime && (
                <Badge
                  variant={isPaused ? "secondary" : "default"}
                  className="text-xs"
                >
                  {isPaused ? "일시정지" : "실시간"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {limits
                ? `측정 범위: ${limits.lower} ~ ${limits.upper}`
                : "단계별 측정값 추이"}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handleTogglePause}
              title={isPaused ? "재생" : "일시정지"}
              className="h-8 w-8"
            >
              {isPaused ? (
                <Play className="h-3 w-3" />
              ) : (
                <Pause className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleClear}
              title="차트 지우기"
              className="h-8 w-8"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 통계 정보 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-2 bg-white/60 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="font-medium text-xs">평균</span>
              {getTrendIcon()}
            </div>
            <div className={`text-sm font-bold ${getTrendColor()}`}>
              {statistics.avg}
            </div>
          </div>
          <div className="text-center p-2 bg-white/60 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">범위</div>
            <div className="text-sm font-bold">
              {statistics.min} - {statistics.max}
            </div>
          </div>
          <div className="text-center p-2 bg-white/60 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">데이터 수</div>
            <div className="text-sm font-bold">{statistics.count}</div>
          </div>
          <div className="text-center p-2 bg-white/60 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">합격률</div>
            <div className="text-sm font-bold text-green-600">
              {statistics.passRate}%
            </div>
          </div>
        </div>

        {/* 차트 */}
        <div className="h-48 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 15, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatXAxisLabel}
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  domain={
                    limits ? [limits.lower * 0.8, limits.upper * 1.2] : "auto"
                  }
                />
                <Tooltip
                  formatter={formatTooltip}
                  labelFormatter={(label) =>
                    `시간: ${formatXAxisLabel(label as string)}`
                  }
                />

                {/* 기준선 표시 */}
                {limits && (
                  <>
                    <ReferenceLine
                      y={limits.lower}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      label={{ value: "하한", position: "left" }}
                    />
                    <ReferenceLine
                      y={limits.upper}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      label={{ value: "상한", position: "left" }}
                    />
                  </>
                )}

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={colors.main}
                  strokeWidth={2}
                  name={`${phase} 측정값`}
                  connectNulls={false}
                  dot={(props) => {
                    const { payload } = props;
                    let color = colors.main;
                    if (payload?.result === "PASS") {
                      color = "#10b981";
                    } else if (payload?.result === "FAIL") {
                      color = "#ef4444";
                    }
                    return <circle {...props} fill={color} r={3} />;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">측정 데이터 대기 중</p>
                <p className="text-xs opacity-70">
                  {phase} 단계 측정이 시작되면 차트가 표시됩니다
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 데이터 정보 */}
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>
            데이터: {chartData.length}/{maxDataPoints}
          </span>
          {chartData.length > 0 && (
            <span>
              최근:{" "}
              {new Date(
                chartData[chartData.length - 1]?.timestamp || ""
              ).toLocaleTimeString("ko-KR")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}