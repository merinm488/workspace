/**
 * ================================================
 * GRIDS - Configuration File
 * ================================================
 * This file contains all application-wide configuration
 * settings and constants.
 *
 * TODO: Customize these settings based on your needs
 */

// ================================================
// Application Configuration
// ================================================

const APP_CONFIG = {
    name: 'Grids',
    version: '1.0.0',
    description: 'Modern spreadsheet application with Excel-like features',

    // Environment detection
    isProduction: window.location.hostname !== 'localhost' &&
                  window.location.hostname !== '127.0.0.1' &&
                  !window.location.hostname.startsWith('192.168.'),

    // Storage configuration
    storage: {
        // TextDB configuration for production
        // Note: Collection ID is handled server-side in api/storage.js
        // Client-side code only needs the API endpoint
        textDB: {
            baseUrl: 'https://textdb.dev/api/data',
            // These are placeholder values - actual values are set server-side
            collectionId: 'handled-server-side',
            apiKey: 'handled-server-side',
        },

        // Local storage keys
        keys: {
            spreadsheetData: 'grids_spreadsheet_data',
            theme: 'grids_theme',
            recentFiles: 'grids_recent_files',
            userSettings: 'grids_user_settings',
        },
    },

    // Spreadsheet configuration
    spreadsheet: {
        container: 'univer',
        lang: 'en', // Language
        showinfobar: false, // Show infobar
        showsheetbar: true, // Show sheet bar
        showstatisticBar: true, // Show statistic bar
        enableAddRow: true, // Allow adding rows
        enableAddBackTop: true, // Allow scrolling to top
        userInfo: false, // User info display
        myFolderUrl: false, // Folder URL

        // TODO: Configure default spreadsheet settings
        default: {
            row: 84, // Default rows
            column: 60, // Default columns
            fontSize: 11, // Default font size
            defaultColWidth: 73, // Default column width
            defaultRowHeight: 19, // Default row height
        },

        // TODO: Configure available features
        features: {
            enableFormula: true, // Enable formulas
            enableChart: true, // Enable charts
            enableMultiSheet: true, // Enable multiple sheets
            enableCellFormat: true, // Enable cell formatting
            enableImportExport: true, // Enable import/export
            enableUndoRedo: true, // Enable undo/redo
            enableFreeze: true, // Enable freeze rows/columns
        },

        // TODO: Configure toolbar options
        toolbar: {
            // Available toolbar buttons
            // TODO: Customize toolbar buttons based on requirements
        },
    },

    // Theme configuration
    themes: {
        default: 'light',
        available: ['light', 'dark'],
        storageKey: 'grids_theme',
    },

    // API endpoints
    api: {
        // TODO: Add API endpoints if needed
        textDB: 'https://textdb.dev/api/data',
    },

    // Auto-save configuration
    autoSave: {
        enabled: true,
        interval: 30000, // Auto-save interval in milliseconds (30 seconds)
        // TODO: Implement auto-save logic
    },

    // Import/Export configuration
    importExport: {
        // TODO: Configure import/export options
        supportedFormats: ['xlsx', 'csv'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
    },
};

// ================================================
// Utility Functions
// ================================================

/**
 * Get environment-specific storage configuration
 * TODO: Implement environment detection logic
 */
function getStorageConfig() {
    // TODO: Return appropriate storage config based on environment
    return APP_CONFIG.isProduction
        ? APP_CONFIG.storage.textDB
        : { useLocalStorage: true };
}

/**
 * Get spreadsheet initialization options
 * TODO: Build Univer options object
 */
function getSpreadsheetOptions(data = null) {
    // Options are built in js/spreadsheet.js (createUniverInstance)
    return { container: APP_CONFIG.spreadsheet.container };
}

/**
 * Save configuration to local storage
 * TODO: Implement configuration persistence
 */
function saveConfig() {
    // TODO: Save user preferences to local storage
}

/**
 * Load configuration from local storage
 * TODO: Implement configuration loading
 */
function loadConfig() {
    // TODO: Load user preferences from local storage
}

// ================================================
// Export configuration
// ================================================

// For debugging
if (typeof window !== 'undefined') {
    window.APP_CONFIG = APP_CONFIG;
}
