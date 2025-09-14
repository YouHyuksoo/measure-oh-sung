"use client"

import { useEffect, useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react'

interface MeasurementPoint {
  timestamp: string
  time: string
  p1?: number
  p2?: number
  p3?: number
  barcode?: string
}

interface RealTimeChartProps {
  data: MeasurementPoint[]
  title?: string
  description?: string
  maxDataPoints?: number
  updateInterval?: number
  isRealTime?: boolean
  onTogglePause?: () => void
  onClear?: () => void
}

export function RealTimeChart({
  data = [],
  title = "실시간 측정 데이터",
  description = "P1, P2, P3 단계별 측정값 추이",
  maxDataPoints = 50,
  updateInterval = 1000,
  isRealTime = true,
  onTogglePause,
  onClear
}: RealTimeChartProps) {
  const [chartData, setChartData] = useState<MeasurementPoint[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [statistics, setStatistics] = useState({
    p1: { avg: 0, min: 0, max: 0, trend: 'stable' as 'up' | 'down' | 'stable' },
    p2: { avg: 0, min: 0, max: 0, trend: 'stable' as 'up' | 'down' | 'stable' },
    p3: { avg: 0, min: 0, max: 0, trend: 'stable' as 'up' | 'down' | 'stable' },
  })

  // 통계 계산
  const calculateStatistics = useCallback((data: MeasurementPoint[]) => {
    if (data.length === 0) return

    const phases = ['p1', 'p2', 'p3'] as const
    const newStats = { ...statistics }

    phases.forEach(phase => {
      const values = data
        .map(d => d[phase])
        .filter(v => v !== undefined) as number[]
      
      if (values.length > 0) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length
        const min = Math.min(...values)
        const max = Math.max(...values)
        
        // 트렌드 계산 (최근 5개 데이터점 기준)
        const recent = values.slice(-5)
        if (recent.length >= 2) {
          const firstHalf = recent.slice(0, Math.floor(recent.length / 2))
          const secondHalf = recent.slice(Math.floor(recent.length / 2))
          const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length
          const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length
          
          const diff = secondAvg - firstAvg
          const trend = Math.abs(diff) < 0.1 ? 'stable' : diff > 0 ? 'up' : 'down'
          
          newStats[phase] = {
            avg: parseFloat(avg.toFixed(2)),
            min,
            max,
            trend
          }
        }
      }
    })

    setStatistics(newStats)
  }, [statistics, setStatistics])

  // 데이터 업데이트
  useEffect(() => {
    if (!isPaused && isRealTime) {
      const limitedData = data.slice(-maxDataPoints)
      setChartData(limitedData)
      calculateStatistics(limitedData)
    }
  }, [data, maxDataPoints, isPaused, isRealTime, calculateStatistics])

  const handleTogglePause = () => {
    setIsPaused(!isPaused)
    onTogglePause?.()
  }

  const handleClear = () => {
    setChartData([])
    onClear?.()
  }

  const formatTooltip = (value: number, name: string) => {
    const phaseNames = { p1: 'P1 단계', p2: 'P2 단계', p3: 'P3 단계' }
    return [`${value.toFixed(2)}`, phaseNames[name as keyof typeof phaseNames] || name]
  }

  const formatXAxisLabel = (tickItem: string) => {
    return new Date(tickItem).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-600" />
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-600" />
      default:
        return <Activity className="h-3 w-3 text-blue-600" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      default:
        return 'text-blue-600'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {title}
              {isRealTime && (
                <Badge variant={isPaused ? "secondary" : "success"} className="text-xs">
                  {isPaused ? "일시정지" : "실시간"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleTogglePause}
              title={isPaused ? "재생" : "일시정지"}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleClear}
              title="차트 지우기"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 통계 정보 */}
        <div className="grid grid-cols-3 gap-4">
          {(['p1', 'p2', 'p3'] as const).map((phase, index) => (
            <div key={phase} className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="font-medium text-sm">
                  {phase.toUpperCase()}
                </span>
                {getTrendIcon(statistics[phase].trend)}
              </div>
              <div className={`text-lg font-bold ${getTrendColor(statistics[phase].trend)}`}>
                {statistics[phase].avg || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                {statistics[phase].min || 0} - {statistics[phase].max || 0}
              </div>
            </div>
          ))}
        </div>

        {/* 차트 */}
        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {/* @ts-ignore */}
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                {/* @ts-ignore */}
                <CartesianGrid strokeDasharray="3 3" />
                {/* @ts-ignore */}
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatXAxisLabel}
                  tick={{ fontSize: 12 }}
                />
                {/* @ts-ignore */}
                <YAxis tick={{ fontSize: 12 }} />
                {/* @ts-ignore */}
                <Tooltip 
                  formatter={formatTooltip}
                  labelFormatter={(label) => `시간: ${formatXAxisLabel(label)}`}
                />
                {/* @ts-ignore */}
                <Legend />
                {/* @ts-ignore */}
                <Line 
                  type="monotone" 
                  dataKey="p1" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="P1"
                  connectNulls={false}
                  dot={{ r: 3 }}
                />
                {/* @ts-ignore */}
                <Line 
                  type="monotone" 
                  dataKey="p2" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="P2"
                  connectNulls={false}
                  dot={{ r: 3 }}
                />
                {/* @ts-ignore */}
                <Line 
                  type="monotone" 
                  dataKey="p3" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  name="P3"
                  connectNulls={false}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>측정 데이터 대기 중</p>
                <p className="text-xs">검사가 시작되면 실시간 차트가 표시됩니다</p>
              </div>
            </div>
          )}
        </div>

        {/* 데이터 정보 */}
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>데이터 포인트: {chartData.length}/{maxDataPoints}</span>
          {chartData.length > 0 && (
            <span>
              최근 업데이트: {new Date(chartData[chartData.length - 1]?.timestamp || '').toLocaleTimeString('ko-KR')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}