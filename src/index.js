const AmazonScraper = require('./scraper');

/**
 * An example how you can run the amazon scraper
 */
const worker = async () => {
    try {
        const crawler = new AmazonScraper();
        await crawler.crawlCollections();
        await crawler.saveItems();
    } catch (e) {
        console.log("Error while scraping", e);
    }
}

worker()