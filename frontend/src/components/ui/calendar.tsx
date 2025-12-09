"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react@0.487.0";
import { DayPicker } from "react-day-picker@8.10.1";
import "react-day-picker/dist/style.css";

import { cn } from "./utils";
import { buttonVariants } from "./button";

// Function to get today's date (normalized to start of day)
export function getTodayDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  // Function to check the date inserted in input with id="event-date" and return it
  // This function reads the date from the input field and highlights it in the calendar
  const getDateFromEventDateInput = React.useCallback((): Date | undefined => {
    try {
      // Find the input element with id="event-date"
      const eventDateInput = document.getElementById('event-date') as HTMLInputElement;
      
      if (!eventDateInput) {
        return undefined;
      }

      const inputValue = eventDateInput.value?.trim();
      
      if (!inputValue || inputValue === '') {
        return undefined;
      }

      // Try to parse DD/MM/YYYY format (common display format)
      const dateMatch = inputValue.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime()) && date.getFullYear() === parseInt(year)) {
          date.setHours(0, 0, 0, 0);
          return date;
        }
      }

      // Try to parse YYYY-MM-DD format (ISO format)
      const isoMatch = inputValue.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime()) && date.getFullYear() === parseInt(year)) {
          date.setHours(0, 0, 0, 0);
          return date;
        }
      }

      return undefined;
    } catch (error) {
      console.error('Error parsing date from event-date input:', error);
      return undefined;
    }
  }, []);

  // State to track date from input field
  const [dateFromInput, setDateFromInput] = React.useState<Date | undefined>(() => {
    // Try to get initial date from input
    return getDateFromEventDateInput();
  });
  
  // Update date from input when it changes - use both interval and event listeners
  React.useEffect(() => {
    // Function to update date
    const updateDate = () => {
      const newDate = getDateFromEventDateInput();
      setDateFromInput(prevDate => {
        const prevTime = prevDate?.getTime();
        const newTime = newDate?.getTime();
        
        // Only update if date actually changed
        if (newTime !== prevTime) {
          return newDate;
        }
        return prevDate;
      });
    };

    // Initial check after a short delay to ensure DOM is ready
    const initialTimeout = setTimeout(updateDate, 50);

    // Check for input changes periodically
    const checkInterval = setInterval(updateDate, 150); // Check every 150ms

    // Also listen to input events on the event-date input
    const eventDateInput = document.getElementById('event-date');
    const handleInputChange = () => {
      // Small delay to ensure value is updated
      setTimeout(updateDate, 10);
    };
    
    if (eventDateInput) {
      eventDateInput.addEventListener('input', handleInputChange);
      eventDateInput.addEventListener('change', handleInputChange);
      eventDateInput.addEventListener('blur', handleInputChange);
    }

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(checkInterval);
      if (eventDateInput) {
        eventDateInput.removeEventListener('input', handleInputChange);
        eventDateInput.removeEventListener('change', handleInputChange);
        eventDateInput.removeEventListener('blur', handleInputChange);
      }
    };
  }, [getDateFromEventDateInput]);

  // Use date from input if selected prop is not provided, otherwise use selected prop
  // Priority: props.selected > dateFromInput
  const finalSelectedDate = props.selected !== undefined && props.selected !== null 
    ? props.selected 
    : dateFromInput;

  // Debug: Log the selected date (remove in production)
  // Removed to prevent infinite loops - use React DevTools instead if needed

  // Get today's date for comparison (normalized to start of day)
  const today = getTodayDate();

  // Only set month from selected date if month prop is not provided
  const monthToUse = props.month !== undefined 
    ? props.month 
    : (finalSelectedDate ? new Date(finalSelectedDate.getFullYear(), finalSelectedDate.getMonth(), 1) : undefined);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      selected={finalSelectedDate}
      month={monthToUse}
      modifiers={{
        past: (date) => {
          const dateToCompare = new Date(date);
          dateToCompare.setHours(0, 0, 0, 0);
          return dateToCompare < today;
        },
      }}
      modifiersClassNames={{
        past: "rdp-day_past !text-gray-400 dark:!text-gray-500 !bg-gray-100 dark:!bg-gray-800/50 !opacity-70",
      }}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-x-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md [&:has([aria-selected='true'])]:bg-primary/10",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100 w-8 h-8 flex items-center justify-center",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "!bg-primary !text-primary-foreground hover:!bg-primary/90 focus:!bg-primary !font-bold !ring-2 !ring-primary !ring-offset-1 !rounded-md",
        day_today: cn(
          "!bg-blue-500 dark:!bg-blue-600 !text-white",
          "!font-semibold !border-2 !border-blue-600 dark:!border-blue-500",
          "hover:!bg-blue-600 dark:hover:!bg-blue-700",
          "hover:!scale-105 hover:!shadow-lg",
          "transition-all duration-200 ease-in-out",
          "rounded-md"
        ),
        day_outside:
          "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("size-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("size-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
