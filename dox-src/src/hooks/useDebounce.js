import { useState, useEffect } from 'react';

/**
 * Debounce hook for auto-save functionality
 *
 * Delays updating the returned value until after a specified delay has passed
 * since the last time the input value changed. Useful for auto-save operations
 * to avoid excessive API calls during typing.
 *
 * @param {*} value - The value to debounce
 * @param {number} delay - The delay in milliseconds (default: 1000ms)
 * @returns {*} The debounced value
 *
 * @example
 * const [text, setText] = useState('');
 * const debouncedText = useDebounce(text, 1000);
 *
 * useEffect(() => {
 *   // This will only run 1000ms after the user stops typing
 *   saveToServer(debouncedText);
 * }, [debouncedText]);
 */
export function useDebounce(value, delay = 1000) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if value changes before delay expires
    // or if component unmounts
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
