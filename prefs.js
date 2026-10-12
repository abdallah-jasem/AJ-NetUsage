import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AJNetUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings; // keep alive as long as the window

        const group = new Adw.PreferencesGroup({title: 'AJ-NetUsage'});

        const interval = new Adw.SpinRow({
            title: 'Refresh interval (seconds)',
            adjustment: new Gtk.Adjustment({lower: 1, upper: 10, step_increment: 1}),
        });
        settings.bind('refresh-interval', interval, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(interval);

        for (const [key, title] of [['show-cpu', 'Show CPU in top bar'], ['show-ram', 'Show RAM in top bar']]) {
            const row = new Adw.SwitchRow({title});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        }

        const positions = ['left', 'center', 'right'];
        const position = new Adw.ComboRow({
            title: 'Position in top bar',
            model: Gtk.StringList.new(['Left', 'Center', 'Right']),
            selected: positions.indexOf(settings.get_string('position')),
        });
        position.connect('notify::selected', () =>
            settings.set_string('position', positions[position.selected]));
        group.add(position);

        const skip = new Adw.EntryRow({
            title: 'Ignored interface prefixes (comma-separated)',
            text: settings.get_strv('skip-interfaces').join(', '),
            show_apply_button: true,
        });
        skip.connect('apply', () => settings.set_strv('skip-interfaces',
            skip.text.split(',').map(s => s.trim()).filter(Boolean)));
        group.add(skip);

        const page = new Adw.PreferencesPage();
        page.add(group);
        window.add(page);
    }
}
