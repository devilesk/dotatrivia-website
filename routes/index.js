var express = require('express');
var router = express.Router();
var config = require('../config.json');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Dota 2 Trivia Bot' });
});

router.get('/chat', function (req, res) {
    var db = req.db;
    var collection = db.get(config.chatCollection);
    var channel = (req.query.channel || 'Trivia').toString();
    var query = {channel: channel};
    var filter = {sort: { createdAt: 1 }, fields: { createdAt: 1, message: 1, personaName: 1, _id: 0 } };
    collection.find(query, filter, function (e, docs) {
        res.render('chatlog', {title: 'Chat Log', description: "Channel: " + channel, data: docs});
    });
});

router.get('/leaderboard/search', function (req, res) {
    var db = req.db;
    var collection = db.get(config.userCollection);
    var q = (req.query.q || '').toString();
    var accountId = parseInt(q);
    var query = {personaName: q}
    if (!isNaN(accountId)) query = { $or: [ query, {accountId: accountId} ] };
    var filter = {sort: {points: -1}};
    var counter = 0;
    collection.find(query, filter, function (e, docs){
        if (e || !docs.length) {
            res.render('result', { title: 'Leaderboard Search', description: "Search for: " + q, time: req.query.t, query: q, results: [] });
        }
        else {
            for (var i = 0; i < docs.length; i++) {
                (function (j) {
                    collection.count({ points: { $gt: docs[j].points } },function (e, count){
                        docs[j].count = count + 1;
                        counter++;
                        if (counter == docs.length) {
                            res.render('result', { title: 'Leaderboard Search', description: "Search for: " + q, time: req.query.t, query: q, results: docs });
                        }
                    });
                })(i);
            }     
        }

    });

});

router.get('/leaderboard/:time/:page', function (req, res) {
    var db = req.db;
    var time = (req.params.time || 'all').toString();
    var page = parseInt(req.params.page || 1);
    if (isNaN(page)) page = 1;
    var pageSize = 100;
    if (time == 'all') {
      var collection = db.get(config.userCollection);
      collection.count({}, function (error, count) {
          var maxPages = Math.ceil(count / pageSize);
          collection.find({},{
                  sort: {points: -1},
                  limit: pageSize,
                  skip: pageSize * (page - 1)
              },function (e,docs){
              res.render('leaderboard', {
                  "time": time,
                  "pagination": {
                      "current": page,
                      "pageSize": pageSize,
                      "total": maxPages
                  },
                  "title": "Leaderboard",
                  "description": "Top scores all-time",
                  "num_records": count,
                  "userlist" : docs
              });
          });
      });
    }
    else {
      var collectionName = null;
      var description = null;
      switch (time) {
        case 'hour':
          collectionName = config.scoresHourlyCollection;
          description = "Top scores past hour";
        break;
        case 'day':
          collectionName = config.scoresDailyCollection;
          description = "Top scores past day";
        break;
        case 'week':
          collectionName = config.scoresWeeklyCollection;
          description = "Top scores past week";
        break;
      }
      if (collectionName != null) {
        var collection = db.get(collectionName);
        collection.col.distinct("accountId", function (err, items) {
          var maxPages = Math.ceil(items.length / pageSize);
          collection.col.aggregate([{$group:{_id: { accountId: "$accountId" }, points: { $sum: "$points" }, count: { $sum: 1 }, personaName: { $min: "$personaName" } }}, {$sort: {points: -1}}, { $skip : pageSize * (page - 1) }, { $limit : pageSize }], function(err, items) {
              if (!err) {
                res.render('leaderboard', {
                    "time": time,
                    "pagination": {
                        "current": page,
                        "pageSize": pageSize,
                        "total": maxPages
                    },
                    "title": "Leaderboard",
                    "description": description,
                    "num_records": items.length,
                    "userlist" : items
                });
              }
          });
        });
      }
      else {
        res.status(404).send('Not found');
      }
    }
});

module.exports = router;
