"use client";

import { useState, useCallback, useMemo, memo } from "react";
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
  phase: string;
  title: string;
  limits?: {
    lower: number;
    upper: number;
  };
  maxDataPoints?: number;
  isActive?: boolean;
}

export const PhaseChart = memo(function PhaseChart({
  data = [],
  phase,
  title,
  limits,
  maxDataPoints = 20,
  isActive = false,
}: PhaseChartProps) {
  const [isPaused, setIsPaused] = useState(false);

  const chartData = useMemo(() => {
    return data.slice(-maxDataPoints);
  }, [data, maxDataPoints]);

  const colors = useMemo(() => {
    if (isActive) {
      return {
        main: "#3b82f6",
        bg: "bg-gradient-to-br from-blue-100 to-purple-100",
        border: "border-4 border-blue-600",
        cardClass:
          "animate-pulse shadow-2xl shadow-blue-400 ring-4 ring-blue-500 ring-opacity-50 transform scale-105",
      };
    }
    return {
      main: "#6b7280",
      bg: "bg-gray-50",
      border: "border-2 border-gray-300",
      cardClass: "hover:shadow-md shadow-sm",
    };
  }, [isActive]);

  const statistics = useMemo(() => {
    if (chartData.length === 0) {
      return {
        avg: 0,
        count: 0,
        passRate: 0,
        trend: "stable" as "up" | "down" | "stable",
        overallResult: "PENDING" as "PASS" | "FAIL" | "PENDING",
      };
    }

    const values = chartData.map((d) => d.value).filter((v) => v !== undefined);
    if (values.length === 0) {
      return {
        avg: 0,
        count: 0,
        passRate: 0,
        trend: "stable" as "up" | "down" | "stable",
        overallResult: "PENDING" as "PASS" | "FAIL" | "PENDING",
      };
    }

    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

    let passCount = 0;
    let overallResult: "PASS" | "FAIL" | "PENDING" = "PENDING";

    if (limits) {
      // 상한/하한 범위 체크
      const allInRange = chartData.every(
        (d) => d.value >= limits.lower && d.value <= limits.upper
      );

      passCount = chartData.filter(
        (d) => d.value >= limits.lower && d.value <= limits.upper
      ).length;

      // 전체 판정: 모든 데이터가 범위 안에 있으면 합격, 하나라도 벗어나면 불합격
      if (chartData.length > 0) {
        overallResult = allInRange ? "PASS" : "FAIL";
      }
    } else {
      passCount = chartData.length;
      overallResult = chartData.length > 0 ? "PASS" : "PENDING";
    }

    const passRate =
      chartData.length > 0 ? (passCount / chartData.length) * 100 : 0;

    return {
      avg: parseFloat(avg.toFixed(2)),
      count: chartData.length,
      passRate: parseFloat(passRate.toFixed(1)),
      trend: "stable" as "up" | "down" | "stable",
      overallResult,
    };
  }, [chartData, limits]);

  const handleTogglePause = useCallback(() => {
    setIsPaused(!isPaused);
  }, [isPaused]);

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

  return (
    <Card
      className={`${colors.bg} ${colors.border} ${colors.cardClass} transition-all duration-500 rounded-lg`}
    >
      <CardContent className="p-0">
        {/* 차트만 표시 */}
        <div className="h-64 w-full p-4">
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
                  domain={limits ? [0, limits.upper * 1.2] : [0, "dataMax"]}
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
                    />
                    <ReferenceLine
                      y={limits.upper}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                    />
                  </>
                )}

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={colors.main}
                  strokeWidth={isActive ? 3 : 2}
                  name={`${phase} 측정값`}
                  connectNulls={false}
                  dot={{ fill: colors.main, r: isActive ? 4 : 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">측정 데이터 대기 중</p>
                <p className="text-xs opacity-70">
                  검사가 시작되면 연속 측정 데이터가 표시됩니다
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
