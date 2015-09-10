var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var config = require('./config.json');
console.log(config);
var mongo = require('mongodb');
var monk = require('monk');
var db = monk(config.databaseAddress + '/' + config.databaseName);

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();
var server = app.listen(config.socketIOPort);
var io = require('socket.io')(server);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Make our db accessible to our router
app.use(function(req,res,next){
    req.db = db;
    next();
});

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

var collection = db.get(config.chatCollection),
    connectionsArray = [],
    last_count = null,
    POLLING_INTERVAL = 1000,
    pollingTimer;
    
var pollingLoop = function(channel) {
    var query = {"channel": channel};
    if (last_count) query.createdAt = { $gt : last_count};
    collection.find(query, { sort: { createdAt: 1 }, fields: { createdAt: 1, message: 1, personaName: 1, _id: 0 } }, function (e, docs) {
        var data = [];
        //console.log(docs.length, last_count);
        if (e) {
            console.log('ERROR', e);
            updateSockets(e, channel);
        }
        else {
            var numConns = connectionsArray.filter(function (tmpSocket) {
                return tmpSocket.handshake.query.channel == channel;
            }).length;
            if (numConns) {
                pollingTimer = setTimeout(function () {
                    pollingLoop(channel);
                }, POLLING_INTERVAL);
                if (docs.length) {
                    updateSockets({
                        d: docs,
                        c: docs[docs.length - 1].createdAt,
                        n: numConns
                    }, channel);
                }
            }
            else {
                //console.log('no more sockets for channel', channel, 'loop stopped');
            }
        }
    });
};

var updateSockets = function(data, channel) {
    if (last_count && last_count.valueOf() != data.c.valueOf()) {
        //console.log(channel, data.d.length, last_count, data.c.toString(), last_count == data.c);
        // sending new data to all the sockets connected
        connectionsArray.forEach(function(tmpSocket) {
            if (tmpSocket.handshake.query.channel == channel) {
                tmpSocket.volatile.emit('notification', data);
            }
        });
    }
    last_count = data.c;
};
// creating a new websocket to keep the content updated without any AJAX request
io.sockets.on('connection', function(socket) {

    //This variable is passed via the client at the time of socket //connection
    var channel = socket.handshake.query.channel;
    console.log('Number of connections:' + connectionsArray.length);
    // starting the loop only if at least there is one user connected
    if (!connectionsArray.filter(function (tmpSocket) {
        return tmpSocket.handshake.query.channel == channel;
    }).length) {
        collection.count({channel: channel}, function (e, count) {
            if (count > 0) {
                console.log(channel, 'valid channel, starting loop');
                pollingLoop(channel);
            }
            else {
                console.log(channel, 'invalid, not looping');
            }
        });
    }

    socket.on('disconnect', function() {
        var socketIndex = connectionsArray.indexOf(socket);
        console.log('socket = ' + socketIndex + ' disconnected');
        if (socketIndex >= 0) {
            connectionsArray.splice(socketIndex, 1);
        }
    });

    console.log('A new socket is connected!');
    connectionsArray.push(socket);
});

module.exports = app;
