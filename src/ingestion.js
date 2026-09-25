// Load environment variables from .env file
require('dotenv').config();

// Require scrapers for Google Play Store and Apple App Store
const gplay = require('google-play-scraper').default || require('google-play-scraper');
const appStore = require('app-store-scraper');

// Read Target App IDs from environment or use default placeholders (Spotify)
const PLAY_STORE_APP_IDS = (process.env.PLAY_STORE_APP_IDS || 'com.spotify.music').split(',').map(s => s.trim());
const APP_STORE_APP_IDS = (process.env.APP_STORE_APP_IDS || 'com.spotify.client').split(',').map(s => s.trim());

// Configuration for how far back to fetch reviews
const WEEKS_TO_FETCH = 12;
const MS_IN_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Fetches recent reviews from the Google Play Store and normalizes them.
 * @param {string} appId - The Play Store application ID (e.g., com.spotify.music)
 * @returns {Array} Array of normalized review objects
 */
async function fetchPlayStoreReviews(appId) {
    try {
        console.log(`[Ingestion] Fetching Play Store reviews for ${appId}...`);
        const result = await gplay.reviews({
            appId: appId,
            sort: gplay.sort.NEWEST,
            num: 200 // Fetch a chunk of recent reviews
        });
        
        // Map raw data into our unified schema
        return result.data.map(review => ({
            source: 'PLAY_STORE',
            appId: appId,
            id: review.id,
            rating: review.score,
            title: review.title || '',
            text: review.text || '',
            date: new Date(review.date)
        }));
    } catch (error) {
        console.error(`[Ingestion] Failed to fetch Play Store reviews for ${appId}:`, error.message);
        return [];
    }
}

/**
 * Fetches recent reviews from the Apple App Store and normalizes them.
 * @param {string} appId - The App Store application ID
 * @returns {Array} Array of normalized review objects
 */
async function fetchAppStoreReviews(appId) {
    try {
        console.log(`[Ingestion] Fetching App Store reviews for ${appId}...`);
        // We fetch the first 2 pages to get a good chunk of recent reviews
        let allReviews = [];
        for (let page = 1; page <= 2; page++) {
            const reviews = await appStore.reviews({
                appId: appId,
                sort: appStore.sort.RECENT,
                page: page
            });
            allReviews = allReviews.concat(reviews);
        }

        // Map raw data into our unified schema
        return allReviews.map(review => ({
            source: 'APP_STORE',
            appId: appId,
            id: review.id,
            rating: review.score,
            title: review.title || '',
            text: review.text || '',
            date: new Date(review.updated || review.date || Date.now()) // Fallback date if missing
        }));
    } catch (error) {
        console.error(`[Ingestion] Failed to fetch App Store reviews for ${appId}:`, error.message);
        return [];
    }
}

/**
 * Main orchestration function for ingestion. 
 * Fetches from both stores for all configured apps, unifies the data, and filters by date.
 */
async function fetchAndNormalizeReviews() {
    console.log('[Ingestion] Starting data ingestion...');
    
    // Fetch data concurrently for all configured apps
    const playStorePromises = PLAY_STORE_APP_IDS.map(id => fetchPlayStoreReviews(id));
    const appStorePromises = APP_STORE_APP_IDS.map(id => fetchAppStoreReviews(id));

    const playStoreResults = await Promise.all(playStorePromises);
    const appStoreResults = await Promise.all(appStorePromises);

    const playStoreData = playStoreResults.flat();
    const appStoreData = appStoreResults.flat();

    // Determine the cutoff date based on WEEKS_TO_FETCH
    const cutoffDate = new Date(Date.now() - (WEEKS_TO_FETCH * MS_IN_WEEK));

    
    // Helper function to normalize text (English only, no emojis, min 5 words)
    function cleanAndValidateReview(review) {
        if (!review.text) return false;
        
        // Remove emojis and non-ASCII (foreign) characters
        let cleanedText = review.text.replace(/[^\x00-\x7F]/g, '').trim();
        
        // If text loses too much length after stripping (likely a different language like Arabic)
        if (cleanedText.length < review.text.length * 0.5) return false;
        
        // Count words
        const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
        if (words.length < 5) return false;
        
        // Apply cleaned text
        review.text = cleanedText.replace(/\s+/g, ' ');
        return true;
    }

    // Filter out reviews that are older than our cutoff date and apply text normalization
    const filteredPlayStore = playStoreData.filter(review => {
        if (isNaN(review.date.getTime())) return false;
        if (review.date < cutoffDate) return false;
        return cleanAndValidateReview(review);
    });

    const filteredAppStore = appStoreData.filter(review => {
        if (isNaN(review.date.getTime())) return false;
        if (review.date < cutoffDate) return false;
        return cleanAndValidateReview(review);
    });

    console.log(`[Ingestion] Retrieved ${filteredPlayStore.length} Play Store reviews and ${filteredAppStore.length} App Store reviews from the last ${WEEKS_TO_FETCH} weeks.`);
    
    return {
        playStoreReviews: filteredPlayStore,
        appStoreReviews: filteredAppStore
    };
}

// If this script is run directly from the CLI (e.g., `node src/ingestion.js`),
// it will execute the ingestion process and save the output to data/reviews.json
if (require.main === module) {
    const fs = require('fs');
    const path = require('path');
    
    fetchAndNormalizeReviews().then(data => {
        const dataDir = path.join(__dirname, '..', 'data');
        // Create the data directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }
        
        // Save the Play Store reviews
        const playStorePath = path.join(dataDir, 'play_store_reviews.json');
        fs.writeFileSync(playStorePath, JSON.stringify(data.playStoreReviews, null, 2));
        console.log(`[Ingestion] Saved ${data.playStoreReviews.length} Play Store reviews to ${playStorePath}`);

        // Save the App Store reviews
        const appStorePath = path.join(dataDir, 'app_store_reviews.json');
        fs.writeFileSync(appStorePath, JSON.stringify(data.appStoreReviews, null, 2));
        console.log(`[Ingestion] Saved ${data.appStoreReviews.length} App Store reviews to ${appStorePath}`);
    });
}

// Export the function for use in other modules (like the main orchestrator)
module.exports = {
    fetchAndNormalizeReviews
};
