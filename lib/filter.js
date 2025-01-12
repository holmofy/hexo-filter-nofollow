'use strict';

const { parse } = require('url');
const { Minimatch, filter } = require('minimatch');

/**
 * Check whether the url is an external link
 * @param {string} url 
 * @param {object} config 
 * @returns boolean
 */
function isExternal(url, config) {
  const { includeGlobs, excludeGlobs } = config.nofollow;
  const data = parse(url);
  const { hostname, path } = data;
  const sitehost = parse(config.url).hostname || config.url;

  if (!data.protocol || !hostname || !sitehost) return false;

  const target = hostname + path;

  if (excludeGlobs && excludeGlobs.length) {
    for (const glob of excludeGlobs) {
      if (glob.match(target)) return false;
    }
  }

  if (includeGlobs && includeGlobs.length) {
    for (const glob of includeGlobs) {
      if (glob.match(target)) return true;
    }
  }

  return hostname !== sitehost;
}

/**
 * Add attribute to the tag
 * @param {string} source tag string
 * @param {string} attribute string containing the url
 * @param {string} new attribute key
 * @param {string | array} new attribute value
 * @returns new tag string
 */
function addAttr(tagStr, urlAttrStr, attrKey, attrValue) {
  const value = toArray(attrValue);
  const regexKey = new RegExp(`${attrKey}=`, 'gi');
  const attrRegex = new RegExp(`\\s${attrKey}="(.*?)"`, 'gi');
  if (regexKey.test(tagStr)) {
    tagStr = tagStr.replace(attrRegex, (attrStr, attrStrValue) => {
      value.push(...attrStrValue.split(' '));
      return '';
    });
  }
  // De-duplicate
  const uniqValue = [...new Set(value)];
  return tagStr.replace(urlAttrStr, `${urlAttrStr} ${attrKey}="${uniqValue.join(' ')}"`);
}

function toArray(data) {
  return data && !Array.isArray(data) ? [data] : data;
}

module.exports = function (data) {
  const hexo = this;
  const config = hexo.config;

  const { elements, include, exclude, minimatch } = config.nofollow;
  config.nofollow.elements = toArray(elements);
  config.nofollow.include = toArray(include);
  config.nofollow.exclude = toArray(exclude);

  config.nofollow.includeGlobs = config.nofollow.include.map(pattern => new Minimatch(pattern, minimatch));
  config.nofollow.excludeGlobs = config.nofollow.exclude.map(pattern => new Minimatch(pattern, minimatch));

  const filterATagHrefExternal = data => {
    return data.replace(/<a.*?(href=['"](.*?)['"]).*?>/gi, (aTagSrc, hrefAttrStr, href) => {
      if (!isExternal(href, config)) return aTagSrc;
      aTagSrc = addAttr(aTagSrc, hrefAttrStr, 'referrerpolicy', 'no-referrer');
      return addAttr(aTagSrc, hrefAttrStr, 'rel', ['noopener', 'external', 'nofollow', 'noreferrer']);
    });
  };

  const filterImgTagSrcExternal = data => {
    return data.replace(/<img.*?(src=['"](.*?)['"]).*?>/gi, (imgTagSrc, srcAttrStr, src) => {
      if (!isExternal(src, config)) return imgTagSrc;
      imgTagSrc = addAttr(imgTagSrc, srcAttrStr, 'referrerpolicy', 'no-referrer');
      return addAttr(imgTagSrc, srcAttrStr, 'rel', ['noopener', 'external', 'nofollow', 'noreferrer']);
    });
  };

  const filterExternal = data => {
    if (config.nofollow.elements.includes('a'))
      data = filterATagHrefExternal(data);
    if (config.nofollow.elements.includes('img')) {
      data = filterImgTagSrcExternal(data);
    }
    return data;
  }

  if (config.nofollow.field === 'post') {
    data.content = filterExternal(data.content);
  } else {
    data = filterExternal(data);
  }

  return data;
};


