const fs = require('fs')
    , cheerio = require('cheerio')
    , axios = require('axios')
    , firefox = require('./firefox')

console.log(firefox);
const timeout = ms => new Promise(res => setTimeout(res, ms));
const parseDelay = 500; // delay after page open
const userAgent = 'popstas/chords-parser';

const parser = {
    // run parser
    async run() {
        let placesPath = firefox.getPlacesPath();
        let bookmarks = await firefox.getBookmarksDirectory(placesPath, 'аккорды');
        let songs = await this.parseBookmarks(bookmarks);
        this.storeSongs(songs);
    },

    log(msg) {
        console.log(msg);
    },

    // convert bookmarks to array of songs with chords
    async parseBookmarks(bookmarks) {
        // bookmarks = bookmarks.slice(0, 100);
        let songs = [];
        this.log('parsing started, bookmarks: ' + bookmarks.length);
        console.time('parse');
        for(let bookmark of bookmarks){
            console.log(`${bookmark.title} - ${bookmark.url}`);
            try{
                let data = await this.parseBookmark(bookmark);
                songs.push(data);
            } catch(err){ 
                console.error('failed to parse ${bookmark.title}');
                console.error(err);
            }
        }
        this.log('parsing finished');
        console.timeEnd('parse');
        return songs;
    },

    // get data of song
    async parseBookmark(bookmark) {
        // build data
        const { title, url } = bookmark;
        const data = { title, url };

        data.details = this.parseTitle(bookmark.title)

        // get chords from html
        let selector = this.getChordsSelector(bookmark.url);
        if(selector){
            data.text = await this.getHtmlByUrlWithSelectorCheerio(bookmark.url, selector);
            let textLines = data.text.split('\n');
            console.log(textLines[0]);
            console.log(textLines[1]);
        }

        return data;
    },

    // get selector by url
    getChordsSelector(url){
        let selector = false;

        const domainSelectors = {
            'mychords.net': '.w-words__text',
            'hm6.ru': '.w-words__text',
            'amdm.ru': '[itemprop="chordsBlock"]',
        }

        for(domain in domainSelectors){
            let re = new RegExp(domain.replace('.', '\\.'));
            if(url.match(re)){
                selector = domainSelectors[domain];
                break;
            }
        }

        return selector;
    },

    // get html from url, with axios and cheerio
    async getHtmlByUrlWithSelectorCheerio(url, selector){
        let text = '';
        try{
            let response = await axios.get(url, { headers: {'User-Agent': userAgent}});
            const $ = cheerio.load(response.data);
            text = $(selector).text();
        } catch (err) {
            console.error(err);
        }
        await timeout(1000);
        return text;
    },

    // extract artist, title and chords from title
    parseTitle(title) {
        let parsedTitle = {
            artist: '',
            title: '',
            chords: '',
        }

        if (title.match(/аккорды/i)) {
            let matches = title.match(/(.*?) [-–] (.*)аккорды.*/);
            if(matches){
                parsedTitle = {
                    artist: matches[1].trim(),
                    title: matches[2].trim(),
                    chords: '',
                }
            }
        } else {
            let matches = title.match(/(.*?) - (.*),(.*)/);
            if(matches){
                parsedTitle = {
                    artist: matches[1].trim(),
                    title: matches[2].trim(),
                    chords: matches[3].trim(),
                }
            }
        }
        return parsedTitle;
    },

    // store songs data to json
    storeSongs(songs) {
        fs.writeFileSync('chords.json', JSON.stringify(songs), null, 2);
        const stats = fs.statSync('chords.json');
        this.log('chords.json saved, size: ' + (stats.size / 1000) + ' KB');
        /* fs.mkdir('songs');
        songs.forEach(song => {
            let md = render(fs.readFileSync('song.md.template'), { song });
        }); */
    },
};

parser.run();
