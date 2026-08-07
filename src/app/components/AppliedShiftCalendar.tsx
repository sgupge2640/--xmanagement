import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ChevronLeft, ChevronRight, Check, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { getApprovedSlotsMap } from '../lib/api';
import type { ApprovedSlot } from '../lib/api';

interface AppliedDay {
  date: string;
  start_time: string;
  end_time: string;
  status?: string;
}

interface AppliedShiftCalendarProps {
  appliedDays: AppliedDay[];
  startDate?: string;
  endDate?: string;
  publishedDates?: string[] | null;
  approvedSlotsMap?: { [email: string]: { [date: string]: ApprovedSlot[] } };
  userEmail?: string;
  shiftId?: number;
}

function toMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function getSlotOrder(slot: ApprovedSlot) {
  if (!slot.slotKey) return null;
  const match = slot.slotKey.match(/^idx:(\d+)$/);
  return match ? Number(match[1]) : null;
}

function getMergedSlotRanges(slots: ApprovedSlot[]) {
  if (!slots || slots.length === 0) return [] as { start: string; end: string }[];

  const sorted = [...slots].sort((a, b) => {
    const orderA = getSlotOrder(a);
    const orderB = getSlotOrder(b);
    if (orderA !== null && orderB !== null) return orderA - orderB;
    return a.start.localeCompare(b.start);
  });
  const merged: { start: string; end: string; lastOrder: number | null }[] = [];

  sorted.forEach((slot) => {
    const slotOrder = getSlotOrder(slot);
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ start: slot.start, end: slot.end, lastOrder: slotOrder });
      return;
    }

    const isTimeContinuous = toMinutes(slot.start) <= toMinutes(last.end);
    const isAdjacentSlot = slotOrder !== null && last.lastOrder !== null && slotOrder === last.lastOrder + 1;

    if (isTimeContinuous || isAdjacentSlot) {
      if (toMinutes(slot.end) > toMinutes(last.end)) {
        last.end = slot.end;
      }
      if (slotOrder !== null) {
        last.lastOrder = slotOrder;
      }
      return;
    }

    merged.push({ start: slot.start, end: slot.end, lastOrder: slotOrder });
  });

  return merged.map(({ start, end }) => ({ start, end }));
}

function formatSlotRanges(slots: ApprovedSlot[]) {
  const ranges = getMergedSlotRanges(slots);
  if (ranges.length === 0) return '';
  return ranges.map((range) => `${range.start}-${range.end}`).join(' / ');
}

