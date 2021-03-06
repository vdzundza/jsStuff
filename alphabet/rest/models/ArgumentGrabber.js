'use strict';

var q = require('q');
var request = require('request');
var cheerio = require('cheerio');
var NameLib  = require('../models/Names.js');

var link = 'http://argumentua.com/stati/azbuka-vorovskogo-mira-ukrainy-lidery-opg-ot-do-ya-v-nachale-1990-kh-prodolzhenie-b';
link = 'http://argumentua.com/stati/azbuka-vorovskogo-mira-ukrainy-lidery-opg-ot-do-ya-v-nachale-1990-kh-prodolzhenie-v';
link = 'http://argumentua.com/stati/azbuka-vorovskogo-mira-ukrainy-lidery-opg-1990-kh-rybka-ryabin-rata';
var first = true;

function cleanUpParagraphs(idx, paragraph){
  var $ = cheerio;
  var attrs = $(paragraph).get(0).attribs;
  var hasAttributes = Object.keys(attrs).length > 0;

  if(hasAttributes){
    return true;
  }

  var firstSpan = $(paragraph).children('span').first();
  var hasFirstSpan = firstSpan !== undefined;

  if(!hasFirstSpan){
    return true;
  }

  return false;
}

function clearContentCriminals($block){
  $block.children('div, noscript, span, ul, blockquote, iframe, frame').remove();
  $block.children('p').filter(cleanUpParagraphs).remove();
}

function groupByCity(data){
  var group = {};
  for(var i = 0, max = data.length; i < max; i++){
    group[data[i].city] = group[data[i].city] || 0;
    group[data[i].city]++;
  }

  return group;
}

function tryToParseData(p){
  try{
    var error = '';
    var def = q.defer();
    var $ = cheerio;
    var text = $(p).text();
    var firstSentence = text.split('.')[0];

    var firstThreeStatements = firstSentence.split(',').slice(0, 3);
    var name = firstThreeStatements[0];
    var year = firstThreeStatements[1];
    var fullCity = firstThreeStatements[2];

    var hasError = false;
    if(name === undefined || name.indexOf("(") === 0){
       def.reject('Cannot parse name from ' + text);
       hasError = true;
    }

    if(year === undefined){
       def.reject('Cannot parse year from ' + text);
       hasError = true;
    }

    if(fullCity === undefined){
       def.reject('Cannot parse city from ' + text);
       hasError = true;
    }

    if(hasError){
      return def.promise;
    }

    name = name.split(' ');
    var isName = NameLib.isName(name[1]);
    var marks = NameLib.detectName(firstSentence);
    // console.log('marks for sentence ' + firstSentence + ' are ', marks);

    var findFirstCapital = function(sentence, fromIndex){
        var firstCapitalizedWord = 'NOT FOUND';
        var words = sentence.split(' ').slice(fromIndex);
        for(var i = 0, max = words.length; i < max; i++){
          if(words[i][0] === words[i][0].toUpperCase()){
            firstCapitalizedWord = words[i];
            break;
          }
        }
        return firstCapitalizedWord;

    };

    var data = {
      firstName: name[1],
      lastName: name[0],
      patronym: name[2],
      fullCity: fullCity,
      city: findFirstCapital(firstSentence, 6).replace(',',''),
      year: year,
      fullText: text
      // firstSentence: firstSentence,
    };
    def.resolve(data);
    }catch(e){
      error = 'unable to parse data from ' + text;
      def.reject({error: error, message: e.message});
    }finally{
      return def.promise;
    }
}

function collectDataFrom(paragraphs){
  var def = q.defer();
  var data = [];
  var successParseFn = function(criminal){
    data.push(criminal);
  };

  var errorParseFn = function(error){
    data.push(error);
  };

  paragraphs.each(function(index, p){
    tryToParseData(p).done(successParseFn, errorParseFn);
  });
  def.resolve(data);
  return def.promise;
}

function load(link){
  var def = q.defer();

  var CONTENT_CLASS = '.content.clear-block';

  request(link, function (error, response, html) {
          if (!error && response.statusCode == 200) {
            var $ = cheerio.load(html, {
              normalizeWhitespace: true
            });
            clearContentCriminals($(CONTENT_CLASS));
            collectDataFrom($(CONTENT_CLASS).children('p')).then(def.resolve);
          }else{
            def.reject({error: 'something went wrong with loading data ...'});
          }
  });
  return def.promise;
}

var ArgumentGrabber = {
  loadData: function(){
    return load(link);
  },
  groupByCity: groupByCity
};

module.exports = ArgumentGrabber;
