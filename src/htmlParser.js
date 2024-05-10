const { BaseHtmlParser, ValueGrabber } = require('crawl-e');

module.exports = class HTMLParser extends BaseHtmlParser {
    entryPoint = null;

    constructor(entryPoint) {
        super()
        this.entryPoint = entryPoint;

        this.collectionNameGrabber = new ValueGrabber('a', this.logger, 'collection:name')
        this.collectionUrlGrabber = new ValueGrabber(
            'a @href',
            this.logger, 'collection:url',
            value => `${this.entryPoint}${value}`
        )
        this.propsGrabber = new ValueGrabber((box, context) => {
            let scriptObj = JSON.parse(box.html());
            return {
                containers: scriptObj.props.body[0].props.landingPage.containers,
                pagination: scriptObj.props.body[0].props.landingPage.pagination
            }
        }, this.logger, 'props')
    }

    parseCollectionBox(box, context) {
        return {
            name: this.collectionNameGrabber.grabFirst(box, context),
            url: this.collectionUrlGrabber.grabFirst(box, context),
        }
    }

    parseCollectionList(response, context, callback) {
        let { container, parsingContext } = this.prepareHtmlParsing(response.text, context)
        this.parseList(
            container,
            parsingContext,
            'collections',
            { box: '#pv-nav-container #pv-nav-home ~ div > ul > li:not(:first-child, :last-child)' }, // excluding first and last child by default (Alles, Sport) collection
            (box, context, cb) => cb(null, this.parseCollectionBox(box, context)),
            callback
        )
    }

    parsePropsScript(box, context) {
        return this.propsGrabber.grabFirst(box, context)
    }

    parseProps(response, context, callback) {
        let { container, parsingContext } = this.prepareHtmlParsing(response.text, context)
        this.parseList(
            container,
            parsingContext,
            'collections',
            { box: 'script[type="text/template"]:not([id])' },
            (box, context, cb) => cb(null, this.parsePropsScript(box, context)),
            callback
        )
    }
}