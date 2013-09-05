window.onload = function() {
 
    var socket = io.connect('/');
    var field = document.getElementById("field");
    var sendButton = document.getElementById("send");
    var content = document.getElementById("content");
    var name = document.getElementById("name");
 
    socket.on('message', function (data) {
        if(data.message) {
            content.innerHTML = content.innerHTML+'<hr>'+(data.message || 'Empty')+' - <small>'+(data.username || 'guest')+'</small>';
            content.scrollTop = content.scrollHeight;
        } else {
            console.log("There is a problem:", data);
        }
    });

    socket.on('connection', function(data){
        console.log('new connection');
    });
 
    sendButton.onclick = function() {
        if(name.value == "") {
            alert("Please type your name!");
        } else {
            var text = field.value;
            socket.emit('send', { message: text, username: name.value });
            field.value = "";
        }
    };
 
}