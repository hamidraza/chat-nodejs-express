var mongo = require('mongodb-wrapper');
var db = mongo.db('localhost', 27017, 'demo_chat');

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

var users = {};
var messages = [];

var storeMessage = function(data){
    messages.push(data);
    if(messages.length > 10) messages.shift();
}

io.sockets.on('connection', function(socket){

    socket.on('register', function (data) {

        users[socket.id] = data;
        socket.set('username', data.name);
        socket.set('email', data.email);

        socket.emit('register', {'success': true, 'id': socket.id});
        socket.emit('message', {
            message: 'welcome to the chat !!!',
            name: 'HamidRaza',
            id: 'admin'
        });

        if(messages.length > 0){
            for(var i in messages){
                socket.emit('message', messages[i]);
            }
        }

        // save newuser Data - Mongodb
        var newUser = data;
        newUser.socket_id = socket.id;
        db.collection('users').save(newUser);

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
