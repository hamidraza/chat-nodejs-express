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
    });

    socket.on('send', function (data) {
        data.id = socket.id;
        io.sockets.emit('message', data);
    });

});
