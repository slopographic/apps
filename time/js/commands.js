/* Slop Time commands for SlopCmd (palette, shortcut editor and menu labels). Classic script, loaded after
 * shared/commands/commands.js. Each command calls the same functions as the buttons. */
(function () {
  'use strict';
  const show = (id) => () => window.SlopTimeApp.show(id);
  const focus = (id) => () => { window.SlopTimeApp.show(id.split(':')[0]); const el = document.getElementById(id.split(':')[1]); if (el) el.focus(); };

  function register() {
    if (!window.SlopCmd) return;
    const C = window.SlopTime.clocks;
    SlopCmd.init({ app: 'time' });
    SlopCmd.register([
      { id: 'time.world', title: 'Show the world clock', group: 'Go', keys: ['Mod+Alt+1'], keywords: ['cities', 'clock'], run: show('world') },
      { id: 'time.my', title: 'Show my time', group: 'Go', keys: ['Mod+Alt+2'], keywords: ['working hours', 'overlap'], run: show('my') },
      { id: 'time.meet', title: 'Plan a meeting', group: 'Go', keys: ['Mod+Alt+3'], keywords: ['schedule', 'overlap', 'zones'], run: show('meet') },
      { id: 'time.convert', title: 'Convert a time between zones', group: 'Go', keys: ['Mod+Alt+4'], keywords: ['converter', 'difference'], run: show('conv') },
      { id: 'time.timers', title: 'Stopwatch and timer', group: 'Go', keys: ['Mod+Alt+5'], keywords: ['countdown', 'lap'], run: show('timers') },
      { id: 'time.sync', title: 'Manual clock offset (not a network sync)', group: 'Go', keys: ['Mod+Alt+6'], keywords: ['sync', 'offset', 'clock'], run: show('sync') },
      { id: 'time.add', title: 'Add a city', group: 'World', keys: ['Mod+Alt+A'], keywords: ['zone', 'search'], run: focus('world:st-add') },
      { id: 'time.now', title: 'Converter: use the current time', group: 'Convert', keys: [], keywords: ['now'], run: () => { window.SlopTimeApp.show('conv'); window.SlopTime.conv.useNow(); } },
      { id: 'time.sw.toggle', title: 'Stopwatch: start or stop', group: 'Timers', keys: ['Mod+Alt+G'], keywords: ['stopwatch', 'run'], run: () => { window.SlopTimeApp.show('timers'); C.toggleStopwatch(); } },
      { id: 'time.sw.lap', title: 'Stopwatch: lap', group: 'Timers', keys: [], keywords: ['split'], run: () => C.lap() },
      { id: 'time.sw.reset', title: 'Stopwatch: reset', group: 'Timers', keys: [], keywords: ['clear'], run: () => C.resetStopwatch() },
      { id: 'time.tm.toggle', title: 'Countdown: start or pause', group: 'Timers', keys: [], keywords: ['timer', 'pause'], run: () => { window.SlopTimeApp.show('timers'); C.toggleTimer(); } },
      { id: 'time.tm.reset', title: 'Countdown: reset', group: 'Timers', keys: [], keywords: ['timer'], run: () => C.resetTimer() },
    ]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register); else register();
})();
