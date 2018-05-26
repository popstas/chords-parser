'use strict';

const fs = require('fs')
    , firefox = require('./firefox')
    , parser = require('./parser')

const timeout = ms => new Promise(res => setTimeout(res, ms));
const parseDelay = 500; // delay after page open

const chordsParser = {
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

chordsParser.run();
