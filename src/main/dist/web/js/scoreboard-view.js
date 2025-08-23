function digits(n) {
    return [Math.floor(n / 10), n % 10];
}

function updatePenalties(team, penalties) {
    var teamBox = $('#penalty_box .penalties.' + team);
    var playerDigits = teamBox.find('.player .digits');
    var penaltyDigits = teamBox.find('.penalty .digits');

    for (var i = 0; i < 2; i++) {
        var p = penalties[i];
        var player = playerDigits.eq(i);
        var pen = penaltyDigits.eq(i);

        var clearDigits = function () {
            player.find('.digit').text(0);
            pen.find('.digit').text(0);
        };

        if (p) {
            var remaining = p.time;
            if (p.startTime > 0) {
                remaining = p.time - p.elapsed;
            }

            if (remaining > 0) {
                var pd = digits(p.playerNumber);
                player.find('.digit.tens').text(pd[0]);
                player.find('.digit.ones').text(pd[1]);

                var minutes = Math.floor(remaining / 1000 / 60);
                var seconds = Math.floor((remaining / 1000) % 60);
                var sd = digits(seconds);

                pen.find('.digit.minutes').text(minutes);
                pen.find('.digit.seconds.tens').text(sd[0]);
                pen.find('.digit.seconds.ones').text(sd[1]);
            } else {
                clearDigits();
            }
        } else {
            clearDigits();
        }
    }
}

var Scoreboard = {
    update: function (data) {
        var homeDigits = digits(data.home.score);
        var awayDigits = digits(data.away.score);

        var scoreBox = $('#score_box');
        scoreBox.find('.score.home .digit.tens').text(homeDigits[0]);
        scoreBox.find('.score.home .digit.ones').text(homeDigits[1]);

        scoreBox.find('.score.guest .digit.tens').text(awayDigits[0]);
        scoreBox.find('.score.guest .digit.ones').text(awayDigits[1]);

        var minutes = Math.floor(data.time / 1000 / 60);
        var seconds = Math.floor((data.time / 1000) % 60);
        var minuteDigits = digits(minutes);
        var secondDigits = digits(seconds);

        scoreBox.find('.clock .digit.minutes.tens').text(minuteDigits[0]);
        scoreBox.find('.clock .digit.minutes.ones').text(minuteDigits[1]);
        scoreBox.find('.clock .digit.seconds.tens').text(secondDigits[0]);
        scoreBox.find('.clock .digit.seconds.ones').text(secondDigits[1]);

        $('#penalty_box .period .digit').text(data.period);
        updatePenalties('home', data.home.penalties);
        updatePenalties('guest', data.away.penalties);
    },
    updatePower: function () {
        // no-op on viewer
    },
    updateBuzzer: function (data) {
        var body = $('body');
        if (data.buzzerOn) {
            if (!body.hasClass('buzzer')) {
                body.addClass('buzzer');
            }
        } else {
            if (body.hasClass('buzzer')) {
                body.removeClass('buzzer');
            }
        }
    }
};

