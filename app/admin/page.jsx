"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  BLOOD_GROUPS,
  PROFESSIONS,
  PLAYER_ROLES,
  PLAYING_STYLES,
  CLOTHING_SIZES,
  PREVIOUS_TEAMS,
  TSHIRT_NUMBER_MIN,
  TSHIRT_NUMBER_MAX,
  TSHIRT_NAME_MAX_LENGTH,
} from "../../constants/playerOptions";
import { calculateAge } from "../../utils/apiHelpers";

/* ─── styling constants ─────────────────────────────────────── */
const STATUS_COLORS = {
  pending: { bg: "#FFF8E1", text: "#D97706", border: "#FDE68A" },
  approved: { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
  rejected: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
};

const STATUS_OPTIONS = ["pending", "approved", "rejected"];

function Badge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        borderRadius: 20,
        padding: "3px 12px",
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

function Avatar({ src, name, size = 40 }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #1E3A8A, #3B82F6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: size * 0.35,
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
        border: "2px solid #E2E8F0",
      }}
    />
  );
}

// Format date helper with fallback
function formatDate(d) {
  if (!d) return "Not Available";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "Not Available";
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Parse previous performance string format: "2025 :- M:5, R:120, W:3, F:2 | 2024 :- M:4, R:80, W:1, F:1"
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

// Format previous performance array to summary string
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
function AdminSearchableSelect({ value, onChange, options, placeholder = "Select profession" }) {
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
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [selectedPlayer, setSelected] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [toast, setToast] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  /* filters */
  const [search, setSearch] = useState("");
  const [filterStatus, setFStatus] = useState("");
  const [filterType, setFType] = useState("");
  const [filterPool, setFPool] = useState("");
  const [filterProfession, setFProfession] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  /* stats */
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const debounceRef = useRef(null);

  /* ── fetch ── */
  const fetchPlayers = useCallback(
    async (overrides = {}) => {
      setLoading(true);
      const targetPage = overrides.page ?? page;
      const targetSearch = overrides.search !== undefined ? overrides.search : search;
      const targetStatus = overrides.filterStatus !== undefined ? overrides.filterStatus : filterStatus;
      const targetType = overrides.filterType !== undefined ? overrides.filterType : filterType;
      const targetPool = overrides.filterPool !== undefined ? overrides.filterPool : filterPool;
      const targetProf = overrides.filterProfession !== undefined ? overrides.filterProfession : filterProfession;

      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: limit.toString(),
        ...(targetSearch && { search: targetSearch }),
        ...(targetStatus && { status: targetStatus }),
        ...(targetType && { playerType: targetType }),
        ...(targetPool && { playerPool: targetPool }),
        ...(targetProf && { profession: targetProf }),
      });

      try {
        const r = await fetch(`/api/players?${params.toString()}`);
        const data = await r.json();
        if (data.success) {
          setPlayers(data.data.players);
          setPagination(data.data.pagination);

          // Update summary stats from non-filtered total when on initial view
          if (!targetStatus && !targetType && !targetPool && !targetProf && !targetSearch && targetPage === 1) {
            const allR = await fetch(`/api/players?limit=10000`);
            const allD = await allR.json();
            if (allD.success) {
              const all = allD.data.players;
              setStats({
                total: all.length,
                pending: all.filter((p) => p.status === "pending").length,
                approved: all.filter((p) => p.status === "approved").length,
                rejected: all.filter((p) => p.status === "rejected").length,
              });
            }
          }
        } else {
          showToast(data.message || "Failed to fetch players", "error");
        }
      } catch {
        showToast("Network error while fetching players", "error");
      } finally {
        setLoading(false);
      }
    },
    [page, limit, search, filterStatus, filterType, filterPool, filterProfession],
  );

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPlayers({ page: 1, search });
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search, fetchPlayers]);

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
        setPlayers((prev) =>
          prev.map((p) =>
            p._id === playerId ? { ...p, status: newStatus } : p,
          ),
        );
        if (selectedPlayer?._id === playerId) {
          setSelected((prev) => ({ ...prev, status: newStatus }));
        }
        showToast(`Status updated to "${newStatus}"`);
      } else {
        showToast(data.message || "Status update failed", "error");
      }
    } catch {
      showToast("Network error updating status", "error");
    }
  };

  /* ── fetch ALL for export (no pagination) ── */
  const fetchAllForExport = async () => {
    const r = await fetch(`/api/players?limit=10000`);
    const d = await r.json();
    return d.success ? d.data.players : players;
  };

  /* ─── Excel Export (25 Comprehensive Fields) ──────────────── */
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
          Profession: p.profession || "Not Available",
          "Custom Profession": p.professionOther || "Not Available",
          "Previous Team": p.previousTeam || "Not Available",
          "Previous Points":
            p.previousPoints !== undefined && p.previousPoints !== null
              ? p.previousPoints
              : "Not Available",
          "Previous Performance": formatPerformanceSummary(p.previousPerformance),
          "Residential Address":
            Array.isArray(p.playerAddress) && p.playerAddress[0]
              ? `${p.playerAddress[0].AddressLine1 || ""}${
                  p.playerAddress[0].AddressLine2
                    ? ", " + p.playerAddress[0].AddressLine2
                    : ""
                }, ${p.playerAddress[0].City || ""}, ${
                  p.playerAddress[0].State || ""
                } - ${p.playerAddress[0].PinCode || ""}, ${
                  p.playerAddress[0].Country || "India"
                }`
              : "Not Available",
          "Playing Style": Array.isArray(p.playingStyle)
            ? p.playingStyle.join(", ")
            : p.playingStyle || "Not Available",
          "Player Role": p.playerType || "Not Available",
          "Player Category": p.playerCategory || "Not Available",
          "Player Pool": p.playerPool ?? "Not Available",
          "T-Shirt Size": p.tShirtSize || "Not Available",
          "Pant Size": p.pantSize || "Not Available",
          "T-Shirt Number": p.tShirtNumber ?? "Not Available",
          "T-Shirt Name": p.tShirtName || "Not Available",
          "Transaction ID": p.transactionId || "Not Available",
          "Registration Status": p.status || "Not Available",
          "Registration Date": p.createdAt
            ? new Date(p.createdAt).toLocaleString("en-IN")
            : "Not Available",
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      /* Column widths */
      ws["!cols"] = [
        { wch: 10 }, // Player ID
        { wch: 22 }, // Full Name
        { wch: 15 }, // Mobile
        { wch: 15 }, // DOB
        { wch: 14 }, // Age
        { wch: 18 }, // Anniversary
        { wch: 12 }, // Blood Group
        { wch: 20 }, // Father's Name
        { wch: 20 }, // Mother's Name
        { wch: 28 }, // Profession
        { wch: 22 }, // Custom Profession
        { wch: 18 }, // Previous Team
        { wch: 16 }, // Previous Points
        { wch: 45 }, // Previous Performance
        { wch: 35 }, // Residential Address
        { wch: 28 }, // Playing Style
        { wch: 14 }, // Role
        { wch: 14 }, // Category
        { wch: 12 }, // Pool
        { wch: 12 }, // T-Shirt Size
        { wch: 12 }, // Pant Size
        { wch: 14 }, // T-Shirt Number
        { wch: 16 }, // T-Shirt Name
        { wch: 22 }, // Transaction ID
        { wch: 14 }, // Status
        { wch: 22 }, // Registered Date
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "MPL 2026 Players");
      XLSX.writeFile(wb, `MPL_2026_Players_${Date.now()}.xlsx`);
      showToast("Excel exported successfully with all 25 fields!");
    } catch (e) {
      console.error("Export error:", e);
      showToast("Excel export failed", "error");
    } finally {
      setExporting("");
    }
  };

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
      tShirtSize: player.tShirtSize || "",
      pantSize: player.pantSize || "",
      tShirtNumber: player.tShirtNumber !== undefined ? String(player.tShirtNumber) : "",
      tShirtName: player.tShirtName || "",
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
      showToast(`Added ${parsed.length} season record(s) from text!`);
    };

    const cumulativeTotals = editForm.previousPerformance.reduce(
      (acc, s) => ({
        matches: acc.matches + (Number(s.matches) || 0),
        runs: acc.runs + (Number(s.runs) || 0),
        wickets: acc.wickets + (Number(s.wickets) || 0),
        fielding: acc.fielding + (Number(s.fielding) || 0),
        mom: acc.mom + (Number(s.mom) || 0),
      }),
      { matches: 0, runs: 0, wickets: 0, fielding: 0, mom: 0 }
    );

    const handleSave = async (e) => {
      e.preventDefault();
      const errs = {};

      if (!editForm.playerName.trim()) errs.playerName = "Name is required";
      if (!/^[6-9]\d{9}$/.test(editForm.playerPhone.trim())) {
        errs.playerPhone = "10-digit mobile starting with 6-9 required";
      }
      if (!editForm.dateOfBirth) errs.dateOfBirth = "Date of Birth required";
      if (!editForm.bloodGroup) errs.bloodGroup = "Blood Group required";
      if (!editForm.fatherName.trim()) errs.fatherName = "Father's name required";
      if (!editForm.motherName.trim()) errs.motherName = "Mother's name required";
      if (!editForm.profession) errs.profession = "Profession is required";
      if (editForm.profession === "Other" && !editForm.professionOther.trim()) {
        errs.professionOther = "Custom profession required when Other is selected";
      }
      if (!editForm.addressLine1.trim()) errs.addressLine1 = "Address Line 1 is required";
      if (!editForm.city.trim()) errs.city = "City is required";
      if (!editForm.state.trim()) errs.state = "State is required";
      if (!editForm.pinCode.trim()) errs.pinCode = "Pin Code is required";

      if (!editForm.playingStyle || editForm.playingStyle.length === 0) {
        errs.playingStyle = "Select 1 to 2 playing styles";
      }
      if (!editForm.playerType) errs.playerType = "Player role is required";
      if (!editForm.tShirtSize) errs.tShirtSize = "T-shirt size is required";
      if (!editForm.pantSize) errs.pantSize = "Pant size is required";
      if (editForm.previousTeam && !PREVIOUS_TEAMS.includes(editForm.previousTeam)) {
        errs.previousTeam = "Select a valid previous team";
      }

      const prevPointsVal =
        editForm.previousPoints.trim() === ""
          ? null
          : Number(editForm.previousPoints);
      if (editForm.previousPoints.trim() !== "" && isNaN(prevPointsVal)) {
        errs.previousPoints = "Points must be a valid number";
      }

      const num = Number(editForm.tShirtNumber);
      if (editForm.tShirtNumber === "" || !Number.isInteger(num) || num < TSHIRT_NUMBER_MIN || num > TSHIRT_NUMBER_MAX) {
        errs.tShirtNumber = `Number between ${TSHIRT_NUMBER_MIN} and ${TSHIRT_NUMBER_MAX} required`;
      }
      if (!editForm.tShirtName.trim()) errs.tShirtName = "T-shirt name is required";

      if (Object.keys(errs).length > 0) {
        setEditErrors(errs);
        return;
      }

      setSaving(true);
      try {
        const res = await fetch(`/api/players/${player._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
          }),
        });

        const data = await res.json();
        if (data.success) {
          showToast("Player updated successfully!");
          onSaveSuccess(data.data.player);
          onClose();
        } else {
          showToast(data.message || "Failed to update player", "error");
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
        <div style={{ ...styles.modal, maxWidth: 820 }}>
          <div style={styles.modalHeader}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#0F172A" }}>
                ✏️ Edit Player Profile
              </div>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                Player ID: #{player.playerID} &nbsp;·&nbsp; {player.playerName}
              </div>
            </div>
            <button onClick={onClose} style={styles.closeBtn}>
              ✕
            </button>
          </div>

          <form onSubmit={handleSave} style={{ padding: 24, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Full Name */}
              <div>
                <label style={styles.inputLabel}>Full Name *</label>
                <input
                  type="text"
                  value={editForm.playerName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, playerName: e.target.value })
                  }
                  style={styles.input}
                />
                {editErrors.playerName && (
                  <span style={styles.errText}>{editErrors.playerName}</span>
                )}
              </div>

              {/* Mobile */}
              <div>
                <label style={styles.inputLabel}>Mobile Number *</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editForm.playerPhone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, playerPhone: e.target.value })
                  }
                  style={styles.input}
                />
                {editErrors.playerPhone && (
                  <span style={styles.errText}>{editErrors.playerPhone}</span>
                )}
              </div>

              {/* DOB */}
              <div>
                <label style={styles.inputLabel}>Date of Birth *</label>
                <input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={(e) =>
                    setEditForm({ ...editForm, dateOfBirth: e.target.value })
                  }
                  style={styles.input}
                />
                {editErrors.dateOfBirth && (
                  <span style={styles.errText}>{editErrors.dateOfBirth}</span>
                )}
              </div>

              {/* Anniversary */}
              <div>
                <label style={styles.inputLabel}>Marriage Anniversary (Optional)</label>
                <input
                  type="date"
                  value={editForm.anniversary}
                  onChange={(e) =>
                    setEditForm({ ...editForm, anniversary: e.target.value })
                  }
                  style={styles.input}
                />
              </div>

              {/* Blood Group */}
              <div>
                <label style={styles.inputLabel}>Blood Group *</label>
                <select
                  value={editForm.bloodGroup}
                  onChange={(e) =>
                    setEditForm({ ...editForm, bloodGroup: e.target.value })
                  }
                  style={styles.selectFull}
                >
                  <option value="">Select Blood Group</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
                {editErrors.bloodGroup && (
                  <span style={styles.errText}>{editErrors.bloodGroup}</span>
                )}
              </div>

              {/* Previous Team */}
              <div>
                <label style={styles.inputLabel}>Previous Team</label>
                <select
                  value={editForm.previousTeam}
                  onChange={(e) =>
                    setEditForm({ ...editForm, previousTeam: e.target.value })
                  }
                  style={styles.selectFull}
                >
                  <option value="">Select Previous Team</option>
                  {PREVIOUS_TEAMS.map((tm) => (
                    <option key={tm} value={tm}>
                      {tm}
                    </option>
                  ))}
                </select>
                {editErrors.previousTeam && (
                  <span style={styles.errText}>{editErrors.previousTeam}</span>
                )}
              </div>

              {/* Previous Points */}
              <div>
                <label style={styles.inputLabel}>Previous Points (Admin Only)</label>
                <input
                  type="number"
                  value={editForm.previousPoints}
                  onChange={(e) =>
                    setEditForm({ ...editForm, previousPoints: e.target.value })
                  }
                  placeholder="e.g. 150"
                  style={styles.input}
                />
                {editErrors.previousPoints && (
                  <span style={styles.errText}>{editErrors.previousPoints}</span>
                )}
              </div>

              {/* Father's Name */}
              <div>
                <label style={styles.inputLabel}>Father&apos;s Full Name *</label>
                <input
                  type="text"
                  value={editForm.fatherName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, fatherName: e.target.value })
                  }
                  style={styles.input}
                />
                {editErrors.fatherName && (
                  <span style={styles.errText}>{editErrors.fatherName}</span>
                )}
              </div>

              {/* Mother's Name */}
              <div>
                <label style={styles.inputLabel}>Mother&apos;s Full Name *</label>
                <input
                  type="text"
                  value={editForm.motherName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, motherName: e.target.value })
                  }
                  style={styles.input}
                />
                {editErrors.motherName && (
                  <span style={styles.errText}>{editErrors.motherName}</span>
                )}
              </div>

              {/* Profession Dropdown */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.inputLabel}>Profession *</label>
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
                {editErrors.profession && (
                  <span style={styles.errText}>{editErrors.profession}</span>
                )}
              </div>

              {/* Conditional Other Profession */}
              {editForm.profession === "Other" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.inputLabel}>Please Specify Custom Profession *</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={editForm.professionOther}
                    onChange={(e) =>
                      setEditForm({ ...editForm, professionOther: e.target.value })
                    }
                    placeholder="Describe custom profession"
                    style={styles.input}
                  />
                  {editErrors.professionOther && (
                    <span style={styles.errText}>{editErrors.professionOther}</span>
                  )}
                </div>
              )}

              {/* Address Line 1 */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.inputLabel}>Address Line 1 *</label>
                <input
                  type="text"
                  value={editForm.addressLine1}
                  onChange={(e) =>
                    setEditForm({ ...editForm, addressLine1: e.target.value })
                  }
                  style={styles.input}
                />
                {editErrors.addressLine1 && (
                  <span style={styles.errText}>{editErrors.addressLine1}</span>
                )}
              </div>

              {/* Address Line 2 */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.inputLabel}>Address Line 2 (Optional)</label>
                <input
                  type="text"
                  value={editForm.addressLine2}
                  onChange={(e) =>
                    setEditForm({ ...editForm, addressLine2: e.target.value })
                  }
                  style={styles.input}
                />
              </div>

              {/* City */}
              <div>
                <label style={styles.inputLabel}>City *</label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) =>
                    setEditForm({ ...editForm, city: e.target.value })
                  }
                  style={styles.input}
                />
                {editErrors.city && (
                  <span style={styles.errText}>{editErrors.city}</span>
                )}
              </div>

              {/* State */}
              <div>
                <label style={styles.inputLabel}>State *</label>
                <input
                  type="text"
                  value={editForm.state}
                  onChange={(e) =>
                    setEditForm({ ...editForm, state: e.target.value })
                  }
                  style={styles.input}
                />
                {editErrors.state && (
                  <span style={styles.errText}>{editErrors.state}</span>
                )}
              </div>

              {/* PinCode */}
              <div>
                <label style={styles.inputLabel}>Pin Code *</label>
                <input
                  type="text"
                  maxLength={6}
                  value={editForm.pinCode}
                  onChange={(e) =>
                    setEditForm({ ...editForm, pinCode: e.target.value })
                  }
                  style={styles.input}
                />
                {editErrors.pinCode && (
                  <span style={styles.errText}>{editErrors.pinCode}</span>
                )}
              </div>

              {/* Country */}
              <div>
                <label style={styles.inputLabel}>Country</label>
                <input
                  type="text"
                  value={editForm.country || "India"}
                  disabled
                  readOnly
                  style={{ ...styles.input, background: "#F1F5F9" }}
                />
              </div>

              {/* Role */}
              <div>
                <label style={styles.inputLabel}>Player Role *</label>
                <select
                  value={editForm.playerType}
                  onChange={(e) =>
                    setEditForm({ ...editForm, playerType: e.target.value })
                  }
                  style={styles.selectFull}
                >
                  <option value="">Select Role</option>
                  {PLAYER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {editErrors.playerType && (
                  <span style={styles.errText}>{editErrors.playerType}</span>
                )}
              </div>

              {/* Playing Styles */}
              <div>
                <label style={styles.inputLabel}>Playing Style (Select 1-2) *</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {PLAYING_STYLES.map((st) => {
                    const sel = editForm.playingStyle.includes(st);
                    return (
                      <label
                        key={st}
                        style={{
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                        }}
                      >
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
                {editErrors.playingStyle && (
                  <span style={styles.errText}>{editErrors.playingStyle}</span>
                )}
              </div>

              {/* T-Shirt Size */}
              <div>
                <label style={styles.inputLabel}>T-Shirt Size *</label>
                <select
                  value={editForm.tShirtSize}
                  onChange={(e) =>
                    setEditForm({ ...editForm, tShirtSize: e.target.value })
                  }
                  style={styles.selectFull}
                >
                  <option value="">Select Size</option>
                  {CLOTHING_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
                {editErrors.tShirtSize && (
                  <span style={styles.errText}>{editErrors.tShirtSize}</span>
                )}
              </div>

              {/* Pant Size */}
              <div>
                <label style={styles.inputLabel}>Pant Size *</label>
                <select
                  value={editForm.pantSize}
                  onChange={(e) =>
                    setEditForm({ ...editForm, pantSize: e.target.value })
                  }
                  style={styles.selectFull}
                >
                  <option value="">Select Size</option>
                  {CLOTHING_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
                {editErrors.pantSize && (
                  <span style={styles.errText}>{editErrors.pantSize}</span>
                )}
              </div>

              {/* T-Shirt Number */}
              <div>
                <label style={styles.inputLabel}>T-Shirt Number (0-9999) *</label>
                <input
                  type="number"
                  min={TSHIRT_NUMBER_MIN}
                  max={TSHIRT_NUMBER_MAX}
                  value={editForm.tShirtNumber}
                  onChange={(e) =>
                    setEditForm({ ...editForm, tShirtNumber: e.target.value })
                  }
                  style={styles.input}
                />
                {editErrors.tShirtNumber && (
                  <span style={styles.errText}>{editErrors.tShirtNumber}</span>
                )}
              </div>

              {/* T-Shirt Name */}
              <div>
                <label style={styles.inputLabel}>T-Shirt Name (Max 20 chars) *</label>
                <input
                  type="text"
                  maxLength={TSHIRT_NAME_MAX_LENGTH}
                  value={editForm.tShirtName}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      tShirtName: e.target.value.toUpperCase().slice(0, 20),
                    })
                  }
                  style={styles.input}
                />
                {editErrors.tShirtName && (
                  <span style={styles.errText}>{editErrors.tShirtName}</span>
                )}
              </div>

              {/* Tournament Performance & Season History */}
              <div
                style={{
                  gridColumn: "1 / -1",
                  marginTop: 10,
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>
                      🏆 Tournament Performance Records (Admin Only)
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>
                      Enter year-wise performance. Cumulative totals will be calculated automatically.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSeason}
                    style={{
                      background: "#1E3A8A",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Add Season Year
                  </button>
                </div>

                {/* Quick string import helper */}
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #CBD5E1",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    ⚡ Quick String Importer (Format: <span style={{ fontFamily: "monospace" }}>2025 :- M:5, R:120, W:3, F:2 | 2024 :- M:4, R:80, W:1, F:1</span>)
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={quickImportText}
                      onChange={(e) => setQuickImportText(e.target.value)}
                      placeholder="Paste season string format..."
                      style={{ ...styles.input, flex: 1, fontSize: 12, padding: "6px 10px" }}
                    />
                    <button
                      type="button"
                      onClick={handleImportQuickString}
                      style={{
                        background: "#F1F5F9",
                        border: "1px solid #CBD5E1",
                        borderRadius: 6,
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1E293B",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Parse & Add
                    </button>
                  </div>
                </div>

                {/* Cumulative Totals Display */}
                {editForm.previousPerformance.length > 0 && (
                  <div
                    style={{
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: 8,
                      padding: "10px 14px",
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#1E40AF", marginBottom: 6, textTransform: "uppercase" }}>
                      Cumulative Summary ({editForm.previousPerformance.length} Seasons)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, textAlign: "center" }}>
                      <div style={{ background: "#fff", padding: "6px 4px", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>MATCHES</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{cumulativeTotals.matches}</div>
                      </div>
                      <div style={{ background: "#fff", padding: "6px 4px", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>RUNS</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#2563EB" }}>{cumulativeTotals.runs}</div>
                      </div>
                      <div style={{ background: "#fff", padding: "6px 4px", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>WICKETS</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#059669" }}>{cumulativeTotals.wickets}</div>
                      </div>
                      <div style={{ background: "#fff", padding: "6px 4px", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>FIELDING</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#D97706" }}>{cumulativeTotals.fielding}</div>
                      </div>
                      <div style={{ background: "#fff", padding: "6px 4px", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>MOM</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#7C3AED" }}>{cumulativeTotals.mom}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Year Wise List of Season Cards */}
                {editForm.previousPerformance.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "16px 0", color: "#94A3B8", fontSize: 12, fontStyle: "italic" }}>
                    No performance records added yet. Click &ldquo;+ Add Season Year&rdquo; or use the quick importer above.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {editForm.previousPerformance.map((season, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#fff",
                          border: "1px solid #CBD5E1",
                          borderRadius: 8,
                          padding: 12,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Season Year:</span>
                            <input
                              type="number"
                              value={season.year}
                              onChange={(e) => handleSeasonChange(idx, "year", e.target.value)}
                              style={{ ...styles.input, width: 85, padding: "4px 8px", fontSize: 13, fontWeight: 700 }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSeason(idx)}
                            style={{
                              background: "#FEE2E2",
                              color: "#DC2626",
                              border: "none",
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            🗑️ Remove
                          </button>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))",
                            gap: 8,
                          }}
                        >
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#64748B", display: "block" }}>Matches</label>
                            <input
                              type="number"
                              value={season.matches}
                              onChange={(e) => handleSeasonChange(idx, "matches", e.target.value)}
                              style={{ ...styles.input, padding: "4px 6px", fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#64748B", display: "block" }}>Runs</label>
                            <input
                              type="number"
                              value={season.runs}
                              onChange={(e) => handleSeasonChange(idx, "runs", e.target.value)}
                              style={{ ...styles.input, padding: "4px 6px", fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#64748B", display: "block" }}>Wickets</label>
                            <input
                              type="number"
                              value={season.wickets}
                              onChange={(e) => handleSeasonChange(idx, "wickets", e.target.value)}
                              style={{ ...styles.input, padding: "4px 6px", fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#64748B", display: "block" }}>Fielding</label>
                            <input
                              type="number"
                              value={season.fielding}
                              onChange={(e) => handleSeasonChange(idx, "fielding", e.target.value)}
                              style={{ ...styles.input, padding: "4px 6px", fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#64748B", display: "block" }}>MOM</label>
                            <input
                              type="number"
                              value={season.mom}
                              onChange={(e) => handleSeasonChange(idx, "mom", e.target.value)}
                              style={{ ...styles.input, padding: "4px 6px", fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#64748B", display: "block" }}>Batting Avg</label>
                            <input
                              type="number"
                              step="0.01"
                              value={season.battingAvg}
                              onChange={(e) => handleSeasonChange(idx, "battingAvg", e.target.value)}
                              style={{ ...styles.input, padding: "4px 6px", fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#64748B", display: "block" }}>Strike Rate</label>
                            <input
                              type="number"
                              step="0.01"
                              value={season.strikeRate}
                              onChange={(e) => handleSeasonChange(idx, "strikeRate", e.target.value)}
                              style={{ ...styles.input, padding: "4px 6px", fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#64748B", display: "block" }}>Economy</label>
                            <input
                              type="number"
                              step="0.01"
                              value={season.economy}
                              onChange={(e) => handleSeasonChange(idx, "economy", e.target.value)}
                              style={{ ...styles.input, padding: "4px 6px", fontSize: 12 }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                borderTop: "1px solid #E2E8F0",
                paddingTop: 16,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  ...styles.quickBtn,
                  background: "#F1F5F9",
                  color: "#475569",
                  padding: "9px 18px",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  ...styles.saveBtn,
                  marginLeft: 0,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving Changes..." : "Save Player Updates"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  /* ─── Player Detail Modal ───────────────────────────────── */
  const PlayerModal = ({ player, onClose }) => {
    const [localStatus, setLocalStatus] = useState(player.status);
    const [saving, setSaving] = useState(false);
    const [playerPool, setPlayerPool] = useState(player.playerPool || 1);

    const computedAge = calculateAge(player.dateOfBirth, player.Age);

    const updatePool = async () => {
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
      }
    };

    const saveStatus = async () => {
      if (localStatus === player.status) {
        onClose();
        return;
      }
      setSaving(true);
      await updateStatus(player._id, localStatus);
      setSaving(false);
      onClose();
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
                size={54}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: 19, color: "#0F172A" }}>
                  {player.playerName}
                </div>
                <div style={{ fontSize: 13, color: "#64748B" }}>
                  Player ID: #{player.playerID ?? "—"} &nbsp;·&nbsp; {player.playerType} &nbsp;·&nbsp;{" "}
                  <Badge status={player.status} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setEditingPlayer(player)}
                style={{
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  color: "#1E40AF",
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ✏️ Edit Player
              </button>
              <button onClick={onClose} style={styles.closeBtn}>
                ✕
              </button>
            </div>
          </div>

          <div style={styles.modalBody}>
            <div style={styles.twoCol}>
              {/* Left Column: Details */}
              <div>
                {/* 1. Personal Information */}
                <Section title="Personal Information">
                  <Field label="Full Name" value={player.playerName} />
                  <Field label="Mobile Number" value={player.playerPhone} />
                  <Field label="Date of Birth" value={formatDate(player.dateOfBirth)} />
                  <Field
                    label="Calculated Age"
                    value={
                      computedAge !== null
                        ? `${computedAge} years`
                        : "Not Available"
                    }
                  />
                  <Field
                    label="Anniversary"
                    value={formatDate(player.anniversary)}
                  />
                  <Field
                    label="Blood Group"
                    value={player.bloodGroup || "Not Available"}
                  />
                  <Field
                    label="Father's Name"
                    value={player.fatherName || "Not Available"}
                  />
                  <Field
                    label="Mother's Name"
                    value={player.motherName || "Not Available"}
                  />
                  <Field
                    label="Profession"
                    value={player.profession || "Not Available"}
                  />
                  {player.profession === "Other" && (
                    <Field
                      label="Custom Profession"
                      value={player.professionOther || "Not Available"}
                      highlight
                    />
                  )}
                  <Field
                    label="Previous Team"
                    value={player.previousTeam || "Not Available"}
                  />
                </Section>

                {/* 2. Address Details (AddressSchema) */}
                <Section title="Residential Address">
                  {Array.isArray(player.playerAddress) && player.playerAddress[0] ? (
                    <>
                      <Field
                        label="Address Line 1"
                        value={player.playerAddress[0].AddressLine1 || "Not Available"}
                      />
                      {player.playerAddress[0].AddressLine2 && (
                        <Field
                          label="Address Line 2"
                          value={player.playerAddress[0].AddressLine2}
                        />
                      )}
                      <Field
                        label="City"
                        value={player.playerAddress[0].City || "Not Available"}
                      />
                      <Field
                        label="State"
                        value={player.playerAddress[0].State || "Not Available"}
                      />
                      <Field
                        label="Pin Code"
                        value={player.playerAddress[0].PinCode || "Not Available"}
                        mono
                      />
                      <Field
                        label="Country"
                        value={player.playerAddress[0].Country || "India"}
                      />
                    </>
                  ) : (
                    <Field label="Address" value="Not Available" />
                  )}
                </Section>

                {/* 3. Playing Information */}
                <Section title="Playing Information">
                  <Field label="Player ID" value={`#${player.playerID ?? "—"}`} />
                  <Field label="Player Role" value={player.playerType} />
                  <Field
                    label="Playing Style"
                    value={
                      Array.isArray(player.playingStyle)
                        ? player.playingStyle.join(", ")
                        : player.playingStyle || "—"
                    }
                  />
                  <Field label="Category" value={player.playerCategory || "—"} />
                  <Field label="Player Pool" value={`Pool ${player.playerPool ?? "—"}`} />
                  <Field
                    label="Previous Points"
                    value={
                      player.previousPoints !== undefined && player.previousPoints !== null
                        ? player.previousPoints
                        : "Not Available"
                    }
                    highlight={player.previousPoints !== undefined && player.previousPoints !== null}
                  />
                </Section>

                {/* 3. Merchandise Information */}
                <Section title="Merchandise Information">
                  <Field label="T-Shirt Size" value={player.tShirtSize || "Not Available"} />
                  <Field label="Pant Size" value={player.pantSize || "Not Available"} />
                  <Field
                    label="T-Shirt Number"
                    value={player.tShirtNumber !== undefined ? `#${player.tShirtNumber}` : "Not Available"}
                    mono
                  />
                  <Field
                    label="T-Shirt Name"
                    value={player.tShirtName || "Not Available"}
                    highlight
                  />
                </Section>

                {/* 4. Payment Information */}
                <Section title="Payment Information">
                  <Field label="Transaction ID" value={player.transactionId} mono />
                  <Field label="Status" value={player.status?.toUpperCase()} />
                  <Field
                    label="Registered On"
                    value={
                      player.createdAt
                        ? new Date(player.createdAt).toLocaleString("en-IN")
                        : "—"
                    }
                  />
                </Section>
              </div>

              {/* Right Column: Media */}
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <div style={styles.imgLabel}>Player Photo</div>
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
                          maxHeight: 240,
                          objectFit: "cover",
                          borderRadius: 12,
                          border: "1px solid #E2E8F0",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        }}
                      />
                      <span style={styles.zoomHint}>🔍 Click to enlarge</span>
                    </div>
                  ) : (
                    <div style={styles.imgPlaceholder}>No photo available</div>
                  )}
                </div>

                <div>
                  <div style={styles.imgLabel}>Payment Screenshot</div>
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
                          maxHeight: 280,
                          objectFit: "contain",
                          borderRadius: 12,
                          border: "1px solid #E2E8F0",
                          background: "#F8FAFC",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        }}
                      />
                      <span style={styles.zoomHint}>🔍 Click to enlarge</span>
                    </div>
                  ) : (
                    <div style={styles.imgPlaceholder}>No screenshot uploaded</div>
                  )}
                </div>
              </div>
            </div>

            {/* Tournament Performance & History */}
            <div style={{ marginTop: 8, marginBottom: 18, borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
              <Section title="Tournament Performance & History">
                {Array.isArray(player.previousPerformance) && player.previousPerformance.length > 0 ? (
                  <div>
                    {/* Cumulative Stats Card */}
                    {(() => {
                      const totals = player.previousPerformance.reduce(
                        (acc, s) => ({
                          matches: acc.matches + (Number(s.matches) || 0),
                          runs: acc.runs + (Number(s.runs) || 0),
                          wickets: acc.wickets + (Number(s.wickets) || 0),
                          fielding: acc.fielding + (Number(s.fielding) || 0),
                          mom: acc.mom + (Number(s.mom) || 0),
                        }),
                        { matches: 0, runs: 0, wickets: 0, fielding: 0, mom: 0 }
                      );
                      return (
                        <div
                          style={{
                            background: "#F8FAFC",
                            border: "1px solid #E2E8F0",
                            borderRadius: 8,
                            padding: "10px 14px",
                            marginBottom: 12,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#1E3A8A",
                              marginBottom: 6,
                              textTransform: "uppercase",
                            }}
                          >
                            Cumulative All-Time Stats ({player.previousPerformance.length} Seasons)
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(5, 1fr)",
                              gap: 8,
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                background: "#fff",
                                padding: "8px 4px",
                                borderRadius: 6,
                                border: "1px solid #E2E8F0",
                              }}
                            >
                              <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>MATCHES</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{totals.matches}</div>
                            </div>
                            <div
                              style={{
                                background: "#fff",
                                padding: "8px 4px",
                                borderRadius: 6,
                                border: "1px solid #E2E8F0",
                              }}
                            >
                              <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>RUNS</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: "#2563EB" }}>{totals.runs}</div>
                            </div>
                            <div
                              style={{
                                background: "#fff",
                                padding: "8px 4px",
                                borderRadius: 6,
                                border: "1px solid #E2E8F0",
                              }}
                            >
                              <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>WICKETS</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: "#059669" }}>{totals.wickets}</div>
                            </div>
                            <div
                              style={{
                                background: "#fff",
                                padding: "8px 4px",
                                borderRadius: 6,
                                border: "1px solid #E2E8F0",
                              }}
                            >
                              <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>FIELDING</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: "#D97706" }}>{totals.fielding}</div>
                            </div>
                            <div
                              style={{
                                background: "#fff",
                                padding: "8px 4px",
                                borderRadius: 6,
                                border: "1px solid #E2E8F0",
                              }}
                            >
                              <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>MOM</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: "#7C3AED" }}>{totals.mom}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Year-by-Year Records Table */}
                    <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#F1F5F9", color: "#475569", textAlign: "center" }}>
                            <th style={{ padding: "6px 8px", borderBottom: "1px solid #E2E8F0" }}>Year</th>
                            <th style={{ padding: "6px 8px", borderBottom: "1px solid #E2E8F0" }}>M</th>
                            <th style={{ padding: "6px 8px", borderBottom: "1px solid #E2E8F0" }}>R</th>
                            <th style={{ padding: "6px 8px", borderBottom: "1px solid #E2E8F0" }}>W</th>
                            <th style={{ padding: "6px 8px", borderBottom: "1px solid #E2E8F0" }}>F</th>
                            <th style={{ padding: "6px 8px", borderBottom: "1px solid #E2E8F0" }}>MOM</th>
                            <th style={{ padding: "6px 8px", borderBottom: "1px solid #E2E8F0" }}>Avg</th>
                            <th style={{ padding: "6px 8px", borderBottom: "1px solid #E2E8F0" }}>SR</th>
                            <th style={{ padding: "6px 8px", borderBottom: "1px solid #E2E8F0" }}>Econ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {player.previousPerformance.map((rec, i) => (
                            <tr key={i} style={{ textAlign: "center", borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "6px 8px", fontWeight: 700, color: "#1E293B" }}>{rec.year || "—"}</td>
                              <td style={{ padding: "6px 8px" }}>{rec.matches ?? 0}</td>
                              <td style={{ padding: "6px 8px", fontWeight: 600, color: "#2563EB" }}>{rec.runs ?? 0}</td>
                              <td style={{ padding: "6px 8px", fontWeight: 600, color: "#059669" }}>{rec.wickets ?? 0}</td>
                              <td style={{ padding: "6px 8px" }}>{rec.fielding ?? 0}</td>
                              <td style={{ padding: "6px 8px" }}>{rec.mom ?? 0}</td>
                              <td style={{ padding: "6px 8px" }}>{rec.battingAvg ?? 0}</td>
                              <td style={{ padding: "6px 8px" }}>{rec.strikeRate ?? 0}</td>
                              <td style={{ padding: "6px 8px" }}>{rec.economy ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic", padding: "4px 0" }}>
                    No previous tournament performance recorded
                  </div>
                )}
              </Section>
            </div>

            {/* Status Update Control */}
            <div style={styles.statusRow}>
              <span style={{ fontWeight: 700, color: "#334155", fontSize: 13 }}>
                Update Registration Status:
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setLocalStatus(s)}
                    style={{
                      ...styles.statusBtn,
                      background:
                        localStatus === s ? STATUS_COLORS[s].bg : "#F1F5F9",
                      color:
                        localStatus === s ? STATUS_COLORS[s].text : "#64748B",
                      border:
                        localStatus === s
                          ? `2px solid ${STATUS_COLORS[s].border}`
                          : "2px solid transparent",
                      fontWeight: localStatus === s ? 700 : 500,
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <button onClick={saveStatus} disabled={saving} style={styles.saveBtn}>
                {saving ? "Saving…" : "Save Status"}
              </button>
            </div>

            {/* Pool Update Control */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid #F1F5F9",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>
                Tournament Pool:
              </span>
              <select
                value={playerPool}
                onChange={(e) => setPlayerPool(Number(e.target.value))}
                style={styles.select}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((pool) => (
                  <option key={pool} value={pool}>
                    Pool {pool}
                  </option>
                ))}
              </select>
              <button onClick={updatePool} style={styles.saveBtn}>
                Update Pool
              </button>
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
            if (selectedPlayer?._id === updated._id) {
              setSelected(updated);
            }
          }}
        />
      )}

      {/* Page Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>🏏 MPL 2026 Admin Dashboard</h1>
          <p style={styles.pageSubtitle}>
            Review, edit, search, and export player registrations
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <ExportBtn
            label="Export Excel (25 Fields)"
            onClick={exportExcel}
            loading={exporting === "excel"}
            icon="📊"
            color="#16A34A"
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div style={styles.statsGrid}>
        {[
          { label: "Total", value: stats.total, color: "#3B82F6", icon: "👥" },
          { label: "Pending", value: stats.pending, color: "#F59E0B", icon: "⏳" },
          { label: "Approved", value: stats.approved, color: "#10B981", icon: "✅" },
          { label: "Rejected", value: stats.rejected, color: "#EF4444", icon: "❌" },
        ].map((s) => (
          <div
            key={s.label}
            style={styles.statCard}
            onClick={() => {
              setFStatus(s.label === "Total" ? "" : s.label.toLowerCase());
              setPage(1);
            }}
          >
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                {s.label} Players
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Search Bar */}
      <div style={styles.filterBar}>
        <input
          placeholder="Search name, phone, player ID, txn ID, jersey #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => {
            setFStatus(e.target.value);
            setPage(1);
          }}
          style={styles.select}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        {/* Role Filter */}
        <select
          value={filterType}
          onChange={(e) => {
            setFType(e.target.value);
            setPage(1);
          }}
          style={styles.select}
        >
          <option value="">All Roles</option>
          {PLAYER_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {/* Pool Filter */}
        <select
          value={filterPool}
          onChange={(e) => {
            setFPool(e.target.value);
            setPage(1);
          }}
          style={styles.select}
        >
          <option value="">All Pools</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((pool) => (
            <option key={pool} value={pool}>
              Pool {pool}
            </option>
          ))}
        </select>

        {/* Profession Filter */}
        <select
          value={filterProfession}
          onChange={(e) => {
            setFProfession(e.target.value);
            setPage(1);
          }}
          style={{ ...styles.select, maxWidth: 220 }}
        >
          <option value="">All Professions</option>
          {PROFESSIONS.map((prof) => (
            <option key={prof} value={prof}>
              {prof}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        {(filterStatus || filterType || filterPool || filterProfession || search) && (
          <button
            onClick={() => {
              setFStatus("");
              setFType("");
              setFPool("");
              setFProfession("");
              setSearch("");
              setPage(1);
            }}
            style={styles.clearBtn}
          >
            Clear ✕
          </button>
        )}
      </div>

      {/* Players Table */}
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <span style={{ color: "#64748B", marginLeft: 12 }}>
              Loading player records…
            </span>
          </div>
        ) : players.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 40 }}>🏏</div>
            <div style={{ color: "#64748B", marginTop: 8, fontWeight: 600 }}>
              No registered players match the criteria
            </div>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {[
                  "ID",
                  "Player",
                  "Mobile",
                  "DOB / Age",
                  "Blood",
                  "Profession",
                  "Role",
                  "Style",
                  "Prev Team",
                  "Points",
                  "Status",
                  "Registered",
                  "Actions",
                ].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
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

                    {/* Name & Avatar */}
                    <td style={{ ...styles.td, minWidth: 170 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar
                          src={p.playerPhoto?.url}
                          name={p.playerName}
                          size={36}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: "#0F172A" }}>
                            {p.playerName}
                          </div>
                          {p.tShirtNumber !== undefined && (
                            <div style={{ fontSize: 11, color: "#64748B" }}>
                              Jersey #{p.tShirtNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Mobile */}
                    <td style={styles.td}>{p.playerPhone}</td>

                    {/* DOB / Age */}
                    <td style={styles.td}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
                        {formatDate(p.dateOfBirth)}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        {age !== null ? `${age} yrs` : "Age N/A"}
                      </div>
                    </td>

                    {/* Blood Group */}
                    <td style={styles.td}>
                      <span style={{ fontWeight: 700, color: "#DC2626" }}>
                        {p.bloodGroup || "—"}
                      </span>
                    </td>

                    {/* Profession */}
                    <td style={{ ...styles.td, maxWidth: 160 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.profession === "Other" ? p.professionOther : p.profession}>
                        {p.profession === "Other" && p.professionOther ? p.professionOther : p.profession || "—"}
                      </div>
                    </td>

                    {/* Role */}
                    <td style={styles.td}>
                      <span style={styles.chip}>{p.playerType}</span>
                    </td>

                    {/* Playing Style */}
                    <td style={{ ...styles.td, fontSize: 12, maxWidth: 140 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={(p.playingStyle || []).join(", ")}>
                        {(p.playingStyle || []).join(", ") || "—"}
                      </div>
                    </td>

                    {/* Previous Team */}
                    <td style={styles.td}>{p.previousTeam || "—"}</td>

                    {/* Previous Points */}
                    <td style={{ ...styles.td, fontWeight: 700, color: "#1E3A8A" }}>
                      {p.previousPoints !== undefined && p.previousPoints !== null ? p.previousPoints : "—"}
                    </td>

                    {/* Status */}
                    <td style={styles.td}>
                      <Badge status={p.status} />
                    </td>

                    {/* Registered Date */}
                    <td style={{ ...styles.td, fontSize: 12, whiteSpace: "nowrap" }}>
                      {p.createdAt
                        ? new Date(p.createdAt).toLocaleDateString("en-IN")
                        : "—"}
                    </td>

                    {/* Actions */}
                    <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <button
                          onClick={() => setEditingPlayer(p)}
                          title="Edit Player"
                          style={{
                            ...styles.quickBtn,
                            background: "#EFF6FF",
                            color: "#1E40AF",
                            border: "1px solid #BFDBFE",
                          }}
                        >
                          ✏️
                        </button>
                        {STATUS_OPTIONS.filter((s) => s !== p.status).map((s) => (
                          <button
                            key={s}
                            title={`Mark as ${s}`}
                            onClick={() => updateStatus(p._id, s)}
                            style={{
                              ...styles.quickBtn,
                              background: STATUS_COLORS[s].bg,
                              color: STATUS_COLORS[s].text,
                              border: `1px solid ${STATUS_COLORS[s].border}`,
                            }}
                          >
                            {s === "approved" ? "✓" : s === "rejected" ? "✗" : "⏳"}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={styles.paginationBar}>
          <span style={{ color: "#64748B", fontSize: 13 }}>
            Showing {(page - 1) * limit + 1}–
            {Math.min(page * limit, pagination.total)} of {pagination.total} registered players
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <PageBtn
              label="‹ Prev"
              disabled={!pagination.hasPrev}
              onClick={() => setPage((p) => p - 1)}
            />
            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <PageBtn
                  key={p}
                  label={p}
                  active={p === page}
                  onClick={() => setPage(p)}
                />
              );
            })}
            <PageBtn
              label="Next ›"
              disabled={!pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-Components ────────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#94A3B8",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
          borderBottom: "1px solid #F1F5F9",
          paddingBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, mono, highlight }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 6,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{ fontSize: 12, color: "#64748B", minWidth: 120, flexShrink: 0 }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: highlight ? "#D97706" : "#0F172A",
          fontWeight: 600,
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-all",
        }}
      >
        {value || "—"}
      </span>
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
        gap: 7,
        padding: "9px 18px",
        borderRadius: 8,
        border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        background: color,
        color: "#fff",
        fontWeight: 700,
        fontSize: 13,
        opacity: loading ? 0.7 : 1,
        transition: "opacity 0.2s",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
      }}
    >
      <span>{icon}</span>
      <span>{loading ? "Exporting…" : label}</span>
    </button>
  );
}

