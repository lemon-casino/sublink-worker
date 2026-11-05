/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
export const ThemeToggle = ({ label }) => {
    return (
        <button
            id="theme-toggle"
            type="button"
            class="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-600 shadow-lg backdrop-blur-md transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-500 dark:border-gray-700 dark:bg-gray-800/90 dark:text-gray-200 dark:hover:bg-gray-700"
            style="bottom: max(1.5rem, env(safe-area-inset-bottom)); right: max(1.5rem, env(safe-area-inset-right))"
            x-on:click="toggleDarkMode()"
            x-bind:aria-pressed="darkMode"
            aria-label={label}
            title={label}
        >
            <i class="fas" aria-hidden="true" x-bind:class="darkMode ? 'fa-sun' : 'fa-moon'"></i>
        </button>
    );
};
