'use strict';

const fs = require('fs')
    , firefox = require('./firefox')
    , parser = require('./parser')
    , store = require('./store')

const timeout = ms => new Promise(res => setTimeout(res, ms));
const parseDelay = 500; // delay after page open
const jsonPath = 'chords.json';

const chordsParser = {
    // run parser
    async run() {
        let placesPath = firefox.getPlacesPath();
        let bookmarks = await firefox.getBookmarksDirectory(placesPath, 'аккорды');
        let songs = await this.parseBookmarks(bookmarks);
        let stats = store.saveJson(songs, jsonPath);
        this.log(jsonPath + ' saved, size: ' + (stats.size / 1000) + ' KB');
    },

    log(msg) {
        console.log(msg);
    },

    // convert bookmarks to array of songs with chords
    async parseBookmarks(bookmarks) {
        // bookmarks = bookmarks.slice(0, 10);
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

        data.details = parser.parseTitle(bookmark.title)

        // get chords from html
        let selector = parser.getChordsSelector(bookmark.url);
        if(selector){
            data.text = await parser.getTextByUrl(bookmark.url, selector);
            let textLines = data.text.split('\n');
            console.log(textLines[0]);
            console.log(textLines[1]);
            console.log('----------');
            await timeout(1000);
        }

        return data;
    }
};

chordsParser.run();