function PageBtn({ label, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 34,
        height: 34,
        borderRadius: 6,
        border: "1px solid #E2E8F0",
        background: active ? "#1E3A8A" : disabled ? "#F1F5F9" : "#fff",
        color: active ? "#fff" : disabled ? "#CBD5E1" : "#334155",
        fontWeight: active ? 700 : 500,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */
const styles = {
  page: {
    background: "#F8FAFC",
    minHeight: "100vh",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: "28px 32px",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  pageTitle: { fontSize: 26, fontWeight: 800, color: "#0F172A", margin: 0 },
  pageSubtitle: { fontSize: 14, color: "#64748B", margin: "4px 0 0" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 14,
    marginBottom: 20,
  },
  statCard: {
    background: "#fff",
    borderRadius: 12,
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    border: "1px solid #E2E8F0",
    cursor: "pointer",
    transition: "box-shadow 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  filterBar: {
    display: "flex",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
    alignItems: "center",
  },
  searchInput: {
    flex: "1 1 260px",
    padding: "9px 14px",
    borderRadius: 8,
    border: "1.5px solid #E2E8F0",
    fontSize: 13,
    outline: "none",
    background: "#fff",
    color: "#0F172A",
  },
  select: {
    padding: "9px 14px",
    borderRadius: 8,
    border: "1.5px solid #E2E8F0",
    fontSize: 13,
    background: "#fff",
    color: "#334155",
    cursor: "pointer",
  },
  selectFull: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #CBD5E1",
    fontSize: 13,
    background: "#fff",
    color: "#0F172A",
    outline: "none",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #CBD5E1",
    fontSize: 13,
    outline: "none",
    color: "#0F172A",
    boxSizing: "border-box",
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
  errText: {
    display: "block",
    fontSize: 11,
    color: "#EF4444",
    marginTop: 3,
  },
  clearBtn: {
    padding: "9px 14px",
    borderRadius: 8,
    border: "1.5px solid #FECACA",
    background: "#FEF2F2",
    color: "#EF4444",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  tableWrap: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    overflow: "auto",
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    padding: "12px 14px",
    background: "#F1F5F9",
    color: "#475569",
    fontWeight: 700,
    textAlign: "left",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #E2E8F0",
    whiteSpace: "nowrap",
  },
  tr: {
    cursor: "pointer",
    transition: "background 0.15s",
  },
  td: {
    padding: "11px 14px",
    borderBottom: "1px solid #F1F5F9",
    color: "#334155",
    verticalAlign: "middle",
  },
  idNum: {
    background: "#EFF6FF",
    color: "#2563EB",
    borderRadius: 6,
    padding: "2px 8px",
    fontWeight: 700,
    fontSize: 12,
    fontFamily: "monospace",
  },
  chip: {
    background: "#F1F5F9",
    color: "#475569",
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 600,
  },
  quickBtn: {
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 700,
    border: "none",
  },
  paginationBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 4px",
  },
  loadingWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "3px solid #E2E8F0",
    borderTopColor: "#3B82F6",
    animation: "spin 0.8s linear infinite",
  },
  emptyState: { textAlign: "center", padding: 60, fontSize: 15 },
  toast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    color: "#fff",
    padding: "12px 20px",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 14,
    zIndex: 9999,
    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
    animation: "slideIn 0.3s ease",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 860,
    maxHeight: "92vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
  },
  modalHeader: {
    padding: "18px 24px",
    borderBottom: "1px solid #E2E8F0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  closeBtn: {
    background: "#F1F5F9",
    border: "none",
    borderRadius: 8,
    width: 34,
    height: 34,
    cursor: "pointer",
    fontSize: 14,
    color: "#64748B",
    fontWeight: 700,
  },
  modalBody: { padding: 24, overflowY: "auto" },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 24,
    marginBottom: 20,
  },
  imgLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 8,
  },
  imgPlaceholder: {
    height: 120,
    background: "#F8FAFC",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94A3B8",
    border: "1px dashed #CBD5E1",
    fontSize: 12,
  },
  zoomHint: {
    position: "absolute",
    bottom: 8,
    right: 8,
    background: "rgba(0,0,0,0.7)",
    color: "#fff",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 600,
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: "16px 0 0",
    borderTop: "1px solid #F1F5F9",
  },
  statusBtn: {
    padding: "7px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    transition: "all 0.15s",
  },
  saveBtn: {
    marginLeft: "auto",
    background: "#1E3A8A",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 20px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
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
    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  },
  lightboxClose: {
    position: "absolute",
    top: 24,
    right: 24,
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    border: "none",
    borderRadius: "50%",
    width: 44,
    height: 44,
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
