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
  
  // Only close if clicking directly on the overlay, not on child elements
  if (e.target === e.currentTarget) {
    onClose();
  }
}
