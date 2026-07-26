import { useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Download, Megaphone } from 'lucide-react';
import type { ShiftRole, ApprovedSlot } from '../lib/api';

interface ApplicationWithTime {
  id: number;
  user_name: string;
  user_email: string;
  original_start_time: string;
  original_end_time: string;
  start_time: string;
  end_time: string;
  day_status: string;
}

interface Slot {
  start: string;
  end: string;
  name: string;
}

interface DailySchedule {
  date: string;
  displayDate: string;
}

interface ShiftGridViewProps {
  mode: 'wish' | 'result';
  dailySchedules: DailySchedule[];
  dateApplications: { [date: string]: ApplicationWithTime[] };
  groupMembers: { user_email: string; user_name: string }[];
  customBreakpoints: Slot[];
  shiftStartTime: string;
  shiftEndTime: string;
  hiddenDayApps?: { appId: number; date: string }[];
  isAdmin?: boolean;
  publishedDates?: string[];
  approvedSlotsMap?: { [email: string]: { [date: string]: ApprovedSlot[] } };
  wishTimesMap?: { [email: string]: { [date: string]: { start: string; end: string } } };
  roles?: ShiftRole[];
  onApproveSlot?: (appId: number, date: string, startTime: string, endTime: string, slots?: ApprovedSlot[]) => Promise<void>;
  onUnapproveSlot?: (appId: number, date: string, slotStart?: string, slotEnd?: string) => Promise<void>;
  onToggleDatePublish?: (date: string) => void;
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function overlaps(appStart: string, appEnd: string, slotStart: string, slotEnd: string) {
  return toMinutes(appStart) < toMinutes(slotEnd) && toMinutes(appEnd) > toMinutes(slotStart);
}

export function ShiftGridView({
  mode,
  dailySchedules,
  dateApplications,
  groupMembers,
  customBreakpoints,
  shiftStartTime,
  shiftEndTime,
  hiddenDayApps = [],
  isAdmin = false,
  publishedDates = [],
  approvedSlotsMap = {},
  wishTimesMap = {},
  roles = [],
  onApproveSlot,
  onUnapproveSlot,
  onToggleDatePublish,
}: ShiftGridViewProps) {
  // 採用済みセルのポップオーバー（ロール変更・取り消し用）
  const [rolePopover, setRolePopover] = useState<{
    appId: number; date: string; memberName: string;
    slotStart: string; slotEnd: string;
    currentRoleId?: string;
    x: number; y: number;
  } | null>(null);
  const [approving, setApproving] = useState(false);
  // 非表示の応募を除外したデータ
  const filteredDateApplications = useMemo(() => {
    const result: { [date: string]: ApplicationWithTime[] } = {};
    Object.entries(dateApplications).forEach(([date, apps]) => {
      result[date] = apps.filter(app => !hiddenDayApps.some(h => h.appId === app.id && h.date === date));
    });
    return result;
  }, [dateApplications, hiddenDayApps]);
  const slots: Slot[] = customBreakpoints.length > 0
    ? [...customBreakpoints].sort((a, b) => a.start.localeCompare(b.start))
    : [{ start: shiftStartTime.slice(0, 5), end: shiftEndTime.slice(0, 5), name: '' }];

  // 応募している全メンバーを抽出（グループメンバー + 応募者）
  const allApplicantEmails = useMemo(() => {
    const emails = new Set<string>();
    Object.values(filteredDateApplications).forEach(apps =>
      apps.forEach(app => emails.add(app.user_email))
    );
    return emails;
  }, [filteredDateApplications]);

  const members = useMemo(() => {
    const seen = new Set<string>();
    const result: { user_email: string; user_name: string }[] = [];
    groupMembers.forEach(m => {
      if (allApplicantEmails.has(m.user_email)) {
        seen.add(m.user_email);
        result.push(m);
      }
    });
    Object.values(filteredDateApplications).forEach(apps =>
      apps.forEach(app => {
        if (!seen.has(app.user_email)) {
          seen.add(app.user_email);
          result.push({ user_email: app.user_email, user_name: app.user_name });
        }
      })
    );
    return result;
  }, [groupMembers, filteredDateApplications, allApplicantEmails]);

  if (dailySchedules.length === 0 || members.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">応募データがありません</div>
    );
  }

