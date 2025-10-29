# General
The overall look and feel is fantastic. There a couple of design elements I want to improve across the application in general.

## Time Selector Widgets
I'd like to implement a time picker more like google calendars that has an easy drop down for all hours and defaults to 00, 15, 30, 45 as common minutes, but allows the user to type in a more specific value if they want. Use this time component for all instances where a user inputs time.

## Duration Picker
Along the lines of time selector, the schedule practice widget has a duration drop-down with just a few presets in it, let's keep using that concept, again like google calendar, but allow users to input custom durations. Or select start-time and end-time

## Scroll bars
Several of the modals (Schedule show, Setlist, etc) result in vertical scrollbars appearing on the screen. I'm okay with this in some cases, but I'd like to apply a style that is consistent with our theme and not the browser default one.

# Setlists
Setlists is one of the few pages where I think I would rather have multiple views rather than a modal for creating new setlists. There is going to be a lot that goes into organizing setlists and supports this in the future, so we need real estate to view the songs. I think I would like to use the same general concept as the Songs page for viewing the songs in the setlist. Users will want to for sure be able to view the guitar tunings as they build their setlist to minimize tuning changes during the show, and in future iterations also view casting.

## Setlist builder
With the setlist being a full page, let's make a drawer that can slide out to add songs, be sure to remove songs from the list once they are added. Keep the search that will filter down the songs in the list by name or artist.

We also want to support adding breaks or sections to the setlist. I'm open to creative suggestions on how to handle this

I think it would be nice to have a way to quick-add songs from the set view to the next practice session, as well.

# Songs
Overall, really like the songs page, the only thing I was thinking of updating was the section to add links. Maybe something that let's you name the link, prefill with Spotify, YouTube, Ultimate-Guitar, and other, and then paste the URL and then add them as a list item underneath with then an option to delete them or edit them.

# Band Members
I like the starting point for this, I think we want to add ability to add other instruments, harmonica, trumpet, trombone, saxaphone, etc. I don't want to provide built-ins for every instrument, but we need a way to add other ones besides "other"--this will come in during casting additions in the future

# Auth
This is a very pretty UI, but remember we are using Google auth with supabase, so let's add the "Sign in with Google" option and make it predominant, I would rather people sign in that way than managing useranmes and passwords.

# Shows
I'm a little uncertain on how to handle coupling setlists and shows. On the one hand, we may want to use the same setlist over and over, but on the other there are likely to be lots of nuances between shows so while we may start with an existing setlist, I maybe think we should "fork" the setlist to create a unique one for individual shows, that way additions or changes during an event won't automatically propogate back to the original setlist. I would also like a way from the show page to view the planned setlist, perhaps a simple expand on the show cards would work. I want to be sure that the song cards look consistent across all pages.