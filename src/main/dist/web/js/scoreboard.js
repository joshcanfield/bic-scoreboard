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

function formatClock(minutes, seconds) {
    return pad(minutes, 2) + ":" + pad(seconds, 2);
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
            remaining = p.time - p.elapsed;
            if (remaining < 0) remaining = 0;
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
        Server.createGame(
            {
                periods: [
                    {
                        label: 0,
                        length: 5,
                        intermission: true
                    },
                    {
                        label: 1,
                        length: 20,
                        intermission: false
                    },
                    {
                        label: 1,
                        length: 2,
                        intermission: true
                    },
                    {
                        label: 2,
                        length: 20,
                        intermission: false
                    },
                    {
                        label: 2,
                        length: 2,
                        intermission: true
                    },
                    {
                        label: 3,
                        length: 18,
                        intermission: false
                    }
                ]
            }
        );
    },
    refresh: function () {
        $.ajax({
            url: "/api/game"
        }).success(function (data) {
            Scoreboard.update(data);
        })
    },
    update: function (data) {
        Scoreboard.time = data.time;
        Scoreboard.running = data.running;
        Scoreboard.period = data.period;
        Scoreboard.periodLengthMillis = data.periodLength * 60 * 1000;
        Scoreboard.home = data.home;
        Scoreboard.away = data.away;

        $('#home').find('tbody.list').html(formatPenalties('home', data.home.penalties, data));
        $('#away').find('tbody.list').html(formatPenalties('away', data.away.penalties, data));

        $("#clock").html(formatClock(Scoreboard.getMinutes(), Scoreboard.getSeconds()));
        $("#clock-elapsed").html(formatClock(Scoreboard.getElapsedMinutes(), Scoreboard.getElapsedSeconds()));
        $("#period-length").html(formatClock(data.periodLength, 0));
        $("#period").html(Scoreboard.period);

        $("#clock-pause").toggle(Scoreboard.running);
        $("#clock-start").toggle(!Scoreboard.running);

        $("#home-score").html(data.home.score);
        $("#away-score").html(data.away.score);

        Scoreboard.updatePower(data);
        Scoreboard.updateBuzzer(data);
    },
    updatePower: function (data) {
        var power = $("#power");
        power.prop('checked', data.scoreboardOn);
    },
    updateBuzzer: function (data) {
        var buzzer = $("#buzzer");
        if (data.buzzerOn) {
            if (!buzzer.hasClass("btn-danger")) {
                buzzer.addClass("btn-danger");
                buzzer.addClass("btn-lg");
                buzzer.removeClass("btn-warning");
                buzzer.removeClass("btn-sm");
            }
        } else {
            if (!buzzer.hasClass("btn-warning")) {
                buzzer.removeClass("btn-danger");
                buzzer.removeClass("btn-lg");
                buzzer.addClass("btn-warning");
                buzzer.addClass("btn-sm");
            }
        }
    },

    setClock: function (time) {
        var d = new $.Deferred;

        var clockMillis = time;
        if (typeof time === 'string') {
            clockMillis = parseClockMillis(time);
        }

        if (!clockMillis) {
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
    addPenalty: function (team, penalty) {
        doPost(team + "/penalty", penalty);
    },
    deletePenalty: function (team, id) {
        doDelete(team + "/penalty/" + id);
        return false;
    },
    getMinutes: function () {
        return getMinutes(Scoreboard.time);
    },
    getSeconds: function () {
        return getSeconds(Scoreboard.time);
    },
    getElapsedMinutes: function () {
        var elapsed = Scoreboard.periodLengthMillis - Scoreboard.time;
        return Math.floor(elapsed / (60 * 1000));
    },
    getElapsedSeconds: function () {
        var elapsed = Scoreboard.periodLengthMillis - Scoreboard.time;
        return Math.floor((elapsed / 1000)) % 60;
    }
};

$(document).ready(function () {
        $('#buzzer').click(Server.buzzer);
        $('#power').click(Server.power);
        $("#clock-start").click(Server.startClock);
        $("#clock-pause").click(Server.pauseClock);

        $(".period-up").click(function () {
            Server.setPeriod(Scoreboard.period + 1);
        });

        $(".period-down").click(function () {
            var p = Scoreboard.period;
            if (p > 0) --p;
            Server.setPeriod(p);
        });

        $(".score-up").click(function () {
            // TODO: add player/assist tracking
            Server.goal({ "team": this.dataset.team, "player": 10, "assist": 15 })
        });

        $(".score-down").click(function () {
            Server.undoGoal({ "team": this.dataset.team})
        });

        var setClockDialog = $('#set-clock');
        setClockDialog.find('button.time').click(function () {
            var time = $(this).data('time');
            console.log("Setting time: " + time);
            Scoreboard.setClock("" + time).done(function () {
                setClockDialog.modal('hide');
                setClockDialog.find('.error').html();
            }).fail(function (msg) {
                setClockDialog.find('.error').html(msg);
            });
        });

        $('#save-custom-time').click(function () {
            var customTime = $('#custom-time').val();
            console.log("set time " + customTime);
            Scoreboard.setClock(customTime).done(function () {
                setClockDialog.modal('hide');
            }).fail(function (msg) {
                setClockDialog.find('.error').html(msg);
            });
        });

        setClockDialog.on('show.bs.modal', function (e) {
            setClockDialog.find('.error').html('');
        });

        var newGameDialog = $('#new-game-dialog');
        $("#new-game").click(function () {
            var periods = [];
            var error = false;
            for (var i = 0; i <= 3; ++i) {
                var timeField = $('#period-' + i);

                var val = timeField.val();
                if (i == 0 && val == '0') {
                    periods[i] = 0;
                } else {
                    var time = parseInt(val);
                    if (!time) {
                        timeField.closest('.form-group').addClass('has-error');
                        error = true;
                    } else {
                        periods[i] = time
                    }
                }

            }

            if (error) {
                return false;
            }

            Server.createGame({periodLengths: periods});

            newGameDialog.modal('hide');
        });

        // before display
        newGameDialog.on('show.bs.modal', function (e) {
            // remove errors
            $(this).find(".modal-body .form-group").removeClass('has-error');
        });

        // after displayed
        newGameDialog.on('shown.bs.modal', function () {

        });


        var penaltyDialog = $('#add-penalty');
        $("#add-penalty-add").click(function () {
            var penalty = {};
            var playerField = $('#add-penalty-player');
            var timeField = $('#add-penalty-time');

            var error = false;
            penaltyDialog.find(".modal-body .form-group").removeClass('has-error');

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
            var team = penaltyDialog.data('team');
            Scoreboard.addPenalty(team, penalty);
            penaltyDialog.modal('hide');

            return false;
        });

        // before display
        penaltyDialog.on('show.bs.modal', function (e) {
            var team = e.relatedTarget.dataset.team;
            penaltyDialog.data('team', team);

            $(this).find(".modal-title").html(team + " Penalty");
            // update clock
            $('#add-penalty-off_ice').val(formatClock(Scoreboard.getMinutes(), Scoreboard.getSeconds()));

            // remove errors
            $(this).find(".modal-body .form-group").removeClass('has-error');
        });

        // after displayed
        penaltyDialog.on('shown.bs.modal', function () {
            $("#add-penalty-player")[0].focus();
        });
    }
);