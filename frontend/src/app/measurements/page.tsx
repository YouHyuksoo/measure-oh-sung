"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Search,
  Download,
  Filter,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface Measurement {
  id: number;
  barcode: string;
  phase: "P1" | "P2" | "P3";
  device_id: number;
  device_name?: string;
  value: number;
  unit: string;
  timestamp: string;
  result: "PASS" | "FAIL" | "PENDING";
  inspection_model_id: number;
  inspection_model_name?: string;
}

interface MeasurementStats {
  total: number;
  pass: number;
  fail: number;
  pending: number;
  today: number;
  avgValue: number;
}

export default function MeasurementsPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [filteredMeasurements, setFilteredMeasurements] = useState<
    Measurement[]
  >([]);
  const [stats, setStats] = useState<MeasurementStats>({
    total: 0,
    pass: 0,
    fail: 0,
    pending: 0,
    today: 0,
    avgValue: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchBarcode, setSearchBarcode] = useState("");
  const [filterResult, setFilterResult] = useState<
    "ALL" | "PASS" | "FAIL" | "PENDING"
  >("ALL");
  const [filterPhase, setFilterPhase] = useState<"ALL" | "P1" | "P2" | "P3">(
    "ALL"
  );

  // 측정 데이터 로드
  const loadMeasurements = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = (await apiClient.getMeasurements()) as
        | Measurement[]
        | { measurements?: Measurement[] };

      // API 응답에서 measurements 배열 추출
      const measurements = Array.isArray(response)
        ? response
        : response.measurements || [];
      setMeasurements(measurements);
      calculateStats(measurements);
    } catch (error) {
      console.error("측정 데이터 로드 오류:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 통계 계산
  const calculateStats = (data: Measurement[]) => {
    const today = new Date().toDateString();
    const todayMeasurements = data.filter(
      (m) => new Date(m.timestamp).toDateString() === today
    );

    const passCount = data.filter((m) => m.result === "PASS").length;
    const failCount = data.filter((m) => m.result === "FAIL").length;
    const pendingCount = data.filter((m) => m.result === "PENDING").length;

    const avgValue =
      data.length > 0
        ? data.reduce((sum, m) => sum + m.value, 0) / data.length
        : 0;

    setStats({
      total: data.length,
      pass: passCount,
      fail: failCount,
      pending: pendingCount,
      today: todayMeasurements.length,
      avgValue: parseFloat(avgValue.toFixed(2)),
    });
  };

  // 바코드로 검색
  const searchByBarcode = async (barcode: string) => {
    if (!barcode.trim()) {
      setFilteredMeasurements(measurements);
      return;
    }

    try {
      setIsLoading(true);
      const response = (await apiClient.getMeasurementsByBarcode(barcode)) as
        | Measurement[]
        | { measurements?: Measurement[] };

      // API 응답에서 measurements 배열 추출
      const measurements = Array.isArray(response)
        ? response
        : response.measurements || [];
      setFilteredMeasurements(measurements);
    } catch (error) {
      console.error("바코드 검색 오류:", error);
      setFilteredMeasurements([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 필터링 적용
  const applyFilters = useCallback(() => {
    let filtered = measurements;

    if (filterResult !== "ALL") {
      filtered = filtered.filter((m) => m.result === filterResult);
    }

    if (filterPhase !== "ALL") {
      filtered = filtered.filter((m) => m.phase === filterPhase);
    }

    setFilteredMeasurements(filtered);
  }, [measurements, filterResult, filterPhase]);

  // 검색 핸들러
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchByBarcode(searchBarcode);
  };

  // 초기 로드
  useEffect(() => {
    loadMeasurements();
  }, [loadMeasurements]);

  // 필터 적용
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // 결과 배지 색상
  const getResultBadge = (result: string) => {
    switch (result) {
      case "PASS":
        return (
          <Badge variant="success">
            <CheckCircle className="h-3 w-3 mr-1" />
            합격
          </Badge>
        );
      case "FAIL":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            불합격
          </Badge>
        );
      case "PENDING":
        return <Badge variant="warning">대기중</Badge>;
      default:
        return <Badge variant="secondary">{result}</Badge>;
    }
  };

  // 데이터 내보내기
  const exportData = () => {
    const dataToExport = filteredMeasurements.map((m) => ({
      바코드: m.barcode,
      측정단계: m.phase,
      측정값: m.value,
      단위: m.unit,
      결과: m.result,
      측정시간: new Date(m.timestamp).toLocaleString("ko-KR"),
    }));

    const csv = [
      Object.keys(dataToExport[0] || {}).join(","),
      ...dataToExport.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `measurements_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">측정 데이터</h1>
        <p className="text-muted-foreground">측정 결과 조회 및 분석</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 측정</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">총 측정 건수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">합격</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.pass}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0
                ? Math.round((stats.pass / stats.total) * 100)
                : 0}
              % 합격률
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">불합격</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.fail}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0
                ? Math.round((stats.fail / stats.total) * 100)
                : 0}
              % 불합격률
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 측정</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <p className="text-xs text-muted-foreground">금일 측정 건수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균값</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgValue}</div>
            <p className="text-xs text-muted-foreground">전체 평균값</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">대기중</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">처리 대기 중</p>
          </CardContent>
        </Card>
      </div>

      {/* 검색 및 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            검색 및 필터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 바코드 검색 */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="바코드 검색"
                value={searchBarcode}
                onChange={(e) => setSearchBarcode(e.target.value)}
              />
              <Button type="submit" size="icon" variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </form>

            {/* 결과 필터 */}
            <Select
              value={filterResult}
              onValueChange={(value: string) =>
                setFilterResult(value as "ALL" | "PASS" | "FAIL" | "PENDING")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="결과 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">모든 결과</SelectItem>
                <SelectItem value="PASS">합격만</SelectItem>
                <SelectItem value="FAIL">불합격만</SelectItem>
                <SelectItem value="PENDING">대기중만</SelectItem>
              </SelectContent>
            </Select>

            {/* 단계 필터 */}
            <Select
              value={filterPhase}
              onValueChange={(value: string) =>
                setFilterPhase(value as "ALL" | "P1" | "P2" | "P3")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="단계 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">모든 단계</SelectItem>
                <SelectItem value="P1">P1 단계</SelectItem>
                <SelectItem value="P2">P2 단계</SelectItem>
                <SelectItem value="P3">P3 단계</SelectItem>
              </SelectContent>
            </Select>

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <Button onClick={loadMeasurements} variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={exportData} variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 측정 데이터 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            측정 결과 ({filteredMeasurements.length}건)
          </CardTitle>
          <CardDescription>
            {searchBarcode && `'${searchBarcode}' 바코드 검색 결과`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              로딩 중...
            </div>
          ) : filteredMeasurements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">바코드</th>
                    <th className="text-left p-3 font-medium">단계</th>
                    <th className="text-left p-3 font-medium">측정값</th>
                    <th className="text-left p-3 font-medium">결과</th>
                    <th className="text-left p-3 font-medium">측정시간</th>
                    <th className="text-left p-3 font-medium">장비</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMeasurements.map((measurement, index) => (
                    <tr
                      key={measurement.id || index}
                      className="border-b hover:bg-muted/50"
                    >
                      <td className="p-3">
                        <Badge variant="outline">{measurement.barcode}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary">{measurement.phase}</Badge>
                      </td>
                      <td className="p-3 font-mono">
                        {measurement.value} {measurement.unit}
                      </td>
                      <td className="p-3">
                        {getResultBadge(measurement.result)}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(measurement.timestamp).toLocaleString(
                          "ko-KR"
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        장비 #{measurement.device_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {searchBarcode
                ? "검색 결과가 없습니다"
                : "측정 데이터가 없습니다"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
