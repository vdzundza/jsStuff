'use strict';

var controller = require('./root.controller');
var router = require('koa-router')();

router.get('/', controller.index);
router.get('/parse', controller.parseCriminals);
module.exports = router.routes();