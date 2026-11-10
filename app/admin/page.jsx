"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  BLOOD_GROUPS,
  PROFESSIONS,
  PLAYER_ROLES,
  PLAYING_STYLES,
  TSHIRT_SIZES,
  PANT_SIZES,
  PREVIOUS_TEAMS,
  TSHIRT_NUMBER_MIN,
  TSHIRT_NUMBER_MAX,
  TSHIRT_NAME_MAX_LENGTH,
} from "../../constants/playerOptions";
import { calculateAge } from "../../utils/apiHelpers";

/* ─── Status Badges & Colors ────────────────────────────────── */
const STATUS_COLORS = {
  pending: { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
  approved: { bg: "#D1FAE5", text: "#059669", border: "#A7F3D0" },
  rejected: { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" },
};

const STATUS_OPTIONS = ["pending", "approved", "rejected"];
const PAYMENT_METHODS = ["Online", "Cash"];
const PLAYER_POOLS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

function Badge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        borderRadius: 20,
        padding: "4px 12px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        display: "inline-block",
      }}
    >
      {status}
    </span>
  );
}

function Avatar({ src, name, size = 38 }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #3B82F6, #1E40AF)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: size * 0.38,
          flexShrink: 0,
        }}
      >
        {(name || "?")[0].toUpperCase()}
      </div>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={name || "Player"}
      onError={() => setErr(true)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        border: "1.5px solid #E2E8F0",
      }}
    />
  );
}

function formatDate(d) {
  if (!d) return "Not Available";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "Not Available";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB"); // DD/MM/YYYY
}

