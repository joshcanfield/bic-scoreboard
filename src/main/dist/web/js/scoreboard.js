// expects jquery to be loaded first
function pad(d, w) {
    return ("000000" + d).substr(w * -1);
}

function parseClock(clock) {
    // 20:00
    clock = clock.replace(':', '');
    // 2000

    var m;
    var s;
    if (clock.length > 2) {
        s = parseInt(clock.substr(-2));
        m = parseInt(clock.substr(-clock.length, clock.length - 2));
    } else {
        s = parseInt(clock.substr(-clock.length));
        m = 0;
    }

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
function formatPenalties(team, penalties, data) {
    var table = '';
    for (var i = 0; i < penalties.length; ++i) {
        var p = penalties[i];
        var remaining = p.time;
        if (p.startTime > 0) {
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
            '<td><a href="#" data-team="' + team + '" data-pid="' + p.id + '" onclick="deletePenalty(this); return false;">x</a></td>' +
            '</tr>';
    }
    return table;
}

function deletePenalty(link) {
    var team = $(link).data('team');
    var pid = $(link).data('pid');
    Scoreboard.deletePenalty(team, pid);
}

function doMethod(method, endpoint, value) {
    var options = {
        type: method,
        url: "/api/game/" + endpoint,
        contentType: "application/json"
    };
    if (value) {
        options.dataType = "json";
        options.data = JSON.stringify(value);
    }
    return $.ajax(options)
}

function updateGame(value) {
    return doMethod("PUT", "", value);
}

function doPost(endpoint, value) {
    return doMethod("POST", endpoint, value);
}

function doDelete(endpoint) {
    $.ajax({
        type: "DELETE",
        url: "/api/game/" + endpoint
    })
}
Scoreboard = {
    time: 0,
    home: {},
    away: {},
    newGame: function () {
        doPost("", {

        });
    },

    update: function (data) {
        Scoreboard.time = data.time;
        Scoreboard.running = data.running;
        Scoreboard.period = data.period;
        Scoreboard.home = data.home;
        Scoreboard.away = data.away;

        $('#home').find('tbody.list').html(formatPenalties('home', data.home.penalties, data));
        $('#away').find('tbody.list').html(formatPenalties('away', data.away.penalties, data));

        $("#clock").html(formatClock());
        $("#period").html(Scoreboard.period);

        $("#clock-pause").toggle(Scoreboard.running);
        $("#clock-start").toggle(!Scoreboard.running);

        $("#home-score").html(data.home.score);
        $("#away-score").html(data.away.score);

        var power = $("#power");
        if (data.scoreboardOn != power.data("state")) {
            power.removeClass(data.scoreboardOn ? "off" : "on");
            power.addClass(!data.scoreboardOn ? "off" : "on");
            power.data("state", data.scoreboardOn);
        }
    },
    startClock: function () {
        updateGame({"running": true});
    },
    pauseClock: function () {
        updateGame({"running": false});
    },
    // this is x-edit aware (http://vitalets.github.io/x-editable/docs.html)
    setClock: function (params) {
        var d = new $.Deferred;

        var clockMillis = parseClockMillis(params.value);
        if (clockMillis === false) {
            return d.reject('Invalid time. Example 20:00'); //returning error via deferred object
        }

        updateGame({time: clockMillis})
            .done(function () {
                d.resolve();
            })
            .fail(function () {
                return d.reject('failed to updated the time'); //returning error via deferred object
            });
        return d.promise();
    },
    setPeriod: function (p) {
        updateGame({ "period": p });
    },
    addScore: function (team) {
        doPost(team + "/goal", { "player": 10, "assist": 15 });
    },
    subScore: function (team) {
        doDelete(team + "/goal");
    },
    addPenalty: function (team, penalty) {
        doPost(team + "/penalty", penalty);
    },
    deletePenalty: function (team, id) {
        doDelete(team + "/penalty/" + id);
        return false;
    },
    buzzer: function () {
        doPost("buzzer");
    },
    power: function () {
        doPost("power");
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
        $('#buzzer').click(Scoreboard.buzzer);
        $('#new-game').click(Scoreboard.newGame);
        $('#power').click(Scoreboard.power);
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
            Scoreboard.addScore(this.dataset.team)
        });

        $(".score-down").click(function () {
            Scoreboard.subScore(this.dataset.team)
        });

        $('#clock').editable({
            placement: 'bottom',
            url: Scoreboard.setClock,
            emptytext: '00:00'

        });

        // update starts the polling
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

            if (error) return false;

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
        dialog.on('shown.bs.modal', function () {
            $("#add-penalty-player")[0].focus();
        });
    }
);