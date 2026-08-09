import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Download, Megaphone } from 'lucide-react';
import type { ShiftRole, ApprovedSlot } from '../lib/api';

type ExcelCellValue = string | number;
type ExcelCell = { value: ExcelCellValue; styleId?: number };
type BorderVariant = 'grid' | 'left' | 'right' | 'both';

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

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getExcelColumnName(index: number) {
  let current = index;
  let result = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function normalizeHexColor(color: string) {
  const normalized = color.replace('#', '').trim();
  if (normalized.length === 3) {
    return normalized.split('').map((char) => char + char).join('').toUpperCase();
  }
  return normalized.padStart(6, '0').slice(0, 6).toUpperCase();
}

function getBorderVariant(slotIndex: number, totalSlots: number): BorderVariant {
  const isFirst = slotIndex === 0;
  const isLast = slotIndex === totalSlots - 1;
  if (isFirst && isLast) return 'both';
  if (isFirst) return 'left';
  if (isLast) return 'right';
  return 'grid';
}

function buildStylesXml(roleColors: string[]) {
  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFEF2F2"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFAF5FF"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF7ED"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFBEB"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>',
  ];

  roleColors.forEach((color) => {
    fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="FF${normalizeHexColor(color)}"/><bgColor indexed="64"/></patternFill></fill>`);
  });

  const borders = [
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left style="thin"><color rgb="FF6B7280"/></left><right style="thin"><color rgb="FF6B7280"/></right><top style="thin"><color rgb="FF6B7280"/></top><bottom style="thin"><color rgb="FF6B7280"/></bottom><diagonal/></border>',
    '<border><left style="medium"><color rgb="FF374151"/></left><right style="thin"><color rgb="FF6B7280"/></right><top style="thin"><color rgb="FF6B7280"/></top><bottom style="thin"><color rgb="FF6B7280"/></bottom><diagonal/></border>',
    '<border><left style="thin"><color rgb="FF6B7280"/></left><right style="medium"><color rgb="FF374151"/></right><top style="thin"><color rgb="FF6B7280"/></top><bottom style="thin"><color rgb="FF6B7280"/></bottom><diagonal/></border>',
    '<border><left style="medium"><color rgb="FF374151"/></left><right style="medium"><color rgb="FF374151"/></right><top style="thin"><color rgb="FF6B7280"/></top><bottom style="thin"><color rgb="FF6B7280"/></bottom><diagonal/></border>',
  ];

  const alignCenter = 'applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/>';
  const borderIds: Record<BorderVariant, number> = {
    grid: 1,
    left: 2,
    right: 3,
    both: 4,
  };

  const cellXfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  ];

  const styleIds: Record<string, Record<BorderVariant, number>> = {};
  const registerStyle = (name: string, fillId: number) => {
    styleIds[name] = { grid: 0, left: 0, right: 0, both: 0 };
    (Object.keys(borderIds) as BorderVariant[]).forEach((variant) => {
      const styleId = cellXfs.length;
      styleIds[name][variant] = styleId;
      cellXfs.push(`<xf numFmtId="0" fontId="0" fillId="${fillId}" borderId="${borderIds[variant]}" xfId="0" applyFill="1" applyBorder="1" ${alignCenter}</xf>`);
    });
  };

  registerStyle('headerWeekday', 2);
  registerStyle('headerSunday', 3);
  registerStyle('headerSaturday', 4);
  registerStyle('slotHeader', 5);
  registerStyle('footerWish', 6);
  registerStyle('footerResult', 7);
  registerStyle('wishCell', 8);
  registerStyle('emptyCell', 9);
  registerStyle('approvedCell', 10);

  const roleStyleIds: Record<string, Record<BorderVariant, number>> = {};
  roleColors.forEach((color, index) => {
    const styleKey = `role:${color}`;
    registerStyle(styleKey, 11 + index);
    roleStyleIds[color] = styleIds[styleKey];
  });

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="${fills.length}">${fills.join('')}</fills>
  <borders count="${borders.length}">${borders.join('')}</borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="${cellXfs.length}">${cellXfs.join('')}</cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  return { xml, roleStyleIds, styleIds };
}

function buildWorksheetXml(rows: ExcelCell[][], merges: string[] = []) {
  const lastColumn = getExcelColumnName(Math.max(...rows.map((row) => Math.max(row.length, 1))));
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, cellIndex) => {
      const ref = `${getExcelColumnName(cellIndex + 1)}${rowIndex + 1}`;
      const styleAttr = value.styleId !== undefined ? ` s="${value.styleId}"` : '';
      if (typeof value.value === 'number') {
        return `<c r="${ref}"${styleAttr}><v>${value.value}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${escapeXml(String(value.value))}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  const mergeXml = merges.length > 0
    ? `<mergeCells count="${merges.length}">${merges.map((merge) => `<mergeCell ref="${merge}"/>`).join('')}</mergeCells>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${rows.length}"/>
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="18" customWidth="1"/>
    <col min="2" max="${Math.max(...rows.map((row) => row.length), 2)}" width="10" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
  ${mergeXml}
</worksheet>`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
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
    slotKey?: string;
    currentRoleId?: string;
    x: number; y: number;
  } | null>(null);
  const [approving, setApproving] = useState(false);
  const [orderedMembers, setOrderedMembers] = useState<{ user_email: string; user_name: string }[]>([]);
  const [draggingEmail, setDraggingEmail] = useState<string | null>(null);
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
  const displaySlotLabel = (slot: Slot) => slot.name || `${slot.start.slice(0, 5)}-${slot.end.slice(0, 5)}`;

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
    Object.values(filteredDateApplications).forEach(apps => {
      apps.forEach(app => {
        if (!seen.has(app.user_email)) {
          seen.add(app.user_email);
          result.push({ user_email: app.user_email, user_name: app.user_name });
        }
      });
    });
    return result;
  }, [groupMembers, filteredDateApplications, allApplicantEmails]);

  useEffect(() => {
    setOrderedMembers((current) => {
      const currentOrder = current.filter((member) => members.some((item) => item.user_email === member.user_email));
      const missing = members.filter((member) => !currentOrder.some((item) => item.user_email === member.user_email));
      return [...currentOrder, ...missing];
    });
  }, [members]);

  const displayMembers = orderedMembers.length > 0 ? orderedMembers : members;

  const moveMember = (fromEmail: string, toEmail: string) => {
    if (fromEmail === toEmail) return;
    setOrderedMembers((current) => {
      const sourceIndex = current.findIndex((member) => member.user_email === fromEmail);
      const targetIndex = current.findIndex((member) => member.user_email === toEmail);
      if (sourceIndex === -1 || targetIndex === -1) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  if (dailySchedules.length === 0 || displayMembers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">応募データがありません</div>
    );
  }

  // スロットごとの勤務可能人数・採用人数を集計
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
      resultCounts[key] = apps.filter(app => {
        const kvSlots = approvedSlotsMap[app.user_email]?.[date];
        if (kvSlots && kvSlots.length > 0) {
          return kvSlots.some(ks => overlaps(ks.start, ks.end, slot.start, slot.end));
        }
        return (app.day_status === 'approved' || app.day_status === 'direct_approved') &&
          overlaps(app.start_time, app.end_time, slot.start, slot.end);
      }).length;
    });
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleExportPDF = async () => {
    setExportingPdf(true);
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
        displayMembers.forEach((member, mi) => {
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
                    ((approvedSlotsMap[app.user_email]?.[date]?.length > 0 && approvedSlotsMap[app.user_email][date].some(ks => overlaps(ks.start, ks.end, slot.start, slot.end))) ||
                      ((app.day_status === 'approved' || app.day_status === 'direct_approved') && overlaps(app.start_time, app.end_time, slot.start, slot.end)))
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

        // フッター: 勤務可能人数
        const footerY = (HEADER_ROWS + rows) * CELL_H;
        drawCell(0, footerY, NAME_W, CELL_H, '#fff7ed', '勤務可能人数', '#9a3412', true);
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
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const { zipSync, strToU8 } = await import('fflate');
      const label = mode === 'result' ? '採用結果一覧' : '勤務可能一覧';
      const { xml: stylesXml, roleStyleIds, styleIds } = buildStylesXml(roles.map((role) => role.color));
      const headerTopRow: ExcelCell[] = [{ value: '名前', styleId: styleIds.headerWeekday.both }];
      const headerBottomRow: ExcelCell[] = [{ value: '', styleId: styleIds.headerWeekday.both }];
      const merges: string[] = ['A1:A2'];

      let currentColumn = 2;
      dailySchedules.forEach(({ date, displayDate }) => {
        const currentDate = new Date(date + 'T00:00:00');
        const dayOfWeek = DAY_NAMES[currentDate.getDay()];
        const dayStyleName = currentDate.getDay() === 0
          ? 'headerSunday'
          : currentDate.getDay() === 6
          ? 'headerSaturday'
          : 'headerWeekday';
        const topLabel = `${(displayDate ?? date).replace(/\d{4}\//, '').replace(/\(.+\)/, '')}\n${dayOfWeek}`;
        slots.forEach((_, slotIndex) => {
          const borderVariant = getBorderVariant(slotIndex, slots.length);
          headerTopRow.push({
            value: slotIndex === 0 ? topLabel : '',
            styleId: styleIds[dayStyleName][borderVariant],
          });
          headerBottomRow.push({
            value: displaySlotLabel(slots[slotIndex]),
            styleId: styleIds.slotHeader[borderVariant],
          });
        });

        if (slots.length > 1) {
          merges.push(`${getExcelColumnName(currentColumn)}1:${getExcelColumnName(currentColumn + slots.length - 1)}1`);
        }
        currentColumn += slots.length;
      });

      const rows: ExcelCell[][] = [headerTopRow, headerBottomRow];

      displayMembers.forEach((member) => {
        const row: ExcelCell[] = [{ value: member.user_name, styleId: styleIds.headerWeekday.grid }];

        dailySchedules.forEach(({ date }) => {
          const apps = filteredDateApplications[date] || [];
          const app = apps.find((item) => item.user_email === member.user_email);
          const kvSlots = approvedSlotsMap[member.user_email]?.[date];

          slots.forEach((slot) => {
            const borderVariant = getBorderVariant(slots.indexOf(slot), slots.length);
            let styleId = styleIds.emptyCell[borderVariant];
            if (app) {
              const wt = wishTimesMap[app.user_email]?.[date] ?? { start: app.original_start_time, end: app.original_end_time };
              const wishOverlap = overlaps(wt.start, wt.end, slot.start, slot.end);
              if (wishOverlap) {
                styleId = styleIds.wishCell[borderVariant];
                if (
                  mode === 'result' &&
                  ((kvSlots && kvSlots.some((item) => overlaps(item.start, item.end, slot.start, slot.end))) ||
                    ((app.day_status === 'approved' || app.day_status === 'direct_approved') && overlaps(app.start_time, app.end_time, slot.start, slot.end)))
                ) {
                  const matchingKvSlot = kvSlots?.find((item) => overlaps(item.start, item.end, slot.start, slot.end));
                  const cellRole = matchingKvSlot?.roleId ? roles.find((role) => role.id === matchingKvSlot.roleId) : undefined;
                  styleId = cellRole
                    ? roleStyleIds[cellRole.color]?.[borderVariant] ?? styleIds.approvedCell[borderVariant]
                    : styleIds.approvedCell[borderVariant];
                }
              }
            }
            row.push({ value: '', styleId });
          });
        });

        rows.push(row);
      });

      const availableCountsRow: ExcelCell[] = [{ value: '勤務可能人数', styleId: styleIds.footerWish.grid }];
      dailySchedules.forEach(({ date }) => {
        slots.forEach((slot, slotIndex) => {
          const borderVariant = getBorderVariant(slotIndex, slots.length);
          availableCountsRow.push({
            value: wishCounts[`${date}__${slot.name || slot.start}`] ?? 0,
            styleId: styleIds.footerWish[borderVariant],
          });
        });
      });
      rows.push(availableCountsRow);

      if (mode === 'result') {
        const approvedCountsRow: ExcelCell[] = [{ value: '採用人数', styleId: styleIds.footerResult.grid }];
        dailySchedules.forEach(({ date }) => {
          slots.forEach((slot, slotIndex) => {
            const borderVariant = getBorderVariant(slotIndex, slots.length);
            approvedCountsRow.push({
              value: resultCounts[`${date}__${slot.name || slot.start}`] ?? 0,
              styleId: styleIds.footerResult[borderVariant],
            });
          });
        });
        rows.push(approvedCountsRow);
      }

      const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(label)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

      const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

      const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

      const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

      const workbook = zipSync({
        '[Content_Types].xml': strToU8(contentTypesXml),
        '_rels/.rels': strToU8(rootRelsXml),
        'xl/workbook.xml': strToU8(workbookXml),
        'xl/_rels/workbook.xml.rels': strToU8(workbookRelsXml),
        'xl/styles.xml': strToU8(stylesXml),
        'xl/worksheets/sheet1.xml': strToU8(buildWorksheetXml(rows, merges)),
      });

      downloadBlob(
        new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `${label}.xlsx`,
      );
    } catch (error) {
      console.error('Excel export error:', error);
    } finally {
      setExportingExcel(false);
    }
  };

  // 即時採用（クリック1回で確定）
  const handleInstantApprove = async (
    appId: number, date: string,
    slotStart: string, slotEnd: string,
    existKvSlots: ApprovedSlot[],
    slotKey?: string,
    roleId?: string
  ) => {
    if (!onApproveSlot) return;
    setApproving(true);
    try {
      const newSlot: ApprovedSlot = { start: slotStart, end: slotEnd, ...(roleId ? { roleId } : {}), ...(slotKey ? { slotKey } : {}) };
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
    const { appId, date, slotStart, slotEnd, slotKey } = rolePopover;
    // appIdからemailを特定
    const memberEmail = Object.values(dateApplications).flat().find(a => a.id === appId)?.user_email
      ?? Object.keys(approvedSlotsMap).find(e => approvedSlotsMap[e]?.[date]) ?? '';
    const existKvSlots = approvedSlotsMap[memberEmail]?.[date] ?? [];
    // 該当スロットのroleIdだけ更新
    const updated: ApprovedSlot[] = existKvSlots.length > 0
      ? existKvSlots.map(s => overlaps(s.start, s.end, slotStart, slotEnd) ? { ...s, roleId } : s)
      : [{ start: slotStart, end: slotEnd, roleId, ...(slotKey ? { slotKey } : {}) }];
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
      <div className="flex justify-end mb-2 gap-2">
        <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={exportingExcel || exportingPdf}>
          <Download className="h-4 w-4 mr-1" />
          {exportingExcel ? 'Excel生成中...' : 'Excelダウンロード'}
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportPDF} disabled={exportingPdf || exportingExcel}>
          <Download className="h-4 w-4 mr-1" />
          {exportingPdf ? 'PDF生成中...' : 'PDFダウンロード'}
        </Button>
      </div>
      <div className="overflow-x-auto" ref={tableRef}>
      <table className="border-separate border-spacing-0 text-xs min-w-max border border-gray-600">
        <thead>
          <tr>
            <th rowSpan={2} className="sticky left-0 z-20 bg-gray-100 border border-gray-400 px-3 py-2 text-left min-w-[120px] align-middle">
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
                  className={`border-y border-r border-gray-500 px-2 py-1 text-center font-medium align-top ${
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
          <tr>
            {dailySchedules.map(({ date }) =>
              slots.map((slot, slotIndex) => (
                <th
                  key={`head-${date}-${slotIndex}-${slot.name || slot.start}`}
                  className={`border-b border-r border-gray-500 px-1 py-1 text-center bg-purple-50 text-purple-700 font-medium min-w-[52px] ${
                    slotIndex === 0 ? 'border-l-2 border-l-gray-700' : ''
                  } ${slotIndex === slots.length - 1 ? 'border-r-2 border-r-gray-700' : ''}`}
                  title={`${slot.start}〜${slot.end}`}
                >
                  {displaySlotLabel(slot)}
                </th>
              ))
            )}
          </tr>
        </thead>

        <tbody>
          {displayMembers.map(member => (
            <tr
              key={member.user_email}
              className={`hover:bg-gray-50 ${draggingEmail === member.user_email ? 'opacity-50' : ''}`}
              onDragOver={(e) => {
                if (!isAdmin || mode !== 'result') return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!isAdmin || mode !== 'result' || !draggingEmail) return;
                e.preventDefault();
                moveMember(draggingEmail, member.user_email);
                setDraggingEmail(null);
              }}
              onDragEnd={() => setDraggingEmail(null)}
            >
              <td
                className={`sticky left-0 z-10 bg-white border-r border-b border-gray-500 px-3 py-1 font-medium whitespace-nowrap ${isAdmin && mode === 'result' ? 'cursor-grab select-none' : ''}`}
                draggable={isAdmin && mode === 'result'}
                onDragStart={() => {
                  if (!isAdmin || mode !== 'result') return;
                  setDraggingEmail(member.user_email);
                }}
                title={isAdmin && mode === 'result' ? 'ドラッグして並び替え' : undefined}
              >
                <span className="mr-2 text-gray-400">≡</span>
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
                    const wt = wishTimesMap[app.user_email]?.[date] ?? { start: app.original_start_time, end: app.original_end_time };
                    const wishOverlap = overlaps(wt.start, wt.end, slot.start, slot.end);
                    if (wishOverlap) {
                      cellState = 'wish';
                      // 新しい採用方式: KVスロットを優先し、無い場合だけ従来DB時間をフォールバック
                      if (kvSlots && kvSlots.length > 0) {
                        if (kvSlots.some(ks => overlaps(ks.start, ks.end, slot.start, slot.end))) {
                          cellState = 'approved';
                        }
                      } else {
                        const isApprovedStatus = app.day_status === 'approved' || app.day_status === 'direct_approved';
                        if (isApprovedStatus && overlaps(app.start_time, app.end_time, slot.start, slot.end)) {
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
                      ? 'bg-green-300'
                      : cellState === 'wish'
                      ? 'bg-amber-200'
                      : cellState === 'none'
                      ? 'bg-gray-200'
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
                        slotKey: matchingKvSlot?.slotKey ?? `idx:${slotIndex}`,
                        currentRoleId: matchingKvSlot?.roleId,
                        x: e.clientX, y: e.clientY,
                      });
                      return;
                    }
                    // 勤務可能 → 即時採用
                    const existKvSlots = kvSlots ?? [];
                    handleInstantApprove(app.id, date, slot.start, slot.end, existKvSlots, `idx:${slotIndex}`);
                  };

                  return (
                    <td
                      key={`body-${date}-${slotIndex}-${slot.name || slot.start}`}
                      className={`border-b border-r border-gray-500 text-center min-w-[36px] h-8 p-0 ${bgClass} ${isClickable ? 'cursor-pointer hover:opacity-80' : ''} ${
                        slotIndex === 0 ? 'border-l-2 border-l-gray-700' : ''
                      } ${slotIndex === slots.length - 1 ? 'border-r-2 border-r-gray-700' : ''}`}
                      style={bgStyle}
                      title={
                        cellState === 'approved'
                          ? `採用済み${cellRole ? `（${cellRole.name}）` : ''}: ${(matchingKvSlot?.start ?? app!.start_time).slice(0,5)}〜${(matchingKvSlot?.end ?? app!.end_time).slice(0,5)}${isClickable ? '（クリックで取り消し）' : ''}`
                          : cellState === 'wish'
                          ? `勤務可能: ${(wishTimesMap[app!.user_email]?.[date]?.start ?? app!.original_start_time).slice(0,5)}〜${(wishTimesMap[app!.user_email]?.[date]?.end ?? app!.original_end_time).slice(0,5)}${isClickable ? '（クリックで採用）' : ''}`
                          : ''
                      }
                      onClick={handleClick}
                    >
                      <div className="h-8 w-full" />
                    </td>
                  );
                });
              })}
            </tr>
          ))}
        </tbody>

        {/* フッター: 勤務可能人数・採用人数 */}
        <tfoot>
          {/* 勤務可能人数 */}
          <tr>
            <td className="sticky left-0 z-10 bg-orange-50 border-r border-b border-gray-500 px-3 py-1 font-medium text-orange-800 whitespace-nowrap">
              勤務可能人数
            </td>
            {dailySchedules.map(({ date }) =>
              slots.map((slot, slotIndex) => {
                const count = wishCounts[`${date}__${slot.name || slot.start}`] ?? 0;
                return (
                  <td
                    key={`${date}-${slotIndex}-${slot.name || slot.start}-wish`}
                    className={`border-b border-r border-gray-500 text-center font-bold py-1 bg-orange-50 text-orange-800 ${
                      slotIndex === 0 ? 'border-l-2 border-l-gray-700' : ''
                    } ${slotIndex === slots.length - 1 ? 'border-r-2 border-r-gray-700' : ''}`}
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
              <td className="sticky left-0 z-10 bg-blue-50 border-r border-b border-gray-500 px-3 py-1 font-medium text-blue-800 whitespace-nowrap">
                採用人数
              </td>
              {dailySchedules.map(({ date }) =>
                slots.map((slot, slotIndex) => {
                  const count = resultCounts[`${date}__${slot.name || slot.start}`] ?? 0;
                  return (
                    <td
                      key={`${date}-${slotIndex}-${slot.name || slot.start}-result`}
                      className={`border-b border-r border-gray-500 text-center font-bold py-1 ${
                        count === 0 ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-800'
                      } ${slotIndex === 0 ? 'border-l-2 border-l-gray-700' : ''} ${slotIndex === slots.length - 1 ? 'border-r-2 border-r-gray-700' : ''}`}
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
          <div className="w-5 h-5 border border-gray-400 bg-amber-200 rounded" />
          <span>勤務可能</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 border border-gray-400 bg-green-300 rounded" />
          <span>採用済み{isAdmin && onApproveSlot ? '（クリックでロール変更・取り消し）' : ''}</span>
        </div>
        {isAdmin && onApproveSlot && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 border border-gray-400 bg-amber-200 rounded" />
            <span>勤務可能（クリックで即採用）</span>
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
