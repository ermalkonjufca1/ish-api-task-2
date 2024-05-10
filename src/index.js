const AmazonScraper = require('./scraper');

/**
 * An example how you can run the amazon scraper
 */
const worker = async () => {
    try {
        const scraper = new AmazonScraper();
        await scraper.crawlCollections();
        await scraper.saveItems();
    } catch (e) {
        console.log("Error while scraping", e);
    }
}

worker()