  // スロットごとの応募人数・採用人数を集計
  const wishCounts: { [dateSlot: string]: number } = {};
  const resultCounts: { [dateSlot: string]: number } = {};
  dailySchedules.forEach(({ date }) => {
    const apps = filteredDateApplications[date] || [];
    slots.forEach(slot => {
      const key = `${date}__${slot.name || slot.start}`;
      wishCounts[key] = apps.filter(app => {
        const wt = wishTimesMap[app.user_email]?.[date] ?? { start: app.original_start_time, end: app.original_end_time };
        return overlaps(wt.start, wt.end, slot.start, slot.end);
      }).length;
      resultCounts[key] = apps.filter(app =>
        (app.day_status === 'approved' || app.day_status === 'direct_approved') &&
        overlaps(app.start_time, app.end_time, slot.start, slot.end)
      ).length;
    });
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');

      // --- サイズ定義（px、canvas は 2x で描画） ---
      const SCALE = 2;
      const CELL_W = 22;   // データセルは記号のみなので細く
      const CELL_H = 22;   // 行の高さ
      const NAME_W = 100;  // 名前列の幅
      const FONT = 10;
      const HEADER_ROWS = slots.length > 1 ? 2 : 1;
      const FOOTER_ROWS = mode === 'result' ? 2 : 1;
      const rows = members.length;

      // A3横向き: 420 x 297 mm（A4の2倍幅で枚数を抑える）
      const PX_TO_MM = 0.2646;
      const PAGE_W_MM = 420;
      const PAGE_H_MM = 297;
      const MARGIN_MM = 8;
      const AVAIL_W_MM = PAGE_W_MM - MARGIN_MM * 2;
      const AVAIL_H_MM = PAGE_H_MM - MARGIN_MM * 2;

      // 1ページに収まる日付数を計算
      const nameMM = NAME_W * PX_TO_MM;
      const cellMM = CELL_W * slots.length * PX_TO_MM;
      const datesPerPage = Math.max(1, Math.floor((AVAIL_W_MM - nameMM) / cellMM));

      // ページに収まるよう行を縦方向にスケーリング
      const totalRowsPx = (HEADER_ROWS + rows + FOOTER_ROWS) * CELL_H;
      const totalRowsMM = totalRowsPx * PX_TO_MM;
      const rowScale = totalRowsMM > AVAIL_H_MM ? AVAIL_H_MM / totalRowsMM : 1;

      // 日付をチャンクに分割
      const chunks: typeof dailySchedules[] = [];
      for (let i = 0; i < dailySchedules.length; i += datesPerPage) {
        chunks.push(dailySchedules.slice(i, i + datesPerPage));
      }

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      const label = mode === 'result' ? '採用結果一覧' : '希望一覧';

      const renderChunk = (chunk: typeof dailySchedules) => {
        const chunkCols = chunk.length * slots.length;
        const cW = NAME_W + chunkCols * CELL_W;
        const cH = (HEADER_ROWS + rows + FOOTER_ROWS) * CELL_H;

        const canvas = document.createElement('canvas');
        canvas.width = cW * SCALE;
        canvas.height = cH * SCALE;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(SCALE, SCALE);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cW, cH);

        const drawCell = (
          x: number, y: number, w: number, h: number,
          bg: string, text: string, textColor = '#111111', bold = false
        ) => {
          ctx.fillStyle = bg;
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = '#6b7280';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
          if (text) {
            ctx.fillStyle = textColor;
            ctx.font = `${bold ? 'bold ' : ''}${FONT}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x + w / 2, y + h / 2, w - 4);
          }
        };

        // ヘッダー: 名前列
        drawCell(0, 0, NAME_W, CELL_H * HEADER_ROWS, '#f3f4f6', '名前', '#111111', true);

        // ヘッダー: 日付列
        chunk.forEach(({ date, displayDate }, di) => {
          const x = NAME_W + di * slots.length * CELL_W;
          const d = new Date(date + 'T00:00:00');
          const dow = ['日','月','火','水','木','金','土'][d.getDay()];
          const isSun = d.getDay() === 0;
          const isSat = d.getDay() === 6;
          const bg = isSun ? '#fef2f2' : isSat ? '#eff6ff' : '#f9fafb';
          const tc = isSun ? '#dc2626' : isSat ? '#2563eb' : '#111111';
          const dateLabel = (displayDate ?? date).replace(/\d{4}\//, '').replace(/\(.+\)/, '') + ' ' + dow;
          drawCell(x, 0, slots.length * CELL_W, CELL_H, bg, dateLabel, tc, true);
          if (slots.length > 1) {
            slots.forEach((slot, si) => {
              drawCell(x + si * CELL_W, CELL_H, CELL_W, CELL_H, '#faf5ff', slot.name || slot.start, '#7e22ce', true);
            });
          }
        });

        // データ行
        members.forEach((member, mi) => {
          const y = HEADER_ROWS * CELL_H + mi * CELL_H;
          const rowBg = mi % 2 === 0 ? '#ffffff' : '#f9fafb';
          drawCell(0, y, NAME_W, CELL_H, rowBg, member.user_name, '#111111');
          chunk.forEach(({ date }, di) => {
            const apps = filteredDateApplications[date] || [];
            const app = apps.find(a => a.user_email === member.user_email);
            slots.forEach((slot, si) => {
              const x = NAME_W + (di * slots.length + si) * CELL_W;
              let bg = '#d1d5db';
              let text = '';
              if (app) {
                const wt = wishTimesMap[app.user_email]?.[date] ?? { start: app.original_start_time, end: app.original_end_time };
                const wished = overlaps(wt.start, wt.end, slot.start, slot.end);
                if (wished) {
                  bg = '#ffffff';
                  text = '○';
                  if (
                    mode === 'result' &&
                    (app.day_status === 'approved' || app.day_status === 'direct_approved') &&
                    overlaps(app.start_time, app.end_time, slot.start, slot.end)
                  ) {
                    bg = '#4ade80';
                    text = '●';
                  }
                }
              }
              drawCell(x, y, CELL_W, CELL_H, bg, text, bg === '#4ade80' ? '#ffffff' : '#6b7280');
            });
          });
        });

        // フッター: 応募人数
        const footerY = (HEADER_ROWS + rows) * CELL_H;
        drawCell(0, footerY, NAME_W, CELL_H, '#fff7ed', '応募人数', '#9a3412', true);
        chunk.forEach(({ date }, di) => {
          slots.forEach((slot, si) => {
            const x = NAME_W + (di * slots.length + si) * CELL_W;
            const count = wishCounts[`${date}__${slot.name || slot.start}`] ?? 0;
            drawCell(x, footerY, CELL_W, CELL_H, '#fff7ed', String(count), '#9a3412', true);
          });
        });

        // フッター: 採用人数
        if (mode === 'result') {
          const resultY = footerY + CELL_H;
          drawCell(0, resultY, NAME_W, CELL_H, '#eff6ff', '採用人数', '#1e40af', true);
          chunk.forEach(({ date }, di) => {
            slots.forEach((slot, si) => {
              const x = NAME_W + (di * slots.length + si) * CELL_W;
              const count = resultCounts[`${date}__${slot.name || slot.start}`] ?? 0;
              const bg = count === 0 ? '#fee2e2' : '#eff6ff';
              const tc = count === 0 ? '#b91c1c' : '#1e40af';
              drawCell(x, resultY, CELL_W, CELL_H, bg, String(count), tc, true);
            });
          });
        }

        return canvas;
      };

      chunks.forEach((chunk, ci) => {
        if (ci > 0) pdf.addPage();
        const canvas = renderChunk(chunk);
        const imgData = canvas.toDataURL('image/png');
        const pdfW = Math.min((canvas.width / SCALE) * PX_TO_MM, AVAIL_W_MM);
        const pdfH = Math.min((canvas.height / SCALE) * PX_TO_MM * rowScale, AVAIL_H_MM);
        pdf.addImage(imgData, 'PNG', MARGIN_MM, MARGIN_MM, pdfW, pdfH);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`${label}　${ci + 1} / ${chunks.length} ページ`, MARGIN_MM, PAGE_H_MM - 4);
      });

      pdf.save(`${label}.pdf`);
    } catch (e) {
      console.error('PDF export error:', e);
    } finally {
      setExporting(false);
    }
  };

  // 即時採用（クリック1回で確定）
  const handleInstantApprove = async (
    appId: number, date: string,
    slotStart: string, slotEnd: string,
    existKvSlots: ApprovedSlot[],
    roleId?: string
  ) => {
    if (!onApproveSlot) return;
    setApproving(true);
    try {
      const newSlot: ApprovedSlot = { start: slotStart, end: slotEnd, ...(roleId ? { roleId } : {}) };
      let finalSlots: ApprovedSlot[];
      // 既存スロットと重複するものがあれば置き換え、なければ追加（マージしない）
      const overlapIdx = existKvSlots.findIndex(ks => overlaps(ks.start, ks.end, slotStart, slotEnd));
      if (overlapIdx >= 0) {
        finalSlots = existKvSlots.map((ks, i) => i === overlapIdx ? newSlot : ks);
      } else {
        finalSlots = [...existKvSlots, newSlot].sort((a, b) => a.start.localeCompare(b.start));
      }
      await onApproveSlot(appId, date, finalSlots[0].start, finalSlots[finalSlots.length - 1].end, finalSlots);
    } finally {
      setApproving(false);
    }
  };

  // 採用取り消し（該当スロットのみ）
  const handleInstantUnapprove = async (appId: number, date: string, slotStart?: string, slotEnd?: string) => {
    if (!onUnapproveSlot) return;
    setApproving(true);
    try {
      await onUnapproveSlot(appId, date, slotStart, slotEnd);
      setRolePopover(null);
    } finally {
      setApproving(false);
    }
  };

  // ポップオーバーでロール変更（採用済みセルのロールだけ更新）
  const handleChangeRole = async (roleId: string | undefined) => {
    if (!rolePopover || !onApproveSlot) return;
    const { appId, date, slotStart, slotEnd } = rolePopover;
    // appIdからemailを特定
    const memberEmail = Object.values(dateApplications).flat().find(a => a.id === appId)?.user_email
      ?? Object.keys(approvedSlotsMap).find(e => approvedSlotsMap[e]?.[date]) ?? '';
    const existKvSlots = approvedSlotsMap[memberEmail]?.[date] ?? [];
    // 該当スロットのroleIdだけ更新
    const updated: ApprovedSlot[] = existKvSlots.length > 0
      ? existKvSlots.map(s => overlaps(s.start, s.end, slotStart, slotEnd) ? { ...s, roleId } : s)
      : [{ start: slotStart, end: slotEnd, roleId }];
    setApproving(true);
    try {
      await onApproveSlot(appId, date, updated[0].start, updated[updated.length - 1].end, updated);
      setRolePopover(null);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button size="sm" variant="outline" onClick={handleExportPDF} disabled={exporting}>
          <Download className="h-4 w-4 mr-1" />
          {exporting ? 'PDF生成中...' : 'PDFダウンロード'}
        </Button>
      </div>
      <div className="overflow-x-auto" ref={tableRef}>
      <table className="border-collapse text-xs min-w-max">
        <thead>
          {/* 日付行 */}
          <tr>
            <th className="sticky left-0 z-20 bg-gray-100 border border-gray-400 px-3 py-2 text-left min-w-[120px]">
              名前
            </th>
            {dailySchedules.map(({ date, displayDate }) => {
              const dayOfWeek = DAY_NAMES[new Date(date + 'T00:00:00').getDay()];
              const isSun = new Date(date + 'T00:00:00').getDay() === 0;
              const isSat = new Date(date + 'T00:00:00').getDay() === 6;
              return (
                <th
                  key={date}
                  colSpan={slots.length}
                  className={`border border-gray-400 px-2 py-1 text-center font-medium ${
                    isSun ? 'text-red-600 bg-red-50' : isSat ? 'text-blue-600 bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <div>{(displayDate ?? date).replace(/\d{4}\//, '').replace(/\(.+\)/, '')}</div>
                  <div className="font-normal">{dayOfWeek}</div>
                  {isAdmin && onToggleDatePublish && (
                    <button
                      onClick={() => onToggleDatePublish(date)}
                      className={`mt-1 text-xs px-1.5 py-0.5 rounded border whitespace-nowrap ${
                        publishedDates.includes(date)
                          ? 'bg-green-100 text-green-700 border-green-400'
                          : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {publishedDates.includes(date) ? '発表済み' : '発表'}
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
          {/* スロット名行 */}
          {slots.length > 1 && (
            <tr>
              <th className="sticky left-0 z-20 bg-gray-100 border border-gray-400 px-3 py-1" />
              {dailySchedules.map(({ date }) =>
                slots.map((slot, slotIndex) => (
                  <th
                    key={`head-${date}-${slotIndex}-${slot.name || slot.start}`}
                    className="border border-gray-400 px-1 py-1 text-center bg-purple-50 text-purple-700 font-medium min-w-[36px]"
                    title={`${slot.start}〜${slot.end}`}
                  >
                    {slot.name || slot.start.slice(0, 5)}
                  </th>
                ))
              )}
            </tr>
          )}
        </thead>

        <tbody>
          {members.map(member => (
            <tr key={member.user_email} className="hover:bg-gray-50">
              <td className="sticky left-0 z-10 bg-white border border-gray-400 px-3 py-1 font-medium whitespace-nowrap">
                {member.user_name}
              </td>
              {dailySchedules.map(({ date }) => {
                const apps = filteredDateApplications[date] || [];
                const app = apps.find(a => a.user_email === member.user_email);
                // KVに保存されたスロット一覧（グリッドから採用した場合）
                const kvSlots = approvedSlotsMap[member.user_email]?.[date];

                return slots.map((slot, slotIndex) => {
                  let cellState: 'none' | 'wish' | 'approved' = 'none';
                  if (app) {
                    const isApprovedStatus = app.day_status === 'approved' || app.day_status === 'direct_approved';
                    const wt = wishTimesMap[app.user_email]?.[date] ?? { start: app.original_start_time, end: app.original_end_time };
                    const wishOverlap = overlaps(wt.start, wt.end, slot.start, slot.end);
                    if (wishOverlap) {
                      cellState = 'wish';
                      if (isApprovedStatus) {
                        // KVスロットがあればそちらで判定（分割採用に対応）
                        if (kvSlots && kvSlots.length > 0) {
                          if (kvSlots.some(ks => overlaps(ks.start, ks.end, slot.start, slot.end))) {
                            cellState = 'approved';
                          }
                        } else if (overlaps(app.start_time, app.end_time, slot.start, slot.end)) {
                          cellState = 'approved';
                        }
                      }
                    }
                  }

                  const isClickable = isAdmin && onApproveSlot && app && (cellState === 'wish' || cellState === 'approved');

                  // 採用済みセルのロール色を取得
                  const matchingKvSlot = cellState === 'approved' && kvSlots
                    ? kvSlots.find(ks => overlaps(ks.start, ks.end, slot.start, slot.end))
                    : undefined;
                  const cellRole = matchingKvSlot?.roleId ? roles.find(r => r.id === matchingKvSlot.roleId) : undefined;

                  const bgClass =
                    cellState === 'approved' && !cellRole
                      ? 'bg-green-400'
                      : cellState === 'wish'
                      ? 'bg-white'
                      : cellState === 'none'
                      ? 'bg-gray-300'
                      : '';
                  const bgStyle = cellState === 'approved' && cellRole
                    ? { backgroundColor: cellRole.color }
                    : {};

                  const handleClick = (e: React.MouseEvent) => {
                    if (!isClickable || !app || approving) return;
                    if (cellState === 'approved') {
                      // 採用済み → ポップオーバー表示（ロール変更・取り消し）
                      setRolePopover({
                        appId: app.id, date, memberName: app.user_name,
                        slotStart: slot.start, slotEnd: slot.end,
                        currentRoleId: matchingKvSlot?.roleId,
                        x: e.clientX, y: e.clientY,
                      });
                      return;
                    }
                    // 希望あり → 即時採用
                    const existKvSlots = kvSlots ?? [];
                    handleInstantApprove(app.id, date, slot.start, slot.end, existKvSlots);
                  };

                  return (
                    <td
                      key={`body-${date}-${slotIndex}-${slot.name || slot.start}`}
                      className={`border border-gray-400 text-center min-w-[36px] h-8 ${bgClass} ${isClickable ? 'cursor-pointer hover:opacity-70' : ''}`}
                      style={bgStyle}
                      title={
                        cellState === 'approved'
                          ? `採用済み${cellRole ? `（${cellRole.name}）` : ''}: ${app!.start_time.slice(0,5)}〜${app!.end_time.slice(0,5)}${isClickable ? '（クリックで取り消し）' : ''}`
                          : cellState === 'wish'
                          ? `希望: ${(wishTimesMap[app!.user_email]?.[date]?.start ?? app!.original_start_time).slice(0,5)}〜${(wishTimesMap[app!.user_email]?.[date]?.end ?? app!.original_end_time).slice(0,5)}${isClickable ? '（クリックで採用）' : ''}`
                          : ''
                      }
                      onClick={handleClick}
                    >
                      {cellState !== 'none' && (
                        <span className={`text-xs leading-none ${cellState === 'approved' ? 'text-white' : 'text-gray-600'}`}>
                          {cellState === 'approved' ? (cellRole ? '★' : '●') : '○'}
                        </span>
                      )}
                    </td>
                  );
                });
              })}
            </tr>
          ))}
        </tbody>

        {/* フッター: 応募人数・採用人数 */}
        <tfoot>
          {/* 応募人数 */}
          <tr>
            <td className="sticky left-0 z-10 bg-orange-50 border border-gray-400 px-3 py-1 font-medium text-orange-800 whitespace-nowrap">
              応募人数
            </td>
            {dailySchedules.map(({ date }) =>
              slots.map((slot, slotIndex) => {
                const count = wishCounts[`${date}__${slot.name || slot.start}`] ?? 0;
                return (
                  <td
                    key={`${date}-${slotIndex}-${slot.name || slot.start}-wish`}
                    className="border border-gray-400 text-center font-bold py-1 bg-orange-50 text-orange-800"
                  >
                    {count}
                  </td>
                );
              })
            )}
          </tr>
          {/* 採用人数（採用結果モードのみ） */}
          {mode === 'result' && (
            <tr>
              <td className="sticky left-0 z-10 bg-blue-50 border border-gray-400 px-3 py-1 font-medium text-blue-800 whitespace-nowrap">
                採用人数
              </td>
              {dailySchedules.map(({ date }) =>
                slots.map((slot, slotIndex) => {
                  const count = resultCounts[`${date}__${slot.name || slot.start}`] ?? 0;
                  return (
                    <td
                      key={`${date}-${slotIndex}-${slot.name || slot.start}-result`}
                      className={`border border-gray-400 text-center font-bold py-1 ${
                        count === 0 ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-800'
                      }`}
                    >
                      {count}
                    </td>
                  );
                })
              )}
            </tr>
          )}
        </tfoot>
      </table>

      {/* 凡例 */}
      <div className="flex gap-4 mt-3 text-xs text-gray-600 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 border border-gray-400 bg-white rounded flex items-center justify-center">○</div>
          <span>希望あり</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 border border-gray-400 bg-green-400 rounded flex items-center justify-center text-white">●</div>
          <span>採用済み{isAdmin && onApproveSlot ? '（クリックでロール変更・取り消し）' : ''}</span>
        </div>
        {isAdmin && onApproveSlot && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 border border-gray-400 bg-white rounded flex items-center justify-center text-gray-600">○</div>
            <span>希望あり（クリックで即採用）</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 border border-gray-400 bg-gray-300 rounded" />
          <span>希望なし</span>
        </div>
      </div>

      {/* ロール凡例 */}
      {roles.length > 0 && (
        <div className="flex gap-3 mt-2 text-xs text-gray-500 flex-wrap items-center">
          <span className="text-gray-400">採用内容:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-400" />
            <span>通常</span>
          </div>
          {roles.map(role => (
            <div key={role.id} className="flex items-center gap-1">
              <div className="w-4 h-4 rounded flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: role.color }}>★</div>
              <span>{role.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* スロット凡例 */}
      {slots.some(s => s.name) && (
        <div className="flex gap-3 mt-2 text-xs text-gray-500 flex-wrap">
          {slots.filter(s => s.name).map((s, i) => (
            <span key={`${i}-${s.name}`}><strong>{s.name}</strong>: {s.start}〜{s.end}</span>
          ))}
        </div>
      )}
      </div>

      {/* 採用済みセルのポップオーバー（ロール変更・取り消し） */}
      {rolePopover && (
        <div className="fixed inset-0 z-50" onClick={() => setRolePopover(null)}>
          <div
            className="absolute bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[180px]"
            style={{ left: Math.min(rolePopover.x, window.innerWidth - 200), top: Math.min(rolePopover.y, window.innerHeight - 200) }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-xs font-medium text-gray-700 mb-2">
              {rolePopover.memberName} — {rolePopover.slotStart}〜{rolePopover.slotEnd}
            </div>
            {roles.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-gray-400 mb-1.5">採用内容を変更</div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleChangeRole(undefined)}
                    disabled={approving}
                    className={`text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 ${!rolePopover.currentRoleId ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
                  >
                    <span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> 通常
                  </button>
                  {roles.map(role => (
                    <button
                      key={role.id}
                      onClick={() => handleChangeRole(role.id)}
                      disabled={approving}
                      className={`text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 ${rolePopover.currentRoleId === role.id ? 'font-medium' : 'hover:bg-gray-50'}`}
                    >
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: role.color }} /> {role.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => handleInstantUnapprove(rolePopover.appId, rolePopover.date, rolePopover.slotStart, rolePopover.slotEnd)}
              disabled={approving}
              className="w-full text-left px-2 py-1 rounded text-xs text-red-600 hover:bg-red-50 border-t border-gray-100 mt-1 pt-2"
            >
              {approving ? '処理中...' : '✕ 採用を取り消す'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
