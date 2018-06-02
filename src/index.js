'use strict';

const fs = require('fs')
    , firefox = require('./firefox')
    , parser = require('./parser')
    , store = require('./store')

const timeout = ms => new Promise(res => setTimeout(res, ms));
const parseDelay = 500; // delay after page open
const jsonPath = 'chords.json';
const forceUpdateTexts = false;

const chordsParser = {
    // run parser
    async run() {
        let placesPath = firefox.getPlacesPath();
        let bookmarks = await firefox.getBookmarksDirectory(placesPath, 'аккорды');
        let storedSongs = store.loadJson(jsonPath);
        let songs = await this.parseBookmarks(bookmarks, storedSongs);
        let stats = store.saveJson(songs, jsonPath);
        this.log(jsonPath + ' saved, size: ' + (stats.size / 1000) + ' KB');
    },

    log(msg) {
        console.log(msg);
    },

    // convert bookmarks to array of songs with chords
    async parseBookmarks(bookmarks, storedSongs) {
        // bookmarks = bookmarks.slice(0, 10);
        let songs = [];
        this.log('parsing started, bookmarks: ' + bookmarks.length);
        console.time('parse');
        for(let bookmark of bookmarks){
            console.log(`${bookmark.title} - ${bookmark.url}`);
            let storedSong = this.searchSongByUrl(bookmark.url, storedSongs);
            try{
                let data = await this.parseBookmark(bookmark, storedSong);
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
    async parseBookmark(bookmark, storedSong) {
        // build song
        const { title, url } = bookmark;
        const song = { title, url };
        if(storedSong){
            song.text = storedSong.text;
            song.created = storedSong.created || new Date().toJSON();
        } else {
            song.created = new Date().toJSON()
        }

        song.details = parser.parseTitle(bookmark.title)

        // get chords from html
        if(!song.text || forceUpdateTexts){
            let selector = parser.getChordsSelector(bookmark.url);
            if(selector){
                song.text = await parser.getTextByUrl(bookmark.url, selector);
                let textLines = song.text.split('\n');
                console.log(textLines[0]);
                console.log(textLines[1]);
                await timeout(1000);
            }
        }

        console.log('----------');
        return song;
    },

    searchSongByUrl(url, storedSongs){
        let found = storedSongs.filter(song => song.url == url);

        if(found.length == 0){
            this.log('new song: ' + url)
            return false;
        } else if(found.length > 1){
            this.log('found duplicate: ' + url);
        }
        return found[0];
    }
};

chordsParser.run();
