(function($){

    function userObj(){
        var _self = this;
        _self.name = false;
        _self.email = false;
        _self.id = false;
        _self.newMsgCount = 0;

        var field = $("#field");
        var sendButton = $("#send");
        var content = $("#content ul");
        var socket = false;

        _self.sendMessage = function(data){
            if(!_self.name){
                _self.name = prompt("Please type your name!");
                if(_self.name) _self.sendMessage(data);
            }
            socket.emit('send', data);
            field.val('');
        }

	_self.addMessage = function(data){
		if(!data) return false;
                $('<li></li>',{
                    'html': (data.message || 'Empty')+'<small> - '+(data.username || 'guest')+'</small>',
                    'class': (data.id == _self.id? 'you': '')
                }).appendTo(content);
                $('#content').scrollTop($('#content')[0].scrollHeight);
		return true;
	}

        _self.start = function(){
            socket.on('message', function (data) {
                if($('.chat-box').hasClass('hidden-box')){
                    $('.chat-box-header').text('New Messages ('+(++_self.newMsgCount)+')');
                    $('.chat-box.hidden-box').addClass('new-message');
                }
                if(!_self.addMessage(data)) {
                    console.log("There is a problem:", data);
                }
            });

            $('.chat-controls').on('submit', function(){
		var data = {
			message: field.val(),
			id: _self.id,
			username: _self.name
		};
		if(!_self.addMessage(data)) {
                    console.log("There is a problem:", data);
                }
                _self.sendMessage(data);
                return false;
            });
        }

        _self.init = function(){
            socket = window.io.connect('//chat.hamidraza.net:3000/');
            socket.emit('register', {name: _self.name, emial: _self.email});
            socket.on('register', function (data) {
                console.log(data);
                if(data.id){
                    _self.id = data.id;
                    _self.start();
                }else{
                    alert('unable to register you on the network, The page will reload now.');
                    document.location.reload();
                }
            });
        }
    }

    var user = new userObj();
    $('form.start-chat').on('submit', function(){
        var _this = $(this);
        user.name = $('.username', _this).val();
        user.email = $('.useremail', _this).val();
        _this.remove();
        $('.chat-area').css('display','block');
        user.init();
        return false;
    });

    $('.chat-box-header').on('click', function(){
        var chatBox = $('.chat-box').removeClass('new-message');
        $('.chat-box-header').text('Goup chat service');
        user.newMsgCount = 0;
        if($('.chat-box-wrapper').is(':visible')){
            chatBox.addClass('hidden-box');
        }else{
            chatBox.removeClass('hidden-box');
        }
        $('#content').scrollTop($('#content')[0].scrollHeight);
    })


})(jQuery);
