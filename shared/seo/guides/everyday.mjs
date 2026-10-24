// Guides for the everyday apps (shape in tools/seo/guides.mjs). Every step matches the app as it is; screenshots are real.
// Slop Transcribe, Time, Slopculator, AI, AI Tools, Slopnodes, Serial counter, Calendar, To-do, Reminders, Drive, Music,
// Reel Remix and SlopCut (registry id slopedit).
export const GUIDES = [
  // Slop Transcribe
  { app: 'transcribe', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slop Transcribe: voice and audio to text',
    description: 'Record your voice or add audio and video files, turn the speech into text on your device, correct it, and save it as text, Word or subtitles. A short guide.',
    h1: 'Getting started with Slop Transcribe',
    lead: 'Slop Transcribe turns speech into text with Whisper, on your own device. Nothing is uploaded.',
    sections: [
      { h2: 'Get the speech model once', text: ['The first time, the page says This tool needs a model. Choose Get more…: the dialog shows Whisper tiny, its licence and its size, about 40 MB. Choose Download. It is stored on this device, so you only do this once.'],
        image: { src: '/assets/guides/transcribe-getting-started-1.jpg', alt: 'The Get Whisper tiny dialog with the licence, the source and a 40 MB download' } },
      { h2: 'Add audio and transcribe it', steps: ['Drop audio or video files on the page, or choose Choose files. MP3, WAV, M4A, OGG, FLAC and video files work, several at once. Or choose Record to use the microphone.', 'Leave Spoken language on Detect, or pick the language.', 'Choose Transcribe. Each file is read in turn and marked Done.'],
        tip: 'Whisper tiny is quick but can get names and noisy audio wrong. Read the text before you use it.' },
      { h2: 'Correct and save the text', text: ['Pick a file in the Files list to see its text. Type in the box to correct it; your corrections are kept for Text and Word. Show times adds the time of each line.', 'Choose a format: Text (.txt), Word (.docx), Subtitles (.srt) or Web subtitles (.vtt), then choose Download. Copy, Save to Slop Drive and Open in Slop Docs are there too.'],
        image: { src: '/assets/guides/transcribe-getting-started-2.jpg', alt: 'A finished transcript in Slop Transcribe with the times shown and the download options above it' } },
    ] },

  // Slop Time
  { app: 'time', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slop Time: world clock, meetings and time zones',
    description: 'Add cities to a world clock, find a meeting time that suits every time zone, convert a time between zones, and use the stopwatch and countdown. A short guide.',
    h1: 'Getting started with Slop Time',
    lead: 'Slop Time shows the time around the world, plans meetings across time zones and converts times. It uses your device clock and nothing is sent anywhere.',
    sections: [
      { h2: 'Build your world clock', text: ['The World clock tab starts with London, New York and Tokyo. Type a city or zone in Add a city or time zone and press Enter to add it. Each card shows the time, the day, the offset from GMT and whether it is a working day there. Remove takes a city off.'],
        image: { src: '/assets/guides/time-getting-started-1.jpg', alt: 'The World clock tab with London, New York, Tokyo and Sydney' } },
      { h2: 'Plan a meeting', steps: ['Set your working hours and days on the My time tab.', 'Open Meetings and pick the Day.', 'Add the zones of the people you are meeting, or choose Use my cities.', 'The planner lists every window when everyone is inside working hours, with each local time. Add to Calendar puts one into Slop Calendar.'],
        image: { src: '/assets/guides/time-getting-started-2.jpg', alt: 'The Meeting planner showing a three-hour window that suits London and New York' } },
      { h2: 'Convert a time', text: ['On the Convert tab, type a time and pick the zone it is in, or choose Use the current time. Every city in your list is shown with its time and day. Below, Time difference between two zones says how far apart two zones are right now.'],
        image: { src: '/assets/guides/time-getting-started-3.jpg', alt: 'The Time zone converter with four cities and the difference between Chicago and London' } },
      { h2: 'Timers and clock offset', text: ['Timers has a stopwatch with laps and a countdown that takes 5, 4:30 or 1:05:00. Sync lets you type a time from a source you trust; Slop Time then shows the clocks moved by the difference. It never fetches the time itself.'] },
    ],
    shortcuts: [['Ctrl+Alt+1 to 6', 'Open World clock, My time, Meetings, Convert, Timers or Sync'], ['Ctrl+Alt+A', 'Add a city'], ['Ctrl+Alt+G', 'Start or stop the stopwatch'], ['Ctrl+K', 'Search commands (Cmd+K on a Mac)']] },

  // Slopculator
  { app: 'calculator', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slopculator: sums, units, dates and a paper tape',
    description: 'Type a calculation in plain words: percentages, tax, units, currency, dates and times. Every answer goes on a paper tape and into a history you can search.',
    h1: 'Getting started with Slopculator',
    lead: 'Slopculator is a calculator you type into. It understands percentages, units, currencies, dates and times, and keeps a paper tape of what you worked out.',
    sections: [
      { h2: 'Type a calculation', text: ['Type in Type a calculation and press Enter, or choose =. The answer shows under the line as you type. The keys under it insert brackets, powers, %, √, in, of, ans and the helpers.', 'Some things to try: 1200 + 20%, 20% of 150, 5 km in mi, 100 C in F, 17:00 - 08:15, 2026-12-25 - today in weeks, tax(200, 8), discount(200, 15) and markup(100, 25).'],
        image: { src: '/assets/guides/calculator-getting-started-1.jpg', alt: 'Slopculator with a variable, the paper tape and the history' } },
      { h2: 'Names, tape and history', text: ['Give a value a name, such as price = 19.99, and use it in later lines: price * 3. Your names are listed under Variables.', 'Each answer goes on the Paper tape for this visit. History keeps up to 200 calculations on this device; search it and click one to use it again. Save to Slop Drive keeps a calculation as a file.'] },
      { h2: 'Convert and currencies', text: ['The Convert panel converts a value between units: pick the Category, From and To. For money, 100 USD in EUR uses a rate you saved under Exchange rates, or else a rate from Slop Ledger.', 'When the answer is a date, Add to Calendar puts it in Slop Calendar as an all-day event.'] },
    ],
    shortcuts: [['Enter', 'Calculate'], ['Up / Down', 'Bring back earlier lines'], ['Esc', 'Clear the line'], ['Ctrl+Alt+C', 'Copy the result'], ['Ctrl+Alt+S', 'Save to Slop Drive'], ['Ctrl+Alt+K', 'Go to the line']] },

  // Slop AI
  { app: 'ai', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slop AI: check your PC, pick a model, chat',
    description: 'See whether your computer can run a local AI model, download one once, then chat or build a small app with it, offline and in your browser. A short guide.',
    h1: 'Getting started with Slop AI',
    lead: 'Slop AI runs a language model on your own computer, in the browser, with WebGPU. Your chats never leave your device.',
    sections: [
      { h2: 'Check what your computer can run', text: ['Open Can my PC run it?. It shows your GPU and its limits, your memory and storage, and a short benchmark, then which models will run well, run slowly or not fit. Spec card saves a picture of the results.', 'If WebGPU is missing, the page says how to turn it on in your browser. Try the demo engine lets you look around with canned replies; nothing downloads.'],
        image: { src: '/assets/guides/ai-getting-started-1.jpg', alt: 'The Can my PC run it? tab on a computer without WebGPU, with the steps to turn it on' } },
      { h2: 'Download a model', text: ['The Models tab lists each model with its download size, GPU memory, context and licence. The smallest, Qwen2.5 0.5B, is about 290 MB; the largest are a few GB. Choose Download and confirm. It downloads once from huggingface.co and then runs offline.', 'Set default loads that model by itself next time. Load from disk… uses a model folder you already have.'],
        image: { src: '/assets/guides/ai-getting-started-2.jpg', alt: 'The Models tab with model cards showing download size, GPU memory and licence' } },
      { h2: 'Chat and build', text: ['On the Chat tab, type in Message Slop AI and press Enter. Pick a persona such as Helpful assistant, attach text files, and export a chat to Slop Drive. Control apps lets the model open apps and save files for you.', 'The Build tab asks the model to write a small app as one HTML file and runs it safely in a preview.'],
        image: { src: '/assets/guides/ai-getting-started-3.jpg', alt: 'The Chat tab with no model loaded, offering Choose a model and Can my PC run it?' } },
    ],
    shortcuts: [['Ctrl+K', 'Search commands (Cmd+K on a Mac)']] },

  // Slop AI Tools
  { app: 'aitools', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slop AI Tools: OCR, speech, denoise and more',
    description: 'Five AI tools that run on your device: read text from images, transcribe audio, denoise photos, suggest tags and blur a portrait background. A short guide.',
    h1: 'Getting started with Slop AI Tools',
    lead: 'Slop AI Tools gathers five small AI tools that run on your device. Nothing is uploaded, and each model downloads only when you ask for it.',
    sections: [
      { h2: 'The five tools', text: ['OCR reads text from an image or a scanned PDF page. Speech to text transcribes audio or a video, with timestamps. Denoise cleans up a noisy photo with a before and after slider. Auto tags suggests tags for a photo and saves them to Slop Drive. Portrait blur blurs the background behind a person.', 'Denoise and Portrait blur are ready at once. The others show Needs download until you get their model.'],
        image: { src: '/assets/guides/aitools-getting-started-1.jpg', alt: 'The Slop AI Tools hub with five tool cards and their status' } },
      { h2: 'Get a model', text: ['Choose Open and get the model on a tool, then Get more…. The dialog shows the model, its licence, where it comes from and its size before anything downloads. Choose Download. Each file is checked before it is stored on this device. The Models list at the bottom of the hub shows what you have and can remove it.'] },
      { h2: 'Read text from an image', steps: ['Open OCR.', 'Drop an image or a PDF, or choose a file. For a PDF, set the PDF page.', 'Choose Read text. The text appears in the box, where you can correct it.', 'Choose Copy, Download .txt or Send to Slop Docs.'],
        image: { src: '/assets/guides/aitools-getting-started-2.jpg', alt: 'The OCR tool after reading a label: the model and serial numbers in the text box' } },
    ] },

  // Slopnodes
  { app: 'nodes', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slopnodes: named formulas wired together',
    description: 'Build a live calculation from value, formula and output nodes joined by wires. Change a value and every result updates. Save projects to Slop Drive.',
    h1: 'Getting started with Slopnodes',
    lead: 'Slopnodes is a calculator drawn as boxes and wires. Each box has a name and a formula, and the answers update as soon as anything changes.',
    sections: [
      { h2: 'Start from the example', text: ['The first time, Slopnodes opens an example: price and qty values, a subtotal formula, a total output that adds tax, and the vat between them. Change 3 in qty and watch the total change. File, Load the example brings it back.'],
        image: { src: '/assets/guides/nodes-getting-started-1.jpg', alt: 'The Slopnodes example: price and qty wired into subtotal, total and vat' } },
      { h2: 'Add and wire nodes', steps: ['Choose + Value, + Formula, + Output or + Note, or right-click the canvas.', 'Click the name at the top of a node to rename it.', 'Type a value or a formula in the box. A formula uses other nodes by name, such as price * qty or tax(subtotal, 8). Units, currencies and dates work as in Slopculator.', 'Drag from a node’s right dot to another node’s left dot to connect them.'],
        text: ['Right-click a node to rename it, change its type, duplicate it or delete it. Right-click a wire to delete it.'] },
      { h2: 'Save your work', text: ['Your graph is kept on this device between visits. Save to Slop Drive saves it as a project; File, Open project… opens one again, and Save a copy… keeps a second version.'] },
    ],
    shortcuts: [['Ctrl+Z', 'Undo'], ['Ctrl+Y or Ctrl+Shift+Z', 'Redo'], ['Ctrl+D', 'Duplicate the selected node'], ['Ctrl+C / Ctrl+V', 'Copy and paste a node'], ['Ctrl+S', 'Save to Slop Drive'], ['Delete', 'Delete the selected node or wire'], ['Esc', 'Clear the selection'], ['Ctrl+wheel', 'Zoom']] },

  // Serial counter
  { app: 'serials', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Serial counter: count serials from label photos',
    description: 'Add a batch of photos of labels, read the serial numbers on your device, and get a table of unique serials and totals to download as CSV. A short guide.',
    h1: 'Getting started with Serial counter',
    lead: 'Serial counter reads the serial numbers on photos of labels and counts each one once, even when it shows up in several photos.',
    sections: [
      { h2: 'Add your photos', text: ['The first time, get the text reader with Get more… and Download. It runs on this device. Then drop your photos on the page, or choose photos. Each photo is listed with Not read yet.'] },
      { h2: 'Read the serials', steps: ['Check the Serial pattern. The default matches serials of three letters, four digits and four letters or digits. Change it if your serials look different.', 'Choose Read photos. Each photo shows the serials found on it.', 'Fix a mistake by removing a serial with × or typing one under a photo and choosing Add.'],
        image: { src: '/assets/guides/serials-getting-started-1.jpg', alt: 'Serial counter with three label photos and the serials read from them' } },
      { h2: 'Count and export', text: ['Unique serials lists each serial once, with how many times it was seen and in which photos. Totals counts the photos, the serials and the repeats, and Photos to review (no serial found) counts the photos to check by hand.', 'Download serials (CSV) and Download photos (CSV) save the two tables. Clear starts again.'],
        image: { src: '/assets/guides/serials-getting-started-2.jpg', alt: 'The Unique serials table and the Totals, with two serials seen twice' } },
    ] },

  // Slop Calendar
  { app: 'calendar', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slop Calendar: events, repeats and time zones',
    description: 'Add events with repeats, reminders and their own time zone, switch between year, month, week, day and agenda views, and import or export .ics files.',
    h1: 'Getting started with Slop Calendar',
    lead: 'Slop Calendar keeps your events in this browser. It shows your to-dos from Slop To-do too, and reminds you before things start.',
    sections: [
      { h2: 'Add an event', steps: ['Choose New event.', 'Type a Title. Set the Start date, Start time, End date and End time, or tick All day.', 'Pick the Time zone of this event if it happens somewhere else.', 'Choose a Repeat (such as Every week) and a Reminder (such as 15 minutes before) if you want them. Add a Location and Notes.', 'Choose Save.'],
        image: { src: '/assets/guides/calendar-getting-started-1.jpg', alt: 'The New event dialog in Slop Calendar for a weekly stand-up with a 15-minute reminder' } },
      { h2: 'Find your way around', text: ['Year, Month, Week, Day, Split and Agenda change the view. The arrows move to the previous or next period, and Today comes back. Drag an event to move it.', 'The zone menu picks the time zone the calendar is shown in; events in another zone show theirs too. The To-dos box shows or hides tasks from Slop To-do.'],
        image: { src: '/assets/guides/calendar-getting-started-2.jpg', alt: 'The week view with a stand-up, a review, a lunch and an all-day birthday' } },
      { h2: 'Bring in another calendar', text: ['Import .ics reads a calendar file from Google Calendar, Outlook or Apple Calendar. It lists the events it found and how many will be added; choose Add to bring them in (the button says how many). Export .ics saves your events as a file for those programs.'],
        image: { src: '/assets/guides/calendar-getting-started-3.jpg', alt: 'The Import calendar dialog listing two events from an .ics file' } },
    ],
    shortcuts: [['N', 'New event'], ['T', 'Go to today'], ['← / →', 'Previous or next period'], ['Y / M / W / D', 'Year, month, week or day view'], ['S', 'Split view'], ['A', 'Agenda'], ['K', 'Show or hide to-dos'], ['Ctrl+Z', 'Undo a drag']] },

  // Slop To-do
  { app: 'todo', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slop To-do: tasks, lists and due dates',
    description: 'Add tasks in one line, give them due dates, lists, tags, repeats and reminders, tick them off, and see the ones with a time in Slop Calendar. A short guide.',
    h1: 'Getting started with Slop To-do',
    lead: 'Slop To-do keeps your tasks in lists, in this browser. Tasks with a due time also show in Slop Calendar.',
    sections: [
      { h2: 'Add tasks', text: ['Type in Add a task, then press Enter. It goes into the list you are looking at (the Inbox otherwise), and is due today when you are on the Today view.', 'For more, choose Details…. Set the Due date and Due time, the Priority, a List, Tags separated by commas, a Repeat, a Reminder and a Customer, then choose Save.'],
        image: { src: '/assets/guides/todo-getting-started-2.jpg', alt: 'The New task dialog with a due time, high priority, a list, tags and a reminder' } },
      { h2: 'Work through them', text: ['Today, Upcoming and All on the left show what is due, and your lists sit below them. New list adds one. Tick a task to complete it; Show done shows the ticked ones again. Click a task to change it or add subtasks. Find searches your tasks.'],
        image: { src: '/assets/guides/todo-getting-started-1.jpg', alt: 'All tasks in Slop To-do across the Inbox, Home and Work lists, one ticked' } },
      { h2: 'In your calendar', text: ['A task with a due date shows in Slop Calendar when its To-dos box is ticked: as a block at its time, or at the top of the day when it has no time. A task with no due date is not on the calendar. Reminders show in Slop Reminders.'],
        image: { src: '/assets/guides/todo-getting-started-3.jpg', alt: 'Slop Calendar showing one task at 4:00 PM and one task at the top of the day' } },
    ],
    shortcuts: [['N', 'New task'], ['T', 'Today'], ['U', 'Upcoming'], ['A', 'All tasks'], ['F', 'Find a task'], ['H', 'Show or hide done tasks']] },

  // Slop Reminders
  { app: 'reminders', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slop Reminders: one timeline of what is due',
    description: 'See the reminders from your calendar events and to-do tasks in one list, add your own, snooze or dismiss them, and turn on browser notifications.',
    h1: 'Getting started with Slop Reminders',
    lead: 'Slop Reminders puts every reminder in one timeline: the ones set on Slop Calendar events and Slop To-do tasks, and your own.',
    sections: [
      { h2: 'See what is coming', text: ['The list is grouped into Overdue, Today and Later. Each row shows when it fires, what it is for, and whether it came from an event, a to-do or a reminder you added.'],
        image: { src: '/assets/guides/reminders-getting-started-1.jpg', alt: 'Slop Reminders with two reminders today and events and reminders later' } },
      { h2: 'Add your own', steps: ['Type it in Custom reminder.', 'Set the Date and Time.', 'Choose Add reminder.'] },
      { h2: 'Snooze, dismiss and notify', text: ['Snooze… puts a reminder off for a while, and Dismiss clears it. Show dismissed brings the cleared ones back into view.', 'Reminders show as pop-ups while a Slop Reminders tab is open. Choose Allow browser notifications to get them from your browser as well.'] },
    ] },

  // Slop Drive
  { app: 'drive', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slop Drive: your files from every app',
    description: 'Upload files, make folders, open a file in the right app, switch between six views, star, tag and trash files, and back everything up. A short guide.',
    h1: 'Getting started with Slop Drive',
    lead: 'Slop Drive is the file store every Slopographic app shares. Files you save in one app are here, and you can open them in another. Everything stays in this browser.',
    sections: [
      { h2: 'Add files and folders', text: ['Choose New, then Upload files… or New folder. You can also drop files and folders straight onto the window. New also makes an empty document for apps such as Slop Docs.'],
        image: { src: '/assets/guides/drive-getting-started-1.jpg', alt: 'Slop Drive after uploading three photos and a sound file, in the grid view' } },
      { h2: 'Find and open', text: ['Search Slop Drive at the top finds files in every folder. The buttons above the files switch between six views: grid, list, compact, columns, nodes and disk usage. All kinds narrows the list to one kind of file.', 'Double-click a file to open it in its app, or right-click it for Open with, Quick look, Rename…, Add tags…, Move to… and more. Recent, Starred and Trash are on the left.'],
        image: { src: '/assets/guides/drive-getting-started-2.jpg', alt: 'The list view with name, type, size and modified columns' } },
      { h2: 'Keep your files safe', text: ['The storage box shows how much space you use. Ask the browser to keep it asks the browser not to clear your files when space runs low. Backup & restore… saves everything in one file and brings it back. Connect folder… keeps a copy of your files in a folder on this computer, in Chrome and Edge.'] },
    ],
    shortcuts: [['Enter', 'Open the folder or file'], ['Space', 'Quick look'], ['F2', 'Rename'], ['Delete', 'Move to Trash'], ['S', 'Star or unstar'], ['Ctrl+U', 'Upload files'], ['/', 'Search'], ['1 to 6', 'Grid, list, compact, columns, nodes, disk usage'], ['I', 'Info panel'], ['?', 'All shortcuts']] },

  // Slop Music
  { app: 'music', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Slop Music: play the audio in your Slop Drive',
    description: 'Add your music files, play them with shuffle, repeat and a waveform to seek on, make playlists and tag tracks. Nothing is uploaded. A short Slop Music guide.',
    h1: 'Getting started with Slop Music',
    lead: 'Slop Music plays the audio files in your Slop Drive. It reads titles, artists and covers from the files, and nothing leaves your device.',
    sections: [
      { h2: 'Add music', text: ['Choose Add files…, or drop files on the Library. They are saved into Slop Drive first. MP3, WAV, OGG, FLAC, M4A and Opus files work. With an empty library, Try it with 3 sample tracks shows how it works.', 'Search finds a title, artist or album, and Sort orders the list by artist, album or title.'],
        image: { src: '/assets/guides/music-getting-started-1.jpg', alt: 'The Slop Music library with three sample tracks' } },
      { h2: 'Play', text: ['Click a track to play it. Now playing shows the cover, a waveform you can click to seek, shuffle, previous, play, next and repeat, the volume and the Speed. Queue shows what plays next.', 'While you browse, a small player at the bottom keeps the track going.'],
        image: { src: '/assets/guides/music-getting-started-2.jpg', alt: 'Now playing with the waveform, playback buttons and speed' } },
      { h2: 'Playlists and tags', text: ['On Playlists, New playlist makes one; add tracks from the library and drag them into order. Save a playlist to Slop Drive or open one from it. Tags… on a track adds tags, and the Tags list on the left filters the library.'] },
    ],
    shortcuts: [['Space', 'Play or pause'], ['← / →', 'Seek 5 seconds (Shift: 15)'], ['↑ / ↓', 'Volume'], ['M', 'Mute'], ['N', 'Next track'], ['P', 'Previous track']] },

  // Reel Remix
  { app: 'remix', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with Reel Remix: an automatic edit from your clips',
    description: 'Add clips and photos, press Remix for a random edit with grids and a target length, reshuffle until you like it, then export it or fine-tune it in SlopCut.',
    h1: 'Getting started with Reel Remix',
    lead: 'Reel Remix turns a pile of clips and photos into a short edit, at random. Nothing is uploaded: the edit is planned and made on your device.',
    sections: [
      { h2: 'Add clips and photos', text: ['Drop files on Clips and photos, or choose Choose files. Videos and pictures can be mixed. When the files are in, a remix runs by itself; you can turn that off in Settings.'] },
      { h2: 'Make the edit', steps: ['Under Options, set the Target length, the Pace and the Export preset, such as Phone vertical 1080×1920.', 'Pick a Layout, or leave it to pick grids at random. Fill says how a clip fills its cell.', 'Choose Remix to build the edit, and Play to watch it.', 'Choose Reshuffle for a new random edit. Lock a slot or a cut to keep it while the rest changes.'],
        image: { src: '/assets/guides/remix-getting-started-1.jpg', alt: 'Reel Remix with five photos in a 3 by 3 grid edit and the options on the right' },
        tip: 'The Seed names an edit. The same seed, options and clips give the same edit again.' },
      { h2: 'Export or fine-tune', text: ['Export records the edit at the preset size and saves it as a WebM video (or MP4 where the browser records it). Keep the tab in view while it runs. Send to SlopCut opens the edit in SlopCut, where you can change every cut.'] },
    ] },

  // SlopCut
  { app: 'slopedit', slug: 'getting-started', crumb: 'Getting started',
    title: 'Getting started with SlopCut: edit a video in your browser',
    description: 'Import clips, put them on the timeline, cut and trim, add titles and transitions, and export an MP4 or WebM, all on your device. A short guide to SlopCut.',
    h1: 'Getting started with SlopCut',
    lead: 'SlopCut is a video editor with a media bin, a multi-track timeline and a live preview. Your footage never leaves your device.',
    sections: [
      { h2: 'Bring in your media', text: ['Choose Import in the Media tab, or drop video, audio and pictures anywhere on the window. Drive brings files from Slop Drive. The first clips you import go onto the timeline and set the size of the sequence.', 'To look around first, open the command search with Ctrl+K and choose Load sample project.'],
        image: { src: '/assets/guides/slopedit-getting-started-1.jpg', alt: 'SlopCut with the sample project: media bin, preview, inspector and a timeline with title, logo, video and audio tracks' } },
      { h2: 'Edit on the timeline', text: ['Drag clips from the bin onto a track, and drag them to move them. Drag a clip’s edge to trim it. S splits the clip at the playhead. Q and W trim the start or end to the playhead and close the gap.', 'Space plays and pauses, J, K and L shuttle back, stop and forward, and the arrow keys step a frame. Select a clip to change its timing, position, scale, colour and volume in the Inspector.'] },
      { h2: 'Titles, transitions and effects', text: ['The Effects tab holds transitions, titles, graphics and colour looks. Click one to apply it, or drag it onto the timeline. Templates sets up split screens and grids.'] },
      { h2: 'Export', text: ['Choose Export. Pick a size such as Phone 1080×1920 or Landscape 1920×1080, a frame rate and the quality, and export the whole sequence or the part between the in and out points. The video is an MP4 or WebM; you can download it or save it to Slop Drive. File also exports a GIF.'] },
    ],
    shortcuts: [['Space', 'Play or pause'], ['J / K / L', 'Shuttle back, stop, shuttle forward'], ['S', 'Split at the playhead'], ['Shift+S', 'Split all tracks'], ['Q / W', 'Ripple trim start or end to the playhead'], ['Ctrl+I', 'Import media'], ['Ctrl+E', 'Export video'], ['Ctrl+Z', 'Undo'], ['Ctrl+K', 'Search commands (Cmd+K on a Mac)']] },
];
