'use strict';

const fs = require('fs'),
  ini = require('ini'),
  db = require('sqlite');

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
};

// get bookmarks from directory
exports.getBookmarksDirectory = async (placesPath, dirname) => {
  // let sqliteRaw = fs.readFileSync(placesPath);
  try {
    await db.open(placesPath);
  } catch (error) {
    console.log('error openening database');
    throw error;
  }

  // get directory id
  const menuId = await db.get("select id from moz_bookmarks where guid='menu________'");
  const dirId = await db.get(
    'select id from moz_bookmarks where title = ? and parent = ?',
    dirname,
    menuId.id
  );

  // get bookmarks title and url
  const bookmarks = await db.all(
    `select moz_bookmarks.fk as id, moz_bookmarks.title, moz_places.url
    from moz_bookmarks
    inner join moz_places on moz_places.id = moz_bookmarks.fk
    where moz_bookmarks.parent = ?
    order by moz_bookmarks.title`,
    dirId.id
  );

  // get all tags
  let tagsId = await db.get("select id from moz_bookmarks where guid='tags________'");
  tagsId = tagsId.id;
  let allTags = await db.all('select id, title from moz_bookmarks where parent = ?', tagsId);
  let allTagsMap = {};
  allTags = allTags.map(tag => {
    allTagsMap[tag.id] = tag.title;
    return tag.id;
  });

  // get pairs tag_id, bookmark_id
  const ids = bookmarks.map(bm => bm.id);
  const pairs = await db.all(
    `select b.parent as tag_id, b.fk as bookmark_id
    from moz_bookmarks as b
    inner join moz_places as p on p.id = b.parent
    where b.parent in (${allTags.join(',')})
    and b.fk in (${ids.join(',')})`
  );

  // build map bookmark_id => tags titles
  let bookmarksTags = {};
  pairs.map(pair => {
    if (!bookmarksTags[pair.bookmark_id]) bookmarksTags[pair.bookmark_id] = [];
    const tagTitle = allTagsMap[pair.tag_id];
    bookmarksTags[pair.bookmark_id].push(tagTitle);
  });

  // add tags to bookmarks
  bookmarks.forEach((bm, bmId) => {
    if (bookmarksTags[bm.id]) bm.tags = bookmarksTags[bm.id];
    else bm.tags = [];
    bookmarks[bmId] = bm;
  });

  return bookmarks;
};
