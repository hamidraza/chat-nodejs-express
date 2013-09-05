(function($){

    function userObj(){
        var _self = this;
        _self.name = false;
        _self.email = false;

        var field = $("#field");
        var sendButton = $("#send");
        var content = $("#content ul");
        var socket = false;

        _self.sendMessage = function(msg){
            if(!_self.name){
                _self.name = prompt("Please type your name!");
                if(_self.name) _self.sendMessage(msg);
            }
            var msgData = {
                message: field.val(),
                username: _self.name
            };
            socket.emit('send', msgData);
            field.val('');
        }

        _self.init = function(){
            socket = window.io.connect('/');
            socket.on('message', function (data) {
                console.log(data);
                if(data.message) {
                    var messageLi = $('<li></li>',{
                        'html': (data.message || 'Empty')+'<small> - '+(data.username || 'guest')+'</small>',
                        'class': (data.username == _self.name? 'you': data.username)
                    });
                    content.append(messageLi);
                } else {
                    console.log("There is a problem:", data);
                }
            });

            $('.chat-controls').on('submit', function(){
                _self.sendMessage();
                return false;
            });
        }
    }

    var user = new userObj();
    $('form.start-chat').on('submit', function(){
        user.name = $('.username', this).val();
        user.email = $('.useremail', this).val();
        user.init();
        $(this).remove();
        $('.chat-box').css('display','block');
        return false;
    });


})(jQuery);