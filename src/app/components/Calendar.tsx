import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Briefcase, X } from 'lucide-react';
import { Badge } from './ui/badge';

interface CalendarEvent {
  date: string;
  start_time: string;
  end_time: string;
  time_label?: string;
  title: string;
  group_name?: string;
  status?: string;
  user_name?: string;
  user_email?: string;
  shift_title?: string;
  location?: string;
}

interface CalendarProps {
  events: CalendarEvent[];
  isAdmin?: boolean;
  loading?: boolean;
}

export function Calendar({ events, isAdmin = false, loading = false }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const getEventsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => event.date === dateStr);
  };

  const handleDateClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = getEventsForDate(day);
    
    // イベントがある日付のみ選択可能
    if (dayEvents.length > 0) {
      setSelectedDate(selectedDate === dateStr ? null : dateStr);
    }
  };

  const selectedDateEvents = selectedDate ? events.filter(event => event.date === selectedDate) : [];

  const getEventTimeText = (event: CalendarEvent) => {
    if (event.time_label && event.time_label.trim().length > 0) return event.time_label;
    return `${event.start_time?.slice(0, 5)} - ${event.end_time?.slice(0, 5)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  const calendarDays = [];
  
  // 前月の日付
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="p-2 bg-gray-50" />);
  }

  // 当月の日付
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = getEventsForDate(day);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = 
      new Date().getFullYear() === year &&
      new Date().getMonth() === month &&
      new Date().getDate() === day;
    const isSelected = selectedDate === dateStr;
    const hasEvents = dayEvents.length > 0;

    calendarDays.push(
      <div
        key={day}
        className={`min-h-[60px] sm:min-h-[100px] p-1 sm:p-2 border border-gray-200 transition-all ${
          isSelected
            ? 'bg-indigo-50 border-indigo-400 shadow-lg ring-2 ring-indigo-400'
            : isToday
            ? 'bg-blue-50 border-blue-300'
            : 'bg-white'
        } ${hasEvents ? 'cursor-pointer hover:bg-gray-50' : ''}`}
        onClick={() => handleDateClick(day)}
      >
        <div className={`text-xs sm:text-sm mb-1 ${
          isSelected
            ? 'font-bold text-indigo-700'
            : isToday
            ? 'font-bold text-blue-600'
            : 'text-gray-600'
        }`}>
          {day}
        </div>
        <div className="space-y-1">
          {dayEvents.slice(0, 2).map((event, idx) => (
            <div
              key={idx}
              className={`text-[10px] sm:text-xs p-0.5 sm:p-1 rounded ${
                isAdmin
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : event.status === 'approved'
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : event.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                  : 'bg-gray-100 text-gray-800 border border-gray-300'
              }`}
            >
              <div className="truncate font-medium">
                {isAdmin ? event.user_name : event.group_name}
              </div>
              <div className="truncate text-[9px] sm:text-xs">
                {getEventTimeText(event)}
              </div>
            </div>
          ))}
          {dayEvents.length > 2 && (
            <div className="text-[10px] sm:text-xs text-center text-gray-600 font-medium">
              +{dayEvents.length - 2}件
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              {isAdmin ? 'スタッフシフトカレンダー' : 'マイシフトカレンダー'}
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <Button variant="outline" size="sm" onClick={previousMonth} className="px-2 sm:px-3">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-base sm:text-lg font-medium min-w-[100px] sm:min-w-[120px] text-center">
                {year}年 {month + 1}月
              </div>
              <Button variant="outline" size="sm" onClick={nextMonth} className="px-2 sm:px-3">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!isAdmin && (
            <div className="flex gap-2 mt-3 sm:mt-4 flex-wrap">
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-300 text-xs">
                承認済み
              </Badge>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                承認待ち
              </Badge>
              <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300 text-xs">
                拒否
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-1 sm:p-6">
          <div className="grid grid-cols-7 gap-0 border border-gray-200 overflow-x-auto">
            {/* 曜日ヘッダー */}
            {weekDays.map((day, idx) => (
              <div
                key={day}
                className={`p-1 sm:p-2 text-center text-xs sm:text-sm font-medium border-b border-gray-200 ${
                  idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : 'text-gray-700'
                } bg-gray-100`}
              >
                {day}
              </div>
            ))}
            {/* カレンダーの日付 */}
            {calendarDays}
          </div>
        </CardContent>
      </Card>

      {/* 選択した日付の詳細 */}
      {selectedDate && selectedDateEvents.length > 0 && (
        <Card className="border-indigo-300 shadow-lg">
          <CardHeader className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                <span className="text-sm sm:text-base">{formatDate(selectedDate)}</span>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(null)}
                className="px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="space-y-3">
              {selectedDateEvents.map((event, idx) => (
                <div
                  key={idx}
                  className={`p-3 sm:p-4 rounded-lg border-2 ${
                    isAdmin
                      ? 'bg-green-50 border-green-300'
                      : event.status === 'approved'
                      ? 'bg-green-50 border-green-300'
                      : event.status === 'pending'
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm sm:text-base font-medium mb-2 break-words">
                        {isAdmin ? event.user_name : event.group_name}
                      </div>
                      <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span>{getEventTimeText(event)}</span>
                        </div>
                        {isAdmin && event.shift_title && (
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="break-words">{event.shift_title}</span>
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-1 sm:gap-2">
                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="break-words">{event.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {!isAdmin && event.status && (
                      <Badge
                        variant={
                          event.status === 'approved'
                            ? 'default'
                            : event.status === 'pending'
                            ? 'secondary'
                            : 'outline'
                        }
                        className={`text-xs ${
                          event.status === 'approved'
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : event.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                            : 'bg-gray-100 text-gray-800 border-gray-300'
                        } whitespace-nowrap`}
                      >
                        {event.status === 'approved' ? '承認済み' : event.status === 'pending' ? '承認待ち' : '拒否'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm sm:text-base">読み込み中...</p>
        </div>
      )}
    </div>
  );
}