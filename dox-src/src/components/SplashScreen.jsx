/**
 * Full-screen loading splash shown while the app settles its initial state —
 * checking for an existing session or resolving a workspace deep link
 * (/dox/?note=<id>). Prevents the login screen or the notes list from
 * flashing for a split second before the destination screen renders.
 */
export function SplashScreen({ dark }) {
  return (
    <div className={`min-h-screen ${dark ? 'dark' : ''} bg-white dark:bg-gray-900 flex items-center justify-center`}>
      <div className="animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 dark:bg-white/10 flex items-center justify-center animate-pulse">
          <svg
            className="w-8 h-8 text-yellow-500 dark:text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
