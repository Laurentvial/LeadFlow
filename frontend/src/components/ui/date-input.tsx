import * as React from "react";
import { Input } from "./input";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "./utils";

interface DateInputProps extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  value: string; // Format: YYYY-MM-DD (for internal storage)
  onChange: (value: string) => void; // Returns YYYY-MM-DD format
  label?: string;
  autoInitialize?: boolean; // If false, don't auto-initialize with today's date
}

function DateInput({ value, onChange, className, label, autoInitialize = true, ...props }: DateInputProps) {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState<Date | undefined>(undefined);

  // Get today's date in YYYY-MM-DD format
  const getTodayDateString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Initialize with today's date if value is empty (only if autoInitialize is true)
  React.useEffect(() => {
    if (autoInitialize && (!value || value === '')) {
      const todayStr = getTodayDateString();
      onChange(todayStr);
    }
  }, []); // Only run on mount

  // Convert YYYY-MM-DD to Date object
  const getDateFromValue = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return undefined;
    return date;
  };

  // Convert Date to YYYY-MM-DD
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert YYYY-MM-DD to DD/MM/YYYY for display
  const formatForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD
  const parseFromDisplay = (displayValue: string): string => {
    if (!displayValue) return '';
    // Remove any non-digit characters except /
    const cleaned = displayValue.replace(/[^\d/]/g, '');
    const parts = cleaned.split('/');
    
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      
      // Validate and convert to YYYY-MM-DD
      if (day && month && year && year.length === 4) {
        const date = new Date(`${year}-${month}-${day}T00:00:00`);
        if (!isNaN(date.getTime())) {
          return `${year}-${month}-${day}`;
        }
      }
    }
    return value; // Return current value if parsing fails
  };

  const [displayValue, setDisplayValue] = React.useState(formatForDisplay(value));
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatForDisplay(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Remove any non-digit characters except /
    inputValue = inputValue.replace(/[^\d/]/g, '');
    
    // Auto-format as user types: dd/mm/yyyy
    if (inputValue.length > 0) {
      const digits = inputValue.replace(/\//g, '');
      let formatted = '';
      
      for (let i = 0; i < digits.length && i < 8; i++) {
        if (i === 2 || i === 4) {
          formatted += '/';
        }
        formatted += digits[i];
      }
      
      inputValue = formatted;
    }
    
    setDisplayValue(inputValue);
    
    // Try to parse if we have a complete date (dd/mm/yyyy = 10 chars)
    if (inputValue.length === 10) {
      const parsed = parseFromDisplay(inputValue);
      if (parsed && parsed !== value) {
        onChange(parsed);
        // If calendar is open, the selected date will update automatically via selectedDate
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFromDisplay(displayValue);
    if (parsed) {
      onChange(parsed);
      setDisplayValue(formatForDisplay(parsed));
    } else if (value) {
      setDisplayValue(formatForDisplay(value));
    } else {
      setDisplayValue('');
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = formatDateToString(date);
      onChange(dateStr);
      setDisplayValue(formatForDisplay(dateStr));
      setIsCalendarOpen(false);
    }
  };

  // Function to validate and get the date from input for calendar highlighting
  // This function checks the date inserted in the input and returns it for calendar highlighting
  const getSelectedDateForCalendar = React.useCallback((): Date | undefined => {
    // Get date from the value prop (YYYY-MM-DD format) - this is the source of truth
    if (value) {
      const dateFromValue = getDateFromValue(value);
      if (dateFromValue && !isNaN(dateFromValue.getTime())) {
        return dateFromValue;
      }
    }
    
    // If value is empty or invalid, return undefined
    // The calendar will show today's month but won't highlight any date
    return undefined;
  }, [value]);

  const selectedDate = getSelectedDateForCalendar();
  // Default to selected date's month, or today's month if no date selected
  const defaultMonth = calendarMonth || selectedDate || new Date();
  
  // Update calendar month when calendar opens or value changes
  React.useEffect(() => {
    if (isCalendarOpen) {
      // Parse date directly from value string to avoid dependency on selectedDate
      let dateToUse: Date | undefined;
      if (value) {
        const dateFromValue = getDateFromValue(value);
        if (dateFromValue && !isNaN(dateFromValue.getTime())) {
          dateToUse = dateFromValue;
        }
      }
      
      if (dateToUse) {
        const newMonth = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), 1);
        // Use functional update to avoid stale closure issues
        setCalendarMonth(prevMonth => {
          if (!prevMonth || prevMonth.getTime() !== newMonth.getTime()) {
            return newMonth;
          }
          return prevMonth;
        });
      } else {
        // Only set to today's month if calendarMonth is not already set
        setCalendarMonth(prevMonth => {
          if (!prevMonth) {
            const today = new Date();
            return new Date(today.getFullYear(), today.getMonth(), 1);
          }
          return prevMonth;
        });
      }
    }
  }, [isCalendarOpen, value]); // Only depend on value string, not Date objects

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder="jj/mm/aaaa"
        maxLength={10}
        className={cn("flex-1")}
        {...props}
      />
      <Popover 
        open={isCalendarOpen} 
        onOpenChange={(open) => {
          setIsCalendarOpen(open);
        }}
        modal={false}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "px-3",
              !value && "text-muted-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0" 
          align="start" 
          style={{ zIndex: 10008 }}
          onClick={(e) => {
            // Only stop propagation for clicks outside the calendar navigation
            const target = e.target as HTMLElement;
            // Allow calendar navigation buttons to work
            if (!target.closest('.rdp-nav_button') && !target.closest('.rdp-button')) {
              e.stopPropagation();
            }
          }}
          onPointerDown={(e) => {
            // Only stop propagation for pointer events outside the calendar navigation
            const target = e.target as HTMLElement;
            // Allow calendar navigation buttons to work
            if (!target.closest('.rdp-nav_button') && !target.closest('.rdp-button')) {
              e.stopPropagation();
            }
          }}
        >
          <Calendar
            key={selectedDate?.getTime() || 'no-date'} // Force re-render when selected date changes
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            defaultMonth={defaultMonth}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { DateInput };

