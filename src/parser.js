'use strict';

const cheerio = require('cheerio'),
  axios = require('axios'),
  puppeteer = require('puppeteer'),
  iconv = require('iconv-lite');

const userAgent = 'popstas/chords-parser';

const domainSelectors = {
  'mychords.net': '.w-words__text',
  'hm6.ru': '.w-words__text',
  'amdm.ru': '[itemprop="chordsBlock"]',
  'orgius.ru': 'pre',
  'rock-chords.ru': 'pre',
  'sing-my-song.com': 'pre',
  'genius.com': '.lyrics'
};

// get selector by url
exports.getChordsSelector = url => {
  let selector = false;

  for (let domain in domainSelectors) {
    let re = new RegExp(domain.replace('.', '\\.'));
    if (url.match(re)) {
      selector = domainSelectors[domain];
      break;
    }
  }

  return selector;
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
const getTextByUrlWithSelectorPuppeteer = async (url, selector) => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  // const browser = await puppeteer.launch({executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'});
  // const browser = await puppeteer.launch({ headless: false, slowMo: 250 });
  // const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(10000);
  try {
    await page.goto(url);
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
const getTextByUrlWithSelectorCheerio = async (url, selector) => {
  let text = '';
  try {
    let responseType = 'text';
    if (url.match(/orgius\.ru/)) {
      responseType = 'arraybuffer';
    }

    let response = await axios.get(url, {
      responseType: responseType,
      headers: {
        'User-Agent': userAgent
      }
    });

    if (url.match(/orgius\.ru/)) {
      response.data = iconv.decode(response.data, 'win1251');
    }

    const $ = cheerio.load(response.data);
    text = $(selector).text();
  } catch (err) {
    console.error(err);
  }
  return text;
};

exports.getTextByUrl = async (url, selector) => {
  let text = '';
  if (url.match(/mychords\.net/)) {
    text = await getTextByUrlWithSelectorPuppeteer(url, selector);
  } else {
    text = await getTextByUrlWithSelectorCheerio(url, selector);
  }
  return text;
};