function formatDateTime(d) {
  if (!d) return "Not Available";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "Not Available";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// Parse previous performance string format
function parsePreviousPerformance(recordString) {
  if (!recordString || recordString === "N/A") return [];
  return recordString
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((season) => {
      const match = season.match(/(\d{4})\s*:-\s*(.*)/);
      if (!match) return null;
      const year = Number(match[1]);
      const statsPart = match[2];
      const data = {
        year,
        matches: 0,
        runs: 0,
        wickets: 0,
        fielding: 0,
        mom: 0,
        battingAvg: 0,
        strikeRate: 0,
        economy: 0,
      };
      statsPart.split(",").forEach((pair) => {
        const [k, v] = pair.split(":").map((x) => x?.trim());
        const value = Number(v) || 0;
        if (k === "M") data.matches = value;
        if (k === "R") data.runs = value;
        if (k === "W") data.wickets = value;
        if (k === "F") data.fielding = value;
        if (k === "MOM") data.mom = value;
        if (k === "AVG") data.battingAvg = value;
        if (k === "SR") data.strikeRate = value;
        if (k === "ECON") data.economy = value;
      });
      return data;
    })
    .filter(Boolean);
}

function formatPerformanceSummary(perfArray) {
  if (!Array.isArray(perfArray) || perfArray.length === 0) return "Not Available";
  return perfArray
    .map(
      (s) =>
        `${s.year} :- M:${s.matches || 0}, R:${s.runs || 0}, W:${s.wickets || 0}, F:${s.fielding || 0}${s.mom ? `, MOM:${s.mom}` : ""}`
    )
    .join(" | ");
}

/* ─── Searchable Select for Admin ───────────────────────────── */
function AdminSearchableSelect({ value, onChange, options, placeholder = "Select standard/profession" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(q.toLowerCase().trim()),
  );

  useEffect(() => {
    const clickOut = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", clickOut);
    return () => document.removeEventListener("mousedown", clickOut);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          ...styles.input,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: value ? "#0F172A" : "#94A3B8" }}>
          {value || placeholder}
        </span>
        <span style={{ fontSize: 10, color: "#64748B" }}>▼</span>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1050,
            marginTop: 4,
            background: "#fff",
            border: "1px solid #CBD5E1",
            borderRadius: 8,
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "6px 8px", borderBottom: "1px solid #F1F5F9" }}>
            <input
              type="text"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #E2E8F0",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>
          <div style={{ padding: 4 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 8, fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
                No options found
              </div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  style={{
                    padding: "8px 10px",
                    fontSize: 12,
                    borderRadius: 6,
                    cursor: "pointer",
                    background: value === opt ? "#EFF6FF" : "transparent",
                    color: value === opt ? "#1E40AF" : "#334155",
                    fontWeight: value === opt ? 600 : 400,
                  }}
                >
                  {opt}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Admin Component ──────────────────────────────────── */
export default function PlayersAdminPage() {
  /* state */
  const [players, setPlayers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [selectedPlayer, setSelected] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [toast, setToast] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  /* search & debounced search */
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  /* filters */
  const [filterStatus, setFStatus] = useState("");
  const [filterType, setFType] = useState("");
  const [filterProfession, setFProfession] = useState("");
  const [filterPool, setFPool] = useState("");
  const [filterPayment, setFPayment] = useState("");

  /* sorting */
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  /* pagination */
  const [page, setPage] = useState(1);
  const limit = 20;

  /* 8 Stats Cards from reference screenshot */
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    batsmen: 0,
    bowlers: 0,
    allRounders: 0,
    online: 0,
    cash: 0,
  });

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── fetch players ── */
  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortField,
      sortOrder,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(filterStatus && { status: filterStatus }),
      ...(filterType && { playerType: filterType }),
      ...(filterProfession && { profession: filterProfession }),
      ...(filterPool !== "" && { playerPool: filterPool }),
      ...(filterPayment && { paymentMethod: filterPayment }),
    });

    try {
      const r = await fetch(`/api/players?${params.toString()}`);
      const data = await r.json();
      if (data.success) {
        setPlayers(data.data.players || []);
        if (data.data.pagination) {
          setPagination(data.data.pagination);
        }
        if (data.data.stats) {
          setStats(data.data.stats);
        }
      } else {
        showToast(data.message || "Failed to fetch players", "error");
      }
    } catch {
      showToast("Network error while fetching players", "error");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    debouncedSearch,
    filterStatus,
    filterType,
    filterProfession,
    filterPool,
    filterPayment,
    sortField,
    sortOrder,
  ]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  /* ── toast ── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── status update ── */
  const updateStatus = async (playerId, newStatus) => {
    try {
      const r = await fetch(`/api/players/${playerId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await r.json();
      if (data.success) {
        showToast(`Status updated to "${newStatus}"`);
        fetchPlayers();
        if (selectedPlayer?._id === playerId && data.data?.player) {
          setSelected(data.data.player);
        }
      } else {
        showToast(data.message || "Status update failed", "error");
      }
    } catch {
      showToast("Network error updating status", "error");
    }
  };

  /* ── delete player ── */
  const deletePlayer = async (playerId, playerName) => {
    if (!window.confirm(`Are you sure you want to delete "${playerName || "this player"}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const r = await fetch(`/api/players/${playerId}`, { method: "DELETE" });
      const data = await r.json();
      if (data.success) {
        showToast("Player deleted successfully");
        if (selectedPlayer?._id === playerId) setSelected(null);
        if (editingPlayer?._id === playerId) setEditingPlayer(null);
        fetchPlayers();
      } else {
        showToast(data.message || "Delete failed", "error");
      }
    } catch {
      showToast("Network error deleting player", "error");
    }
  };

  /* ── sort handler ── */
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  /* ── fetch ALL for export (no pagination) ── */
  const fetchAllForExport = async () => {
    const r = await fetch(`/api/players?limit=10000`);
    const d = await r.json();
    return d.success ? d.data.players : players;
  };

  /* ─── Excel Export (26 Fields) ────────────────────────────── */
  const exportExcel = async () => {
    setExporting("excel");
    try {
      const all = await fetchAllForExport();
      const rows = all.map((p) => {
        const computed = calculateAge(p.dateOfBirth, p.Age);
        return {
          "Player ID": p.playerID ?? "Not Available",
          "Full Name": p.playerName || "Not Available",
          "Mobile Number": p.playerPhone || "Not Available",
          "Date of Birth": formatDate(p.dateOfBirth),
          "Calculated Age": computed !== null ? computed : "Not Available",
          "Marriage Anniversary": formatDate(p.anniversary),
          "Blood Group": p.bloodGroup || "Not Available",
          "Father's Name": p.fatherName || "Not Available",
          "Mother's Name": p.motherName || "Not Available",
          "Standard / Profession":
            p.profession === "Other" && p.professionOther
              ? p.professionOther
              : p.profession || "Not Available",
          "Previous Team": p.previousTeam || "Not Available",
          "Previous Points":
            p.previousPoints !== undefined && p.previousPoints !== null
              ? p.previousPoints
              : "Not Available",
          "Previous Performance": formatPerformanceSummary(p.previousPerformance),
          "Residential Address":
            Array.isArray(p.playerAddress) && p.playerAddress[0]
              ? [
                  p.playerAddress[0].AddressLine1,
                  p.playerAddress[0].AddressLine2,
                  p.playerAddress[0].City,
                  p.playerAddress[0].State,
                  p.playerAddress[0].PinCode,
                  p.playerAddress[0].Country || "India",
                ]
                  .filter(Boolean)
                  .join(", ")
              : "Not Available",
          "Playing Style": Array.isArray(p.playingStyle)
            ? p.playingStyle.join(", ")
            : p.playingStyle || "Not Available",
          "Player Role": p.playerType || "Not Available",
          "Player Category": p.playerCategory || "Undefined",
          "Player Pool": p.playerPool ?? 0,
          "T-Shirt Size": p.tShirtSize || "Not Available",
          "Pant Size": p.pantSize || "Not Available",
          "T-Shirt Number": p.tShirtNumber ?? "Not Available",
          "T-Shirt Name": p.tShirtName || "Not Available",
          "Payment Method": p.paymentMethod || "Not Available",
          "Transaction ID": p.transactionId ? String(p.transactionId) : "Not Available",
          "Practice Availability":
            p.practice !== undefined && p.practice !== null
              ? `${p.practice} days`
              : "Not Available",
          "Registration Status": p.status || "Not Available",
          "Registration Date": p.createdAt
            ? formatDateTime(p.createdAt)
            : "Not Available",
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 10 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 14 },
        { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 24 },
        { wch: 18 }, { wch: 16 }, { wch: 45 }, { wch: 35 }, { wch: 28 },
        { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 20 },
        { wch: 14 }, { wch: 22 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "MPL Kids 2026 Players");
      XLSX.writeFile(wb, `MPL_Kids_2026_Players_${Date.now()}.xlsx`);
      showToast("Excel exported successfully with all 26 fields!");
    } catch (e) {
      console.error("Export error:", e);
      showToast("Excel export failed", "error");
    } finally {
      setExporting("");
    }
  };

  /* ─── Clear All Filters ────────────────────────────────────── */
  const clearAllFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFStatus("");
    setFType("");
    setFProfession("");
    setFPool("");
    setFPayment("");
    setSortField("createdAt");
    setSortOrder("desc");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search ||
      debouncedSearch ||
      filterStatus ||
      filterType ||
      filterProfession ||
      filterPool !== "" ||
      filterPayment ||
      sortField !== "createdAt" ||
      sortOrder !== "desc"
  );

  /* ─── Player Edit Modal Component ────────────────────────── */
  const PlayerEditModal = ({ player, onClose, onSaveSuccess }) => {
    const initialAddr = (Array.isArray(player.playerAddress) && player.playerAddress[0]) || {};

    const [editForm, setEditForm] = useState({
      playerName: player.playerName || "",
      playerPhone: player.playerPhone || "",
      dateOfBirth: player.dateOfBirth
        ? new Date(player.dateOfBirth).toISOString().split("T")[0]
        : "",
      anniversary: player.anniversary
        ? new Date(player.anniversary).toISOString().split("T")[0]
        : "",
      bloodGroup: player.bloodGroup || "",
      fatherName: player.fatherName || "",
      motherName: player.motherName || "",
      profession: player.profession || "",
      professionOther: player.professionOther || "",
      previousTeam: player.previousTeam || "",
      previousPoints:
        player.previousPoints !== undefined && player.previousPoints !== null
          ? String(player.previousPoints)
          : "",
      previousPerformance: Array.isArray(player.previousPerformance)
        ? JSON.parse(JSON.stringify(player.previousPerformance))
        : [],
      addressLine1: initialAddr.AddressLine1 || "",
      addressLine2: initialAddr.AddressLine2 || "",
      city: initialAddr.City || "",
      state: initialAddr.State || "",
      pinCode: initialAddr.PinCode || "",
      country: initialAddr.Country || "India",
      playingStyle: Array.isArray(player.playingStyle) ? player.playingStyle : [],
      playerType: player.playerType || "",
      playerPool: player.playerPool !== undefined ? String(player.playerPool) : "0",
      playerCategory: player.playerCategory || "Undefined",
      tShirtSize: player.tShirtSize || "",
      pantSize: player.pantSize || "",
      tShirtNumber: player.tShirtNumber !== undefined ? String(player.tShirtNumber) : "",
      tShirtName: player.tShirtName || "",
      practice: player.practice !== undefined && player.practice !== null ? String(player.practice) : "23",
      paymentMethod: player.paymentMethod || "Online",
    });

    const [quickImportText, setQuickImportText] = useState("");
    const [editErrors, setEditErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const handleStyleToggle = (styleVal) => {
      setEditForm((prev) => {
        let updated = [...prev.playingStyle];
        if (updated.includes(styleVal)) {
          updated = updated.filter((s) => s !== styleVal);
        } else {
          if (updated.length >= 2) return prev;
          updated.push(styleVal);
        }
        return { ...prev, playingStyle: updated };
      });
      if (editErrors.playingStyle) setEditErrors((prev) => ({ ...prev, playingStyle: "" }));
    };

    const handleAddSeason = () => {
      setEditForm((prev) => ({
        ...prev,
        previousPerformance: [
          ...prev.previousPerformance,
          {
            year: new Date().getFullYear() - 1,
            matches: 0,
            runs: 0,
            wickets: 0,
            fielding: 0,
            mom: 0,
            battingAvg: 0,
            strikeRate: 0,
            economy: 0,
          },
        ],
      }));
    };

    const handleSeasonChange = (index, field, val) => {
      setEditForm((prev) => {
        const copy = [...prev.previousPerformance];
        copy[index] = {
          ...copy[index],
          [field]: val === "" ? "" : Number(val) || 0,
        };
        return { ...prev, previousPerformance: copy };
      });
    };

    const handleRemoveSeason = (index) => {
      setEditForm((prev) => ({
        ...prev,
        previousPerformance: prev.previousPerformance.filter((_, i) => i !== index),
      }));
    };

    const handleImportQuickString = () => {
      if (!quickImportText.trim()) return;
      const parsed = parsePreviousPerformance(quickImportText.trim());
      if (parsed.length === 0) {
        showToast("Invalid format. Example: 2025 :- M:5, R:120, W:3, F:2", "error");
        return;
      }
      setEditForm((prev) => ({
        ...prev,
        previousPerformance: [...prev.previousPerformance, ...parsed],
      }));
      setQuickImportText("");
      showToast(`Added ${parsed.length} season record(s)!`);
    };

    const handleSave = async (e) => {
      e.preventDefault();
      const errs = {};

      if (!editForm.playerName.trim()) errs.playerName = "Full name is required";
      if (!/^[6-9]\d{9}$/.test(editForm.playerPhone.trim())) {
        errs.playerPhone = "10-digit mobile starting with 6-9 required";
      }
      if (!editForm.dateOfBirth) errs.dateOfBirth = "Date of Birth required";
      if (!editForm.bloodGroup) errs.bloodGroup = "Blood Group required";
      if (!editForm.fatherName.trim()) errs.fatherName = "Father's name required";
      if (!editForm.motherName.trim()) errs.motherName = "Mother's name required";
      if (!editForm.profession) errs.profession = "Standard / Profession is required";

      if (!editForm.playingStyle || editForm.playingStyle.length === 0) {
        errs.playingStyle = "Select 1 to 2 playing styles";
      }
      if (!editForm.playerType) errs.playerType = "Player role is required";
      if (!editForm.tShirtSize) errs.tShirtSize = "T-shirt size is required";
      if (!editForm.pantSize) errs.pantSize = "Pant size is required";

      const prevPointsVal =
        editForm.previousPoints.trim() === ""
          ? null
          : Number(editForm.previousPoints);

      const num = Number(editForm.tShirtNumber);
      if (
        editForm.tShirtNumber === "" ||
        !Number.isInteger(num) ||
        num < TSHIRT_NUMBER_MIN ||
        num > TSHIRT_NUMBER_MAX
      ) {
        errs.tShirtNumber = `Number between ${TSHIRT_NUMBER_MIN} and ${TSHIRT_NUMBER_MAX} required`;
      }
      if (!editForm.tShirtName.trim()) errs.tShirtName = "T-shirt name is required";

      const practiceNum = Number(editForm.practice);
      if (
        editForm.practice === "" ||
        !Number.isInteger(practiceNum) ||
        practiceNum < 0 ||
        practiceNum > 23
      ) {
        errs.practice = "Practice days must be an integer between 0 and 23";
      }

      if (Object.keys(errs).length > 0) {
        setEditErrors(errs);
        return;
      }

      setSaving(true);
      try {
        const payload = {
          ...editForm,
          previousPoints: prevPointsVal,
          previousPerformance: editForm.previousPerformance.map((s) => ({
            year: Number(s.year) || 0,
            matches: Number(s.matches) || 0,
            runs: Number(s.runs) || 0,
            wickets: Number(s.wickets) || 0,
            fielding: Number(s.fielding) || 0,
            mom: Number(s.mom) || 0,
            battingAvg: Number(s.battingAvg) || 0,
            strikeRate: Number(s.strikeRate) || 0,
            economy: Number(s.economy) || 0,
          })),
          tShirtNumber: num,
          tShirtName: editForm.tShirtName.trim().toUpperCase(),
          practice: practiceNum,
          playerPool: Number(editForm.playerPool) || 0,
          playerCategory: editForm.playerCategory.trim() || "Undefined",
          paymentMethod: editForm.paymentMethod,
        };

        const res = await fetch(`/api/players/${player._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success && data.data?.player) {
          showToast("Player updated successfully!");
          onSaveSuccess(data.data.player);
          onClose();
        } else {
          showToast(data.message || "Failed to update player", "error");
          if (data.errors) setEditErrors(data.errors);
        }
      } catch {
        showToast("Network error while saving changes", "error");
      } finally {
        setSaving(false);
      }
    };

    return (
      <div
        style={styles.overlay}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div style={{ ...styles.modal, maxWidth: 840 }}>
          <div style={styles.modalHeader}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#0F172A" }}>
                ✏️ Edit Player Profile
              </div>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                Player ID: #{player.playerID ?? "—"} &nbsp;·&nbsp; {player.playerName}
              </div>
            </div>
            <button onClick={onClose} style={styles.closeBtn}>
              ✕
            </button>
          </div>

          <form onSubmit={handleSave} style={{ padding: 24, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <div>
                <label style={styles.inputLabel}>Full Name *</label>
                <input
                  type="text"
                  value={editForm.playerName}
                  onChange={(e) => setEditForm({ ...editForm, playerName: e.target.value })}
                  style={styles.input}
                />
                {editErrors.playerName && <span style={styles.errText}>{editErrors.playerName}</span>}
              </div>

              <div>
                <label style={styles.inputLabel}>Mobile Number *</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editForm.playerPhone}
                  onChange={(e) => setEditForm({ ...editForm, playerPhone: e.target.value })}
                  style={styles.input}
                />
                {editErrors.playerPhone && <span style={styles.errText}>{editErrors.playerPhone}</span>}
              </div>

              <div>
                <label style={styles.inputLabel}>Date of Birth *</label>
                <input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                  style={styles.input}
                />
                {editErrors.dateOfBirth && <span style={styles.errText}>{editErrors.dateOfBirth}</span>}
              </div>

              <div>
                <label style={styles.inputLabel}>Blood Group *</label>
                <select
                  value={editForm.bloodGroup}
                  onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                  style={styles.selectFull}
                >
                  <option value="">Select Blood Group</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
                {editErrors.bloodGroup && <span style={styles.errText}>{editErrors.bloodGroup}</span>}
              </div>

              <div>
                <label style={styles.inputLabel}>Father&apos;s Name *</label>
                <input
                  type="text"
                  value={editForm.fatherName}
                  onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                  style={styles.input}
                />
                {editErrors.fatherName && <span style={styles.errText}>{editErrors.fatherName}</span>}
              </div>

              <div>
                <label style={styles.inputLabel}>Mother&apos;s Name *</label>
                <input
                  type="text"
                  value={editForm.motherName}
                  onChange={(e) => setEditForm({ ...editForm, motherName: e.target.value })}
                  style={styles.input}
                />
                {editErrors.motherName && <span style={styles.errText}>{editErrors.motherName}</span>}
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.inputLabel}>Standard / Profession *</label>
                <AdminSearchableSelect
                  value={editForm.profession}
                  options={PROFESSIONS}
                  onChange={(val) => {
                    setEditForm((prev) => ({
                      ...prev,
                      profession: val,
                      professionOther: val === "Other" ? prev.professionOther : "",
                    }));
                  }}
                />
                {editErrors.profession && <span style={styles.errText}>{editErrors.profession}</span>}
              </div>

              {editForm.profession === "Other" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.inputLabel}>Please Specify Custom Standard/Profession *</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={editForm.professionOther}
                    onChange={(e) => setEditForm({ ...editForm, professionOther: e.target.value })}
                    style={styles.input}
                  />
                  {editErrors.professionOther && <span style={styles.errText}>{editErrors.professionOther}</span>}
                </div>
              )}

              <div>
                <label style={styles.inputLabel}>Player Role *</label>
                <select
                  value={editForm.playerType}
                  onChange={(e) => setEditForm({ ...editForm, playerType: e.target.value })}
                  style={styles.selectFull}
                >
                  <option value="">Select Role</option>
                  {PLAYER_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {editErrors.playerType && <span style={styles.errText}>{editErrors.playerType}</span>}
              </div>

              <div>
                <label style={styles.inputLabel}>Tournament Pool</label>
                <select
                  value={editForm.playerPool}
                  onChange={(e) => setEditForm({ ...editForm, playerPool: e.target.value })}
                  style={styles.selectFull}
                >
                  {PLAYER_POOLS.map((pl) => (
                    <option key={pl} value={pl}>Pool {pl}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.inputLabel}>T-Shirt Size *</label>
                <select
                  value={editForm.tShirtSize}
                  onChange={(e) => setEditForm({ ...editForm, tShirtSize: e.target.value })}
                  style={styles.selectFull}
                >
                  <option value="">Select Size</option>
                  {TSHIRT_SIZES.map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
                {editErrors.tShirtSize && <span style={styles.errText}>{editErrors.tShirtSize}</span>}
              </div>

              <div>
                <label style={styles.inputLabel}>T-Shirt Number (0-9999) *</label>
                <input
                  type="number"
                  min={TSHIRT_NUMBER_MIN}
                  max={TSHIRT_NUMBER_MAX}
                  value={editForm.tShirtNumber}
                  onChange={(e) => setEditForm({ ...editForm, tShirtNumber: e.target.value })}
                  style={styles.input}
                />
                {editErrors.tShirtNumber && <span style={styles.errText}>{editErrors.tShirtNumber}</span>}
              </div>

              <div>
                <label style={styles.inputLabel}>T-Shirt Name (Max 20 chars) *</label>
                <input
                  type="text"
                  maxLength={TSHIRT_NAME_MAX_LENGTH}
                  value={editForm.tShirtName}
                  onChange={(e) => setEditForm({ ...editForm, tShirtName: e.target.value.toUpperCase().slice(0, 20) })}
                  style={styles.input}
                />
                {editErrors.tShirtName && <span style={styles.errText}>{editErrors.tShirtName}</span>}
              </div>

              <div>
                <label style={styles.inputLabel}>Practice Availability (0-23 Days) *</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={editForm.practice}
                  onChange={(e) => setEditForm({ ...editForm, practice: e.target.value })}
                  style={styles.input}
                />
                {editErrors.practice && <span style={styles.errText}>{editErrors.practice}</span>}
              </div>

              <div>
                <label style={styles.inputLabel}>Payment Method</label>
                <select
                  value={editForm.paymentMethod}
                  onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                  style={styles.selectFull}
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>

              {/* Playing Styles */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.inputLabel}>Playing Style (Select 1-2) *</label>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {PLAYING_STYLES.map((st) => {
                    const sel = editForm.playingStyle.includes(st);
                    return (
                      <label key={st} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => handleStyleToggle(st)}
                        />
                        <span>{st}</span>
                      </label>
                    );
                  })}
                </div>
                {editErrors.playingStyle && <span style={styles.errText}>{editErrors.playingStyle}</span>}
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
              <button
                type="button"
                onClick={onClose}
                style={{ ...styles.quickBtn, background: "#F1F5F9", color: "#475569", padding: "9px 18px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ ...styles.saveBtn, marginLeft: 0, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving Changes..." : "Save Player Updates"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  /* ─── Player Detail Modal (Exact Reference UI) ───────────── */
  const PlayerModal = ({ player, onClose }) => {
    const [localStatus, setLocalStatus] = useState(player.status || "pending");
    const [savingStatus, setSavingStatus] = useState(false);
    const [playerPool, setPlayerPool] = useState(player.playerPool !== undefined ? player.playerPool : 0);
    const [savingPool, setSavingPool] = useState(false);

    const computedAge = calculateAge(player.dateOfBirth, player.Age);

    const updatePool = async () => {
      setSavingPool(true);
      try {
        const r = await fetch(`/api/players/${player._id}/pool`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerPool }),
        });
        const data = await r.json();
        if (data.success) {
          showToast("Player pool updated successfully");
          setPlayers((prev) =>
            prev.map((p) => (p._id === player._id ? { ...p, playerPool } : p)),
          );
          setSelected((prev) => ({ ...prev, playerPool }));
        } else {
          showToast(data.message || "Failed to update pool", "error");
        }
      } catch {
        showToast("Failed to update pool", "error");
      } finally {
        setSavingPool(false);
      }
    };

    const confirmStatusUpdate = async () => {
      setSavingStatus(true);
      try {
        const r = await fetch(`/api/players/${player._id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: localStatus }),
        });
        const data = await r.json();
        if (data.success) {
          showToast(`Status confirmed as "${localStatus}"`);
          fetchPlayers();
          if (data.data?.player) {
            setSelected(data.data.player);
          }
        } else {
          showToast(data.message || "Status update failed", "error");
        }
      } catch {
        showToast("Network error updating status", "error");
      } finally {
        setSavingStatus(false);
      }
    };

    return (
      <div
        style={styles.overlay}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div style={styles.modal}>
          {/* Header */}
          <div style={styles.modalHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar
                src={player.playerPhoto?.url}
                name={player.playerName}
                size={52}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#0F172A" }}>
                  {player.playerName}
                </div>
                <div style={{ fontSize: 13, color: "#64748B", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span>Player ID: #{player.playerID ?? "—"}</span>
                  <span>·</span>
                  <span>{player.playerType}</span>
                  <span>·</span>
                  <Badge status={player.status} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setEditingPlayer(player)}
                style={styles.editModalBtn}
              >
                ✏️ Edit Player
              </button>
              <button
                onClick={() => deletePlayer(player._id, player.playerName)}
                style={styles.deleteModalBtn}
              >
                🗑️ Delete
              </button>
              <button onClick={onClose} style={styles.closeBtn}>
                ✕
              </button>
            </div>
          </div>

          <div style={styles.modalBody}>
            <div style={styles.twoCol}>
              {/* Left Column: Player Information */}
              <div>
                {/* 1. Personal Information */}
                <Section title="PERSONAL INFORMATION">
                  <div style={styles.grid2Col}>
                    <ModalField label="FULL NAME" value={player.playerName} />
                    <ModalField label="MOBILE NUMBER" value={player.playerPhone} />
                    <ModalField label="DATE OF BIRTH" value={formatDate(player.dateOfBirth)} />
                    <ModalField label="CALCULATED AGE" value={computedAge !== null ? `${computedAge} years` : "Not Available"} />
                    <ModalField label="FATHER'S NAME" value={player.fatherName} />
                    <ModalField label="MOTHER'S NAME" value={player.motherName} />
                    <ModalField
                      label="STANDARD"
                      value={
                        player.profession === "Other" && player.professionOther
                          ? player.professionOther
                          : player.profession || "Not Available"
                      }
                    />
                  </div>
                </Section>

                {/* 2. Playing Information */}
                <Section title="PLAYING INFORMATION">
                  <div style={styles.grid2Col}>
                    <ModalField label="PLAYER ID" value={`#${player.playerID ?? "—"}`} />
                    <ModalField label="PLAYER ROLE" value={player.playerType} />
                    <ModalField
                      label="PLAYING STYLE"
                      value={
                        Array.isArray(player.playingStyle)
                          ? player.playingStyle.join(", ")
                          : player.playingStyle || "—"
                      }
                    />
                    <ModalField label="PLAYER CATEGORY" value={player.playerCategory || "Undefined"} />
                    <ModalField label="PLAYER POOL" value={`Pool ${player.playerPool ?? 0}`} />
                  </div>
                </Section>

                {/* 3. Merchandise Information */}
                <Section title="MERCHANDISE INFORMATION">
                  <div style={styles.grid2Col}>
                    <ModalField label="T-SHIRT SIZE" value={player.tShirtSize} />
                    <ModalField label="T-SHIRT NUMBER" value={player.tShirtNumber} />
                    <ModalField label="T-SHIRT NAME" value={player.tShirtName} highlightGreen />
                  </div>
                </Section>

                {/* 4. Payment & Practice */}
                <Section title="PAYMENT & PRACTICE">
                  <div style={styles.grid2Col}>
                    <ModalField label="PAYMENT METHOD" value={player.paymentMethod || "Online"} />
                    <ModalField label="TRANSACTION / RECEIPT ID" value={player.transactionId} mono />
                    <ModalField
                      label="DAYS AVAILABLE FOR PRACTICE"
                      value={player.practice !== undefined && player.practice !== null ? `${player.practice} days` : "Not Available"}
                      highlightGreen
                    />
                    <ModalField label="REGISTERED ON" value={formatDateTime(player.createdAt)} />
                  </div>
                </Section>
              </div>

              {/* Right Column: Media, Pool, and Status Control */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Player Photo */}
                <div>
                  <div style={styles.imgLabel}>PLAYER PHOTO</div>
                  {player.playerPhoto?.url ? (
                    <div
                      style={{ cursor: "zoom-in", position: "relative" }}
                      onClick={() => setLightboxImg(player.playerPhoto.url)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={player.playerPhoto.url}
                        alt="Player Portrait"
                        style={{
                          width: "100%",
                          height: 220,
                          objectFit: "cover",
                          borderRadius: 10,
                          border: "1px solid #E2E8F0",
                        }}
                      />
                      <span style={styles.zoomHint}>🔍 Click to enlarge</span>
                    </div>
                  ) : (
                    <div style={styles.imgPlaceholder}>No photo available</div>
                  )}
                </div>

                {/* Payment Screenshot Card */}
                <div>
                  <div style={styles.imgLabel}>PAYMENT RECEIPT / SCREENSHOT</div>
                  {player.paymentScreenshot?.url ? (
                    <div
                      style={{ cursor: "zoom-in", position: "relative" }}
                      onClick={() => setLightboxImg(player.paymentScreenshot.url)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={player.paymentScreenshot.url}
                        alt="Payment Proof"
                        style={{
                          width: "100%",
                          height: 180,
                          objectFit: "contain",
                          borderRadius: 10,
                          border: "1px solid #E2E8F0",
                          background: "#F8FAFC",
                        }}
                      />
                      <span style={styles.zoomHint}>🔍 Click to enlarge</span>
                    </div>
                  ) : (
                    <div style={styles.imgPlaceholder}>No receipt uploaded</div>
                  )}
                </div>

                {/* Assign Player Pool Card */}
                <div style={styles.sideCard}>
                  <div style={styles.sideCardTitle}>
                    <span>🎽</span>
                    <span>Assign Player Pool</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <select
                      value={playerPool}
                      onChange={(e) => setPlayerPool(Number(e.target.value))}
                      style={{ ...styles.select, flex: 1, padding: "7px 12px" }}
                    >
                      {PLAYER_POOLS.map((pool) => (
                        <option key={pool} value={pool}>
                          Pool {pool}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={updatePool}
                      disabled={savingPool}
                      style={styles.savePoolBtn}
                    >
                      {savingPool ? "Saving…" : "Save Pool"}
                    </button>
                  </div>
                </div>

                {/* Update Registration Status Card */}
                <div style={styles.sideCard}>
                  <div style={styles.sideCardTitle}>
                    <span>⚡</span>
                    <span>Update Registration Status</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
                    {STATUS_OPTIONS.map((st) => {
                      const isSel = localStatus === st;
                      const col = STATUS_COLORS[st];
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setLocalStatus(st)}
                          style={{
                            padding: "6px 4px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            textTransform: "uppercase",
                            background: isSel ? col.bg : "#F8FAFC",
                            color: isSel ? col.text : "#64748B",
                            border: `1.5px solid ${isSel ? col.border : "#E2E8F0"}`,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={confirmStatusUpdate}
                    disabled={savingStatus}
                    style={styles.confirmStatusBtn}
                  >
                    {savingStatus ? "Updating…" : "Confirm Status"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ─── Render View ────────────────────────────────────────── */
  return (
    <div style={styles.page}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            background: toast.type === "error" ? "#EF4444" : "#10B981",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          style={styles.lightboxOverlay}
          onClick={() => setLightboxImg(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImg}
            alt="Enlarged preview"
            style={styles.lightboxImage}
          />
          <button
            onClick={() => setLightboxImg(null)}
            style={styles.lightboxClose}
          >
            ✕
          </button>
        </div>
      )}

      {/* Player Details Modal */}
      {selectedPlayer && (
        <PlayerModal
          player={selectedPlayer}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Player Edit Modal */}
      {editingPlayer && (
        <PlayerEditModal
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSaveSuccess={(updated) => {
            setPlayers((prev) =>
              prev.map((p) => (p._id === updated._id ? updated : p)),
            );
            if (selectedPlayer?._id === updated._id) setSelected(updated);
            fetchPlayers();
          }}
        />
      )}

      {/* Header Bar */}
      <div style={styles.pageHeader}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 24 }}>🏏</span>
            <h1 style={styles.pageTitle}>MPL Kids 2026 Admin Dashboard</h1>
          </div>
          <p style={styles.pageSubtitle}>
            Complete Player Management, Verification, Status &amp; Merchandise
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => fetchPlayers()}
            style={styles.refreshBtn}
            title="Refresh database records"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
          <ExportBtn
            label="Export Excel"
            onClick={exportExcel}
            loading={exporting === "excel"}
            icon="📊"
            color="#059669"
          />
          <button
            onClick={() => {
              if (window.confirm("Logout from admin portal?")) {
                window.location.href = "/";
              }
            }}
            style={styles.logoutBtn}
          >
            <span>🔒</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* 8 Summary Stat Cards (Exact match to reference screenshot) */}
      <div style={styles.statsContainer}>
        {/* Row 1: 6 cards */}
        <div style={styles.statsRow6}>
          {/* Total Registered */}
          <div
            style={styles.statCard}
            onClick={() => { setFStatus(""); setPage(1); }}
          >
            <div style={styles.statIconWrap}>📋</div>
            <div>
              <div style={styles.statNumber}>{stats.total}</div>
              <div style={styles.statLabel}>Total Registered</div>
            </div>
          </div>

          {/* Pending Review */}
          <div
            style={styles.statCard}
            onClick={() => { setFStatus("pending"); setPage(1); }}
          >
            <div style={styles.statIconWrap}>🏆</div>
            <div>
              <div style={styles.statNumber}>{stats.pending}</div>
              <div style={styles.statLabel}>Pending Review</div>
            </div>
          </div>

          {/* Approved Players */}
          <div
            style={styles.statCard}
            onClick={() => { setFStatus("approved"); setPage(1); }}
          >
            <div style={{ ...styles.statIconWrap, color: "#10B981" }}>✅</div>
            <div>
              <div style={{ ...styles.statNumber, color: "#10B981" }}>{stats.approved}</div>
              <div style={styles.statLabel}>Approved Players</div>
            </div>
          </div>

          {/* Rejected */}
          <div
            style={styles.statCard}
            onClick={() => { setFStatus("rejected"); setPage(1); }}
          >
            <div style={{ ...styles.statIconWrap, color: "#EF4444" }}>❌</div>
            <div>
              <div style={{ ...styles.statNumber, color: "#EF4444" }}>{stats.rejected}</div>
              <div style={styles.statLabel}>Rejected</div>
            </div>
          </div>

          {/* Batsmen */}
          <div
            style={styles.statCard}
            onClick={() => { setFType("Batsman"); setPage(1); }}
          >
            <div style={styles.statIconWrap}>🏏</div>
            <div>
              <div style={styles.statNumber}>{stats.batsmen || 0}</div>
              <div style={styles.statLabel}>Batsmen</div>
            </div>
          </div>

          {/* Bowlers */}
          <div
            style={styles.statCard}
            onClick={() => { setFType("Bowler"); setPage(1); }}
          >
            <div style={styles.statIconWrap}>⚡</div>
            <div>
              <div style={styles.statNumber}>{stats.bowlers || 0}</div>
              <div style={styles.statLabel}>Bowlers</div>
            </div>
          </div>
        </div>

        {/* Row 2: 2 cards */}
        <div style={styles.statsRow2}>
          {/* All Rounders */}
          <div
            style={styles.statCard}
            onClick={() => { setFType("All Rounder"); setPage(1); }}
          >
            <div style={styles.statIconWrap}>⭐</div>
            <div>
              <div style={styles.statNumber}>{stats.allRounders || 0}</div>
              <div style={styles.statLabel}>All Rounders</div>
            </div>
          </div>

          {/* Paid Online / Cash */}
          <div
            style={styles.statCard}
            onClick={() => { setFPayment(""); setPage(1); }}
          >
            <div style={styles.statIconWrap}>💳</div>
            <div>
              <div style={styles.statNumber}>{stats.online || 0} / {stats.cash || 0}</div>
              <div style={styles.statLabel}>Paid Online / Cash</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Container */}
      <div style={styles.filterBarContainer}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <input
            placeholder="Search by name, phone, txn ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={styles.clearSearchBtn}
            >
              ✕
            </button>
          )}
        </div>

        {/* All Statuses */}
        <select
          value={filterStatus}
          onChange={(e) => { setFStatus(e.target.value); setPage(1); }}
          style={styles.filterSelect}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        {/* All Roles */}
        <select
          value={filterType}
          onChange={(e) => { setFType(e.target.value); setPage(1); }}
          style={styles.filterSelect}
        >
          <option value="">All Roles</option>
          {PLAYER_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* All Standards */}
        <select
          value={filterProfession}
          onChange={(e) => { setFProfession(e.target.value); setPage(1); }}
          style={{ ...styles.filterSelect, maxWidth: 170 }}
        >
          <option value="">All Standards</option>
          {PROFESSIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* All Pools */}
        <select
          value={filterPool}
          onChange={(e) => { setFPool(e.target.value); setPage(1); }}
          style={styles.filterSelect}
        >
          <option value="">All Pools</option>
          {PLAYER_POOLS.map((pool) => (
            <option key={pool} value={pool}>Pool {pool}</option>
          ))}
        </select>

        {/* All Payments */}
        <select
          value={filterPayment}
          onChange={(e) => { setFPayment(e.target.value); setPage(1); }}
          style={styles.filterSelect}
        >
          <option value="">All Payments</option>
          {PAYMENT_METHODS.map((pm) => (
            <option key={pm} value={pm}>{pm}</option>
          ))}
        </select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button onClick={clearAllFilters} style={styles.clearFiltersBtn}>
            Clear ✕
          </button>
        )}
      </div>

      {/* Players Management Table */}
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <span style={{ color: "#64748B", marginLeft: 12 }}>Loading players…</span>
          </div>
        ) : players.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 40 }}>🏏</div>
            <div style={{ color: "#0F172A", marginTop: 8, fontWeight: 700, fontSize: 16 }}>
              No registered players match the criteria
            </div>
            {hasActiveFilters && (
              <button onClick={clearAllFilters} style={{ ...styles.clearFiltersBtn, marginTop: 12 }}>
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 50 }} onClick={() => handleSort("playerID")}>
                  ID {sortField === "playerID" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th style={{ ...styles.th, minWidth: 180 }} onClick={() => handleSort("playerName")}>
                  PLAYER {sortField === "playerName" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th style={styles.th}>MOBILE</th>
                <th style={styles.th} onClick={() => handleSort("dateOfBirth")}>
                  DOB / AGE {sortField === "dateOfBirth" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th style={styles.th}>PARENTS</th>
                <th style={styles.th}>STANDARD</th>
                <th style={styles.th} onClick={() => handleSort("playerType")}>
                  ROLE {sortField === "playerType" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th style={styles.th}>STYLE</th>
                <th style={styles.th}>PRACTICE</th>
                <th style={styles.th}>PAYMENT</th>
                <th style={styles.th} onClick={() => handleSort("status")}>
                  STATUS {sortField === "status" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th style={styles.th} onClick={() => handleSort("createdAt")}>
                  REGISTERED {sortField === "createdAt" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th style={{ ...styles.th, textAlign: "center" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const age = calculateAge(p.dateOfBirth, p.Age);
                return (
                  <tr
                    key={p._id}
                    style={styles.tr}
                    onClick={() => setSelected(p)}
                  >
                    {/* ID */}
                    <td style={styles.td}>
                      <span style={styles.idNum}>#{p.playerID ?? "—"}</span>
                    </td>

                    {/* PLAYER */}
                    <td style={styles.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar
                          src={p.playerPhoto?.url}
                          name={p.playerName}
                          size={36}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 13 }}>
                            {p.playerName}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>
                            Jersey #{p.tShirtNumber ?? "—"} ({p.tShirtName || "—"})
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* MOBILE */}
                    <td style={{ ...styles.td, fontSize: 12, color: "#334155" }}>
                      {p.playerPhone}
                    </td>

                    {/* DOB / AGE */}
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 12 }}>
                        {formatDate(p.dateOfBirth)}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        {age !== null ? `${age} yrs` : "—"}
                      </div>
                    </td>

                    {/* PARENTS */}
                    <td style={{ ...styles.td, fontSize: 11 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#334155", fontWeight: 600 }}>
                        <span style={{ fontSize: 9, color: "#D97706" }}>●</span>
                        <span>{p.fatherName || "—"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#64748B" }}>
                        <span style={{ fontSize: 9, color: "#EA580C" }}>●</span>
                        <span>{p.motherName || "—"}</span>
                      </div>
                    </td>

                    {/* STANDARD */}
                    <td style={styles.td}>
                      <span style={styles.stdBadge}>
                        {p.profession === "Other" && p.professionOther
                          ? p.professionOther
                          : p.profession ? (p.profession.startsWith("Standard") ? `Std ${p.profession.replace("Standard", "").trim()}` : p.profession) : "—"}
                      </span>
                    </td>

                    {/* ROLE */}
                    <td style={styles.td}>
                      <span style={styles.roleBadge}>{p.playerType}</span>
                    </td>

                    {/* STYLE */}
                    <td style={{ ...styles.td, fontSize: 11, maxWidth: 130 }}>
                      <div
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={(p.playingStyle || []).join(", ")}
                      >
                        {(p.playingStyle || []).join(", ") || "—"}
                      </div>
                    </td>

                    {/* PRACTICE */}
                    <td style={{ ...styles.td, fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
                      {p.practice !== undefined && p.practice !== null ? `${p.practice}d` : "—"}
                    </td>

                    {/* PAYMENT */}
                    <td style={styles.td}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#2563EB" }}>
                        {p.paymentMethod || "Online"}
                      </div>
                      <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace" }}>
                        {p.transactionId || "—"}
                      </div>
                    </td>

                    {/* STATUS */}
                    <td style={styles.td}>
                      <Badge status={p.status} />
                    </td>

                    {/* REGISTERED */}
                    <td style={{ ...styles.td, fontSize: 11, color: "#64748B", whiteSpace: "nowrap" }}>
                      {formatShortDate(p.createdAt)}
                    </td>

                    {/* ACTIONS */}
                    <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "center" }}>
                        {/* Edit */}
                        <button
                          onClick={() => setEditingPlayer(p)}
                          title="Edit Player"
                          style={{ ...styles.actionBtn, background: "#FFF7ED", color: "#EA580C", border: "1px solid #FFEDD5" }}
                        >
                          ✏️
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => deletePlayer(p._id, p.playerName)}
                          title="Delete Player"
                          style={{ ...styles.actionBtn, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FEE2E2" }}
                        >
                          🗑️
                        </button>
                        {/* Approve */}
                        <button
                          onClick={() => updateStatus(p._id, "approved")}
                          title="Mark Approved"
                          disabled={p.status === "approved"}
                          style={{
                            ...styles.actionBtn,
                            background: p.status === "approved" ? "#F1F5F9" : "#ECFDF5",
                            color: p.status === "approved" ? "#94A3B8" : "#059669",
                            border: "1px solid #A7F3D0",
                            cursor: p.status === "approved" ? "default" : "pointer",
                          }}
                        >
                          ✓
                        </button>
                        {/* Reject */}
                        <button
                          onClick={() => updateStatus(p._id, "rejected")}
                          title="Mark Rejected"
                          disabled={p.status === "rejected"}
                          style={{
                            ...styles.actionBtn,
                            background: p.status === "rejected" ? "#F1F5F9" : "#FEF2F2",
                            color: p.status === "rejected" ? "#94A3B8" : "#DC2626",
                            border: "1px solid #FECACA",
                            cursor: p.status === "rejected" ? "default" : "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Bar */}
      <div style={styles.paginationBar}>
        <span style={{ color: "#64748B", fontSize: 13 }}>
          {pagination.total > 0
            ? `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, pagination.total)} of ${pagination.total} registered players`
            : "Showing 0 players"}
        </span>
        {pagination.totalPages > 1 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              style={{ ...styles.pageBtn, opacity: page === 1 ? 0.4 : 1 }}
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev}
              style={{ ...styles.pageBtn, opacity: !pagination.hasPrev ? 0.4 : 1 }}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    ...styles.pageBtn,
                    background: p === page ? "#1E3A8A" : "#fff",
                    color: p === page ? "#fff" : "#334155",
                    fontWeight: p === page ? 700 : 500,
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={!pagination.hasNext}
              style={{ ...styles.pageBtn, opacity: !pagination.hasNext ? 0.4 : 1 }}
            >
              ›
            </button>
            <button
              onClick={() => setPage(pagination.totalPages)}
              disabled={page === pagination.totalPages}
              style={{ ...styles.pageBtn, opacity: page === pagination.totalPages ? 0.4 : 1 }}
            >
              »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Modal Helpers ─────────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "#475569",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 10,
          borderBottom: "1px solid #E2E8F0",
          paddingBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ModalField({ label, value, mono, highlightGreen }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: highlightGreen ? "#16A34A" : "#0F172A",
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function ExportBtn({ label, onClick, loading, icon, color }) {
  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        borderRadius: 8,
        border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        background: color,
        color: "#fff",
        fontWeight: 700,
        fontSize: 13,
        opacity: loading ? 0.7 : 1,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <span>{icon}</span>
      <span>{loading ? "Exporting…" : label}</span>
    </button>
  );
}

/* ─── Clean Professional Styling Matching Screenshot ────────── */
const styles = {
  page: {
    background: "#F8FAFC",
    minHeight: "100vh",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    padding: "24px 32px",
    color: "#0F172A",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  pageTitle: { fontSize: 24, fontWeight: 800, color: "#0F172A", margin: 0 },
  pageSubtitle: { fontSize: 13, color: "#64748B", margin: "4px 0 0" },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #CBD5E1",
    background: "#fff",
    color: "#334155",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    background: "#fff",
    color: "#475569",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  statsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 20,
  },
  statsRow6: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 12,
  },
  statsRow2: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1.2fr",
    gap: 12,
  },
  statCard: {
    background: "#fff",
    borderRadius: 10,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid #E2E8F0",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: "#F8FAFC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
    border: "1px solid #F1F5F9",
  },
  statNumber: { fontSize: 20, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 },
  statLabel: { fontSize: 11, color: "#64748B", fontWeight: 500, marginTop: 2 },
  filterBarContainer: {
    background: "#fff",
    borderRadius: 10,
    padding: "12px 16px",
    border: "1px solid #E2E8F0",
    display: "flex",
    gap: 10,
    marginBottom: 16,
    alignItems: "center",
    flexWrap: "wrap",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  searchInput: {
    width: "100%",
    padding: "8px 30px 8px 12px",
    borderRadius: 7,
    border: "1px solid #CBD5E1",
    fontSize: 13,
    outline: "none",
    color: "#0F172A",
    boxSizing: "border-box",
  },
  clearSearchBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    color: "#94A3B8",
    cursor: "pointer",
    fontSize: 13,
  },
  filterSelect: {
    padding: "8px 12px",
    borderRadius: 7,
    border: "1px solid #CBD5E1",
    fontSize: 13,
    background: "#fff",
    color: "#334155",
    cursor: "pointer",
    outline: "none",
  },
  clearFiltersBtn: {
    padding: "8px 14px",
    borderRadius: 7,
    border: "1px solid #FECACA",
    background: "#FEF2F2",
    color: "#DC2626",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
  },
  tableWrap: {
    background: "#fff",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    overflow: "auto",
    marginBottom: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    padding: "11px 14px",
    background: "#FAFAFA",
    color: "#64748B",
    fontWeight: 700,
    textAlign: "left",
    fontSize: 11,
    letterSpacing: "0.04em",
    borderBottom: "1px solid #E2E8F0",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
  },
  tr: {
    cursor: "pointer",
    transition: "background 0.12s",
    borderBottom: "1px solid #F1F5F9",
  },
  td: {
    padding: "10px 14px",
    color: "#334155",
    verticalAlign: "middle",
  },
  idNum: {
    color: "#2563EB",
    fontWeight: 700,
    fontSize: 12,
    fontFamily: "monospace",
  },
  stdBadge: {
    background: "#EFF6FF",
    color: "#1E40AF",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
  },
  roleBadge: {
    background: "#F1F5F9",
    color: "#475569",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 600,
  },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontWeight: 700,
    padding: 0,
  },
  paginationBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 4px",
    flexWrap: "wrap",
    gap: 12,
  },
  pageBtn: {
    minWidth: 32,
    height: 32,
    padding: "0 8px",
    borderRadius: 6,
    border: "1px solid #CBD5E1",
    fontSize: 13,
    cursor: "pointer",
  },
  loadingWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
  },
  spinner: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    border: "2.5px solid #E2E8F0",
    borderTopColor: "#2563EB",
    animation: "spin 0.8s linear infinite",
  },
  emptyState: { textAlign: "center", padding: "50px 20px" },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 780,
    maxHeight: "92vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    padding: "16px 22px",
    borderBottom: "1px solid #E2E8F0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  editModalBtn: {
    background: "#EFF6FF",
    border: "1px solid #BFDBFE",
    color: "#1E40AF",
    borderRadius: 7,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteModalBtn: {
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    color: "#DC2626",
    borderRadius: 7,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  closeBtn: {
    background: "#F1F5F9",
    border: "none",
    borderRadius: 7,
    width: 30,
    height: 30,
    cursor: "pointer",
    fontSize: 13,
    color: "#64748B",
    fontWeight: 700,
  },
  modalBody: { padding: 22, overflowY: "auto" },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 20,
  },
  grid2Col: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px 14px",
  },
  imgLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  },
  imgPlaceholder: {
    height: 100,
    background: "#F8FAFC",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94A3B8",
    border: "1px dashed #CBD5E1",
    fontSize: 12,
  },
  zoomHint: {
    position: "absolute",
    bottom: 6,
    right: 6,
    background: "rgba(0,0,0,0.75)",
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  sideCard: {
    background: "#fff",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: 12,
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  sideCardTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  savePoolBtn: {
    background: "#1E3A8A",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  confirmStatusBtn: {
    width: "100%",
    marginTop: 10,
    background: "#10B981",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(16,185,129,0.3)",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 7,
    border: "1px solid #CBD5E1",
    fontSize: 13,
    outline: "none",
    color: "#0F172A",
    boxSizing: "border-box",
  },
  selectFull: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 7,
    border: "1px solid #CBD5E1",
    fontSize: 13,
    background: "#fff",
    color: "#0F172A",
    outline: "none",
  },
  inputLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 4,
  },
  errText: { display: "block", fontSize: 11, color: "#EF4444", marginTop: 3 },
  saveBtn: {
    background: "#1E3A8A",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    padding: "9px 18px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  quickBtn: {
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 700,
    border: "none",
  },
  toast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    color: "#fff",
    padding: "10px 18px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    zIndex: 9999,
    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
  },
  lightboxOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.9)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backdropFilter: "blur(6px)",
  },
  lightboxImage: {
    maxWidth: "90vw",
    maxHeight: "90vh",
    objectFit: "contain",
    borderRadius: 8,
  },
  lightboxClose: {
    position: "absolute",
    top: 24,
    right: 24,
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    border: "none",
    borderRadius: "50%",
    width: 40,
    height: 40,
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
