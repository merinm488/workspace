/**
 * Tooltip Component
 *
 * Provides instant tooltip feedback without browser delay
 * Automatically positions above or below based on available space
 * Disabled on mobile devices for better UX
 */
import { useState, useRef, useEffect } from 'react';

export function Tooltip({ children, text }) {
  const [showAbove, setShowAbove] = useState(true);
  const [horizontalPosition, setHorizontalPosition] = useState('center');
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    // Check if device is mobile (screen width < 1024px)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (containerRef.current && !isMobile) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Show below if not enough space above
      setShowAbove(spaceAbove > 100);

      // Calculate horizontal position to prevent cutoff
      const tooltipWidth = text.length * 8 + 20; // Estimate width
      const spaceLeft = rect.left;
      const spaceRight = window.innerWidth - rect.right;
      const centerX = rect.left + rect.width / 2;

      // Use right alignment if near right edge
      if (spaceRight < tooltipWidth / 2 && spaceLeft > spaceRight) {
        setHorizontalPosition('right');
      }
      // Use left alignment if near left edge
      else if (spaceLeft < tooltipWidth / 2 && spaceRight > spaceLeft) {
        setHorizontalPosition('left');
      }
      // Default to center
      else {
        setHorizontalPosition('center');
      }
    }
  }, [isMobile, text]);

  // On mobile, just return children without tooltip
  if (isMobile) {
    return <>{children}</>;
  }

  const getPositionClasses = () => {
    switch (horizontalPosition) {
      case 'left':
        return 'left-0';
      case 'right':
        return 'right-0';
      default:
        return 'left-1/2 -translate-x-1/2';
    }
  };

  const getArrowPositionClasses = () => {
    switch (horizontalPosition) {
      case 'left':
        return 'left-4';
      case 'right':
        return 'right-4';
      default:
        return 'left-1/2 -translate-x-1/2';
    }
  };

  return (
    <div ref={containerRef} className="relative group inline-block">
      {children}
      <div
        className={`absolute ${getPositionClasses()} px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${
          showAbove ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}
      >
        {text}
        <div
          className={`absolute ${getArrowPositionClasses()} border-4 border-transparent ${
            showAbove
              ? 'top-full border-t-gray-900 dark:border-t-gray-100'
              : 'bottom-full border-b-gray-900 dark:border-b-gray-100'
          }`}
        ></div>
      </div>
    </div>
  );
}
