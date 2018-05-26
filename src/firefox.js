'use strict';

const fs = require('fs')
    , ini = require('ini')
    , db = require('sqlite')

// parse profiles.ini, find default profile and return profile's places.sqlite
exports.getPlacesPath = () => {
    let basePath = process.env.APPDATA + '/Mozilla/Firefox';
    let f = ini.parse(fs.readFileSync(basePath + '/profiles.ini', 'utf-8'));
    for (let i = 0; i < 10; i++) {
        let profile = f['Profile' + i];
        if (profile.Default == 1) {
            return (profile.IsRelative == 1 ? basePath + '/' : '') + profile.Path + '/places.sqlite';
        }
    }
    return false;
}

// get bookmarks from directory
exports.getBookmarksDirectory = async (placesPath, dirname) => {
    // let sqliteRaw = fs.readFileSync(placesPath);
    try {
        await db.open(placesPath);
    } catch (error) {
        console.log('error openening database');
        throw error;
    }

    const menuId = await db.get("select id from moz_bookmarks where guid='menu________'")
    const dirId = await db.get("select id from moz_bookmarks where title = ? and parent = ?", dirname, menuId.id);

    const bookmarks = await db.all(`select moz_bookmarks.title, moz_places.url
    from moz_bookmarks
    inner join moz_places on moz_places.id = moz_bookmarks.fk
    where moz_bookmarks.parent = ?
    order by moz_bookmarks.title`, dirId.id);

    return bookmarks;
}
