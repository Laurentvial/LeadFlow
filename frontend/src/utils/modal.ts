// Track mouse position to detect drag operations
let mouseDownX = 0;
let mouseDownY = 0;
let mouseDownTime = 0;

if (typeof window !== 'undefined') {
  // Track mousedown position and time
  document.addEventListener('mousedown', (e) => {
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    mouseDownTime = Date.now();
  }, true);
}

/**
 * Creates a click handler for modal overlays that prevents closing
 * when text is being selected.
 * 
 * @param onClose - The function to call when the modal should be closed
 * @returns A click event handler that checks for text selection before closing
 */
export function createModalOverlayClickHandler(onClose: () => void) {
  return (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if there's selected text - if so, don't close the modal
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    
    // Check if this click was part of a drag operation (text selection)
    // If mouse moved significantly between mousedown and click, it was a drag
    const timeSinceMouseDown = Date.now() - mouseDownTime;
    const deltaX = Math.abs(e.clientX - mouseDownX);
    const deltaY = Math.abs(e.clientY - mouseDownY);
    // If mouse moved more than 5px or if it's been more than 100ms since mousedown, it was likely a drag/selection
    if ((deltaX > 5 || deltaY > 5) && timeSinceMouseDown < 1000) {
      return;
    }
    
    // Check if the click target is a selectable element (input, textarea, etc.)
    const target = e.target as HTMLElement;
    if (target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('input, textarea, [contenteditable="true"]')
    )) {
      return;
    }
    
    // Only close if clicking directly on the overlay, not on child elements
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
}

/**
 * Alternative handler that accepts an event parameter directly
 * Useful for inline handlers that need additional logic
 */
export function handleModalOverlayClick(
  e: React.MouseEvent<HTMLDivElement>,
  onClose: () => void
) {
  // Check if there's selected text - if so, don't close the modal
  const selection = window.getSelection();
  if (selection && selection.toString().length > 0) {
    return;
  }
  
  // Check if this click was part of a drag operation (text selection)
  // If mouse moved significantly between mousedown and click, it was a drag
  const timeSinceMouseDown = Date.now() - mouseDownTime;
  const deltaX = Math.abs(e.clientX - mouseDownX);
  const deltaY = Math.abs(e.clientY - mouseDownY);
  // If mouse moved more than 5px or if it's been more than 100ms since mousedown, it was likely a drag/selection
  if ((deltaX > 5 || deltaY > 5) && timeSinceMouseDown < 1000) {
    return;
  }
  
  // Check if the click target is a selectable element (input, textarea, etc.)
  const target = e.target as HTMLElement;
  if (target && (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    target.closest('input, textarea, [contenteditable="true"]')
  )) {
    return;
  }
  
  // Only close if clicking directly on the overlay, not on child elements
  if (e.target === e.currentTarget) {
    onClose();
  }
}
