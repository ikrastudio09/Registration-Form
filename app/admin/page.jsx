'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ─── helpers ─────────────────────────────────────────────── */
const STATUS_COLORS = {
  pending:  { bg: '#FFF8E1', text: '#F59E0B', border: '#FDE68A' },
  approved: { bg: '#ECFDF5', text: '#10B981', border: '#A7F3D0' },
  rejected: { bg: '#FEF2F2', text: '#EF4444', border: '#FECACA' },
};

const STATUS_OPTIONS = ['pending', 'approved', 'rejected'];
const ROLE_OPTIONS   = ['Batsman', 'Bowler', 'All Rounder'];
const STYLE_OPTIONS  = ['Right Arm Batting', 'Right Arm Balling', 'Left Arm Batting', 'Left Arm Balling'];

function Badge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 20, padding: '3px 12px', fontSize: 11,
      fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
}

function Avatar({ src, name, size = 40 }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'linear-gradient(135deg,#1E3A8A,#3B82F6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0,
      }}>
        {(name || '?')[0].toUpperCase()}
      </div>
    );
  }
  return (
    <img src={src} alt={name} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #E2E8F0' }} />
  );
}

/* ─── image → base64 (for PDF embed) ──────────────────────── */
async function toBase64(url) {
  try {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

/* ─── Main Component ───────────────────────────────────────── */
export default function PlayersAdminPage() {
  /* state */
  const [players, setPlayers]         = useState([]);
  const [pagination, setPagination]   = useState({});
  const [loading, setLoading]         = useState(true);
  const [exporting, setExporting]     = useState('');
  const [selectedPlayer, setSelected] = useState(null);
  const [toast, setToast]             = useState(null);

  /* filters */
  const [search, setSearch]           = useState('');
  const [filterStatus, setFStatus]    = useState('');
  const [filterType, setFType]        = useState('');
  const [page, setPage]               = useState(1);
  const [limit]                       = useState(20);

  /* stats */
  const [stats, setStats]             = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const debounceRef                   = useRef(null);

  /* ── fetch ── */
  const fetchPlayers = useCallback(async (overrides = {}) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: overrides.page ?? page,
      limit,
      ...(overrides.search      ?? search)       && { search:      overrides.search      ?? search },
      ...(overrides.filterStatus ?? filterStatus) && { status:      overrides.filterStatus ?? filterStatus },
      ...(overrides.filterType   ?? filterType)   && { playerType:  overrides.filterType   ?? filterType },
    });
    try {
      const r = await fetch(`/api/players?${params}`);
      const data = await r.json();
      if (data.success) {
        setPlayers(data.data.players);
        setPagination(data.data.pagination);

        /* compute stats from all players (no filter) if on first page */
        if (!filterStatus && !filterType && !search && (overrides.page ?? page) === 1) {
          const allR = await fetch(`/api/players?limit=1000`);
          const allD = await allR.json();
          if (allD.success) {
            const all = allD.data.players;
            setStats({
              total:    all.length,
              pending:  all.filter(p => p.status === 'pending').length,
              approved: all.filter(p => p.status === 'approved').length,
              rejected: all.filter(p => p.status === 'rejected').length,
            });
          }
        }
      }
    } catch { showToast('Failed to fetch players', 'error'); }
    finally { setLoading(false); }
  }, [page, limit, search, filterStatus, filterType]);

  useEffect(() => { fetchPlayers(); }, [page, filterStatus, filterType]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPlayers({ page: 1, search });
    }, 400);
  }, [search]);

  /* ── toast ── */
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── status update ── */
  const updateStatus = async (playerId, newStatus) => {
    try {
      const r = await fetch(`/api/players/${playerId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await r.json();
      if (data.success) {
        setPlayers(prev => prev.map(p => p._id === playerId ? { ...p, status: newStatus } : p));
        if (selectedPlayer?._id === playerId) setSelected(prev => ({ ...prev, status: newStatus }));
        showToast(`Status updated to "${newStatus}"`);
      } else { showToast(data.message || 'Update failed', 'error'); }
    } catch { showToast('Network error', 'error'); }
  };

  /* ── fetch ALL for export (no pagination) ── */
  const fetchAllForExport = async () => {
    const r = await fetch(`/api/players?limit=10000`);
    const d = await r.json();
    return d.success ? d.data.players : players;
  };

  /* ─── Excel Export ──────────────────────────────────────── */
  const exportExcel = async () => {
    setExporting('excel');
    try {
      const all = await fetchAllForExport();
      const rows = all.map((p, i) => ({
        '#':              i + 1,
        'Player ID':      p.playerID,
        'Name':           p.playerName,
        'Phone':          p.playerPhone,
        'Age':            p.Age,
        'Role':           p.playerType,
        'Playing Style':  (p.playingStyle || []).join(', '),
        'Previous Team':  p.previousTeam || '—',
        'Pool':           p.playerPool ?? '—',
        'Category':       p.playerCategory || '—',
        'Transaction ID': p.transactionId,
        'Status':         p.status,
        'Photo URL':      p.playerPhoto?.url || '',
        'Payment URL':    p.paymentScreenshot?.url || '',
        'Registered At':  new Date(p.createdAt).toLocaleString('en-IN'),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      /* column widths */
      ws['!cols'] = [
        { wch: 4 }, { wch: 10 }, { wch: 22 }, { wch: 14 }, { wch: 5 },
        { wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 6 }, { wch: 12 },
        { wch: 22 }, { wch: 10 }, { wch: 50 }, { wch: 50 }, { wch: 20 },
      ];

      /* header style */
      const headerRange = XLSX.utils.decode_range(ws['!ref']);
      for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
        const cell = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[cell]) {
          ws[cell].s = {
            fill: { fgColor: { rgb: '1E3A8A' } },
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { horizontal: 'center' },
          };
        }
      }

      /* status colour rows */
      rows.forEach((row, i) => {
        const r = i + 1;
        const color = row.Status === 'approved' ? 'ECFDF5' : row.Status === 'rejected' ? 'FEF2F2' : 'FFFBEB';
        for (let C = 0; C <= 14; C++) {
          const cell = XLSX.utils.encode_cell({ r, c: C });
          if (ws[cell]) { ws[cell].s = { fill: { fgColor: { rgb: color } } }; }
        }
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Players');
      XLSX.writeFile(wb, `Players_${Date.now()}.xlsx`);
      showToast('Excel exported successfully!');
    } catch (e) {
      console.error(e);
      showToast('Excel export failed', 'error');
    } finally { setExporting(''); }
  };

  /* ─── PDF Export ────────────────────────────────────────── */
  const exportPDF = async () => {
    setExporting('pdf');
    try {
      const all = await fetchAllForExport();

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

      /* header */
      doc.setFillColor(30, 58, 138);
      doc.rect(0, 0, doc.internal.pageSize.width, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('🏏 Cricket Tournament — Player Registrations', 14, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}  |  Total: ${all.length}`, doc.internal.pageSize.width - 14, 14, { align: 'right' });

      /* pre-load images */
      const imageMap = {};
      const IMG_SIZE = 14; // mm

      await Promise.all(
        all.map(async p => {
          if (p.playerPhoto?.url) {
            const b64 = await toBase64(p.playerPhoto.url);
            if (b64) imageMap[p._id + '_photo'] = b64;
          }
          if (p.paymentScreenshot?.url) {
            const b64 = await toBase64(p.paymentScreenshot.url);
            if (b64) imageMap[p._id + '_pay'] = b64;
          }
        })
      );

      const statusColor = s =>
        s === 'approved' ? [16, 185, 129] :
        s === 'rejected' ? [239, 68, 68]  :
                           [245, 158, 11];

      autoTable(doc, {
        startY: 26,
        head: [[
          'ID', 'Photo', 'Name', 'Phone', 'Age',
          'Role', 'Style', 'Prev Team', 'Pool', 'Category',
          'Transaction ID', 'Status', 'Payment', 'Registered',
        ]],
        body: all.map(p => [
          p.playerID ?? '—',
          '',                               // photo placeholder — drawn in didDrawCell
          p.playerName,
          p.playerPhone,
          p.Age,
          p.playerType,
          (p.playingStyle || []).join('\n'),
          p.previousTeam || '—',
          p.playerPool ?? '—',
          p.playerCategory || '—',
          p.transactionId,
          p.status,
          '',                               // payment placeholder
          new Date(p.createdAt).toLocaleDateString('en-IN'),
        ]),
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
        headStyles: {
          fillColor: [30, 58, 138], textColor: 255,
          fontStyle: 'bold', fontSize: 8, halign: 'center',
        },
        columnStyles: {
          0:  { cellWidth: 10, halign: 'center' },
          1:  { cellWidth: IMG_SIZE + 2, halign: 'center' },  // photo
          2:  { cellWidth: 32 },
          3:  { cellWidth: 24 },
          4:  { cellWidth: 10, halign: 'center' },
          5:  { cellWidth: 20 },
          6:  { cellWidth: 30 },
          7:  { cellWidth: 22 },
          8:  { cellWidth: 10, halign: 'center' },
          9:  { cellWidth: 18 },
          10: { cellWidth: 36 },
          11: { cellWidth: 18, halign: 'center' },
          12: { cellWidth: IMG_SIZE + 2, halign: 'center' },  // payment
          13: { cellWidth: 22 },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawCell: (data) => {
          if (data.section !== 'body') return;
          const player = all[data.row.index];
          const pad = 1;

          /* photo column */
          if (data.column.index === 1) {
            const b64 = imageMap[player._id + '_photo'];
            if (b64) {
              const cx = data.cell.x + (data.cell.width - IMG_SIZE) / 2;
              const cy = data.cell.y + (data.cell.height - IMG_SIZE) / 2;
              try {
                doc.addImage(b64, 'JPEG', cx, cy, IMG_SIZE, IMG_SIZE);
                /* circle clip via ellipse */
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.3);
                doc.ellipse(cx + IMG_SIZE / 2, cy + IMG_SIZE / 2, IMG_SIZE / 2, IMG_SIZE / 2, 'S');
              } catch {}
            }
          }

          /* payment column */
          if (data.column.index === 12) {
            const b64 = imageMap[player._id + '_pay'];
            if (b64) {
              const pw = IMG_SIZE;
              const ph = Math.min(data.cell.height - pad * 2, IMG_SIZE * 1.5);
              const cx = data.cell.x + (data.cell.width - pw) / 2;
              const cy = data.cell.y + (data.cell.height - ph) / 2;
              try { doc.addImage(b64, 'JPEG', cx, cy, pw, ph); } catch {}
            }
          }

          /* status badge */
          if (data.column.index === 11) {
            const [r, g, b] = statusColor(player.status);
            const text = player.status.toUpperCase();
            const bw = 14, bh = 5;
            const bx = data.cell.x + (data.cell.width - bw) / 2;
            const by = data.cell.y + (data.cell.height - bh) / 2;
            doc.setFillColor(r, g, b, 0.15);
            doc.roundedRect(bx, by, bw, bh, 1, 1, 'F');
            doc.setTextColor(r, g, b);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.text(text, bx + bw / 2, by + bh / 2 + 1.5, { align: 'center' });
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
          }
        },

        /* footer page numbers */
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 8,
            { align: 'center' }
          );
        },
      });

      doc.save(`Players_${Date.now()}.pdf`);
      showToast('PDF exported successfully!');
    } catch (e) {
      console.error(e);
      showToast('PDF export failed', 'error');
    } finally { setExporting(''); }
  };

  /* ─── Player Detail Modal ───────────────────────────────── */
  const PlayerModal = ({ player, onClose }) => {
    const [localStatus, setLocalStatus] = useState(player.status);
    const [saving, setSaving] = useState(false);

    const save = async () => {
      if (localStatus === player.status) { onClose(); return; }
      setSaving(true);
      await updateStatus(player._id, localStatus);
      setSaving(false);
      onClose();
    };

    return (
      <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={styles.modal}>
          {/* header */}
          <div style={styles.modalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar src={player.playerPhoto?.url} name={player.playerName} size={52} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#0F172A' }}>{player.playerName}</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>ID: #{player.playerID} &nbsp;·&nbsp; {player.playerType}</div>
              </div>
            </div>
            <button onClick={onClose} style={styles.closeBtn}>✕</button>
          </div>

          <div style={styles.modalBody}>
            <div style={styles.twoCol}>
              {/* left */}
              <div>
                <Section title="Personal Info">
                  <Field label="Phone"    value={player.playerPhone} />
                  <Field label="Age"      value={player.Age} />
                  <Field label="Category" value={player.playerCategory || '—'} />
                  <Field label="Pool"     value={player.playerPool ?? '—'} />
                  <Field label="Prev Team" value={player.previousTeam || '—'} />
                </Section>
                <Section title="Playing">
                  <Field label="Type"   value={player.playerType} />
                  <Field label="Styles" value={(player.playingStyle || []).join(', ')} />
                </Section>
                <Section title="Payment">
                  <Field label="Transaction ID" value={player.transactionId} mono />
                  <Field label="Registered"     value={new Date(player.createdAt).toLocaleString('en-IN')} />
                </Section>
              </div>

              {/* right — images */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={styles.imgLabel}>Player Photo</div>
                  {player.playerPhoto?.url
                    ? <img src={player.playerPhoto.url} alt="player"
                        style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, border: '1px solid #E2E8F0' }} />
                    : <div style={styles.imgPlaceholder}>No photo</div>}
                </div>
                <div>
                  <div style={styles.imgLabel}>Payment Screenshot</div>
                  {player.paymentScreenshot?.url
                    ? <img src={player.paymentScreenshot.url} alt="payment"
                        style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                    : <div style={styles.imgPlaceholder}>No screenshot</div>}
                </div>
              </div>
            </div>

            {/* status update */}
            <div style={styles.statusRow}>
              <span style={{ fontWeight: 600, color: '#334155' }}>Update Status:</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => setLocalStatus(s)}
                    style={{
                      ...styles.statusBtn,
                      background: localStatus === s ? STATUS_COLORS[s].bg : '#F1F5F9',
                      color: localStatus === s ? STATUS_COLORS[s].text : '#64748B',
                      border: localStatus === s ? `2px solid ${STATUS_COLORS[s].border}` : '2px solid transparent',
                      fontWeight: localStatus === s ? 700 : 500,
                    }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <button onClick={save} disabled={saving} style={styles.saveBtn}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ─── Render ────────────────────────────────────────────── */
  return (
    <div style={styles.page}>
      {/* Toast */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === 'error' ? '#EF4444' : '#10B981' }}>
          {toast.msg}
        </div>
      )}

      {/* Modal */}
      {selectedPlayer && (
        <PlayerModal player={selectedPlayer} onClose={() => setSelected(null)} />
      )}

      {/* Page header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>🏏 Player Registrations</h1>
          <p style={styles.pageSubtitle}>Manage, review, and export all registered players</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <ExportBtn label="Export Excel" onClick={exportExcel} loading={exporting === 'excel'} icon="📊" color="#16A34A" />
          {/* <ExportBtn label="Export PDF"   onClick={exportPDF}   loading={exporting === 'pdf'}   icon="📄" color="#DC2626" /> */}
        </div>
      </div>

      {/* Stat cards */}
      <div style={styles.statsGrid}>
        {[
          { label: 'Total',    value: stats.total,    color: '#3B82F6', icon: '👥' },
          { label: 'Pending',  value: stats.pending,  color: '#F59E0B', icon: '⏳' },
          { label: 'Approved', value: stats.approved, color: '#10B981', icon: '✅' },
          { label: 'Rejected', value: stats.rejected, color: '#EF4444', icon: '❌' },
        ].map(s => (
          <div key={s.label} style={styles.statCard} onClick={() => { setFStatus(s.label === 'Total' ? '' : s.label.toLowerCase()); setPage(1); }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={styles.filterBar}>
        <input
          placeholder="Search name, phone, transaction…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <select value={filterStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }} style={styles.select}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={filterType} onChange={e => { setFType(e.target.value); setPage(1); }} style={styles.select}>
          <option value="">All Roles</option>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(filterStatus || filterType || search) && (
          <button onClick={() => { setFStatus(''); setFType(''); setSearch(''); setPage(1); }} style={styles.clearBtn}>
            Clear ✕
          </button>
        )}
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <span style={{ color: '#64748B', marginLeft: 12 }}>Loading players…</span>
          </div>
        ) : players.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 40 }}>🏏</div>
            <div style={{ color: '#64748B', marginTop: 8 }}>No players found</div>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['#', 'Player', 'Phone', 'Age', 'Role', 'Playing Style', 'Pool', 'Category', 'Transaction ID', 'Status', 'Registered', 'Actions'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p._id} style={styles.tr} onClick={() => setSelected(p)}>
                  <td style={styles.td}><span style={styles.idNum}>{p.playerID ?? i + 1}</span></td>
                  <td style={{ ...styles.td, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar src={p.playerPhoto?.url} name={p.playerName} size={36} />
                      <span style={{ fontWeight: 600, color: '#0F172A' }}>{p.playerName}</span>
                    </div>
                  </td>
                  <td style={styles.td}>{p.playerPhone}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{p.Age}</td>
                  <td style={styles.td}><span style={styles.chip}>{p.playerType}</span></td>
                  <td style={styles.td}>{(p.playingStyle || []).join(', ')}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{p.playerPool ?? '—'}</td>
                  <td style={styles.td}>{p.playerCategory || '—'}</td>
                  <td style={styles.td}><span style={styles.mono}>{p.transactionId}</span></td>
                  <td style={styles.td}><Badge status={p.status} /></td>
                  <td style={styles.td}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                  <td style={styles.td} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {STATUS_OPTIONS.filter(s => s !== p.status).map(s => (
                        <button key={s} onClick={() => updateStatus(p._id, s)}
                          style={{ ...styles.quickBtn, background: STATUS_COLORS[s].bg, color: STATUS_COLORS[s].text, border: `1px solid ${STATUS_COLORS[s].border}` }}>
                          {s === 'approved' ? '✓' : s === 'rejected' ? '✗' : '⏳'}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={styles.paginationBar}>
          <span style={{ color: '#64748B', fontSize: 13 }}>
            Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, pagination.total)} of {pagination.total}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <PageBtn label="‹ Prev" disabled={!pagination.hasPrev} onClick={() => setPage(p => p - 1)} />
            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
              const p = i + 1;
              return <PageBtn key={p} label={p} active={p === page} onClick={() => setPage(p)} />;
            })}
            <PageBtn label="Next ›" disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── tiny sub-components ───────────────────────────────── */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: '#64748B', minWidth: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function ExportBtn({ label, onClick, loading, icon, color }) {
  return (
    <button onClick={onClick} disabled={!!loading} style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
      borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
      background: color, color: '#fff', fontWeight: 700, fontSize: 13,
      opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
    }}>
      <span>{icon}</span>
      <span>{loading ? 'Exporting…' : label}</span>
    </button>
  );
}

