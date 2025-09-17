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
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Shield,
  Activity,
} from "lucide-react";
import { apiClient } from "@/lib/api";

// 전력측정 결과 인터페이스
interface PowerMeasurement {
  id: number;
  barcode: string;
  phase: "P1" | "P2" | "P3";
  avg_value: number;
  min_value?: number;
  max_value?: number;
  std_deviation?: number;
  unit: string;
  result: "PASS" | "FAIL" | "PENDING";
  inspection_model_id: number;
  inspection_model_name?: string;
  created_at: string;
  start_time?: string;
  end_time?: string;
}

// 3대안전 결과 인터페이스
interface SafetyInspectionResult {
  id: number;
  barcode: string;
  inspection_model_id: number;
  inspection_model_name?: string;
  test_type: "SAFETY_INSPECTION";
  status: "COMPLETED" | "FAILED" | "PENDING";
  results: {
    dielectric: { value: number; unit: string; result: "PASS" | "FAIL" };
    insulation: { value: number; unit: string; result: "PASS" | "FAIL" };
    ground: { value: number; unit: string; result: "PASS" | "FAIL" };
  };
  created_at: string;
  overall_result: "PASS" | "FAIL" | "PENDING";
}

// 통계 인터페이스
interface MeasurementStats {
  power_measurements: {
    total: number;
    pass: number;
    fail: number;
    pending: number;
    today: number;
  };
  safety_inspections: {
    total: number;
    pass: number;
    fail: number;
    pending: number;
    today: number;
  };
}

