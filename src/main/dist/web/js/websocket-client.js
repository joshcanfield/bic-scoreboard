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
    }
};

socket.on('connect', function () {
    output('<span class="connect-msg">Client has connected to the server!</span>');
});

socket.on('disconnect', function () {
    output('<span class="disconnect-msg">The client has disconnected!</span>');
});

socket.on('message', function (data) {
    output('<pre>Message ' + JSON.stringify(data) + '</pre>');
});

socket.on('power', function (data) {
    output('<pre>Scoreboard Running? ' + JSON.stringify(data) + '</pre>');
    Scoreboard.updatePower(data);
});

socket.on('update', function (data) {
    output('<pre>Update! ' + JSON.stringify(data) + '</pre>');
    Scoreboard.update(data);
});

function sendDisconnect() {
    socket.disconnect();
}

function output(message) {
    var element = $("<div>" + message + "</div>");
    $('#console').prepend(element);
}
