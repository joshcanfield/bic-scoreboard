// expects jquery to be loaded first
function pad(d, w) {
    return ("000000" + d).substr(w * -1);
}

function parseClock(clock) {
    var parts = clock.split(':', 2);
    if (parts.length != 2) {
        return false;
    }
    var m = parseInt(parts[0]);
    var s = parseInt(parts[1]);

    if (isNaN(m) || isNaN(s)) return false;
    return {minutes: m, seconds: s}
}
function parseClockMillis(clock) {
    var parts = parseClock(clock);
    if (parts === false) return false;
    return parts.minutes * 60 * 1000 + parts.seconds * 1000;
}

function formatClock() {
    return pad(Scoreboard.getMinutes(), 2) + ":" + pad(Scoreboard.getSeconds(), 2);
}

function getMinutes(millis) {
    return Math.floor((millis + 999) / (60 * 1000));
}
function getSeconds(millis) {
    return Math.floor((millis + 999) / 1000 % 60);
}
function formatTime(remaining) {
    return getMinutes(remaining) + ':' + pad(getSeconds(remaining), 2);
}
function formatPenalties(penalties, data) {
    var table = '';
    for (var i = 0; i < penalties.length; ++i) {
        var p = penalties[i];
        var remaining = p.time;
        if ( p.startTime > 0 ) {
            var startTime = p.startTime + ((data.period - p.period) * 20 * 60 * 1000);
            remaining = p.time - (startTime - data.time);
        }

        table += '<tr>' +
            '<td>' + p.period + '</td>' +
            '<td>' + p.playerNumber + '</td>' +
            '<td>' + formatTime(p.time) + '</td>' +
            '<td>' + formatTime(p.offIceTime) + '</td>' +
            '<td>' + formatTime(p.startTime) + '</td>' +
            '<td>' + formatTime(remaining) + '</td>' +
            '</tr>';
    }
    return table;
}
Scoreboard = {
    time: 0,
    home: {},
    away: {},
    update: function (data) {
        Scoreboard.time = data.time;
        Scoreboard.running = data.running;
        Scoreboard.period = data.period;
        Scoreboard.home = data.home;
        Scoreboard.away = data.away;

        $('#home').find('tbody.list').html(formatPenalties(data.home.penalties, data));
        $('#away').find('tbody.list').html(formatPenalties(data.away.penalties, data));

        $("#clock").html(formatClock());
        $("#period").html(Scoreboard.period);

        $("#clock-pause").toggle(Scoreboard.running);
        $("#clock-start").toggle(!Scoreboard.running);

        $("#home-score").html(data.home.score);
        $("#away-score").html(data.away.score);
    },
    startClock: function () {
        $.ajax({
            type: "POST",
            url: "/api/game/clock",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                "running": true
            })
        }).done(function (data) {

            })
    },
    pauseClock: function () {
        $.ajax({
            type: "POST",
            url: "/api/game/clock",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                "running": false
            })
        }).done(function (data) {

            })
    },
    // this is x-edit aware (http://vitalets.github.io/x-editable/docs.html)
    setClock: function (params) {
        var d = new $.Deferred;

        var clock = parseClock(params.value);
        if (clock === false) {
            return d.reject('Invalid time. Example 20:00'); //returning error via deferred object
        }

        $.ajax({
            type: "POST",
            url: "/api/game/clock",
            contentType: "application/json",
            data: JSON.stringify(clock)
        }).done(function () {
                d.resolve();
            }).fail(function () {
                return d.reject('failed to updated the time'); //returning error via deferred object
            });
        return d.promise();
    },
    setPeriod: function (p) {
        console.log("Setting period to " + p);
        $.ajax({
            type: "POST",
            url: "/api/game/",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                "period": p
            })
        }).done(function (data) {

            })
    },

    addHomeScore: function () {
        $.ajax({
            type: "POST",
            url: "/api/game/home/goal",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                "player": 10,
                "assist": 15
            })
        }).done(function (data) {

            })
    },
    subHomeScore: function () {
        $.ajax({
            type: "DELETE",
            url: "/api/game/home/goal"
        }).done(function (data) {

            })
    },
    addAwayScore: function () {
        $.ajax({
            type: "POST",
            url: "/api/game/away/goal",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                "player": 10,
                "assist": 15
            })
        }).done(function (data) {

            })
    },
    subAwayScore: function () {
        $.ajax({
            type: "DELETE",
            url: "/api/game/away/goal"
        }).done(function (data) {

            })
    },
    addPenalty: function (team, penalty) {

        $.ajax({
            type: "POST",
            url: "/api/game/" + team + "/penalty",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify(penalty)
        }).done(function (data) {

            })
    },
    getMinutes: function () {
        return getMinutes(Scoreboard.time);
    },
    getSeconds: function () {
        return getSeconds(Scoreboard.time);
    }
};


// grab data from the api
function update() {
    $.ajax({
        url: "/api/game"
    }).success(function (data) {
            Scoreboard.update(data);
            setTimeout(update, 500);
        })
}

$(document).ready(function () {
        $("#clock-start").click(Scoreboard.startClock);
        $("#clock-pause").click(Scoreboard.pauseClock);
//        $("#clock").click(Scoreboard.setClock);

        $(".period-up").click(function () {
            Scoreboard.setPeriod(Scoreboard.period + 1);
        });
        $(".period-down").click(function () {
            var p = Scoreboard.period;
            if (p > 0) --p;
            Scoreboard.setPeriod(p);
        });

        $(".score-up").click(function () {
            if (this.dataset.team == "home") {
                Scoreboard.addHomeScore()
            } else {
                Scoreboard.addAwayScore();
            }
        });

        $(".score-down").click(function () {
            if (this.dataset.team == "home") {
                Scoreboard.subHomeScore()
            } else {
                Scoreboard.subAwayScore();
            }
        });

        $('#clock').editable({
            placement: 'bottom',
            url: Scoreboard.setClock,
            emptytext: '00:00'

        });
        update();

        var dialog = $('#add-penalty');
        $("#add-penalty-add").click(function () {
            var penalty = {};
            var playerField = $('#add-penalty-player');
            var timeField = $('#add-penalty-time');

            var error = false;
            dialog.find(".modal-body .form-group").removeClass('has-error');

            penalty.playerNumber = playerField.val();
            if (!penalty.playerNumber) {
                playerField.closest('.form-group').addClass('has-error');
                error = true;
            }

            penalty.time = parseClockMillis(timeField.val());
            if (!penalty.time) {
                timeField.closest('.form-group').addClass('has-error');
                error = true;
            }

            penalty.servingPlayerNumber = $('#add-penalty-serving').val();

            var offIceField = $('#add-penalty-off_ice');
            penalty.offIceTime = parseClockMillis(offIceField.val());
            if (!penalty.offIceTime) {
                offIceField.closest('.form-group').addClass('has-error');
                error = true;
            }

            if (error) return;
            penalty.period = Scoreboard.period;
            var team = dialog.data('team');
            Scoreboard.addPenalty(team, penalty);
            dialog.modal('hide');
            return false;
        });

        // before display
        dialog.on('show.bs.modal', function (e) {
            var team = e.relatedTarget.dataset.team;
            dialog.data('team', team);

            $(this).find(".modal-title").html(team + " Penalty");
            // update clock
            $('#add-penalty-off_ice').val(formatClock());

            // remove errors
            $(this).find(".modal-body .form-group").removeClass('has-error');
        });

        // after displayed
        dialog.on('shown.bs.modal', function (e) {
            $("#add-penalty-player")[0].focus();
        });
    }
)
;