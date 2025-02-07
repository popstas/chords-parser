'use strict';

const cheerio = require('cheerio'),
  axios = require('axios'),
  puppeteer = require('puppeteer'),
  iconv = require('iconv-lite'),
  fs = require('fs'),
  {HttpsProxyAgent} = require('https-proxy-agent'),
  fetch = require('node-fetch');
 
// require config if ../config is exists
let config = {};
if (fs.existsSync('config.js')) {
  config = require('../config');
}

const userAgent = 'popstas/chords-parser';

const platforms = [
  {
    domain: 'mychords.net',
    selector: '.w-words__text',
    puppeteer: true,
  },
  {
    domain: 'hm6.ru',
    selector: '.w-words__text',
    puppeteer: true,
  },
  {
    domain: 'amdm.ru',
    selector: '[itemprop="chordsBlock"]',
  },
  {
    domain: 'amdm.in',
    selector: '[itemprop="chordsBlock"]',
  },
  {
    domain: 'orgius.ru',
    selector: 'pre',
  },
  {
    domain: 'rock-chords.ru',
    selector: 'pre',
  },
  {
    domain: 'rush-sound.ru',
    selector: 'pre',
  },
  {
    domain: 'sing-my-song.com',
    selector: 'pre',
  },
  {
    domain: 'genius.com',
    selector: '#lyrics-root',
  },
  {
    domain: 'akkordbard.ru',
    selector: 'pre',
  },
  {
    domain: 'lalatracker.com',
    selector: 'pre',
  },
  {
    domain: '5lad.ru',
    selector: 'pre',
  },
  {
    domain: 'music.yandex.ru',
    selector: 'pre',
  },
  {
    domain: 'stihi.ru',
    selector: '.maintext .text',
    puppeteer: true,
  },
  {
    domain: 'text-pesni.com',
    selector: '[itemprop="text"]',
    puppeteer: true,
  },
  {
    domain: 'teksti-pesenok.pro',
    selector: '#text',
    // puppeteer: true,
  },
  {
    domain: 'pesni.guru',
    selector: '.songtext',
    removeSelector: 'ul, div', // TODO:
    puppeteer: true,
  },
  {
    domain: 'musixmatch.com',
    selector: '.lyrics__content__ok',
    // puppeteer: true,
  },
  {
    domain: '100atm.ru',
    selector: '.detail_text',
  },
  {
    domain: 'pesni.net',
    selector: '.song-block-text',
  },
];

// get selector by url
const getChordsPlatform = url => {
  for (let platform of platforms) {
    let re = new RegExp(platform.domain.replace('.', '\\.'));
    if (url.match(re)) return platform;
  }
};

// extract artist, title and chords from title
exports.parseTitle = title => {
  let parsedTitle = {
    artist: '',
    title: '',
    chords: '',
    chords_count: 0
  };

  if (title.match(/аккорды/i)) {
    let matches = title.match(/(.*?) [-–] (.*)аккорды.*/);
    if (matches) {
      parsedTitle = {
        artist: matches[1].trim(),
        title: matches[2].trim().replace(/,$/, ''),
        chords: ''
      };
    }
  } else {
    let matches = title.match(/(.*?) - (.*),(.*)/);
    if (matches) {
      parsedTitle = {
        artist: matches[1].trim(),
        title: matches[2].trim(),
        chords: matches[3].trim()
      };
    }
  }

  // chords_count
  if(parsedTitle.chords != ''){
    parsedTitle.chords_count = parsedTitle.chords.split(' ').length;
    parsedTitle.complexity = parsedTitle.chords_count - 2;
  }

  return parsedTitle;
};

// get text from url, with puppeteer
const getTextByUrlWithSelectorPuppeteer = async (url, platform) => {
  const selector = platform.selector;
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  // const browser = await puppeteer.launch({executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'});
  // const browser = await puppeteer.launch({ headless: false, slowMo: 250 });
  // const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(10000);
  try {
    await page.goto(url, {waitUntil: 'load', timeout: 10000});
  } catch (err) {
    console.error(err);
    return '';
  }

  // get text by selector
  let element = await page.$(selector);
  let text = await (await element.getProperty('innerText')).jsonValue();
  // console.log(data.text);
  browser.close();

  return text;
};

// get text from url, with axios and cheerio
const getTextByUrlWithSelectorCheerio = async (url, platform) => {
  const selector = platform.selector;
  let text = '';
  try {
    let responseType = 'text';
    if (url.match(/orgius\.ru/)) {
      responseType = 'arraybuffer';
    }

    let proxiedFetch = fetch;
    if (config.proxy) {
      proxiedFetch = async (input, init) => {
        const agent = new HttpsProxyAgent(`${config.proxy}`);
        const requestOptions = {
          ...init,
          agent,
        };
        return fetch(input, requestOptions);
      };
    }

    let response = await proxiedFetch(url, {
      // responseType: responseType,
      headers: {
        'User-Agent': userAgent
      },
    });

    /* let response = await axios.get(url, {
      responseType: responseType,
      headers: {
        'User-Agent': userAgent
      },
    }); */

    const htmlRaw = await response.text();
    if (url.match(/orgius\.ru/)) {
      response.data = iconv.decode(htmlRaw, 'win1251');
    }

    const $ = cheerio.load(htmlRaw);

    const elem = $(selector);
    // TODO: removeSelector impl.
    if (platform.removeSelector) {
      elem.find(platform.removeSelector).remove();
    }
    let html = elem.html();
    if (html.match(/<br>/)) {
      html = html.replace(/<br><\/div>/g, '\n\n</div>'); // genius.com, конец блока
      html = html.replace(/<br>/g, '\n');
      text = $(html).text();
    } else {
      text = $(selector).text();
    }

    // Add replacements for genius.com
    if (platform.domain === 'genius.com') {
      text = text.replace(/.*Lyrics\[.*?\]/s, ''); // Remove text from the beginning to "Lyrics[.*]"
      text = text.replace(/You might also like/g, ''); // Replace "You might also like" with ""
      text = text.replace(/\d+Embed$/, ''); // Remove "[0-9]+Embed" from the end
    }

    text = text.trim();
  } catch (err) {
    console.error(err);
  }
  return text;
};

exports.getTextByUrl = async (url) => {
  const platform = getChordsPlatform(url);
  if (!platform) return '';
  const getText = platform.puppeteer ? getTextByUrlWithSelectorPuppeteer : getTextByUrlWithSelectorCheerio;
  const text = await getText(url, platform);
  return text;
};