function PageBtn({ label, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minWidth: 34, height: 34, borderRadius: 6, border: '1px solid #E2E8F0',
      background: active ? '#1E3A8A' : disabled ? '#F1F5F9' : '#fff',
      color: active ? '#fff' : disabled ? '#CBD5E1' : '#334155',
      fontWeight: active ? 700 : 500, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      {label}
    </button>
  );
}

/* ─── styles ─────────────────────────────────────────────── */
const styles = {
  page: { background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '28px 32px' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 26, fontWeight: 800, color: '#0F172A', margin: 0 },
  pageSubtitle: { fontSize: 14, color: '#64748B', margin: '4px 0 0' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  statCard: {
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    display: 'flex', alignItems: 'center', gap: 14,
    border: '1px solid #E2E8F0', cursor: 'pointer',
    transition: 'box-shadow 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  filterBar: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  searchInput: {
    flex: '1 1 240px', padding: '9px 14px', borderRadius: 8,
    border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none',
    background: '#fff', color: '#0F172A',
  },
  select: { padding: '9px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, background: '#fff', color: '#334155', cursor: 'pointer' },
  clearBtn: { padding: '9px 14px', borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#EF4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  tableWrap: { background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'auto', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '12px 14px', background: '#F1F5F9', color: '#475569', fontWeight: 700, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' },
  tr: { cursor: 'pointer', transition: 'background 0.15s', ':hover': { background: '#F8FAFC' } },
  td: { padding: '11px 14px', borderBottom: '1px solid #F1F5F9', color: '#334155', verticalAlign: 'middle' },
  idNum: { background: '#EFF6FF', color: '#3B82F6', borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 12 },
  chip: { background: '#F1F5F9', color: '#475569', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 },
  mono: { fontFamily: 'monospace', fontSize: 11, color: '#475569' },
  quickBtn: { padding: '3px 9px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 700 },
  paginationBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' },
  loadingWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: '3px solid #E2E8F0', borderTopColor: '#3B82F6',
    animation: 'spin 0.8s linear infinite',
  },
  emptyState: { textAlign: 'center', padding: 60, fontSize: 15 },
  toast: {
    position: 'fixed', bottom: 24, right: 24, color: '#fff',
    padding: '12px 20px', borderRadius: 10, fontWeight: 600,
    fontSize: 14, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    animation: 'slideIn 0.3s ease',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  },
  modal: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 820, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' },
  modalHeader: { padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  closeBtn: { background: '#F1F5F9', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 14, color: '#64748B', fontWeight: 700 },
  modalBody: { padding: 24, overflowY: 'auto' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 },
  imgLabel: { fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  imgPlaceholder: { height: 100, background: '#F8FAFC', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', border: '1px dashed #CBD5E1' },
  statusRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '16px 0 0', borderTop: '1px solid #F1F5F9' },
  statusBtn: { padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, transition: 'all 0.15s' },
  saveBtn: { marginLeft: 'auto', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
};