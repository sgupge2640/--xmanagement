import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { ChevronLeft, ChevronRight, Check, Calendar as CalendarIcon } from 'lucide-react';
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
}

export function ShiftApplicationCalendar({
  dailySchedules,
  onCheckChange,
  onTimeChange,
  desiredShiftsPerWeek,
  onDesiredShiftsChange,
  disabledDates = [],
}: ShiftApplicationCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (dailySchedules.length > 0) {
      // タイムゾーン対応：日付文字列を正しくパースする
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
  const [selectedDays, setSelectedDays] = useState<boolean[]>([false, false, false, false, false, false, false]); // 日〜土
  // 複数日一括選択モード
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [multiSelectedDates, setMultiSelectedDates] = useState<Set<string>>(new Set());
  const [showMultiTimeDialog, setShowMultiTimeDialog] = useState(false);
  const [multiStartTime, setMultiStartTime] = useState('09:00');
  const [multiEndTime, setMultiEndTime] = useState('18:00');

  // 日付のインデックスを取得
  const getScheduleIndex = (dateStr: string): number => {
    return dailySchedules.findIndex(s => s.date === dateStr);
  };

  // カレンダーのグリッドデータを生成
  const generateCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // 月の最初の日
    const firstDay = new Date(year, month, 1);
    // 月の最後の日
    const lastDay = new Date(year, month + 1, 0);
    
    // 最初の日の曜日（0:日曜日）
    const firstDayOfWeek = firstDay.getDay();
    
    // カレンダーのグリッド
    const grid: (Date | null)[] = [];
    
    // 前月の日付で埋める
    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.push(null);
    }
    
    // 当月の日付
    for (let day = 1; day <= lastDay.getDate(); day++) {
      grid.push(new Date(year, month, day));
    }
    
    return grid;
  };

  // 前月へ
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // 次月へ
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // 日付をクリック
  const handleDateClick = (date: Date) => {
    // タイムゾーン対応：ローカル日付をYYYY-MM-DD形式に変換
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const index = getScheduleIndex(dateStr);
    if (index === -1) return; // シフト期間外
    if (disabledDates.includes(dateStr)) return; // 発表済み日付は選択不可

    if (multiSelectMode) {
      // 複数選択モード：トグル選択
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
      // チェックを入れて時間設定ダイアログを開く
      onCheckChange(index, true);
      setSelectedDate(dateStr);
      setShowTimeDialog(true);
    } else {
      // 既にチェック済みなら時間編集ダイアログを開く
      setSelectedDate(dateStr);
      setShowTimeDialog(true);
    }
  };

  // 複数選択モードで選択した日に一括で時間を設定
  const applyMultiSelectTime = () => {
    multiSelectedDates.forEach(dateStr => {
      const index = getScheduleIndex(dateStr);
      if (index !== -1) {
        onCheckChange(index, true);
        onTimeChange(index, 'start_time', multiStartTime);
        onTimeChange(index, 'end_time', multiEndTime);
      }
    });
    setShowMultiTimeDialog(false);
    setMultiSelectedDates(new Set());
    setMultiSelectMode(false);
  };

  // チェックを外す
  const handleUncheck = () => {
    if (selectedDate) {
      const index = getScheduleIndex(selectedDate);
      if (index !== -1) {
        onCheckChange(index, false);
      }
      setShowTimeDialog(false);
      setSelectedDate(null);
    }
  };

  // 選択された日付の数
  const selectedCount = dailySchedules.filter(s => s.checked).length;

  // 日付のフォーマット
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

  // 曜日指定で一括設定
  const applyWeeklyTime = () => {
    if (!selectedDays.some(d => d)) {
      return; // 曜日が選択されていない場合は何もしない
    }

    dailySchedules.forEach((schedule, index) => {
      const date = new Date(schedule.date + 'T00:00:00');
      const dayOfWeek = date.getDay(); // 0:日曜 〜 6:土曜

      if (selectedDays[dayOfWeek]) {
        onCheckChange(index, true);
        onTimeChange(index, 'start_time', weeklyStartTime);
        onTimeChange(index, 'end_time', weeklyEndTime);
      }
    });

    setShowWeeklyMode(false);
    setSelectedDays([false, false, false, false, false, false, false]);
  };

  return (
    <div className="space-y-4">
      {/* 週間希望シフト数 */}
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

      {/* 選択状況 */}
      <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-sm text-gray-600">選択した日数: </span>
        <span className="text-lg font-bold text-blue-600">{selectedCount}</span>
        <span className="text-sm text-gray-600"> / {dailySchedules.length} 日</span>
      </div>

      {/* 一括設定ボタン群 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          onClick={() => setShowWeeklyMode(true)}
          className="flex-1 sm:flex-none"
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          曜日で一括設定
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
              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
            >
              選択した{multiSelectedDates.size}日に時間を設定
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
            複数日を選択して一括設定
          </Button>
        )}
      </div>
      {multiSelectMode && (
        <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800 text-center">
          日付をタップして選択し、「選択した○日に時間を設定」で一括設定できます
        </div>
      )}

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

              // タイムゾーン対応：ローカル日付をYYYY-MM-DD形式に変換
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
                        ? 'bg-green-500 text-white border-green-600 hover:bg-green-600 shadow-md'
                        : isSelected
                          ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700 shadow-md'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                    }
                    ${dayOfWeek === 0 && !isSelected && !isMultiSelected ? 'text-red-600' : ''}
                    ${dayOfWeek === 6 && !isSelected && !isMultiSelected ? 'text-blue-600' : ''}
                  `}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span>{date.getDate()}</span>
                    {isSelected && (
                      <Check className="h-3 w-3 mt-0.5" />
                    )}
                  </div>
                  {isSelected && schedule && (
                    <div className="absolute bottom-0 left-0 right-0 text-[8px] bg-blue-700 bg-opacity-80 rounded-b px-0.5 truncate">
                      {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 凡例 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex gap-4 text-xs text-gray-600 justify-center flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-blue-700 bg-blue-600"></div>
                <span>選択済み</span>
              </div>
              {multiSelectMode && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded border-2 border-green-600 bg-green-500"></div>
                  <span>一括選択中</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-gray-200 bg-white"></div>
                <span>未選択</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-amber-200 bg-amber-50"></div>
                <span>発表済み（再提出不可）</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-gray-100 bg-gray-50"></div>
                <span>期間外</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 複数日一括設定ダイアログ */}
      <Dialog open={showMultiTimeDialog} onOpenChange={(open) => {
        setShowMultiTimeDialog(open);
        if (!open) {
          setMultiSelectedDates(new Set());
          setMultiSelectMode(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>選択した日に時間を一括設定</DialogTitle>
            <DialogDescription>
              {multiSelectedDates.size}日分に同じ勤務時間を設定します
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="multi-start-time" className="text-sm text-gray-700 mb-2 block">
                開始時刻
              </Label>
              <Input
                id="multi-start-time"
                type="time"
                step="600"
                value={multiStartTime}
                onChange={(e) => setMultiStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="multi-end-time" className="text-sm text-gray-700 mb-2 block">
                終了時刻
              </Label>
              <Input
                id="multi-end-time"
                type="time"
                step="600"
                value={multiEndTime}
                onChange={(e) => setMultiEndTime(e.target.value)}
              />
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              選択中: {Array.from(multiSelectedDates).sort().map(d => {
                const date = new Date(d + 'T00:00:00');
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }).join('、')}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowMultiTimeDialog(false);
              }}
            >
              キャンセル
            </Button>
            <Button onClick={applyMultiSelectTime}>
              一括設定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 週単位入力ダイアログ */}
      <Dialog open={showWeeklyMode} onOpenChange={(open) => {
        setShowWeeklyMode(open);
        if (!open) {
          setSelectedDays([false, false, false, false, false, false, false]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>曜日を選択して時間を設定</DialogTitle>
            <DialogDescription>
              選択した曜日のみに同じ時間を一括で設定します
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label className="text-sm text-gray-700 mb-2 block">
                曜日を選択
              </Label>
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
            </div>

            <div>
              <Label htmlFor="weekly-start-time" className="text-sm text-gray-700 mb-2 block">
                開始時刻
              </Label>
              <Input
                id="weekly-start-time"
                type="time"
                step="600"
                value={weeklyStartTime}
                onChange={(e) => setWeeklyStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="weekly-end-time" className="text-sm text-gray-700 mb-2 block">
                終了時刻
              </Label>
              <Input
                id="weekly-end-time"
                type="time"
                step="600"
                value={weeklyEndTime}
                onChange={(e) => setWeeklyEndTime(e.target.value)}
              />
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              選択した曜日のみに指定した時間が設定されます。
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowWeeklyMode(false);
                setSelectedDays([false, false, false, false, false, false, false]);
              }}
            >
              キャンセル
            </Button>
            <Button
              onClick={applyWeeklyTime}
              disabled={!selectedDays.some(d => d)}
            >
              一括設定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 時間設定ダイアログ */}
      <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>勤務時間の設定</DialogTitle>
            <DialogDescription>
              {selectedDate && formatDate(selectedDate)} の勤務時間を設定してください
            </DialogDescription>
          </DialogHeader>
          
          {selectedSchedule && (
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="dialog-start-time" className="text-sm text-gray-700 mb-2 block">
                  開始時刻
                </Label>
                <Input
                  id="dialog-start-time"
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
                <Label htmlFor="dialog-end-time" className="text-sm text-gray-700 mb-2 block">
                  終了時刻
                </Label>
                <Input
                  id="dialog-end-time"
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
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleUncheck}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              この日の選択を解除
            </Button>
            <Button onClick={() => setShowTimeDialog(false)}>
              完了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}