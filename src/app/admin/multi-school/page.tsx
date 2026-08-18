"use client";

import { useEffect, useState } from "react";
import {
  getMultiSchoolOverview,
  getSchoolTrends,
  getAlerts,
  getSchoolRankings,
  get5TierHierarchy,
} from "./actions";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

type SchoolPointDetail = {
  id: string;
  name: string;
  address: string | null;
  distanceKm: number | null;
  managerName: string | null;
  phone: string | null;
  classCount: number;
  studentCount: number;
};

type CampusDetail = {
  id: string;
  name: string;
  address: string | null;
  schoolPoints: SchoolPointDetail[];
};

type SchoolOverview = {
  id: string;
  name: string;
  address: string | null;
  branchType: "WARD" | "THPT";
  departmentName: string;
  districtWardName: string;
  campusCount: number;
  schoolPointsCount?: number;
  classCount: number;
  studentCount: number;
  teacherCount: number;
  attendanceRate: number;
  avgScore: number;
  campusDetails?: CampusDetail[];
};

type Alert = {
  type: "danger" | "warning";
  school: string;
  className?: string;
  message: string;
};

type Trend = {
  label: string;
  attendanceRate: number;
  avgScore: number;
};

export default function MultiSchoolPage() {
  const [overview, setOverview] = useState<SchoolOverview[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trends, setTrends] = useState<Record<string, Trend[]>>({});
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"attendance" | "score">("attendance");
  const [trendPeriod, setTrendPeriod] = useState<"week" | "month">("month");
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // 5-Tier cascading filters state
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedBranchType, setSelectedBranchType] = useState<"" | "WARD" | "THPT">("");
  const [selectedDistrictWard, setSelectedDistrictWard] = useState<string>("");

  // Tab view switch: Overview vs 5-Tier Hierarchy Tree
  const [viewMode, setViewMode] = useState<"overview" | "tree">("overview");

  // Initial load for hierarchy
  useEffect(() => {
    async function loadHierarchy() {
      try {
        const data = await get5TierHierarchy();
        setHierarchy(data);
      } catch (err) {
        console.error("Error loading hierarchy:", err);
      }
    }
    loadHierarchy();
  }, []);

  // Load overview data when filters change
  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo, selectedDepartment, selectedDistrictWard, selectedBranchType]);

  async function loadData() {
    setLoading(true);
    try {
      const [overviewData, alertsData] = await Promise.all([
        getMultiSchoolOverview(
          dateFrom || undefined,
          dateTo || undefined,
          selectedDepartment || undefined,
          selectedDistrictWard || undefined,
          selectedBranchType || undefined
        ),
        getAlerts(),
      ]);
      setOverview(overviewData);
      setAlerts(alertsData);
      if (overviewData.length > 0) {
        setSelectedSchool(overviewData[0].id);
      } else {
        setSelectedSchool("");
      }
    } catch (err) {
      console.error("Error loading multi-school data:", err);
    }
    setLoading(false);
  }

  // Load trends when school or period changes
  useEffect(() => {
    if (selectedSchool) {
      loadTrends(selectedSchool);
    }
  }, [selectedSchool, trendPeriod]);

  async function loadTrends(schoolId: string) {
    try {
      const trendData = await getSchoolTrends(schoolId, trendPeriod, 6);
      setTrends((prev) => ({ ...prev, [schoolId]: trendData }));
    } catch (err) {
      console.error("Error loading trends:", err);
    }
  }

  // List of DistrictWards for current department selection
  const currentDeptObj = hierarchy.find((d) => d.id === selectedDepartment);
  const districtWardsOptions = currentDeptObj?.districtWards || [];

  // Sort rankings
  const ranked = [...overview].sort((a, b) =>
    sortBy === "attendance"
      ? b.attendanceRate - a.attendanceRate
      : b.avgScore - a.avgScore
  );

  // Tổng số liệu
  const totalStudents = overview.reduce((s, o) => s + o.studentCount, 0);
  const totalTeachers = overview.reduce((s, o) => s + o.teacherCount, 0);
  const totalClasses = overview.reduce((s, o) => s + o.classCount, 0);
  const avgAttendance =
    overview.length > 0
      ? Math.round(
          (overview.reduce((s, o) => s + o.attendanceRate, 0) / overview.length) * 10
        ) / 10
      : 0;

  if (loading && overview.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hệ Thống Quản Lý Giáo Dục 5 Cấp
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sở GD&ĐT → Phường/Xã (Mầm non, Tiểu học, THCS) & Khối THPT → Trường → Phân hiệu → Điểm trường
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setViewMode("overview")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              viewMode === "overview"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📊 Tổng Quan & Thống Kê
          </button>
          <button
            onClick={() => setViewMode("tree")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              viewMode === "tree"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            🌲 Cây Quản Lý 5 Cấp
          </button>
        </div>
      </div>

      {/* 5-Tier Filter Bar */}
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            <span>⚡</span> Bộ lọc Phân luồng 5 Cấp Hành chính
          </h3>
          {(selectedDepartment || selectedBranchType || selectedDistrictWard || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSelectedDepartment("");
                setSelectedBranchType("");
                setSelectedDistrictWard("");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Tier 1: Sở GD&ĐT */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Cấp 1: Sở GD&ĐT
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setSelectedDistrictWard("");
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tất cả các Sở GD&ĐT</option>
              {hierarchy.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          {/* Tier 2 Branch: Nhánh Quản lý */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Cấp 2: Nhánh Phân cấp
            </label>
            <select
              value={selectedBranchType}
              onChange={(e) => {
                const val = e.target.value as "" | "WARD" | "THPT";
                setSelectedBranchType(val);
                if (val === "THPT") setSelectedDistrictWard("");
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tất cả các Nhánh</option>
              <option value="WARD">🏡 Phường / Xã (Mầm non, TH, THCS)</option>
              <option value="THPT">🎓 Khối THPT (Trực thuộc Sở)</option>
            </select>
          </div>

          {/* Tier 2 Sub-Branch: Phòng / Phường / Xã */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Phòng GD&ĐT Phường / Xã
            </label>
            <select
              value={selectedDistrictWard}
              onChange={(e) => setSelectedDistrictWard(e.target.value)}
              disabled={selectedBranchType === "THPT"}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Tất cả Phường / Xã</option>
              {districtWardsOptions.map((dw: any) => (
                <option key={dw.id} value={dw.id}>
                  {dw.name} ({dw.code})
                </option>
              ))}
            </select>
          </div>

          {/* Date range filters */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Từ ngày
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Đến ngày
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {viewMode === "tree" ? (
        /* Render 5-Tier Visual Tree Structure */
        <Visual5TierTree hierarchy={hierarchy} />
      ) : (
        <>
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    alert.type === "danger"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : "bg-yellow-50 border-yellow-200 text-yellow-800"
                  }`}
                >
                  <span className="text-lg">
                    {alert.type === "danger" ? "🚨" : "⚠️"}
                  </span>
                  <div>
                    <span className="font-semibold">{alert.school}</span>
                    {alert.className && (
                      <span className="text-sm"> — Lớp {alert.className}</span>
                    )}
                    <span className="text-sm ml-2">{alert.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Tổng học sinh"
              value={totalStudents.toLocaleString()}
              icon="👨🎓"
              color="bg-blue-50 text-blue-700 border border-blue-100"
            />
            <StatCard
              label="Tổng giáo viên"
              value={totalTeachers.toLocaleString()}
              icon="👩🏫"
              color="bg-emerald-50 text-emerald-700 border border-emerald-100"
            />
            <StatCard
              label="Tổng lớp học"
              value={totalClasses.toLocaleString()}
              icon="🏫"
              color="bg-purple-50 text-purple-700 border border-purple-100"
            />
            <StatCard
              label="Chuyên cần TB"
              value={`${avgAttendance}%`}
              icon="📊"
              color="bg-amber-50 text-amber-700 border border-amber-100"
            />
          </div>

          {/* Multi-School Table overview */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <span>🏢</span> Bảng Tổng Hợp Danh Sách Trường ({overview.length})
              </h2>
              <span className="text-xs text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full font-medium">
                Cấp 3: Trường Đơn Vị
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">STT</th>
                    <th className="px-4 py-3 text-left font-medium">Tên Trường & Đơn vị Quản lý</th>
                    <th className="px-4 py-3 text-center font-medium">Nhánh Quản lý</th>
                    <th className="px-4 py-3 text-center font-medium">Cấp 4 & 5 (Phân hiệu / Điểm)</th>
                    <th className="px-4 py-3 text-center font-medium">Lớp</th>
                    <th className="px-4 py-3 text-center font-medium">Học sinh</th>
                    <th className="px-4 py-3 text-center font-medium">Giáo viên</th>
                    <th className="px-4 py-3 text-center font-medium">Chuyên cần</th>
                    <th className="px-4 py-3 text-center font-medium">Điểm TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {overview.map((school, idx) => (
                    <tr
                      key={school.id}
                      className={`hover:bg-indigo-50/50 cursor-pointer transition-colors ${
                        selectedSchool === school.id ? "bg-indigo-50/80" : ""
                      }`}
                      onClick={() => setSelectedSchool(school.id)}
                    >
                      <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">
                          {school.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          🏛️ {school.departmentName} → 📍 {school.districtWardName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            school.branchType === "THPT"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-teal-100 text-teal-800"
                          }`}
                        >
                          {school.branchType === "THPT" ? "🎓 THPT (Sở)" : "🏡 Phường / Xã"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-medium text-indigo-700">
                          {school.campusCount} Phân hiệu
                        </span>
                        <span className="text-xs text-gray-500 block">
                          ({school.schoolPointsCount || 0} điểm trường)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{school.classCount}</td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900">
                        {school.studentCount}
                      </td>
                      <td className="px-4 py-3 text-center">{school.teacherCount}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            school.attendanceRate >= 90
                              ? "bg-green-100 text-green-800"
                              : school.attendanceRate >= 80
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {school.attendanceRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-800">
                        {school.avgScore > 0 ? school.avgScore : "—"}
                      </td>
                    </tr>
                  ))}
                  {overview.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        Không tìm thấy trường nào phù hợp với bộ lọc phân cấp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sơ đồ cây Cấp 4 & 5 (Phân hiệu & Điểm trường lẻ) */}
          {overview.find((s) => s.id === selectedSchool)?.campusDetails && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <span>🗺️</span> Cấu Trúc Điểm Trường Phân Tán (Cấp 4 & Cấp 5)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Đơn vị đang xem: <span className="font-semibold text-indigo-700">{overview.find((s) => s.id === selectedSchool)?.name}</span>
                  </p>
                </div>
                <span className="text-xs bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-medium">
                  Cấp 3 → Cấp 4 → Cấp 5
                </span>
              </div>

              <div className="space-y-6">
                {overview
                  .find((s) => s.id === selectedSchool)
                  ?.campusDetails?.map((campus) => (
                    <div key={campus.id} className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/30">
                      <div className="flex items-center justify-between border-b border-indigo-100 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-600 text-white font-bold px-2.5 py-1 rounded-md text-xs">
                            Cấp 4: Phân hiệu
                          </span>
                          <h4 className="font-bold text-indigo-950 text-base">{campus.name}</h4>
                        </div>
                        <span className="text-xs text-gray-500">📍 {campus.address}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {campus.schoolPoints.map((sp) => (
                          <div key={sp.id} className="bg-white p-4 rounded-lg border shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-gray-900 text-sm flex items-center gap-1">
                                  <span>📍</span> Cấp 5: {sp.name}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                                  {sp.distanceKm === 0 ? "Điểm trung tâm" : `Cách ${sp.distanceKm} km`}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mb-3">📍 {sp.address || "Chưa cập nhật địa chỉ"}</p>
                              <div className="text-xs space-y-1 text-gray-600 bg-gray-50 p-2.5 rounded-lg border">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Phụ trách:</span>
                                  <span className="font-semibold text-gray-800">{sp.managerName || "Chưa gán"}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">SĐT liên hệ:</span>
                                  <span className="font-medium text-gray-800">{sp.phone || "—"}</span>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t flex justify-between text-xs text-gray-600">
                              <span>{sp.classCount} Lớp học</span>
                              <span className="font-bold text-indigo-600">{sp.studentCount} Học sinh</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Xu hướng theo thời gian */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span>📈</span> Xu hướng Chuyên cần & Điểm số
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSchool}
                    onChange={(e) => setSelectedSchool(e.target.value)}
                    className="px-2 py-1 border rounded text-xs"
                  >
                    {overview.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={trendPeriod}
                    onChange={(e) =>
                      setTrendPeriod(e.target.value as "week" | "month")
                    }
                    className="px-2 py-1 border rounded text-xs"
                  >
                    <option value="week">Theo tuần</option>
                    <option value="month">Theo tháng</option>
                  </select>
                </div>
              </div>
              {trends[selectedSchool] && trends[selectedSchool].length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trends[selectedSchool]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis
                      yAxisId="left"
                      domain={[0, 100]}
                      fontSize={12}
                      label={{
                        value: "Chuyên cần (%)",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 11 },
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 10]}
                      fontSize={12}
                      label={{
                        value: "Điểm TB",
                        angle: 90,
                        position: "insideRight",
                        style: { fontSize: 11 },
                      }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="attendanceRate"
                      stroke="#4f46e5"
                      name="Chuyên cần (%)"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="avgScore"
                      stroke="#10b981"
                      name="Điểm TB"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
                  Chưa có dữ liệu xu hướng cho trường này
                </div>
              )}
            </div>

            {/* Xếp hạng trường */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span>🏆</span> Xếp Hạng Đơn Vị
                </h3>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "attendance" | "score")
                  }
                  className="px-2 py-1 border rounded text-xs"
                >
                  <option value="attendance">Theo chuyên cần</option>
                  <option value="score">Theo điểm TB</option>
                </select>
              </div>
              {ranked.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={ranked}
                    layout="vertical"
                    margin={{ left: 20, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      domain={sortBy === "attendance" ? [0, 100] : [0, 10]}
                      fontSize={12}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      fontSize={12}
                    />
                    <Tooltip />
                    <Bar
                      dataKey={
                        sortBy === "attendance" ? "attendanceRate" : "avgScore"
                      }
                      fill={sortBy === "attendance" ? "#4f46e5" : "#10b981"}
                      radius={[0, 4, 4, 0]}
                      name={
                        sortBy === "attendance" ? "Chuyên cần (%)" : "Điểm TB"
                      }
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
                  Chưa có dữ liệu xếp hạng
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Visual Tree View Component for 5 Tiers
function Visual5TierTree({ hierarchy }: { hierarchy: any[] }) {
  if (!hierarchy || hierarchy.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl border text-center text-gray-500">
        Đang tải dữ liệu cây sơ đồ 5 cấp...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hierarchy.map((dept) => (
        <div key={dept.id} className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          {/* Tier 1 Header */}
          <div className="flex items-center gap-3 border-b pb-4">
            <span className="bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wide">
              Cấp 1: Sở GD&ĐT
            </span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{dept.name}</h2>
              <p className="text-xs text-gray-500">Mã đơn vị: {dept.code} — Địa chỉ: {dept.address || "Tỉnh/Thành phố"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pl-4 border-l-2 border-indigo-200">
            {/* Branch 1: Ward / District (Mầm non, Tiểu học, THCS) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-teal-50 p-3 rounded-lg border border-teal-200">
                <span className="text-lg">🏡</span>
                <div>
                  <h3 className="font-bold text-teal-900 text-sm">
                    Nhánh Phường / Xã (Mầm non, Tiểu học, THCS)
                  </h3>
                  <p className="text-xs text-teal-700">Quản lý theo phân cấp địa bàn xã/phường</p>
                </div>
              </div>

              {dept.districtWards?.map((dw: any) => (
                <div key={dw.id} className="ml-4 p-4 border rounded-xl bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-semibold text-gray-900 text-sm">
                      📍 Cấp 2: {dw.name} ({dw.code})
                    </span>
                    <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-medium">
                      {dw.schools?.length || 0} Trường
                    </span>
                  </div>

                  <div className="space-y-2 pl-3 border-l-2 border-teal-300">
                    {dw.schools?.map((school: any) => (
                      <div key={school.id} className="bg-white p-3 rounded-lg border text-xs space-y-2">
                        <div className="font-bold text-indigo-900 text-sm">
                          🏫 Cấp 3: {school.name}
                        </div>
                        <div className="pl-3 border-l space-y-1">
                          {school.campuses?.map((campus: any) => (
                            <div key={campus.id} className="text-gray-700 font-medium">
                              🏢 Cấp 4: {campus.name}
                              <div className="flex flex-wrap gap-1 mt-1 pl-2">
                                {campus.schoolPoints?.map((sp: any) => (
                                  <span key={sp.id} className="bg-gray-100 text-gray-700 text-[11px] px-2 py-0.5 rounded border">
                                    📍 Cấp 5: {sp.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Branch 2: High School (THPT Direct Management under Department) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-purple-50 p-3 rounded-lg border border-purple-200">
                <span className="text-lg">🎓</span>
                <div>
                  <h3 className="font-bold text-purple-900 text-sm">
                    Nhánh Trực Thuộc: Khối THPT
                  </h3>
                  <p className="text-xs text-purple-700">Quản lý trực tiếp từ Sở GD&ĐT</p>
                </div>
              </div>

              <div className="ml-4 space-y-3">
                {dept.schools?.map((school: any) => (
                  <div key={school.id} className="p-4 border rounded-xl bg-purple-50/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                      <span className="font-bold text-purple-950 text-sm">
                        🏫 Cấp 3: {school.name}
                      </span>
                      <span className="text-xs bg-purple-200 text-purple-900 px-2 py-0.5 rounded font-semibold">
                        Trực thuộc Sở
                      </span>
                    </div>

                    <div className="space-y-2 pl-3 border-l-2 border-purple-300">
                      {school.campuses?.map((campus: any) => (
                        <div key={campus.id} className="bg-white p-3 rounded-lg border text-xs space-y-2">
                          <div className="font-semibold text-gray-900">
                            🏢 Cấp 4: {campus.name}
                          </div>
                          <div className="flex flex-wrap gap-1 pl-2">
                            {campus.schoolPoints?.map((sp: any) => (
                              <span key={sp.id} className="bg-purple-100 text-purple-800 text-[11px] px-2 py-0.5 rounded border border-purple-200">
                                📍 Cấp 5: {sp.name} ({sp.distanceKm === 0 ? "Trung tâm" : `${sp.distanceKm} km`})
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-4 shadow-sm ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium opacity-80 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}
