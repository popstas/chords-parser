'use strict';

const cheerio = require('cheerio')
    , axios = require('axios')
    , puppeteer = require('puppeteer')

const userAgent = 'popstas/chords-parser';

const domainSelectors = {
    'mychords.net': '.w-words__text',
    'hm6.ru': '.w-words__text',
    'amdm.ru': '[itemprop="chordsBlock"]',
}

// get selector by url
exports.getChordsSelector = (url) => {
    let selector = false;

    for(let domain in domainSelectors){
        let re = new RegExp(domain.replace('.', '\\.'));
        if(url.match(re)){
            selector = domainSelectors[domain];
            break;
        }
    }

    return selector;
}

// extract artist, title and chords from title
exports.parseTitle = (title) => {
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
}

// get text from url, with puppeteer
const getTextByUrlWithSelectorPuppeteer = async (url, selector) => {
    const browser = await puppeteer.launch();
    // const browser = await puppeteer.launch({executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'});
    // const browser = await puppeteer.launch({ headless: false, slowMo: 250 });
    // const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(10000);
    try{
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
}

// get text from url, with axios and cheerio
const getTextByUrlWithSelectorCheerio = async (url, selector) => {
    let text = '';
    try{
        let response = await axios.get(url, {
            headers: {
                'User-Agent': userAgent
            },
        });
        const $ = cheerio.load(response.data);
        text = $(selector).text();
    } catch (err) {
        console.error(err);
    }
    return text;
}

exports.getTextByUrl = async (url, selector) => {
    let text = '';
    if(url.match(/mychords\.net/)){
        text = await getTextByUrlWithSelectorPuppeteer(url, selector);
    } else {
        text = await getTextByUrlWithSelectorCheerio(url, selector);
    }
    return text;
}
