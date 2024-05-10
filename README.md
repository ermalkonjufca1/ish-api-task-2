# International Showtimes API - Task 2

Scraper to collect movies/tv shows on platform 'Amazon Prime Videos', using Crawl-E framework.\
Since the platform is built using React, not all the items are available to crawl on first load, as I saw and analyzed the documentation of Crawl-E Framework, is based on cheerio, it is not built to scrape SPA websites, so it cannot listed for changes after the DOM content has ben loaded. Also, I didn't see any way to intercept on the headers or on the requests, which I think I needed to built with scraper.\
\
So I followed up the way how amazon parses the items on their platform, and built a scraper which is on ./src/scraper.js. I used axios package to make requests with custom headers and parameters.\
There is a list of user agents on ./src/userAgents.js as well, which I used to make requests to go through paginations.\
In order to get most of the excepted data, I needed to use VPN (Germany)\
To run the example on index.js execute this command `npm run scraper`.\
When scraper finish the job, output json file will be on ./output/index.js

## NOTES
Class from Crawl-E framework `JsonFileWriter`, I think has a limitation, since it cannot save all items.\
Please use _saveItems() function as an alternative to save the file\


## Reference

* `Collection/s`   Is a list of containers, eg. collection of movies, collection of tv show. Collection can be a list as well.
* `Container/s`   Refers to carousels that are on UI of the website (Amazon Prime Videos), there are three types: standart carousels, super carousels and hero carousels
* `Item/s`   Refers to one entity which can be a movie or a tv show scraped.
* `SPA`   Single page applications


## Useful commands

* `npm run scraper`   Run the scraper