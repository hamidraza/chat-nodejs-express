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

io.sockets.on('connection', function(socket){

    socket.on('register', function (data) {
        users[socket.id] = data;
        socket.emit('register', {'success': true, 'id': socket.id});
        socket.emit('message', { message: 'welcome to the chat', username: 'Admin', to: data });

        // save newuser Data - Mongodb
        var newUser = data;
        newUser.socket_id = socket.id;
        db.collection('users').save(newUser);

    });

    socket.on('send', function (data) {
        data.id = socket.id;
        //io.sockets.emit('message', data);
	socket.broadcast.emit('message', data);


        // Save new Message
        var newMessage = data;
        newMessage.socket_id = socket.id;
        db.collection('messages').save(newMessage);
    });

});
