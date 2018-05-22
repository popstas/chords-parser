const fs = require('fs')
    , ini = require('ini')
    , db = require('sqlite')
    , cheerio = require('cheerio')
    , axios = require('axios')

const timeout = ms => new Promise(res => setTimeout(res, ms));
const parseDelay = 1000; // delay after page open

const parser = {
    // run parser
    async run() {
        let placesPath = this.getPlacesPath();
        // let placesPath = 'places.sqlite';
        let bookmarks = await this.getChordsBookmarks(placesPath, 'аккорды');
        let songs = await this.parseBookmarks(bookmarks);
        this.storeSongs(songs);
    },

    log(msg) {
        console.log(msg);
    },

    // parse profiles.ini, find default profile and return profile's places.sqlite
    getPlacesPath() {
        let basePath = process.env.APPDATA + '/Mozilla/Firefox';
        let f = ini.parse(fs.readFileSync(basePath + '/profiles.ini', 'utf-8'));
        for (let i = 0; i < 10; i++) {
            let profile = f['Profile' + i];
            if (profile.Default == 1) {
                return (profile.IsRelative == 1 ? basePath + '/' : '') + profile.Path + '/places.sqlite';
            }
        }
        return false;
    },

    // get bookmarks from chords directory
    async getChordsBookmarks(placesPath, chordsDirname) {
        // let sqliteRaw = fs.readFileSync(placesPath);
        try {
            await db.open(placesPath);
        } catch (error) {
            console.log('error openening database');
            throw error;
        }

        const menuId = await db.get("select id from moz_bookmarks where guid='menu________'")
        const dirId = await db.get("select id from moz_bookmarks where title = ? and parent = ?", chordsDirname, menuId.id);

        const bookmarks = await db.all(`select moz_bookmarks.title, moz_places.url
        from moz_bookmarks
        inner join moz_places on moz_places.id = moz_bookmarks.fk
        where moz_bookmarks.parent = ?
        order by moz_bookmarks.title`, dirId.id);

        return bookmarks;
    },

    // convert bookmarks to array of songs with chords
    async parseBookmarks(bookmarks) {
        // bookmarks = bookmarks.slice(0, 100);
        let songs = [];
        this.log('parsing started, bookmarks: ' + bookmarks.length);
        console.time('parse');
        for(let bookmark of bookmarks){
            console.log(bookmark.title);
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
            //data.html = await this.getHtmlByUrlWithSelector(bookmark.url, selector);
            data.html = await this.getHtmlByUrlWithSelectorCheerio(bookmark.url, selector);
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
            let response = await axios.get(url);
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
