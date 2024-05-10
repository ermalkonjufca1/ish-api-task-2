const axios = require('axios');
const fs = require('fs').promises;
const userAgent = require('./userAgents.js');
const HTMLParser = require('./htmlParser.js');
const { DefaultContext, DefaultLogger, DefaultRequestMaker, JsonFileWriter } = require('crawl-e');

module.exports = class AmazonScraper {
    constructor() {
        this.items = [];

        this.context = new DefaultContext();
        this.logger = new DefaultLogger();
        this.requestMaker = new DefaultRequestMaker();
        this.outputWriter = new JsonFileWriter();
        this.HTMLParser = new HTMLParser('https://www.amazon.de');

        this.requestMaker.logger = this.logger;
        this.HTMLParser.logger = this.logger;
        this.outputWriter.logger = this.logger;

        this.reqHeaders = {
            'accept': 'application/json',
            'referer': 'https://www.amazon.de/gp/video/storefront/',
            'user-agent': userAgent.random(),
            'x-requested-with': 'XMLHttpRequest',
            'viewport-width': '1920'
        };
    }

    /**
     * Get List names and urls with Crawl-E Framework,where the items that needs to be scraped are
     * @returns {Promise} - Will be resolved with collection list parsed from HTMLParser Class
     */
    getListsUrls() {
        console.log("Getting lists urls");
        return new Promise((resolve, reject) => {
            this.requestMaker.get('https://www.amazon.de/gp/video/storefront', this.context, (err, res) => {
                if (err) return reject(`Error while trying to get html content: ${err}`);
                console.log('Res status is: ', res.status, '🙂')

                this.HTMLParser.parseCollectionList(res, this.context, (err, collections) => {
                    if (err) return reject(err);
                    console.log(`found ${collections.length} collections`)
                    resolve(collections);
                })
            })
        });
    }

    /**
     * Get First containers on the first load from props object using Crawl-E Framework
     * @param {string} listUrl 
     * @returns {Promise} - Will be resolved with props object which is on the DOM
     */
    getFirstContainers(listUrl) {
        console.log(`Getting first containers (HTML content) for the first time at list url: ${listUrl}`)

        return new Promise((resolve, reject) => {
            this.requestMaker.get(listUrl, this.context, (err, res) => {
                if (err) return reject(`Error while trying to get html content: ${err}`);
                console.log('Res status is: ', res.status, '🙂')

                this.HTMLParser.parseProps(res, this.context, (err, props) => {
                    if (err) return reject(err);
                    resolve(props[0]);
                })
            })
        });
    }

    /**
     * Function that will return a formatted object based on requirements of the task.
     * @param {object} - { entityType, title, titleID, synopsis, link, maturityRatingBadge }
     * @returns {object} - { contentID, title, type, description, ageRating, url }
     */
    parseItem({ entityType, title, titleID, synopsis, link, maturityRatingBadge }) {
        return {
            contentID: titleID,
            title: title,
            type: entityType,
            description: synopsis,
            ageRating: maturityRatingBadge?.displayText || null,
            url: `https://www.amazon.de${link.url}`,
        };
    }

    /**
     * Funtion helper to pass only items with id's and exclude items that are not movies or tv shows
     * @param {array} entities 
     * @returns {array} - formatted data
     */
    parseItems(entities) {
        const data = [];

        for (let i = 0; i < entities.length; i++) {
            (entities[i]?.titleID !== undefined) && data.push(this.parseItem(entities[i]));
        }

        return data;
    }

    /**
     * Collect all items (movies/tv shows) of one container
     * Is the same as scrolling horizontally (sliding) the container or carousel on UI
     * @param {object} parentQP - parent query parameters
     * @param {object} childQP - child query parameters
     * @returns {object} - with {items: array | null, hasMoreItems: boolean, _pagination: object | null}
     */
    async collectContainerItems(parentQP, childQP) {
        const data = { _items: null, hasMoreItems: false, _pagination: null };
        try {
            console.log(`Collection container items, start index: ${childQP.startIndex}`)
            const res = await axios({
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://www.amazon.de/gp/video/api/paginateCollection?pageType=movie&pageId=home&collectionType=Container&paginationTargetId=${childQP.paginationTargetId}&serviceToken=${childQP.serviceToken}&startIndex=${childQP.startIndex}&isCleanSlateActive=1&isDiscoverActive=1&isLivePageActive=1&variant=desktopWindows&actionScheme=${parentQP.actionScheme}&payloadScheme=default&decorationScheme=${parentQP.decorationScheme}&featureScheme=${parentQP.decorationScheme}&${parentQP.dynamicFeatures.map(df => `dynamicFeatures=${df}`).join('&')}&widgetScheme=${parentQP.widgetScheme}&journeyIngressContext=${childQP.journeyIngressContext}&isRemasterEnabled=0`,
                headers: this.reqHeaders
            })
            if (res.status !== 200) throw Error('Res status is not 200');

            data._items = this.parseItems(res.data.entities);
            data.hasMoreItems = res.data.hasMoreItems;
            data._pagination = res.data.pagination;
        } catch (e) {
            console.log(`Error while collecting container items`, e);
        }
        return data;
    }

    /**
     * Crawl all items that are on containers (passed parameter), usually we have 6 containers by default
     * For every container we will get exited container entities first and check if that container has pagination.
     * Using collectContainerItems function we will collect every item of a container. Basically we scroll horizontally or slide the carousel to the right on UI
     * We need parent query parameters while scrolling horizontally (sliding) so we should pass them on collectContainerItems function
     * @param {array} containers - that has entities and other pagination details on it
     * @param {object} parentQP - parent query parameters
     */
    async crawlCollectionItems(containers, parentQP) {
        try {
            console.log(`For every part of bunch containers we gonna get every item on them, total containers on this run: ${containers.length}`);
            for (let i = 0; i < containers.length; i++) {
                console.log(`Total estimation on this container is: ${containers[i].estimatedTotal}`)
                this.items.push(...this.parseItems(containers[i].entities));
                let hasPagination = containers[i]?.paginationTargetId ? true : false;

                let pagination = null;
                while (hasPagination) {
                    console.log(`This container has horizontal pagination, we gonna continue collection items on this container until there is no more!`);
                    const childQP = pagination ? {
                        paginationTargetId: pagination.queryParameters.targetId,
                        serviceToken: pagination.queryParameters.serviceToken,
                        startIndex: pagination.queryParameters.startIndex,
                        journeyIngressContext: containers[i].journeyIngressContext
                    } : {
                        paginationTargetId: containers[i].paginationTargetId,
                        serviceToken: containers[i].paginationServiceToken,
                        startIndex: containers[i].paginationStartIndex,
                        journeyIngressContext: containers[i].journeyIngressContext
                    }

                    const { _items, hasMoreItems, _pagination } = await this.collectContainerItems(parentQP, childQP);
                    this.items.push(..._items);
                    pagination = _pagination
                    hasPagination = hasMoreItems;
                }
            }
        } catch (e) {
            console.log('Error while crawling items from containers: ', e);
        }
    }

    /**
     * Collect containers on collection list. Usually they come on batch size 6
     * @param {object} qp - Query parameters
     * @returns {object} - with {_containers: array | null, _pagination: object | null}
     */
    async collectContainers(qp) {
        const data = { _containers: null, _pagination: null };

        try {
            console.log(`Collection containers of content type ${qp.contentType}`)
            const res = await axios({
                method: 'GET',
                url: `https://www.amazon.de/gp/video/api/getLandingPage?pageType=${qp.contentType}&pageId=${qp.contentId}&pageNumber=${qp.pageNumber}&pageSize=${qp.pageSize}&startIndex=${qp.startIndex}&serviceToken=${qp.serviceToken}&isLivePageActive=1&targetId=${qp.targetId}&variant=desktopWindows&actionScheme=${qp.actionScheme}&payloadScheme=default&decorationScheme=${qp.decorationScheme}&featureScheme=${qp.featureScheme}&${qp.dynamicFeatures.map(df => `dynamicFeatures=${df}`).join('&')}&widgetScheme=${qp.widgetScheme}&isRemasterEnabled=0`,
                headers: this.reqHeaders
            });
            if (res.status !== 200) throw Error('Res status is not 200');
            if (res.data.hasFailed) throw Error('Requst has failed');

            data._containers = res.data.containers;
            data._pagination = res.data?.pagination || null;
        } catch (e) {
            console.log(`Error while collecting standart carousel container`, e);
        }

        return data;
    }


    /**
     * Save Items collected on file using crawl-e framework, into a folder called output on rootDir
     * @returns {Promise} - Will be resolved when file has been successfully saved
     */
    saveItems() {
        return new Promise((resolve, reject) => {
            this.outputWriter.saveFile(this.items, this.context, (err) => {
                if (err) {
                    console.error(`Oh noo, sth. wen't wrong: ${err}`)
                    reject(err);
                }
                resolve();
            })
        });
    }

    /**
   * Save Items collected on file using crawl-e framework, into a folder called output on rootDir
     */
    async _saveItems() {
        try {
            console.log('Saving items...');

            try {
                await fs.mkdir('output');
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
            await fs.writeFile('output/index.json', JSON.stringify(this.items, null, 2));

            console.log(`Items has been saved successfully`);
        } catch (e) {
            console.log('Error while saving file', e);
        }
    }

    /**
     * crawl Collections function
     * Firstly we make a request to get lists objects with url and name (movies & tv shows)
     * For every list scraped, we get starter containers and we collect items that are there, these containers has paginations horizontally, so we need to slide them like on UI until we have data
     * After collecting items on first containers we check for other containers using pagination, so if there is pagination like on UI we scroll vertically
     * The same process goes for every batch of containers.
     * By default containers size in one run is 6.
     */
    async crawlCollections() {
        try {
            const list = await this.getListsUrls();
            console.log(`Total lists urls length ${list.length}`);

            for (let i = 0; i < list.length; i++) {
                console.log(`Crawling list ${list[i].name}`)
                let { containers, pagination } = await this.getFirstContainers(list[i].url);
                await this.crawlCollectionItems(containers, pagination.queryParameters);

                let hasPagination = pagination ? true : false;
                while (hasPagination) {
                    console.log(`The list ${list[i].name} (${list[i].url}) has pagination vertically, we gonna continue collection containers until there is no more!, Items size until now: ${this.items.length}`)
                    const { _containers, _pagination } = await this.collectContainers(pagination.queryParameters);
                    await this.crawlCollectionItems(_containers, pagination.queryParameters);
                    pagination = _pagination
                    hasPagination = _pagination ? true : false;
                }
            }

            require('fs').writeFileSync('./test.json', JSON.stringify(this.items));
        } catch (e) {
            console.log('Error while crawling collection', e);
        }
    }
}