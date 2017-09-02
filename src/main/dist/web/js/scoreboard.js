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
    portNames: [],
    currentPort: "",
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

        var $home = $('#home');
        var $away = $('#away');

        $home.find('tbody.list').html(formatPenalties('home', data.home.penalties, data));
        $away.find('tbody.list').html(formatPenalties('away', data.away.penalties, data));

        var $clockBox = $("#clock_box");

        function digits(n) {
            var digits = [];
            digits[0] = Math.floor(n / 10);
            digits[1] = n % 10;
            return digits;
        }

        var minuteDigits = digits(Scoreboard.getMinutes());
        $clockBox.find(".digit.minutes.tens").html(minuteDigits[0]);
        $clockBox.find(".digit.minutes.ones").html(minuteDigits[1]);

        var secondDigits = digits(Scoreboard.getSeconds());
        $clockBox.find(".digit.seconds.tens").html(secondDigits[0]);
        $clockBox.find(".digit.seconds.ones").html(secondDigits[1]);

        var minutes = Scoreboard.getElapsedMinutes();
        var seconds = Scoreboard.getElapsedSeconds();

        var moment = "";
        if (minutes === 1) {
            moment += minutes + " minute";
        } else if (minutes > 1) {
            moment += minutes + " minutes";
        }
        if (minutes > 0) {
            moment += " and ";
        }
        if (seconds === 1) {
            moment += seconds + " seconds";
        } else {
            moment += seconds + " seconds";
        }
        if (moment === "") {
            moment = "&nbsp;";
        }
        $("#clock-moment").html(moment);

        $("#period").find(".digit").html(Scoreboard.period);

        $("#clock-pause").toggle(Scoreboard.running);
        $("#clock-start").toggle(!Scoreboard.running);

        var homeDigits = digits(data.home.score);
        $home.find(".score .digit.tens").html(homeDigits[0]);
        $home.find(".score .digit.ones").html(homeDigits[1]);

        var awayDigits = digits(data.away.score);
        $away.find(".score .digit.tens").html(awayDigits[0]);
        $away.find(".score .digit.ones").html(awayDigits[1]);

        Scoreboard.updatePower(data);
        Scoreboard.updateBuzzer(data);
    },
    updatePower: function (data) {
        var power = $("#power");
        power.prop('checked', data.scoreboardOn);
    },
    updateBuzzer: function (data) {
        var body = $('body');
        if (data.buzzerOn) {
            if (!body.hasClass("buzzer")) {
                body.addClass("buzzer");
            }
        } else {
            if (body.hasClass("buzzer")) {
                body.removeClass("buzzer");
            }
        }
    },
    getPortNames: function () {
        var d = new $.Deferred;
        doMethod("GET", "portNames").success(function (data) {
            Scoreboard.updatePorts(data);
        }).done(function () {
            d.resolve();
        });
        return d.promise();
    },
    updatePorts: function (data) {
        console.debug("ports:", data);
        Scoreboard.portNames = data.portNames;
        Scoreboard.currentPort = data.currentPort;
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
        if (Scoreboard.periodLengthMillis === 0) {
            return 0;
        }
        var elapsed = Scoreboard.periodLengthMillis - Scoreboard.time;
        return Math.floor(elapsed / (60 * 1000));
    },
    getElapsedSeconds: function () {
        if (Scoreboard.periodLengthMillis === 0) {
            return 0;
        }
        var elapsed = Scoreboard.periodLengthMillis - Scoreboard.time;
        return Math.floor((elapsed / 1000)) % 60;
    }
};

$(document).ready(function () {
        $('#buzzer').click(Server.buzzer);

        function refreshPortDialog() {
            console.debug("current port: ", Scoreboard.currentPort);
            var items = Scoreboard.portNames
                .map(function (name) {
                    var selected = (name === Scoreboard.currentPort ? ' disabled' : '' );
                    return "<button "
                        + "class='btn btn-info" + selected + " port-name' "
                        + "data-portName='" + name + "'>" + name
                        + "</button>"
                })
                .join("");

            var $connect = $('#connect-portNames');
            $connect.html(items);
            $connect.find('button.port-name').click(function () {
                    setPortName($(this).data('portname'));
                }
            );
        }

        function setPortName(portName) {
            console.debug("show progress");
            $('#scoreboard-connect').find('.progress').show();

            doMethod("POST", "portName", {"portName": portName})
                .success(function (data) {
                    Scoreboard.updatePorts(data);
                })
                .done(function () {
                    refreshPortDialog();
                    console.debug("hide progress");
                    $('#scoreboard-connect').find('.progress').hide();
                })
        }

        var scoreboardConnectDialog = $('#scoreboard-connect');
        scoreboardConnectDialog.on('show.bs.modal', function () {
            refreshPortDialog();
        });
        var $power = $('#power');
        $power.click(Server.power);
        $power.change(function () {
            if (this.checked) {
                // fetch ports
                // open power modal
                Scoreboard.getPortNames().done(function () {
                    scoreboardConnectDialog.modal()
                });
            }
        });

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
            Server.goal({"team": this.dataset.team, "player": 10, "assist": 15})
        });

        $(".score-down").click(function () {
            Server.undoGoal({"team": this.dataset.team})
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

        // before display
        setClockDialog.on('show.bs.modal', function () {
            $('#custom-time').val(formatClock(Scoreboard.getMinutes(), Scoreboard.getSeconds()));
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

        setClockDialog.on('show.bs.modal', function () {
            setClockDialog.find('.error').html('');
        });

        var newGameDialog = $('#new-game-dialog');
        $("#new-game").click(function () {
            var periods = [];
            var error = false;
            for (var i = 0; i <= 3; ++i) {
                var timeField = $('#period-' + i);

                var val = timeField.val();
                if (i === 0 && val === '0') {
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

        $("#new-rec-game").click(function () {
            var timeField = $('#rec_minutes');
            var error = false;
            var time = parseInt(timeField.val());
            if (!time) {
                timeField.closest('.form-group').addClass('has-error');
                return false;
            }
            var shiftInterval = $('#shift-buzzer').val();

            if (error) {
                timeField.closest('.form-group').addClass('has-error');
                return false;
            }

            Server.createGame({
                buzzerIntervalSeconds: shiftInterval,
                periodLengths: [0, time]
            });

            newGameDialog.modal('hide');
        });

        // before display
        newGameDialog.on('show.bs.modal', function () {
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

        $('#game-tab').find('a').click(function (e) {
            e.preventDefault();
            $(this).tab('show')
        });

        // before display
        penaltyDialog.on('show.bs.modal', function (e) {
            var team = e.relatedTarget.dataset.team;
            penaltyDialog.data('team', team);

            $(this).find(".modal-title").html(team + " Penalty");
            // update clock
            $('#add-penalty-off_ice').val(formatClock(Scoreboard.getMinutes(), Scoreboard.getSeconds()));
            $('#add-penalty-serving').val('');
            $('#add-penalty-player').val('');

            // remove errors
            $(this).find(".modal-body .form-group").removeClass('has-error');
        });

        // after displayed
        penaltyDialog.on('shown.bs.modal', function () {
            $("#add-penalty-player")[0].focus();
        });


    }
);