export function AppliedShiftCalendar({ appliedDays, startDate, endDate, publishedDates = [], approvedSlotsMap: initialSlotsMap, userEmail, shiftId }: AppliedShiftCalendarProps) {
  // KVから最新の採用スロットを取得（親からの初期値より常に最新を優先）
  const [localSlotsMap, setLocalSlotsMap] = useState(initialSlotsMap ?? {});

  useEffect(() => {
    if (!shiftId) {
      setLocalSlotsMap(initialSlotsMap ?? {});
      return;
    }
    getApprovedSlotsMap(shiftId).then(data => {
      setLocalSlotsMap(Object.keys(data).length > 0 ? data : (initialSlotsMap ?? {}));
    }).catch(() => {
      setLocalSlotsMap(initialSlotsMap ?? {});
    });
  }, [shiftId]);

  // ページが再表示された時にKVを再読み込み（管理者が採用したら即反映）
  useEffect(() => {
    if (!shiftId) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        getApprovedSlotsMap(shiftId).then(data => {
          if (Object.keys(data).length > 0) setLocalSlotsMap(data);
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [shiftId]);

  const approvedSlotsMap = localSlotsMap;
  const isResultsPublished = publishedDates === null;
  const visibleAppliedDays = useMemo(() => {
    if (!isResultsPublished) return appliedDays;
    return appliedDays.filter((day) => {
      if (day.status !== 'approved' && day.status !== 'direct_approved') return false;
      if (!userEmail) return false;
      const slots = approvedSlotsMap?.[userEmail]?.[day.date] || [];
      return slots.length > 0;
    });
  }, [isResultsPublished, appliedDays, userEmail, approvedSlotsMap]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (visibleAppliedDays.length > 0) {
      const firstDate = visibleAppliedDays[0].date;
      return new Date(firstDate + 'T00:00:00');
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // 日付文字列のマップを作成
  const appliedDaysMap = new Map<string, AppliedDay>();
  visibleAppliedDays.forEach(day => {
    appliedDaysMap.set(day.date, day);
  });

  // カレンダーのグリッドデータを生成
  const generateCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const firstDayOfWeek = firstDay.getDay();

    const grid: (Date | null)[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      grid.push(new Date(year, month, day));
    }

    return grid;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    if (appliedDaysMap.has(dateStr)) {
      setSelectedDate(dateStr);
      setShowDetailDialog(true);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  // シフト期間の範囲チェック
  const isInShiftRange = (dateStr: string) => {
    if (!startDate || !endDate) return true;
    return dateStr >= startDate && dateStr <= endDate;
  };

  const grid = generateCalendarGrid();
  const selectedDay = selectedDate ? appliedDaysMap.get(selectedDate) : null;

  return (
    <div className="space-y-4">
      {/* 選択状況 */}
      <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
        <span className="text-sm text-blue-700">{isResultsPublished ? '採用された日数: ' : '応募した日数: '}</span>
        <span className="text-lg font-bold text-blue-600">{visibleAppliedDays.length}</span>
        <span className="text-sm text-blue-700"> 日</span>
      </div>

      {/* カレンダー */}
      <Card>
        <CardContent className="p-4">
          {/* 月の切り替え */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold">
              {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
              <div
                key={day}
                className={`text-center text-xs font-medium py-2 ${
                  i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* カレンダーグリッド */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((date, i) => {
              if (!date) {
                return <div key={`empty-${i}`} className="aspect-square" />;
              }

              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;

              const appliedDay = appliedDaysMap.get(dateStr);
              const isApplied = !!appliedDay;
              const inRange = isInShiftRange(dateStr);
              const dayOfWeek = date.getDay();
              // null = 全体発表済み(全日表示)、[] = 未発表(結果非表示)、string[] = その日付のみ表示
              const isPublished = publishedDates === null || (Array.isArray(publishedDates) && publishedDates.includes(dateStr));
              const isApproved = isPublished && appliedDay?.status === 'approved';
              const isDirectApproved = isPublished && appliedDay?.status === 'direct_approved';

              const bgClass = !inRange
                ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                : isApplied
                  ? isDirectApproved
                    ? 'bg-orange-500 text-white border-orange-600 hover:bg-orange-600 shadow-md cursor-pointer'
                    : isApproved
                      ? 'bg-green-600 text-white border-green-700 hover:bg-green-700 shadow-md cursor-pointer'
                      : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700 shadow-md cursor-pointer'
                  : 'bg-white text-gray-400 border-gray-200 cursor-not-allowed';

              const barClass = isDirectApproved ? 'bg-orange-600' : isApproved ? 'bg-green-700' : 'bg-blue-700';

              return (
                <button
                  key={dateStr}
                  onClick={() => isApplied && handleDateClick(date)}
                  disabled={!isApplied}
                  className={`aspect-square rounded-lg border-2 text-sm font-medium transition-all duration-200 relative ${bgClass}
                    ${dayOfWeek === 0 && !isApplied && inRange ? 'text-red-300' : ''}
                    ${dayOfWeek === 6 && !isApplied && inRange ? 'text-blue-300' : ''}
                  `}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span>{date.getDate()}</span>
                    {isApplied && <Check className="h-3 w-3 mt-0.5" />}
                  </div>
                  {isApplied && appliedDay && (() => {
                    const kvSlots = userEmail && approvedSlotsMap?.[userEmail]?.[dateStr];
                    // 公開後はKV採用スロットだけを採用結果として表示
                    const timeText = kvSlots && kvSlots.length > 0
                      ? formatSlotRanges(kvSlots)
                      : (isResultsPublished ? '' : `${appliedDay.start_time.slice(0, 5)}-${appliedDay.end_time.slice(0, 5)}`);
                    return (
                      <div className={`absolute bottom-0 left-0 right-0 text-[8px] ${barClass} bg-opacity-80 rounded-b px-0.5 truncate`}>
                        {timeText}
                      </div>
                    );
                  })()}
                </button>
              );
            })}
          </div>

          {/* 凡例 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex gap-4 text-xs text-gray-600 justify-center flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-green-700 bg-green-600"></div>
                <span>承認済み</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-orange-600 bg-orange-500"></div>
                <span>直接採用</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-blue-700 bg-blue-600"></div>
                <span>承認待ち</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-gray-200 bg-white text-gray-400 flex items-center justify-center text-xs">1</div>
                <span>未応募</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 詳細ダイアログ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>応募内容</DialogTitle>
            <DialogDescription>
              {selectedDate && formatDate(selectedDate)}
            </DialogDescription>
          </DialogHeader>

          {selectedDay && (
            <div className="py-4 space-y-3">
              {selectedDay.status && (
                <div>
                  {selectedDay.status === 'approved' ? (
                    <Badge variant="default" className="w-full justify-center py-2 bg-green-600">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      承認済み
                    </Badge>
                  ) : selectedDay.status === 'direct_approved' ? (
                    <Badge variant="default" className="w-full justify-center py-2 bg-orange-500">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      直接採用
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="w-full justify-center py-2">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      承認待ち
                    </Badge>
                  )}
                </div>
              )}
              <div className={`flex items-center gap-3 p-4 rounded-lg ${
                selectedDay.status === 'approved' ? 'bg-green-50' : 'bg-blue-50'
              }`}>
                <Clock className={`h-5 w-5 ${
                  selectedDay.status === 'approved' ? 'text-green-600' : 'text-blue-600'
                }`} />
                <div>
                  <div className={`text-sm mb-1 ${
                    selectedDay.status === 'approved' ? 'text-green-700' : 'text-blue-700'
                  }`}>勤務時間</div>
                  {/* 公開後はKV採用スロットの時間のみ表示 */}
                  {(() => {
                    const kvSlots = userEmail && approvedSlotsMap?.[userEmail]?.[selectedDate!];
                    if (kvSlots && kvSlots.length > 0) {
                      const timeText = formatSlotRanges(kvSlots);
                      if (!timeText) return null;
                      return (
                        <div className={`text-lg font-semibold ${
                          selectedDay.status === 'approved' ? 'text-green-900' : 'text-blue-900'
                        }`}>
                          {timeText}
                        </div>
                      );
                    }
                    if (isResultsPublished) {
                      return (
                        <div className={`text-sm ${
                          selectedDay.status === 'approved' ? 'text-green-700' : 'text-blue-700'
                        }`}>
                          採用時間は未設定です
                        </div>
                      );
                    }
                    return (
                      <div className={`text-lg font-semibold ${
                        selectedDay.status === 'approved' ? 'text-green-900' : 'text-blue-900'
                      }`}>
                        {selectedDay.start_time.slice(0, 5)} - {selectedDay.end_time.slice(0, 5)}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setShowDetailDialog(false)}>
              閉じる
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
