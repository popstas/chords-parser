'use strict';

const fs = require('fs');

// store songs data to json
exports.saveJson = (songs, path) => {
  fs.writeFileSync(path, JSON.stringify(songs, null, 2), null, 2);
  const stats = fs.statSync(path);
  return stats;
  /* fs.mkdir('songs');
    songs.forEach(song => {
        let md = render(fs.readFileSync('song.md.template'), { song });
    }); */
};

exports.loadJson = path => {
  let songs = [];
  if (fs.existsSync(path)) {
    songs = JSON.parse(fs.readFileSync(path));
  }
  return songs;
};
