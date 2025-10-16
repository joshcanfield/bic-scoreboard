# Feature Requests

Add option in “New Game” to include intermission timer (we are supposed to do 1 minute for PPHL, 1:00 is standard for youth games, but we play it by ear usually.  Can you make it so if it is timing an intermission penalties stay on the clock, but don’t run during the intermission?

Have templates when you create a new game.   Here are the timing we most frequently use:

Jr:

15 w/u

15 intermission

20 period

15 intermission

20 period

15 intermission

20 period

Youth 60 minute time slot:

5 w/u

15 period

1 intermission

15 period

1 intermission

12 period

Youth 75 minutes time slot:

5 w/u

13 period

1 intermission

13 period

1 intermission

13 period

PPHL adults

3 w/u

17 period

1 intermission

17 period

1 intermission

17 period

Hot keys

Up arrow start clock

Down arrow stop clock

Left arrow increment score for whatever team is on the left side of the screen

Right arrow increment score for whatever team is on the right side of the screen

Mirror the above to WSAD just like FPS games. The keyboard in the score box is for gaming so it has WSAD highlighted in red already.

Q - increment shot clock for team on the left side of the screen, E increment shot clock for the right side of the screen.

Sportsenginge Integration (PPHL)? I still need to get with Jared about getting you access to sportsengine so you can reverse engineer.  We would probably have to create dummy games that you could play with.

This one is trickier.  Sportsengine does not have it’s own clock.  For every event, the scorekeeper has to manually enter the clock time into sportsengine when they create any event (penalty, goal etc.)  It probably makes the most sense if you can make it so that when you enter events into the scoreboard it adds them into the sportsengine using the clock time from the scoreboard.

Obviously if we’re entering stuff in the scoreboard and having it update into the score sheet we would need the scoreboard program to ask all the right questions (who scored, who assisted, even strength/powerplay/shorthanded, penalty type player number/served by) so that the right info got to sportsengine
