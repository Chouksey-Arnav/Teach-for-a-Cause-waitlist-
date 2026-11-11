"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { INSTRUMENTS } from "@/lib/instruments";
import { COUNTIES } from "@/lib/counties";

export interface WaitlistRecord {
  id: string;
  role: "parent" | "tutor";
  email: string;
  grade: number;
  instrument: string;
  county: string | null;
  status: "waiting" | "notified";
  created_at: string;
  notified_at: string | null;
}

// Convert grade to standard school age estimation
function getEstimatedAge(grade: number): string {
  // Grade 6: ~11-12, Grade 7: ~12-13, Grade 8: ~13-14
  // Grade 9: ~14-15, Grade 10: ~15-16, Grade 11: ~16-17, Grade 12: ~17-18
  switch (grade) {
    case 6: return "11–12 yrs";
    case 7: return "12–13 yrs";
    case 8: return "13–14 yrs";
    case 9: return "14–15 yrs";
    case 10: return "15–16 yrs";
    case 11: return "16–17 yrs";
    case 12: return "17–18 yrs";
    default: return `${grade + 5}–${grade + 6} yrs`;
  }
}

// Extract display name or username from email
function extractDisplayName(email: string): string {
  const [local] = email.split("@");
  if (!local) return email;
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length > 0) {
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  return local;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const [signups, setSignups] = useState<WaitlistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [adminKey, setAdminKey] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<WaitlistRecord | null>(null);

  // Filters & Controls
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "parent" | "tutor">("all");
  const [instrumentFilter, setInstrumentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "waiting" | "notified">("all");
  const [countyFilter, setCountyFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortField, setSortField] = useState<"created_at" | "grade" | "email" | "instrument">("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchSignups = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const storedKey = typeof window !== "undefined" ? localStorage.getItem("tfac_admin_key") : "";
      const keyToUse = adminKey || storedKey || "";
      if (keyToUse) {
        headers["x-admin-key"] = keyToUse;
      }

      const res = await fetch("/api/admin/signups", { headers, cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status === 401) {
          setError("Admin access key required.");
        } else {
          setError(data.error || "Failed to load database records.");
        }
      } else {
        setSignups(data.signups);
        setLastSynced(new Date());
        setError(null);
      }
    } catch {
      setError("Network error: Could not reach the server.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    const stored = localStorage.getItem("tfac_admin_key");
    if (stored) setAdminKey(stored);
  }, []);

  useEffect(() => {
    fetchSignups();
  }, [fetchSignups]);

  // Real-time polling sync (every 6 seconds if enabled)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchSignups(true);
    }, 6000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchSignups]);

  // Update status (mark notified / waiting)
  const handleToggleStatus = async (record: WaitlistRecord) => {
    const nextStatus = record.status === "waiting" ? "notified" : "waiting";
    setActionInProgress(record.id);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminKey) headers["x-admin-key"] = adminKey;

      const res = await fetch("/api/admin/signups", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: record.id, status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSignups((prev) =>
          prev.map((item) => (item.id === record.id ? data.signup : item))
        );
        if (selectedRecord?.id === record.id) {
          setSelectedRecord(data.signup);
        }
      } else {
        alert(data.error || "Failed to update record status");
      }
    } catch {
      alert("Error updating status. Please try again.");
    } finally {
      setActionInProgress(null);
    }
  };

  // Delete record
  const handleDeleteRecord = async (record: WaitlistRecord) => {
    if (!confirm(`Are you sure you want to delete the signup for ${record.email}?`)) return;
    setActionInProgress(record.id);
    try {
      const headers: Record<string, string> = {};
      if (adminKey) headers["x-admin-key"] = adminKey;

      const res = await fetch(`/api/admin/signups?id=${encodeURIComponent(record.id)}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSignups((prev) => prev.filter((item) => item.id !== record.id));
        if (selectedRecord?.id === record.id) {
          setSelectedRecord(null);
        }
      } else {
        alert(data.error || "Failed to delete record");
      }
    } catch {
      alert("Error deleting record.");
    } finally {
      setActionInProgress(null);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (signups.length === 0) return;
    const headers = ["ID", "Role", "Name/Contact", "Email", "Grade", "Estimated Age", "Instrument", "County", "Status", "Created At", "Notified At"];
    const rows = filteredSignups.map((s) => [
      `"${s.id}"`,
      `"${s.role === "parent" ? "Student (Parent)" : "Musician Tutor"}"`,
      `"${extractDisplayName(s.email)}"`,
      `"${s.email}"`,
      `"Grade ${s.grade}"`,
      `"${getEstimatedAge(s.grade)}"`,
      `"${s.instrument}"`,
      `"${s.county || "N/A"}"`,
      `"${s.status}"`,
      `"${s.created_at}"`,
      `"${s.notified_at || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `teach-for-a-cause-waitlist-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered & Sorted Signups
  const filteredSignups = useMemo(() => {
    return signups
      .filter((item) => {
        if (roleFilter !== "all" && item.role !== roleFilter) return false;
        if (instrumentFilter !== "all" && item.instrument !== instrumentFilter) return false;
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (countyFilter !== "all" && (item.county || "") !== countyFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const name = extractDisplayName(item.email).toLowerCase();
          const matchEmail = item.email.toLowerCase().includes(q);
          const matchInst = item.instrument.toLowerCase().includes(q);
          const matchCounty = (item.county || "").toLowerCase().includes(q);
          const matchGrade = `grade ${item.grade}`.includes(q);
          const matchAge = getEstimatedAge(item.grade).toLowerCase().includes(q);
          if (!name.includes(q) && !matchEmail && !matchInst && !matchCounty && !matchGrade && !matchAge) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let valA: string | number = a[sortField] ?? "";
        let valB: string | number = b[sortField] ?? "";
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [signups, roleFilter, instrumentFilter, statusFilter, countyFilter, search, sortField, sortAsc]);

  // Statistics
  const totalCount = signups.length;
  const studentCount = signups.filter((s) => s.role === "parent").length;
  const tutorCount = signups.filter((s) => s.role === "tutor").length;
  const waitingCount = signups.filter((s) => s.status === "waiting").length;
  const notifiedCount = signups.filter((s) => s.status === "notified").length;

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      {/* Top Header */}
      <header className="border-b border-line bg-card sticky top-0 z-30 shadow-sm backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a href="/" className="font-serif text-xl sm:text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity">
              Teach for a Cause
            </a>
            <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted border border-line">
              Admin Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Real-time Indicator & Sync Status */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted border border-line rounded-full px-3 py-1 bg-soft/50">
              <span className={`inline-block h-2 w-2 rounded-full ${autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
              <span>{autoRefresh ? "Live Sync Active" : "Sync Paused"}</span>
              {lastSynced && (
                <span className="text-[11px] opacity-75">
                  ({lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })})
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? "Pause automatic polling" : "Resume real-time polling"}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-line hover:bg-soft transition-colors"
            >
              {autoRefresh ? "Pause Live" : "Resume Live"}
            </button>

            <button
              type="button"
              onClick={() => fetchSignups(false)}
              disabled={loading}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-clay text-clay-ink hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 flex-1">
        {/* Title & Overview Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-line">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">
              Student & Tutor Waitlist Dashboard
            </h1>
            <p className="mt-1 text-sm sm:text-base text-muted">
              Real-time overview of student and musician registrations, ages, contact emails, and onboarding statuses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={signups.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-soft transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export CSV</span>
            </button>

            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-soft transition-colors"
            >
              <span>View Public Page</span>
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* Real-time Summary Stat Cards */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div
            onClick={() => { setRoleFilter("all"); setStatusFilter("all"); }}
            className="cursor-pointer rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-sm hover:border-clay/60 transition-all"
          >
            <div className="text-xs uppercase font-semibold tracking-wider text-muted">Total Signups</div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold font-serif text-ink">{totalCount}</div>
            <div className="mt-1 text-xs text-muted">Registered in database</div>
          </div>

          <div
            onClick={() => setRoleFilter("parent")}
            className={`cursor-pointer rounded-2xl border p-4 sm:p-5 shadow-sm hover:border-clay/60 transition-all ${
              roleFilter === "parent" ? "border-clay bg-soft/50" : "border-line bg-card"
            }`}
          >
            <div className="text-xs uppercase font-semibold tracking-wider text-muted">Middle School Students</div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold font-serif text-ink">{studentCount}</div>
            <div className="mt-1 text-xs text-muted">Grades 6–8 (Ages 11–14)</div>
          </div>

          <div
            onClick={() => setRoleFilter("tutor")}
            className={`cursor-pointer rounded-2xl border p-4 sm:p-5 shadow-sm hover:border-clay/60 transition-all ${
              roleFilter === "tutor" ? "border-clay bg-soft/50" : "border-line bg-card"
            }`}
          >
            <div className="text-xs uppercase font-semibold tracking-wider text-muted">High School Tutors</div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold font-serif text-ink">{tutorCount}</div>
            <div className="mt-1 text-xs text-muted">Grades 9–12 (Ages 14–18)</div>
          </div>

          <div
            onClick={() => setStatusFilter("waiting")}
            className={`cursor-pointer rounded-2xl border p-4 sm:p-5 shadow-sm hover:border-clay/60 transition-all ${
              statusFilter === "waiting" ? "border-clay bg-soft/50" : "border-line bg-card"
            }`}
          >
            <div className="text-xs uppercase font-semibold tracking-wider text-muted">Waiting Match</div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold font-serif text-amber-600 dark:text-amber-400">
              {waitingCount}
            </div>
            <div className="mt-1 text-xs text-muted">Awaiting tutor pairings</div>
          </div>

          <div
            onClick={() => setStatusFilter("notified")}
            className={`cursor-pointer rounded-2xl border p-4 sm:p-5 shadow-sm hover:border-clay/60 transition-all ${
              statusFilter === "notified" ? "border-clay bg-soft/50" : "border-line bg-card"
            }`}
          >
            <div className="text-xs uppercase font-semibold tracking-wider text-muted">Notified / Paired</div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold font-serif text-green-600 dark:text-green-400">
              {notifiedCount}
            </div>
            <div className="mt-1 text-xs text-muted">Invitation emails sent</div>
          </div>
        </div>

        {/* Optional Admin Passkey banner if unauthorized */}
        {error && (
          <div className="mt-6 rounded-2xl border border-clay bg-soft/80 p-5 text-sm">
            <div className="font-semibold text-clay mb-1.5 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
            <p className="text-muted mb-3">
              If an ADMIN_SECRET_KEY is configured in your environment, enter it below to authenticate this session.
            </p>
            <div className="flex max-w-md gap-2">
              <input
                type="password"
                placeholder="Enter Admin Secret Key"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="h-10 flex-1 rounded-xl border border-line bg-bg px-3 text-sm text-ink focus:outline-clay"
              />
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("tfac_admin_key", adminKey);
                  fetchSignups(false);
                }}
                className="h-10 px-4 rounded-xl bg-clay text-clay-ink font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Authenticate
              </button>
            </div>
          </div>
        )}

        {/* Filter & Navigation Bar */}
        <div className="mt-8 rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name, email, instrument, age, or county..."
                className="h-11 w-full rounded-xl border border-line bg-bg pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-clay focus:outline-none transition-all"
              />
              <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-3 text-xs text-muted hover:text-ink font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Layout Toggle (Table vs Cards) */}
            <div className="flex items-center gap-1 bg-soft p-1 rounded-xl border border-line self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === "table" ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === "cards" ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Cards</span>
              </button>
            </div>
          </div>

          {/* Granular Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-line">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-line bg-bg px-2.5 text-xs text-ink focus:outline-clay"
              >
                <option value="all">All Roles ({signups.length})</option>
                <option value="parent">Middle School Students ({studentCount})</option>
                <option value="tutor">High School Tutors ({tutorCount})</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Instrument</label>
              <select
                value={instrumentFilter}
                onChange={(e) => setInstrumentFilter(e.target.value)}
                className="w-full h-9 rounded-lg border border-line bg-bg px-2.5 text-xs text-ink focus:outline-clay"
              >
                <option value="all">All Instruments</option>
                {INSTRUMENTS.map((inst) => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-line bg-bg px-2.5 text-xs text-ink focus:outline-clay"
              >
                <option value="all">All Statuses</option>
                <option value="waiting">Waiting ({waitingCount})</option>
                <option value="notified">Notified ({notifiedCount})</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">County</label>
              <select
                value={countyFilter}
                onChange={(e) => setCountyFilter(e.target.value)}
                className="w-full h-9 rounded-lg border border-line bg-bg px-2.5 text-xs text-ink focus:outline-clay"
              >
                <option value="all">All NC Counties</option>
                {COUNTIES.map((county) => (
                  <option key={county} value={county}>{county}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Info Bar */}
        <div className="mt-4 flex items-center justify-between text-xs text-muted px-1">
          <div>
            Showing <span className="font-semibold text-ink">{filteredSignups.length}</span> of {totalCount} records
            {(search || roleFilter !== "all" || instrumentFilter !== "all" || statusFilter !== "all" || countyFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setInstrumentFilter("all");
                  setStatusFilter("all");
                  setCountyFilter("all");
                }}
                className="ml-2 underline text-clay hover:text-clay-hover"
              >
                Reset filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span>Sort by:</span>
            <button
              type="button"
              onClick={() => {
                if (sortField === "created_at") setSortAsc(!sortAsc);
                else { setSortField("created_at"); setSortAsc(false); }
              }}
              className={`hover:text-ink ${sortField === "created_at" ? "font-semibold text-ink underline" : ""}`}
            >
              Date {sortField === "created_at" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
            <button
              type="button"
              onClick={() => {
                if (sortField === "grade") setSortAsc(!sortAsc);
                else { setSortField("grade"); setSortAsc(true); }
              }}
              className={`hover:text-ink ${sortField === "grade" ? "font-semibold text-ink underline" : ""}`}
            >
              Age/Grade {sortField === "grade" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
          </div>
        </div>

        {/* Main Records Display (Table or Cards) */}
        {loading && signups.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-line bg-card p-12 text-center text-muted">
            <svg className="w-8 h-8 animate-spin mx-auto mb-3 text-clay" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="font-medium text-ink">Connecting to Supabase Database…</p>
            <p className="text-sm mt-1">Retrieving verified student & tutor registrations.</p>
          </div>
        ) : filteredSignups.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-card/60 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-soft flex items-center justify-center mx-auto mb-3 text-muted">
              🔍
            </div>
            <h3 className="font-serif text-xl font-bold text-ink">No matching registrations found</h3>
            <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
              Try adjusting your search criteria, role filters, or check back as more students sign up on the public waitlist.
            </p>
          </div>
        ) : viewMode === "table" ? (
          /* Table Layout */
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-soft/50 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <th className="py-3.5 px-4">Contact / Name</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Age & Grade</th>
                    <th className="py-3.5 px-4">Instrument</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Registered</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredSignups.map((s) => {
                    const isStudent = s.role === "parent";
                    const isSelected = selectedRecord?.id === s.id;
                    const isBusy = actionInProgress === s.id;

                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedRecord(s)}
                        className={`cursor-pointer transition-colors hover:bg-soft/50 ${
                          isSelected ? "bg-soft" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-ink flex items-center gap-1.5">
                            <span>{extractDisplayName(s.email)}</span>
                            {isStudent && (
                              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
                                Parent
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted break-all">{s.email}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isStudent
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            }`}
                          >
                            {isStudent ? "Middle Schooler" : "Musician Tutor"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-ink">Grade {s.grade}</div>
                          <div className="text-xs text-muted">Age ~{getEstimatedAge(s.grade)}</div>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-ink">
                          {s.instrument}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-muted">
                          {s.county ? `${s.county} County` : "NC (Not specified)"}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              s.status === "waiting"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${s.status === "waiting" ? "bg-amber-500" : "bg-green-500"}`} />
                            {s.status === "waiting" ? "Waiting" : "Notified"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-muted whitespace-nowrap">
                          {formatDate(s.created_at)}
                        </td>

                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s)}
                              disabled={isBusy}
                              title={s.status === "waiting" ? "Mark as notified" : "Revert to waiting"}
                              className="px-2.5 py-1 text-xs rounded-lg border border-line bg-card hover:bg-soft transition-colors disabled:opacity-50"
                            >
                              {s.status === "waiting" ? "Mark Notified" : "Revert"}
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedRecord(s)}
                              className="px-2.5 py-1 text-xs rounded-lg bg-soft hover:bg-line/40 transition-colors"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Cards Grid Layout */
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSignups.map((s) => {
              const isStudent = s.role === "parent";
              const isSelected = selectedRecord?.id === s.id;
              const isBusy = actionInProgress === s.id;

              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedRecord(s)}
                  className={`cursor-pointer rounded-2xl border p-5 bg-card transition-all shadow-sm hover:shadow-md hover:border-clay/60 flex flex-col justify-between ${
                    isSelected ? "border-clay ring-1 ring-clay bg-soft/30" : "border-line"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isStudent
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                        }`}
                      >
                        {isStudent ? "Middle School Student" : "High School Tutor"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.status === "waiting"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${s.status === "waiting" ? "bg-amber-500" : "bg-green-500"}`} />
                        {s.status === "waiting" ? "Waiting" : "Notified"}
                      </span>
                    </div>

                    <h3 className="mt-3 font-serif text-lg font-bold text-ink">
                      {extractDisplayName(s.email)}
                    </h3>
                    <p className="text-xs text-muted break-all">{s.email}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-line bg-soft/50 p-2.5">
                        <div className="text-[10px] uppercase font-semibold text-muted">Instrument</div>
                        <div className="font-semibold text-ink text-sm mt-0.5">{s.instrument}</div>
                      </div>

                      <div className="rounded-xl border border-line bg-soft/50 p-2.5">
                        <div className="text-[10px] uppercase font-semibold text-muted">Grade & Age</div>
                        <div className="font-semibold text-ink text-sm mt-0.5">Grade {s.grade}</div>
                        <div className="text-[11px] text-muted">~{getEstimatedAge(s.grade)}</div>
                      </div>
                    </div>

                    <div className="mt-2.5 text-xs text-muted flex items-center justify-between">
                      <span>{s.county ? `${s.county} County, NC` : "North Carolina"}</span>
                      <span>{formatDate(s.created_at)}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(s)}
                      disabled={isBusy}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-line bg-card hover:bg-soft transition-colors disabled:opacity-50"
                    >
                      {s.status === "waiting" ? "Mark Notified" : "Revert to Waiting"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRecord(s)}
                      className="text-xs font-medium text-clay hover:underline"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Interactive Detail Drawer Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-lg rounded-3xl border border-line bg-card p-6 sm:p-8 shadow-2xl relative"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setSelectedRecord(null)}
              className="absolute right-5 top-5 h-8 w-8 rounded-full border border-line flex items-center justify-center text-muted hover:text-ink hover:bg-soft transition-colors"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  selectedRecord.role === "parent"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                }`}
              >
                {selectedRecord.role === "parent" ? "Middle School Student (Parent Contact)" : "High School Volunteer Tutor"}
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  selectedRecord.status === "waiting"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                }`}
              >
                {selectedRecord.status === "waiting" ? "Waiting for Match" : "Notified"}
              </span>
            </div>

            <h2 className="font-serif text-2xl font-bold text-ink">
              {extractDisplayName(selectedRecord.email)}
            </h2>
            <p className="text-sm text-muted break-all mt-0.5">{selectedRecord.email}</p>

            <div className="mt-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-line bg-soft/60 p-3.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Instrument</span>
                  <div className="text-base font-bold text-ink mt-0.5">{selectedRecord.instrument}</div>
                </div>

                <div className="rounded-2xl border border-line bg-soft/60 p-3.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Grade Level</span>
                  <div className="text-base font-bold text-ink mt-0.5">Grade {selectedRecord.grade}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-line bg-soft/60 p-3.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Estimated Age</span>
                  <div className="text-base font-bold text-ink mt-0.5">{getEstimatedAge(selectedRecord.grade)}</div>
                </div>

                <div className="rounded-2xl border border-line bg-soft/60 p-3.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">County / Region</span>
                  <div className="text-base font-bold text-ink mt-0.5">
                    {selectedRecord.county ? `${selectedRecord.county} County` : "North Carolina"}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-soft/60 p-3.5 space-y-1 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Record ID:</span>
                  <span className="font-mono text-ink text-[11px]">{selectedRecord.id}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Registered At:</span>
                  <span className="text-ink">{formatDate(selectedRecord.created_at)}</span>
                </div>
                {selectedRecord.notified_at && (
                  <div className="flex justify-between text-muted">
                    <span>Notified At:</span>
                    <span className="text-ink">{formatDate(selectedRecord.notified_at)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(selectedRecord)}
                  disabled={actionInProgress === selectedRecord.id}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-clay text-clay-ink hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {selectedRecord.status === "waiting" ? "Mark as Notified" : "Mark as Waiting"}
                </button>

                <a
                  href={`mailto:${selectedRecord.email}?subject=Teach%20for%20a%20Cause%20Waitlist%20Update`}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-line bg-card hover:bg-soft transition-colors"
                >
                  Send Email
                </a>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteRecord(selectedRecord)}
                disabled={actionInProgress === selectedRecord.id}
                className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline px-2 py-1"
              >
                Delete Signup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-line py-6 bg-card text-center text-xs text-muted">
        Teach for a Cause · Confidential Admin Dashboard · Database connected via Supabase
      </footer>
    </div>
  );
}