export default function MeasurementsPage() {
  const [powerMeasurements, setPowerMeasurements] = useState<
    PowerMeasurement[]
  >([]);
  const [safetyResults, setSafetyResults] = useState<SafetyInspectionResult[]>(
    []
  );
  const [filteredPowerMeasurements, setFilteredPowerMeasurements] = useState<
    PowerMeasurement[]
  >([]);
  const [filteredSafetyResults, setFilteredSafetyResults] = useState<
    SafetyInspectionResult[]
  >([]);
  const [stats, setStats] = useState<MeasurementStats>({
    power_measurements: { total: 0, pass: 0, fail: 0, pending: 0, today: 0 },
    safety_inspections: { total: 0, pass: 0, fail: 0, pending: 0, today: 0 },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchBarcode, setSearchBarcode] = useState("");
  const [filterResult, setFilterResult] = useState<
    "ALL" | "PASS" | "FAIL" | "PENDING"
  >("ALL");
  const [filterPhase, setFilterPhase] = useState<"ALL" | "P1" | "P2" | "P3">(
    "ALL"
  );
  const [activeTab, setActiveTab] = useState("power");

  // 전력측정 데이터 로드
  const loadPowerMeasurements = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = (await apiClient.getMeasurements()) as any;
      const measurements = Array.isArray(response)
        ? response
        : response.measurements || [];

      setPowerMeasurements(measurements);
      setFilteredPowerMeasurements(measurements);

      // 통계 계산
      const today = new Date().toDateString();
      const todayMeasurements = measurements.filter(
        (m: any) => new Date(m.created_at).toDateString() === today
      );

      setStats((prev) => ({
        ...prev,
        power_measurements: {
          total: measurements.length,
          pass: measurements.filter((m: any) => m.result === "PASS").length,
          fail: measurements.filter((m: any) => m.result === "FAIL").length,
          pending: measurements.filter((m: any) => m.result === "PENDING")
            .length,
          today: todayMeasurements.length,
        },
      }));
    } catch (error) {
      console.error("전력측정 데이터 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 3대안전 결과 로드
  const loadSafetyResults = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = (await apiClient.getSafetyInspectionResults()) as any;
      const results = Array.isArray(response)
        ? response
        : response.results || [];

      setSafetyResults(results);
      setFilteredSafetyResults(results);

      // 통계 계산
      const today = new Date().toDateString();
      const todayResults = results.filter(
        (r: any) => new Date(r.created_at).toDateString() === today
      );

      setStats((prev) => ({
        ...prev,
        safety_inspections: {
          total: results.length,
          pass: results.filter((r: any) => r.overall_result === "PASS").length,
          fail: results.filter((r: any) => r.overall_result === "FAIL").length,
          pending: results.filter((r: any) => r.overall_result === "PENDING")
            .length,
          today: todayResults.length,
        },
      }));
    } catch (error) {
      console.error("3대안전 결과 로드 실패:", error);
      // 오류 시 빈 배열로 설정
      setSafetyResults([]);
      setFilteredSafetyResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 필터링 함수
  const applyFilters = useCallback(() => {
    let filteredPower = powerMeasurements;
    let filteredSafety = safetyResults;

    // 바코드 필터
    if (searchBarcode) {
      filteredPower = filteredPower.filter((m) =>
        m.barcode.toLowerCase().includes(searchBarcode.toLowerCase())
      );
      filteredSafety = filteredSafety.filter((r) =>
        r.barcode.toLowerCase().includes(searchBarcode.toLowerCase())
      );
    }

    // 결과 필터
    if (filterResult !== "ALL") {
      filteredPower = filteredPower.filter((m) => m.result === filterResult);
      filteredSafety = filteredSafety.filter(
        (r) => r.overall_result === filterResult
      );
    }

    // 위상 필터 (전력측정만)
    if (filterPhase !== "ALL") {
      filteredPower = filteredPower.filter((m) => m.phase === filterPhase);
    }

    setFilteredPowerMeasurements(filteredPower);
    setFilteredSafetyResults(filteredSafety);
  }, [
    powerMeasurements,
    safetyResults,
    searchBarcode,
    filterResult,
    filterPhase,
  ]);

  // 초기 로드
  useEffect(() => {
    loadPowerMeasurements();
    loadSafetyResults();
  }, [loadPowerMeasurements, loadSafetyResults]);

  // 필터 적용
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // CSV 다운로드
  const downloadCSV = useCallback((data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (typeof value === "object") {
              return JSON.stringify(value);
            }
            return `"${value}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR");
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case "PASS":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            PASS
          </Badge>
        );
      case "FAIL":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            FAIL
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            PENDING
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">측정 결과 조회</h1>
          <p className="text-muted-foreground">
            전력측정 및 3대안전 검사 결과를 조회할 수 있습니다
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              if (activeTab === "power") loadPowerMeasurements();
              else loadSafetyResults();
            }}
            variant="outline"
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전력측정 총계</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.power_measurements.total}
            </div>
            <p className="text-xs text-muted-foreground">
              오늘: {stats.power_measurements.today}건
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">3대안전 총계</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.safety_inspections.total}
            </div>
            <p className="text-xs text-muted-foreground">
              오늘: {stats.safety_inspections.today}건
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 합격률</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.power_measurements.total + stats.safety_inspections.total >
              0
                ? Math.round(
                    ((stats.power_measurements.pass +
                      stats.safety_inspections.pass) /
                      (stats.power_measurements.total +
                        stats.safety_inspections.total)) *
                      100
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              전력: {stats.power_measurements.pass}건, 안전:{" "}
              {stats.safety_inspections.pass}건
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 불합격률</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.power_measurements.total + stats.safety_inspections.total >
              0
                ? Math.round(
                    ((stats.power_measurements.fail +
                      stats.safety_inspections.fail) /
                      (stats.power_measurements.total +
                        stats.safety_inspections.total)) *
                      100
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              전력: {stats.power_measurements.fail}건, 안전:{" "}
              {stats.safety_inspections.fail}건
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 검색 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            필터 및 검색
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">바코드 검색</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="바코드 입력..."
                  value={searchBarcode}
                  onChange={(e) => setSearchBarcode(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>결과 필터</Label>
              <Select
                value={filterResult}
                onValueChange={(value: any) => setFilterResult(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">전체</SelectItem>
                  <SelectItem value="PASS">합격</SelectItem>
                  <SelectItem value="FAIL">불합격</SelectItem>
                  <SelectItem value="PENDING">대기중</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>위상 필터 (전력측정)</Label>
              <Select
                value={filterPhase}
                onValueChange={(value: any) => setFilterPhase(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">전체</SelectItem>
                  <SelectItem value="P1">P1</SelectItem>
                  <SelectItem value="P2">P2</SelectItem>
                  <SelectItem value="P3">P3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  if (activeTab === "power") {
                    downloadCSV(
                      filteredPowerMeasurements,
                      `power_measurements_${
                        new Date().toISOString().split("T")[0]
                      }.csv`
                    );
                  } else {
                    downloadCSV(
                      filteredSafetyResults,
                      `safety_inspections_${
                        new Date().toISOString().split("T")[0]
                      }.csv`
                    );
                  }
                }}
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                CSV 다운로드
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 탭 컨텐츠 */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "power" ? "default" : "outline"}
            onClick={() => setActiveTab("power")}
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            전력측정 결과 ({filteredPowerMeasurements.length})
          </Button>
          <Button
            variant={activeTab === "safety" ? "default" : "outline"}
            onClick={() => setActiveTab("safety")}
            className="flex items-center gap-2"
          >
            <Shield className="h-4 w-4" />
            3대안전 결과 ({filteredSafetyResults.length})
          </Button>
        </div>

        {activeTab === "power" && (
          <Card>
            <CardHeader>
              <CardTitle>전력측정 결과</CardTitle>
              <CardDescription>
                전력측정 설비로 측정된 결과입니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Activity className="h-6 w-6 animate-spin mr-2" />
                  로딩 중...
                </div>
              ) : filteredPowerMeasurements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  전력측정 결과가 없습니다
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPowerMeasurements.map((measurement) => (
                    <Card key={measurement.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {measurement.barcode}
                            </span>
                            <Badge variant="outline">{measurement.phase}</Badge>
                            {getResultBadge(measurement.result)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            모델:{" "}
                            {measurement.inspection_model_name ||
                              `ID: ${measurement.inspection_model_id}`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            측정시간: {formatDateTime(measurement.created_at)}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-2xl font-bold">
                            {measurement.avg_value.toFixed(2)}{" "}
                            {measurement.unit}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            최소: {measurement.min_value?.toFixed(2) || "N/A"} |
                            최대: {measurement.max_value?.toFixed(2) || "N/A"}
                          </div>
                          {measurement.std_deviation && (
                            <div className="text-sm text-muted-foreground">
                              표준편차: {measurement.std_deviation.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "safety" && (
          <Card>
            <CardHeader>
              <CardTitle>3대안전 검사 결과</CardTitle>
              <CardDescription>
                3대안전 검사로 측정된 결과입니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Activity className="h-6 w-6 animate-spin mr-2" />
                  로딩 중...
                </div>
              ) : filteredSafetyResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  3대안전 검사 결과가 없습니다
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSafetyResults.map((result) => (
                    <Card key={result.id} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {result.barcode}
                              </span>
                              {getResultBadge(result.overall_result)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              모델:{" "}
                              {result.inspection_model_name ||
                                `ID: ${result.inspection_model_id}`}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              검사시간: {formatDateTime(result.created_at)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* 내전압 검사 */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">
                              내전압 검사
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <div>
                                <div className="text-lg font-bold">
                                  {result.results.dielectric.value}{" "}
                                  {result.results.dielectric.unit}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  1.5kV
                                </div>
                              </div>
                              {getResultBadge(result.results.dielectric.result)}
                            </div>
                          </div>

                          {/* 절연저항 검사 */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">
                              절연저항 검사
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <div>
                                <div className="text-lg font-bold">
                                  {result.results.insulation.value}{" "}
                                  {result.results.insulation.unit}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  500V
                                </div>
                              </div>
                              {getResultBadge(result.results.insulation.result)}
                            </div>
                          </div>

                          {/* 접지연속 검사 */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">
                              접지연속 검사
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <div>
                                <div className="text-lg font-bold">
                                  {result.results.ground.value}{" "}
                                  {result.results.ground.unit}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  10A
                                </div>
                              </div>
                              {getResultBadge(result.results.ground.result)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
