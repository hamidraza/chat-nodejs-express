var mongo = require('mongodb-wrapper');
var db = mongo.db('localhost', 27017, 'demo_chat');
var redis = require('redis').createClient();

var express = require("express");
var app = express();
var port = 3000;

app.set('views', __dirname + '/tpl');
app.set('view engine', "jade");
app.engine('jade', require('jade').__express);
app.use(express.static(__dirname + '/public'));

app.get("/", function(req, res){
    res.render("page");
});

//app.listen(port);
var io = require('socket.io').listen(app.listen(port));
console.log("Listening on port " + port);


// Socket work for making things realtime
var users = {};
var messages = [];

var storeMessage = function(data){
    if(!data) return false;

    // save data on redis
    redis.lpush("chat-messages", JSON.stringify(data), function(err, res){
        redis.ltrim("chat-messages", 0, 10); // keep only 10 latest messages
    });
}

io.sockets.on('connection', function(socket){

    socket.on('register', function (data) {

        socket.emit('connected users', users);
        data.id = socket.id;
        users[socket.id] = data;
        socket.set('username', data.name);
        socket.set('email', data.email);

        socket.emit('register', {'success': true, 'id': socket.id});
        socket.emit('message', {
            message: 'welcome to the chat !!!',
            name: 'HamidRaza',
            id: 'admin'
        });
        socket.broadcast.emit('user connect', data);

        redis.lrange('chat-messages', 0, -1, function(err, msgs){
            msgs = msgs.reverse();
            msgs.forEach(function(msg){
                socket.emit('message', JSON.parse(msg));
            });
        });

        // save newuser Data - Mongodb
        var newUser = data;
        newUser.socket_id = socket.id;
        db.collection('users').save(newUser);

    });

    socket.on('disconnect', function(d){
        var userData = users[socket.id];
        if(userData){
            io.sockets.emit('disconnect', userData);
            delete users[socket.id];
        }
    });

    socket.on('send', function (data) {
        socket.get('username', function(err, username){
            data.id = socket.id;
            data.name = username;
            socket.broadcast.emit('message', data);
            storeMessage(data);
        });

        // Save new Message
        var newMessage = data;
        newMessage.socket_id = socket.id;
        db.collection('messages').save(newMessage);
    });

});
