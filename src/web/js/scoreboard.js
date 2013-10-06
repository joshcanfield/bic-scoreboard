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

        $("#clock").html(pad(Scoreboard.getMinutes(), 2) + ":" + pad(Scoreboard.getSeconds(), 2));
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
    getMinutes: function () {
        return Math.floor((Scoreboard.time + 999) / (60 * 1000));
    },
    getSeconds: function () {
        return Math.floor((Scoreboard.time + 999) / 1000 % 60);
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
        update()
    }
)
;