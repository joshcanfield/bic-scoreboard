/**
 * Implements socket.io communication with the Scoreboard interface.
 * The Scoreboard interface is implemented by both view only scoreboard, as well as the scorekeeper version.
 */
var socket = io.connect('http://localhost:8081');

Server = {
    startClock: function () {
        socket.emit('clock_start');
    },
    pauseClock: function () {
        socket.emit('clock_pause');
    },
    goal: function (data) {
        socket.emit('goal', data);
    },
    undoGoal: function (data) {
        socket.emit('undo_goal', data);
    },
    buzzer: function () {
        socket.emit('buzzer');
    },
    power: function () {
        socket.emit('power');
    },
    setPeriod: function (p) {
        socket.emit('set_period', { "period": p });
    },
    createGame: function(gameConfig) {
        socket.emit('createGame', gameConfig);
    }
};

socket.on('connect', function () {
    output('<span class="connect-msg">Connected</span>');
});

socket.on('disconnect', function () {
    output('<span class="disconnect-msg">Disconnected! Make sure the app is running!</span>');
});

socket.on('message', function (data) {
    output('<pre>Message ' + JSON.stringify(data) + '</pre>');
});

socket.on('power', function (data) {
    var msg = data.scoreboardOn ? "ON" : "OFF";
    output('<span class="disconnect-msg">The Scoreboard has been turned ' + msg + '</span>');
    Scoreboard.updatePower(data);
});

socket.on('update', function (data) {
    Scoreboard.update(data);
});

function output(message) {
    clearOldMessages();
    var stamp = new Date().getTime();
    var element = $("<div data-stamp='" + stamp + "'>" + message + "</div>");
    $('#console').prepend(element);
}

function clearOldMessages() {
    var toRemove = [];
    var oldStamp = new Date().getTime() - 10000;
    $('#console').find("div").each(function() {
        var stamp = parseInt($(this).attr('stamp'));
        if ( stamp < oldStamp ) {
            toRemove.push(this);
        }
    });

    $(toRemove).each(function(){
        $(this).remove();
    });

}
