"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { cn } from "./utils";

interface MultiSelectOption {
  id: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = "Sélectionner...",
  disabled = false,
  className,
  triggerClassName,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOptions = options.filter((option) => value.includes(option.id));

  const handleToggle = (optionId: string) => {
    const newValue = value.includes(optionId)
      ? value.filter((id) => id !== optionId)
      : [...value, optionId];
    onChange(newValue);
  };

  const handleRemove = (e: React.MouseEvent, optionId: string) => {
    e.stopPropagation();
    onChange(value.filter((id) => id !== optionId));
  };

  const displayText =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
      ? selectedOptions[0].label
      : `${selectedOptions.length} sélectionné(s)`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal",
            !selectedOptions.length && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[var(--radix-popover-trigger-width)] p-0 h-[120px] flex flex-col overflow-hidden", className)} align="start">
        <div className="multi-select-scroll flex-1 overflow-y-auto overflow-x-hidden p-1.5">
          {options.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Aucune option disponible
            </div>
          ) : (
            <div className="space-y-1 pr-1">
              {options.map((option) => {
                const isSelected = value.includes(option.id);
                return (
                  <div
                    key={option.id}
                    className={cn(
                      "flex items-center space-x-2 rounded-sm px-2 py-1 hover:bg-accent cursor-pointer",
                      isSelected && "bg-accent"
                    )}
                    onClick={() => handleToggle(option.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggle(option.id)}
                      className="pointer-events-none"
                    />
                    <label
                      className={cn(
                        "flex-1 text-sm cursor-pointer",
                        isSelected && "font-medium"
                      )}
                    >
                      {option.label}
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

