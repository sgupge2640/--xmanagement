import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';

interface DailyScheduleItem {
  date: string;
  checked: boolean;
  start_time: string;
  end_time: string;
}

interface ShiftApplicationCalendarProps {
  dailySchedules: DailyScheduleItem[];
  onCheckChange: (index: number, checked: boolean) => void;
  onTimeChange: (index: number, field: 'start_time' | 'end_time', value: string) => void;
  desiredShiftsPerWeek: number;
  onDesiredShiftsChange: (value: number) => void;
  disabledDates?: string[];
  shiftStartTime?: string;
  shiftEndTime?: string;
}

export function ShiftApplicationCalendar({
  dailySchedules,
  onCheckChange,
  onTimeChange,
  desiredShiftsPerWeek,
  onDesiredShiftsChange,
  disabledDates = [],
  shiftStartTime,
  shiftEndTime,
}: ShiftApplicationCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (dailySchedules.length > 0) {
      const firstDate = dailySchedules[0].date;
      return new Date(firstDate + 'T00:00:00');
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [showWeeklyMode, setShowWeeklyMode] = useState(false);
  const [weeklyStartTime, setWeeklyStartTime] = useState('09:00');
  const [weeklyEndTime, setWeeklyEndTime] = useState('18:00');
  const [weeklyAllDay, setWeeklyAllDay] = useState(false);
  const [selectedDays, setSelectedDays] = useState<boolean[]>([false, false, false, false, false, false, false]); // 日〜土
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [multiSelectedDates, setMultiSelectedDates] = useState<Set<string>>(new Set());
  const [showMultiTimeDialog, setShowMultiTimeDialog] = useState(false);
  const [multiStartTime, setMultiStartTime] = useState('09:00');
  const [multiEndTime, setMultiEndTime] = useState('18:00');
  const [multiAllDay, setMultiAllDay] = useState(false);

  const defaultShiftStart = (shiftStartTime || dailySchedules[0]?.start_time || '09:00').slice(0, 5);
  const defaultShiftEnd = (shiftEndTime || dailySchedules[0]?.end_time || '18:00').slice(0, 5);

  const getScheduleIndex = (dateStr: string): number => {
    return dailySchedules.findIndex(s => s.date === dateStr);
  };

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

    const index = getScheduleIndex(dateStr);
    if (index === -1) return;
    if (disabledDates.includes(dateStr)) return;

    if (multiSelectMode) {
      setMultiSelectedDates(prev => {
        const next = new Set(prev);
        if (next.has(dateStr)) {
          next.delete(dateStr);
        } else {
          next.add(dateStr);
        }
        return next;
      });
      return;
    }

    const schedule = dailySchedules[index];

    if (!schedule.checked) {
      onCheckChange(index, true);
      setSelectedDate(dateStr);
      setShowTimeDialog(true);
    } else {
      setSelectedDate(dateStr);
      setShowTimeDialog(true);
    }
  };

  const applyMultiSelectUnavailable = () => {
    if (!multiAllDay && (!multiStartTime || !multiEndTime || multiStartTime >= multiEndTime)) {
      return;
    }

    const start = multiAllDay ? defaultShiftStart : multiStartTime;
    const end = multiAllDay ? defaultShiftEnd : multiEndTime;

    multiSelectedDates.forEach(dateStr => {
      const index = getScheduleIndex(dateStr);
      if (index !== -1) {
        if (disabledDates.includes(dateStr)) return;
        onCheckChange(index, true);
        onTimeChange(index, 'start_time', start);
        onTimeChange(index, 'end_time', end);
      }
    });
    setShowMultiTimeDialog(false);
    setMultiSelectedDates(new Set());
    setMultiSelectMode(false);
  };

  const handleUnavailableClear = () => {
    if (!selectedDate) return;
    const index = getScheduleIndex(selectedDate);
    if (index !== -1) {
      onCheckChange(index, false);
    }
    setShowTimeDialog(false);
    setSelectedDate(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  const grid = generateCalendarGrid();
  const selectedSchedule = selectedDate ? dailySchedules[getScheduleIndex(selectedDate)] : null;
  const unavailableCount = dailySchedules.filter(s => s.checked).length;
  const availableCount = dailySchedules.length - unavailableCount;

  const applyWeeklyUnavailable = () => {
    if (!selectedDays.some(d => d)) {
      return;
    }

    if (!weeklyAllDay && (!weeklyStartTime || !weeklyEndTime || weeklyStartTime >= weeklyEndTime)) {
      return;
    }

    const start = weeklyAllDay ? defaultShiftStart : weeklyStartTime;
    const end = weeklyAllDay ? defaultShiftEnd : weeklyEndTime;

    dailySchedules.forEach((schedule, index) => {
      const date = new Date(schedule.date + 'T00:00:00');
      const dayOfWeek = date.getDay();

      if (disabledDates.includes(schedule.date)) return;

      if (selectedDays[dayOfWeek]) {
        onCheckChange(index, true);
        onTimeChange(index, 'start_time', start);
        onTimeChange(index, 'end_time', end);
      }
    });

    setShowWeeklyMode(false);
    setSelectedDays([false, false, false, false, false, false, false]);
  };

  return (
    <div className="space-y-4">
      <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Label htmlFor="desired-shifts" className="text-sm font-medium text-blue-900 mb-2 block">
          週に何回入りたいですか？
        </Label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <select
              id="desired-shifts"
              value={desiredShiftsPerWeek}
              onChange={(e) => onDesiredShiftsChange(parseInt(e.target.value))}
              className="h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <option key={n} value={n}>{n}回</option>
              ))}
            </select>
            <span className="text-sm text-blue-700">/ 週</span>
          </div>
          <span className="text-xs text-blue-600">
            ※ 自動配分時に考慮されます
          </span>
        </div>
      </div>

      <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-sm text-gray-600">勤務できない日数: </span>
        <span className="text-lg font-bold text-red-600">{unavailableCount}</span>
        <span className="text-sm text-gray-600"> / {dailySchedules.length} 日</span>
        <div className="text-xs text-gray-500 mt-1">勤務可能日数: {availableCount} 日</div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          onClick={() => setShowWeeklyMode((v) => !v)}
          className="flex-1 sm:flex-none"
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          曜日で一括不可設定
        </Button>
        {multiSelectMode ? (
          <>
            <Button
              variant="default"
              onClick={() => {
                if (multiSelectedDates.size > 0) {
                  setShowMultiTimeDialog(true);
                }
              }}
              disabled={multiSelectedDates.size === 0}
              className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700"
            >
              選択した{multiSelectedDates.size}日を不可にする
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMultiSelectMode(false);
                setMultiSelectedDates(new Set());
              }}
              className="flex-1 sm:flex-none"
            >
              キャンセル
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => setMultiSelectMode(true)}
            className="flex-1 sm:flex-none"
          >
            複数日を選択して一括不可
          </Button>
        )}
      </div>

      {multiSelectMode && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800 text-center">
          日付をタップして選択し、「選択した○日を不可にする」で一括反映できます
        </div>
      )}

      {showWeeklyMode && (
        <Card className="border-blue-200">
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium text-blue-900">勤務できない曜日を選択</div>
            <div className="grid grid-cols-7 gap-2">
              {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                <div key={day} className="flex flex-col items-center gap-1">
                  <Checkbox
                    id={`day-${index}`}
                    checked={selectedDays[index]}
                    onCheckedChange={(checked) => {
                      const newDays = [...selectedDays];
                      newDays[index] = checked as boolean;
                      setSelectedDays(newDays);
                    }}
                  />
                  <Label
                    htmlFor={`day-${index}`}
                    className={`text-xs cursor-pointer ${
                      index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </Label>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="weekly-unavailable-start" className="text-sm text-gray-700 mb-1 block">
                  勤務できない開始時刻
                </Label>
                <Input
                  id="weekly-unavailable-start"
                  type="time"
                  step="600"
                  value={weeklyStartTime}
                  onChange={(e) => setWeeklyStartTime(e.target.value)}
                  disabled={weeklyAllDay}
                />
              </div>
              <div>
                <Label htmlFor="weekly-unavailable-end" className="text-sm text-gray-700 mb-1 block">
                  勤務できない終了時刻
                </Label>
                <Input
                  id="weekly-unavailable-end"
                  type="time"
                  step="600"
                  value={weeklyEndTime}
                  onChange={(e) => setWeeklyEndTime(e.target.value)}
                  disabled={weeklyAllDay}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Checkbox checked={weeklyAllDay} onCheckedChange={(checked) => setWeeklyAllDay(checked as boolean)} />
              終日勤務不可として設定する
            </label>
            {weeklyAllDay && (
              <p className="text-xs text-gray-500">終日勤務不可: {defaultShiftStart} - {defaultShiftEnd}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowWeeklyMode(false)}>閉じる</Button>
              <Button onClick={applyWeeklyUnavailable} disabled={!selectedDays.some((d) => d) || (!weeklyAllDay && weeklyStartTime >= weeklyEndTime)}>
                曜日で不可日を反映
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
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

          <div className="grid grid-cols-7 gap-1">
            {grid.map((date, i) => {
              if (!date) {
                return <div key={`empty-${i}`} className="aspect-square" />;
              }

              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;
              
              const index = getScheduleIndex(dateStr);
              const isInRange = index !== -1;
              const isDisabledByPublish = disabledDates.includes(dateStr);
              const schedule = isInRange ? dailySchedules[index] : null;
              const isSelected = schedule?.checked || false;
              const isMultiSelected = multiSelectedDates.has(dateStr);
              const dayOfWeek = date.getDay();

              return (
                <button
                  key={dateStr}
                  onClick={() => isInRange && !isDisabledByPublish && handleDateClick(date)}
                  disabled={!isInRange || isDisabledByPublish}
                  className={`
                    aspect-square rounded-lg border-2 text-sm font-medium
                    transition-all duration-200 relative
                    ${!isInRange
                      ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                      : isDisabledByPublish
                        ? 'bg-amber-50 text-amber-400 border-amber-200 cursor-not-allowed'
                      : isMultiSelected
                        ? 'bg-purple-500 text-white border-purple-600 hover:bg-purple-600 shadow-md'
                        : isSelected
                          ? 'bg-red-500 text-white border-red-600 hover:bg-red-600 shadow-md'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                    }
                    ${dayOfWeek === 0 && !isSelected && !isMultiSelected ? 'text-red-600' : ''}
                    ${dayOfWeek === 6 && !isSelected && !isMultiSelected ? 'text-blue-600' : ''}
                  `}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span>{date.getDate()}</span>
                    {isSelected && <X className="h-3 w-3 mt-0.5" />}
                  </div>
                  {isSelected && schedule && (
                    <div className="absolute bottom-0 left-0 right-0 text-[8px] bg-red-700 bg-opacity-80 rounded-b px-0.5 truncate">
                      {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex gap-4 text-xs text-gray-600 justify-center flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-red-600 bg-red-500"></div>
                <span>勤務不可</span>
              </div>
              {multiSelectMode && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded border-2 border-purple-600 bg-purple-500"></div>
                  <span>一括選択中</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-gray-200 bg-white"></div>
                <span>勤務可能</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-amber-200 bg-amber-50"></div>
                <span>固定日（再提出不可）</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-gray-100 bg-gray-50"></div>
                <span>期間外</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showMultiTimeDialog} onOpenChange={(open) => {
        setShowMultiTimeDialog(open);
        if (!open) {
          setMultiSelectedDates(new Set());
          setMultiSelectMode(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>選択した日に勤務できない時間帯を設定</DialogTitle>
            <DialogDescription>
              {multiSelectedDates.size}日分に同じ時間帯を勤務不可として設定します
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="multi-unavailable-start" className="text-sm text-gray-700 mb-2 block">
                勤務できない開始時刻
              </Label>
              <Input
                id="multi-unavailable-start"
                type="time"
                step="600"
                value={multiStartTime}
                onChange={(e) => setMultiStartTime(e.target.value)}
                disabled={multiAllDay}
              />
            </div>
            <div>
              <Label htmlFor="multi-unavailable-end" className="text-sm text-gray-700 mb-2 block">
                勤務できない終了時刻
              </Label>
              <Input
                id="multi-unavailable-end"
                type="time"
                step="600"
                value={multiEndTime}
                onChange={(e) => setMultiEndTime(e.target.value)}
                disabled={multiAllDay}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Checkbox checked={multiAllDay} onCheckedChange={(checked) => setMultiAllDay(checked as boolean)} />
              終日勤務不可として設定する
            </label>
            {multiAllDay && (
              <p className="text-xs text-gray-500">終日勤務不可: {defaultShiftStart} - {defaultShiftEnd}</p>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowMultiTimeDialog(false)}>キャンセル</Button>
            <Button onClick={applyMultiSelectUnavailable} disabled={!multiAllDay && multiStartTime >= multiEndTime}>
              一括設定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>勤務できない時間帯の設定</DialogTitle>
            <DialogDescription>
              {selectedDate && formatDate(selectedDate)} に勤務できない時間帯を設定してください
            </DialogDescription>
          </DialogHeader>

          {selectedSchedule && (
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="dialog-unavailable-start" className="text-sm text-gray-700 mb-2 block">
                  開始時刻
                </Label>
                <Input
                  id="dialog-unavailable-start"
                  type="time"
                  step="600"
                  value={selectedSchedule.start_time}
                  onChange={(e) => {
                    const index = getScheduleIndex(selectedDate!);
                    if (index !== -1) {
                      onTimeChange(index, 'start_time', e.target.value);
                    }
                  }}
                />
              </div>
              <div>
                <Label htmlFor="dialog-unavailable-end" className="text-sm text-gray-700 mb-2 block">
                  終了時刻
                </Label>
                <Input
                  id="dialog-unavailable-end"
                  type="time"
                  step="600"
                  value={selectedSchedule.end_time}
                  onChange={(e) => {
                    const index = getScheduleIndex(selectedDate!);
                    if (index !== -1) {
                      onTimeChange(index, 'end_time', e.target.value);
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const index = getScheduleIndex(selectedDate!);
                  if (index !== -1) {
                    onCheckChange(index, true);
                    onTimeChange(index, 'start_time', defaultShiftStart);
                    onTimeChange(index, 'end_time', defaultShiftEnd);
                  }
                }}
              >
                終日勤務不可にする（{defaultShiftStart} - {defaultShiftEnd}）
              </Button>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleUnavailableClear}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              この日の勤務不可を解除
            </Button>
            <Button onClick={() => setShowTimeDialog(false)} disabled={(selectedSchedule?.start_time || '') >= (selectedSchedule?.end_time || '')}>
              完了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}